/**
 * Saarvi Smart Navbar Tool Discovery Service
 * Authoritative, Data-Driven Navigation Ranking & Snapshot Engine
 *
 * Core Principles:
 * 1. REAL TOOL COMPLETIONS ONLY: Uses `tool_completed` events with `success = true`.
 *    Never counts page views, hover events, or failed attempts.
 * 2. DETERMINISTIC MULTI-STAGE RANKING:
 *    Stage 1: Admin Featured tools (clearly labeled "Featured", not "Most Used").
 *    Stage 2: Real successful usage count DESC within configurable time window (7d, 30d, 90d; default 30d).
 *    Stage 3: Admin sort order / position.
 *    Stage 4: Stable alphabetical tool key.
 * 3. CATEGORY ISOLATION: PDF tools compete only with PDF tools; Image tools only with Images;
 *    Student tools only with Student tools.
 * 4. ACCESS CONTROL RESPECTED: Guest, Free, Pro, Beta badges strictly derived from Tool Control Center.
 * 5. HIGH PERFORMANCE: Fast in-memory cached navigation snapshot (10-minute TTL) with immediate
 *    cache invalidation on Admin mutations. Zero DB calls on hover!
 */

import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_MAP,
  CanonicalTool,
  CanonicalToolCategory,
  getCanonicalToolByKey,
  normalizeToolKey,
} from '../tools/tool-registry.ts';
import { navigationStore, NavigationConfigItem } from './navigation-store.ts';
import { toolAccessService } from '../tools/tool-access-service.ts';
import { featureServerStore } from '../features/feature-store.ts';

export type UsageWindowPeriod = '7d' | '30d' | '90d';

export interface SmartNavToolItem {
  key: string;
  name: string;
  description: string;
  category: CanonicalToolCategory;
  route: string;
  icon: string;
  position: number;
  isFeatured: boolean;
  isMostUsed: boolean;
  badge: string | null;
  successfulUses: number;
  uniqueUsers: number;
  guestAllowed: boolean;
  freeAllowed: boolean;
  requiresPro: boolean;
  isBeta: boolean;
  status: string;
  isEnabled: boolean;
}

export interface SmartNavCategory {
  id: string;
  label: string;
  route: string;
  position: number;
  topTools: SmartNavToolItem[];
  allTools: SmartNavToolItem[];
  totalVisibleCount: number;
}

export interface SmartNavigationSnapshot {
  windowDays: number;
  windowPeriod: UsageWindowPeriod;
  timestamp: string;
  categories: SmartNavCategory[];
  globalTools: {
    pdf: SmartNavToolItem[];
    images: SmartNavToolItem[];
    student: SmartNavToolItem[];
    career: SmartNavToolItem[];
    ai: SmartNavToolItem[];
  };
}

class ToolDiscoveryService {
  private static instance: ToolDiscoveryService;
  private cache: SmartNavigationSnapshot | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes default TTL
  private defaultWindowDays = 30;

  public static getInstance(): ToolDiscoveryService {
    if (!ToolDiscoveryService.instance) {
      ToolDiscoveryService.instance = new ToolDiscoveryService();
    }
    return ToolDiscoveryService.instance;
  }

  /**
   * Immediately invalidates the cached navigation snapshot.
   * Call whenever an admin modifies tool visibility, featured status, order, or feature flags.
   */
  public invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  /**
   * Sets the authoritative admin-configurable usage window.
   */
  public setDefaultWindow(window: UsageWindowPeriod | number): void {
    if (typeof window === 'number') {
      this.defaultWindowDays = window;
    } else if (window === '7d') {
      this.defaultWindowDays = 7;
    } else if (window === '90d') {
      this.defaultWindowDays = 90;
    } else {
      this.defaultWindowDays = 30;
    }
    this.invalidateCache();
  }

  public getDefaultWindowDays(): number {
    return this.defaultWindowDays;
  }

  /**
   * Resolves window days from query string or period string.
   */
  public parseWindowPeriod(period?: string | null): { days: number; period: UsageWindowPeriod } {
    if (!period) {
      return {
        days: this.defaultWindowDays,
        period: (this.defaultWindowDays === 7 ? '7d' : this.defaultWindowDays === 90 ? '90d' : '30d') as UsageWindowPeriod,
      };
    }
    const clean = period.toLowerCase().trim();
    if (clean === '7d' || clean === '7') return { days: 7, period: '7d' };
    if (clean === '90d' || clean === '90') return { days: 90, period: '90d' };
    return { days: 30, period: '30d' };
  }

  /**
   * Computes or returns the cached smart navigation snapshot.
   * Zero DB overhead on cache hit.
   */
  public async getNavigationSnapshot(options?: {
    windowDays?: number;
    forceRefresh?: boolean;
    maxToolsPerCategory?: number;
  }): Promise<SmartNavigationSnapshot> {
    const days = options?.windowDays ?? this.defaultWindowDays;
    const maxPerCategory = options?.maxToolsPerCategory ?? 6;
    const now = Date.now();

    // Check valid in-memory cache if not forcing refresh
    if (!options?.forceRefresh && this.cache && now < this.cacheExpiresAt && this.cache.windowDays === days) {
      return this.cache;
    }

    // 1. Fetch real operational telemetry aggregated from platform_events (success = true only)
    const telemetryMetrics = await toolAccessService.getAggregatedTelemetry(days, Boolean(options?.forceRefresh));
    const telemetryMap = new Map<string, { successfulUses: number; uniqueUsers: number }>();
    telemetryMetrics.forEach((m) => {
      telemetryMap.set(normalizeToolKey(m.toolKey), {
        successfulUses: m.successfulOperations,
        uniqueUsers: m.uniqueUsers,
      });
    });

    // 2. Fetch admin navigation configs from navigation_configs table
    const adminConfigs = await navigationStore.getAllConfigs();
    const configMap = new Map<string, NavigationConfigItem>();
    adminConfigs.forEach((c) => {
      configMap.set(`${c.toolId}:${c.categoryId}`, c);
      configMap.set(c.toolId, c);
    });

    // 3. Fetch tool access controls & feature flags
    const featureMap = new Map<string, { status?: string; accessMode?: string }>();
    try {
      const flags = featureServerStore.getAllFeatures();
      flags.forEach((f) => {
        featureMap.set(f.id, { status: f.status, accessMode: f.accessMode });
        if (f.key) featureMap.set(f.key, { status: f.status, accessMode: f.accessMode });
      });
    } catch {}

    // 4. Map Canonical Tools into Unified Smart Tool Items
    const allProcessedTools: SmartNavToolItem[] = CANONICAL_TOOL_REGISTRY.map((tool) => {
      const normKey = normalizeToolKey(tool.key);
      const conf = configMap.get(`${tool.key}:${tool.category}`) || configMap.get(tool.key);
      const flag = featureMap.get(tool.featureFlagKey) || featureMap.get(tool.key);
      const telemetry = telemetryMap.get(normKey) || { successfulUses: 0, uniqueUsers: 0 };

      // Tool status evaluation
      const isFlagDisabled = flag?.status === 'DISABLED';
      const isConfDisabled = conf?.status === 'DISABLED';
      const isFlagMaintenance = flag?.status === 'MAINTENANCE';
      const isConfMaintenance = conf?.status === 'MAINTENANCE';

      let effectiveStatus = conf?.status || (tool.status === 'coming_soon' ? 'COMING_SOON' : tool.status === 'beta' ? 'BETA' : 'ACTIVE');
      if (isFlagDisabled || isConfDisabled) effectiveStatus = 'DISABLED';
      else if (isFlagMaintenance || isConfMaintenance) effectiveStatus = 'MAINTENANCE';

      const isEnabled = effectiveStatus !== 'DISABLED';
      const isPro = flag?.accessMode === 'SUBSCRIPTION' || tool.defaultAccess === 'SUBSCRIPTION';
      const isBeta = effectiveStatus === 'BETA' || tool.status === 'beta';
      const guestAllowed = !isPro; // guest allowed on non-pro free tools
      const freeAllowed = !isPro;
      const isFeatured = Boolean(conf?.featured);

      return {
        key: tool.key,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        route: tool.route,
        icon: tool.icon,
        position: conf?.position ?? 0,
        isFeatured,
        isMostUsed: false, // Calculated dynamically per category below
        badge: conf?.badge || null,
        successfulUses: telemetry.successfulUses,
        uniqueUsers: telemetry.uniqueUsers,
        guestAllowed,
        freeAllowed,
        requiresPro: isPro,
        isBeta,
        status: effectiveStatus,
        isEnabled,
      };
    });

    // 5. Build dynamic categories & rank tools deterministically
    const categoryDefinitions: Array<{
      id: string;
      label: string;
      route: string;
      position: number;
      canonicalCategories: CanonicalToolCategory[];
    }> = [
      { id: 'pdf', label: 'PDF Tools', route: '/pdf', position: 0, canonicalCategories: ['pdf'] },
      { id: 'images', label: 'Image Tools', route: '/images', position: 1, canonicalCategories: ['image'] },
      { id: 'student', label: 'Student Tools', route: '/student-tools', position: 2, canonicalCategories: ['student', 'academic'] },
      { id: 'career', label: 'Career Tools', route: '/jobs', position: 3, canonicalCategories: ['career'] },
      { id: 'ai', label: 'AI Tools', route: '/tools?category=ai', position: 4, canonicalCategories: ['ai'] },
    ];

    const resolvedCategories: SmartNavCategory[] = [];

    for (const catDef of categoryDefinitions) {
      // Step A: Filter tools belonging to this category
      const matchingTools = allProcessedTools.filter((t) =>
        catDef.canonicalCategories.includes(t.category)
      );

      // Step B: Filter out disabled tools and tools hidden from navbar
      const eligibleTools = matchingTools.filter((t) => {
        if (!t.isEnabled) return false;
        const conf = configMap.get(`${t.key}:${t.category}`) || configMap.get(t.key);
        if (conf && (conf.visibleInNavbar === false || conf.visibleInMegaMenu === false)) {
          return false;
        }
        return true;
      });

      // Step C: Multi-Stage Deterministic Sorting
      // Stage 1: Featured tools first, ordered by position
      // Stage 2: Successful operations DESC
      // Stage 3: Position ASC
      // Stage 4: Stable key ASC
      const sortedTools = [...eligibleTools].sort((a, b) => {
        // Stage 1: Admin Featured priority
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;

        // If both are featured, order by admin position
        if (a.isFeatured && b.isFeatured) {
          if (a.position !== b.position) return a.position - b.position;
        }

        // Stage 2: Real Usage DESC (only when > 0)
        if (a.successfulUses !== b.successfulUses) {
          return b.successfulUses - a.successfulUses;
        }

        // Stage 3: Admin position
        if (a.position !== b.position) {
          return a.position - b.position;
        }

        // Stage 4: Alphabetical stability
        return a.key.localeCompare(b.key);
      });

      // Step D: Calculate accurate "Most Used" vs "Featured" badges
      // NEVER label a tool with 0 uses as "Most Used"
      const rankedTools = sortedTools.map((t, index) => {
        const hasRealUsage = t.successfulUses > 0;
        // Tool is "Most Used" if it's among the top 3 usage tools and has real completions
        const isMostUsed = !t.isFeatured && hasRealUsage && index < 4;

        let badge = t.badge;
        if (t.isFeatured) {
          badge = badge || 'FEATURED';
        } else if (isMostUsed) {
          badge = 'MOST USED';
        } else if (t.requiresPro) {
          badge = 'PRO';
        } else if (t.isBeta) {
          badge = 'BETA';
        }

        return {
          ...t,
          isMostUsed,
          badge,
        };
      });

      resolvedCategories.push({
        id: catDef.id,
        label: catDef.label,
        route: catDef.route,
        position: catDef.position,
        topTools: rankedTools.slice(0, maxPerCategory),
        allTools: rankedTools,
        totalVisibleCount: eligibleTools.length,
      });
    }

    // 6. Build Cross-Category Global Tools for the "Tools" mega menu
    const getTopToolsForGlobal = (catId: string, limit = 5): SmartNavToolItem[] => {
      const cat = resolvedCategories.find((c) => c.id === catId);
      return cat ? cat.topTools.slice(0, limit) : [];
    };

    const globalTools = {
      pdf: getTopToolsForGlobal('pdf', 5),
      images: getTopToolsForGlobal('images', 5),
      student: getTopToolsForGlobal('student', 5),
      career: getTopToolsForGlobal('career', 5),
      ai: getTopToolsForGlobal('ai', 4),
    };

    const snapshot: SmartNavigationSnapshot = {
      windowDays: days,
      windowPeriod: (days === 7 ? '7d' : days === 90 ? '90d' : '30d') as UsageWindowPeriod,
      timestamp: new Date().toISOString(),
      categories: resolvedCategories,
      globalTools,
    };

    // Store in-memory cache
    this.cache = snapshot;
    this.cacheExpiresAt = now + this.CACHE_TTL_MS;

    return snapshot;
  }
}

export const toolDiscoveryService = ToolDiscoveryService.getInstance();
