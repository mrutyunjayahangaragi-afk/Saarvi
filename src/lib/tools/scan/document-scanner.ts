import type { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsDataURL, loadImage } from "@/lib/utils";
import { sanitizeFilename } from "@/lib/security/file-security";
import { applyDocumentFiltersToCanvas, compileImagesToPdf, ImageProcessingOptions } from "./scan-processor";

export interface DocumentScannerConfig extends ImageProcessingOptions {
  pageSize?: "A4" | "FIT";
  exportFormat?: "PDF" | "IMAGE";
}

export const documentScannerOperation: ToolOperation<
  DocumentScannerConfig,
  SingleFileResult | MultiFileResult
> = {
  id: "document-scanner",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select or capture at least one image/document." };
    }

    for (const file of files) {
      const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|tiff)$/i.test(file.name);
      if (!isImg) {
        return { valid: false, error: `"${file.name}" is not a supported image file.` };
      }
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: DocumentScannerConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (onProgress) onProgress(10);

    const processedPages: { dataUrl: string; width: number; height: number }[] = [];
    let totalOriginalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const dataUrl = await readFileAsDataURL(file);
      const img = await loadImage(dataUrl);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize 2D canvas context.");
      ctx.drawImage(img, 0, 0);

      const filteredCanvas = applyDocumentFiltersToCanvas(canvas, config);
      const outDataUrl = filteredCanvas.toDataURL("image/jpeg", 0.92);

      processedPages.push({
        dataUrl: outDataUrl,
        width: filteredCanvas.width,
        height: filteredCanvas.height,
      });

      if (onProgress) {
        onProgress(10 + Math.round(((i + 1) / files.length) * 60));
      }
    }

    if (onProgress) onProgress(75);

    // Export as single PDF document
    const pdfBytes = await compileImagesToPdf(processedPages, {
      pageSize: config.pageSize || "A4",
    });

    const cleanBase = sanitizeFilename(files[0].name.replace(/\.[^/.]+$/, ""));
    const filename = `${cleanBase}_scanned.pdf`;
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

    if (onProgress) onProgress(100);

    return {
      type: "single",
      blob,
      filename,
      originalSize: totalOriginalSize,
      newSize: blob.size,
      details: {
        "Scanned Pages": files.length,
        "Format": "PDF (A4)",
        "Processing": config.binarize ? "Clean B&W" : config.grayscale ? "Grayscale" : "Enhanced Color",
      },
    };
  },
};
