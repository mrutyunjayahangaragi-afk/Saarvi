/**
 * Canonical Saarvi Plans & Billing Configuration (Server-Authoritative Source of Truth)
 *
 * Saarvi has EXACTLY ONE active user-facing plan:
 * Plan: Saarvi Pro
 * Price: ₹99 (9900 paise)
 * Duration: 30 days
 * Billing: ONE_TIME (extensible to recurring subscriptions in future)
 */

export interface CanonicalPlan {
  id: string;
  name: string;
  amount: number; // in Rupees
  amountPaise: number; // in Paise (e.g. 9900 = ₹99)
  currency: 'INR';
  accessDurationDays: number;
  billingType: 'ONE_TIME';
  active: boolean;
  feature: 'PRO';
  description: string;
  formattedPrice: string;
  durationLabel: string;
}

export const CANONICAL_PRO_PLAN: CanonicalPlan = {
  id: 'pro_30_days',
  name: 'Saarvi Pro',
  amount: 99,
  amountPaise: 9900,
  currency: 'INR',
  accessDurationDays: 30,
  billingType: 'ONE_TIME',
  active: true,
  feature: 'PRO',
  description: 'Full Pro access for 30 days — higher batch limits and executive tools',
  formattedPrice: '₹99',
  durationLabel: '30 days access',
};

export const CANONICAL_PLANS: Record<string, CanonicalPlan> = {
  pro_30_days: CANONICAL_PRO_PLAN,
  // Backward compatibility aliases
  pro_monthly: CANONICAL_PRO_PLAN,
  pro: CANONICAL_PRO_PLAN,
};

export function getCanonicalPlan(planId: string = 'pro_30_days'): CanonicalPlan {
  const plan = CANONICAL_PLANS[planId];
  if (!plan || !plan.active) {
    throw new Error(`Plan not found or inactive: "${planId}"`);
  }
  return plan;
}
