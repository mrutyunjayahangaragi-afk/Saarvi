/**
 * Saarvi Authoritative Advertisement Store & Operational Engine
 *
 * Guarantees:
 * - Server-authoritative scheduling, status, priority, and display rules.
 * - Concurrency control using GLOBAL_LOCK.
 * - Comprehensive append-only audit logging on all mutations.
 * - Deterministic, non-random active advertisement selection.
 * - Strict URL sanitization for CTA links.
 * - Zero fake analytics: metrics derived exclusively from recorded event logs.
 */

import {
  AdvertisementRecord,
  AdDisplaySettings,
  AdAnalyticsEvent,
  AdAnalyticsSummary,
  AdAnalyticsEventType,
  AdvertisementStatus,
  AdMediaType,
  AdDisplayMode,
  AdAudience,
  AdFrequencyMode,
} from '@/types/admin';
import { sanitizeUrl } from '@/lib/security/url-security';
import { GLOBAL_LOCK } from '@/lib/security/concurrency';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { featureServerStore } from '@/lib/features/feature-store';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface CreateAdParams {
  name: string;
  description?: string;
  mediaType: AdMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  headline?: string;
  bodyText?: string;
  ctaText?: string;
  ctaUrl?: string;
  advertiserName?: string;
  status?: AdvertisementStatus;
  priority?: number;
  audience?: AdAudience;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  durationSeconds?: number;
  skipEnabled?: boolean;
  skipAfterSeconds?: number;
  displayMode?: AdDisplayMode;
  frequencyMode?: AdFrequencyMode;
}

const DEFAULT_SETTINGS: AdDisplaySettings = {
  adsEnabled: true,
  defaultDisplayMode: 'FULLSCREEN_GATE',
  defaultDurationSeconds: 15,
  defaultSkipEnabled: true,
  defaultSkipAfterSeconds: 5,
  defaultFrequencyMode: 'ONCE_PER_SESSION',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

class AdvertisementStore {
  private static instance: AdvertisementStore;
  private ads: Map<string, AdvertisementRecord> = new Map();
  private settings: AdDisplaySettings = { ...DEFAULT_SETTINGS };
  private events: AdAnalyticsEvent[] = [];
  private initialized = false;

  private constructor() {
    this.init();
  }

  public static getInstance(): AdvertisementStore {
    if (!AdvertisementStore.instance) {
      AdvertisementStore.instance = new AdvertisementStore();
    }
    return AdvertisementStore.instance;
  }

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;
    if (typeof window === 'undefined') {
      this.hydrateFromSupabase().catch(() => {});
    }
  }

  public async hydrateFromSupabase(): Promise<void> {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) return;

      const [settingsRes, adsRes] = await Promise.all([
        supabase.from('ad_display_settings').select('*').eq('id', 'global').maybeSingle(),
        supabase.from('advertisements').select('*'),
      ]);

      if (settingsRes.data && !settingsRes.error) {
        const row = settingsRes.data;
        this.settings = {
          ...this.settings,
          adsEnabled: row.ads_enabled ?? this.settings.adsEnabled,
          defaultDisplayMode: row.default_display_mode ?? this.settings.defaultDisplayMode,
          defaultDurationSeconds: row.default_duration_seconds ?? this.settings.defaultDurationSeconds,
          defaultSkipEnabled: row.default_skip_enabled ?? this.settings.defaultSkipEnabled,
          defaultSkipAfterSeconds: row.default_skip_after_seconds ?? this.settings.defaultSkipAfterSeconds,
          defaultFrequencyMode: row.default_frequency_mode ?? this.settings.defaultFrequencyMode,
          updatedAt: row.updated_at || this.settings.updatedAt,
          updatedBy: row.updated_by || this.settings.updatedBy,
        };
      }

      if (adsRes.data && !adsRes.error && adsRes.data.length > 0) {
        for (const row of adsRes.data) {
          const rec: AdvertisementRecord = {
            id: row.id,
            name: row.name,
            description: row.description || undefined,
            mediaType: row.media_type as AdMediaType,
            mediaUrl: row.media_url,
            thumbnailUrl: row.thumbnail_url || undefined,
            headline: row.headline || undefined,
            bodyText: row.body_text || undefined,
            ctaText: row.cta_text || undefined,
            ctaUrl: row.cta_url || undefined,
            advertiserName: row.advertiser_name || undefined,
            status: row.status as AdvertisementStatus,
            priority: row.priority ?? 0,
            audience: row.audience as AdAudience,
            startAt: row.start_at || undefined,
            endAt: row.end_at || undefined,
            timezone: row.timezone || 'UTC',
            durationSeconds: row.duration_seconds ?? 15,
            skipEnabled: row.skip_enabled ?? true,
            skipAfterSeconds: row.skip_after_seconds ?? 5,
            displayMode: row.display_mode as AdDisplayMode,
            frequencyMode: row.frequency_mode as AdFrequencyMode,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: row.created_by || 'admin',
          };
          this.ads.set(rec.id, rec);
        }
      }
    } catch (err: any) {
      console.warn('[AdvertisementStore Supabase hydration warning]:', err?.message);
    }
  }

  public resetForTesting(): void {
    this.ads.clear();
    this.events = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.initialized = true;
  }

  // ===========================================================================
  // DISPLAY SETTINGS
  // ===========================================================================

  public getDisplaySettings(): AdDisplaySettings {
    return { ...this.settings };
  }

  public async updateDisplaySettings(
    updates: Partial<AdDisplaySettings>,
    actorEmail: string = 'admin@saarvi.in'
  ): Promise<AdDisplaySettings> {
    const release = await GLOBAL_LOCK.acquire('ad_settings_lock');
    try {
      const now = new Date().toISOString();
      const prev = { ...this.settings };

      this.settings = {
        ...this.settings,
        ...updates,
        updatedAt: now,
        updatedBy: actorEmail,
      };

      // Enforce safe numeric boundaries
      if (this.settings.defaultDurationSeconds < 3) this.settings.defaultDurationSeconds = 3;
      if (this.settings.defaultDurationSeconds > 120) this.settings.defaultDurationSeconds = 120;
      if (this.settings.defaultSkipAfterSeconds < 0) this.settings.defaultSkipAfterSeconds = 0;
      if (this.settings.defaultSkipAfterSeconds > this.settings.defaultDurationSeconds) {
        this.settings.defaultSkipAfterSeconds = this.settings.defaultDurationSeconds;
      }

      // Record Audit Log
      MockStorageProvider.addAuditLog({
        adminUserId: 'admin_usr',
        adminEmail: actorEmail,
        action: 'AD_SETTINGS_UPDATED',
        targetType: 'ADVERTISEMENT',
        targetId: 'global_settings',
        metadata: {
          previous: prev,
          updated: this.settings,
        },
      });

      // Persist to Supabase ad_display_settings
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          supabase.from('ad_display_settings').upsert({
            id: 'global',
            ads_enabled: this.settings.adsEnabled,
            default_display_mode: this.settings.defaultDisplayMode,
            default_duration_seconds: this.settings.defaultDurationSeconds,
            default_skip_enabled: this.settings.defaultSkipEnabled,
            default_skip_after_seconds: this.settings.defaultSkipAfterSeconds,
            default_frequency_mode: this.settings.defaultFrequencyMode,
            updated_at: this.settings.updatedAt,
            updated_by: this.settings.updatedBy,
          }).then(
            ({ error }) => {
              if (error) console.warn('[Supabase ad_display_settings upsert error]:', error.message);
            },
            () => {}
          );
        }
      } catch {}

      return { ...this.settings };
    } finally {
      release();
    }
  }

  // ===========================================================================
  // ADVERTISEMENTS CRUD
  // ===========================================================================

  public getAllAds(): AdvertisementRecord[] {
    const list = Array.from(this.ads.values());
    // Sort by priority desc, then createdAt desc
    return list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  public getAdById(id: string): AdvertisementRecord | null {
    const ad = this.ads.get(id);
    return ad ? { ...ad } : null;
  }

  public async createAd(
    params: CreateAdParams,
    actorEmail: string = 'admin@saarvi.in'
  ): Promise<AdvertisementRecord> {
    const release = await GLOBAL_LOCK.acquire('ad_mutation_lock');
    try {
      const now = new Date().toISOString();
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `ad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const duration = params.durationSeconds ?? this.settings.defaultDurationSeconds;
      const skipAfter = params.skipAfterSeconds ?? this.settings.defaultSkipAfterSeconds;

      const record: AdvertisementRecord = {
        id,
        name: params.name.trim(),
        description: params.description?.trim(),
        mediaType: params.mediaType,
        mediaUrl: params.mediaUrl.trim(),
        thumbnailUrl: params.thumbnailUrl?.trim(),
        headline: params.headline?.trim(),
        bodyText: params.bodyText?.trim(),
        ctaText: params.ctaText?.trim(),
        ctaUrl: params.ctaUrl ? sanitizeUrl(params.ctaUrl, '') : undefined,
        advertiserName: params.advertiserName?.trim(),
        status: params.status || 'DRAFT',
        priority: Number(params.priority) || 0,
        audience: params.audience || 'FREE_ONLY',
        startAt: params.startAt,
        endAt: params.endAt,
        timezone: params.timezone || 'UTC',
        durationSeconds: Math.max(3, Math.min(120, duration)),
        skipEnabled: params.skipEnabled ?? this.settings.defaultSkipEnabled,
        skipAfterSeconds: Math.max(0, Math.min(duration, skipAfter)),
        displayMode: params.displayMode || this.settings.defaultDisplayMode,
        frequencyMode: params.frequencyMode || this.settings.defaultFrequencyMode,
        createdAt: now,
        updatedAt: now,
        createdBy: actorEmail,
      };

      this.ads.set(id, record);

      // Record Audit Log
      MockStorageProvider.addAuditLog({
        adminUserId: 'admin_usr',
        adminEmail: actorEmail,
        action: 'AD_CREATED',
        targetType: 'ADVERTISEMENT',
        targetId: id,
        metadata: {
          name: record.name,
          mediaType: record.mediaType,
          status: record.status,
          priority: record.priority,
        },
      });

      // Persist to Supabase advertisements table
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          supabase.from('advertisements').insert({
            id: record.id,
            name: record.name,
            description: record.description || null,
            media_type: record.mediaType,
            media_url: record.mediaUrl,
            thumbnail_url: record.thumbnailUrl || null,
            headline: record.headline || null,
            body_text: record.bodyText || null,
            cta_text: record.ctaText || null,
            cta_url: record.ctaUrl || null,
            advertiser_name: record.advertiserName || null,
            status: record.status,
            priority: record.priority,
            audience: record.audience,
            start_at: record.startAt || null,
            end_at: record.endAt || null,
            timezone: record.timezone,
            duration_seconds: record.durationSeconds,
            skip_enabled: record.skipEnabled,
            skip_after_seconds: record.skipAfterSeconds,
            display_mode: record.displayMode,
            frequency_mode: record.frequencyMode,
            created_at: record.createdAt,
            updated_at: record.updatedAt,
            created_by: actorEmail,
          }).then(
            ({ error }) => {
              if (error) console.warn('[Supabase advertisements insert error]:', error.message);
            },
            () => {}
          );
        }
      } catch {}

      return { ...record };
    } finally {
      release();
    }
  }

  public async updateAd(
    id: string,
    updates: Partial<AdvertisementRecord>,
    actorEmail: string = 'admin@saarvi.in'
  ): Promise<AdvertisementRecord> {
    const release = await GLOBAL_LOCK.acquire(`ad_lock_${id}`);
    try {
      const existing = this.ads.get(id);
      if (!existing) {
        throw new Error(`Advertisement not found with id: ${id}`);
      }

      const now = new Date().toISOString();
      const updatedDuration = updates.durationSeconds ?? existing.durationSeconds;
      const updatedSkipAfter = updates.skipAfterSeconds ?? existing.skipAfterSeconds;

      const safeCtaUrl = updates.ctaUrl !== undefined
        ? (updates.ctaUrl ? sanitizeUrl(updates.ctaUrl, '') : undefined)
        : existing.ctaUrl;

      const updated: AdvertisementRecord = {
        ...existing,
        ...updates,
        name: updates.name ? updates.name.trim() : existing.name,
        ctaUrl: safeCtaUrl,
        durationSeconds: Math.max(3, Math.min(120, updatedDuration)),
        skipAfterSeconds: Math.max(0, Math.min(updatedDuration, updatedSkipAfter)),
        updatedAt: now,
      };

      this.ads.set(id, updated);

      let action = 'AD_UPDATED';
      if (updates.status && updates.status !== existing.status) {
        if (updates.status === 'ACTIVE') action = 'AD_PUBLISHED';
        else if (updates.status === 'PAUSED') action = 'AD_PAUSED';
        else if (updates.status === 'ARCHIVED') action = 'AD_ARCHIVED';
      } else if (updates.startAt !== undefined || updates.endAt !== undefined) {
        action = 'AD_SCHEDULE_UPDATED';
      } else if (updates.mediaUrl && updates.mediaUrl !== existing.mediaUrl) {
        action = 'AD_MEDIA_UPDATED';
      }

      MockStorageProvider.addAuditLog({
        adminUserId: 'admin_usr',
        adminEmail: actorEmail,
        action,
        targetType: 'ADVERTISEMENT',
        targetId: id,
        metadata: {
          changes: updates,
          status: updated.status,
        },
      });

      // Persist to Supabase advertisements table
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          supabase.from('advertisements').update({
            name: updated.name,
            description: updated.description || null,
            media_type: updated.mediaType,
            media_url: updated.mediaUrl,
            thumbnail_url: updated.thumbnailUrl || null,
            headline: updated.headline || null,
            body_text: updated.bodyText || null,
            cta_text: updated.ctaText || null,
            cta_url: updated.ctaUrl || null,
            advertiser_name: updated.advertiserName || null,
            status: updated.status,
            priority: updated.priority,
            audience: updated.audience,
            start_at: updated.startAt || null,
            end_at: updated.endAt || null,
            timezone: updated.timezone,
            duration_seconds: updated.durationSeconds,
            skip_enabled: updated.skipEnabled,
            skip_after_seconds: updated.skipAfterSeconds,
            display_mode: updated.displayMode,
            frequency_mode: updated.frequencyMode,
            updated_at: updated.updatedAt,
          }).eq('id', id).then(
            ({ error }) => {
              if (error) console.warn('[Supabase advertisements update error]:', error.message);
            },
            () => {}
          );
        }
      } catch {}

      return { ...updated };
    } finally {
      release();
    }
  }

  public async deleteAd(id: string, actorEmail: string = 'admin@saarvi.in'): Promise<boolean> {
    const release = await GLOBAL_LOCK.acquire(`ad_lock_${id}`);
    try {
      const existing = this.ads.get(id);
      if (!existing) return false;

      this.ads.delete(id);

      MockStorageProvider.addAuditLog({
        adminUserId: 'admin_usr',
        adminEmail: actorEmail,
        action: 'AD_DELETED',
        targetType: 'ADVERTISEMENT',
        targetId: id,
        metadata: {
          name: existing.name,
          deletedAt: new Date().toISOString(),
        },
      });

      // Persist to Supabase advertisements table
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          supabase.from('advertisements').delete().eq('id', id).then(
            ({ error }) => {
              if (error) console.warn('[Supabase advertisements delete error]:', error.message);
            },
            () => {}
          );
        }
      } catch {}

      return true;
    } finally {
      release();
    }
  }

  // ===========================================================================
  // DETERMINISTIC ACTIVE AD SELECTION
  // ===========================================================================

  /**
   * Deterministically returns the highest priority active ad scheduled for right now.
   * Pro-exempt evaluation is handled upstream by the server-side API caller.
   */
  public getActiveEligibleAd(nowMs: number = Date.now()): {
    ad: AdvertisementRecord | null;
    settings: AdDisplaySettings;
  } {
    const settings = this.getDisplaySettings();

    // 1. Check global settings and feature flag
    if (!settings.adsEnabled) {
      return { ad: null, settings };
    }

    if (!featureServerStore.isFeatureEnabled('advertising_enabled')) {
      return { ad: null, settings };
    }

    // 2. Filter active ads
    const activeAds = Array.from(this.ads.values()).filter((ad) => ad.status === 'ACTIVE');

    // 3. Filter by schedule
    const scheduledAds = activeAds.filter((ad) => {
      if (ad.startAt) {
        const start = new Date(ad.startAt).getTime();
        if (!isNaN(start) && start > nowMs) {
          return false; // Future scheduled ad
        }
      }
      if (ad.endAt) {
        const end = new Date(ad.endAt).getTime();
        if (!isNaN(end) && end < nowMs) {
          return false; // Expired ad
        }
      }
      return true;
    });

    if (scheduledAds.length === 0) {
      return { ad: null, settings };
    }

    // 4. Deterministic sort: Highest priority first, then oldest or newest
    scheduledAds.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      ad: { ...scheduledAds[0] },
      settings,
    };
  }

  // ===========================================================================
  // REAL ANALYTICS (ZERO FAKE DATA)
  // ===========================================================================

  public async recordEvent(
    adId: string,
    eventType: AdAnalyticsEventType,
    userId?: string,
    metadata?: Record<string, unknown>
  ): Promise<AdAnalyticsEvent> {
    const event: AdAnalyticsEvent = {
      id: `ad_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adId,
      eventType,
      timestamp: new Date().toISOString(),
      userId,
      metadata,
    };

    this.events.unshift(event);
    if (this.events.length > 2000) {
      this.events.pop(); // Cap memory retention
    }

    // Persist to Supabase ad_analytics_events table
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        supabase
          .from('ad_analytics_events')
          .insert({
            id: event.id,
            ad_id: event.adId,
            event_type: event.eventType,
            user_id: event.userId || null,
            metadata: event.metadata || {},
            created_at: event.timestamp,
          })
          .then(
            ({ error }) => {
              if (error) console.warn('[Supabase ad_analytics_events insert error]:', error.message);
            },
            () => {}
          );
      }
    } catch {}

    return event;
  }

  public getRecentEvents(limit: number = 50, adId?: string): AdAnalyticsEvent[] {
    let list = this.events;
    if (adId) {
      list = list.filter((e) => e.adId === adId);
    }
    return list.slice(0, limit);
  }

  public getAnalyticsSummary(adId?: string): AdAnalyticsSummary {
    let filtered = this.events;
    if (adId) {
      filtered = filtered.filter((e) => e.adId === adId);
    }

    let impressions = 0;
    let completed = 0;
    let skipped = 0;
    let ctaClicks = 0;
    let mediaErrors = 0;

    for (const evt of filtered) {
      switch (evt.eventType) {
        case 'AD_IMPRESSION':
          impressions++;
          break;
        case 'AD_COMPLETED':
          completed++;
          break;
        case 'AD_SKIPPED':
          skipped++;
          break;
        case 'AD_CTA_CLICKED':
          ctaClicks++;
          break;
        case 'AD_MEDIA_ERROR':
          mediaErrors++;
          break;
      }
    }

    const completionRate = impressions > 0 ? Math.round((completed / impressions) * 100) : 0;
    const skipRate = impressions > 0 ? Math.round((skipped / impressions) * 100) : 0;
    const ctr = impressions > 0 ? Math.round((ctaClicks / impressions) * 100 * 10) / 10 : 0;

    return {
      adId,
      impressions,
      completed,
      skipped,
      ctaClicks,
      mediaErrors,
      completionRate,
      skipRate,
      ctr,
    };
  }
}

export const adStore = AdvertisementStore.getInstance();
