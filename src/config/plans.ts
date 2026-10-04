/**
 * Canonical Saarvi Plans & Billing Configuration (Server-Authoritative Source of Truth)
 *
 * Saarvi has EXACTLY ONE active user-facing plan tier: Saarvi Pro.
 * Monthly: ₹99 (9900 paise) for 30 days
 * Yearly: ₹899 (89900 paise) for 365 days (~25% savings)
 * Provider: Razorpay (Server-Authoritative)
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

export const CANONICAL_PRO_YEARLY_PLAN: CanonicalPlan = {
  id: 'pro_yearly',
  name: 'Saarvi Pro (Yearly)',
  amount: 899,
  amountPaise: 89900,
  currency: 'INR',
  accessDurationDays: 365,
  billingType: 'ONE_TIME',
  active: true,
  feature: 'PRO',
  description: 'Annual commitment with ~25% savings for continuous academic productivity',
  formattedPrice: '₹899',
  durationLabel: '365 days access',
};

export const CANONICAL_PLANS: Record<string, CanonicalPlan> = {
  pro_30_days: CANONICAL_PRO_PLAN,
  pro_monthly: CANONICAL_PRO_PLAN,
  pro: CANONICAL_PRO_PLAN,
  saarvi_pro_monthly: CANONICAL_PRO_PLAN,
  pro_yearly: CANONICAL_PRO_YEARLY_PLAN,
  saarvi_pro_yearly: CANONICAL_PRO_YEARLY_PLAN,
};

export function getCanonicalPlan(planId: string = 'pro_30_days'): CanonicalPlan {
  const normalized = planId.toLowerCase().trim();
  const plan = CANONICAL_PLANS[normalized];
  if (!plan || !plan.active) {
    throw new Error(`Plan not found or inactive: "${planId}"`);
  }
  return plan;
}
