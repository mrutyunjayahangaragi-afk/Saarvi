import { OCRProvider } from "../types";
import { MockOCRProvider } from "./mock-provider";
import { CloudVisionOCRProvider } from "./cloud-provider";
import { OCRResult, OCRRequestOptions } from "@/types/ocr";

export class NullOCRProvider implements OCRProvider {
  public readonly name = "NullOCRProvider";

  isAvailable(): boolean {
    return false;
  }

  private throwUnavailable(): never {
    throw new Error("OCR is currently unavailable. No OCR provider is configured.");
  }

  async extractTextFromImage(
    _imageBuffer: Buffer,
    _mimeType: string,
    _options?: OCRRequestOptions
  ): Promise<OCRResult> {
    this.throwUnavailable();
  }

  async extractTextFromPdf(
    _pdfBuffer: Buffer,
    _options?: OCRRequestOptions
  ): Promise<OCRResult> {
    this.throwUnavailable();
  }
}

let cachedOCRProvider: OCRProvider | null = null;

export function getOCRProvider(forceProvider?: string): OCRProvider {
  if (forceProvider) {
    if (forceProvider === "mock") return new MockOCRProvider();
    if (forceProvider === "cloud") return new CloudVisionOCRProvider();
  }

  if (cachedOCRProvider) return cachedOCRProvider;

  const providerType = (process.env.OCR_PROVIDER || "").toLowerCase().trim();

  // Test environment or explicit mock
  if (providerType === "mock" || process.env.NODE_ENV === "test") {
    cachedOCRProvider = new MockOCRProvider();
    return cachedOCRProvider;
  }

  if (
    providerType === "gemini" ||
    providerType === "cloud" ||
    process.env.OCR_API_KEY ||
    process.env.GEMINI_API_KEY
  ) {
    const cloud = new CloudVisionOCRProvider();
    if (cloud.isAvailable()) {
      cachedOCRProvider = cloud;
      return cachedOCRProvider;
    }
  }

  // Development fallback to mock only if explicitly allowed or in dev mode
  if (process.env.NODE_ENV === "development") {
    cachedOCRProvider = new MockOCRProvider();
    return cachedOCRProvider;
  }

  // Default: NullOCRProvider
  cachedOCRProvider = new NullOCRProvider();
  return cachedOCRProvider;
}

export function resetOCRProvider(): void {
  cachedOCRProvider = null;
}
