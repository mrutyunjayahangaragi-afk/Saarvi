import "@/lib/polyfills/iterator";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { ToolOperation, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";

// Ensure worker is configured for browser execution
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PdfToJpgConfig {
  scale?: number; // 1.5 default for good clarity
  quality?: number; // 0.85 - 0.95
  selectedPages?: number[]; // 1-indexed page numbers (optional)
}

export const pdfToJpgOperation: ToolOperation<PdfToJpgConfig, MultiFileResult> = {
  id: "pdf-to-jpg",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to convert." };
    }
    const file = files[0];
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: "Please select a valid PDF file." };
    }
    if (file.size > 40 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 40MB limit for browser rendering." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: PdfToJpgConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<MultiFileResult> {
    const file = files[0];
    if (onProgress) onProgress(10);

    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const scale = config.scale ?? 1.5;
    const quality = config.quality ?? 0.9;
    const pagesToRender: number[] = config.selectedPages && config.selectedPages.length > 0
      ? config.selectedPages.filter((p) => p >= 1 && p <= numPages)
      : Array.from({ length: numPages }, (_, i) => i + 1);

    if (pagesToRender.length === 0) {
      throw new Error("No valid pages selected for conversion.");
    }

    const zip = new JSZip();
    const baseName = file.name.replace(/\.pdf$/i, "");
    const outputFiles: { blob: Blob; filename: string; url: string; size: number }[] = [];

    for (let i = 0; i < pagesToRender.length; i++) {
      const pageNum = pagesToRender[i];
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error(`Failed to initialize 2D canvas context for page ${pageNum}.`);
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvas: canvas,
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      const pageBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(`Failed to export page ${pageNum} to JPEG.`))),
          "image/jpeg",
          quality
        );
      });

      const pageFilename = `${baseName}_page_${pageNum}.jpg`;
      const url = URL.createObjectURL(pageBlob);

      outputFiles.push({
        blob: pageBlob,
        filename: pageFilename,
        url,
        size: pageBlob.size
      });

      zip.file(pageFilename, pageBlob);

      if (onProgress) {
        onProgress(10 + Math.round(((i + 1) / pagesToRender.length) * 75));
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    if (onProgress) onProgress(100);

    return {
      type: "multiple",
      files: outputFiles,
      zipBlob,
      zipFilename: `${baseName}_pages_jpg.zip`,
      originalSize: file.size,
      newSize: zipBlob.size
    };
  }
};
