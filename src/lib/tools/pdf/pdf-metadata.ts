import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";

export interface PdfMetadataValues {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface PdfMetadataConfig {
  action?: "update" | "clear";
  metadata: PdfMetadataValues;
}

/**
 * Extracts raw metadata properties from an uploaded PDF without modifying it
 */
export async function readPdfMetadata(file: File): Promise<PdfMetadataValues> {
  const buffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

  const keywordsRaw = pdfDoc.getKeywords();
  let keywords: string[] = [];
  if (keywordsRaw) {
    keywords = keywordsRaw.split(/[,;]/).map((k) => k.trim()).filter(Boolean);
  }

  return {
    title: pdfDoc.getTitle() || "",
    author: pdfDoc.getAuthor() || "",
    subject: pdfDoc.getSubject() || "",
    keywords,
    creator: pdfDoc.getCreator() || "",
    producer: pdfDoc.getProducer() || "",
    creationDate: pdfDoc.getCreationDate() ? pdfDoc.getCreationDate()!.toISOString() : "",
    modificationDate: pdfDoc.getModificationDate() ? pdfDoc.getModificationDate()!.toISOString() : "",
  };
}

export const pdfMetadataOperation: ToolOperation<
  PdfMetadataConfig,
  SingleFileResult
> = {
  id: "pdf-metadata",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF file to view or edit metadata." };
    }
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
      return { valid: false, error: `"${file.name}" is not a valid PDF file.` };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: `"${file.name}" exceeds the 50MB file limit.` };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: PdfMetadataConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    const securityCheck = await validateInputFile(file, ["pdf"]);
    if (!securityCheck.valid) {
      throw new Error(securityCheck.error || "Security check failed.");
    }

    if (onProgress) onProgress(20);

    const buffer = await readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

    if (onProgress) onProgress(50);

    const action = config?.action || "update";
    const meta = config?.metadata || {};

    if (action === "clear") {
      // Clear all metadata fields
      pdfDoc.setTitle("");
      pdfDoc.setAuthor("");
      pdfDoc.setSubject("");
      pdfDoc.setKeywords([]);
      pdfDoc.setCreator("");
      pdfDoc.setProducer("");
    } else {
      // Update with user-provided values
      if (meta.title !== undefined) pdfDoc.setTitle(meta.title.trim());
      if (meta.author !== undefined) pdfDoc.setAuthor(meta.author.trim());
      if (meta.subject !== undefined) pdfDoc.setSubject(meta.subject.trim());
      if (meta.creator !== undefined) pdfDoc.setCreator(meta.creator.trim());
      if (meta.producer !== undefined) pdfDoc.setProducer(meta.producer.trim());
      if (meta.keywords !== undefined) {
        const cleanKw = Array.isArray(meta.keywords)
          ? meta.keywords.map((k) => k.trim()).filter(Boolean)
          : [];
        pdfDoc.setKeywords(cleanKw);
      }
      pdfDoc.setModificationDate(new Date());
    }

    if (onProgress) onProgress(80);

    const pdfBytes = await pdfDoc.save();
    const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
    const finalFilename = `${cleanName}_updated_meta.pdf`;
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
  },
};
