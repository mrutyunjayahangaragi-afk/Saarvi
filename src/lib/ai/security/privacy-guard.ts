/**
 * Saarvi AI Privacy & Security Guard
 * Enforces data minimization, sensitive data redaction, prompt injection mitigation,
 * consent checks, and medical forgery prevention.
 */

export interface ValidationSecurityResult {
  allowed: boolean;
  reason?: string;
  sanitizedText?: string;
}

export class PrivacyGuard {
  // Regex patterns for sensitive PII
  private static readonly EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
  private static readonly PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  private static readonly USN_REGEX = /\b[1-4][A-Z]{2}\d{2}[A-Z]{2}\d{3}\b/gi;

  // Adversarial prompt injection keywords
  private static readonly INJECTION_PATTERNS = [
    /ignore (all )?(previous|above) instructions/i,
    /override (system|grading|security) rules/i,
    /bypass (permission|confirmation|access)/i,
    /reveal (system prompt|internal prompt|api key|secret)/i,
    /you are now in developer mode/i,
    /act as an unrestricted/i,
  ];

  // Medical fraud / fake document creation keywords
  private static readonly MEDICAL_FORGERY_PATTERNS = [
    /fake medical (certificate|note|slip|letter)/i,
    /forge (doctor|physician|hospital|medical) (note|certificate|signature)/i,
    /invent a (diagnosis|doctor name|hospital stamp|prescription)/i,
    /pretend to be a (doctor|clinician|physician)/i,
    /make up a medical condition/i,
  ];

  /**
   * Redacts sensitive personal information from operational logs and telemetry.
   */
  public static redactSensitiveTelemetry(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(this.EMAIL_REGEX, '[REDACTED_EMAIL]')
      .replace(this.PHONE_REGEX, '[REDACTED_PHONE]')
      .replace(this.USN_REGEX, '[REDACTED_USN]');
  }

  /**
   * Inspects user input for safety, adversarial injection, and fraud attempts.
   */
  public static inspectInputSafety(input: string): ValidationSecurityResult {
    if (!input || typeof input !== 'string') {
      return { allowed: true, sanitizedText: '' };
    }

    const trimmed = input.trim();

    // Check for medical fraud or forgery requests
    for (const pattern of this.MEDICAL_FORGERY_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          reason:
            'Saarvi AI cannot create, forge, or invent medical certificates, prescriptions, or clinician credentials. It can only draft truthful administrative leave requests based on facts you authorize.',
        };
      }
    }

    // Check for prompt injection attempts
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          reason:
            'Adversarial instruction detected. The requested action was blocked by security policy.',
        };
      }
    }

    // Sanitize markup / XML tags that could interfere with prompt demarcation
    const sanitized = trimmed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<\/?(system_prompt|user_context|eval_rules)>/gi, '');

    return {
      allowed: true,
      sanitizedText: sanitized,
    };
  }

  /**
   * Evaluates if life-threatening or emergency medical conditions are mentioned.
   */
  public static detectMedicalEmergency(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const emergencyKeywords = [
      /\bchest pain\b/i,
      /\bheart attack\b/i,
      /\bdifficulty breathing\b/i,
      /\bsevere shortness of breath\b/i,
      /\bunconscious(ness)?\b/i,
      /\bheavy bleeding\b/i,
      /\bseizure\b/i,
      /\bsuicid(e|al)\b/i,
      /\boverdose\b/i,
      /\bsevere allergic reaction\b/i,
      /\banaphylaxis\b/i,
    ];

    return emergencyKeywords.some((pattern) => pattern.test(text));
  }
}
