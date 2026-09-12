export type OCROperationState =
  | "IDLE"
  | "PREPARING"
  | "CONSENT_REQUIRED"
  | "PROCESSING"
  | "RESULT_READY"
  | "ERROR"
  | "CANCELLED";

export interface OCRPageResult {
  pageNumber: number;
  text: string;
  confidence?: number;
  wordsCount: number;
}

export interface OCRResult {
  text: string;
  pages: OCRPageResult[];
  totalPages: number;
  durationMs?: number;
  provider?: string;
  model?: string;
  isCleaned?: boolean;
}

export interface OCRRequestOptions {
  pageRange?: { start: number; end: number };
  selectedPages?: number[];
  preprocess?: boolean;
  language?: string;
  requestId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SearchablePdfOptions {
  fontSize?: number;
  fontName?: string;
  renderOriginalPages?: boolean;
}

export interface SearchablePdfResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  fileName: string;
}
