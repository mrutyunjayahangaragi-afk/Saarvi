import { OCRResult, OCRRequestOptions } from "@/types/ocr";
import { OCRProvider } from "../types";
import { cleanExtractedText, estimateWordCount, calculateOcrConfidence } from "../preprocessing";
import { AI_LIMITS } from "../../ai/limits";

export class CloudVisionOCRProvider implements OCRProvider {
  public readonly name = "CloudVisionOCRProvider";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OCR_API_KEY || process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "";
    this.model = model || process.env.AI_VISION_MODEL || "gemini-1.5-flash";
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    options?: OCRRequestOptions
  ): Promise<OCRResult> {
    if (!this.isAvailable()) {
      throw new Error("OCR provider is not configured. Missing API key.");
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs || AI_LIMITS.OCR_REQUEST_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const base64Data = imageBuffer.toString("base64");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Perform optical character recognition (OCR) on this document image. Extract all legible text verbatim. Preserve line breaks and paragraph structure. Return ONLY the extracted text, with no introductory or concluding remarks.",
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: AI_LIMITS.MAX_OUTPUT_TOKENS,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OCR service responded with status ${res.status}: ${errorText.slice(0, 100)}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!rawText.trim()) {
        throw new Error("No readable text was detected in this document.");
      }

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
        provider: "cloud-vision",
        model: this.model,
        isCleaned,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async extractTextFromPdf(
    pdfBuffer: Buffer,
    options?: OCRRequestOptions
  ): Promise<OCRResult> {
    // Note: PDF pages can be rendered to images client-side or sent directly if PDF mime is supported
    return this.extractTextFromImage(pdfBuffer, "application/pdf", options);
  }
}
