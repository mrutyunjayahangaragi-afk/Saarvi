import "@/lib/polyfills/iterator";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export type CompressionPreset = "low" | "balanced" | "high";

export interface CompressPdfConfig {
  preset: CompressionPreset;
}

const PRESET_SETTINGS: Record<CompressionPreset, { scale: number; quality: number }> = {
  low: { scale: 1.3, quality: 0.82 },
  balanced: { scale: 1.0, quality: 0.70 },
  high: { scale: 0.85, quality: 0.55 }
};

export const compressPdfOperation: ToolOperation<CompressPdfConfig, SingleFileResult> = {
  id: "compress-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to compress." };
    }
    const file = files[0];
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: "Please select a valid PDF file." };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50MB limit." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: CompressPdfConfig = { preset: "balanced" },
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(10);

    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const settings = PRESET_SETTINGS[config.preset] || PRESET_SETTINGS.balanced;
    const newPdf = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: settings.scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not initialize 2D canvas context for compression.");
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const pageJpegBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to downsample raster content."))),
          "image/jpeg",
          settings.quality
        );
      });

      const pageJpegBytes = new Uint8Array(await pageJpegBlob.arrayBuffer());
      const embeddedImage = await newPdf.embedJpg(pageJpegBytes);

      // Re-map to standard unscaled viewport dimensions
      const origViewport = page.getViewport({ scale: 1.0 });
      const newPage = newPdf.addPage([origViewport.width, origViewport.height]);

      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height
      });

      if (onProgress) {
        onProgress(10 + Math.round(((pageNum / numPages) * 75)));
      }
    }

    const compressedBytes = await newPdf.save();
    if (onProgress) onProgress(100);

    const blob = new Blob([compressedBytes as unknown as BlobPart], { type: "application/pdf" });
    const baseName = file.name.replace(/\.pdf$/i, "");
    const outputFilename = `${baseName}_compressed.pdf`;

    return {
      type: "single",
      blob,
      filename: outputFilename,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        preset: config.preset.toUpperCase(),
        pages: numPages,
        noReduction: blob.size >= file.size ? "true" : "false"
      }
    };
  }
};
