/**
 * Observability: Performance Telemetry & Latency Profiling.
 *
 * Lightweight, zero-external-dependency profiling for operations,
 * computing execution durations, p50/p95 latency percentiles, and error frequencies.
 *
 * Privacy Invariant:
 * Zero document contents, user PII, or credentials are ever recorded.
 */

import { generateTraceId } from './errors';

export interface PerformanceSpan {
  name: string;
  traceId: string;
  startTime: number;
  durationMs: number;
  success: boolean;
  errorType?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface MetricSummary {
  name: string;
  count: number;
  succeeded: number;
  failed: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
}

export interface ApiSpan {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  provider?: string;
  model?: string;
  isError: boolean;
}

export interface ApiMetricsSummary {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  p50DurationMs: number;
  p95DurationMs: number;
  avgDurationMs: number;
  byEndpoint: Record<string, { count: number; errorCount: number; avgDurationMs: number }>;
  byProvider: Record<string, { count: number; errorCount: number }>;
}

class TelemetryRegistry {
  private spans: PerformanceSpan[] = [];
  private apiSpans: ApiSpan[] = [];
  private readonly MAX_SPANS = 1000;

  /**
   * Records a completed span into the ring buffer.
   */
  public recordSpan(span: PerformanceSpan): void {
    if (this.spans.length >= this.MAX_SPANS) {
      this.spans.shift(); // Evict oldest
    }
    this.spans.push(span);
  }

  /**
   * Measures the asynchronous execution time of an operation.
   */
  public async measure<T>(
    name: string,
    fn: (traceId: string) => Promise<T>,
    metadata?: Record<string, string | number | boolean>
  ): Promise<{ result: T; durationMs: number; traceId: string }> {
    const traceId = generateTraceId();
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let success = true;
    let errorType: string | undefined;

    try {
      const result = await fn(traceId);
      return { result, durationMs: 0, traceId }; // durationMs overwritten in finally
    } catch (err) {
      success = false;
      errorType = err instanceof Error ? err.name : 'UnknownError';
      throw err;
    } finally {
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = Math.round((endTime - startTime) * 100) / 100;

      this.recordSpan({
        name,
        traceId,
        startTime,
        durationMs,
        success,
        errorType,
        metadata,
      });
    }
  }

  /**
   * Synchronous measurement wrapper.
   */
  public measureSync<T>(
    name: string,
    fn: (traceId: string) => T,
    metadata?: Record<string, string | number | boolean>
  ): { result: T; durationMs: number; traceId: string } {
    const traceId = generateTraceId();
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let success = true;
    let errorType: string | undefined;

    try {
      const result = fn(traceId);
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = Math.round((endTime - startTime) * 100) / 100;
      this.recordSpan({
        name,
        traceId,
        startTime,
        durationMs,
        success,
        metadata,
      });
      return { result, durationMs, traceId };
    } catch (err) {
      success = false;
      errorType = err instanceof Error ? err.name : 'UnknownError';
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = Math.round((endTime - startTime) * 100) / 100;
      this.recordSpan({
        name,
        traceId,
        startTime,
        durationMs,
        success,
        errorType,
        metadata,
      });
      throw err;
    }
  }

  /**
   * Computes aggregated metric summary (p50, p95, avg) for a given operation name.
   */
  public getMetricSummary(name: string): MetricSummary | null {
    const matching = this.spans.filter((s) => s.name === name);
    if (matching.length === 0) return null;

    const durations = matching.map((s) => s.durationMs).sort((a, b) => a - b);
    const count = matching.length;
    const succeeded = matching.filter((s) => s.success).length;
    const failed = count - succeeded;

    const sum = durations.reduce((acc, d) => acc + d, 0);
    const avgDurationMs = Math.round((sum / count) * 100) / 100;
    const minDurationMs = durations[0];
    const maxDurationMs = durations[durations.length - 1];

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));

    return {
      name,
      count,
      succeeded,
      failed,
      minDurationMs,
      maxDurationMs,
      avgDurationMs,
      p50DurationMs: durations[p50Index],
      p95DurationMs: durations[p95Index],
    };
  }

  /**
   * Returns all recorded metric summaries across operations.
   */
  public getAllSummaries(): MetricSummary[] {
    const names = Array.from(new Set(this.spans.map((s) => s.name)));
    return names.map((n) => this.getMetricSummary(n)!).filter(Boolean);
  }

  /**
   * Records an API metric.
   */
  public recordApiMetric(
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number,
    provider?: string,
    model?: string
  ): void {
    if (this.apiSpans.length >= this.MAX_SPANS) {
      this.apiSpans.shift(); // Evict oldest
    }
    this.apiSpans.push({
      endpoint,
      method,
      statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
      provider,
      model,
      isError: statusCode >= 400,
    });
  }

  /**
   * Computes aggregated API metrics summary.
   */
  public getApiMetricsSummary(): ApiMetricsSummary {
    const total = this.apiSpans.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        errorCount: 0,
        errorRate: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        avgDurationMs: 0,
        byEndpoint: {},
        byProvider: {},
      };
    }

    let errorCount = 0;
    let sumDuration = 0;
    const durations = this.apiSpans.map((s) => s.durationMs).sort((a, b) => a - b);
    const byEndpoint: Record<string, { count: number; errorCount: number; avgDurationMs: number }> = {};
    const byProvider: Record<string, { count: number; errorCount: number }> = {};

    for (const span of this.apiSpans) {
      if (span.isError) errorCount++;
      sumDuration += span.durationMs;

      // By endpoint
      if (!byEndpoint[span.endpoint]) {
        byEndpoint[span.endpoint] = { count: 0, errorCount: 0, avgDurationMs: 0 };
      }
      byEndpoint[span.endpoint].count++;
      if (span.isError) byEndpoint[span.endpoint].errorCount++;

      // By provider
      if (span.provider) {
        if (!byProvider[span.provider]) {
          byProvider[span.provider] = { count: 0, errorCount: 0 };
        }
        byProvider[span.provider].count++;
        if (span.isError) byProvider[span.provider].errorCount++;
      }
    }

    // Compute averages
    for (const ep in byEndpoint) {
      const epSpans = this.apiSpans.filter((s) => s.endpoint === ep);
      const epSum = epSpans.reduce((acc, s) => acc + s.durationMs, 0);
      byEndpoint[ep].avgDurationMs = Math.round((epSum / epSpans.length) * 100) / 100;
    }

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));

    return {
      totalRequests: total,
      errorCount,
      errorRate: Math.round((errorCount / total) * 1000) / 1000,
      p50DurationMs: durations[p50Index],
      p95DurationMs: durations[p95Index],
      avgDurationMs: Math.round((sumDuration / total) * 100) / 100,
      byEndpoint,
      byProvider,
    };
  }

  /**
   * Clears telemetry buffer (useful for testing or profile reset).
   */
  public clear(): void {
    this.spans = [];
    this.apiSpans = [];
  }
}

export const telemetry = new TelemetryRegistry();
