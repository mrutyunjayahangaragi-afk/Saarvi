import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { loadImageSource } from "./image-loader";

export interface ImageResizeConfig {
  targetWidth: number;
  targetHeight: number;
  format: "image/jpeg" | "image/png" | "image/webp";
  quality?: number; // 0.1 to 1.0
  maintainAspectRatio?: boolean;
}

export const imageResizeOperation: ToolOperation<ImageResizeConfig, SingleFileResult> = {
  id: "image-resize",

  validate(files: File[], config?: ImageResizeConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select an image file to resize." };
    }
    const file = files[0];
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!file.type.startsWith("image/") && !hasValidExt) {
      return { valid: false, error: "That file format isn't supported. Please select a JPG, PNG, or WebP image." };
    }

    if (file.size > 30 * 1024 * 1024) {
      return { valid: false, error: "This file is too large for browser processing (max 30MB)." };
    }

    if (config && (config.targetWidth <= 0 || config.targetHeight <= 0)) {
      return { valid: false, error: "Width and height must be positive integers." };
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: ImageResizeConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(20);

    const source = await loadImageSource(file);
    if (onProgress) onProgress(40);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(config.targetWidth));
    canvas.height = Math.max(1, Math.round(config.targetHeight));
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      source.close();
      throw new Error("Unable to initialize canvas 2D rendering context.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (config.format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    source.draw(ctx, 0, 0, canvas.width, canvas.height);
    source.close(); // release source memory

    if (onProgress) onProgress(75);

    const quality = config.format === "image/png" ? undefined : (config.quality ?? 0.9);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to export resized image blob."))),
        config.format,
        quality
      );
    });

    if (onProgress) onProgress(100);

    const ext = config.format === "image/png" ? ".png" : config.format === "image/webp" ? ".webp" : ".jpg";
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const outputFilename = `${baseName}_${canvas.width}x${canvas.height}${ext}`;

    return {
      type: "single",
      blob,
      filename: outputFilename,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        originalWidth: source.width,
        originalHeight: source.height,
        newWidth: canvas.width,
        newHeight: canvas.height
      }
    };
  }
};
