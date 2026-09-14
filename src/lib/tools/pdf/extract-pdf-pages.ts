import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { parsePageRange } from "./page-range-parser";

export interface ExtractPagesConfig {
  rangeString: string; // e.g. "2, 5, 8-10"
}

export const extractPagesOperation: ToolOperation<ExtractPagesConfig, SingleFileResult> = {
  id: "extract-pdf-pages",

  validate(files: File[], config?: ExtractPagesConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to extract pages from." };
    }
    const file = files[0];
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: "Please select a valid PDF file." };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50MB limit." };
    }
    if (config && (!config.rangeString || !config.rangeString.trim())) {
      return { valid: false, error: "Please specify at least one page number to extract." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: ExtractPagesConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(15);

    const buffer = await readFileAsArrayBuffer(file);
    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch {
      throw new Error("We couldn't read this PDF. It may be password-protected or corrupted.");
    }

    const totalPages = srcDoc.getPageCount();
    const rangeResult = parsePageRange(config.rangeString, totalPages);
    if (!rangeResult.valid || rangeResult.indices.length === 0) {
      throw new Error(rangeResult.error || `No pages found matching "${config.rangeString}". Document has ${totalPages} pages.`);
    }
    const indices = rangeResult.indices;

    if (onProgress) onProgress(45);

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, indices);

    for (let i = 0; i < copiedPages.length; i++) {
      newDoc.addPage(copiedPages[i]);
      if (onProgress) {
        onProgress(45 + Math.round(((i + 1) / copiedPages.length) * 45));
      }
    }

    const pdfBytes = await newDoc.save();
    if (onProgress) onProgress(100);

    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const baseName = file.name.replace(/\.pdf$/i, "");
    const outputFilename = `${baseName}_extracted_pages.pdf`;

    return {
      type: "single",
      blob,
      filename: outputFilename,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        extractedCount: indices.length,
        totalPages
      }
    };
  }
};
