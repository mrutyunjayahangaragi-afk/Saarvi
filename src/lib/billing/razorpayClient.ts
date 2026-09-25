// DocEase Phase 14A: Razorpay Server Client Integration
// Instantiates the official Razorpay SDK strictly on the server.
// Enforces environment variable validation, plan ID resolution, and zero client leakage.

import Razorpay from 'razorpay';

export interface RazorpayEnvConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  monthlyPlanId: string;
  yearlyPlanId: string;
  isConfigured: boolean;
  isWebhookConfigured: boolean;
}

/**
 * Validates and retrieves server-side Razorpay configuration.
 * Never logs or exposes secret keys.
 */
export function getRazorpayServerConfig(): RazorpayEnvConfig {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const monthlyPlanId =
    process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID || process.env.RAZORPAY_PLAN_MONTHLY_ID || '';
  const yearlyPlanId =
    process.env.RAZORPAY_PRO_YEARLY_PLAN_ID || process.env.RAZORPAY_PLAN_YEARLY_ID || '';

  const isConfigured = Boolean(keyId && keySecret);
  const isWebhookConfigured = Boolean(webhookSecret);

  return {
    keyId,
    keySecret,
    webhookSecret,
    monthlyPlanId,
    yearlyPlanId,
    isConfigured,
    isWebhookConfigured,
  };
}

let razorpayInstance: Razorpay | null = null;

/**
 * Singleton server-side Razorpay client instance.
 * Throws an immediate security violation if executed in a browser environment.
 */
export function getRazorpayClient(): Razorpay | null {
  if (typeof window !== 'undefined') {
    throw new Error('Security violation: Razorpay server client must not be accessed in browser context.');
  }

  const { keyId, keySecret, isConfigured } = getRazorpayServerConfig();
  if (!isConfigured) {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
}

/**
 * Resolves trusted Razorpay Plan ID for a given billing interval.
 * Returns null if unconfigured. Never allows arbitrary client substitution.
 */
export function resolveRazorpayPlanId(interval: 'monthly' | 'yearly'): string | null {
  const { monthlyPlanId, yearlyPlanId } = getRazorpayServerConfig();
  if (interval === 'yearly') {
    return yearlyPlanId || null;
  }
  return monthlyPlanId || null;
}
