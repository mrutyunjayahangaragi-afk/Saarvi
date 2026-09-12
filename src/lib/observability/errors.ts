/**
 * Observability: Structured Error Classification & Sanitization.
 *
 * Categorizes application errors into deterministic operational types,
 * prevents sensitive credential leakage, and links errors with request/trace IDs.
 */

export type ErrorCategory =
  | 'VALIDATION_ERROR'
  | 'USER_ERROR'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Production incident and error classification domains.
 */
export type ProductionErrorCategory =
  | 'AUTH'
  | 'DB'
  | 'EMAIL'
  | 'PAYMENT'
  | 'AI'
  | 'OCR'
  | 'TOOL'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SECURITY'
  | 'CLIENT'
  | 'SERVER'
  | 'EXTERNAL_PROVIDER';

export const PRODUCTION_ERROR_CATEGORIES: readonly ProductionErrorCategory[] = [
  'AUTH',
  'DB',
  'EMAIL',
  'PAYMENT',
  'AI',
  'OCR',
  'TOOL',
  'UPLOAD',
  'DOWNLOAD',
  'SECURITY',
  'CLIENT',
  'SERVER',
  'EXTERNAL_PROVIDER',
] as const;

export interface SerializedAppError {
  category: ErrorCategory;
  productionCategory?: ProductionErrorCategory;
  code: string;
  message: string;
  requestId: string;
  timestamp: string;
  isOperational: boolean;
  context?: Record<string, unknown>;
}


export function toProductionCategory(category: ErrorCategory | string): ProductionErrorCategory {
  switch (category) {
    case 'VALIDATION_ERROR':
    case 'USER_ERROR':
      return 'CLIENT';
    case 'NETWORK_ERROR':
    case 'PROVIDER_ERROR':
    case 'TIMEOUT':
      return 'EXTERNAL_PROVIDER';
    case 'STORAGE_ERROR':
      return 'DB';
    case 'INTERNAL_ERROR':
    default:
      return 'SERVER';
  }
}

export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly productionCategory: ProductionErrorCategory;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly requestId: string;
  public readonly timestamp: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    category: ErrorCategory = 'INTERNAL_ERROR',
    code: string = 'GENERIC_ERROR',
    options?: {
      requestId?: string;
      productionCategory?: ProductionErrorCategory;
      isOperational?: boolean;
      context?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.productionCategory = options?.productionCategory || toProductionCategory(category);
    this.code = code;
    this.isOperational = options?.isOperational ?? true;
    this.requestId = options?.requestId || generateTraceId();
    this.timestamp = new Date().toISOString();
    this.context = sanitizeContext(options?.context);
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  public toJSON(): SerializedAppError {
    return {
      category: this.category,
      productionCategory: this.productionCategory,
      code: this.code,
      message: this.message,
      requestId: this.requestId,
      timestamp: this.timestamp,
      isOperational: this.isOperational,
      context: this.context,
    };
  }
}


/**
 * Generates a collision-resistant lightweight trace ID for distributed tracing.
 */
export function generateTraceId(prefix: string = 'req'): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${time}_${rand}`;
}

/**
 * Sanitizes arbitrary context objects to strip sensitive credentials and tokens.
 */
function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context || typeof context !== 'object') return undefined;

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ['secret', 'token', 'key', 'password', 'auth', 'bearer', 'cookie', 'credit'];

  for (const [key, value] of Object.entries(context)) {
    const isSensitive = sensitiveKeys.some((s) => key.toLowerCase().includes(s));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Classifies an arbitrary unknown caught error into a standardized AppError.
 */
export function classifyError(err: unknown, defaultCategory: ErrorCategory = 'INTERNAL_ERROR', requestId?: string): AppError {
  if (err instanceof AppError) {
    return err;
  }

  const reqId = requestId || generateTraceId();

  if (err instanceof DOMException) {
    if (err.name === 'QuotaExceededError') {
      return new AppError('Storage quota exceeded. Please clear space.', 'STORAGE_ERROR', 'QUOTA_EXCEEDED', {
        requestId: reqId,
      });
    }
    if (err.name === 'AbortError') {
      return new AppError('Operation aborted or timed out.', 'TIMEOUT', 'REQUEST_ABORTED', {
        requestId: reqId,
      });
    }
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    if (msg.includes('network') || msg.includes('offline') || msg.includes('failed to fetch')) {
      return new AppError('Network connection failed. Please verify your connection.', 'NETWORK_ERROR', 'FETCH_FAILED', {
        requestId: reqId,
        cause: err,
      });
    }
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline')) {
      return new AppError('The requested operation timed out.', 'TIMEOUT', 'OPERATION_TIMEOUT', {
        requestId: reqId,
        cause: err,
      });
    }
    if (msg.includes('quota') || msg.includes('indexeddb') || msg.includes('storage')) {
      return new AppError(err.message, 'STORAGE_ERROR', 'STORAGE_FAILURE', {
        requestId: reqId,
        cause: err,
      });
    }
    if (msg.includes('invalid') || msg.includes('validation') || msg.includes('schema')) {
      return new AppError(err.message, 'VALIDATION_ERROR', 'VALIDATION_FAILURE', {
        requestId: reqId,
        cause: err,
      });
    }

    return new AppError(err.message, defaultCategory, 'UNEXPECTED_ERROR', {
      requestId: reqId,
      cause: err,
    });
  }

  return new AppError(String(err) || 'An unexpected error occurred.', defaultCategory, 'UNKNOWN_ERROR', {
    requestId: reqId,
  });
}
