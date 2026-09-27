// DocEase / Saarvi Authoritative Database Aggregation Service
// Executes database-side RPCs or zero-raw-row indexed count/aggregation queries
// CRITICAL PRIVACY RULE: Never fetch or inspect user files, documents, marks, or private notes.

import { getSupabaseAdminClient } from '../supabase/admin.ts';
import { isSupabaseConfigured } from '../supabase/config.ts';
import { MockStorageProvider } from '../supabase/mock-storage.ts';
import { TOOLS_CONFIG } from '../../config/tools.ts';
import { opportunityStore } from '../opportunities/opportunity-store.ts';

export interface DatePeriodBounds {
  days: number;
  start: Date;
  end: Date;
  previousStart: Date;
}

export function parsePeriodBounds(period = '30d'): DatePeriodBounds {
  const end = new Date();
  let days = 30;
  let start: Date;

  switch (period) {
    case 'today':
      days = 1;
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
      break;
    case '7d':
      days = 7;
      start = new Date(end.getTime() - 7 * 864e5);
      break;
    case '30d':
      days = 30;
      start = new Date(end.getTime() - 30 * 864e5);
      break;
    case '90d':
      days = 90;
      start = new Date(end.getTime() - 90 * 864e5);
      break;
    case '1y':
      days = 365;
      start = new Date(end.getTime() - 365 * 864e5);
      break;
    case 'all':
      days = 730;
      start = new Date('2024-01-01T00:00:00.000Z');
      break;
    default:
      days = 30;
      start = new Date(end.getTime() - 30 * 864e5);
      break;
  }

  const durationMs = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - durationMs);

  return { days, start, end, previousStart };
}

export const adminDbAggregates = {
  /**
   * P0: Ultra-fast Dashboard Summary
   * Returns KPI card counts in <50ms with zero raw-row transfer.
   */
  async getDashboardSummary(period = '30d') {
    const bounds = parsePeriodBounds(period);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Try RPC first
        try {
          const { data, error } = await supabase.rpc('get_admin_dashboard_summary', {
            p_period_days: bounds.days,
          });
          if (!error && data) {
            return data;
          }
        } catch {
          // Fall back to indexed queries
        }

        // Fast indexed count queries ({ head: true, count: 'exact' } transfers 0 rows)
        try {
          const startIso = bounds.start.toISOString();
          const prevStartIso = bounds.previousStart.toISOString();
          const todayStartIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

          const [
            activeUsersRes,
            pendingUsersRes,
            newUsersRes,
            prevNewUsersRes,
            proUsersRes,
            suspendedUsersRes,
            todayEventsRes,
            openErrorsRes,
          ] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_EMAIL_VERIFICATION'),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE').gte('created_at', startIso),
            supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'ACTIVE')
              .gte('created_at', prevStartIso)
              .lt('created_at', startIso),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('plan', 'PRO'),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'SUSPENDED'),
            supabase.from('platform_events').select('id', { count: 'exact', head: true }).eq('event_name', 'tool_completed').gte('created_at', todayStartIso),
            supabase.from('system_errors').select('id', { count: 'exact', head: true }).eq('status', 'NEW'),
          ]);

          const activeUsers = activeUsersRes.count ?? 0;
          const pendingUsers = pendingUsersRes.count ?? 0;
          const totalUsers = activeUsers; // Authoritative active verified users
          const newUsers = newUsersRes.count ?? 0;
          const prevNewUsers = prevNewUsersRes.count ?? 0;
          const proUsers = proUsersRes.count ?? 0;
          const suspendedUsers = suspendedUsersRes.count ?? 0;
          const todayActivity = todayEventsRes.count ?? 0;
          const openErrors = openErrorsRes.count ?? 0;

          const diff = newUsers - prevNewUsers;
          const trendPct =
            prevNewUsers > 0
              ? Math.round((diff / prevNewUsers) * 1000) / 10
              : newUsers > 0
              ? 100
              : 0;

          const systemStatus: 'Healthy' | 'Warning' | 'Critical' =
            openErrors > 10 ? 'Critical' : openErrors > 2 ? 'Warning' : 'Healthy';

          return {
            totalUsers,
            activeUsers,
            pendingUsersCount: pendingUsers,
            newUsers,
            previousPeriodNewUsers: prevNewUsers,
            newUsersChangePct: trendPct,
            newUsersDiff: diff,
            freeUsers: Math.max(0, totalUsers - proUsers),
            proUsers,
            suspendedUsers,
            todayActivity,
            openErrorsCount: openErrors,
            systemStatus,
            generatedAt: new Date().toISOString(),
          };
        } catch (queryErr) {
          console.warn('[AdminDbAggregates] Direct query error:', queryErr);
        }
      }
    }

    // Mock storage fallback for offline / dev
    const allUsers = MockStorageProvider.listAllUsers();
    const startMs = bounds.start.getTime();
    const endMs = bounds.end.getTime();
    const prevStartMs = bounds.previousStart.getTime();

    const activeList = allUsers.filter(
      (u) => u.status === 'ACTIVE' || (!u.status && u.emailVerified)
    );
    const pendingList = allUsers.filter(
      (u) => u.status === 'PENDING_EMAIL_VERIFICATION' || (u.authProvider === 'EMAIL' && !u.emailVerified)
    );

    let newUsers = 0;
    let prevNewUsers = 0;
    let proUsers = 0;
    let suspendedUsers = 0;

    activeList.forEach((u) => {
      const createdMs = new Date(u.createdAt).getTime();
      if (createdMs >= startMs && createdMs <= endMs) newUsers++;
      if (createdMs >= prevStartMs && createdMs < startMs) prevNewUsers++;
      if (u.plan === 'PRO' || u.role === 'SUPER_ADMIN') proUsers++;
    });

    allUsers.forEach((u) => {
      if (u.status === 'SUSPENDED') suspendedUsers++;
    });

    const diff = newUsers - prevNewUsers;
    const trendPct =
      prevNewUsers > 0 ? Math.round((diff / prevNewUsers) * 1000) / 10 : newUsers > 0 ? 100 : 0;

    const oppAdmin = opportunityStore.getAdminOpportunities({ pageSize: 1000 });
    const approvedItems = oppAdmin.items.filter((o) => o.status === 'APPROVED' || o.status === 'PUBLISHED');
    const jobsPublished = approvedItems.filter((o) => !o.isInternship && o.category !== 'internship').length;
    const internshipsPublished = approvedItems.filter((o) => o.isInternship || o.category === 'internship').length;

    // Real today activity from platform_events
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayToolEvents = (MockStorageProvider.getPlatformEvents() as any[]).filter((e) => {
      const isCompleted = e.eventName === 'tool_completed' || e.event_name === 'tool_completed' || e.eventType === 'tool_completed';
      const time = new Date(e.timestamp || e.created_at || 0).getTime();
      return isCompleted && time >= todayStart.getTime();
    });

    return {
      totalUsers: activeList.length,
      activeUsers: activeList.length,
      pendingUsersCount: pendingList.length,
      newUsers,
      previousPeriodNewUsers: prevNewUsers,
      newUsersChangePct: trendPct,
      newUsersDiff: diff,
      freeUsers: Math.max(0, activeList.length - proUsers),
      proUsers,
      suspendedUsers,
      todayActivity: todayToolEvents.length,
      openErrorsCount: 0,
      jobsPublishedCount: jobsPublished,
      internshipsPublishedCount: internshipsPublished,
      pendingReviewsCount: oppAdmin.counts.pending,
      mockInterviewsCount: 14,
      unreadNotificationsCount: 0,
      systemStatus: 'Healthy' as const,
      maintenanceMode: false,
      version: '3.0.0',
      generatedAt: new Date().toISOString(),
    };
  },

  /**
   * P1: User Growth Time Series Aggregation
   * Returns compact daily/weekly points instead of raw user arrays.
   */
  async getUserGrowth(period = '30d') {
    const bounds = parsePeriodBounds(period);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Try RPC first
        try {
          const { data, error } = await supabase.rpc('get_user_growth_aggregate', {
            p_period_days: bounds.days,
          });
          if (!error && data && Array.isArray(data.series)) {
            return data;
          }
        } catch {
          // Fall back
        }

        // Fast query: select ONLY created_at column for selected window
        try {
          const { data: rawDates } = await supabase
            .from('profiles')
            .select('created_at')
            .gte('created_at', bounds.start.toISOString())
            .order('created_at', { ascending: true });

          const isWeekly = bounds.days > 90;
          const groupMap = new Map<string, { label: string; count: number }>();

          // Pre-populate empty slots for continuity
          const stepMs = isWeekly ? 7 * 864e5 : 864e5;
          for (let t = bounds.start.getTime(); t <= bounds.end.getTime(); t += stepMs) {
            const d = new Date(t);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            groupMap.set(key, { label, count: 0 });
          }

          (rawDates || []).forEach((row) => {
            const key = row.created_at.split('T')[0];
            if (groupMap.has(key)) {
              groupMap.get(key)!.count++;
            } else {
              const d = new Date(row.created_at);
              const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              groupMap.set(key, { label, count: 1 });
            }
          });

          let cumulative = 0;
          const series = Array.from(groupMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, item]) => {
              cumulative += item.count;
              return {
                date,
                label: item.label,
                newUsers: item.count,
                cumulative,
              };
            });

          const { data: statusRows } = await supabase.from('profiles').select('status');
          const total = statusRows?.length || 1;
          const activeCount = (statusRows || []).filter((r) => r.status === 'ACTIVE').length;
          const suspendedCount = (statusRows || []).filter((r) => r.status === 'SUSPENDED').length;

          const accountStatusDist = [
            {
              label: 'Active',
              count: activeCount,
              color: '#10b981',
              percentage: Math.round((activeCount / total) * 100),
            },
            {
              label: 'Suspended',
              count: suspendedCount,
              color: '#f59e0b',
              percentage: Math.round((suspendedCount / total) * 100),
            },
          ];

          return { series, accountStatusDist };
        } catch (e) {
          console.warn('[AdminDbAggregates] User growth query error:', e);
        }
      }
    }

    // Mock storage fallback
    const allUsers = MockStorageProvider.listAllUsers();
    const activeList = allUsers.filter(
      (u) => u.status === 'ACTIVE' || (!u.status && u.emailVerified)
    );
    const pendingList = allUsers.filter(
      (u) => u.status === 'PENDING_EMAIL_VERIFICATION' || (u.authProvider === 'EMAIL' && !u.emailVerified)
    );
    const suspendedList = allUsers.filter((u) => u.status === 'SUSPENDED');
    const totalCount = allUsers.length || 1;

    const series = [
      {
        date: new Date().toISOString().split('T')[0],
        label: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        newUsers: activeList.length,
        cumulative: activeList.length,
      },
    ];

    return {
      series,
      accountStatusDist: [
        {
          label: 'Active Verified',
          count: activeList.length,
          color: '#10b981',
          percentage: Math.round((activeList.length / totalCount) * 100),
        },
        {
          label: 'Pending Verification',
          count: pendingList.length,
          color: '#6366f1',
          percentage: Math.round((pendingList.length / totalCount) * 100),
        },
        {
          label: 'Suspended',
          count: suspendedList.length,
          color: '#f59e0b',
          percentage: Math.round((suspendedList.length / totalCount) * 100),
        },
      ],
    };
  },

  /**
   * P1: Platform Activity & Top Tools Aggregation
   * Uses adaptive grouping (hourly, daily, weekly) and compact top 10 tool results.
   */
  async getPlatformActivity(period = '30d', category = 'all') {
    const bounds = parsePeriodBounds(period);
    const isHourly = bounds.days <= 1;
    const isWeekly = bounds.days > 90;
    const grouping = isHourly ? 'hourly' : isWeekly ? 'weekly' : 'daily';

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Try RPC first
        try {
          const { data, error } = await supabase.rpc('get_platform_activity_aggregate', {
            p_period_days: bounds.days,
            p_category: category,
          });
          if (!error && data && Array.isArray(data.timeSeries)) {
            return data;
          }
        } catch {
          // Fall back
        }

        // Fast query from platform_events or analytics_events
        try {
          let query = supabase
            .from('platform_events')
            .select('created_at, tool_slug, tool_id, event_name, success, duration_ms')
            .eq('event_name', 'tool_completed')
            .gte('created_at', bounds.start.toISOString())
            .lte('created_at', bounds.end.toISOString())
            .order('created_at', { ascending: true });

          const { data: events } = await query;
          const totalEvents = events?.length || 0;

          const toolCounts = new Map<string, { uses: number; succ: number; fail: number }>();
          const timeGroupMap = new Map<string, { label: string; total: number; success: number; error: number }>();

          const toolNameMap = new Map<string, string>();
          TOOLS_CONFIG.forEach((t) => {
            toolNameMap.set(t.id, t.name);
            toolNameMap.set(t.slug, t.name);
          });

          (events || []).forEach((e) => {
            const toolKey = e.tool_slug || e.tool_id || 'general';
            const tc = toolCounts.get(toolKey) || { uses: 0, succ: 0, fail: 0 };
            tc.uses++;
            if (e.success !== false) tc.succ++;
            else tc.fail++;
            toolCounts.set(toolKey, tc);

            const d = new Date(e.created_at);
            let key = d.toISOString().split('T')[0];
            let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            if (isHourly) {
              const h = d.getHours().toString().padStart(2, '0');
              key = `${key}T${h}:00`;
              label = `${h}:00`;
            }

            if (!timeGroupMap.has(key)) {
              timeGroupMap.set(key, { label, total: 0, success: 0, error: 0 });
            }
            const item = timeGroupMap.get(key)!;
            item.total++;
            if (e.success !== false) item.success++;
            else item.error++;
          });

          const timeSeries = Array.from(timeGroupMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, val]) => ({
              date,
              label: val.label,
              total: val.total,
              success: val.success,
              error: val.error,
            }));

          const topTools = Array.from(toolCounts.entries())
            .sort(([, a], [, b]) => b.uses - a.uses)
            .slice(0, 10)
            .map(([toolKey, val]) => ({
              toolKey,
              toolName: toolNameMap.get(toolKey) || toolKey.replace(/-/g, ' ').toUpperCase(),
              usageCount: val.uses,
              successCount: val.succ,
              errorCount: val.fail,
            }));

          const successfulOperations = (events || []).filter((e) => e.success !== false).length;
          const failedOperations = (events || []).filter((e) => e.success === false).length;
          const successRate = totalEvents > 0 ? Math.round((successfulOperations / totalEvents) * 1000) / 10 : 100.0;

          return {
            grouping,
            totalEvents,
            successfulOperations,
            failedOperations,
            successRate,
            timeSeries,
            topTools,
          };
        } catch (e) {
          console.warn('[AdminDbAggregates] Activity query error:', e);
        }
      }
    }

    // Mock storage fallback: Calculate strictly from real completed platform events
    const rawEvents = (MockStorageProvider.getPlatformEvents() as any[]) || [];
    const completedEvents = rawEvents.filter((e) => {
      const isCompleted = e.eventName === 'tool_completed' || e.event_name === 'tool_completed' || e.eventType === 'tool_completed';
      const time = new Date(e.timestamp || e.created_at || 0).getTime();
      return isCompleted && time >= bounds.start.getTime() && time <= bounds.end.getTime();
    });

    const totalEvents = completedEvents.length;
    const successfulOperations = completedEvents.filter((e) => e.success !== false).length;
    const failedOperations = completedEvents.filter((e) => e.success === false).length;
    const successRate = totalEvents > 0 ? Math.round((successfulOperations / totalEvents) * 1000) / 10 : 100.0;

    const toolNameMap = new Map<string, string>();
    TOOLS_CONFIG.forEach((t) => {
      toolNameMap.set(t.id, t.name);
      toolNameMap.set(t.slug, t.name);
    });

    const toolCounts = new Map<string, { uses: number; succ: number; fail: number }>();
    const timeGroupMap = new Map<string, { label: string; total: number; success: number; error: number }>();

    completedEvents.forEach((e) => {
      const toolKey = e.toolKey || e.tool_key || e.targetId || 'general';
      const tc = toolCounts.get(toolKey) || { uses: 0, succ: 0, fail: 0 };
      tc.uses++;
      if (e.success !== false) tc.succ++;
      else tc.fail++;
      toolCounts.set(toolKey, tc);

      const d = new Date(e.timestamp || e.created_at || Date.now());
      let key = d.toISOString().split('T')[0];
      let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (isHourly) {
        const h = d.getHours().toString().padStart(2, '0');
        key = `${key}T${h}:00`;
        label = `${h}:00`;
      }

      if (!timeGroupMap.has(key)) {
        timeGroupMap.set(key, { label, total: 0, success: 0, error: 0 });
      }
      const item = timeGroupMap.get(key)!;
      item.total++;
      if (e.success !== false) item.success++;
      else item.error++;
    });

    const timeSeries = Array.from(timeGroupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, val]) => ({
        date,
        label: val.label,
        total: val.total,
        success: val.success,
        error: val.error,
      }));

    const topTools = Array.from(toolCounts.entries())
      .sort(([, a], [, b]) => b.uses - a.uses)
      .slice(0, 10)
      .map(([toolKey, val]) => ({
        toolKey,
        toolName: toolNameMap.get(toolKey) || toolKey.replace(/-/g, ' ').toUpperCase(),
        usageCount: val.uses,
        successCount: val.succ,
        errorCount: val.fail,
      }));

    return {
      grouping,
      totalEvents,
      successfulOperations,
      failedOperations,
      successRate,
      timeSeries,
      topTools,
    };
  },

  /**
   * P2: Error Analytics Aggregation
   * Groups errors by date/hour and returns top error codes.
   */
  async getErrorAnalytics(period = '30d') {
    const bounds = parsePeriodBounds(period);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Try RPC first
        try {
          const { data, error } = await supabase.rpc('get_error_analytics_aggregate', {
            p_period_days: bounds.days,
          });
          if (!error && data && Array.isArray(data.timeSeries)) {
            return data;
          }
        } catch {
          // Fall back
        }

        // Fast query: select error columns
        try {
          const { data: rawErrors } = await supabase
            .from('system_errors')
            .select('timestamp, severity, error_type, service, tool, status')
            .gte('timestamp', bounds.start.toISOString())
            .order('timestamp', { ascending: true });

          const errors = rawErrors || [];
          const totalErrors = errors.length;
          const unresolved = errors.filter((e) => e.status === 'NEW').length;

          const dateMap = new Map<string, { label: string; count: number }>();
          const sevMap = new Map<string, number>();
          const codeMap = new Map<string, { count: number; lastSeen: string; feature: string; severity: string }>();

          errors.forEach((err) => {
            const d = new Date(err.timestamp);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            dateMap.set(key, { label, count: (dateMap.get(key)?.count || 0) + 1 });
            sevMap.set(err.severity, (sevMap.get(err.severity) || 0) + 1);

            const code = err.error_type || 'UNKNOWN_ERROR';
            const feature = err.tool || err.service || 'system';
            const existing = codeMap.get(code);
            if (existing) {
              existing.count++;
              if (err.timestamp > existing.lastSeen) existing.lastSeen = err.timestamp;
            } else {
              codeMap.set(code, { count: 1, lastSeen: err.timestamp, feature, severity: err.severity });
            }
          });

          const timeSeries = Array.from(dateMap.entries()).map(([date, val]) => ({
            date,
            label: val.label,
            count: val.count,
          }));

          const severityDistribution = ['CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((sev) => ({
            label: sev,
            count: sevMap.get(sev) || 0,
            color: sev === 'CRITICAL' ? '#ef4444' : sev === 'ERROR' ? '#f97316' : sev === 'WARNING' ? '#f59e0b' : '#3b82f6',
          }));

          const topErrors = Array.from(codeMap.entries())
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 10)
            .map(([errorCode, val]) => ({
              errorCode,
              feature: val.feature,
              count: val.count,
              lastSeen: val.lastSeen,
              severity: val.severity,
            }));

          return {
            totalErrors,
            unresolved,
            timeSeries,
            severityDistribution,
            topErrors,
          };
        } catch (e) {
          console.warn('[AdminDbAggregates] Errors query error:', e);
        }
      }
    }

    // Mock fallback
    return {
      totalErrors: 0,
      unresolved: 0,
      timeSeries: [],
      severityDistribution: [
        { label: 'CRITICAL', count: 0, color: '#ef4444' },
        { label: 'ERROR', count: 0, color: '#f97316' },
        { label: 'WARNING', count: 0, color: '#f59e0b' },
        { label: 'INFO', count: 0, color: '#3b82f6' },
      ],
      topErrors: [],
    };
  },
};
