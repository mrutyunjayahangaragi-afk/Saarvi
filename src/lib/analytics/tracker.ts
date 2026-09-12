/**
 * DocEase Phase 27: Privacy-Conscious Analytics Tracker.
 *
 * Enforces:
 * 1. Event taxonomy validation
 * 2. Automatic redaction & exclusion of sensitive data, credentials, and document content
 * 3. User consent model with non-blocking opt-out
 * 4. Pseudonymous session identifiers
 * 5. Fail-safe execution (analytics errors never break core functionality)
 */

import {
  AnalyticsEvent,
  VALID_EVENT_NAMES,
  PROHIBITED_KEYS,
  FileCountBucket,
  FileSizeBucket,
  DurationBucket,
  ResultCountBucket,
} from './types';

export class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private readonly MAX_EVENTS = 1000;
  private currentSessionId: string | null = null;

  /**
   * Helper to derive file count bucket.
   */
  public getFileCountBucket(count: number): FileCountBucket {
    if (count <= 1) return '1';
    if (count <= 5) return '2-5';
    return '6+';
  }

  /**
   * Helper to derive file size bucket.
   */
  public getFileSizeBucket(bytes: number): FileSizeBucket {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return '<1MB';
    if (mb < 5) return '1-5MB';
    if (mb < 20) return '5-20MB';
    return '>20MB';
  }

  /**
   * Helper to derive execution duration bucket.
   */
  public getDurationBucket(ms: number): DurationBucket {
    if (ms < 500) return '<500ms';
    if (ms < 2000) return '500ms-2s';
    if (ms < 10000) return '2s-10s';
    return '>10s';
  }

  /**
   * Helper to derive search result count bucket.
   */
  public getResultCountBucket(count: number): ResultCountBucket {
    if (count === 0) return '0';
    if (count <= 5) return '1-5';
    return '6+';
  }

  /**
   * Returns user analytics consent status.
   * Defaults to true unless explicitly opted out via localStorage.
   */
  public getConsent(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem('saarvi_analytics_consent') ?? localStorage.getItem('docease_analytics_consent');
      return stored !== 'denied';
    } catch {
      return true;
    }
  }

  /**
   * Updates user analytics consent preference.
   */
  public setConsent(granted: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('saarvi_analytics_consent', granted ? 'granted' : 'denied');
    } catch {
      // Ignore storage errors in restricted iframe/sandbox
    }
  }

  /**
   * Gets or generates an anonymous, pseudonymous session identifier.
   * Completely decoupled from user identity, email, or credentials.
   */
  public getSessionId(): string {
    if (this.currentSessionId) return this.currentSessionId;

    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('saarvi_anon_session_id') ?? sessionStorage.getItem('docease_anon_session_id');
        if (stored) {
          this.currentSessionId = stored;
          return stored;
        }
      } catch {}
    }

    const rand = Math.random().toString(36).substring(2, 10);
    const time = Date.now().toString(36);
    this.currentSessionId = `anon_${time}_${rand}`;

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('saarvi_anon_session_id', this.currentSessionId);
      } catch {}
    }

    return this.currentSessionId;
  }

  /**
   * Sanitizes an event payload, removing prohibited keys and large payload values.
   */
  public sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();

      // Check if key is prohibited
      if (
        PROHIBITED_KEYS.has(lowerKey) ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('filebyte') ||
        lowerKey.includes('buffer') ||
        lowerKey.includes('prompt')
      ) {
        continue; // Drop completely
      }

      // Drop binary buffers
      if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
        continue;
      }

      // Cap string lengths to prevent dumping full document text or queries
      if (typeof value === 'string') {
        if (value.length > 300) {
          sanitized[key] = value.substring(0, 300) + '...';
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizePayload(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
  }

  /**
   * Tracks an analytics event.
   * Fail-Safe Invariant: Never throws or interrupts application execution.
   */
  public trackEvent(rawEvent: AnalyticsEvent): boolean {
    try {
      // 1. Check user consent
      if (!this.getConsent()) {
        return false; // Safely skipped
      }

      // 2. Validate event name against centralized taxonomy
      if (!VALID_EVENT_NAMES.has(rawEvent.name)) {
        console.warn(`[Saarvi Analytics] Rejected unknown event: ${(rawEvent as any).name}`);
        return false;
      }

      // 3. Sanitize payload
      const sanitized = this.sanitizePayload(rawEvent as unknown as Record<string, unknown>);

      // 4. Inject standard metadata
      const enrichedEvent: AnalyticsEvent = {
        ...sanitized,
        timestamp: rawEvent.timestamp || new Date().toISOString(),
        sessionId: rawEvent.sessionId || this.getSessionId(),
      } as AnalyticsEvent;

      // 5. Store in bounded ring buffer
      if (this.events.length >= this.MAX_EVENTS) {
        this.events.shift();
      }
      this.events.push(enrichedEvent);

      return true;
    } catch {
      // Fail-safe: telemetry failure must never impact product operation
      return false;
    }
  }

  /**
   * Returns recent recorded events in ring buffer.
   */
  public getRecentEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Aggregates event metrics for truthful reporting.
   */
  public getAnalyticsSummary() {
    const total = this.events.length;
    const byName: Record<string, number> = {};
    let toolCompletedCount = 0;
    let toolFailedCount = 0;

    for (const evt of this.events) {
      byName[evt.name] = (byName[evt.name] || 0) + 1;
      if (evt.name === 'tool_completed') toolCompletedCount++;
      if (evt.name === 'tool_failed') toolFailedCount++;
    }

    return {
      totalEvents: total,
      byEventName: byName,
      toolCompletedCount,
      toolFailedCount,
    };
  }

  /**
   * Clears the event buffer (useful for test isolation).
   */
  public clear(): void {
    this.events = [];
    this.currentSessionId = null;
  }
}

export const analytics = new AnalyticsTracker();
