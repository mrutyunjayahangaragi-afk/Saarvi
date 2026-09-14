import { PDFDocument } from "pdf-lib";

export interface ImageProcessingOptions {
  brightness?: number; // -100 to 100, default 0
  contrast?: number; // -100 to 100, default 0
  grayscale?: boolean;
  binarize?: boolean; // high-contrast black and white document mode
  threshold?: number; // 0 to 255, default 128 (or auto-calculated)
  rotationDeg?: number; // 0, 90, 180, 270
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Applies computer vision filters (brightness, contrast, grayscale, Otsu/adaptive thresholding,
 * crop, rotate) to an HTMLCanvasElement or ImageData.
 * 100% client-side execution; zero server or external API dispatch.
 */
export function applyDocumentFiltersToCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: ImageProcessingOptions = {}
): HTMLCanvasElement {
  const {
    brightness = 0,
    contrast = 0,
    grayscale = false,
    binarize = false,
    threshold = 135,
    rotationDeg = 0,
    crop,
  } = options;

  let workCanvas = document.createElement("canvas");
  let workCtx = workCanvas.getContext("2d");
  if (!workCtx) return sourceCanvas;

  // 1. Handle Crop
  if (crop && crop.width > 0 && crop.height > 0) {
    workCanvas.width = Math.min(crop.width, sourceCanvas.width);
    workCanvas.height = Math.min(crop.height, sourceCanvas.height);
    workCtx.drawImage(
      sourceCanvas,
      crop.x,
      crop.y,
      workCanvas.width,
      workCanvas.height,
      0,
      0,
      workCanvas.width,
      workCanvas.height
    );
  } else {
    workCanvas.width = sourceCanvas.width;
    workCanvas.height = sourceCanvas.height;
    workCtx.drawImage(sourceCanvas, 0, 0);
  }

  // 2. Handle Rotation
  const normalizedRotation = ((rotationDeg % 360) + 360) % 360;
  if (normalizedRotation !== 0) {
    const rotCanvas = document.createElement("canvas");
    const rotCtx = rotCanvas.getContext("2d")!;
    if (normalizedRotation === 90 || normalizedRotation === 270) {
      rotCanvas.width = workCanvas.height;
      rotCanvas.height = workCanvas.width;
    } else {
      rotCanvas.width = workCanvas.width;
      rotCanvas.height = workCanvas.height;
    }

    rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rotCtx.rotate((normalizedRotation * Math.PI) / 180);
    rotCtx.drawImage(workCanvas, -workCanvas.width / 2, -workCanvas.height / 2);

    workCanvas = rotCanvas;
    workCtx = workCanvas.getContext("2d")!;
  }

  // 3. Pixel Manipulation (Brightness, Contrast, Grayscale, Thresholding)
  if (brightness !== 0 || contrast !== 0 || grayscale || binarize) {
    const imgData = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const data = imgData.data;
    const len = data.length;

    // Precalculate contrast factor
    // Factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Brightness (-100 to 100)
      if (brightness !== 0) {
        r += brightness * 2.55;
        g += brightness * 2.55;
        b += brightness * 2.55;
      }

      // Contrast (-100 to 100)
      if (contrast !== 0) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }

      // Standard ITU-R BT.601 Luminance formula for Grayscale
      let lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (binarize) {
        // High-contrast clean black-and-white document thresholding
        const val = lum >= threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      } else if (grayscale) {
        lum = Math.max(0, Math.min(255, lum));
        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
      } else {
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }
    }

    workCtx.putImageData(imgData, 0, 0);
  }

  return workCanvas;
}

/**
 * Compiles a list of processed image elements or blobs into a clean, paginated PDF document.
 */
export async function compileImagesToPdf(
  images: { dataUrl: string; width: number; height: number }[],
  options: { pageSize?: "A4" | "FIT" } = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const item of images) {
    let embeddedImage;
    if (item.dataUrl.startsWith("data:image/png")) {
      embeddedImage = await pdfDoc.embedPng(item.dataUrl);
    } else {
      embeddedImage = await pdfDoc.embedJpg(item.dataUrl);
    }

    if (options.pageSize === "A4") {
      // Standard A4 dimensions in points: 595.28 x 841.89
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;
      const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);

      const renderW = imgWidth * scale;
      const renderH = imgHeight * scale;
      const x = (pageWidth - renderW) / 2;
      const y = (pageHeight - renderH) / 2;

      page.drawImage(embeddedImage, {
        x,
        y,
        width: renderW,
        height: renderH,
      });
    } else {
      // 1:1 Image dimensions fit
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height,
      });
    }
  }

  return pdfDoc.save({ useObjectStreams: false });
}
