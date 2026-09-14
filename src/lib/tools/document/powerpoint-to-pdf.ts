import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";
import { parsePptxPresentation } from "./openxml-helper";

export interface PowerPointToPdfConfig {
  pageSize?: "presentation" | "A4";
}

/**
 * Converts a hex color string ("0F172A") into pdf-lib RGB values
 */
function hexToPdfRgb(hex?: string): { r: number; g: number; b: number } {
  if (!hex || hex.length < 6) return { r: 0.06, g: 0.09, b: 0.16 };
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return {
    r: isNaN(r) ? 0.06 : r,
    g: isNaN(g) ? 0.09 : g,
    b: isNaN(b) ? 0.16 : b,
  };
}

/**
 * Wraps text to fit within a given bounding box width
 */
function wrapSlideText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) <= maxWidth) {
            chunk += ch;
          } else {
            lines.push(chunk);
            chunk = ch;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/**
 * Converts a single PPTX presentation file to a genuine PDF document
 */
async function convertSinglePptxToPdf(
  file: File,
  _config: PowerPointToPdfConfig = {},
  onProgress?: (pct: number) => void
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number }> {
  const securityCheck = await validateInputFile(file, ["pptx"], 50 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid PowerPoint (.pptx) file structure.");
  }

  if (onProgress) onProgress(15);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const slides = await parsePptxPresentation(arrayBuffer);

  if (!slides || slides.length === 0) {
    throw new Error("No slides found in this PowerPoint presentation.");
  }

  if (onProgress) onProgress(35);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  for (let sIdx = 0; sIdx < slides.length; sIdx++) {
    const slide = slides[sIdx];
    const widthPt = slide.widthPt || 720;
    const heightPt = slide.heightPt || 540;

    // Create 1 PDF page per slide preserving aspect ratio
    const page = pdfDoc.addPage([widthPt, heightPt]);

    // Draw white background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: widthPt,
      height: heightPt,
      color: rgb(1, 1, 1),
    });

    // Render slide elements
    for (const el of slide.elements) {
      if (el.type === "image" && el.imageBytes && el.imageBytes.length > 0) {
        try {
          const isPng = el.imageFormat === "png";
          const embeddedImage = isPng
            ? await pdfDoc.embedPng(el.imageBytes)
            : await pdfDoc.embedJpg(el.imageBytes);

          const drawY = Math.max(0, heightPt - el.yPt - el.heightPt);
          page.drawImage(embeddedImage, {
            x: Math.max(0, el.xPt),
            y: drawY,
            width: Math.min(widthPt, el.widthPt),
            height: Math.min(heightPt, el.heightPt),
          });
        } catch (imgErr) {
          console.warn("Could not embed slide image:", imgErr);
        }
      } else if (el.type === "text" && el.text) {
        const font = el.bold ? fontBold : el.italic ? fontItalic : fontRegular;
        const fontSize = Math.max(9, Math.min(36, el.fontSize || 14));
        const colorVal = hexToPdfRgb(el.color);
        const textColor = rgb(colorVal.r, colorVal.g, colorVal.b);

        const maxWidth = Math.max(40, el.widthPt);
        const lines = wrapSlideText(el.text, font, fontSize, maxWidth);
        const lineHeight = fontSize * 1.25;

        // In PDF coordinates: 0,0 is bottom-left
        let currentY = heightPt - el.yPt - fontSize;

        for (const line of lines) {
          if (line && currentY > 0 && currentY < heightPt) {
            page.drawText(line, {
              x: Math.max(10, el.xPt),
              y: currentY,
              size: fontSize,
              font,
              color: textColor,
            });
          }
          currentY -= lineHeight;
        }
      }
    }

    if (onProgress) {
      onProgress(35 + Math.round(((sIdx + 1) / slides.length) * 55));
    }
  }

  if (onProgress) onProgress(95);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const filename = `${baseName}.pdf`;

  if (onProgress) onProgress(100);

  return {
    filename,
    blob,
    originalSize: file.size,
    newSize: blob.size,
  };
}

export const powerPointToPdfOperation: ToolOperation<PowerPointToPdfConfig, SingleFileResult | MultiFileResult> = {
  id: "powerpoint-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PowerPoint (.pptx) presentation to convert." };
    }
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pptx") && !file.type.includes("presentation")) {
        return { valid: false, error: `"${file.name}" is not a valid Microsoft PowerPoint (.pptx) file.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: PowerPointToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one PowerPoint presentation to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSinglePptxToPdf(files[0], config, onProgress);
      return {
        type: "single",
        filename: res.filename,
        blob: res.blob,
        originalSize: res.originalSize,
        newSize: res.newSize,
      };
    }

    // Batch conversion
    const zip = new JSZip();
    const convertedFiles: MultiFileResult["files"] = [];
    let totalOriginalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const singleProgress = (pct: number) => {
        if (onProgress) {
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          onProgress(overall);
        }
      };

      const res = await convertSinglePptxToPdf(file, config, singleProgress);
      zip.file(res.filename, res.blob);
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(res.blob) : "";
      convertedFiles.push({ filename: res.filename, blob: res.blob, url, size: res.newSize });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const firstBase = sanitizeFilename(files[0].name.replace(/\.[^/.]+$/, ""));
    const zipFilename = `${firstBase}_and_${files.length - 1}_more_pdf.zip`;

    if (onProgress) onProgress(100);

    return {
      type: "multiple",
      zipBlob,
      zipFilename,
      files: convertedFiles,
      originalSize: totalOriginalSize,
      newSize: zipBlob.size,
    };
  },
};
