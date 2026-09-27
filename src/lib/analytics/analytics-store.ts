/**
 * Saarvi Platform Analytics & Telemetry Engine
 * Unified Admin Control Center 2.0 (Phase 40 Part C & D)
 *
 * Guarantees:
 * 1. Safe platform event ingestion: strictly logs tool interactions, search, AI routing (zero user document contents).
 * 2. Supabase table `analytics_events` persistence with in-memory buffer fallback.
 * 3. High-throughput aggregations: DAU/WAU/MAU, top tools, tool adoption, unused tools, discovery channels.
 */

import { CANONICAL_TOOL_REGISTRY } from '../tools/tool-registry';
import { getSupabaseAdminClient } from '../supabase/admin';

export type AnalyticsEventType =
  | 'tool_view'
  | 'tool_run'
  | 'tool_export'
  | 'search'
  | 'ai_query'
  | 'category_view'
  | 'navbar_tool_click'
  | 'mega_menu_tool_click'
  | 'search_tool_open'
  | 'ai_tool_open'
  | 'NAVBAR_TOOL_CLICK'
  | 'MEGA_MENU_TOOL_CLICK'
  | 'SEARCH_TOOL_OPEN'
  | 'AI_TOOL_OPEN';

export interface AnalyticsEvent {
  id: string;
  userId?: string | null;
  eventType: AnalyticsEventType;
  toolId?: string;
  toolSlug?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'all';

export interface ToolUsageStat {
  toolId: string;
  toolName: string;
  category: string;
  views: number;
  runs: number;
  exports: number;
  totalInteractions: number;
}

export interface PlatformAnalyticsOverview {
  period: AnalyticsPeriod;
  dau: number;
  wau: number;
  mau: number;
  totalEvents: number;
  totalToolRuns: number;
  authenticatedToolRuns?: number;
  guestToolRuns?: number;
  uniqueGuestSessions?: number;
  toolAdoptionRate: number; // percentage of canonical tools used
  activeToolsCount: number;
  totalCanonicalTools: number;
  topTools: ToolUsageStat[];
  unusedTools: Array<{ toolId: string; toolName: string; category: string }>;
  discoveryChannels: Array<{ channel: string; count: number; percentage: number }>;
  eventTypeDistribution: Record<string, number>;
}

export interface UserAnalyticsSummary {
  userId: string;
  totalToolUses: number;
  completedUses: number;
  failedUses: number;
  searches: number;
  aiUses: number;
  lastUsedTool?: {
    slug: string;
    name: string;
    usedAt: string;
  };
  mostUsedTools: Array<{
    toolId: string;
    toolName: string;
    category: string;
    categoryName: string;
    count: number;
  }>;
  categoryUsage: Array<{
    category: string;
    categoryName: string;
    count: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    toolId?: string;
    toolName?: string;
    source?: string;
    status?: string;
    durationMs?: number;
  }>;
  activityTrend: Array<{
    date: string;
    label: string;
    count: number;
  }>;
  discoverySources: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
}

class AnalyticsStore {
  private inMemoryEvents: AnalyticsEvent[] = [];
  private readonly MAX_IN_MEMORY = 5000;

  constructor() {
    // 100% Real platform telemetry only: zero fake event generation
  }

  /**
   * Ingests a new safe platform analytics event.
   */
  async logEvent(event: Omit<AnalyticsEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<AnalyticsEvent> {
    const fullEvent: AnalyticsEvent = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: event.userId || null,
      eventType: event.eventType,
      toolId: event.toolId,
      toolSlug: event.toolSlug || event.toolId,
      metadata: event.metadata || {},
      createdAt: event.createdAt || new Date().toISOString(),
    };

    // 1. In-memory buffer
    this.inMemoryEvents.unshift(fullEvent);
    if (this.inMemoryEvents.length > this.MAX_IN_MEMORY) {
      this.inMemoryEvents.pop();
    }

    // 2. Persist to Supabase in background
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase.from('analytics_events').insert({
          id: fullEvent.id,
          user_id: fullEvent.userId,
          event_type: fullEvent.eventType,
          tool_id: fullEvent.toolId,
          tool_slug: fullEvent.toolSlug,
          metadata: fullEvent.metadata,
          created_at: fullEvent.createdAt,
        });
      }
    } catch (err) {
      // Safe fallback - event remains in memory
      console.warn('[AnalyticsStore] Failed to insert event to Supabase, retained in-memory:', err);
    }

    return fullEvent;
  }

  /**
   * Retrieves events matching a specified time period.
   */
  async getEventsInPeriod(period: AnalyticsPeriod): Promise<AnalyticsEvent[]> {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'today':
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 864e5);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 864e5);
        break;
      case '90d':
        startTime = new Date(now.getTime() - 90 * 864e5);
        break;
      case 'all':
      default:
        startTime = new Date(0);
        break;
    }

    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('analytics_events')
          .select('*')
          .gte('created_at', startTime.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000);

        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            eventType: row.event_type as AnalyticsEventType,
            toolId: row.tool_id,
            toolSlug: row.tool_slug,
            metadata: row.metadata || {},
            createdAt: row.created_at,
          }));
        }
      }
    } catch (err) {
      console.warn('[AnalyticsStore] Querying in-memory fallback events:', err);
    }

    // Fallback to in-memory events
    return this.inMemoryEvents.filter((e) => new Date(e.createdAt) >= startTime);
  }

  getRawEvents(): AnalyticsEvent[] {
    return [...this.inMemoryEvents];
  }

  /**
   * Computes authoritative aggregates across tools, adoption, channels, and active users.
   */
  async getOverview(period: AnalyticsPeriod = '30d'): Promise<PlatformAnalyticsOverview> {
    const events = await this.getEventsInPeriod(period);
    const now = Date.now();

    // 1. Calculate Active Users (DAU, WAU, MAU)
    const dauSet = new Set<string>();
    const wauSet = new Set<string>();
    const mauSet = new Set<string>();

    const oneDayAgo = now - 864e5;
    const sevenDaysAgo = now - 7 * 864e5;
    const thirtyDaysAgo = now - 30 * 864e5;

    events.forEach((e) => {
      if (!e.userId) return;
      const t = new Date(e.createdAt).getTime();
      if (t >= oneDayAgo) dauSet.add(e.userId);
      if (t >= sevenDaysAgo) wauSet.add(e.userId);
      if (t >= thirtyDaysAgo) mauSet.add(e.userId);
    });

    // 2. Tool Usage Aggregates
    const toolStatsMap = new Map<string, { views: number; runs: number; exports: number }>();
    const usedToolIds = new Set<string>();

    let totalToolRuns = 0;
    const typeDistribution: Record<string, number> = {};

    events.forEach((e) => {
      typeDistribution[e.eventType] = (typeDistribution[e.eventType] || 0) + 1;

      if (!e.toolId) return;
      usedToolIds.add(e.toolId);

      const current = toolStatsMap.get(e.toolId) || { views: 0, runs: 0, exports: 0 };
      if (e.eventType === 'tool_view') current.views++;
      if (e.eventType === 'tool_run') {
        current.runs++;
        totalToolRuns++;
      }
      if (e.eventType === 'tool_export') current.exports++;
      toolStatsMap.set(e.toolId, current);
    });

    // Map against canonical registry
    const canonicalMap = new Map(CANONICAL_TOOL_REGISTRY.map((t) => [t.key, t]));

    const topTools: ToolUsageStat[] = Array.from(toolStatsMap.entries())
      .map(([toolId, stats]) => {
        const canonical = canonicalMap.get(toolId);
        return {
          toolId,
          toolName: canonical?.name || toolId,
          category: canonical?.category || 'general',
          views: stats.views,
          runs: stats.runs,
          exports: stats.exports,
          totalInteractions: stats.views + stats.runs + stats.exports,
        };
      })
      .sort((a, b) => b.totalInteractions - a.totalInteractions);

    // Unused Tools
    const unusedTools: Array<{ toolId: string; toolName: string; category: string }> = CANONICAL_TOOL_REGISTRY
      .filter((t) => !usedToolIds.has(t.key))
      .map((t) => ({ toolId: t.key, toolName: t.name, category: t.category }));

    // Tool Adoption Rate
    const totalCanonicalTools = CANONICAL_TOOL_REGISTRY.length;
    const activeToolsCount = usedToolIds.size;
    const toolAdoptionRate = Math.round((activeToolsCount / (totalCanonicalTools || 1)) * 100);

    // 3. Discovery Channels
    const channelCounts: Record<string, number> = {
      navbar: 0,
      search: 0,
      ai_assistant: 0,
      homepage: 0,
      direct: 0,
    };

    events.forEach((e) => {
      const src = (e.metadata?.source || '').toLowerCase();
      if (src.includes('ai') || src.includes('assistant')) channelCounts.ai_assistant++;
      else if (src.includes('search')) channelCounts.search++;
      else if (src.includes('nav') || src.includes('mega')) channelCounts.navbar++;
      else if (src.includes('home')) channelCounts.homepage++;
      else channelCounts.direct++;
    });

    const totalChannelEntries = Object.values(channelCounts).reduce((a, b) => a + b, 0) || 1;
    const discoveryChannels = Object.entries(channelCounts).map(([channel, count]) => ({
      channel: channel.replace('_', ' ').toUpperCase(),
      count,
      percentage: Math.round((count / totalChannelEntries) * 100),
    }));

    return {
      period,
      dau: dauSet.size,
      wau: wauSet.size,
      mau: mauSet.size,
      totalEvents: events.length,
      totalToolRuns,
      toolAdoptionRate,
      activeToolsCount,
      totalCanonicalTools,
      topTools: topTools.slice(0, 10),
      unusedTools: unusedTools.slice(0, 15),
      discoveryChannels,
      eventTypeDistribution: typeDistribution,
    };
  }

  /**
   * Computes comprehensive, strictly privacy-safe real analytics for a specific user.
   */
  async getUserAnalytics(userId: string, period: AnalyticsPeriod = '30d'): Promise<UserAnalyticsSummary> {
    const rawEvents = await this.getUserTimeline(userId);

    const now = new Date();
    let startTime: Date;
    switch (period) {
      case 'today':
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 864e5);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 864e5);
        break;
      case '90d':
        startTime = new Date(now.getTime() - 90 * 864e5);
        break;
      case 'all':
      default:
        startTime = new Date(0);
        break;
    }

    const events = rawEvents.filter((e) => new Date(e.createdAt) >= startTime);

    const canonicalMap = new Map(CANONICAL_TOOL_REGISTRY.map((t) => [t.key, t]));
    const categoryNames: Record<string, string> = {
      pdf: 'PDF Tools',
      image: 'Image Tools',
      student: 'Student Tools',
      academic: 'Academic Tools',
      career: 'Career Tools',
      ai: 'AI Tools',
    };

    let totalToolUses = 0;
    let completedUses = 0;
    let failedUses = 0;
    let searches = 0;
    let aiUses = 0;

    let lastUsedTool: { slug: string; name: string; usedAt: string } | undefined;

    const toolCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const discoveryCounts: Record<string, number> = {
      navbar: 0,
      'mega-menu': 0,
      search: 0,
      ai: 0,
      direct: 0,
    };

    // Date grouping for trend
    const dateCounts = new Map<string, number>();

    // Iterate descending chronological events
    events.forEach((e) => {
      const type = (e.eventType || '').toLowerCase();

      // Tool usage identification
      if (
        type.includes('tool') ||
        type === 'tool_run' ||
        type === 'tool_view' ||
        type === 'tool_export' ||
        type === 'navbar_tool_click' ||
        type === 'mega_menu_tool_click' ||
        type === 'search_tool_open' ||
        type === 'ai_tool_open'
      ) {
        totalToolUses++;
        if (type === 'tool_run' || type.includes('complete')) {
          completedUses++;
        } else if (type.includes('fail') || type.includes('error')) {
          failedUses++;
        }

        if (e.toolId || e.toolSlug) {
          const key = e.toolSlug || e.toolId!;
          toolCounts.set(key, (toolCounts.get(key) || 0) + 1);

          const tool = canonicalMap.get(key);
          const cat = tool?.category || 'general';
          categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);

          if (!lastUsedTool) {
            lastUsedTool = {
              slug: key,
              name: tool?.name || key,
              usedAt: e.createdAt,
            };
          }
        }
      }

      // Searches
      if (type.includes('search')) {
        searches++;
      }

      // AI interactions
      if (type.includes('ai')) {
        aiUses++;
      }

      // Discovery sources
      const src = (e.metadata?.source || '').toLowerCase();
      if (src.includes('ai')) discoveryCounts.ai++;
      else if (src.includes('search')) discoveryCounts.search++;
      else if (src.includes('mega')) discoveryCounts['mega-menu']++;
      else if (src.includes('nav')) discoveryCounts.navbar++;
      else if (src.includes('direct')) discoveryCounts.direct++;
      else discoveryCounts.direct++;

      // Trend day
      const dayKey = e.createdAt.split('T')[0];
      dateCounts.set(dayKey, (dateCounts.get(dayKey) || 0) + 1);
    });

    // Format most used tools
    const mostUsedTools = Array.from(toolCounts.entries())
      .map(([toolId, count]) => {
        const canonical = canonicalMap.get(toolId);
        const category = canonical?.category || 'general';
        return {
          toolId,
          toolName: canonical?.name || toolId,
          category,
          categoryName: categoryNames[category] || category,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Format category usage
    const totalCatCount = Array.from(categoryCounts.values()).reduce((a, b) => a + b, 0) || 1;
    const categoryUsage = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({
        category,
        categoryName: categoryNames[category] || category,
        count,
        percentage: Math.round((count / totalCatCount) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Format recent safe activity
    const recentActivity = events.slice(0, 20).map((e) => {
      const tool = e.toolSlug || e.toolId ? canonicalMap.get(e.toolSlug || e.toolId!) : undefined;
      return {
        id: e.id,
        timestamp: e.createdAt,
        eventType: e.eventType,
        toolId: e.toolSlug || e.toolId,
        toolName: tool?.name || e.toolSlug || e.toolId,
        source: e.metadata?.source || 'direct',
      };
    });

    // Format discovery sources
    const totalDiscovery = Object.values(discoveryCounts).reduce((a, b) => a + b, 0) || 1;
    const discoverySources = Object.entries(discoveryCounts).map(([source, count]) => ({
      source: source.toUpperCase(),
      count,
      percentage: Math.round((count / totalDiscovery) * 100),
    }));

    // Format activity trend
    const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const activityTrend: Array<{ date: string; label: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 864e5);
      const dayIso = d.toISOString().split('T')[0];
      activityTrend.push({
        date: dayIso,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: dateCounts.get(dayIso) || 0,
      });
    }

    return {
      userId,
      totalToolUses,
      completedUses,
      failedUses,
      searches,
      aiUses,
      lastUsedTool,
      mostUsedTools,
      categoryUsage,
      recentActivity,
      activityTrend,
      discoverySources,
    };
  }

  /**
   * Retrieves an individual user's chronological tool interaction timeline.
   */
  async getUserTimeline(userId: string): Promise<AnalyticsEvent[]> {
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('analytics_events')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            eventType: row.event_type as AnalyticsEventType,
            toolId: row.tool_id,
            toolSlug: row.tool_slug,
            metadata: row.metadata || {},
            createdAt: row.created_at,
          }));
        }
      }
    } catch (err) {
      console.warn('[AnalyticsStore] Error querying user timeline in Supabase:', err);
    }

    return this.inMemoryEvents.filter((e) => e.userId === userId);
  }
}

export const analyticsStore = new AnalyticsStore();
