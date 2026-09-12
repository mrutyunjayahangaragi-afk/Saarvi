import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { loadImageSource } from "./image-loader";

export interface FormatConvertConfig {
  targetFormat: "image/jpeg" | "image/png" | "image/webp";
  quality?: number; // 0.1 to 1.0 (for JPEG/WebP)
  backgroundColor?: string; // used for transparent PNG/WebP -> JPG
}

export const formatConverterOperation: ToolOperation<FormatConvertConfig, SingleFileResult> = {
  id: "format-converter",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select an image file to convert." };
    }
    const file = files[0];

    if (!file.type.startsWith("image/") && !/\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name)) {
      return { valid: false, error: "Please select a valid image file (JPG, PNG, or WebP)." };
    }

    if (file.size > 25 * 1024 * 1024) {
      return { valid: false, error: "This file is too large for browser processing (max 25MB)." };
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: FormatConvertConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(20);

    const source = await loadImageSource(file);
    if (onProgress) onProgress(50);

    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      source.close();
      throw new Error("Unable to initialize canvas 2D rendering context.");
    }

    // When converting transparent PNG to JPG, fill with background color (default white)
    if (config.targetFormat === "image/jpeg") {
      ctx.fillStyle = config.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    source.draw(ctx, 0, 0);
    source.close(); // release image bitmap/element memory

    if (onProgress) onProgress(80);

    const quality = config.targetFormat === "image/png" ? undefined : (config.quality ?? 0.92);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to export converted image blob."))),
        config.targetFormat,
        quality
      );
    });

    if (onProgress) onProgress(100);

    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };
    const ext = extMap[config.targetFormat] ?? ".jpg";
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const outputFilename = `${baseName}${ext}`;

    return {
      type: "single",
      blob,
      filename: outputFilename,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        width: canvas.width,
        height: canvas.height,
        format: config.targetFormat === "image/jpeg" ? "JPEG" : "PNG"
      }
    };
  }
};
