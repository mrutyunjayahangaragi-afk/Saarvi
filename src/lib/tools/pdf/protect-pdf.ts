import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";
import { injectStandardEncryptionDictionary, PdfPermissionOptions } from "./pdf-crypto";

export interface ProtectPdfConfig extends PdfPermissionOptions {
  userPassword?: string;
  ownerPassword?: string;
}

export const protectPdfOperation: ToolOperation<
  ProtectPdfConfig,
  SingleFileResult | MultiFileResult
> = {
  id: "protect-pdf",

  validate(files: File[], config?: ProtectPdfConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select at least one PDF file to protect." };
    }

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
        return { valid: false, error: `"${file.name}" is not a valid PDF file.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB file limit.` };
      }
    }

    if (!config?.userPassword && !config?.ownerPassword) {
      return {
        valid: false,
        error: "Please enter a password to protect the document.",
      };
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: ProtectPdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    const userPassword = config.userPassword || "";
    const ownerPassword = config.ownerPassword || userPassword;

    if (!userPassword && !ownerPassword) {
      throw new Error("A valid password is required to encrypt this PDF.");
    }

    // Single File Processing
    if (files.length === 1) {
      const file = files[0];
      const securityCheck = await validateInputFile(file, ["pdf"]);
      if (!securityCheck.valid) {
        throw new Error(securityCheck.error || "Security validation failed for the uploaded PDF.");
      }

      if (onProgress) onProgress(20);

      const buffer = await readFileAsArrayBuffer(file);
      let pdfDoc: PDFDocument;
      try {
        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      } catch (err: any) {
        throw new Error("Could not load PDF document. It may be corrupt or encrypted with an unsupported format.");
      }

      if (onProgress) onProgress(55);

      const baseBytes = await pdfDoc.save({ useObjectStreams: false });
      const protectedBytes = injectStandardEncryptionDictionary(
        baseBytes,
        userPassword,
        ownerPassword,
        {
          allowPrinting: config.allowPrinting !== false,
          allowModifying: config.allowModifying === true,
          allowCopying: config.allowCopying !== false,
          allowAnnotations: config.allowAnnotations === true,
        }
      );

      if (onProgress) onProgress(90);

      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const finalFilename = `${cleanName}_protected.pdf`;
      const blob = new Blob([protectedBytes as unknown as BlobPart], { type: "application/pdf" });
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
      const baseBytes = await pdfDoc.save({ useObjectStreams: false });
      const protectedBytes = injectStandardEncryptionDictionary(
        baseBytes,
        userPassword,
        ownerPassword,
        config
      );

      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const outName = `${cleanName}_protected.pdf`;
      const blob = new Blob([protectedBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";

      zip.file(outName, protectedBytes);
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
    const zipFilename = `protected_pdfs_${Date.now()}.zip`;

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
