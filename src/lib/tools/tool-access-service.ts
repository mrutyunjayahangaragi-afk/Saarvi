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

import { CANONICAL_TOOL_REGISTRY, CanonicalTool, normalizeToolKey, getCanonicalToolByKey } from './tool-registry';
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
  ToolTelemetryEventPayload,
} from '@/types/tool-control';

export class ToolAccessService {
  private static instance: ToolAccessService;
  private telemetryCache = new Map<number, { data: ToolTelemetryMetric[]; expiresAt: number }>();
  private inFlightTelemetry = new Map<number, Promise<ToolTelemetryMetric[]>>();

  public static getInstance(): ToolAccessService {
    if (!ToolAccessService.instance) {
      ToolAccessService.instance = new ToolAccessService();
    }
    return ToolAccessService.instance;
  }

  public clearTelemetryCache(): void {
    this.telemetryCache.clear();
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
    durationMs: number = 0,
    operationId?: string
  ): Promise<{ success: boolean; usageCount: number; remainingUses: number }> {
    if (!userId) return { success: true, usageCount: 0, remainingUses: 10 };

    this.clearTelemetryCache();

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
            return {
              success: true,
              usageCount: data.usageCount ?? 0,
              remainingUses: data.remainingUses ?? Math.max(0, 10 - (data.usageCount ?? 0)),
            };
          }
        } catch (rpcErr) {
          console.warn('[ToolAccessService] Supabase commit_beta_use fallback to mock:', rpcErr);
        }
      }
    }

    return MockStorageProvider.commitBetaUse(userId, toolKey, durationMs, operationId);
  }

  /**
   * Releases the reserved slot if the operation failed.
   * Does NOT penalize the user for server/tool errors.
   */
  async releaseBetaUse(
    userId: string,
    toolKey: string,
    errorMsg?: string
  ): Promise<{ success: boolean; usageCount: number; remainingUses: number }> {
    if (!userId) return { success: true, usageCount: 0, remainingUses: 0 };

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
            return { success: true, usageCount: data.usageCount ?? 0, remainingUses: data.remainingUses ?? 0 };
          }
        } catch (rpcErr) {
          console.warn('[ToolAccessService] Supabase release_beta_use fallback to mock:', rpcErr);
        }
      }
    }

    return MockStorageProvider.releaseBetaUse(userId, toolKey, errorMsg);
  }

  /**
   * Authoritative canonical telemetry and quota event recorder.
   * Handles authenticated users and anonymous guest sessions identically.
   * Strictly enforces idempotency on (operation_id, tool_key) to eliminate double counting.
   */
  async recordToolEvent(
    params: ToolTelemetryEventPayload
  ): Promise<{
    success: boolean;
    eventId?: string;
    isDuplicate?: boolean;
    usageCount?: number;
    remainingUses?: number;
    error?: string;
  }> {
    const {
      eventName,
      toolKey,
      operationId,
      success,
      durationMs = 0,
      userType: explicitUserType,
      userId = null,
      guestSessionId = null,
      category,
      metadata = {},
    } = params;

    const normalizedKey = normalizeToolKey(toolKey);
    const userType = explicitUserType || (userId ? 'authenticated' : 'guest');

    this.clearTelemetryCache();

    // 1. Resolve tool metadata
    const tool = getCanonicalToolByKey(toolKey);
    const config = await this.getToolConfig(normalizedKey);
    const isBeta = config?.status === 'BETA' || tool?.status === 'beta';
    const betaLimit = config?.betaFreeLimit ?? tool?.betaFreeLimit ?? 10;
    const resolvedCategory = category || config?.category || tool?.category || 'tool';

    let usageCount = 0;
    let remainingUses = 10;

    // 2. Beta quota handling for authenticated users
    if (userId && isBeta) {
      if (eventName === 'tool_completed' && success) {
        const commitRes = await this.commitBetaUse(userId, normalizedKey, durationMs, operationId);
        usageCount = commitRes.usageCount;
        remainingUses = commitRes.remainingUses;
      } else if ((eventName === 'tool_error' || eventName === 'tool_cancelled') && !success) {
        const releaseRes = await this.releaseBetaUse(userId, normalizedKey, (metadata.error as string) || undefined);
        usageCount = releaseRes.usageCount;
        remainingUses = releaseRes.remainingUses;
      }
    } else if (userId) {
      usageCount = await this.getToolUsageCount(userId, normalizedKey);
      remainingUses = Math.max(0, betaLimit - usageCount);
    }

    // 3. Database persistence to platform_events
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const { error } = await supabase.from('platform_events').insert({
            id: eventId,
            event_name: eventName,
            tool_key: normalizedKey,
            category: resolvedCategory,
            user_id: userId,
            user_type: userType,
            guest_session_id: guestSessionId,
            operation_id: operationId,
            success,
            duration_ms: durationMs,
            metadata,
            created_at: new Date().toISOString(),
          });

          if (error) {
            // Check for unique violation on (operation_id, tool_key)
            if (
              error.code === '23505' ||
              error.message?.includes('duplicate key') ||
              error.message?.includes('uq_platform_events_operation_tool')
            ) {
              return { success: true, isDuplicate: true, usageCount, remainingUses };
            }
            console.warn('[ToolAccessService] Supabase platform_events insert error:', error);
          } else {
            return { success: true, eventId, usageCount, remainingUses };
          }
        } catch (dbErr) {
          console.warn('[ToolAccessService] Supabase platform_events fallback to mock:', dbErr);
        }
      }
    }

    // Local / Mock storage persistence
    const mockRecord = MockStorageProvider.recordPlatformEvent({
      eventName,
      eventType: eventName,
      toolKey: normalizedKey,
      userId,
      userType,
      guestSessionId,
      operationId,
      success,
      durationMs,
      category: resolvedCategory,
      metadata,
    });

    return {
      success: true,
      eventId: mockRecord.id,
      usageCount,
      remainingUses,
    };
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
   * Caches results with a 60s TTL and deduplicates concurrent requests.
   */
  async getAggregatedTelemetry(
    periodDays: number = 30,
    forceRefresh: boolean = false
  ): Promise<ToolTelemetryMetric[]> {
    if (!forceRefresh) {
      const cached = this.telemetryCache.get(periodDays);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
      }
      if (this.inFlightTelemetry.has(periodDays)) {
        return this.inFlightTelemetry.get(periodDays)!;
      }
    }

    const promise = (async () => {
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

      // In-memory / mock events fallback - strictly filter for completed and error operations
      const rawEvents = (MockStorageProvider.getPlatformEvents() as any[]) || [];
      const now = Date.now();
      const periodStart = periodDays <= 0 ? 0 : now - periodDays * 86400000;

      const filteredEvents = rawEvents.filter((e) => {
        const evName = e.eventName || e.event_name || e.eventType;
        const isValidEvent =
          evName === 'tool_completed' ||
          evName === 'tool_error' ||
          evName === 'tool_cancelled' ||
          evName === 'tool_execution';
        if (!isValidEvent) return false;
        const time = new Date(e.timestamp || e.created_at || 0).getTime();
        return periodDays <= 0 || time >= periodStart;
      });

      const eventMap = new Map<
        string,
        {
          totalUses: number;
          authUses: number;
          guestUses: number;
          succ: number;
          fail: number;
          durations: number[];
          users: Set<string>;
          guests: Set<string>;
          lastUsed: string;
        }
      >();

      const seenOperations = new Set<string>();

      for (const ev of filteredEvents) {
        const rawK = ev.toolKey || ev.tool_key || ev.targetId;
        if (!rawK) continue;
        const k = normalizeToolKey(rawK);

        // Concurrency deduplication by operationId + toolKey if present
        const opKey = ev.operationId ? `${ev.operationId}_${k}` : null;
        if (opKey) {
          if (seenOperations.has(opKey)) continue;
          seenOperations.add(opKey);
        }

        const current = eventMap.get(k) || {
          totalUses: 0,
          authUses: 0,
          guestUses: 0,
          succ: 0,
          fail: 0,
          durations: [] as number[],
          users: new Set<string>(),
          guests: new Set<string>(),
          lastUsed: ev.timestamp || ev.created_at,
        };

        const isSuccess = ev.success === true;
        const isAuth = ev.userType === 'authenticated' || Boolean(ev.userId || ev.user_id);
        const isGuest = ev.userType === 'guest' || (!ev.userId && Boolean(ev.guestSessionId || ev.guest_session_id));

        if (isSuccess) {
          current.totalUses += 1;
          current.succ += 1;
          if (isAuth) {
            current.authUses += 1;
            if (ev.userId || ev.user_id) current.users.add(ev.userId || ev.user_id);
          }
          if (isGuest) {
            current.guestUses += 1;
            if (ev.guestSessionId || ev.guest_session_id) current.guests.add(ev.guestSessionId || ev.guest_session_id);
          }
          if (ev.durationMs && ev.durationMs > 0) {
            current.durations.push(ev.durationMs);
          }
        } else {
          current.fail += 1;
        }

        if (new Date(ev.timestamp || ev.created_at) > new Date(current.lastUsed)) {
          current.lastUsed = ev.timestamp || ev.created_at;
        }
        eventMap.set(k, current);
      }

      // All beta usages count to find users who hit limit
      const allBetaUsages = MockStorageProvider.getAllToolBetaUsages();

      // Map each Canonical Tool to a ToolTelemetryMetric
      const results: ToolTelemetryMetric[] = CANONICAL_TOOL_REGISTRY.map((tool) => {
        const normKey = normalizeToolKey(tool.key);
        const cfg = configs[tool.key] || configs[normKey];
        const dbRow = dbTelemetry.find((row) => normalizeToolKey(row.toolKey) === normKey);
        const memRow = eventMap.get(normKey);

        const status: ToolOperationalStatus =
          cfg?.status ||
          (tool.status === 'beta'
            ? 'BETA'
            : tool.status === 'coming_soon'
            ? 'COMING_SOON'
            : 'AVAILABLE');
        const accessMode: ToolAccessTier =
          cfg?.accessMode || (tool.defaultAccess === 'SUBSCRIPTION' ? 'PRO' : 'FREE');
        const betaFreeLimit = cfg?.betaFreeLimit ?? tool.betaFreeLimit ?? 10;
        const betaEnabled = status === 'BETA';

        const totalUses = (dbRow?.totalUses ?? 0) + (memRow?.totalUses ?? 0);
        const authenticatedUses = (dbRow?.authenticatedUses ?? 0) + (memRow?.authUses ?? 0);
        const guestUses = (dbRow?.guestUses ?? 0) + (memRow?.guestUses ?? 0);
        const uniqueUsers = (dbRow?.uniqueUsers ?? 0) + (memRow?.users.size ?? 0);
        const uniqueGuestSessions = (dbRow?.uniqueGuestSessions ?? 0) + (memRow?.guests.size ?? 0);
        const successfulOperations = (dbRow?.successfulOperations ?? 0) + (memRow?.succ ?? 0);
        const failedOperations = (dbRow?.failedOperations ?? 0) + (memRow?.fail ?? 0);

        const totalAttempts = successfulOperations + failedOperations;
        const successRate =
          totalAttempts > 0 ? Math.round((successfulOperations / totalAttempts) * 1000) / 10 : 100.0;

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
        } else if (failedOperations > 0 && (failedOperations / totalAttempts) * 100 > maxErrorRate) {
          health = 'High Error Rate';
        } else if (p95DurationMs > maxP95) {
          health = 'Slow';
        } else if (failedOperations > 0 && (failedOperations / totalAttempts) * 100 > 2.0) {
          health = 'Degraded';
        }

        // Calculate how many users reached Beta limit
        const limitReachedUsers = allBetaUsages.filter(
          (u) => (u.toolKey === tool.key || u.toolKey === normKey) && u.usageCount >= betaFreeLimit
        ).length;

        return {
          toolKey: normKey,
          displayName: tool.name,
          category: tool.category,
          status,
          accessMode,
          betaEnabled,
          betaFreeLimit,
          totalUses,
          authenticatedUses,
          guestUses,
          uniqueUsers,
          uniqueGuestSessions,
          successfulOperations,
          failedOperations,
          successRate,
          avgDurationMs,
          p50DurationMs,
          p95DurationMs,
          lastUsedAt,
          health,
          workerMode:
            cfg?.workerMode || tool.workerMode || (tool.category === 'ai' ? 'hybrid' : 'client'),
          processingType:
            cfg?.processingType ||
            tool.processingType ||
            (tool.category === 'ai' ? 'mixed' : 'local'),
          limitReachedUsers,
        };
      });

      // Cache for 60 seconds
      this.telemetryCache.set(periodDays, { data: results, expiresAt: Date.now() + 60000 });
      this.inFlightTelemetry.delete(periodDays);
      return results;
    })();

    this.inFlightTelemetry.set(periodDays, promise);
    return promise;
  }

  /**
   * Summarizes tool telemetry for dashboards and reports.
   */
  async getTelemetrySummary(periodDays: number = 30, forceRefresh: boolean = false) {
    const metrics = await this.getAggregatedTelemetry(periodDays, forceRefresh);
    const totalRuns = metrics.reduce((acc, m) => acc + m.totalUses, 0);
    const successfulRuns = metrics.reduce((acc, m) => acc + m.successfulOperations, 0);
    const failedRuns = metrics.reduce((acc, m) => acc + m.failedOperations, 0);
    const totalAuthenticatedUses = metrics.reduce((acc, m) => acc + m.authenticatedUses, 0);
    const totalGuestUses = metrics.reduce((acc, m) => acc + m.guestUses, 0);
    const successRate = (successfulRuns + failedRuns) > 0 ? Math.round((successfulRuns / (successfulRuns + failedRuns)) * 1000) / 10 : 100.0;
    const sorted = [...metrics].sort((a, b) => b.totalUses - a.totalUses);
    const mostUsedTool =
      sorted[0] && sorted[0].totalUses > 0
        ? {
            toolKey: sorted[0].toolKey,
            displayName: sorted[0].displayName,
            totalUses: sorted[0].totalUses,
            successRate: sorted[0].successRate,
          }
        : null;

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      totalAuthenticatedUses,
      totalGuestUses,
      successRate,
      mostUsedTool,
      metrics,
    };
  }
}

export const toolAccessService = ToolAccessService.getInstance();
