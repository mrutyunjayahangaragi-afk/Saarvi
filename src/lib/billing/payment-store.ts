/**
 * Saarvi Pro Payment Store & Entitlement Orchestrator
 * Authoritative single source of truth for Manual UPI Payment Configuration,
 * Payment Requests, Proof Review, SLA Tracking, and Server-Side Pro Activation.
 */

import { MockStorageProvider } from "@/lib/supabase/mock-storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SubscriptionRecord, BillingInvoiceRecord } from "@/types/plan";
import { isValidUpiId, generatePaymentReference, UpiAppProvider } from "./upi-intent";

export interface PaymentConfig {
  manualUpiEnabled: boolean;
  upiId: string;
  qrImageUrl: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  paymentInstructions: string;
  razorpayStatus: "COMING_SOON" | "ACTIVE" | "DISABLED";
  reviewSlaMinutes: number;
  updatedAt: string;
  updatedBy: string;
}

export type PaymentRequestStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface PaymentRequestRecord {
  id: string;
  referenceNumber: string;
  userId: string;
  userEmail: string;
  userName?: string;
  plan: "monthly" | "yearly";
  amount: number;
  currency: string;
  paymentMethod: "UPI_INTENT" | "QR_MANUAL";
  provider: UpiAppProvider;
  upiIdSnapshot: string;
  utrNumber?: string;
  proofUrl?: string;
  status: PaymentRequestStatus;
  submittedAt: string;
  reviewDeadline: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
  entitlementId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequestParams {
  userId: string;
  userEmail: string;
  userName?: string;
  plan?: "monthly" | "yearly";
  planDuration?: "MONTHLY" | "YEARLY";
  paymentMethod?: "UPI_INTENT" | "QR_MANUAL";
  provider?: UpiAppProvider;
  utrNumber: string;
  payerUpiId?: string;
  proofUrl?: string;
  paymentProofUrl?: string;
}

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  manualUpiEnabled: true,
  upiId: process.env.UPI_VPA || "9036745164-3@axl",
  qrImageUrl: null,
  monthlyPrice: 99,
  yearlyPrice: 899,
  currency: "INR",
  paymentInstructions:
    "1. Open your UPI application (PhonePe, Google Pay, or Paytm).\n2. Tap pay or scan the QR code.\n3. Verify the recipient name shows 'Saarvi'.\n4. Complete the transaction.\n5. Copy the 12-digit UTR/transaction reference number and submit it here for verification.",
  razorpayStatus: "COMING_SOON",
  reviewSlaMinutes: 120, // 2-hour SLA target
  updatedAt: "2026-01-01T00:00:00.000Z",
  updatedBy: "system",
};

// In-memory runtime cache for high-throughput reads
let runtimeConfig: PaymentConfig = { ...DEFAULT_PAYMENT_CONFIG };
let runtimeRequests: PaymentRequestRecord[] = [];
let hasHydratedFromSupabase = false;

import { resolvePaymentQrImage, isValidQrUrl } from "./qr-resolver";

async function hydratePaymentFromSupabase(): Promise<void> {
  if (typeof window !== "undefined") return;
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    const [configRes, requestsRes] = await Promise.all([
      supabase.from("payment_configs").select("*").eq("id", "default").maybeSingle(),
      supabase.from("manual_payment_requests").select("*").order("created_at", { ascending: false }),
    ]);

    if (configRes.data && !configRes.error) {
      const row = configRes.data;
      let qrUrl = row.qr_code_url || runtimeConfig.qrImageUrl;

      // Auto-recovery: If DB has null qr_code_url, check if files exist in storage bucket
      if (!qrUrl) {
        try {
          const { data: files } = await supabase.storage.from("payment-assets").list("qr-codes");
          if (files && files.length > 0) {
            // Sort by updated_at or name descending to pick latest
            const sorted = [...files].sort((a, b) =>
              new Date(b.updated_at || b.created_at || 0).getTime() -
              new Date(a.updated_at || a.created_at || 0).getTime()
            );
            if (sorted[0]?.name) {
              qrUrl = `qr-codes/${sorted[0].name}`;
              // Update payment_configs so DB is in sync
              await supabase.from("payment_configs").update({ qr_code_url: qrUrl }).eq("id", "default");
            }
          }
        } catch {}
      }

      runtimeConfig = {
        ...runtimeConfig,
        upiId: row.upi_id || runtimeConfig.upiId,
        qrImageUrl: qrUrl,
        monthlyPrice: Number(row.amount_monthly) || runtimeConfig.monthlyPrice,
        yearlyPrice: Number(row.amount_yearly) || runtimeConfig.yearlyPrice,
        currency: row.currency || runtimeConfig.currency,
        paymentInstructions: row.instructions || runtimeConfig.paymentInstructions,
        manualUpiEnabled: row.status === "ACTIVE",
        reviewSlaMinutes: row.review_sla_hours ? row.review_sla_hours * 60 : runtimeConfig.reviewSlaMinutes,
        updatedAt: row.updated_at || runtimeConfig.updatedAt,
        updatedBy: row.updated_by || runtimeConfig.updatedBy,
      };
    }

    if (requestsRes.data && !requestsRes.error && requestsRes.data.length > 0) {
      runtimeRequests = requestsRes.data.map((r: any) => ({
        id: r.id,
        referenceNumber: r.id,
        userId: r.user_id,
        userEmail: r.user_email,
        plan: (r.plan_duration?.toLowerCase() === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly",
        amount: Number(r.amount) || 0,
        currency: r.currency || "INR",
        paymentMethod: "UPI_INTENT" as const,
        provider: "OTHER_UPI" as const,
        upiIdSnapshot: r.payee_upi_id || runtimeConfig.upiId,
        utrNumber: r.utr_number,
        proofUrl: r.payment_proof_url,
        status: (r.status === "PENDING" ? "PENDING_REVIEW" : r.status) as PaymentRequestStatus,
        submittedAt: r.created_at,
        reviewDeadline: r.sla_deadline,
        reviewedAt: r.reviewed_at,
        reviewedBy: r.reviewed_by,
        reviewReason: r.review_notes,
        entitlementId: r.subscription_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }
    hasHydratedFromSupabase = true;
  } catch (err: any) {
    console.warn("[paymentStore] Supabase hydration error:", err?.message);
  }
}

if (typeof window === "undefined") {
  hydratePaymentFromSupabase().catch(() => {});
}

// Concurrency mutex set to prevent race-condition double-approvals
const activeApprovalLocks = new Set<string>();

export const paymentStore = {
  // =========================================================================
  // 1. CONFIGURATION MANAGEMENT
  // =========================================================================

  async syncFromSupabase(): Promise<PaymentConfig> {
    await hydratePaymentFromSupabase();
    return { ...runtimeConfig };
  },

  getPaymentConfig(): PaymentConfig {
    if (!hasHydratedFromSupabase && typeof window === "undefined") {
      hydratePaymentFromSupabase().catch(() => {});
    }
    try {
      const stored = (MockStorageProvider as any).getPaymentConfig?.();
      if (stored) {
        runtimeConfig = { ...DEFAULT_PAYMENT_CONFIG, ...stored };
      }
    } catch {}
    return { ...runtimeConfig };
  },

  updatePaymentConfig(
    updates: Partial<PaymentConfig>,
    actor: { id: string; email: string }
  ): PaymentConfig {
    if (updates.upiId !== undefined) {
      if (!isValidUpiId(updates.upiId)) {
        throw new Error(`Invalid UPI ID format: "${updates.upiId}". Must match handle@bank.`);
      }
    }

    if (updates.monthlyPrice !== undefined && updates.monthlyPrice <= 0) {
      throw new Error("Monthly price must be a positive integer.");
    }

    if (updates.yearlyPrice !== undefined && updates.yearlyPrice <= 0) {
      throw new Error("Yearly price must be a positive integer.");
    }

    const previousConfig = { ...runtimeConfig };

    runtimeConfig = {
      ...runtimeConfig,
      ...updates,
      // Razorpay must remain COMING_SOON unless explicitly verified
      razorpayStatus: updates.razorpayStatus || previousConfig.razorpayStatus || "COMING_SOON",
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email,
    };

    try {
      (MockStorageProvider as any).savePaymentConfig?.(runtimeConfig);
    } catch {}

    // Audit event logging
    try {
      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action: "PAYMENT_CONFIG_UPDATED",
        targetType: "SETTING",
        targetId: "global",
        metadata: {
          previousConfig,
          newConfig: runtimeConfig,
        },
      });
    } catch {}

    // Persist to Supabase payment_configs table
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        supabase.from("payment_configs").upsert({
          id: "default",
          upi_id: runtimeConfig.upiId,
          payee_name: "Saarvi Educational Services",
          amount_monthly: runtimeConfig.monthlyPrice,
          amount_yearly: runtimeConfig.yearlyPrice,
          currency: runtimeConfig.currency,
          qr_code_url: runtimeConfig.qrImageUrl,
          review_sla_hours: Math.round(runtimeConfig.reviewSlaMinutes / 60) || 2,
          instructions: runtimeConfig.paymentInstructions,
          status: runtimeConfig.manualUpiEnabled ? "ACTIVE" : "DISABLED",
          updated_at: runtimeConfig.updatedAt,
          updated_by: actor.email,
        }).then(
          ({ error }) => {
            if (error) console.warn("[Supabase payment_configs error]:", error.message);
          },
          () => {}
        );
      }
    } catch {}

    return { ...runtimeConfig };
  },

  // =========================================================================
  // 2. PAYMENT REQUESTS CREATION & INVENTORY
  // =========================================================================

  getPaymentRequests(filter?: {
    status?: string;
    userId?: string;
  }): PaymentRequestRecord[] {
    let list: PaymentRequestRecord[] = [];
    try {
      list = (MockStorageProvider as any).getPaymentRequests?.() || [];
    } catch {
      list = [...runtimeRequests];
    }

    if (!list || list.length === 0) {
      list = [...runtimeRequests];
    }

    if (filter?.status && filter.status !== "ALL") {
      list = list.filter((r) => r.status === filter.status);
    }

    if (filter?.userId) {
      list = list.filter((r) => r.userId === filter.userId);
    }

    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  getPaymentRequestById(id: string): PaymentRequestRecord | null {
    const all = this.getPaymentRequests();
    return all.find((r) => r.id === id) || null;
  },

  createPaymentRequest(params: CreatePaymentRequestParams): PaymentRequestRecord {
    const {
      userId,
      userEmail,
      userName,
      plan,
      planDuration,
      paymentMethod = "UPI_INTENT",
      provider = "OTHER_UPI",
      utrNumber,
      proofUrl,
      paymentProofUrl,
      payerUpiId,
    } = params;

    const resolvedPlan: "monthly" | "yearly" =
      plan || (planDuration?.toLowerCase() === "yearly" ? "yearly" : "monthly");

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      throw new Error("Please enter a valid transaction reference / UTR number (at least 6 characters).");
    }

    // 1. Authoritative configuration snapshot
    const config = this.getPaymentConfig();
    if (!config.manualUpiEnabled) {
      throw new Error("Manual UPI payment is currently paused by platform administration.");
    }

    // 2. Duplicate active request protection
    const allRequests = this.getPaymentRequests();
    const existingActive = allRequests.find(
      (r) =>
        r.status === "PENDING_REVIEW" &&
        (r.userId === userId || r.utrNumber?.toLowerCase() === cleanUtr.toLowerCase())
    );

    if (existingActive) {
      if (existingActive.utrNumber?.toLowerCase() === cleanUtr.toLowerCase()) {
        throw new Error("This transaction reference / UTR has already been submitted and is currently under review.");
      }
      throw new Error("You already have an active payment request pending review. Please wait for our team to verify it.");
    }

    // 3. Server determines authoritative amount
    const authoritativeAmount = resolvedPlan === "yearly" ? config.yearlyPrice : config.monthlyPrice;
    const now = new Date();
    const submittedAt = now.toISOString();
    const reviewDeadline = new Date(now.getTime() + config.reviewSlaMinutes * 60000).toISOString();

    const record: PaymentRequestRecord = {
      id: `payreq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      referenceNumber: generatePaymentReference(),
      userId,
      userEmail,
      userName,
      plan: resolvedPlan,
      amount: authoritativeAmount,
      currency: config.currency,
      paymentMethod,
      provider,
      upiIdSnapshot: config.upiId,
      utrNumber: cleanUtr,
      proofUrl: proofUrl || paymentProofUrl || undefined,
      status: "PENDING_REVIEW",
      submittedAt,
      reviewDeadline,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    };

    // Save to resilient storage
    try {
      (MockStorageProvider as any).savePaymentRequest?.(record);
    } catch {}

    runtimeRequests.unshift(record);

    // Audit log
    try {
      MockStorageProvider.addAuditLog({
        adminUserId: userId,
        adminEmail: userEmail,
        action: "PAYMENT_REQUEST_CREATED",
        targetType: "SYSTEM",
        targetId: record.id,
        metadata: {
          referenceNumber: record.referenceNumber,
          plan,
          amount: authoritativeAmount,
          provider,
          utrNumber: cleanUtr,
        },
      });
    } catch {}

    // Persist to Supabase manual_payment_requests table
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        supabase.from("manual_payment_requests").insert({
          id: record.id,
          user_id: record.userId,
          user_email: record.userEmail,
          plan_duration: record.plan.toUpperCase(),
          amount: record.amount,
          currency: record.currency,
          payee_upi_id: record.upiIdSnapshot,
          utr_number: record.utrNumber || "",
          payment_proof_url: record.proofUrl || null,
          status: "PENDING",
          sla_deadline: record.reviewDeadline,
          created_at: record.submittedAt,
          updated_at: record.updatedAt,
        }).then(
          ({ error }) => {
            if (error) console.warn("[Supabase manual_payment_requests insert error]:", error.message);
          },
          () => {}
        );
      }
    } catch {}

    return record;
  },

  // =========================================================================
  // 3. ADMIN APPROVAL & PRO ENTITLEMENT ACTIVATION
  // =========================================================================

  approvePaymentRequest(
    requestId: string,
    actor: { id: string; email: string }
  ): { request: PaymentRequestRecord; subscription: SubscriptionRecord } {
    // Concurrency guard
    if (activeApprovalLocks.has(requestId)) {
      throw new Error("Approval is already in progress for this payment request.");
    }

    activeApprovalLocks.add(requestId);

    try {
      const request = this.getPaymentRequestById(requestId);
      if (!request) {
        throw new Error(`Payment request "${requestId}" not found.`);
      }

      if (request.status !== "PENDING_REVIEW") {
        throw new Error(`Payment request cannot be approved because its status is already "${request.status}".`);
      }

      const now = new Date();
      const periodStart = now.toISOString();

      // Calculate period end based on plan (Monthly: +30 days, Yearly: +365 days)
      const periodEnd =
        request.plan === "yearly"
          ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const entitlementId = `sub_upi_${Date.now()}`;

      // 1. Create and activate server-authoritative SubscriptionRecord
      const subscriptionRecord: SubscriptionRecord = {
        id: entitlementId,
        userId: request.userId,
        provider: "sandbox", // Conforms to existing checked providers or manual_upi
        providerCustomerId: `cust_${request.userId.substring(0, 8)}`,
        providerSubscriptionId: request.referenceNumber,
        plan: "pro",
        status: "ACTIVE",
        billingInterval: request.plan,
        currency: request.currency,
        amountCents: request.amount * 100,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        metadata: {
          source: "MANUAL_UPI",
          provider: request.provider,
          utrNumber: request.utrNumber,
          approvedBy: actor.email,
          paymentRequestId: request.id,
        },
        createdAt: periodStart,
        updatedAt: periodStart,
      };

      try {
        MockStorageProvider.saveSubscription(subscriptionRecord);
      } catch (err) {
        console.warn("Failed to save subscription entitlement:", err);
      }

      // 2. Create Billing Invoice Record for revenue ledger
      const invoiceRecord: BillingInvoiceRecord = {
        id: `inv_${Date.now()}`,
        userId: request.userId,
        subscriptionId: entitlementId,
        providerInvoiceId: `INV-${request.referenceNumber}`,
        amountPaid: request.amount * 100,
        currency: request.currency,
        status: "paid",
        paidAt: periodStart,
        createdAt: periodStart,
      };

      try {
        MockStorageProvider.saveInvoice(invoiceRecord);
      } catch {}

      // 3. Mark Payment Request as APPROVED
      const updatedRequest: PaymentRequestRecord = {
        ...request,
        status: "APPROVED",
        reviewedAt: periodStart,
        reviewedBy: actor.email,
        entitlementId,
        updatedAt: periodStart,
      };

      try {
        (MockStorageProvider as any).savePaymentRequest?.(updatedRequest);
      } catch {}

      const idx = runtimeRequests.findIndex((r) => r.id === requestId);
      if (idx !== -1) runtimeRequests[idx] = updatedRequest;

      // 4. Audit logging
      try {
        MockStorageProvider.addAuditLog({
          adminUserId: actor.id,
          adminEmail: actor.email,
          action: "PAYMENT_APPROVED",
          targetType: "SYSTEM",
          targetId: requestId,
          metadata: {
            referenceNumber: request.referenceNumber,
            userId: request.userId,
            userEmail: request.userEmail,
            amount: request.amount,
            plan: request.plan,
            utrNumber: request.utrNumber,
            entitlementId,
          },
        });

        MockStorageProvider.addAuditLog({
          adminUserId: actor.id,
          adminEmail: actor.email,
          action: "ENTITLEMENT_ACTIVATED",
          targetType: "SYSTEM",
          targetId: entitlementId,
          metadata: {
            userId: request.userId,
            plan: "pro",
            billingInterval: request.plan,
          },
        });
      } catch {}

      // Persist to Supabase manual_payment_requests & subscriptions
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          supabase.from("manual_payment_requests").update({
            status: "APPROVED",
            reviewed_at: periodStart,
            reviewed_by: actor.email,
            review_notes: "Approved by administrator",
            subscription_id: entitlementId,
            updated_at: periodStart,
          }).eq("id", requestId).then(
            ({ error }) => {
              if (error) console.warn("[Supabase manual_payment_requests approve error]:", error.message);
            },
            () => {}
          );

          supabase.from("subscriptions").upsert({
            id: subscriptionRecord.id,
            user_id: subscriptionRecord.userId,
            provider: "manual_upi",
            provider_customer_id: subscriptionRecord.providerCustomerId,
            provider_subscription_id: subscriptionRecord.providerSubscriptionId,
            plan: subscriptionRecord.plan,
            status: subscriptionRecord.status,
            billing_interval: subscriptionRecord.billingInterval,
            currency: subscriptionRecord.currency,
            amount_cents: subscriptionRecord.amountCents,
            current_period_start: subscriptionRecord.currentPeriodStart,
            current_period_end: subscriptionRecord.currentPeriodEnd,
            cancel_at_period_end: false,
            metadata: subscriptionRecord.metadata,
            created_at: subscriptionRecord.createdAt,
            updated_at: subscriptionRecord.updatedAt,
          }).then(
            ({ error }) => {
              if (error) console.warn("[Supabase subscriptions upsert error]:", error.message);
            },
            () => {}
          );
        }
      } catch {}

      return {
        request: updatedRequest,
        subscription: subscriptionRecord,
      };
    } finally {
      activeApprovalLocks.delete(requestId);
    }
  },

  // =========================================================================
  // 4. ADMIN REJECTION
  // =========================================================================

  rejectPaymentRequest(
    requestId: string,
    reason: string,
    actor: { id: string; email: string }
  ): PaymentRequestRecord {
    const request = this.getPaymentRequestById(requestId);
    if (!request) {
      throw new Error(`Payment request "${requestId}" not found.`);
    }

    if (request.status !== "PENDING_REVIEW") {
      throw new Error(`Payment request cannot be rejected because its status is "${request.status}".`);
    }

    const cleanReason = reason.trim() || "Transaction reference could not be verified with the bank.";
    const now = new Date().toISOString();

    const updatedRequest: PaymentRequestRecord = {
      ...request,
      status: "REJECTED",
      reviewedAt: now,
      reviewedBy: actor.email,
      reviewReason: cleanReason,
      updatedAt: now,
    };

    try {
      (MockStorageProvider as any).savePaymentRequest?.(updatedRequest);
    } catch {}

    const idx = runtimeRequests.findIndex((r) => r.id === requestId);
    if (idx !== -1) runtimeRequests[idx] = updatedRequest;

    // Audit logging
    try {
      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action: "PAYMENT_REJECTED",
        targetType: "SYSTEM",
        targetId: requestId,
        metadata: {
          referenceNumber: request.referenceNumber,
          userId: request.userId,
          userEmail: request.userEmail,
          reason: cleanReason,
        },
      });
    } catch {}

    // Persist to Supabase manual_payment_requests
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        supabase.from("manual_payment_requests").update({
          status: "REJECTED",
          reviewed_at: now,
          reviewed_by: actor.email,
          review_notes: cleanReason,
          updated_at: now,
        }).eq("id", requestId).then(
          ({ error }) => {
            if (error) console.warn("[Supabase manual_payment_requests reject error]:", error.message);
          },
          () => {}
        );
      }
    } catch {}

    return updatedRequest;
  },

  // =========================================================================
  // 5. 2-HOUR SLA TRACKING HELPER
  // =========================================================================

  calculateSlaStatus(
    arg1: string | { submittedAt?: string; reviewDeadline?: string; slaDeadline?: string; reviewedAt?: string; createdAt?: string } | any,
    arg2?: string,
    arg3?: string
  ): { isOverdue: boolean; label: string; minutesRemaining: number } {
    let reviewDeadline: string;
    let reviewedAt: string | undefined;

    if (typeof arg1 === "object" && arg1 !== null) {
      reviewDeadline = arg1.reviewDeadline || arg1.slaDeadline || new Date().toISOString();
      reviewedAt = arg1.reviewedAt;
    } else {
      reviewDeadline = arg2 || new Date().toISOString();
      reviewedAt = arg3;
    }

    const deadlineMs = new Date(reviewDeadline).getTime();
    const referenceMs = reviewedAt ? new Date(reviewedAt).getTime() : Date.now();
    const diffMs = deadlineMs - referenceMs;

    if (diffMs <= 0) {
      const overdueMinutes = Math.floor(Math.abs(diffMs) / 60000);
      const hours = Math.floor(overdueMinutes / 60);
      const mins = overdueMinutes % 60;
      return {
        isOverdue: true,
        label: `Overdue (${hours > 0 ? `${hours}h ` : ""}${mins}m)`,
        minutesRemaining: 0,
      };
    }

    const remainingMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    return {
      isOverdue: false,
      label: `Under Review (${hours > 0 ? `${hours}h ` : ""}${mins}m remaining)`,
      minutesRemaining: remainingMinutes,
    };
  },

  getConfig() {
    const c = this.getPaymentConfig();
    return {
      id: "default",
      upiId: c.upiId,
      payeeName: "Saarvi Educational Services",
      amountMonthly: c.monthlyPrice,
      amountYearly: c.yearlyPrice,
      currency: c.currency,
      qrCodeUrl: resolvePaymentQrImage(c.qrImageUrl) || "",
      rawQrStoragePath: c.qrImageUrl || "",
      reviewSlaHours: Math.round(c.reviewSlaMinutes / 60),
      instructions: c.paymentInstructions,
      supportEmail: "payments@saarvi.in",
      status: c.manualUpiEnabled ? "ACTIVE" : "DISABLED",
    };
  },

  getPublicConfig() {
    const c = this.getPaymentConfig();
    return {
      upiId: c.upiId,
      payeeName: "Saarvi Educational Services",
      amountMonthly: c.monthlyPrice,
      amountYearly: c.yearlyPrice,
      currency: c.currency,
      qrCodeUrl: resolvePaymentQrImage(c.qrImageUrl) || "",
      reviewSlaHours: Math.round(c.reviewSlaMinutes / 60),
      instructions: c.paymentInstructions,
      supportEmail: "payments@saarvi.in",
    };
  },

  async persistConfigToSupabase(actor: { id?: string; email: string }): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { success: true };
    try {
      const { error } = await supabase.from("payment_configs").upsert({
        id: "default",
        upi_id: runtimeConfig.upiId,
        payee_name: "Saarvi Educational Services",
        amount_monthly: runtimeConfig.monthlyPrice,
        amount_yearly: runtimeConfig.yearlyPrice,
        currency: runtimeConfig.currency,
        qr_code_url: runtimeConfig.qrImageUrl,
        review_sla_hours: Math.round(runtimeConfig.reviewSlaMinutes / 60) || 2,
        instructions: runtimeConfig.paymentInstructions,
        status: runtimeConfig.manualUpiEnabled ? "ACTIVE" : "DISABLED",
        updated_at: runtimeConfig.updatedAt,
        updated_by: actor.email,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to persist payment configuration' };
    }
  },

  updateConfig(
    updates: Partial<{
      upiId: string;
      payeeName: string;
      amountMonthly: number;
      amountYearly: number;
      currency: string;
      qrCodeUrl: string;
      reviewSlaHours: number;
      instructions: string;
      supportEmail: string;
      status: string;
    }>,
    actor: { id: string; email: string; role?: string }
  ) {
    const mapped: Partial<PaymentConfig> = {};
    if (updates.upiId !== undefined) mapped.upiId = updates.upiId;
    if (updates.amountMonthly !== undefined) mapped.monthlyPrice = updates.amountMonthly;
    if (updates.amountYearly !== undefined) mapped.yearlyPrice = updates.amountYearly;
    if (updates.currency !== undefined) mapped.currency = updates.currency;
    if (updates.qrCodeUrl !== undefined) mapped.qrImageUrl = updates.qrCodeUrl || null;
    if (updates.reviewSlaHours !== undefined) mapped.reviewSlaMinutes = updates.reviewSlaHours * 60;
    if (updates.instructions !== undefined) mapped.paymentInstructions = updates.instructions;
    if (updates.status !== undefined) mapped.manualUpiEnabled = updates.status === "ACTIVE";

    this.updatePaymentConfig(mapped, actor);
    return this.getConfig();
  },

  getAllRequests(filter?: { status?: string; userId?: string }) {
    return this.getPaymentRequests(filter);
  },

  getRequestsByUser(userId: string) {
    return this.getPaymentRequests({ userId });
  },

  getRequestById(id: string) {
    return this.getPaymentRequestById(id);
  },

  async approveRequest(
    requestId: string,
    actor: { id: string; email: string; role?: string },
    _reviewNotes?: string
  ) {
    const res = await this.approvePaymentRequest(requestId, actor);
    return res.request;
  },

  async rejectRequest(
    requestId: string,
    actor: { id: string; email: string; role?: string },
    reviewNotes: string
  ) {
    return this.rejectPaymentRequest(requestId, reviewNotes, actor);
  },

  getMetrics() {
    const all = this.getPaymentRequests();
    const total = all.length;
    const pending = all.filter((r) => r.status === "PENDING_REVIEW").length;
    const approved = all.filter((r) => r.status === "APPROVED").length;
    const rejected = all.filter((r) => r.status === "REJECTED").length;
    const overdue = all.filter((r) => {
      if (r.status !== "PENDING_REVIEW") return false;
      return new Date(r.reviewDeadline).getTime() < Date.now();
    }).length;

    return { total, pending, approved, rejected, overdue };
  },

  resetStore() {
    runtimeConfig = { ...DEFAULT_PAYMENT_CONFIG };
    runtimeRequests = [];
    activeApprovalLocks.clear();
  },
};

export const PaymentStore = paymentStore;
