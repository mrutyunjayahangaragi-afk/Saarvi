import { NextResponse } from 'next/server';
import { analyticsStore, AnalyticsPeriod } from '@/lib/analytics/analytics-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { adminAnalyticsService } from '@/lib/services/adminAnalyticsService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/overview?period=30d
 * Returns authoritative real user metrics (Total, Active, Free, Pro, New),
 * trend comparisons, tool adoption, top tools, unused tools, and discovery channels.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as AnalyticsPeriod) || '30d';

    // 1. Tool, adoption, and platform events aggregation
    const storeOverview = await analyticsStore.getOverview(period);

    // 2. Real User Counts from Supabase or Fallback
    let totalUsers = 0;
    let newUsers = 0;
    let previousNewUsers = 0;
    let activeUsers = 0;
    let freeUsers = 0;
    let proUsers = 0;
    let suspendedUsers = 0;

    const boundaries = adminAnalyticsService.getDateRangeBoundaries(period as any);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Auth users
        const { data: authData } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const users = authData?.users || [];
        totalUsers = users.length;

        // Subscriptions
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('status', 'active');
        const proUserIds = new Set((subs || []).map((s) => s.user_id));
        proUsers = proUserIds.size;
        freeUsers = Math.max(0, totalUsers - proUsers);

        // New Users in window & previous window
        const currentStartMs = boundaries.currentStart.getTime();
        const currentEndMs = boundaries.currentEnd.getTime();
        const previousStartMs = boundaries.previousStart.getTime();

        newUsers = users.filter((u) => {
          const created = new Date(u.created_at).getTime();
          return created >= currentStartMs && created <= currentEndMs;
        }).length;

        previousNewUsers = users.filter((u) => {
          const created = new Date(u.created_at).getTime();
          return created >= previousStartMs && created < currentStartMs;
        }).length;

        // Suspended users
        const now = new Date();
        suspendedUsers = users.filter(
          (u) =>
            (u.banned_until && new Date(u.banned_until) > now) ||
            u.user_metadata?.status === 'SUSPENDED'
        ).length;

        // Active users (last_sign_in_at in window OR telemetry events in window)
        const activeUserIds = new Set<string>();
        users.forEach((u) => {
          if (u.last_sign_in_at) {
            const loginTime = new Date(u.last_sign_in_at).getTime();
            if (loginTime >= currentStartMs && loginTime <= currentEndMs) {
              activeUserIds.add(u.id);
            }
          }
        });

        // Also check analytics events in period
        try {
          const { data: events } = await supabase
            .from('analytics_events')
            .select('user_id, created_at')
            .gte('created_at', boundaries.currentStart.toISOString())
            .lte('created_at', boundaries.currentEnd.toISOString());
          (events || []).forEach((e) => {
            if (e.user_id) activeUserIds.add(e.user_id);
          });
        } catch {
          // Fallback to in-memory events
          const rawEvents = analyticsStore.getRawEvents();
          rawEvents.forEach((e: any) => {
            if (e.userId) {
              const eventTime = new Date(e.createdAt).getTime();
              if (eventTime >= currentStartMs && eventTime <= currentEndMs) {
                activeUserIds.add(e.userId);
              }
            }
          });
        }

        activeUsers = activeUserIds.size;
      }
    } else {
      // Mock Storage Fallback for offline environments
      const storedUsers = MockStorageProvider.listAllUsers();
      totalUsers = storedUsers.length;
      const currentStartMs = boundaries.currentStart.getTime();
      const currentEndMs = boundaries.currentEnd.getTime();
      const previousStartMs = boundaries.previousStart.getTime();

      newUsers = storedUsers.filter((u) => {
        const created = new Date(u.createdAt).getTime();
        return created >= currentStartMs && created <= currentEndMs;
      }).length;

      previousNewUsers = storedUsers.filter((u) => {
        const created = new Date(u.createdAt).getTime();
        return created >= previousStartMs && created < currentStartMs;
      }).length;

      activeUsers = storedUsers.filter((u) => {
        if (!u.lastSignInAt) return false;
        const loginTime = new Date(u.lastSignInAt).getTime();
        return loginTime >= currentStartMs && loginTime <= currentEndMs;
      }).length;

      proUsers = storedUsers.filter((u) => u.plan === 'PRO' || u.role === 'SUPER_ADMIN').length;
      freeUsers = Math.max(0, totalUsers - proUsers);
      suspendedUsers = storedUsers.filter((u) => u.status === 'SUSPENDED').length;
    }

    const trend = adminAnalyticsService.calculateTrend(newUsers, previousNewUsers);

    return NextResponse.json({
      success: true,
      period,
      userMetrics: {
        totalUsers,
        newUsers,
        previousNewUsers,
        trend,
        activeUsers,
        freeUsers,
        proUsers,
        suspendedUsers,
      },
      overview: storeOverview,
    });
  } catch (error: any) {
    console.error('[Admin Analytics Overview API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate overview' }, { status: 500 });
  }
}
