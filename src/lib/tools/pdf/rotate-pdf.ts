import { PDFDocument, degrees } from "pdf-lib";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { parsePageRangeToIndices } from "./split-pdf";

export interface RotatePdfConfig {
  angle: 90 | 180 | 270;
  pagesMode?: "all" | "selected";
  selectedRange?: string; // e.g. "1, 3-5"
}

export const rotatePdfOperation: ToolOperation<RotatePdfConfig, SingleFileResult> = {
  id: "rotate-pdf",

  validate(files: File[], config?: RotatePdfConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to rotate." };
    }
    const file = files[0];
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: "Please select a valid PDF file." };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50MB limit." };
    }
    if (config && ![90, 180, 270].includes(config.angle)) {
      return { valid: false, error: "Rotation angle must be 90°, 180°, or 270°." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: RotatePdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];
    if (onProgress) onProgress(15);

    const buffer = await readFileAsArrayBuffer(file);
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch {
      throw new Error("We couldn't read this PDF. It may be password-protected or corrupted.");
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    let targetIndices: number[];
    if (config.pagesMode === "selected" && config.selectedRange) {
      targetIndices = parsePageRangeToIndices(config.selectedRange, totalPages);
      if (targetIndices.length === 0) {
        throw new Error("No valid page numbers found in the specified range.");
      }
    } else {
      // All pages
      targetIndices = pages.map((_, i) => i);
    }

    const targetSet = new Set(targetIndices);

    for (let i = 0; i < totalPages; i++) {
      if (targetSet.has(i)) {
        const page = pages[i];
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + config.angle) % 360));
      }
      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalPages) * 75) + 15);
      }
    }

    const pdfBytes = await pdfDoc.save();
    if (onProgress) onProgress(100);

    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const baseName = file.name.replace(/\.pdf$/i, "");
    const outputFilename = `${baseName}_rotated_${config.angle}deg.pdf`;

    return {
      type: "single",
      blob,
      filename: outputFilename,
      originalSize: file.size,
      newSize: blob.size,
      details: {
        rotatedAngle: `${config.angle}°`,
        pagesModified: targetIndices.length,
        totalPages
      }
    };
  }
};
