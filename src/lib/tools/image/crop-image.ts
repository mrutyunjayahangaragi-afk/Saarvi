import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { loadImageSource } from "./image-loader";

/**
 * Image crop engine.
 * Accepts pixel crop region (x, y, w, h) relative to source image dimensions.
 * Preserves alpha for PNG output.
 */

export interface CropImageConfig {
  x: number;
  y: number;
  cropWidth: number;
  cropHeight: number;
  outputFormat: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
}

const MAX_SIZE_BYTES = 30 * 1024 * 1024;

export const cropImageOperation: ToolOperation<CropImageConfig, SingleFileResult> = {
  id: "crop-image",

  validate(files: File[], config?: CropImageConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select an image to crop." };
    }
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      return { valid: false, error: "Unsupported format. Please select a JPG, PNG, or WebP image." };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { valid: false, error: "This file is too large for browser processing (max 30 MB)." };
    }
    if (config) {
      if (config.cropWidth <= 0 || config.cropHeight <= 0) {
        return { valid: false, error: "Crop area must have a positive width and height." };
      }
      if (config.x < 0 || config.y < 0) {
        return { valid: false, error: "Crop position must be within the image bounds." };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: CropImageConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(15);

    const source = await loadImageSource(file);
    if (onProgress) onProgress(45);

    // Clamp crop region to source dimensions
    const sx = Math.max(0, Math.min(Math.round(config.x), source.width - 1));
    const sy = Math.max(0, Math.min(Math.round(config.y), source.height - 1));
    const sw = Math.max(1, Math.min(Math.round(config.cropWidth), source.width - sx));
    const sh = Math.max(1, Math.min(Math.round(config.cropHeight), source.height - sy));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      source.close();
      throw new Error("Unable to initialize canvas for cropping.");
    }

    if (config.outputFormat === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sw, sh);
    }

    // Draw only the cropped source region
    ctx.drawImage(
      // We use a temporary canvas to crop because loadImageSource.draw() does full draw
      // So we draw to a full-size canvas first, then copy the crop region
      (() => {
        const tmp = document.createElement("canvas");
        tmp.width = source.width;
        tmp.height = source.height;
        const tCtx = tmp.getContext("2d")!;
        source.draw(tCtx, 0, 0);
        source.close();
        return tmp;
      })(),
      sx, sy, sw, sh,
      0, 0, sw, sh
    );

    if (onProgress) onProgress(80);

    const quality = config.outputFormat === "image/png" ? undefined : (config.quality ?? 0.92);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to export cropped image."))),
        config.outputFormat,
        quality
      );
    });

    if (onProgress) onProgress(100);

    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };
    const ext = extMap[config.outputFormat] ?? ".jpg";
    const baseName = file.name.replace(/\.[^/.]+$/, "");

    return {
      type: "single",
      blob,
      filename: `${baseName}_cropped${ext}`,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        cropRegion: `${sx},${sy} ${sw}×${sh}px`,
        originalDimensions: `${source.width}×${source.height}px`,
        outputDimensions: `${sw}×${sh}px`,
      },
    };
  },
};
