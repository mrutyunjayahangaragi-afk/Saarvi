import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";

export interface TxtToPdfConfig {
  fontSize?: number;
  lineSpacing?: number;
}

/**
 * Wraps a single paragraph of text into lines that fit within maxWidth
 */
function wrapParagraph(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(" ");
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

  return lines;
}

/**
 * Converts a single text file into a clean, paginated PDF document
 */
async function convertSingleTxtToPdf(
  file: File,
  config: TxtToPdfConfig = {},
  onProgress?: (pct: number) => void
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number }> {
  const securityCheck = await validateInputFile(file, ["txt"], 25 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid text file structure.");
  }

  if (onProgress) onProgress(20);

  const rawText = await file.text();
  if (!rawText.trim()) {
    throw new Error("The text file is empty.");
  }

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 50;
  const printableWidth = pageWidth - margin * 2;
  const fontSize = Math.max(8, Math.min(14, config.fontSize || 10));
  const lineHeight = fontSize * (config.lineSpacing || 1.4);

  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);

  let currentY = pageHeight - margin;

  // Draw Document Title at top
  const titleText = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  currentPage.drawText(titleText, {
    x: margin,
    y: currentY - 14,
    size: 14,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  currentY -= 35;

  // Split text by newlines
  const rawParagraphs = rawText.split(/\r?\n/);
  const totalParagraphs = rawParagraphs.length;

  for (let pIdx = 0; pIdx < totalParagraphs; pIdx++) {
    const para = rawParagraphs[pIdx];

    // Empty line creates vertical paragraph spacing
    if (!para.trim()) {
      currentY -= lineHeight * 0.75;
      if (currentY < margin + 30) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        pages.push(currentPage);
        currentY = pageHeight - margin;
      }
      continue;
    }

    const wrappedLines = wrapParagraph(para, fontRegular, fontSize, printableWidth);

    for (const line of wrappedLines) {
      if (currentY - lineHeight < margin + 25) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        pages.push(currentPage);
        currentY = pageHeight - margin;
      }

      currentPage.drawText(line, {
        x: margin,
        y: currentY - fontSize,
        size: fontSize,
        font: fontRegular,
        color: rgb(0.15, 0.2, 0.28),
      });

      currentY -= lineHeight;
    }

    if (onProgress && pIdx % 50 === 0) {
      onProgress(20 + Math.round((pIdx / totalParagraphs) * 65));
    }
  }

  // Draw Page Numbers in footer
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const footer = `Page ${i + 1} of ${totalPages}`;
    const textW = fontRegular.widthOfTextAtSize(footer, 8);
    page.drawText(footer, {
      x: (pageWidth - textW) / 2,
      y: margin / 2,
      size: 8,
      font: fontRegular,
      color: rgb(0.6, 0.65, 0.72),
    });
  }

  if (onProgress) onProgress(90);

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

export const textToPdfOperation: ToolOperation<TxtToPdfConfig, SingleFileResult | MultiFileResult> = {
  id: "txt-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a text (.txt) file to convert to PDF." };
    }
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
        return { valid: false, error: `"${file.name}" is not a valid text (.txt) file.` };
      }
      if (file.size > 25 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 25MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: TxtToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one text file to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSingleTxtToPdf(files[0], config, onProgress);
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

      const res = await convertSingleTxtToPdf(file, config, singleProgress);
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
