import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";
import { parsePageRange } from "./page-range-parser";

export interface PageNumbersPdfConfig {
  position?: "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";
  format?: "number" | "page-number" | "page-number-of-total";
  startNumber?: number; // default 1
  margin?: number; // default 30
  fontSize?: number; // default 10
  pageRange?: string; // "all" or e.g. "2-5"
}

export const pageNumbersPdfOperation: ToolOperation<
  PageNumbersPdfConfig,
  SingleFileResult | MultiFileResult
> = {
  id: "page-numbers-pdf",

  validate(files: File[], config?: PageNumbersPdfConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select at least one PDF file to number." };
    }

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
        return { valid: false, error: `"${file.name}" is not a valid PDF file.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB file limit.` };
      }
    }

    if (config?.startNumber !== undefined && config.startNumber <= 0) {
      return { valid: false, error: "Starting page number must be 1 or greater." };
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: PageNumbersPdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    const position = config.position || "bottom-center";
    const format = config.format || "page-number-of-total";
    const startNum = config.startNumber && config.startNumber > 0 ? config.startNumber : 1;
    const margin = typeof config.margin === "number" ? config.margin : 30;
    const fontSize = typeof config.fontSize === "number" && config.fontSize > 0 ? config.fontSize : 10;

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
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();

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

      for (let i = 0; i < targetIndices.length; i++) {
        const idx = targetIndices[i];
        const page = pdfDoc.getPage(idx);
        const { width, height } = page.getSize();
        const displayPageNum = startNum + i;

        let label = `${displayPageNum}`;
        if (format === "page-number") {
          label = `Page ${displayPageNum}`;
        } else if (format === "page-number-of-total") {
          label = `Page ${displayPageNum} of ${totalPages}`;
        }

        const textWidth = font.widthOfTextAtSize(label, fontSize);

        let x = (width - textWidth) / 2; // default center
        if (position.includes("right")) {
          x = width - margin - textWidth;
        } else if (position.includes("left")) {
          x = margin;
        }

        let y = margin; // default bottom
        if (position.includes("top")) {
          y = height - margin - fontSize;
        }

        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.25, 0.3),
        });

        if (onProgress) {
          onProgress(45 + Math.round(((i + 1) / targetIndices.length) * 45));
        }
      }

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const finalFilename = `${cleanName}_numbered.pdf`;
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

    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      totalOriginalSize += file.size;

      const buffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();

      for (let p = 0; p < totalPages; p++) {
        const page = pdfDoc.getPage(p);
        const { width, height } = page.getSize();
        const displayPageNum = startNum + p;

        let label = `${displayPageNum}`;
        if (format === "page-number") {
          label = `Page ${displayPageNum}`;
        } else if (format === "page-number-of-total") {
          label = `Page ${displayPageNum} of ${totalPages}`;
        }

        const textWidth = font.widthOfTextAtSize(label, fontSize);
        let x = (width - textWidth) / 2;
        if (position.includes("right")) x = width - margin - textWidth;
        else if (position.includes("left")) x = margin;

        let y = margin;
        if (position.includes("top")) y = height - margin - fontSize;

        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.25, 0.3),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const outName = `${cleanName}_numbered.pdf`;
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
        onProgress(Math.round(((f + 1) / files.length) * 90));
      }
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const zipBlob = new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
    const zipFilename = `numbered_pdfs_${Date.now()}.zip`;

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
