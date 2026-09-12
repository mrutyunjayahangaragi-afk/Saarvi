import { ToolDefinition } from "@/types/tool";

export type ProcessingMode = "LOCAL" | "EXTERNAL_CONSENT_REQUIRED";

/**
 * Evaluates whether a tool operation runs 100% locally in-browser or requires external processing.
 *
 * Invariant: Standard document conversions (JPG to PDF, merge, organize, compress)
 * MUST ALWAYS resolve to "LOCAL".
 */
export function determineProcessingMode(tool: ToolDefinition): ProcessingMode {
  // If explicitly declared as local or not requiring external
  if (tool.supportsLocalProcessing && !tool.requiresExternalProcessing) {
    return "LOCAL";
  }

  // If requires external AI/OCR processing
  if (tool.requiresExternalProcessing || tool.privacyLevel === "external") {
    return "EXTERNAL_CONSENT_REQUIRED";
  }

  // Default to local for safety
  return "LOCAL";
}

/**
 * Checks if a feature ID requires external processing.
 */
export function isExternalFeature(featureId: string): boolean {
  const externalFeatures = new Set([
    "ocr-image",
    "ocr-pdf",
    "document-summary",
    "document-qa",
    "resume-feedback",
    "job-description-analysis",
    "study-explanation",
  ]);

  return externalFeatures.has(featureId);
}
