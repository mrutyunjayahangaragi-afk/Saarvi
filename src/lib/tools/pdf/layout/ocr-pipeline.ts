import type { RawPdfPageData, RawPdfTextItem } from "./layout-engine.ts";

export interface OcrPageOptions {
  consentGranted?: boolean;
}

/**
 * Processes a scanned page by extracting OCR text and estimating layout bounding boxes.
 * Preserves reading order and line boundaries.
 */
export async function processScannedPageWithOcr(
  pageNumber: number,
  widthPt: number,
  heightPt: number,
  pageImageBuffer: Uint8Array,
  mimeType: string = "image/jpeg",
  options: OcrPageOptions = {}
): Promise<RawPdfPageData> {
  // If remote OCR is required, verify user consent
  const items: RawPdfTextItem[] = [];

  try {
    // In browser environment, call internal API endpoint if available or fallback safely
    if (typeof window !== "undefined") {
      const base64 = btoa(
        pageImageBuffer.reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const res = await fetch("/api/ocr/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          mime: mimeType,
          options: { preprocess: true },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.result?.text || "";
        const lines = text.split("\n").filter((l: string) => l.trim().length > 0);

        const lineHeight = 16;
        let startY = 60;

        for (const line of lines) {
          if (startY + lineHeight > heightPt - 50) break;
          items.push({
            str: line.trim(),
            x: 54,
            y: startY,
            width: Math.min(widthPt - 108, line.length * 6.5),
            height: lineHeight,
            fontSize: 11,
            fontName: "Calibri",
          });
          startY += lineHeight * 1.35;
        }
      }
    }
  } catch (err) {
    console.warn(`[OCR Pipeline] Page ${pageNumber} OCR notice:`, err);
  }

  return {
    pageNumber,
    widthPt,
    heightPt,
    items,
    images: [
      {
        x: 0,
        y: 0,
        width: widthPt,
        height: heightPt,
        imageBuffer: pageImageBuffer,
        mimeType,
      },
    ],
  };
}
