// DocEase Phase 12: Central Plan & Entitlement Service
// Authoritative single source of truth for Plan levels, Feature Access, and Pro Gating.
// Enforces: Feature Enabled check AND Plan Entitlement check.

import {
  Plan,
  FeatureId,
  FeatureDefinition,
  PlanLimits,
  EntitlementCheckResult,
} from '@/types/plan';
import { AuthSessionUser, UserProfile } from '@/types/auth';
import { FEATURES_REGISTRY, PLAN_LIMITS } from '@/config/features';
import { TOOLS_CONFIG } from '@/config/tools';
import { MockStorageProvider } from '../supabase/mock-storage';

export const planService = {
  // =========================================================================
  // 1. PLAN RESOLUTION
  // =========================================================================

  /**
   * Resolves user plan tier.
   * - Guest: No session
   * - Free: Authenticated user (Default for all accounts in Phase 12)
   * - Pro: Architectural state reserved for future subscriptions
   */
  getUserPlan(user?: AuthSessionUser | null, profile?: UserProfile | null): Plan {
    const userId = user?.id || profile?.id;
    if (!userId) {
      return 'guest';
    }

    try {
      const sub = MockStorageProvider.getUserSubscription(userId);
      if (sub && (sub.status === 'ACTIVE' || sub.status === 'TRIALING')) {
        if (sub.currentPeriodEnd) {
          const expiry = new Date(sub.currentPeriodEnd).getTime();
          if (Date.now() <= expiry) {
            return 'pro';
          }
        } else {
          return 'pro';
        }
      }
    } catch {
      // Invariant: fail-safe fallback to free tier for authenticated users
    }

    return 'free';
  },

  // =========================================================================
  // 2. FEATURE ENTITLEMENT DECISION FLOW
  // =========================================================================

  /**
   * Central decision flow:
   * 1. Feature exists?
   * 2. Feature enabled in flags?
   * 3. Availability state (Maintenance / Coming Soon / Disabled)?
   * 4. User plan satisfies required plan?
   */
  canAccessFeature(
    featureId: FeatureId,
    user?: AuthSessionUser | null,
    profile?: UserProfile | null
  ): EntitlementCheckResult {
    const feature = FEATURES_REGISTRY[featureId];

    if (!feature) {
      return {
        allowed: false,
        reason: 'disabled',
        message: 'This feature is not available.',
      };
    }

    // Check runtime feature flag overrides
    try {
      const flags = MockStorageProvider.getFeatureFlags();
      const flag = flags.find((f) => f.id === featureId || f.id === feature.toolSlug);
      if (flag && flag.status === 'DISABLED') {
        return {
          allowed: false,
          reason: 'disabled',
          message: 'This feature has been temporarily disabled by platform administration.',
          feature,
        };
      }
    } catch {
      // Fail-safe default: continue with static registry definition
    }

    // Check static feature enablement
    if (!feature.enabled && feature.availability === 'disabled') {
      return {
        allowed: false,
        reason: 'disabled',
        message: 'This feature is currently disabled.',
        feature,
      };
    }

    // Check maintenance state
    if (feature.availability === 'maintenance') {
      return {
        allowed: false,
        reason: 'maintenance',
        message: 'This feature is temporarily unavailable while we improve it.',
        feature,
      };
    }

    // Check coming soon state (Future Pro tools, AI, OCR)
    if (feature.availability === 'coming_soon') {
      return {
        allowed: false,
        reason: 'coming_soon',
        message: feature.proNotice || "We're building this feature now. It will be available soon with Saarvi Pro.",
        feature,
        requiredPlan: feature.requiredPlan,
      };
    }

    const userPlan = this.getUserPlan(user, profile);

    // Plan check hierarchy: guest < free < pro
    if (feature.requiredPlan === 'guest') {
      // Guest tools are accessible to everyone (Guest, Free, Pro)
      return {
        allowed: true,
        reason: 'allowed',
        feature,
        requiredPlan: 'guest',
      };
    }

    if (feature.requiredPlan === 'free') {
      if (userPlan === 'guest') {
        return {
          allowed: false,
          reason: 'login_required',
          message: 'Create a free account or sign in to continue.',
          feature,
          requiredPlan: 'free',
        };
      }
      return {
        allowed: true,
        reason: 'allowed',
        feature,
        requiredPlan: 'free',
      };
    }

    if (feature.requiredPlan === 'pro') {
      if (userPlan !== 'pro') {
        return {
          allowed: false,
          reason: 'pro_required',
          message: feature.proNotice || 'This feature will be available with Saarvi Pro.',
          feature,
          requiredPlan: 'pro',
        };
      }
      return {
        allowed: true,
        reason: 'allowed',
        feature,
        requiredPlan: 'pro',
      };
    }

    return {
      allowed: false,
      reason: 'disabled',
      message: 'Access denied.',
      feature,
    };
  },

  // =========================================================================
  // 3. TOOL RUNNER INTEGRATION
  // =========================================================================

  canUseTool(toolSlug: string, user?: AuthSessionUser | null): EntitlementCheckResult {
    // 1. Check runtime tool override from admin platform
    try {
      const overrides = MockStorageProvider.getToolOverrides();
      const override = overrides[toolSlug];
      if (override) {
        if (override.status === 'DISABLED') {
          return {
            allowed: false,
            reason: 'disabled',
            message: 'This tool is temporarily unavailable.',
          };
        }
        if (override.status === 'MAINTENANCE') {
          return {
            allowed: false,
            reason: 'maintenance',
            message: 'This tool is temporarily unavailable while we improve it.',
          };
        }
        if (override.status === 'COMING_SOON') {
          return {
            allowed: false,
            reason: 'coming_soon',
            message: "We're building this feature now.",
          };
        }
        if (override.requiresAuth && !user) {
          return {
            allowed: false,
            reason: 'login_required',
            message: 'Sign in to use this tool.',
            requiredPlan: 'free',
          };
        }
        if (override.requiresPro) {
          return {
            allowed: false,
            reason: 'pro_required',
            message: 'This feature will be available with Saarvi Pro.',
            requiredPlan: 'pro',
          };
        }
      }
    } catch {
      // Fail-safe: continue to registry evaluation
    }

    // 2. Check base tool definition in TOOLS_CONFIG
    const baseTool = TOOLS_CONFIG.find((t) => t.slug === toolSlug || t.id === toolSlug);
    if (!baseTool) {
      // If not in tool config, look in feature registry
      const featureKey = toolSlug.replace(/-/g, '_') as FeatureId;
      if (FEATURES_REGISTRY[featureKey]) {
        return this.canAccessFeature(featureKey, user);
      }

      return {
        allowed: false,
        reason: 'disabled',
        message: 'Tool not found.',
      };
    }

    if (baseTool.status === 'disabled') {
      return {
        allowed: false,
        reason: 'disabled',
        message: 'This tool is temporarily unavailable.',
      };
    }

    if (baseTool.status === 'maintenance') {
      return {
        allowed: false,
        reason: 'maintenance',
        message: 'This tool is temporarily unavailable while we improve it.',
      };
    }

    if (baseTool.status === 'coming_soon') {
      return {
        allowed: false,
        reason: 'coming_soon',
        message: "We're building this feature now.",
      };
    }

    if (baseTool.requiresPro) {
      return {
        allowed: false,
        reason: 'pro_required',
        message: 'This feature will be available with Saarvi Pro.',
        requiredPlan: 'pro',
      };
    }

    if (baseTool.requiresAuth && !user) {
      return {
        allowed: false,
        reason: 'login_required',
        message: 'Create a free account or sign in to continue.',
        requiredPlan: 'free',
      };
    }

    // Default: Public basic tools are completely free for guests and logged-in users
    return {
      allowed: true,
      reason: 'allowed',
      requiredPlan: 'guest',
    };
  },

  // =========================================================================
  // 4. PLAN LIMITS & FEATURE REGISTRY ACCESS
  // =========================================================================

  getPlanLimits(plan: Plan): PlanLimits {
    return PLAN_LIMITS[plan] || PLAN_LIMITS.guest;
  },

  getFeature(featureId: FeatureId): FeatureDefinition | undefined {
    return FEATURES_REGISTRY[featureId];
  },

  getAllFeatures(): FeatureDefinition[] {
    return Object.values(FEATURES_REGISTRY);
  },

  getFeaturesByPlan(plan: Plan): FeatureDefinition[] {
    return Object.values(FEATURES_REGISTRY).filter((f) => f.requiredPlan === plan);
  },
};
