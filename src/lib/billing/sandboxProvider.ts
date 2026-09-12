// DocEase Phase 13: Sandbox / Test Mode Billing Provider
// Provides deterministic sandbox testing, CI test execution, and end-to-end checkout flow without live credentials.

import {
  BillingProvider,
} from './provider';
import {
  CheckoutSessionParams,
  CheckoutSessionResponse,
  WebhookVerificationResult,
  SubscriptionRecord,
} from '@/types/plan';
import { getPlanPrice } from '@/config/pricing';

export class SandboxBillingProvider implements BillingProvider {
  readonly name = 'sandbox' as const;

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    const price = getPlanPrice(params.interval);
    const sessionId = `sbx_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const providerSubId = `sbx_sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const checkoutUrl = `/checkout/confirmation?session_id=${sessionId}&provider=sandbox&sub_id=${providerSubId}&interval=${params.interval}`;

    return {
      sessionId,
      provider: this.name,
      checkoutUrl,
      providerSubscriptionId: providerSubId,
      amount: price.amountCents,
      currency: price.currency,
    };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    try {
      const signature = headers['x-sandbox-signature'] || headers['x-saarvi-sandbox-auth'] || headers['x-docease-sandbox-auth'];
      const secret = process.env.BILLING_WEBHOOK_SECRET || 'sandbox_secret_bypass_test';

      // Verify signature in sandbox
      if (signature && signature !== secret && signature !== 'valid_sandbox_sig') {
        return {
          isValid: false,
          error: 'Invalid sandbox webhook signature',
        };
      }

      const body = JSON.parse(rawBody);
      const eventType = body.eventType || body.event || 'subscription.activated';
      const eventId = body.eventId || body.id || `sbx_evt_${Date.now()}`;
      const subId = body.subscriptionId || body.providerSubscriptionId || body.payload?.subscriptionId;

      const now = new Date();
      const periodEnd = new Date(now);
      const interval = body.interval || 'monthly';
      if (interval === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      return {
        isValid: true,
        eventId,
        eventType,
        providerSubscriptionId: subId,
        providerCustomerId: body.customerId || `sbx_cust_${Date.now()}`,
        status: body.status || (eventType.includes('cancel') ? 'CANCELLED' : 'ACTIVE'),
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: body.cancelAtPeriodEnd || false,
        rawEvent: body,
      };
    } catch (err) {
      return {
        isValid: false,
        error: err instanceof Error ? err.message : 'Failed to parse sandbox webhook payload',
      };
    }
  }

  async getSubscription(providerSubscriptionId: string): Promise<Partial<SubscriptionRecord> | null> {
    return {
      providerSubscriptionId,
      status: 'ACTIVE',
      plan: 'pro',
    };
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<{ status: string; cancelAtPeriodEnd: boolean }> {
    return {
      status: atPeriodEnd ? 'ACTIVE' : 'CANCELLED',
      cancelAtPeriodEnd: atPeriodEnd,
    };
  }

  async getBillingPortalUrl(providerCustomerId: string): Promise<string> {
    return `/dashboard/billing?customer=${providerCustomerId}`;
  }
}
