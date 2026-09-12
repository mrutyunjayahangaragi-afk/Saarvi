import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";

export interface SplitPdfConfig {
  mode: "all" | "range";
  rangeString?: string; // e.g. "1-3, 5"
}

export const splitPdfOperation: ToolOperation<SplitPdfConfig, SingleFileResult | MultiFileResult> = {
  id: "split-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF file to split." };
    }
    const file = files[0];
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: "Please select a valid PDF document." };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50MB limit." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: SplitPdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    const file = files[0];
    const buffer = await readFileAsArrayBuffer(file);
    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch {
      throw new Error("We couldn't read this PDF. It may be password-protected or corrupted.");
    }

    const totalPages = srcDoc.getPageCount();
    const baseName = file.name.replace(/\.pdf$/i, "");

    // Split every single page into individual PDFs packaged in ZIP
    if (config.mode === "all") {
      const zip = new JSZip();
      const extractedFiles: { blob: Blob; filename: string; url: string; size: number }[] = [];

      for (let i = 0; i < totalPages; i++) {
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
        singleDoc.addPage(copiedPage);

        const pdfBytes = await singleDoc.save();
        const pageFilename = `${baseName}_page_${i + 1}.pdf`;
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        extractedFiles.push({
          blob,
          filename: pageFilename,
          url,
          size: blob.size
        });

        zip.file(pageFilename, pdfBytes);

        if (onProgress) {
          onProgress(Math.round(((i + 1) / totalPages) * 80));
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      if (onProgress) onProgress(100);

      return {
        type: "multiple",
        files: extractedFiles,
        zipBlob,
        zipFilename: `${baseName}_all_pages.zip`,
        originalSize: file.size,
        newSize: zipBlob.size
      };
    }

    // Range extraction mode (e.g. "1-3, 5")
    const pageIndices = parsePageRangeToIndices(config.rangeString || "1", totalPages);
    if (pageIndices.length === 0) {
      throw new Error("No valid page numbers found in the specified range.");
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    const pdfBytes = await newDoc.save();
    if (onProgress) onProgress(100);

    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

    return {
      type: "single",
      blob,
      filename: `${baseName}_extracted.pdf`,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        extractedPagesCount: pageIndices.length,
        totalPages
      }
    };
  }
};

export function parsePageRangeToIndices(rangeStr: string, totalPages: number): number[] {
  const clean = rangeStr.replace(/\s+/g, "");
  if (!clean) return [];

  const parts = clean.split(",");
  const indices: number[] = [];
  const added = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          const idx = p - 1;
          if (!added.has(idx)) {
            added.add(idx);
            indices.push(idx);
          }
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        const idx = pageNum - 1;
        if (!added.has(idx)) {
          added.add(idx);
          indices.push(idx);
        }
      }
    }
  }

  return indices;
}
