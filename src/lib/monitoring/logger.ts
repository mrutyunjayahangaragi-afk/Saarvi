// DocEase Phase 15: Structured Logging System
// Emits clean, consistent structured JSON logs for observability.
// Automatically redacts sensitive credentials, passwords, card numbers, and document contents.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  route?: string;
  requestId?: string;
  event: string;
  durationMs?: number;
  result?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

const REDACTED_KEYS = new Set([
  'password',
  'secret',
  'token',
  'key_secret',
  'webhook_secret',
  'razorpay_key_secret',
  'razorpay_webhook_secret',
  'card_number',
  'cvv',
  'cvc',
  'upi_pin',
  'upipin',
  'pan',
  'pdf',
  'pdfbytes',
  'document',
  'documentbytes',
  'filebytes',
  'buffer',
  'blob',
  'marks',
  'studentmarks',
]);

/**
 * Recursively redacts sensitive keys and strips large binary document buffers.
 */
export function sanitizeLogData<T>(data: T): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('pin')) {
      sanitized[key] = '[REDACTED]';
    } else if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      sanitized[key] = `[BINARY_BUFFER_${(value as Uint8Array).byteLength || 0}_BYTES]`;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

class StructuredLogger {
  private service: string;

  constructor(service: string = 'saarvi') {
    this.service = service;
  }

  private log(level: LogLevel, event: string, options: Partial<StructuredLogEntry> = {}) {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: options.service || this.service,
      route: options.route,
      requestId: options.requestId,
      event,
      durationMs: options.durationMs,
      result: options.result,
      metadata: options.metadata ? sanitizeLogData(options.metadata) : undefined,
      error: options.error
        ? {
            name: options.error.name,
            message: options.error.message,
            code: (options.error as any).code,
            // Only include stack in development to prevent leaking internals
            stack: process.env.NODE_ENV === 'development' ? options.error.stack : undefined,
          }
        : undefined,
    };

    const serialized = JSON.stringify(entry);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }

    return entry;
  }

  info(event: string, options?: Partial<StructuredLogEntry>) {
    return this.log('info', event, options);
  }

  warn(event: string, options?: Partial<StructuredLogEntry>) {
    return this.log('warn', event, options);
  }

  error(event: string, options?: Partial<StructuredLogEntry>) {
    return this.log('error', event, options);
  }

  debug(event: string, options?: Partial<StructuredLogEntry>) {
    if (process.env.NODE_ENV !== 'production') {
      return this.log('debug', event, options);
    }
  }
}

export const logger = new StructuredLogger('saarvi');
