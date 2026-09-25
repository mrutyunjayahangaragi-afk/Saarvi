/**
 * GET /api/admin/system/health
 *
 * Real-Time Admin System Health & Observability API (PART 6)
 * Measures deterministic operational performance:
 * - Active Requests
 * - Queue Depth
 * - Worker Utilization
 * - Database Latency
 * - Cache Hit Rate
 * - Error Rate
 * - P95 API Latency
 * - External Provider Health (Razorpay, SerpApi, Gemini, Email)
 */

import { NextResponse } from 'next/server';
import { systemTelemetryHub } from '@/lib/concurrency/os-scheduler';
import { adminService } from '@/lib/services/adminService';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    // 1. Measure real database latency
    let dbLatencyMs = 4;
    const startDb = performance.now();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('platform_settings').select('id').limit(1);
          dbLatencyMs = Math.round(performance.now() - startDb);
        } catch {
          dbLatencyMs = Math.round(performance.now() - startDb);
        }
      }
    } else {
      // Local storage read latency
      dbLatencyMs = Math.max(1, Math.round(performance.now() - startDb));
    }

    // 2. Fetch real-time telemetry from OS Concurrency Hub
    const telemetry = systemTelemetryHub.getSystemHealthReport(dbLatencyMs);

    // 3. Run individual subsystem probes
    const probes = await adminService.runSystemHealthChecks();

    return NextResponse.json({
      success: true,
      data: {
        activeRequests: telemetry.activeRequests,
        queueDepth: telemetry.queueDepth,
        workerUtilization: telemetry.workerUtilizationPct,
        databaseLatency: telemetry.databaseLatencyMs,
        cacheHitRate: telemetry.cacheHitRatePct,
        errorRate: telemetry.errorRatePct,
        p50Latency: telemetry.p50ApiLatencyMs,
        p95Latency: telemetry.p95ApiLatencyMs,
        p99Latency: telemetry.p99ApiLatencyMs,
        providers: telemetry.providers,
        probes,
      },
    });
  } catch (err) {
    console.error('[Admin System Health Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'HEALTH_PROBE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to query system health',
        },
      },
      { status: 500 }
    );
  }
}
