"use client";

import { useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { planService } from '@/lib/services/planService';
import { Plan, FeatureId, EntitlementCheckResult, PlanLimits } from '@/types/plan';

export function usePlan() {
  const { user, profile } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshPlan = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const plan: Plan = useMemo(() => {
    void refreshTrigger;
    return planService.getUserPlan(user, profile);
  }, [user, profile, refreshTrigger]);

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
    canAccess,
    checkTool,
    refreshPlan,
  };
}
