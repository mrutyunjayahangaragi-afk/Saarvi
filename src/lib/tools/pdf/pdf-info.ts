import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";

export interface PageDimensionInfo {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  orientation: "portrait" | "landscape" | "square";
}

export interface PdfDocumentInfo {
  filename: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  pageCount: number;
  isEncrypted: boolean;
  hasMetadata: boolean;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageSizeSummary: string;
  pageDimensions: PageDimensionInfo[];
  processedLocally: true;
}

export async function inspectPdfDocument(file: File): Promise<PdfDocumentInfo> {
  const buffer = await readFileAsArrayBuffer(file);
  let isEncrypted = false;
  let pdfDoc: PDFDocument;

  try {
    pdfDoc = await PDFDocument.load(buffer);
  } catch (err: any) {
    if (err?.name === "EncryptedPDFError" || String(err?.message).toLowerCase().includes("encrypt")) {
      isEncrypted = true;
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } else {
      throw new Error("Could not parse PDF document. The file may be corrupt.");
    }
  }

  const pageCount = pdfDoc.getPageCount();
  const pageDimensions: PageDimensionInfo[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const widthMm = Math.round((width * 25.4) / 72);
    const heightMm = Math.round((height * 25.4) / 72);
    const orientation =
      width > height ? "landscape" : height > width ? "portrait" : "square";

    pageDimensions.push({
      pageNumber: i + 1,
      widthPt: Math.round(width * 10) / 10,
      heightPt: Math.round(height * 10) / 10,
      widthMm,
      heightMm,
      orientation,
    });
  }

  const title = pdfDoc.getTitle() || "";
  const author = pdfDoc.getAuthor() || "";
  const subject = pdfDoc.getSubject() || "";
  const creator = pdfDoc.getCreator() || "";
  const producer = pdfDoc.getProducer() || "";
  const creationDate = pdfDoc.getCreationDate() ? pdfDoc.getCreationDate()!.toLocaleString() : "";
  const modificationDate = pdfDoc.getModificationDate() ? pdfDoc.getModificationDate()!.toLocaleString() : "";

  const hasMetadata = Boolean(title || author || subject || creator || producer || creationDate);

  const firstDim = pageDimensions[0];
  const pageSizeSummary = firstDim
    ? `${firstDim.widthMm} × ${firstDim.heightMm} mm (${firstDim.orientation})`
    : "Unknown";

  const sizeKb = (file.size / 1024).toFixed(1);
  const sizeFormatted = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : `${sizeKb} KB`;

  return {
    filename: file.name,
    fileSizeBytes: file.size,
    fileSizeFormatted: sizeFormatted,
    pageCount,
    isEncrypted,
    hasMetadata,
    title,
    author,
    subject,
    creator,
    producer,
    creationDate,
    modificationDate,
    pageSizeSummary,
    pageDimensions,
    processedLocally: true,
  };
}

export const pdfInfoOperation: ToolOperation<
  Record<string, unknown>,
  SingleFileResult
> = {
  id: "pdf-info",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF file to inspect." };
    }
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
      return { valid: false, error: `"${file.name}" is not a valid PDF file.` };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    _config: Record<string, unknown>,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    const securityCheck = await validateInputFile(file, ["pdf"]);
    if (!securityCheck.valid) {
      throw new Error(securityCheck.error || "Security check failed.");
    }

    if (onProgress) onProgress(30);
    const info = await inspectPdfDocument(file);
    if (onProgress) onProgress(80);

    const summaryReport =
      `SAARVI PDF DOCUMENT REPORT\n` +
      `----------------------------------------\n` +
      `File Name: ${info.filename}\n` +
      `File Size: ${info.fileSizeFormatted} (${info.fileSizeBytes} bytes)\n` +
      `Page Count: ${info.pageCount}\n` +
      `Page Dimensions: ${info.pageSizeSummary}\n` +
      `Encrypted/Protected: ${info.isEncrypted ? "Yes" : "No"}\n` +
      `Title: ${info.title || "(None)"}\n` +
      `Author: ${info.author || "(None)"}\n` +
      `Subject: ${info.subject || "(None)"}\n` +
      `Creator Application: ${info.creator || "(None)"}\n` +
      `PDF Producer: ${info.producer || "(None)"}\n` +
      `Creation Date: ${info.creationDate || "(None)"}\n` +
      `Modification Date: ${info.modificationDate || "(None)"}\n` +
      `----------------------------------------\n` +
      `Processed locally in your browser with zero server uploads.\n`;

    const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
    const finalFilename = `${cleanName}_info.txt`;
    const blob = new Blob([summaryReport], { type: "text/plain;charset=utf-8" });
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
