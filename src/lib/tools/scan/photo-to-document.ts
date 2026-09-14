import type { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsDataURL, loadImage } from "@/lib/utils";
import { sanitizeFilename } from "@/lib/security/file-security";
import { applyDocumentFiltersToCanvas, compileImagesToPdf, ImageProcessingOptions } from "./scan-processor";

export interface PhotoToDocumentConfig extends ImageProcessingOptions {
  outputType?: "PDF" | "IMAGE";
}

export const photoToDocumentOperation: ToolOperation<
  PhotoToDocumentConfig,
  SingleFileResult
> = {
  id: "photo-to-document",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please upload a photo of a document or page." };
    }

    const file = files[0];
    const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);
    if (!isImg) {
      return { valid: false, error: `"${file.name}" is not a supported image file.` };
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: PhotoToDocumentConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    if (onProgress) onProgress(20);

    const file = files[0];
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);

    if (onProgress) onProgress(45);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialize 2D canvas context.");
    ctx.drawImage(img, 0, 0);

    // Default enhanced settings for photographing paper documents:
    // slight contrast boost (+25), high-contrast binarization or grayscale
    const effectiveConfig: ImageProcessingOptions = {
      brightness: config.brightness ?? 10,
      contrast: config.contrast ?? 35,
      grayscale: config.grayscale ?? false,
      binarize: config.binarize ?? true, // High-contrast clean paper effect
      threshold: config.threshold ?? 140,
      rotationDeg: config.rotationDeg ?? 0,
      crop: config.crop,
    };

    const enhancedCanvas = applyDocumentFiltersToCanvas(canvas, effectiveConfig);

    if (onProgress) onProgress(75);

    const cleanBase = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));

    if (config.outputType === "IMAGE") {
      const outDataUrl = enhancedCanvas.toDataURL("image/jpeg", 0.95);
      const res = await fetch(outDataUrl);
      const blob = await res.blob();
      const filename = `${cleanBase}_document.jpg`;

      if (onProgress) onProgress(100);
      return {
        type: "single",
        blob,
        filename,
        originalSize: file.size,
        newSize: blob.size,
        details: {
          "Mode": "Enhanced Document Image",
          "Resolution": `${enhancedCanvas.width} × ${enhancedCanvas.height} px`,
        },
      };
    }

    // Default: compile into print-ready A4 PDF
    const pageData = [{
      dataUrl: enhancedCanvas.toDataURL("image/jpeg", 0.92),
      width: enhancedCanvas.width,
      height: enhancedCanvas.height,
    }];

    const pdfBytes = await compileImagesToPdf(pageData, { pageSize: "A4" });
    const filename = `${cleanBase}_document.pdf`;
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

    if (onProgress) onProgress(100);

    return {
      type: "single",
      blob,
      filename,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        "Format": "Clean Document PDF",
        "Contrast Boost": "+35%",
        "Color Mode": effectiveConfig.binarize ? "High-Contrast B&W" : "Clean Paper",
      },
    };
  },
};
