/**
 * Saarvi Server-Authoritative Tool Access & Beta Limits Service
 * Phase 41: Unified Admin Control Center, Beta Usage Enforcement & Concurrency Hardening
 *
 * Enforces:
 * 1. Server-authoritative tool access decisions (never trust client state).
 * 2. Admin-configurable Beta free-use trials with atomic reservation.
 * 3. Pro user bypass: Pro users are never blocked by beta limits.
 * 4. Deterministic health calculations from real platform telemetry.
 */

import { CANONICAL_TOOL_REGISTRY, CanonicalTool } from './tool-registry';
import { getUserEntitlement } from '@/lib/billing/entitlements';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type {
  ToolControlConfig,
  ToolTelemetryMetric,
  ToolAccessResult,
  ToolHealthStatus,
  ToolOperationalStatus,
  ToolAccessTier,
} from '@/types/tool-control';

export class ToolAccessService {
  private static instance: ToolAccessService;

  public static getInstance(): ToolAccessService {
    if (!ToolAccessService.instance) {
      ToolAccessService.instance = new ToolAccessService();
    }
    return ToolAccessService.instance;
  }

  /**
   * Authoritative access decision for a user requesting to run a tool.
   * Centralizes entitlement, beta quota, and maintenance state.
   */
  async getToolAccess(
    userId: string | null | undefined,
    toolKeyOrSlug: string
  ): Promise<ToolAccessResult> {
    const normalizedKey = toolKeyOrSlug.toLowerCase().trim();
    const tool = CANONICAL_TOOL_REGISTRY.find(
      (t) => t.key === normalizedKey || t.featureFlagKey === normalizedKey || t.route.endsWith(normalizedKey)
    );

    if (!tool) {
      return {
        toolKey: normalizedKey,
        enabled: false,
        status: 'DISABLED',
        accessMode: 'FREE',
        isAllowed: false,
        isPro: false,
        isBeta: false,
        usageCount: 0,
        freeLimit: 0,
        remainingUses: 0,
        requiresPro: false,
        maintenanceMessage: 'Tool not found in canonical registry.',
      };
    }

    // 1. Resolve Admin Config Override
    const config = await this.getToolConfig(tool.key);

    const operationalStatus: ToolOperationalStatus = config?.status || (tool.status === 'beta' ? 'BETA' : (tool.status === 'coming_soon' ? 'COMING_SOON' : 'AVAILABLE'));
    const accessMode: ToolAccessTier = config?.accessMode || (tool.defaultAccess === 'SUBSCRIPTION' ? 'PRO' : 'FREE');
    const betaFreeLimit = config?.betaFreeLimit ?? tool.betaFreeLimit ?? 10;
    const isBeta = operationalStatus === 'BETA';

    // 2. Check Disabled / Maintenance / Coming Soon
    if (operationalStatus === 'DISABLED') {
      return {
        toolKey: tool.key,
        enabled: false,
        status: 'DISABLED',
        accessMode,
        isAllowed: false,
        isPro: false,
        isBeta,
        usageCount: 0,
        freeLimit: betaFreeLimit,
        remainingUses: 0,
        requiresPro: false,
        maintenanceMessage: config?.maintenanceMessage || 'This tool has been temporarily disabled by platform administration.',
      };
    }

    if (operationalStatus === 'MAINTENANCE') {
      return {
        toolKey: tool.key,
        enabled: false,
        status: 'MAINTENANCE',
        accessMode,
        isAllowed: false,
        isPro: false,
        isBeta,
        usageCount: 0,
        freeLimit: betaFreeLimit,
        remainingUses: 0,
        requiresPro: false,
        maintenanceMessage: config?.maintenanceMessage || 'This tool is temporarily undergoing maintenance.',
      };
    }

    if (operationalStatus === 'COMING_SOON') {
      return {
        toolKey: tool.key,
        enabled: false,
        status: 'COMING_SOON',
        accessMode,
        isAllowed: false,
        isPro: false,
        isBeta: false,
        usageCount: 0,
        freeLimit: betaFreeLimit,
        remainingUses: 0,
        requiresPro: false,
        maintenanceMessage: "We're currently building this tool. It will be available soon.",
      };
    }

    // 3. Resolve User Pro Entitlement
    const entitlement = userId ? await getUserEntitlement(userId) : { isPro: false };
    const isPro = entitlement.isPro;

    // 4. Pro-Only Gating
    if (accessMode === 'PRO') {
      if (!isPro) {
        return {
          toolKey: tool.key,
          enabled: true,
          status: operationalStatus,
          accessMode: 'PRO',
          isAllowed: false,
          isPro: false,
          isBeta: false,
          usageCount: 0,
          freeLimit: betaFreeLimit,
          remainingUses: 0,
          requiresPro: true,
          maintenanceMessage: 'This tool requires an active Saarvi Pro subscription.',
        };
      }
      return {
        toolKey: tool.key,
        enabled: true,
        status: operationalStatus,
        accessMode: 'PRO',
        isAllowed: true,
        isPro: true,
        isBeta: false,
        usageCount: 0,
        freeLimit: betaFreeLimit,
        remainingUses: Infinity,
        requiresPro: false,
      };
    }

    // 5. Beta Free Usage Limits Gating
    if (isBeta) {
      if (isPro) {
        // Pro users bypass Beta limits
        return {
          toolKey: tool.key,
          enabled: true,
          status: 'BETA',
          accessMode: 'FREE',
          isAllowed: true,
          isPro: true,
          isBeta: true,
          usageCount: 0,
          freeLimit: betaFreeLimit,
          remainingUses: Infinity,
          requiresPro: false,
        };
      }

      // Anonymous users or free users
      const usageCount = userId ? await this.getToolUsageCount(userId, tool.key) : 0;
      const remainingUses = Math.max(0, betaFreeLimit - usageCount);
      const isAllowed = usageCount < betaFreeLimit;

      return {
        toolKey: tool.key,
        enabled: true,
        status: 'BETA',
        accessMode: 'FREE',
        isAllowed,
        isPro: false,
        isBeta: true,
        usageCount,
        freeLimit: betaFreeLimit,
        remainingUses,
        requiresPro: !isAllowed,
        maintenanceMessage: !isAllowed
          ? `Your free Beta access for ${tool.name} has been used up.`
          : undefined,
      };
    }

    // 6. Standard Free Tool
    return {
      toolKey: tool.key,
      enabled: true,
      status: operationalStatus,
      accessMode: 'FREE',
      isAllowed: true,
      isPro,
      isBeta: false,
      usageCount: 0,
      freeLimit: betaFreeLimit,
      remainingUses: Infinity,
      requiresPro: false,
    };
  }

  /**
   * Concurrency-safe atomic reservation of one beta use slot.
   * Prevents two simultaneous requests from double-dipping slot #10.
   */
  async reserveBetaUse(
    userId: string,
    toolKey: string
  ): Promise<{ allowed: boolean; usageCount: number; remainingUses: number; requiresPro?: boolean; error?: string }> {
    if (!userId) {
      return { allowed: false, usageCount: 0, remainingUses: 0, error: 'Authentication required for Beta usage tracking.' };
    }

    // Check Pro bypass first
    const ent = await getUserEntitlement(userId);
    if (ent.isPro) {
      return { allowed: true, usageCount: 0, remainingUses: Infinity };
    }

    // Retrieve tool config to know the current limit
    const config = await this.getToolConfig(toolKey);
    const freeLimit = config?.betaFreeLimit ?? 10;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('atomic_reserve_beta_use', {
            p_user_id: userId,
            p_tool_key: toolKey,
            p_free_limit: freeLimit,
          });

          if (!error && data) {
            return {
              allowed: Boolean(data.allowed),
              usageCount: data.usageCount ?? 0,
              remainingUses: data.remainingUses ?? 0,
              requiresPro: !data.allowed,
            };
          }
        } catch (rpcErr) {
          console.warn('[ToolAccessService] Supabase atomic_reserve_beta_use fallback to mock:', rpcErr);
        }
      }
    }

    // Resilient local store reservation
    const res = MockStorageProvider.atomicReserveBetaUse(userId, toolKey, freeLimit);
    return {
      allowed: res.allowed,
      usageCount: res.usageCount,
      remainingUses: res.remainingUses,
      requiresPro: !res.allowed,
    };
  }

  /**
   * Commits the reserved use upon verified successful tool execution.
   */
  async commitBetaUse(
    userId: string,
    toolKey: string,
    durationMs: number = 0
  ): Promise<{ success: boolean; usageCount: number }> {
    if (!userId) return { success: true, usageCount: 0 };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('commit_beta_use', {
            p_user_id: userId,
            p_tool_key: toolKey,
            p_duration_ms: durationMs,
          });
          if (!error && data) {
            return { success: true, usageCount: data.usageCount ?? 0 };
          }
        } catch (rpcErr) {
          console.warn('[ToolAccessService] Supabase commit_beta_use fallback to mock:', rpcErr);
        }
      }
    }

    return MockStorageProvider.commitBetaUse(userId, toolKey, durationMs);
  }

  /**
   * Releases the reserved slot if the operation failed.
   * Does NOT penalize the user for server/tool errors.
   */
  async releaseBetaUse(
    userId: string,
    toolKey: string,
    errorMsg?: string
  ): Promise<{ success: boolean; usageCount: number }> {
    if (!userId) return { success: true, usageCount: 0 };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('release_beta_use', {
            p_user_id: userId,
            p_tool_key: toolKey,
            p_error_msg: errorMsg || null,
          });
          if (!error && data) {
            return { success: true, usageCount: data.usageCount ?? 0 };
          }
        } catch (rpcErr) {
          console.warn('[ToolAccessService] Supabase release_beta_use fallback to mock:', rpcErr);
        }
      }
    }

    return MockStorageProvider.releaseBetaUse(userId, toolKey, errorMsg);
  }

  /**
   * Reads tool access config override.
   */
  async getToolConfig(toolKey: string): Promise<ToolControlConfig | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data } = await supabase
            .from('tool_access_configs')
            .select('*')
            .eq('tool_key', toolKey)
            .maybeSingle();

          if (data) {
            return {
              toolKey: data.tool_key,
              displayName: data.display_name,
              category: data.category,
              description: data.description || '',
              status: data.status,
              accessMode: data.access_mode,
              betaEnabled: data.status === 'BETA',
              betaFreeLimit: data.beta_free_limit,
              proRequired: data.access_mode === 'PRO',
              maintenanceMessage: data.maintenance_message,
              rolloutPercentage: data.rollout_percentage,
              maxP95DurationMs: data.max_p95_duration_ms,
              maxErrorRatePct: data.max_error_rate_pct ? Number(data.max_error_rate_pct) : 5.0,
              workerMode: data.worker_mode,
              processingType: data.processing_type,
              updatedAt: data.updated_at,
              updatedBy: data.updated_by,
            };
          }
        } catch (err) {
          console.warn('[ToolAccessService] Failed to read tool_access_configs:', err);
        }
      }
    }

    const configs = MockStorageProvider.getToolAccessConfigs();
    return configs[toolKey] || null;
  }

  /**
   * Updates and persists an Admin tool configuration change.
   */
  async saveToolConfig(
    updates: Partial<ToolControlConfig> & { toolKey: string },
    actor: { id: string; email: string; role: string }
  ): Promise<ToolControlConfig> {
    const tool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === updates.toolKey);
    const existing = await this.getToolConfig(updates.toolKey);

    const merged: ToolControlConfig = {
      toolKey: updates.toolKey,
      displayName: updates.displayName || existing?.displayName || tool?.name || updates.toolKey,
      category: updates.category || existing?.category || tool?.category || 'pdf',
      description: updates.description || existing?.description || tool?.description || '',
      status: updates.status || existing?.status || (tool?.status === 'beta' ? 'BETA' : 'AVAILABLE'),
      accessMode: updates.accessMode || existing?.accessMode || (tool?.defaultAccess === 'SUBSCRIPTION' ? 'PRO' : 'FREE'),
      betaEnabled: updates.status ? updates.status === 'BETA' : (existing?.betaEnabled ?? (tool?.status === 'beta')),
      betaFreeLimit: updates.betaFreeLimit ?? existing?.betaFreeLimit ?? 10,
      proRequired: updates.accessMode ? updates.accessMode === 'PRO' : (existing?.proRequired ?? (tool?.defaultAccess === 'SUBSCRIPTION')),
      maintenanceMessage: updates.maintenanceMessage ?? existing?.maintenanceMessage,
      rolloutPercentage: updates.rolloutPercentage ?? existing?.rolloutPercentage ?? 100,
      maxP95DurationMs: updates.maxP95DurationMs ?? existing?.maxP95DurationMs ?? 5000,
      maxErrorRatePct: updates.maxErrorRatePct ?? existing?.maxErrorRatePct ?? 5.0,
      workerMode: updates.workerMode ?? existing?.workerMode ?? (tool?.category === 'ai' ? 'hybrid' : 'client'),
      processingType: updates.processingType ?? existing?.processingType ?? (tool?.category === 'ai' ? 'mixed' : 'local'),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email,
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('tool_access_configs').upsert({
            tool_key: merged.toolKey,
            display_name: merged.displayName,
            category: merged.category,
            description: merged.description,
            status: merged.status,
            access_mode: merged.accessMode,
            beta_free_limit: merged.betaFreeLimit,
            maintenance_message: merged.maintenanceMessage,
            rollout_percentage: merged.rolloutPercentage,
            max_p95_duration_ms: merged.maxP95DurationMs,
            max_error_rate_pct: merged.maxErrorRatePct,
            worker_mode: merged.workerMode,
            processing_type: merged.processingType,
            updated_at: merged.updatedAt,
            updated_by: merged.updatedBy,
          });
        } catch (err) {
          console.warn('[ToolAccessService] Supabase upsert tool_access_configs error:', err);
        }
      }
    }

    MockStorageProvider.saveToolAccessConfig(merged);

    // Audit Logging
    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: 'TOOL_CONFIG_UPDATED',
      targetType: 'TOOL',
      targetId: merged.toolKey,
      metadata: {
        toolKey: merged.toolKey,
        status: merged.status,
        accessMode: merged.accessMode,
        betaFreeLimit: merged.betaFreeLimit,
      },
    });

    return merged;
  }

  /**
   * Queries authoritative usage count for a user and tool.
   */
  async getToolUsageCount(userId: string, toolKey: string): Promise<number> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data } = await supabase
            .from('tool_beta_usages')
            .select('usage_count')
            .eq('user_id', userId)
            .eq('tool_key', toolKey)
            .maybeSingle();

          if (data && typeof data.usage_count === 'number') {
            return data.usage_count;
          }
        } catch {}
      }
    }

    const mockUsage = MockStorageProvider.getToolBetaUsage(userId, toolKey);
    return mockUsage ? mockUsage.usageCount : 0;
  }

  /**
   * Aggregates real operational telemetry across all canonical tools.
   * Performs database-side grouping without shipping raw events to client.
   */
  async getAggregatedTelemetry(periodDays: number = 30): Promise<ToolTelemetryMetric[]> {
    const configs = MockStorageProvider.getToolAccessConfigs();
    let dbTelemetry: any[] = [];

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('get_tool_overview_telemetry', {
            p_period_days: periodDays,
          });
          if (!error && Array.isArray(data)) {
            dbTelemetry = data;
          }
        } catch (err) {
          console.warn('[ToolAccessService] get_tool_overview_telemetry fallback:', err);
        }
      }
    }

    // In-memory / mock events fallback
    const rawEvents = (MockStorageProvider.getPlatformEvents() as any[]) || [];
    const now = Date.now();
    const periodStart = periodDays <= 0 ? 0 : now - periodDays * 86400000;

    const filteredEvents = rawEvents.filter((e) => {
      const time = new Date(e.timestamp || e.created_at || 0).getTime();
      return time >= periodStart;
    });

    const eventMap = new Map<string, { uses: number; succ: number; fail: number; durations: number[]; users: Set<string>; lastUsed: string }>();

    for (const ev of filteredEvents) {
      const k = ev.toolKey || ev.tool_key || ev.targetId;
      if (!k) continue;
      const current = eventMap.get(k) || {
        uses: 0,
        succ: 0,
        fail: 0,
        durations: [] as number[],
        users: new Set<string>(),
        lastUsed: ev.timestamp || ev.created_at,
      };

      current.uses += 1;
      if (ev.success !== false) current.succ += 1;
      else current.fail += 1;

      if (ev.durationMs && ev.durationMs > 0) {
        current.durations.push(ev.durationMs);
      }
      if (ev.userId || ev.user_id) {
        current.users.add(ev.userId || ev.user_id);
      }
      if (new Date(ev.timestamp || ev.created_at) > new Date(current.lastUsed)) {
        current.lastUsed = ev.timestamp || ev.created_at;
      }
      eventMap.set(k, current);
    }

    // All beta usages count to find users who hit limit
    const allBetaUsages = MockStorageProvider.getAllToolBetaUsages();

    // Map each Canonical Tool to a ToolTelemetryMetric
    return CANONICAL_TOOL_REGISTRY.map((tool) => {
      const cfg = configs[tool.key];
      const dbRow = dbTelemetry.find((row) => row.toolKey === tool.key);
      const memRow = eventMap.get(tool.key);

      const status: ToolOperationalStatus = cfg?.status || (tool.status === 'beta' ? 'BETA' : (tool.status === 'coming_soon' ? 'COMING_SOON' : 'AVAILABLE'));
      const accessMode: ToolAccessTier = cfg?.accessMode || (tool.defaultAccess === 'SUBSCRIPTION' ? 'PRO' : 'FREE');
      const betaFreeLimit = cfg?.betaFreeLimit ?? tool.betaFreeLimit ?? 10;
      const betaEnabled = status === 'BETA';

      const totalUses = (dbRow?.totalUses ?? 0) + (memRow?.uses ?? 0);
      const uniqueUsers = (dbRow?.uniqueUsers ?? 0) + (memRow?.users.size ?? 0);
      const successfulOperations = (dbRow?.successfulOperations ?? 0) + (memRow?.succ ?? 0);
      const failedOperations = (dbRow?.failedOperations ?? 0) + (memRow?.fail ?? 0);

      const successRate = totalUses > 0
        ? Math.round((successfulOperations / totalUses) * 1000) / 10
        : 100.0;

      // Durations
      let avgDurationMs = dbRow?.avgDurationMs || 0;
      let p95DurationMs = dbRow?.p95DurationMs || 0;
      let p50DurationMs = 0;

      if (memRow && memRow.durations.length > 0) {
        const sorted = [...memRow.durations].sort((a, b) => a - b);
        avgDurationMs = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
        p50DurationMs = sorted[Math.floor(sorted.length * 0.5)];
        p95DurationMs = sorted[Math.floor(sorted.length * 0.95)] || p50DurationMs;
      }

      const lastUsedAt = dbRow?.lastUsedAt || memRow?.lastUsed || null;

      // Deterministic Health Evaluation
      let health: ToolHealthStatus = 'Healthy';
      const maxErrorRate = cfg?.maxErrorRatePct ?? 5.0;
      const maxP95 = cfg?.maxP95DurationMs ?? 5000;

      if (status === 'DISABLED') {
        health = 'Disabled';
      } else if (totalUses === 0) {
        health = 'No Recent Usage';
      } else if (failedOperations > 0 && ((failedOperations / totalUses) * 100) > maxErrorRate) {
        health = 'High Error Rate';
      } else if (p95DurationMs > maxP95) {
        health = 'Slow';
      } else if (failedOperations > 0 && ((failedOperations / totalUses) * 100) > 2.0) {
        health = 'Degraded';
      }

      // Calculate how many users reached Beta limit
      const limitReachedUsers = allBetaUsages.filter(
        (u) => u.toolKey === tool.key && u.usageCount >= betaFreeLimit
      ).length;

      return {
        toolKey: tool.key,
        displayName: tool.name,
        category: tool.category,
        status,
        accessMode,
        betaEnabled,
        betaFreeLimit,
        totalUses,
        uniqueUsers,
        successfulOperations,
        failedOperations,
        successRate,
        avgDurationMs,
        p50DurationMs,
        p95DurationMs,
        lastUsedAt,
        health,
        workerMode: cfg?.workerMode || tool.workerMode || (tool.category === 'ai' ? 'hybrid' : 'client'),
        processingType: cfg?.processingType || tool.processingType || (tool.category === 'ai' ? 'mixed' : 'local'),
        limitReachedUsers,
      };
    });
  }
}

export const toolAccessService = ToolAccessService.getInstance();
