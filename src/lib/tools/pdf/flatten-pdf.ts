import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";

export interface FlattenPdfConfig {
  flattenForms?: boolean;
}

export const flattenPdfOperation: ToolOperation<
  FlattenPdfConfig,
  SingleFileResult | MultiFileResult
> = {
  id: "flatten-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select at least one PDF file to flatten." };
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
    _config?: FlattenPdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    // Single File Processing
    if (files.length === 1) {
      const file = files[0];
      const securityCheck = await validateInputFile(file, ["pdf"]);
      if (!securityCheck.valid) {
        throw new Error(securityCheck.error || "Security check failed.");
      }

      if (onProgress) onProgress(20);

      const buffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

      if (onProgress) onProgress(50);

      try {
        // Flatten interactive form fields and their visual appearances into static graphics
        const form = pdfDoc.getForm();
        form.flatten();
      } catch (err: any) {
        // If document has no interactive AcroForm fields, it is already structurally flat
      }

      if (onProgress) onProgress(80);

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const finalFilename = `${cleanName}_flattened.pdf`;
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

      try {
        const form = pdfDoc.getForm();
        form.flatten();
      } catch {}

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const outName = `${cleanName}_flattened.pdf`;
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
    const zipFilename = `flattened_pdfs_${Date.now()}.zip`;

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
