import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { loadImageSource } from "./image-loader";

/**
 * Image rotation + flip engine.
 * Supports 90°/180°/270° CW rotation and horizontal/vertical flipping.
 * Correctly swaps canvas dimensions for 90° and 270° rotations.
 * Preserves alpha channel for PNG output.
 */

export type RotateAngle = 0 | 90 | 180 | 270;
export type FlipAxis = "none" | "horizontal" | "vertical" | "both";

export interface RotateImageConfig {
  angle: RotateAngle;
  flip: FlipAxis;
  outputFormat: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
}

const MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const rotateImageOperation: ToolOperation<RotateImageConfig, SingleFileResult> = {
  id: "rotate-image",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select an image to rotate." };
    }
    const file = files[0];
    if (!file.type.startsWith("image/") && !ACCEPTED_TYPES.some((t) => file.name.toLowerCase().endsWith(t.split("/")[1]))) {
      return { valid: false, error: "Unsupported format. Please select a JPG, PNG, or WebP image." };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { valid: false, error: "This file is too large for browser processing (max 30 MB)." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: RotateImageConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(15);

    const source = await loadImageSource(file);
    if (onProgress) onProgress(45);

    const angle = config.angle ?? 0;
    const flip = config.flip ?? "none";

    // Swap canvas dimensions for 90°/270° rotations
    const swapDims = angle === 90 || angle === 270;
    const canvasW = swapDims ? source.height : source.width;
    const canvasH = swapDims ? source.width : source.height;

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      source.close();
      throw new Error("Unable to initialize canvas for rotation.");
    }

    // Fill white background for JPEG (no alpha)
    if (config.outputFormat === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);

    // Apply rotation
    ctx.rotate((angle * Math.PI) / 180);

    // Apply flips
    const scaleX = (flip === "horizontal" || flip === "both") ? -1 : 1;
    const scaleY = (flip === "vertical" || flip === "both") ? -1 : 1;
    ctx.scale(scaleX, scaleY);

    source.draw(ctx, -source.width / 2, -source.height / 2);
    ctx.restore();
    source.close();

    if (onProgress) onProgress(80);

    const quality = config.outputFormat === "image/png" ? undefined : (config.quality ?? 0.92);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to export rotated image."))),
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
    const suffix = angle > 0 ? `_rot${angle}` : flip !== "none" ? `_flip` : "_rotated";

    return {
      type: "single",
      blob,
      filename: `${baseName}${suffix}${ext}`,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        angle: `${angle}°`,
        flip: flip === "none" ? "None" : flip,
        width: canvasW,
        height: canvasH,
      },
    };
  },
};
