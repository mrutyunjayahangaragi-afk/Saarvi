export type AIOperationState =
  | "IDLE"
  | "PREPARING"
  | "CONSENT_REQUIRED"
  | "UPLOADING"
  | "PROCESSING"
  | "RESULT_READY"
  | "ERROR"
  | "CANCELLED";

export type AISummaryLength = "brief" | "standard" | "detailed";

export interface AISummaryOptions {
  length?: AISummaryLength;
  focus?: string;
  maxTokens?: number;
}

export interface AISummaryResult {
  summary: string;
  keyPoints: string[];
  charCount: number;
  provider?: string;
  model?: string;
}

export interface ContextChunk {
  chunkId: string;
  documentSessionId?: string;
  text: string;
  pageNumber?: number;
  charCount: number;
  tokenEstimate: number;
  score?: number;
}

export interface AIQuestionRequest {
  question: string;
  text?: string;
  chunks?: ContextChunk[];
  documentSessionId?: string;
}

export interface AIQuestionResponse {
  answer: string;
  citedContext?: string[];
  citedPages?: number[];
  model?: string;
  provider?: string;
}

export interface StructuredFieldDefinition {
  name: string;
  type: "string" | "number" | "date" | "array" | "object";
  description?: string;
  required?: boolean;
}

export interface StructuredExtractionSchema {
  name: string;
  fields: StructuredFieldDefinition[];
}

export interface StructuredExtractionResult {
  data: Record<string, unknown>;
  needsReview: boolean;
  extractedFieldsCount: number;
  model?: string;
  provider?: string;
}

export interface ResumeFeedbackResult {
  strengths: string[];
  suggestions: string[];
  missingAreas: string[];
  claritySuggestions: string[];
  atsFriendlyFormattingNotes?: string[];
  model?: string;
  provider?: string;
}

export interface JobAnalysisResult {
  role: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  keywords: string[];
  model?: string;
  provider?: string;
}

export interface AIConsentMetadata {
  aiProcessingConsent: boolean;
  consentVersion: string;
  consentTimestamp: string;
}

export interface AIOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  modelQuality?: "standard" | "advanced";
  requestId?: string;
}
