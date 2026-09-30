import "@/lib/polyfills/iterator";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";
import { PdfExcelService, PdfToExcelConversionResult } from "./pdf-excel-service";

// Ensure worker is configured for browser execution
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PdfToExcelConfig {
  sheetPerPage?: boolean;
}

interface SingleConversionOutput {
  filename: string;
  blob: Blob;
  originalSize: number;
  newSize: number;
  details: Record<string, string | number>;
  previewData: {
    sheets: {
      sheetName: string;
      headers: (string | number | boolean | null)[];
      sampleRows: (string | number | boolean | null)[][];
      totalRows: number;
      totalCols: number;
      qualityScore: number;
      strategyUsed: string;
    }[];
    documentType: string;
    totalRows: number;
    maxCols: number;
    qualityScore: number;
    strategyUsed: string;
  };
}

/**
 * Converts a single PDF file to an authentic XLSX workbook using the Adaptive Multi-Strategy Engine 7.0
 */
async function convertSinglePdfToXlsx(
  file: File,
  config: PdfToExcelConfig = {},
  onProgress?: (pct: number) => void
): Promise<SingleConversionOutput> {
  const securityCheck = await validateInputFile(file, ["pdf"], 50 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid PDF file structure.");
  }

  if (onProgress) onProgress(10);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: typeof window !== "undefined" ? "/cmaps/" : undefined,
    cMapPacked: true,
    standardFontDataUrl: typeof window !== "undefined" ? "/standard_fonts/" : undefined,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  if (numPages === 0) {
    throw new Error("The PDF document contains 0 pages.");
  }

  const engine = new PdfExcelService();
  const conversionResult: PdfToExcelConversionResult = await engine.convert(
    pdfDoc,
    config.sheetPerPage ?? false,
    onProgress
  );

  const blob = new Blob([conversionResult.xlsxBytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const filename = `${baseName}.xlsx`;

  return {
    filename,
    blob,
    originalSize: file.size,
    newSize: blob.size,
    details: {
      "Sheets Extracted": conversionResult.sheets.length,
      "Total Rows Extracted": conversionResult.totalRows,
      "Columns Detected": conversionResult.maxCols,
      "Document Type": "Microsoft Excel (.xlsx)",
      "Classification": conversionResult.analysis.documentType,
      "Quality Score": `${conversionResult.overallQualityScore}%`,
      "Extraction Strategy": conversionResult.primaryStrategy,
      "Engine": "Adaptive Multi-Strategy Engine 7.0",
    },
    previewData: {
      sheets: conversionResult.previews,
      documentType: conversionResult.analysis.documentType,
      totalRows: conversionResult.totalRows,
      maxCols: conversionResult.maxCols,
      qualityScore: conversionResult.overallQualityScore,
      strategyUsed: conversionResult.primaryStrategy,
    },
  };
}

export const pdfToExcelOperation: ToolOperation<PdfToExcelConfig, SingleFileResult | MultiFileResult> = {
  id: "pdf-to-excel",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to convert to Excel." };
    }
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        return { valid: false, error: `"${file.name}" is not a valid PDF document.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: PdfToExcelConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one PDF document to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSinglePdfToXlsx(files[0], config, onProgress);
      return {
        type: "single",
        filename: res.filename,
        blob: res.blob,
        originalSize: res.originalSize,
        newSize: res.newSize,
        details: res.details,
        previewData: res.previewData,
      };
    }

    // Batch conversion
    const zip = new JSZip();
    const convertedFiles: MultiFileResult["files"] = [];
    let totalOriginalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const singleProgress = (pct: number) => {
        if (onProgress) {
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          onProgress(overall);
        }
      };

      const res = await convertSinglePdfToXlsx(file, config, singleProgress);
      zip.file(res.filename, res.blob);
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(res.blob) : "";
      convertedFiles.push({ filename: res.filename, blob: res.blob, url, size: res.newSize });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const firstBase = sanitizeFilename(files[0].name.replace(/\.[^/.]+$/, ""));
    const zipFilename = `${firstBase}_and_${files.length - 1}_more_excel.zip`;

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
