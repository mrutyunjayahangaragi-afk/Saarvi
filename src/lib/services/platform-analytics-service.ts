import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { TOOLS_CONFIG } from '@/config/tools';
import { CANONICAL_TOOL_REGISTRY, normalizeToolKey, getCanonicalToolByKey } from '@/lib/tools/tool-registry';

export interface DateRangeBoundaries {
  start: Date;
  end: Date;
  previousStart: Date;
}

export interface ProductionAnalyticsMetrics {
  period: string;
  totalUsers: number;
  newUsers: number;
  previousNewUsers: number;
  userGrowthPercent: number;
  activeUsers: number;
  dau: number;
  wau: number;
  mau: number;
  proUsers: number;
  freeUsers: number;
  suspendedUsers: number;
  totalConversions: number;
  completedConversions: number;
  failedConversions: number;
  conversionSuccessRate: number;
  totalInterviewSessions: number;
  averageInterviewScore: number | null;
  totalNotificationsSent: number;
  totalRevenueInr: number;
  pendingPaymentRequests: number;
  authenticatedToolRuns: number;
  guestToolRuns: number;
  uniqueGuestSessions: number;
  topTools: Array<{ toolId: string; toolName: string; count: number; category: string }>;
  categoryDistribution: Array<{ category: string; count: number; percentage: number }>;
  discoveryChannels: Array<{ channel: string; count: number; percentage: number }>;
  userGrowthTrend: Array<{ date: string; label: string; count: number }>;
  conversionTrend: Array<{ date: string; label: string; count: number }>;
}

export class PlatformAnalyticsService {
  /**
   * Resolves boundary dates for analytics periods
   */
  public static getBoundaries(period: string): DateRangeBoundaries {
    const end = new Date();
    let start: Date;
    let previousStart: Date;

    const msPerDay = 86400000;
    switch (period) {
      case 'today': {
        start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
        previousStart = new Date(start.getTime() - msPerDay);
        break;
      }
      case '7d': {
        start = new Date(end.getTime() - 7 * msPerDay);
        previousStart = new Date(end.getTime() - 14 * msPerDay);
        break;
      }
      case '30d': {
        start = new Date(end.getTime() - 30 * msPerDay);
        previousStart = new Date(end.getTime() - 60 * msPerDay);
        break;
      }
      case '90d': {
        start = new Date(end.getTime() - 90 * msPerDay);
        previousStart = new Date(end.getTime() - 180 * msPerDay);
        break;
      }
      case 'all':
      default: {
        start = new Date(0);
        previousStart = new Date(0);
        break;
      }
    }

    return { start, end, previousStart };
  }

  /**
   * Authoritative production analytics query engine.
   * Aggregates real data across auth.users, conversion_history, analytics_events,
   * notifications, interview_sessions, and subscriptions.
   * NEVER generates simulated or fake events.
   */
  public static async getComprehensiveAnalytics(period = '30d'): Promise<ProductionAnalyticsMetrics> {
    const boundaries = this.getBoundaries(period);
    const startMs = boundaries.start.getTime();
    const endMs = boundaries.end.getTime();
    const prevStartMs = boundaries.previousStart.getTime();

    let totalUsers = 0;
    let newUsers = 0;
    let previousNewUsers = 0;
    let proUsers = 0;
    let suspendedUsers = 0;

    let dau = 0;
    let wau = 0;
    let mau = 0;

    const activeUserIdsInPeriod = new Set<string>();
    const dauSet = new Set<string>();
    const wauSet = new Set<string>();
    const mauSet = new Set<string>();

    const nowMs = Date.now();
    const oneDayAgoMs = nowMs - 864e5;
    const sevenDaysAgoMs = nowMs - 7 * 864e5;
    const thirtyDaysAgoMs = nowMs - 30 * 864e5;

    let conversions: any[] = [];
    let interviews: any[] = [];
    let analyticsEvents: any[] = [];
    let platformEvents: any[] = [];
    let notificationsCount = 0;
    let totalRevenueInr = 0;
    let pendingPaymentRequests = 0;
    const canonicalMap = new Map<string, { name: string; category: string }>();
    TOOLS_CONFIG.forEach((t) => {
      canonicalMap.set(t.id, { name: t.name, category: t.category });
      canonicalMap.set(t.slug, { name: t.name, category: t.category });
    });

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // 1. Auth Users
        try {
          const { data: authData } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          const users = authData?.users || [];
          totalUsers = users.length;

          users.forEach((u) => {
            const createdMs = new Date(u.created_at).getTime();
            if (createdMs >= startMs && createdMs <= endMs) newUsers++;
            if (createdMs >= prevStartMs && createdMs < startMs) previousNewUsers++;

            if (
              (u.banned_until && new Date(u.banned_until) > new Date()) ||
              u.user_metadata?.status === 'SUSPENDED'
            ) {
              suspendedUsers++;
            }

            if (u.last_sign_in_at) {
              const signinMs = new Date(u.last_sign_in_at).getTime();
              if (signinMs >= startMs && signinMs <= endMs) {
                activeUserIdsInPeriod.add(u.id);
              }
              if (signinMs >= oneDayAgoMs) dauSet.add(u.id);
              if (signinMs >= sevenDaysAgoMs) wauSet.add(u.id);
              if (signinMs >= thirtyDaysAgoMs) mauSet.add(u.id);
            }
          });
        } catch (authErr) {
          console.warn('[PlatformAnalytics] Auth users error:', authErr);
        }

        // 2. Subscriptions
        try {
          const { data: activeSubs } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('status', 'active');
          proUsers = (activeSubs || []).length;

          // Revenue & payment requests
          const { data: payRequests } = await supabase
            .from('subscription_requests')
            .select('amount, status');

          (payRequests || []).forEach((r) => {
            if (r.status === 'APPROVED' && typeof r.amount === 'number') {
              totalRevenueInr += r.amount;
            } else if (r.status === 'PENDING') {
              pendingPaymentRequests++;
            }
          });
        } catch (subErr) {
          console.warn('[PlatformAnalytics] Subscriptions error:', subErr);
        }

        // 3. Conversion History
        try {
          const { data: convData } = await supabase
            .from('conversion_history')
            .select('*')
            .gte('created_at', boundaries.start.toISOString())
            .lte('created_at', boundaries.end.toISOString())
            .order('created_at', { ascending: false });
          conversions = convData || [];

          conversions.forEach((c) => {
            if (c.user_id) {
              activeUserIdsInPeriod.add(c.user_id);
              const cMs = new Date(c.created_at).getTime();
              if (cMs >= oneDayAgoMs) dauSet.add(c.user_id);
              if (cMs >= sevenDaysAgoMs) wauSet.add(c.user_id);
              if (cMs >= thirtyDaysAgoMs) mauSet.add(c.user_id);
            }
          });
        } catch (cErr) {
          console.warn('[PlatformAnalytics] Conversions error:', cErr);
        }

        // 4. Analytics Events
        try {
          const { data: evtData } = await supabase
            .from('analytics_events')
            .select('*')
            .gte('created_at', boundaries.start.toISOString())
            .lte('created_at', boundaries.end.toISOString())
            .order('created_at', { ascending: false });
          analyticsEvents = evtData || [];

          analyticsEvents.forEach((e) => {
            if (e.user_id) {
              activeUserIdsInPeriod.add(e.user_id);
              const eMs = new Date(e.created_at).getTime();
              if (eMs >= oneDayAgoMs) dauSet.add(e.user_id);
              if (eMs >= sevenDaysAgoMs) wauSet.add(e.user_id);
              if (eMs >= thirtyDaysAgoMs) mauSet.add(e.user_id);
            }
          });
        } catch (eErr) {
          console.warn('[PlatformAnalytics] Events error:', eErr);
        }

        // 5. Mock Interviews
        try {
          const { data: intData } = await supabase
            .from('interview_sessions')
            .select('*')
            .gte('created_at', boundaries.start.toISOString())
            .lte('created_at', boundaries.end.toISOString());
          interviews = intData || [];
        } catch (iErr) {
          console.warn('[PlatformAnalytics] Interviews error:', iErr);
        }

        // 6. Notifications
        try {
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'SENT');
          notificationsCount = count || 0;
        } catch (nErr) {
          console.warn('[PlatformAnalytics] Notifications count error:', nErr);
        }

        // 7. Canonical Platform Events
        try {
          const { data: peData } = await supabase
            .from('platform_events')
            .select('*')
            .gte('created_at', boundaries.start.toISOString())
            .lte('created_at', boundaries.end.toISOString())
            .order('created_at', { ascending: false });
          platformEvents = peData || [];
        } catch (peErr) {
          console.warn('[PlatformAnalytics] Platform events error:', peErr);
        }
      }
    } else {
      // Mock storage fallback for tests
      const allUsers = MockStorageProvider.listAllUsers();
      totalUsers = allUsers.length;
      allUsers.forEach((u) => {
        const createdMs = new Date(u.createdAt).getTime();
        if (createdMs >= startMs && createdMs <= endMs) newUsers++;
        if (createdMs >= prevStartMs && createdMs < startMs) previousNewUsers++;
        if (u.status === 'SUSPENDED') suspendedUsers++;
        if (u.plan === 'PRO' || u.role === 'SUPER_ADMIN') proUsers++;
      });

      const peData = MockStorageProvider.getPlatformEvents();
      platformEvents = peData.filter((e: any) => {
        const t = new Date(e.createdAt || e.created_at).getTime();
        return t >= startMs && t <= endMs;
      });
    }

    // Process platform_events for active users, guests, and authenticated telemetry
    const guestSessionSet = new Set<string>();
    let authenticatedToolRuns = 0;
    let guestToolRuns = 0;

    platformEvents.forEach((pe: any) => {
      const uid = pe.user_id || pe.userId;
      const guestId = pe.guest_session_id || pe.guestSessionId;
      const userType = pe.user_type || pe.userType || (uid ? 'authenticated' : 'guest');
      const createdAt = pe.created_at || pe.createdAt;
      const peMs = new Date(createdAt).getTime();

      if (uid) {
        activeUserIdsInPeriod.add(uid);
        if (peMs >= oneDayAgoMs) dauSet.add(uid);
        if (peMs >= sevenDaysAgoMs) wauSet.add(uid);
        if (peMs >= thirtyDaysAgoMs) mauSet.add(uid);
      }

      const eventName = pe.event_name || pe.eventName;
      const isToolEvent = eventName === 'tool_completed' || eventName === 'tool_started' || eventName === 'tool_error';
      if (isToolEvent) {
        if (userType === 'authenticated' || uid) {
          authenticatedToolRuns++;
        } else {
          guestToolRuns++;
          if (guestId) {
            guestSessionSet.add(guestId);
          }
        }
      }
    });

    dau = dauSet.size;
    wau = wauSet.size;
    mau = mauSet.size;
    const activeUsers = Math.max(activeUserIdsInPeriod.size, dau);
    const freeUsers = Math.max(0, totalUsers - proUsers);

    // User growth trend
    let userGrowthPercent = 0;
    if (previousNewUsers > 0) {
      userGrowthPercent = Math.round(((newUsers - previousNewUsers) / previousNewUsers) * 100);
    } else if (newUsers > 0) {
      userGrowthPercent = 100;
    }

    // Tool counts combining canonical platform_events & legacy conversion_history & analytics_events
    const toolRunMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();

    let completedConversions = 0;
    let failedConversions = 0;

    // 1. Process canonical platform_events first
    platformEvents.forEach((pe: any) => {
      const eventName = pe.event_name || pe.eventName;
      const rawKey = pe.tool_key || pe.toolKey || pe.metadata?.tool_key;
      if (!rawKey) return;

      const toolKey = normalizeToolKey(rawKey);
      const isCompleted = eventName === 'tool_completed';
      const isError = eventName === 'tool_error' || pe.success === false;

      if (isCompleted || isError) {
        toolRunMap.set(toolKey, (toolRunMap.get(toolKey) || 0) + 1);

        const canonical = getCanonicalToolByKey(toolKey) || canonicalMap.get(rawKey);
        const cat = canonical?.category || 'general';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);

        if (isError) {
          failedConversions++;
        } else {
          completedConversions++;
        }
      }
    });

    // 2. Process legacy conversions without double-counting operations already present in platform_events
    const peOperationIds = new Set(
      platformEvents.map((pe: any) => pe.operation_id || pe.operationId).filter(Boolean)
    );

    conversions.forEach((c) => {
      if (c.id && peOperationIds.has(c.id)) return;
      if (c.operation_id && peOperationIds.has(c.operation_id)) return;

      const rawKey = c.tool_type || c.tool_id || 'conversion';
      const toolKey = normalizeToolKey(rawKey);
      toolRunMap.set(toolKey, (toolRunMap.get(toolKey) || 0) + 1);

      const canonical = getCanonicalToolByKey(toolKey) || canonicalMap.get(rawKey);
      const cat = canonical?.category || 'pdf';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);

      if (c.status === 'completed') completedConversions++;
      else if (c.status === 'failed' || c.status === 'error') failedConversions++;
      else completedConversions++;
    });

    // 3. Process legacy analytics_events if not already captured
    analyticsEvents.forEach((e) => {
      const key = e.tool_slug || e.tool_id;
      if (key) {
        const toolKey = normalizeToolKey(key);
        if (!toolRunMap.has(toolKey)) {
          toolRunMap.set(toolKey, (toolRunMap.get(toolKey) || 0) + 1);
          const canonical = getCanonicalToolByKey(toolKey) || canonicalMap.get(key);
          const cat = canonical?.category || 'general';
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
        }
      }
    });

    const totalConversions = completedConversions + failedConversions;
    const conversionSuccessRate =
      totalConversions > 0 ? Math.round((completedConversions / totalConversions) * 100) : 100;

    // Interview metrics
    const totalInterviewSessions = interviews.length;
    let totalScore = 0;
    let scoredCount = 0;
    interviews.forEach((intv) => {
      const s = intv.score ?? intv.overall_score;
      if (typeof s === 'number') {
        totalScore += s;
        scoredCount++;
      }
    });
    const averageInterviewScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : null;

    // Top Tools List
    const topTools = Array.from(toolRunMap.entries())
      .map(([toolId, count]) => {
        const canonical = getCanonicalToolByKey(toolId) || canonicalMap.get(toolId);
        return {
          toolId,
          toolName: canonical?.name || toolId,
          count,
          category: canonical?.category || 'general',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Category Distribution
    const totalCategorized = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
    const categoryDistribution = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category: category.toUpperCase(),
        count,
        percentage: totalCategorized > 0 ? Math.round((count / totalCategorized) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Discovery Channels
    const channelMap: Record<string, number> = {
      navbar: 0,
      mega_menu: 0,
      quick_search: 0,
      direct: 0,
    };

    analyticsEvents.forEach((e) => {
      const source = (e.metadata?.source || '').toLowerCase();
      if (source.includes('navbar')) channelMap.navbar++;
      else if (source.includes('mega')) channelMap.mega_menu++;
      else if (source.includes('search')) channelMap.quick_search++;
      else channelMap.direct++;
    });

    const totalChannels = Object.values(channelMap).reduce((a, b) => a + b, 0);
    const discoveryChannels = Object.entries(channelMap).map(([channel, count]) => ({
      channel: channel.replace('_', ' ').toUpperCase(),
      count,
      percentage: totalChannels > 0 ? Math.round((count / totalChannels) * 100) : 0,
    }));

    // Trends: User Growth Trend & Conversion Trend
    const userTrendMap = new Map<string, number>();
    const convTrendMap = new Map<string, number>();

    const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(nowMs - i * 864e5);
      const key = d.toISOString().split('T')[0];
      userTrendMap.set(key, 0);
      convTrendMap.set(key, 0);
    }

    platformEvents.forEach((pe: any) => {
      const eventName = pe.event_name || pe.eventName;
      if (eventName === 'tool_completed') {
        const key = (pe.created_at || pe.createdAt || '').split('T')[0];
        if (convTrendMap.has(key)) {
          convTrendMap.set(key, (convTrendMap.get(key) || 0) + 1);
        }
      }
    });

    conversions.forEach((c) => {
      if (c.id && peOperationIds.has(c.id)) return;
      if (c.operation_id && peOperationIds.has(c.operation_id)) return;
      const key = (c.created_at || '').split('T')[0];
      if (convTrendMap.has(key)) {
        convTrendMap.set(key, (convTrendMap.get(key) || 0) + 1);
      }
    });

    const userGrowthTrend = Array.from(userTrendMap.entries()).map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count,
    }));

    const conversionTrend = Array.from(convTrendMap.entries()).map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count,
    }));

    return {
      period,
      totalUsers,
      newUsers,
      previousNewUsers,
      userGrowthPercent,
      activeUsers,
      dau,
      wau,
      mau,
      proUsers,
      freeUsers,
      suspendedUsers,
      totalConversions,
      completedConversions,
      failedConversions,
      conversionSuccessRate,
      totalInterviewSessions,
      averageInterviewScore,
      totalNotificationsSent: notificationsCount,
      totalRevenueInr,
      pendingPaymentRequests,
      authenticatedToolRuns,
      guestToolRuns,
      uniqueGuestSessions: guestSessionSet.size,
      topTools,
      categoryDistribution,
      discoveryChannels,
      userGrowthTrend,
      conversionTrend,
    };
  }
}
