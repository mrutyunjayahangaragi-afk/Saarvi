import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";
import { parsePageRange } from "./page-range-parser";

export interface WatermarkPdfConfig {
  watermarkText: string;
  opacity?: number; // 0.05 to 1.0, default 0.25
  fontSize?: number; // default 48
  rotation?: number; // degrees, default 45
  position?: "center" | "top" | "bottom";
  colorHex?: string; // default "#64748B" (slate-500)
  pageRange?: string; // "all" or e.g. "1-3, 5"
}

function parseHexColor(hex = "#64748B"): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return {
      r: isNaN(r) ? 0.4 : r,
      g: isNaN(g) ? 0.45 : g,
      b: isNaN(b) ? 0.55 : b,
    };
  }
  return { r: 0.4, g: 0.45, b: 0.55 };
}

export const watermarkPdfOperation: ToolOperation<
  WatermarkPdfConfig,
  SingleFileResult | MultiFileResult
> = {
  id: "watermark-pdf",

  validate(files: File[], config?: WatermarkPdfConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select at least one PDF file to watermark." };
    }

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
        return { valid: false, error: `"${file.name}" is not a valid PDF file.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB file limit.` };
      }
    }

    if (!config?.watermarkText || !config.watermarkText.trim()) {
      return { valid: false, error: "Please enter watermark text." };
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: WatermarkPdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    const text = config.watermarkText.trim();
    const opacity = typeof config.opacity === "number" ? Math.max(0.05, Math.min(1.0, config.opacity)) : 0.25;
    const fontSize = typeof config.fontSize === "number" && config.fontSize > 0 ? config.fontSize : 48;
    const rotationDeg = typeof config.rotation === "number" ? config.rotation : 45;
    const position = config.position || "center";
    const { r, g, b } = parseHexColor(config.colorHex);

    // Single File Processing
    if (files.length === 1) {
      const file = files[0];
      const securityCheck = await validateInputFile(file, ["pdf"]);
      if (!securityCheck.valid) {
        throw new Error(securityCheck.error || "Security check failed.");
      }

      if (onProgress) onProgress(15);

      const buffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const totalPages = pdfDoc.getPageCount();

      // Determine target pages
      let targetIndices: number[] = [];
      if (!config.pageRange || config.pageRange.trim().toLowerCase() === "all") {
        targetIndices = Array.from({ length: totalPages }, (_, i) => i);
      } else {
        const parseRes = parsePageRange(config.pageRange, totalPages);
        if (!parseRes.valid) {
          throw new Error(parseRes.error || "Invalid page range specified.");
        }
        targetIndices = parseRes.indices;
      }

      if (onProgress) onProgress(45);

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      for (let i = 0; i < targetIndices.length; i++) {
        const idx = targetIndices[i];
        const page = pdfDoc.getPage(idx);
        const { width, height } = page.getSize();

        let x = (width - textWidth) / 2;
        let y = (height - textHeight) / 2;

        if (position === "top") {
          y = height - textHeight - 60;
        } else if (position === "bottom") {
          y = 60;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(rotationDeg),
        });

        if (onProgress) {
          onProgress(45 + Math.round(((i + 1) / targetIndices.length) * 45));
        }
      }

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const finalFilename = `${cleanName}_watermarked.pdf`;
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";

      if (onProgress) onProgress(100);

      return {
        type: "single",
        blob,
        filename: finalFilename,
        originalSize: file.size,
        newSize: blob.size,
      };
    }

    // Batch Processing
    const zip = new JSZip();
    const convertedFiles: MultiFileResult["files"] = [];
    let totalOriginalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const buffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const totalPages = pdfDoc.getPageCount();

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      for (let p = 0; p < totalPages; p++) {
        const page = pdfDoc.getPage(p);
        const { width, height } = page.getSize();
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: (height - textHeight) / 2,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(rotationDeg),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const outName = `${cleanName}_watermarked.pdf`;
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";

      zip.file(outName, pdfBytes);
      convertedFiles.push({
        blob,
        filename: outName,
        url,
        size: blob.size,
      });

      if (onProgress) {
        onProgress(Math.round(((i + 1) / files.length) * 90));
      }
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const zipBlob = new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
    const zipUrl = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(zipBlob) : "";
    const zipFilename = `watermarked_pdfs_${Date.now()}.zip`;

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
