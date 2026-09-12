import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { loadImageSource } from "./image-loader";

/**
 * Image compression engine.
 * Compresses JPG/PNG/WebP using canvas toBlob() quality parameter.
 * Reports actual before/after file sizes — never estimated.
 * Sets outputLarger flag in details when compression yields no benefit.
 */

export interface CompressImageConfig {
  quality: number; // 0.1 – 1.0 for JPEG/WebP; PNG uses 1.0 (lossless — we try resize trick)
  outputFormat: "image/jpeg" | "image/png" | "image/webp";
}

const MAX_SIZE_BYTES = 40 * 1024 * 1024;

export const compressImageOperation: ToolOperation<CompressImageConfig, SingleFileResult> = {
  id: "compress-image",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select an image to compress." };
    }
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      return { valid: false, error: "Unsupported format. Please select a JPG, PNG, or WebP image." };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { valid: false, error: "This file is too large for browser processing (max 40 MB)." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: CompressImageConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(15);

    const source = await loadImageSource(file);
    if (onProgress) onProgress(50);

    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      source.close();
      throw new Error("Unable to initialize canvas for compression.");
    }

    if (config.outputFormat === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    source.draw(ctx, 0, 0);
    source.close();

    if (onProgress) onProgress(75);

    const quality = config.outputFormat === "image/png" ? undefined : Math.max(0.1, Math.min(1.0, config.quality));

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to export compressed image."))),
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

    const savedBytes = file.size - blob.size;
    const savedPercent = file.size > 0 ? Math.round((savedBytes / file.size) * 100) : 0;
    const outputLarger = blob.size >= file.size;

    return {
      type: "single",
      blob,
      filename: `${baseName}_compressed${ext}`,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        savedBytes: outputLarger ? "0" : String(savedBytes),
        savedPercent: outputLarger ? "0" : String(savedPercent),
        outputLarger: outputLarger ? "true" : "false",
        width: source.width,
        height: source.height,
      },
    };
  },
};
