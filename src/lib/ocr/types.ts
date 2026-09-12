import { OCRResult, OCRRequestOptions } from "@/types/ocr";

export interface OCRProvider {
  name: string;
  isAvailable(): boolean;
  extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    options?: OCRRequestOptions
  ): Promise<OCRResult>;
  extractTextFromPdf(
    pdfBuffer: Buffer,
    options?: OCRRequestOptions
  ): Promise<OCRResult>;
}
