"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { planService } from '@/lib/services/planService';
import { Plan, FeatureId, EntitlementCheckResult, PlanLimits } from '@/types/plan';

export interface UserEntitlementState {
  userId: string;
  isPro: boolean;
  tier: 'FREE' | 'PRO';
  status: 'ACTIVE' | 'EXPIRED' | 'NONE' | 'TRIALING';
  plan?: 'monthly' | 'yearly';
  expiresAt?: string;
  startedAt?: string;
  source?: string;
}

export function usePlan() {
  const { user, profile } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [serverEntitlement, setServerEntitlement] = useState<UserEntitlementState | null>(null);

  const refreshPlan = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch server-authoritative entitlement asynchronously
  useEffect(() => {
    if (!user) {
      setServerEntitlement(null);
      return;
    }

    let isMounted = true;
    fetch(`/api/billing/entitlement?userId=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.entitlement) {
          setServerEntitlement(data.entitlement);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch server entitlement:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [user, refreshTrigger]);

  const plan: Plan = useMemo(() => {
    void refreshTrigger;
    if (serverEntitlement) {
      return serverEntitlement.isPro ? 'pro' : 'free';
    }
    return planService.getUserPlan(user, profile);
  }, [user, profile, refreshTrigger, serverEntitlement]);

  const limits: PlanLimits = useMemo(() => {
    return planService.getPlanLimits(plan);
  }, [plan]);

  const canAccess = (featureId: FeatureId): EntitlementCheckResult => {
    return planService.canAccessFeature(featureId, user, profile);
  };

  const checkTool = (toolSlug: string): EntitlementCheckResult => {
    return planService.canUseTool(toolSlug, user);
  };

  const isGuest = plan === 'guest';
  const isFree = plan === 'free';
  const isPro = plan === 'pro';

  return {
    plan,
    limits,
    isGuest,
    isFree,
    isPro,
    entitlement: serverEntitlement,
    canAccess,
    checkTool,
    refreshPlan,
  };
}
