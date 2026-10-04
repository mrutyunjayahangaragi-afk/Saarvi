/**
 * Saarvi Razorpay Payment Service (Server-Authoritative Core)
 *
 * Implements:
 * - Server determines order amounts exclusively from PRO_PRICING & CANONICAL_PLANS
 * - Tampered amounts or client-supplied pricing are strictly rejected
 * - Cryptographic HMAC-SHA256 signature verification with timingSafeEqual
 * - Idempotent entitlement provisioning converging webhook & client verification
 * - Cumulative Pro duration extension (never cuts short remaining active days)
 * - Official Razorpay SDK Refund workflow
 * - In-app notifications and transactional emails
 * - Safe error handling & zero secret exposure
 */

import crypto from 'crypto';
import {
  RazorpayPaymentOrder,
  BillingInterval,
  SubscriptionRecord,
  BillingInvoiceRecord,
} from '@/types/plan';
import { getPlanPrice, PRO_PRICING } from '@/config/pricing';
import { CANONICAL_PLANS, getCanonicalPlan } from '@/config/plans';
import {
  getRazorpayClient,
  getRazorpayServerConfig,
} from './razorpayClient';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { grantOrExtendProEntitlement } from '@/lib/payments/entitlement-service';
import { GmailSmtpEmailProvider } from '@/lib/notifications/providers/email/gmail-provider';

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
    interval?: BillingInterval;
    planId?: string;
  }): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    plan: 'pro';
    interval: BillingInterval;
    planId: string;
    receipt: string;
    prefill: {
      name: string;
      email: string;
    };
  }> {
    if (!params.userId || !params.userEmail) {
      throw new Error('Authentication required: Valid user identity required for order creation.');
    }

    const interval: BillingInterval =
      params.interval === 'yearly' || (params.planId && params.planId.includes('year'))
        ? 'yearly'
        : 'monthly';

    const planConfig = getPlanPrice(interval);
    const amountCents = planConfig.amountCents;
    const currency = planConfig.currency || 'INR';
    const canonicalPlan = interval === 'yearly' ? getCanonicalPlan('pro_yearly') : getCanonicalPlan('pro_30_days');

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
            planId: canonicalPlan.id,
            interval,
          },
        });
        if (order && order.id) {
          providerOrderId = order.id;
        }
      } catch (sdkErr) {
        console.warn('[RazorpayPaymentService] Razorpay SDK create order notice:', sdkErr);
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
        planId: canonicalPlan.id,
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
            plan_id: canonicalPlan.id,
            provider: 'razorpay',
            provider_order_id: providerOrderId,
            order_reference: providerOrderId,
            amount_paise: amountCents,
            currency,
            plan: 'pro',
            billing_interval: interval,
            status: 'CREATED',
            receipt,
            environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX',
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
      planId: canonicalPlan.id,
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
    order?: any;
    paymentId?: string;
  }> {
    const { orderId, paymentId, signature } = params;

    if (!orderId || !paymentId || !signature) {
      return {
        success: false,
        error: 'Missing required payment verification parameters (orderId, paymentId, signature).',
      };
    }

    // 1. Fetch internal order record from storage or Supabase
    let order: any = MockStorageProvider.getPaymentOrder(orderId);
    let supabaseOrder: any = null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data } = await supabase
            .from('payment_orders')
            .select('*')
            .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`)
            .maybeSingle();
          if (data) {
            supabaseOrder = data;
            if (!order) {
              order = {
                id: data.id,
                userId: data.user_id,
                userEmail: data.user_email || data.metadata?.user_email,
                userName: data.user_name || data.metadata?.user_name,
                provider: data.provider || 'razorpay',
                providerOrderId: data.provider_order_id,
                amountCents: data.amount_paise || data.amount_cents || 9900,
                currency: data.currency || 'INR',
                plan: data.plan || 'pro',
                billingInterval: data.billing_interval || data.metadata?.interval || 'monthly',
                status: data.status,
                receipt: data.receipt,
                metadata: data.metadata,
              };
            }
          }
        } catch (dbErr) {
          console.warn('[RazorpayPaymentService] Supabase order fetch notice:', dbErr);
        }
      }
    }

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
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseAdminClient();
          if (supabase) {
            await supabase
              .from('payment_orders')
              .update({ status: 'FAILED', updated_at: new Date().toISOString() })
              .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`);
          }
        }
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
    const targetUserId = order?.userId || supabaseOrder?.user_id || params.userId || '';
    const interval: BillingInterval =
      order?.billingInterval || supabaseOrder?.billing_interval || 'monthly';
    const amountCents =
      order?.amountCents || supabaseOrder?.amount_paise || PRO_PRICING[interval].amountCents;
    const planId =
      order?.metadata?.planId || supabaseOrder?.plan_id || (interval === 'yearly' ? 'pro_yearly' : 'pro_30_days');

    // Update internal order status
    const updatedOrder = MockStorageProvider.updatePaymentOrderStatus(orderId, 'paid', paymentId);
    const now = new Date();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase && targetUserId) {
        try {
          // Update payment_orders
          await supabase
            .from('payment_orders')
            .update({
              status: 'CAPTURED',
              provider_payment_id: paymentId,
              updated_at: now.toISOString(),
            })
            .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`);

          // Insert or update payment_transactions
          const internalOrderId = supabaseOrder?.id || order?.id;
          if (internalOrderId) {
            await supabase.from('payment_transactions').upsert(
              {
                payment_order_id: internalOrderId,
                user_id: targetUserId,
                provider: 'razorpay',
                provider_payment_id: paymentId,
                amount_paise: amountCents,
                currency: 'INR',
                status: 'SUCCESS',
                payment_method: 'RAZORPAY_CHECKOUT',
                captured_at: now.toISOString(),
              },
              { onConflict: 'provider,provider_payment_id' }
            );
          }
        } catch (dbErr) {
          console.warn('[RazorpayPaymentService] Supabase verification update notice:', dbErr);
        }
      }
    }

    if (targetUserId) {
      await this.provisionProEntitlement({
        userId: targetUserId,
        orderId,
        paymentId,
        interval,
        amountCents,
        planId,
      });
    }

    return {
      success: true,
      isPro: true,
      order: updatedOrder || supabaseOrder || undefined,
      paymentId,
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
    planId?: string;
  }): Promise<void> {
    const { userId, orderId, paymentId, interval, amountCents } = params;
    const now = new Date();
    const durationDays = interval === 'yearly' ? 365 : 30;
    const planId = params.planId || (interval === 'yearly' ? 'pro_yearly' : 'pro_30_days');

    // 1. Cumulative extension via centralized entitlement service
    let entitlementResult: any = null;
    try {
      entitlementResult = await grantOrExtendProEntitlement({
        userId,
        planId,
        durationDays,
        source: 'RAZORPAY',
        transactionId: paymentId,
      });
    } catch (entErr) {
      console.warn('[RazorpayPaymentService] Entitlement service grant warning:', entErr);
    }

    const existingSub = MockStorageProvider.getUserSubscription(userId);
    const isAlreadyActive =
      existingSub &&
      existingSub.status === 'ACTIVE' &&
      new Date(existingSub.currentPeriodEnd).getTime() > Date.now();

    const periodEnd =
      entitlementResult?.endsAt ||
      (isAlreadyActive && existingSub?.currentPeriodEnd
        ? new Date(new Date(existingSub.currentPeriodEnd).getTime() + durationDays * 86400000).toISOString()
        : new Date(now.getTime() + durationDays * 86400000).toISOString());

    const periodStart =
      entitlementResult?.startsAt ||
      (isAlreadyActive && existingSub?.currentPeriodStart
        ? existingSub.currentPeriodStart
        : now.toISOString());

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
        planId,
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
          await supabase.from('subscriptions').upsert(
            {
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
            },
            { onConflict: 'user_id' }
          );

          await supabase.from('profiles').update({
            plan: 'pro',
            is_pro: true,
            plan_tier: 'PRO',
            updated_at: now.toISOString(),
          }).eq('id', userId);
        } catch (subErr) {
          console.warn('[RazorpayPaymentService] Supabase subscription upsert notice:', subErr);
        }
      }
    }

    // Only generate invoice, notification, and email if this is a new activation (prevent duplicate emails)
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

      // Create in-app notification
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      MockStorageProvider.saveNotification({
        id: notificationId,
        created_by: 'system_razorpay',
        type: 'BILLING',
        category: 'SYSTEM',
        title: 'Saarvi Pro Activated 🎉',
        body: `Your payment of ₹${(amountCents / 100).toFixed(0)} for Saarvi Pro (${interval === 'yearly' ? 'Annual / 365 Days' : 'Monthly / 30 Days'}) was confirmed. All Pro tools and 50-file batch queues are now active.`,
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

      // Send transactional confirmation email via Gmail SMTP (fail-safe)
      try {
        const emailProvider = new GmailSmtpEmailProvider();
        if (emailProvider.isConfigured()) {
          const userOrder = MockStorageProvider.getPaymentOrder(orderId);
          const recipientEmail = userOrder?.userEmail;
          if (recipientEmail) {
            await emailProvider.sendTransactionalEmail({
              to: recipientEmail,
              subject: 'Your Saarvi Pro plan is now active! 🎉',
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
                  <h2 style="color: #2563eb; margin-bottom: 16px;">Welcome to Saarvi Pro!</h2>
                  <p>Your payment was completed successfully via Razorpay. Your Saarvi Pro access is now active.</p>
                  <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 4px 0;"><strong>Plan:</strong> Saarvi Pro (${interval === 'yearly' ? 'Annual' : 'Monthly'})</p>
                    <p style="margin: 4px 0;"><strong>Amount Paid:</strong> ₹${(amountCents / 100).toFixed(0)} INR</p>
                    <p style="margin: 4px 0;"><strong>Duration:</strong> ${durationDays} Days</p>
                    <p style="margin: 4px 0;"><strong>Transaction Reference:</strong> ${paymentId}</p>
                    <p style="margin: 4px 0;"><strong>Valid Until:</strong> ${new Date(periodEnd).toLocaleDateString()}</p>
                  </div>
                  <p>You can now use high-capacity 50-file batch queues, 100MB conversions, and all executive student tools.</p>
                  <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Saarvi Educational Platform • Study. Work. Grow.</p>
                </div>
              `,
              text: `Welcome to Saarvi Pro! Your payment of ₹${(amountCents / 100).toFixed(0)} for ${durationDays} days of Pro access has been confirmed. Ref: ${paymentId}`,
            });
          }
        }
      } catch (emailErr) {
        console.warn('[RazorpayPaymentService] Transactional email notice:', emailErr);
      }

      // Audit Log
      MockStorageProvider.addAuditLog({
        adminUserId: 'system_razorpay',
        adminEmail: 'payments@saarvi.app',
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
   * Official Razorpay Refund Workflow
   * Authoritatively issues refund via Razorpay SDK and revokes/adjusts Pro entitlement.
   */
  public async createRefund(params: {
    orderId: string;
    amount?: number; // in Rupees
    reason?: string;
  }): Promise<{
    success: boolean;
    refundId?: string;
    orderId: string;
    amount: number;
    error?: string;
  }> {
    const { orderId, amount, reason } = params;

    if (!orderId) {
      throw new Error('Order identifier is required for refund.');
    }

    const order = MockStorageProvider.getPaymentOrder(orderId);
    let paymentId = order?.providerPaymentId || '';

    // Check live database if paymentId not found in mock storage
    if (!paymentId && isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data } = await supabase
          .from('payment_orders')
          .select('provider_payment_id, user_id, amount_paise')
          .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`)
          .maybeSingle();
        if (data) {
          paymentId = data.provider_payment_id || '';
        }
      }
    }

    const refundAmountRupees = amount || (order ? order.amountCents / 100 : 99);
    const refundAmountPaise = Math.round(refundAmountRupees * 100);

    let refundId = `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Call official Razorpay SDK if configured
    const rzpClient = getRazorpayClient();
    if (rzpClient && paymentId && !paymentId.startsWith('pay_mock')) {
      try {
        const refundResponse = await (rzpClient.payments as any).refund(paymentId, {
          amount: refundAmountPaise,
          notes: {
            reason: reason || 'Customer requested refund',
            orderId,
          },
        });
        if (refundResponse && refundResponse.id) {
          refundId = refundResponse.id;
        }
      } catch (sdkErr: any) {
        console.error('[Razorpay Refund Error]:', sdkErr);
        throw new Error(sdkErr?.error?.description || sdkErr?.message || 'Failed to issue refund with Razorpay.');
      }
    }

    // Update order status in storage
    MockStorageProvider.updatePaymentOrderStatus(orderId, 'failed', paymentId, `Refunded: ${refundId}`);

    // Update Supabase tables
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase
            .from('payment_orders')
            .update({ status: 'REFUNDED', updated_at: new Date().toISOString() })
            .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`);

          if (order?.userId) {
            await supabase
              .from('entitlements')
              .update({ status: 'REVOKED', updated_at: new Date().toISOString() })
              .eq('user_id', order.userId)
              .eq('status', 'ACTIVE');

            await supabase
              .from('subscriptions')
              .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
              .eq('user_id', order.userId)
              .eq('status', 'ACTIVE');

            await supabase
              .from('profiles')
              .update({ plan: 'free', is_pro: false, plan_tier: 'FREE', updated_at: new Date().toISOString() })
              .eq('id', order.userId);
          }
        } catch (dbErr) {
          console.warn('[RazorpayPaymentService] Supabase refund update warning:', dbErr);
        }
      }
    }

    return {
      success: true,
      refundId,
      orderId,
      amount: refundAmountRupees,
    };
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

    // Replay / Idempotency protection
    if (MockStorageProvider.isBillingEventProcessed(eventId)) {
      return { success: true, received: true, eventId, duplicate: true };
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data: existing } = await supabase
          .from('payment_webhook_events')
          .select('id, processed')
          .eq('provider', 'razorpay')
          .eq('event_id', eventId)
          .maybeSingle();

        if (existing) {
          return { success: true, received: true, eventId, duplicate: true };
        }

        const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
        await supabase.from('payment_webhook_events').insert({
          provider: 'razorpay',
          event_id: eventId,
          event_type: event.event || 'UNKNOWN',
          signature_verified: true,
          processed: false,
          payload_hash: payloadHash,
        });
      }
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

        if (isSupabaseConfigured()) {
          const supabase = getSupabaseAdminClient();
          if (supabase) {
            const { data: dbOrder } = await supabase
              .from('payment_orders')
              .select('*')
              .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`)
              .maybeSingle();

            if (dbOrder && dbOrder.status !== 'CAPTURED') {
              const now = new Date();
              await supabase
                .from('payment_orders')
                .update({
                  status: 'CAPTURED',
                  provider_payment_id: paymentId,
                  updated_at: now.toISOString(),
                })
                .eq('id', dbOrder.id);

              await this.provisionProEntitlement({
                userId: dbOrder.user_id,
                orderId,
                paymentId: paymentId || `pay_${Date.now()}`,
                interval: (dbOrder.billing_interval || 'monthly') as BillingInterval,
                amountCents: dbOrder.amount_paise || 9900,
                planId: dbOrder.plan_id || 'pro_30_days',
              });

              await supabase
                .from('payment_webhook_events')
                .update({ processed: true, processed_at: now.toISOString() })
                .eq('event_id', eventId);
            }
          }
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
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseAdminClient();
          if (supabase) {
            await supabase
              .from('payment_orders')
              .update({ status: 'FAILED', updated_at: new Date().toISOString() })
              .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`);
          }
        }
      }
    } else if (eventType === 'refund.processed' || eventType === 'refund.created') {
      if (orderId) {
        MockStorageProvider.updatePaymentOrderStatus(orderId, 'failed', paymentId, 'Refunded');
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseAdminClient();
          if (supabase) {
            await supabase
              .from('payment_orders')
              .update({ status: 'REFUNDED', updated_at: new Date().toISOString() })
              .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`);
          }
        }
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
