import { ToolOperation, SingleFileResult, MultiFileResult } from "./types";
import { formatConverterOperation } from "./image/format-converter";
import { imageResizeOperation } from "./image/resizer";
import { compressImageOperation } from "./image/compress-image";
import { cropImageOperation } from "./image/crop-image";
import { rotateImageOperation } from "./image/rotate-image";
import { imageToPdfOperation } from "./pdf/image-to-pdf";
import { pdfToJpgOperation } from "./pdf/pdf-to-jpg";
import { pdfToPngOperation } from "./pdf/pdf-to-png";
import { mergePdfOperation } from "./pdf/merge-pdf";
import { splitPdfOperation } from "./pdf/split-pdf";
import { rotatePdfOperation } from "./pdf/rotate-pdf";
import { extractPagesOperation } from "./pdf/extract-pdf-pages";
import { compressPdfOperation } from "./pdf/compress-pdf";
import { deletePdfPagesOperation } from "./pdf/delete-pdf-pages";
import { reorderPdfPagesOperation } from "./pdf/reorder-pdf-pages";
import { pdfToWordOperation } from "./pdf/pdf-to-word";
import { wordToPdfOperation } from "./pdf/word-to-pdf";

// Reusable union type for registered operations
export type AnyToolResult = SingleFileResult | MultiFileResult;
export type AnyToolOperation = ToolOperation<never, AnyToolResult>;

export const TOOL_OPERATIONS: Record<string, AnyToolOperation> = {
  // Document conversion — PDF ↔ Word
  "pdf-to-word": pdfToWordOperation as unknown as AnyToolOperation,
  "word-to-pdf": wordToPdfOperation as unknown as AnyToolOperation,
  // Image — format conversion (covers JPG↔PNG and WebP→JPG/PNG)
  "png-to-jpg": formatConverterOperation as unknown as AnyToolOperation,
  "jpg-to-png": formatConverterOperation as unknown as AnyToolOperation,
  "webp-to-jpg": formatConverterOperation as unknown as AnyToolOperation,
  "webp-to-png": formatConverterOperation as unknown as AnyToolOperation,

  // Image — transform
  "image-resize": imageResizeOperation as unknown as AnyToolOperation,
  "crop-image": cropImageOperation as unknown as AnyToolOperation,
  "rotate-image": rotateImageOperation as unknown as AnyToolOperation,
  "compress-image": compressImageOperation as unknown as AnyToolOperation,

  // Image → PDF
  "jpg-to-pdf": imageToPdfOperation as unknown as AnyToolOperation,
  "image-to-pdf": imageToPdfOperation as unknown as AnyToolOperation,
  "multiple-images-to-pdf": imageToPdfOperation as unknown as AnyToolOperation,

  // PDF → Image
  "pdf-to-jpg": pdfToJpgOperation as unknown as AnyToolOperation,
  "pdf-to-png": pdfToPngOperation as unknown as AnyToolOperation,

  // PDF organization
  "merge-pdf": mergePdfOperation as unknown as AnyToolOperation,
  "split-pdf": splitPdfOperation as unknown as AnyToolOperation,
  "rotate-pdf": rotatePdfOperation as unknown as AnyToolOperation,
  "extract-pdf-pages": extractPagesOperation as unknown as AnyToolOperation,
  "delete-pdf-pages": deletePdfPagesOperation as unknown as AnyToolOperation,
  "reorder-pdf-pages": reorderPdfPagesOperation as unknown as AnyToolOperation,

  // PDF optimization
  "compress-pdf": compressPdfOperation as unknown as AnyToolOperation,
};

export function getToolOperation(slug: string): AnyToolOperation | undefined {
  return TOOL_OPERATIONS[slug];
}
