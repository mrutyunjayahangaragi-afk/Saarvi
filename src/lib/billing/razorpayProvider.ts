// DocEase Phase 14A: Razorpay Billing Provider Adapter
// Tailored for the Indian market: Cards (Credit/Debit) & UPI (Mobile Intent, Desktop QR, App selection)
// Integrates official Razorpay SDK client strictly on the server with plan ID resolution and payload redaction.

import crypto from 'crypto';
import { BillingProvider } from './provider';
import {
  CheckoutSessionParams,
  CheckoutSessionResponse,
  WebhookVerificationResult,
  SubscriptionRecord,
  SubscriptionStatus,
} from '@/types/plan';
import { getPlanPrice } from '@/config/pricing';
import {
  getRazorpayClient,
  getRazorpayServerConfig,
  resolveRazorpayPlanId,
} from './razorpayClient';

export class RazorpayBillingProvider implements BillingProvider {
  readonly name = 'razorpay' as const;

  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor() {
    const config = getRazorpayServerConfig();
    this.keyId = config.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret;
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    const price = getPlanPrice(params.interval);
    const planId = resolveRazorpayPlanId(params.interval);

    // Section 9 Requirement: Resolve Razorpay plan ID from env.
    // If running in live production with Razorpay keys configured but plan ID is missing, throw safe billing error.
    if (this.keyId && this.keySecret && !planId && process.env.NODE_ENV === 'production') {
      const err = new Error(`Billing configuration error: Razorpay plan ID for ${params.interval} is not configured.`);
      (err as unknown as { code: string }).code = 'BILLING_NOT_CONFIGURED';
      throw err;
    }

    let providerSubscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let providerOrderId: string | undefined;

    const rzpClient = getRazorpayClient();

    if (rzpClient) {
      try {
        if (planId) {
          // Razorpay recurring subscription via official SDK
          const sub = await rzpClient.subscriptions.create({
            plan_id: planId,
            total_count: params.interval === 'yearly' ? 5 : 60,
            quantity: 1,
            customer_notify: 1,
            notes: {
              userId: params.userId,
              userEmail: params.userEmail,
              plan: params.plan,
              interval: params.interval,
            },
          });
          if (sub && sub.id) {
            providerSubscriptionId = sub.id;
          }
        } else {
          // Order-based checkout for Card / UPI
          const order = await rzpClient.orders.create({
            amount: price.amountCents,
            currency: 'INR',
            receipt: `rcpt_${params.userId.substring(0, 8)}_${Date.now()}`,
            notes: {
              userId: params.userId,
              userEmail: params.userEmail,
              plan: params.plan,
              interval: params.interval,
            },
          });
          if (order && order.id) {
            providerOrderId = order.id;
          }
        }
      } catch (err) {
        console.warn('Razorpay SDK creation fallback:', err);
      }
    }

    const sessionId = `rzp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      sessionId,
      provider: this.name,
      providerSubscriptionId,
      providerOrderId,
      keyId: this.keyId,
      amount: price.amountCents,
      currency: price.currency,
      checkoutUrl: `/checkout/confirmation?session_id=${sessionId}&provider=razorpay&sub_id=${providerSubscriptionId}&interval=${params.interval}`,
      prefill: {
        email: params.userEmail,
        name: params.userName || '',
      },
      notes: {
        userId: params.userId,
        plan: params.plan,
        interval: params.interval,
      },
    };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    const signature = headers['x-razorpay-signature'];
    if (!signature) {
      return {
        isValid: false,
        error: 'Missing X-Razorpay-Signature header',
      };
    }

    if (!this.webhookSecret) {
      // In production when secret is not set, reject to prevent insecure fallback
      if (process.env.NODE_ENV === 'production') {
        return { isValid: false, error: 'Razorpay webhook secret is not configured' };
      }
    }

    // Cryptographic HMAC SHA-256 verification
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret || 'rzp_test_secret_key_12345')
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
        return {
          isValid: false,
          error: 'Cryptographic signature mismatch on Razorpay webhook',
        };
      }
    } catch {
      return {
        isValid: false,
        error: 'Error evaluating webhook signature',
      };
    }

    try {
      const event = JSON.parse(rawBody);
      const eventType = event.event;

      const subEntity = event.payload?.subscription?.entity;
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      const eventId =
        event.id ||
        (subEntity?.id ? `${event.event}_${subEntity.id}_${event.created_at || Date.now()}` : '') ||
        (paymentEntity?.id ? `${event.event}_${paymentEntity.id}_${event.created_at || Date.now()}` : '') ||
        `rzp_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const providerSubscriptionId =
        subEntity?.id ||
        paymentEntity?.subscription_id ||
        paymentEntity?.notes?.providerSubscriptionId ||
        paymentEntity?.notes?.subscription_id ||
        orderEntity?.notes?.providerSubscriptionId;

      const providerCustomerId = subEntity?.customer_id || paymentEntity?.customer_id;

      // Map Razorpay event types to internal subscription status
      let status: SubscriptionStatus = 'ACTIVE';
      if (eventType === 'subscription.cancelled') {
        status = 'CANCELLED';
      } else if (eventType === 'subscription.completed') {
        status = 'EXPIRED';
      } else if (eventType === 'subscription.pending' || eventType === 'subscription.halted' || eventType === 'payment.failed') {
        status = 'PAST_DUE';
      } else if (
        eventType === 'subscription.authenticated' ||
        eventType === 'subscription.activated' ||
        eventType === 'subscription.charged' ||
        eventType === 'payment.captured' ||
        eventType === 'order.paid'
      ) {
        status = 'ACTIVE';
      }

      const start = subEntity?.current_start
        ? new Date(subEntity.current_start * 1000).toISOString()
        : new Date().toISOString();

      const end = subEntity?.current_end
        ? new Date(subEntity.current_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      return {
        isValid: true,
        eventId,
        eventType,
        providerSubscriptionId,
        providerCustomerId,
        status,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: subEntity?.ended_at ? true : false,
        rawEvent: redactSensitiveData(event) as Record<string, unknown>,
      };
    } catch (err) {
      return {
        isValid: false,
        error: err instanceof Error ? err.message : 'Failed to parse Razorpay webhook payload',
      };
    }
  }

  async getSubscription(providerSubscriptionId: string): Promise<Partial<SubscriptionRecord> | null> {
    if (!this.keyId || !this.keySecret) {
      return null;
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
      const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${providerSubscriptionId}`, {
        headers: { Authorization: authHeader },
      });

      if (!res.ok) return null;
      const data = await res.json();

      let status: SubscriptionStatus = 'ACTIVE';
      if (data.status === 'cancelled') status = 'CANCELLED';
      else if (data.status === 'completed') status = 'EXPIRED';
      else if (data.status === 'pending' || data.status === 'halted') status = 'PAST_DUE';

      return {
        providerSubscriptionId: data.id,
        status,
        currentPeriodStart: new Date(data.current_start * 1000).toISOString(),
        currentPeriodEnd: new Date(data.current_end * 1000).toISOString(),
      };
    } catch {
      return null;
    }
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<{ status: string; cancelAtPeriodEnd: boolean }> {
    const rzpClient = getRazorpayClient();

    if (rzpClient) {
      try {
        await rzpClient.subscriptions.cancel(providerSubscriptionId, atPeriodEnd);
      } catch (err) {
        console.warn('Razorpay SDK cancel request failed:', err);
      }
    } else if (this.keyId && this.keySecret) {
      try {
        const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
        await fetch(`https://api.razorpay.com/v1/subscriptions/${providerSubscriptionId}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            cancel_at_cycle_end: atPeriodEnd ? 1 : 0,
          }),
        });
      } catch (err) {
        console.warn('Razorpay cancel request failed:', err);
      }
    }

    return {
      status: atPeriodEnd ? 'ACTIVE' : 'CANCELLED',
      cancelAtPeriodEnd: atPeriodEnd,
    };
  }
}

/**
 * Section 25 Requirement: Redacts sensitive fields (CVV, UPI PIN, secrets, passwords, full card PAN)
 * before persisting payload into billing_events or audit storage.
 */
function redactSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveData);

  const clean: Record<string, unknown> = {};
  const prohibitedKeys = new Set([
    'cvv',
    'cvc',
    'upipin',
    'upi_pin',
    'password',
    'key_secret',
    'secret',
    'card_number',
    'pan',
  ]);

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (prohibitedKeys.has(k.toLowerCase())) {
      continue; // redact completely
    }
    clean[k] = typeof v === 'object' ? redactSensitiveData(v) : v;
  }
  return clean;
}

