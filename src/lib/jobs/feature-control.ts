/**
 * Saarvi Jobs & Internships Feature Control & Access Enforcement Engine
 *
 * Single server-authoritative source of truth for Jobs & Internships availability.
 * Controls mode (DISABLED | BETA | ENABLED), access tier (FREE | PRO),
 * navbar visibility, search visibility, beta allowlists, and maintenance state.
 */

import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type JobsFeatureMode = 'DISABLED' | 'BETA' | 'ENABLED';
export type JobsAccessTier = 'FREE' | 'PRO';

export interface JobsFeatureSettings {
  visible: boolean;
  enabled: boolean;
  mode: JobsFeatureMode;
  access_tier: JobsAccessTier;
  navbar_visible: boolean;
  search_visible: boolean;
  beta_allowlist_enabled: boolean;
  beta_user_ids: string[];
  beta_email_allowlist: string[];
  maintenance_message?: string;
  updated_by: string;
  updated_at: string;
}

export interface JobsAccessEvaluation {
  allowed: boolean;
  status: 'DISABLED' | 'BETA' | 'PRO_REQUIRED' | 'ALLOWED';
  reason?: string;
  maintenanceMessage?: string;
}

export const DEFAULT_JOBS_SETTINGS: JobsFeatureSettings = {
  visible: true,
  enabled: true,
  mode: 'ENABLED',
  access_tier: 'FREE',
  navbar_visible: true,
  search_visible: true,
  beta_allowlist_enabled: false,
  beta_user_ids: [],
  beta_email_allowlist: [],
  maintenance_message: '',
  updated_by: 'system',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// In-memory runtime state for fast synchronous reads
let runtimeSettings: JobsFeatureSettings = { ...DEFAULT_JOBS_SETTINGS };
let isHydrated = false;

async function hydrateFromStorage(): Promise<void> {
  if (isHydrated) return;
  isHydrated = true;

  try {
    if (typeof window === 'undefined' && isSupabaseConfigured()) {
      const { getSupabaseAdminClient } = await import('@/lib/supabase/admin');
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data } = await supabase
          .from('platform_settings')
          .select('metadata')
          .eq('id', 'jobs_feature_settings')
          .maybeSingle();

        if (data?.metadata) {
          runtimeSettings = {
            ...DEFAULT_JOBS_SETTINGS,
            ...data.metadata,
          };
          return;
        }
      }
    }

    // Check resilient MockStorageProvider
    const stored = (MockStorageProvider as any).getPlatformSetting?.('jobs_feature_settings');
    if (stored) {
      runtimeSettings = {
        ...DEFAULT_JOBS_SETTINGS,
        ...stored,
      };
    }
  } catch (err) {
    console.warn('[JobsFeatureControl] Hydration notice:', err);
  }
}

export const JobsFeatureControl = {
  /**
   * Returns authoritative feature settings
   */
  getSettings(): JobsFeatureSettings {
    if (!isHydrated && typeof window === 'undefined') {
      hydrateFromStorage().catch(() => {});
    }
    return { ...runtimeSettings };
  },

  /**
   * Public client-safe representation
   */
  getPublicStatus() {
    const s = this.getSettings();
    return {
      visible: s.visible,
      enabled: s.enabled && s.mode !== 'DISABLED',
      mode: s.mode,
      access_tier: s.access_tier,
      navbar_visible: s.navbar_visible && s.visible && s.mode !== 'DISABLED',
      search_visible: s.search_visible && s.visible && s.mode !== 'DISABLED',
      isBeta: s.mode === 'BETA',
      isProRequired: s.access_tier === 'PRO',
      maintenance_message: s.maintenance_message || '',
    };
  },

  /**
   * Evaluates if a given user can access Jobs & Internships.
   * Server-authoritative: enforces mode, beta allowlists, and Pro entitlement.
   */
  evaluateAccess(
    user: { id?: string; email?: string; role?: string } | null,
    entitlement?: { isPro: boolean } | null
  ): JobsAccessEvaluation {
    const s = this.getSettings();

    // 1. Check Disabled state
    if (!s.enabled || s.mode === 'DISABLED' || !s.visible) {
      return {
        allowed: false,
        status: 'DISABLED',
        reason: 'Jobs & Internships is currently unavailable.',
        maintenanceMessage: s.maintenance_message || undefined,
      };
    }

    // Admins and SuperAdmins always have full operational access
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
      return { allowed: true, status: 'ALLOWED' };
    }

    // 2. Check Beta mode
    if (s.mode === 'BETA') {
      let isBetaEligible = false;

      if (!s.beta_allowlist_enabled) {
        // If allowlist toggle is off but mode is BETA, everyone authenticated is considered beta audience
        isBetaEligible = Boolean(user && user.id);
      } else {
        const userId = user?.id;
        const userEmail = user?.email?.toLowerCase().trim();

        const inIdList = userId ? s.beta_user_ids.includes(userId) : false;
        const inEmailList = userEmail ? s.beta_email_allowlist.map((e) => e.toLowerCase().trim()).includes(userEmail) : false;

        isBetaEligible = inIdList || inEmailList;
      }

      if (!isBetaEligible) {
        return {
          allowed: false,
          status: 'BETA',
          reason: 'Jobs & Internships is currently in beta. Access is restricted to invited beta participants.',
        };
      }

      // If in beta audience, check access tier
      if (s.access_tier === 'PRO' && !entitlement?.isPro) {
        return {
          allowed: false,
          status: 'PRO_REQUIRED',
          reason: 'Jobs & Internships requires an active Saarvi Pro membership.',
        };
      }

      return { allowed: true, status: 'ALLOWED' };
    }

    // 3. Normal ENABLED mode
    if (s.access_tier === 'PRO' && !entitlement?.isPro) {
      return {
        allowed: false,
        status: 'PRO_REQUIRED',
        reason: 'Jobs & Internships requires an active Saarvi Pro membership.',
      };
    }

    return { allowed: true, status: 'ALLOWED' };
  },

  /**
   * Updates Jobs & Internships settings with audit logging.
   */
  async updateSettings(
    updates: Partial<JobsFeatureSettings>,
    actor: { id: string; email: string; role?: string }
  ): Promise<JobsFeatureSettings> {
    const prev = { ...runtimeSettings };
    const now = new Date().toISOString();

    const newMode: JobsFeatureMode = updates.mode || prev.mode;
    const newAccessTier: JobsAccessTier = updates.access_tier || prev.access_tier;
    const isNowEnabled = updates.enabled !== undefined ? updates.enabled : (newMode !== 'DISABLED');

    const updated: JobsFeatureSettings = {
      ...prev,
      ...updates,
      enabled: isNowEnabled,
      mode: newMode,
      access_tier: newAccessTier,
      updated_by: actor.email,
      updated_at: now,
    };

    runtimeSettings = updated;

    // Persist to MockStorageProvider
    try {
      (MockStorageProvider as any).savePlatformSetting?.('jobs_feature_settings', updated);
    } catch {}

    // Persist to Supabase if live
    try {
      if (typeof window === 'undefined' && isSupabaseConfigured()) {
        const { getSupabaseAdminClient } = await import('@/lib/supabase/admin');
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          await supabase.from('platform_settings').upsert({
            id: 'jobs_feature_settings',
            metadata: updated,
            updated_at: now,
            updated_by: actor.email,
          });
        }
      }
    } catch (err) {
      console.warn('[JobsFeatureControl] Supabase persist notice:', err);
    }

    // Audit trail logging
    try {
      let action = 'JOBS_FEATURE_UPDATED';
      if (prev.mode !== newMode) {
        if (newMode === 'DISABLED') action = 'jobs_feature_disabled';
        else if (newMode === 'BETA') action = 'jobs_feature_set_beta';
        else action = 'jobs_feature_enabled';
      } else if (prev.access_tier !== newAccessTier) {
        action = 'jobs_feature_access_changed';
      }

      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action,
        targetType: 'FEATURE',
        targetId: 'jobs_internships',
        metadata: {
          previousMode: prev.mode,
          newMode,
          previousTier: prev.access_tier,
          newTier: newAccessTier,
          navbar_visible: updated.navbar_visible,
          search_visible: updated.search_visible,
          beta_allowlist_enabled: updated.beta_allowlist_enabled,
        },
      });
    } catch {}

    // Dispatch custom browser event if running in browser environment
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('saarvi:jobs-feature-changed', { detail: updated }));
      }
    } catch {}

    return updated;
  },

  /**
   * Resets settings back to production defaults
   */
  async resetToDefaults(actor: { id: string; email: string; role?: string }): Promise<JobsFeatureSettings> {
    return this.updateSettings(DEFAULT_JOBS_SETTINGS, actor);
  },
};

/**
 * Centralized feature-access helper functions (Prompt Section 19 & 20)
 * Evaluates whether a feature is enabled, navbar visible, or returns full access evaluation.
 */
export function isFeatureEnabled(featureKey: string = 'jobs_internships'): boolean {
  const normalized = (featureKey || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'jobs_internships' || normalized === 'jobs' || normalized === 'internships') {
    const s = JobsFeatureControl.getSettings();
    return s.enabled && s.mode !== 'DISABLED' && s.visible;
  }
  return false;
}

export function isNavbarItemVisible(featureKey: string = 'jobs_internships'): boolean {
  const normalized = (featureKey || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'jobs_internships' || normalized === 'jobs' || normalized === 'internships') {
    const s = JobsFeatureControl.getSettings();
    return s.navbar_visible && s.visible && s.enabled && s.mode !== 'DISABLED';
  }
  return false;
}

export function getFeatureAccess(
  featureKey: string = 'jobs_internships',
  user?: { id?: string; email?: string; role?: string } | null,
  entitlement?: { isPro: boolean } | null
): JobsAccessEvaluation {
  const normalized = (featureKey || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'jobs_internships' || normalized === 'jobs' || normalized === 'internships') {
    return JobsFeatureControl.evaluateAccess(user || null, entitlement || null);
  }
  return { allowed: false, status: 'DISABLED', reason: 'Feature not found' };
}

