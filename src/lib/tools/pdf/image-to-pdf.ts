import { PDFDocument } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { loadImageSource } from "../image/image-loader";

export type PageSizeOption = "fit" | "a4" | "letter";
export type MarginOption = "none" | "small" | "normal";
export type OrientationOption = "auto" | "portrait" | "landscape";

export interface ImageToPdfConfig {
  pageSize?: PageSizeOption;
  margin?: MarginOption;
  orientation?: OrientationOption;
}

const PAGE_DIMENSIONS: Record<"a4" | "letter", { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 }
};

const MARGIN_VALUES: Record<MarginOption, number> = {
  none: 0,
  small: 20,
  normal: 40
};

export const imageToPdfOperation: ToolOperation<ImageToPdfConfig, SingleFileResult> = {
  id: "image-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select at least one image file." };
    }

    const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    for (const file of files) {
      const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!file.type.startsWith("image/") && !hasValidExt) {
        return { valid: false, error: `"${file.name}" is not a supported image format. Use JPG, PNG, or WebP.` };
      }
      if (file.size > 35 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the maximum 35MB limit.` };
      }
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: ImageToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const pageSize = config.pageSize ?? "a4";
    const marginType = config.margin ?? "small";
    const orientation = config.orientation ?? "auto";

    const pdfDoc = await PDFDocument.create();
    const totalFiles = files.length;
    let totalOriginalSize = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const isJpg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
      const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");

      let embeddedImage;

      if (isJpg) {
        try {
          const buffer = await readFileAsArrayBuffer(file);
          embeddedImage = await pdfDoc.embedJpg(new Uint8Array(buffer));
        } catch {
          // If direct embed failed due to format variation, fallback to canvas decode
          embeddedImage = await embedViaCanvas(pdfDoc, file);
        }
      } else if (isPng) {
        try {
          const buffer = await readFileAsArrayBuffer(file);
          embeddedImage = await pdfDoc.embedPng(new Uint8Array(buffer));
        } catch {
          embeddedImage = await embedViaCanvas(pdfDoc, file);
        }
      } else {
        // WebP or other formats: decode to PNG via canvas then embed
        embeddedImage = await embedViaCanvas(pdfDoc, file);
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;
      const margin = MARGIN_VALUES[marginType];

      let pageWidth: number;
      let pageHeight: number;

      if (pageSize === "fit") {
        pageWidth = imgWidth + margin * 2;
        pageHeight = imgHeight + margin * 2;
      } else {
        const standard = PAGE_DIMENSIONS[pageSize];
        let isLandscape = false;
        if (orientation === "landscape") {
          isLandscape = true;
        } else if (orientation === "portrait") {
          isLandscape = false;
        } else {
          isLandscape = imgWidth > imgHeight;
        }

        pageWidth = isLandscape ? standard.height : standard.width;
        pageHeight = isLandscape ? standard.width : standard.height;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const availableWidth = Math.max(1, pageWidth - margin * 2);
      const availableHeight = Math.max(1, pageHeight - margin * 2);

      const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight, 1.0);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      const x = margin + (availableWidth - drawWidth) / 2;
      const y = margin + (availableHeight - drawHeight) / 2;

      page.drawImage(embeddedImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight
      });

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalFiles) * 85));
      }
    }

    const pdfBytes = await pdfDoc.save();
    if (onProgress) onProgress(100);

    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const baseName = files[0].name.replace(/\.[^/.]+$/, "");
    const outputFilename = totalFiles > 1 ? `${baseName}_combined.pdf` : `${baseName}.pdf`;

    return {
      type: "single",
      blob,
      filename: outputFilename,
      originalSize: totalOriginalSize,
      newSize: blob.size,
      details: {
        pageCount: totalFiles,
        pageSize: pageSize.toUpperCase()
      }
    };
  }
};

async function embedViaCanvas(pdfDoc: PDFDocument, file: File) {
  const source = await loadImageSource(file);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    source.close();
    throw new Error("Failed to initialize canvas context.");
  }
  source.draw(ctx, 0, 0);
  source.close();

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas conversion failed."))), "image/png");
  });

  const arrayBuffer = await pngBlob.arrayBuffer();
  return pdfDoc.embedPng(new Uint8Array(arrayBuffer));
}
