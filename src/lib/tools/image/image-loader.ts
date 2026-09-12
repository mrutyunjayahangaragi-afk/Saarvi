/**
 * Reusable image loading utility for client-side raster manipulation.
 * Supports File, Blob, and ArrayBuffer with ImageBitmap and HTMLImageElement fallback.
 */

export interface LoadedImageSource {
  width: number;
  height: number;
  draw(ctx: CanvasRenderingContext2D, dx: number, dy: number, dw?: number, dh?: number): void;
  close(): void;
}

export async function loadImageSource(
  input: File | Blob | ArrayBuffer,
  mimeType?: string
): Promise<LoadedImageSource> {
  let blob: Blob;

  if (input instanceof File || input instanceof Blob) {
    blob = input;
  } else if (input instanceof ArrayBuffer) {
    blob = new Blob([input], { type: mimeType || "image/jpeg" });
  } else {
    throw new Error("Invalid image input type provided to image loader.");
  }

  // 1. Prefer createImageBitmap if available in the browser (faster, off-thread decode)
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw(ctx, dx, dy, dw, dh) {
          if (dw !== undefined && dh !== undefined) {
            ctx.drawImage(bitmap, dx, dy, dw, dh);
          } else {
            ctx.drawImage(bitmap, dx, dy);
          }
        },
        close() {
          try {
            bitmap.close();
          } catch {
            // Ignore if already closed
          }
        }
      };
    } catch {
      // Fallback to HTMLImageElement if createImageBitmap fails on certain formats
    }
  }

  // 2. Fallback to HTMLImageElement
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw(ctx, dx, dy, dw, dh) {
          if (dw !== undefined && dh !== undefined) {
            ctx.drawImage(img, dx, dy, dw, dh);
          } else {
            ctx.drawImage(img, dx, dy);
          }
        },
        close() {
          URL.revokeObjectURL(url);
          img.src = "";
        }
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn't read this image file. It may be corrupted or in an unsupported format."));
    };

    img.src = url;
  });
}
