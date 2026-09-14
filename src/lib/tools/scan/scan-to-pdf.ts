import type { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsDataURL, loadImage } from "@/lib/utils";
import { sanitizeFilename } from "@/lib/security/file-security";
import { applyDocumentFiltersToCanvas, compileImagesToPdf, ImageProcessingOptions } from "./scan-processor";

export interface ScanToPdfConfig extends ImageProcessingOptions {
  pageSize?: "A4" | "FIT";
}

export const scanToPdfOperation: ToolOperation<
  ScanToPdfConfig,
  SingleFileResult
> = {
  id: "scan-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please upload at least one image or scan to convert into PDF." };
    }

    for (const file of files) {
      const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);
      if (!isImg) {
        return { valid: false, error: `"${file.name}" is not a valid image format.` };
      }
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: ScanToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    if (onProgress) onProgress(10);

    const pages: { dataUrl: string; width: number; height: number }[] = [];
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

      const processedCanvas = applyDocumentFiltersToCanvas(canvas, config);
      const outDataUrl = processedCanvas.toDataURL("image/jpeg", 0.92);

      pages.push({
        dataUrl: outDataUrl,
        width: processedCanvas.width,
        height: processedCanvas.height,
      });

      if (onProgress) {
        onProgress(10 + Math.round(((i + 1) / files.length) * 65));
      }
    }

    if (onProgress) onProgress(80);

    const pdfBytes = await compileImagesToPdf(pages, {
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
        "Total Pages": files.length,
        "Page Layout": config.pageSize === "FIT" ? "Match Image Dimensions" : "Standard A4",
      },
    };
  },
};
