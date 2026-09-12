import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";

export interface ReorderPdfPagesConfig {
  /**
   * New page order as 1-indexed page numbers.
   * e.g. [3, 1, 2] means "page 3 first, then page 1, then page 2"
   * Must contain exactly the same set of page numbers as the document.
   */
  newOrder: number[];
}

export const reorderPdfPagesOperation: ToolOperation<ReorderPdfPagesConfig, SingleFileResult> = {
  id: "reorder-pdf-pages",

  validate(files: File[], config?: ReorderPdfPagesConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to reorder." };
    }
    const file = files[0];
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: "Please select a valid PDF file." };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50 MB limit." };
    }
    if (config && config.newOrder.length === 0) {
      return { valid: false, error: "No page order provided." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: ReorderPdfPagesConfig,
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
    if (onProgress) onProgress(35);

    // Validate order covers all pages exactly
    const sorted = [...config.newOrder].sort((a, b) => a - b);
    const expected = Array.from({ length: totalPages }, (_, i) => i + 1);
    const isValid = sorted.length === totalPages && sorted.every((v, i) => v === expected[i]);

    if (!isValid) {
      throw new Error(
        `Page order must include all ${totalPages} page numbers exactly once.`
      );
    }

    // Convert 1-indexed to 0-indexed
    const zeroIndexedOrder = config.newOrder.map((p) => p - 1);

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, zeroIndexedOrder);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    if (onProgress) onProgress(85);

    const pdfBytes = await newDoc.save();
    if (onProgress) onProgress(100);

    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const baseName = file.name.replace(/\.pdf$/i, "");

    return {
      type: "single",
      blob,
      filename: `${baseName}_reordered.pdf`,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        pages: totalPages,
        newOrder: config.newOrder.join(", "),
      },
    };
  },
};
