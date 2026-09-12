import { AI_LIMITS } from "../ai/limits";

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageBuffer(
  buffer: Buffer | Uint8Array,
  mimeType: string
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Image file is empty." };
  }

  if (buffer.length > AI_LIMITS.MAX_IMAGE_FILE_BYTES) {
    return {
      valid: false,
      error: `Image size (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds limit of 15 MB.`,
    };
  }

  const validMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/tiff"]);
  if (!validMimes.has(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported image format: ${mimeType}. Please upload JPG, PNG, or WEBP.`,
    };
  }

  return { valid: true };
}

/**
 * Normalizes OCR output text:
 * - Collapses repeated empty lines
 * - Reconnects hyphenated words split across lines (e.g. "instruc-\ntion" -> "instruction")
 * - Removes non-printable control characters
 */
export function cleanExtractedText(rawText: string): { cleanedText: string; isCleaned: boolean } {
  if (!rawText) return { cleanedText: "", isCleaned: false };

  let text = rawText.replace(/\r\n/g, "\n");

  // Remove non-printable control chars except \n and \t
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Reconnect hyphenated word breaks at end of line
  const beforeHyphenRejoin = text;
  text = text.replace(/([a-zA-Z]+)-\n([a-zA-Z]+)/g, "$1$2");

  // Normalize excessive spaces and lines
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  const cleaned = text.trim();
  const isCleaned = cleaned !== rawText.trim() || beforeHyphenRejoin !== text;

  return { cleanedText: cleaned, isCleaned };
}

export function estimateWordCount(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/);
  return words.filter((w) => w.length > 0).length;
}

/**
 * Heuristic confidence estimate based on alphanumeric vs symbol ratio.
 */
export function calculateOcrConfidence(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  const totalChars = text.length;
  const alphaNumericChars = (text.match(/[a-zA-Z0-9\s.,!?:;\-'"()]/g) || []).length;
  const ratio = alphaNumericChars / totalChars;

  // Scale between 0.50 and 0.98
  return Math.min(0.98, Math.max(0.4, Number(ratio.toFixed(2))));
}
