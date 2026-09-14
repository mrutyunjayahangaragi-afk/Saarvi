import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { parsePageRange } from "./page-range-parser";

export interface DeletePdfPagesConfig {
  rangeString: string; // e.g. "2, 5, 8-10"
}

export const deletePdfPagesOperation: ToolOperation<DeletePdfPagesConfig, SingleFileResult> = {
  id: "delete-pdf-pages",

  validate(files: File[], config?: DeletePdfPagesConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document." };
    }
    const file = files[0];
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: "Please select a valid PDF file." };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50 MB limit." };
    }
    if (config && (!config.rangeString || !config.rangeString.trim())) {
      return { valid: false, error: "Please specify the page numbers to delete (e.g. 2, 5, 8-10)." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: DeletePdfPagesConfig,
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

    // Get 0-indexed pages to DELETE
    const rangeResult = parsePageRange(config.rangeString, totalPages);
    if (!rangeResult.valid || rangeResult.indices.length === 0) {
      throw new Error(rangeResult.error || `No pages found matching "${config.rangeString}". Document has ${totalPages} pages.`);
    }
    const indicesToDelete = rangeResult.indices;

    if (indicesToDelete.length >= totalPages) {
      throw new Error("You cannot delete all pages. Please keep at least one page.");
    }

    // Build new PDF from all pages EXCEPT deleted ones
    const newDoc = await PDFDocument.create();
    const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter(
      (i) => !indicesToDelete.includes(i)
    );

    const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
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
      filename: `${baseName}_pages_deleted.pdf`,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        originalPages: totalPages,
        deletedPages: indicesToDelete.length,
        remainingPages: keepIndices.length,
      },
    };
  },
};
