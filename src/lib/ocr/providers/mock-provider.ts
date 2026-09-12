import { OCRResult, OCRRequestOptions } from "@/types/ocr";
import { OCRProvider } from "../types";
import { cleanExtractedText, estimateWordCount, calculateOcrConfidence } from "../preprocessing";

export class MockOCRProvider implements OCRProvider {
  public readonly name = "MockOCRProvider";

  isAvailable(): boolean {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_IN_PROD !== "true") {
      return false;
    }
    return true;
  }

  private ensureAvailable() {
    if (!this.isAvailable()) {
      throw new Error("Mock OCR provider is strictly disabled in production environments.");
    }
  }

  async extractTextFromImage(
    imageBuffer: Buffer,
    _mimeType: string,
    options?: OCRRequestOptions
  ): Promise<OCRResult> {
    this.ensureAvailable();

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("No readable text was detected in the empty image.");
    }

    const rawText = `INVOICE #INV-2025-0842
Date: 2025-06-15
Vendor: Apex Cloud Solutions Inc.
Customer: Saarvi Workspace User

Item Description              Qty    Rate      Total
------------------------------------------------------
Cloud Hosting Service (Annual) 1   $950.00    $950.00
Domain Registration & DNS      1    $25.00     $25.00
Premium Security Certificate   1   $150.00    $150.00

Subtotal:                                   $1,125.00
Tax (10%):                                    $112.50
Total Due:                                  $1,237.50

Terms: Payment due within 30 days of invoice date.
Thank you for your business!`;

    const { cleanedText, isCleaned } = options?.preprocess !== false
      ? cleanExtractedText(rawText)
      : { cleanedText: rawText, isCleaned: false };

    const pageResult = {
      pageNumber: 1,
      text: cleanedText,
      confidence: calculateOcrConfidence(cleanedText),
      wordsCount: estimateWordCount(cleanedText),
    };

    return {
      text: cleanedText,
      pages: [pageResult],
      totalPages: 1,
      durationMs: 240,
      provider: "mock",
      model: "mock-ocr-v1",
      isCleaned,
    };
  }

  async extractTextFromPdf(
    pdfBuffer: Buffer,
    options?: OCRRequestOptions
  ): Promise<OCRResult> {
    this.ensureAvailable();

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("PDF file is empty or corrupted.");
    }

    const start = options?.pageRange?.start || 1;
    const end = options?.pageRange?.end || 2;
    const pages = [];
    let combined = "";

    for (let p = start; p <= end; p++) {
      const pageText = `Document Section ${p}: Standard Operating Guidelines
Page ${p} of ${end}

1. OVERVIEW
This section details the verification and validation checkpoints required for system integration.
All operational modules must undergo automated regression and deterministic validation before release.

2. SPECIFICATIONS
- Architecture: Local-first with isolated external AI/OCR providers.
- Data Minimization: Zero arbitrary workspace syncing; payload contains only required document excerpts.
- Privacy Invariant: Explicit user consent is mandatory prior to any network transmission.`;

      const { cleanedText, isCleaned } = cleanExtractedText(pageText);
      pages.push({
        pageNumber: p,
        text: cleanedText,
        confidence: calculateOcrConfidence(cleanedText),
        wordsCount: estimateWordCount(cleanedText),
      });

      combined += (combined ? "\n\n--- PAGE BREAK ---\n\n" : "") + cleanedText;
    }

    return {
      text: combined,
      pages,
      totalPages: pages.length,
      durationMs: 450,
      provider: "mock",
      model: "mock-ocr-v1",
      isCleaned: true,
    };
  }
}
