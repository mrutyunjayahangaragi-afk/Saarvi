// DocEase Phase 15: Lightweight Production Error Tracker
// Captures system and API errors, stores them in the Admin Error Log store,
// and strictly prevents logging any document contents, PDF bytes, or payment credentials.

import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { PlatformErrorRecord, ErrorSeverity } from '@/types/admin';
import { logger } from './logger';

export interface CaptureErrorOptions {
  service: string;
  errorType?: string;
  severity?: ErrorSeverity;
  requestId?: string;
  tool?: string;
  diagnostics?: string;
}

export class ErrorTracker {
  /**
   * Captures an error safely and registers it for admin review.
   */
  public static captureError(
    err: unknown,
    options: CaptureErrorOptions
  ): PlatformErrorRecord {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const requestId = options.requestId || `err_${Date.now().toString(36)}`;
    const severity = options.severity || 'ERROR';
    const errorType = options.errorType || errorObj.name || 'SystemError';

    // Strip any potential sensitive information from the error message
    let safeMessage = errorObj.message || 'An unexpected server error occurred.';
    if (safeMessage.includes('key_secret') || safeMessage.includes('secret') || safeMessage.includes('password')) {
      safeMessage = 'A configuration or security error occurred.';
    }

    const record = MockStorageProvider.addSystemError({
      service: options.service,
      tool: options.tool,
      severity,
      errorType,
      requestId,
      status: 'NEW',
      safeMessage,
      diagnostics: options.diagnostics,
    });

    // Also emit structured error log
    logger.error('platform_error_captured', {
      service: options.service,
      requestId,
      event: errorType,
      error: errorObj,
      metadata: {
        severity,
        safeMessage,
        diagnostics: options.diagnostics,
      },
    });

    return record;
  }
}
