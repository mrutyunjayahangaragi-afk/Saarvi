import { AIConsentMetadata } from "@/types/ai";

const CONSENT_STORAGE_KEY = "saarvi_ai_consent";
const LEGACY_CONSENT_STORAGE_KEY = "docease_ai_consent";
export const CURRENT_CONSENT_VERSION = "1.0";

export function getConsentMetadata(): AIConsentMetadata | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY) || window.localStorage.getItem(LEGACY_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AIConsentMetadata;

    // Verify minimal expected schema
    if (
      typeof parsed?.aiProcessingConsent === "boolean" &&
      typeof parsed?.consentVersion === "string" &&
      typeof parsed?.consentTimestamp === "string"
    ) {
      return parsed;
    }
  } catch {
    // Corrupted entry, clear it
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  }

  return null;
}

export function hasGivenConsent(): boolean {
  const metadata = getConsentMetadata();
  return Boolean(
    metadata &&
      metadata.aiProcessingConsent === true &&
      metadata.consentVersion === CURRENT_CONSENT_VERSION
  );
}

export function recordConsent(): AIConsentMetadata {
  const metadata: AIConsentMetadata = {
    aiProcessingConsent: true,
    consentVersion: CURRENT_CONSENT_VERSION,
    consentTimestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(metadata));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  return metadata;
}

export function revokeConsent(): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
