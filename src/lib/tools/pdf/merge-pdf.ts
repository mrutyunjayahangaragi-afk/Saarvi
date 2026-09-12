import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";

export type MergePdfConfig = Record<string, never>;

export const mergePdfOperation: ToolOperation<MergePdfConfig, SingleFileResult> = {
  id: "merge-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length < 2) {
      return { valid: false, error: "Please select at least two PDF documents to merge." };
    }

    for (const file of files) {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        return { valid: false, error: `"${file.name}" is not a valid PDF document.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the maximum 50MB file size.` };
      }
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    _config: MergePdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    void _config;
    const mergedDoc = await PDFDocument.create();
    const totalFiles = files.length;
    let totalPages = 0;
    let totalOriginalSize = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const buffer = await readFileAsArrayBuffer(file);
      let srcDoc: PDFDocument;
      try {
        srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      } catch {
        throw new Error(`We couldn't read "${file.name}". The file may be password-protected or corrupted.`);
      }

      const pageIndices = srcDoc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);

      for (const page of copiedPages) {
        mergedDoc.addPage(page);
        totalPages++;
      }

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalFiles) * 85));
      }
    }

    const mergedBytes = await mergedDoc.save();
    if (onProgress) onProgress(100);

    const blob = new Blob([mergedBytes as unknown as BlobPart], { type: "application/pdf" });

    return {
      type: "single",
      blob,
      filename: "merged_document.pdf",
      originalSize: totalOriginalSize,
      newSize: blob.size,
      details: {
        mergedFiles: totalFiles,
        totalPageCount: totalPages
      }
    };
  }
};
