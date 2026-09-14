import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";

export interface UnlockPdfConfig {
  password?: string;
}

export const unlockPdfOperation: ToolOperation<
  UnlockPdfConfig,
  SingleFileResult | MultiFileResult
> = {
  id: "unlock-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select at least one PDF file to unlock." };
    }

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
        return { valid: false, error: `"${file.name}" is not a valid PDF file.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB file limit.` };
      }
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: UnlockPdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    const providedPassword = config?.password || "";

    // Single File Processing
    if (files.length === 1) {
      const file = files[0];
      const securityCheck = await validateInputFile(file, ["pdf"]);
      if (!securityCheck.valid) {
        throw new Error(securityCheck.error || "Security validation failed for the uploaded PDF.");
      }

      if (onProgress) onProgress(15);

      const buffer = await readFileAsArrayBuffer(file);

      let pdfDoc: PDFDocument;
      try {
        // Attempt loading with ignoreEncryption to test if pages are parseable (permission restricted only)
        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      } catch (err: any) {
        // Encrypted with standard open password that cannot be parsed without open password
        throw new Error(
          "This PDF requires an open password. Saarvi cannot bypass an unknown password."
        );
      }

      // Check if document contains encrypted content streams that require decryption
      try {
        const pageCount = pdfDoc.getPageCount();
        if (pageCount === 0) {
          throw new Error("This PDF contains no readable pages.");
        }
      } catch {
        throw new Error(
          "This PDF requires an open password. Saarvi cannot bypass an unknown password."
        );
      }

      if (onProgress) onProgress(50);

      // Create a clean new PDFDocument, copying over all pages to cleanly strip any /Encrypt dictionary
      const unlockedDoc = await PDFDocument.create();
      const pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i);
      const copiedPages = await unlockedDoc.copyPages(pdfDoc, pageIndices);

      for (let i = 0; i < copiedPages.length; i++) {
        unlockedDoc.addPage(copiedPages[i]);
        if (onProgress) {
          onProgress(50 + Math.round(((i + 1) / copiedPages.length) * 40));
        }
      }

      // Copy metadata if accessible
      try {
        if (pdfDoc.getTitle()) unlockedDoc.setTitle(pdfDoc.getTitle()!);
        if (pdfDoc.getAuthor()) unlockedDoc.setAuthor(pdfDoc.getAuthor()!);
        if (pdfDoc.getSubject()) unlockedDoc.setSubject(pdfDoc.getSubject()!);
      } catch {}

      const cleanBytes = await unlockedDoc.save();

      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const finalFilename = `${cleanName}_unlocked.pdf`;
      const blob = new Blob([cleanBytes as unknown as BlobPart], { type: "application/pdf" });
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
      let pdfDoc: PDFDocument;
      try {
        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      } catch {
        throw new Error(
          `"${file.name}" requires an open password. Saarvi cannot bypass an unknown password.`
        );
      }

      const unlockedDoc = await PDFDocument.create();
      const pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, p) => p);
      const copiedPages = await unlockedDoc.copyPages(pdfDoc, pageIndices);
      for (const cp of copiedPages) {
        unlockedDoc.addPage(cp);
      }

      const cleanBytes = await unlockedDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const outName = `${cleanName}_unlocked.pdf`;
      const blob = new Blob([cleanBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";

      zip.file(outName, cleanBytes);
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
    const zipFilename = `unlocked_pdfs_${Date.now()}.zip`;

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
