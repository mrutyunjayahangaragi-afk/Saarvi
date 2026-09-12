export const AI_LIMITS = {
  MAX_DOCUMENT_CHARACTERS: 50_000,
  MAX_PDF_OCR_PAGES: 20,
  MAX_QUESTION_LENGTH: 500,
  MAX_OUTPUT_TOKENS: 2_048,
  AI_REQUEST_TIMEOUT_MS: 25_000,
  OCR_REQUEST_TIMEOUT_MS: 30_000,
  MAX_AI_REQUESTS_PER_MINUTE: 15,
  MAX_OCR_REQUESTS_PER_MINUTE: 10,
  MAX_IMAGE_PIXELS: 4_000_000,
  MAX_IMAGE_FILE_BYTES: 15 * 1024 * 1024,
  MAX_PDF_FILE_BYTES: 25 * 1024 * 1024,
  MAX_RETRIEVAL_CHUNKS: 5,
  CHUNK_SIZE_CHARS: 1_200,
  CHUNK_OVERLAP_CHARS: 150,
} as const;

export function validateDocumentText(text: unknown): { valid: boolean; error?: string } {
  if (typeof text !== "string") {
    return { valid: false, error: "Document text must be a valid string." };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Document contains no readable text." };
  }
  if (trimmed.length > AI_LIMITS.MAX_DOCUMENT_CHARACTERS) {
    return {
      valid: false,
      error: `Document exceeds maximum allowed length of ${AI_LIMITS.MAX_DOCUMENT_CHARACTERS.toLocaleString()} characters.`,
    };
  }
  return { valid: true };
}

export function validateQuestion(question: unknown): { valid: boolean; error?: string } {
  if (typeof question !== "string") {
    return { valid: false, error: "Question must be a string." };
  }
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Question cannot be empty." };
  }
  if (trimmed.length > AI_LIMITS.MAX_QUESTION_LENGTH) {
    return {
      valid: false,
      error: `Question exceeds limit of ${AI_LIMITS.MAX_QUESTION_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

export function validatePageRange(
  totalPages: number,
  start?: number,
  end?: number
): { valid: boolean; start: number; end: number; error?: string } {
  const effectiveStart = start && start >= 1 ? Math.min(start, totalPages) : 1;
  const effectiveEnd = end && end >= effectiveStart ? Math.min(end, totalPages) : Math.min(totalPages, AI_LIMITS.MAX_PDF_OCR_PAGES);

  const selectedCount = effectiveEnd - effectiveStart + 1;
  if (selectedCount > AI_LIMITS.MAX_PDF_OCR_PAGES) {
    return {
      valid: false,
      start: effectiveStart,
      end: effectiveEnd,
      error: `Selected page count (${selectedCount}) exceeds limit of ${AI_LIMITS.MAX_PDF_OCR_PAGES} pages.`,
    };
  }

  return { valid: true, start: effectiveStart, end: effectiveEnd };
}
