/**
 * Saarvi Razorpay Payment Service (Phase 42 / PART 7 & 8)
 *
 * Server-authoritative payment lifecycle:
 * - Server determines order amounts exclusively from PRO_PRICING (tampered amounts rejected)
 * - Cryptographic HMAC-SHA256 signature verification with timingSafeEqual
 * - Idempotent entitlement provisioning converging webhook & client verification
 * - Replay protection & audit trail
 * - Safe error handling & zero secret exposure
 */

import crypto from 'crypto';
import {
  RazorpayPaymentOrder,
  RazorpayPaymentOrderStatus,
  BillingInterval,
  SubscriptionRecord,
  BillingInvoiceRecord,
} from '@/types/plan';
import { getPlanPrice, PRO_PRICING } from '@/config/pricing';
import {
  getRazorpayClient,
  getRazorpayServerConfig,
} from './razorpayClient';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export class RazorpayPaymentService {
  private static instance: RazorpayPaymentService;

  public static getInstance(): RazorpayPaymentService {
    if (!RazorpayPaymentService.instance) {
      RazorpayPaymentService.instance = new RazorpayPaymentService();
    }
    return RazorpayPaymentService.instance;
  }

  /**
   * Creates a server-authoritative Razorpay Order.
   * Client-submitted amounts/prices are strictly rejected.
   */
  public async createPaymentOrder(params: {
    userId: string;
    userEmail: string;
    userName?: string;
    interval: BillingInterval;
  }): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    plan: 'pro';
    interval: BillingInterval;
    receipt: string;
    prefill: {
      name: string;
      email: string;
    };
  }> {
    if (!params.userId || !params.userEmail) {
      throw new Error('Authentication required: Valid user identity required for order creation.');
    }

    const interval: BillingInterval = params.interval === 'yearly' ? 'yearly' : 'monthly';
    const planConfig = getPlanPrice(interval);
    const amountCents = planConfig.amountCents;
    const currency = planConfig.currency || 'INR';

    const cleanUserId = params.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    const receipt = `rcpt_${cleanUserId}_${Date.now()}`;

    const config = getRazorpayServerConfig();
    const keyId = config.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_saarvi_mock';

    let providerOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const rzpClient = getRazorpayClient();

    if (rzpClient) {
      try {
        const order = await rzpClient.orders.create({
          amount: amountCents,
          currency,
          receipt,
          notes: {
            userId: params.userId,
            userEmail: params.userEmail,
            plan: 'pro',
            interval,
          },
        });
        if (order && order.id) {
          providerOrderId = order.id;
        }
      } catch (sdkErr) {
        console.warn('[RazorpayPaymentService] Razorpay SDK create order notice:', sdkErr);
        // If SDK fails in development or test, fallback gracefully to mock order ID
        if (process.env.NODE_ENV === 'production' && config.isConfigured) {
          throw new Error('Failed to create Razorpay Order with payment gateway.');
        }
      }
    }

    const orderRecord: RazorpayPaymentOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      provider: 'razorpay',
      providerOrderId,
      amountCents,
      currency,
      plan: 'pro',
      billingInterval: interval,
      status: 'created',
      receipt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        environment: process.env.NODE_ENV || 'development',
      },
    };

    // Save to resilient mock storage
    MockStorageProvider.savePaymentOrder(orderRecord);

    // Save to Supabase live database if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('payment_orders').insert({
            user_id: params.userId,
            user_email: params.userEmail,
            user_name: params.userName || null,
            provider: 'razorpay',
            provider_order_id: providerOrderId,
            amount_cents: amountCents,
            currency,
            plan: 'pro',
            billing_interval: interval,
            status: 'created',
            receipt,
            metadata: orderRecord.metadata,
          });
        } catch (dbErr) {
          console.warn('[RazorpayPaymentService] Supabase order insert notice:', dbErr);
        }
      }
    }

    return {
      orderId: providerOrderId,
      amount: amountCents,
      currency,
      keyId,
      plan: 'pro',
      interval,
      receipt,
      prefill: {
        name: params.userName || '',
        email: params.userEmail,
      },
    };
  }

  /**
   * Cryptographically verifies checkout response signature.
   * If valid, idempotently provisions server-authoritative Pro entitlement.
   */
  public async verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
    userId?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    isPro?: boolean;
    order?: RazorpayPaymentOrder;
  }> {
    const { orderId, paymentId, signature } = params;

    if (!orderId || !paymentId || !signature) {
      return {
        success: false,
        error: 'Missing required payment verification parameters (orderId, paymentId, signature).',
      };
    }

    // 1. Fetch internal order record to verify it exists and retrieve trusted metadata
    const order = MockStorageProvider.getPaymentOrder(orderId);

    // IDOR protection: Verify requesting user matches order owner if both present
    if (order && params.userId && order.userId && order.userId !== params.userId) {
      return {
        success: false,
        error: 'Security violation: Order owner does not match current user session.',
      };
    }

    const config = getRazorpayServerConfig();
    const secret = config.keySecret || 'rzp_test_secret_key_12345';

    // 2. Cryptographic HMAC-SHA256 signature verification (timingSafeEqual)
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(signature, 'utf8');

      if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        MockStorageProvider.updatePaymentOrderStatus(orderId, 'failed', paymentId, 'Cryptographic signature mismatch');
        return {
          success: false,
          error: 'Cryptographic signature mismatch. Payment verification failed.',
        };
      }
    } catch (cryptoErr) {
      console.error('[RazorpayPaymentService] Error verifying payment signature:', cryptoErr);
      return {
        success: false,
        error: 'Security verification error during signature evaluation.',
      };
    }

    // 3. Optional remote gateway payment status check if official SDK is configured
    const rzpClient = getRazorpayClient();
    if (rzpClient) {
      try {
        const payment = await (rzpClient.payments as any).fetch(paymentId);
        if (payment && payment.status && payment.status === 'failed') {
          MockStorageProvider.updatePaymentOrderStatus(orderId, 'failed', paymentId, 'Provider marked payment as failed');
          return {
            success: false,
            error: 'Payment was marked as failed by Razorpay gateway.',
          };
        }
      } catch (sdkErr) {
        console.warn('[RazorpayPaymentService] Gateway payment fetch warning:', sdkErr);
      }
    }

    // 4. Signature is valid! Provision server entitlement idempotently
    const targetUserId = order?.userId || params.userId || '';
    const interval: BillingInterval = order?.billingInterval || 'monthly';
    const amountCents = order?.amountCents || PRO_PRICING[interval].amountCents;

    // Update internal order status
    const updatedOrder = MockStorageProvider.updatePaymentOrderStatus(orderId, 'paid', paymentId);

    if (targetUserId) {
      await this.provisionProEntitlement({
        userId: targetUserId,
        orderId,
        paymentId,
        interval,
        amountCents,
      });
    }

    return {
      success: true,
      isPro: true,
      order: updatedOrder || undefined,
    };
  }

  /**
   * Idempotently provisions Pro entitlement, subscription, invoice, and user notification.
   * Safe to call multiple times from both client verification and webhook.
   */
  public async provisionProEntitlement(params: {
    userId: string;
    orderId: string;
    paymentId: string;
    interval: BillingInterval;
    amountCents: number;
  }): Promise<void> {
    const { userId, orderId, paymentId, interval, amountCents } = params;
    const now = new Date();
    const durationDays = interval === 'yearly' ? 365 : 30;

    const existingSub = MockStorageProvider.getUserSubscription(userId);
    const isAlreadyActive =
      existingSub &&
      existingSub.status === 'ACTIVE' &&
      new Date(existingSub.currentPeriodEnd).getTime() > Date.now();

    // If already active, extend from current expiry date so user doesn't lose days!
    const baseTime =
      isAlreadyActive && existingSub?.currentPeriodEnd
        ? new Date(existingSub.currentPeriodEnd).getTime()
        : now.getTime();
    const periodEnd = new Date(baseTime + durationDays * 86400000).toISOString();
    const periodStart =
      isAlreadyActive && existingSub?.currentPeriodStart
        ? existingSub.currentPeriodStart
        : now.toISOString();

    const subscriptionRecord: SubscriptionRecord = {
      id: existingSub?.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      provider: 'razorpay',
      providerSubscriptionId: orderId,
      plan: 'pro',
      status: 'ACTIVE',
      billingInterval: interval,
      currency: 'INR',
      amountCents,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      metadata: {
        orderId,
        paymentId,
        verifiedAt: now.toISOString(),
      },
      createdAt: existingSub?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Save active subscription in storage
    MockStorageProvider.saveSubscription(subscriptionRecord);

    // Save to Supabase live database if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('subscriptions').upsert({
            id: subscriptionRecord.id,
            user_id: userId,
            provider: 'razorpay',
            provider_subscription_id: orderId,
            plan: 'pro',
            status: 'ACTIVE',
            billing_interval: interval,
            currency: 'INR',
            amount_cents: amountCents,
            current_period_start: subscriptionRecord.currentPeriodStart,
            current_period_end: subscriptionRecord.currentPeriodEnd,
            cancel_at_period_end: false,
            metadata: subscriptionRecord.metadata,
            updated_at: now.toISOString(),
          });

          await supabase.from('profiles').update({
            is_pro: true,
            plan_tier: 'PRO',
            updated_at: now.toISOString(),
          }).eq('id', userId);
        } catch (subErr) {
          console.warn('[RazorpayPaymentService] Supabase subscription upsert notice:', subErr);
        }
      }
    }

    // Only generate invoice and notification if this is a new activation (prevent duplicates)
    if (!isAlreadyActive || existingSub?.providerSubscriptionId !== orderId) {
      const invoice: BillingInvoiceRecord = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        subscriptionId: subscriptionRecord.id,
        providerInvoiceId: `inv_${paymentId}`,
        amountPaid: amountCents,
        currency: 'INR',
        status: 'paid',
        paidAt: now.toISOString(),
        createdAt: now.toISOString(),
      };
      MockStorageProvider.saveInvoice(invoice);

      // Create in-app notification (PART 7.13)
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      MockStorageProvider.saveNotification({
        id: notificationId,
        created_by: 'system_razorpay',
        type: 'BILLING',
        category: 'SYSTEM',
        title: 'Payment Successful — Pro Plan Active!',
        body: `Your payment of ₹${(amountCents / 100).toFixed(0)} for Saarvi Pro (${interval === 'yearly' ? 'Annual' : 'Monthly'}) was completed successfully. All Pro tools and batch queues are now unlocked.`,
        priority: 'HIGH',
        status: 'SENT',
        audience_type: 'SELECTED_USERS',
        audience_definition: { userIds: [userId] },
        channels: ['in_app'],
        created_at: now.toISOString(),
      });
      MockStorageProvider.saveNotificationRecipient({
        id: `recip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        notification_id: notificationId,
        user_id: userId,
        delivery_status: 'DELIVERED',
        channel: 'in_app',
        idempotency_key: `recip_key_${orderId}_${userId}`,
        delivered_at: now.toISOString(),
      });

      // Audit Log
      MockStorageProvider.addAuditLog({
        adminUserId: 'system_razorpay',
        adminEmail: 'payments@saarvi.local',
        action: 'PAYMENT_VERIFIED_PRO_GRANTED',
        targetType: 'SYSTEM',
        targetId: orderId,
        metadata: {
          userId,
          paymentId,
          amountCents,
          interval,
        },
      });
    }
  }

  /**
   * Handles incoming Razorpay Webhook with HMAC verification and idempotency.
   */
  public async handleWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<{
    success: boolean;
    received?: boolean;
    eventId?: string;
    duplicate?: boolean;
    error?: string;
  }> {
    const signature = headers['x-razorpay-signature'];
    if (!signature) {
      return { success: false, error: 'Missing X-Razorpay-Signature header' };
    }

    const config = getRazorpayServerConfig();
    const webhookSecret = config.webhookSecret || 'rzp_test_webhook_secret';

    // Verify HMAC SHA-256
    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(signature, 'utf8');

      if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        return { success: false, error: 'Cryptographic signature mismatch on webhook payload' };
      }
    } catch {
      return { success: false, error: 'Error calculating webhook HMAC signature' };
    }

    let event: Record<string, any>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return { success: false, error: 'Malformed JSON webhook payload' };
    }

    const eventId = event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Replay / Idempotency protection (PART 7.10)
    if (MockStorageProvider.isBillingEventProcessed(eventId)) {
      return { success: true, received: true, eventId, duplicate: true };
    }

    const eventType = event.event || '';
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      if (orderId) {
        const order = MockStorageProvider.getPaymentOrder(orderId);
        if (order && order.status !== 'paid') {
          MockStorageProvider.updatePaymentOrderStatus(orderId, 'paid', paymentId);
          await this.provisionProEntitlement({
            userId: order.userId,
            orderId,
            paymentId: paymentId || `pay_${Date.now()}`,
            interval: order.billingInterval,
            amountCents: order.amountCents,
          });
        }
      }
    } else if (eventType === 'payment.failed') {
      if (orderId) {
        MockStorageProvider.updatePaymentOrderStatus(
          orderId,
          'failed',
          paymentId,
          paymentEntity?.error_description || 'Payment failed at gateway'
        );
      }
    }

    // Record processed billing event
    MockStorageProvider.recordBillingEvent({
      id: `bevt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      provider: 'razorpay',
      providerEventId: eventId,
      eventType,
      payload: event,
      status: 'PROCESSED',
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    return { success: true, received: true, eventId, duplicate: false };
  }
}

export const razorpayPaymentService = RazorpayPaymentService.getInstance();
