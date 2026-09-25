import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SubscriptionRequest, SubscriptionAuditLog } from "@/types/billing";

export const dynamic = "force-dynamic";

// In-memory fallback queue for local development / test environments
let localSubscriptionRequests: SubscriptionRequest[] = [
  {
    id: "sub_req_demo_1",
    userId: "usr_student_101",
    userEmail: "student@saarvi.app",
    plan: "PRO",
    paymentReference: "UPI982348712394",
    provider: "manual_upi",
    amount: 99.0,
    currency: "INR",
    paymentStatus: "VERIFIED",
    subscriptionStatus: "PENDING",
    requestedAt: new Date(Date.now() - 3600000).toISOString(),
    metadata: { note: "Student plan upgrade via UPI" },
  },
];

let localAuditLogs: SubscriptionAuditLog[] = [
  {
    id: "audit_init_1",
    userId: "usr_student_101",
    action: "REQUEST_CREATED",
    oldStatus: undefined,
    newStatus: "PENDING",
    performedBy: "student@saarvi.app",
    reason: "New UPI payment reference submitted",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedNotificationUser(req);
    // Ensure admin / superadmin authorization for viewing
    const isAdmin =
      !isSupabaseConfigured() ||
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN";

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin privileges required." },
        { status: 403 }
      );
    }

    let requests = [...localSubscriptionRequests];
    let auditLogs = [...localAuditLogs];

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: dbRequests } = await supabase
          .from("subscription_requests")
          .select("*")
          .order("created_at", { ascending: false });

        const { data: dbLogs } = await supabase
          .from("subscription_audit_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(50);

        if (dbRequests && dbRequests.length > 0) {
          requests = dbRequests.map((r) => ({
            id: r.id,
            userId: r.user_id,
            userEmail: r.user_email || "user@saarvi.app",
            plan: r.plan || "PRO",
            paymentReference: r.payment_reference || r.utr_number || "N/A",
            provider: r.provider || "manual_upi",
            amount: Number(r.amount || 99),
            currency: r.currency || "INR",
            paymentStatus: r.payment_status || "SUBMITTED",
            subscriptionStatus: r.subscription_status || r.status || "PENDING",
            requestedAt: r.requested_at || r.created_at,
            approvedAt: r.approved_at,
            approvedBy: r.approved_by,
            rejectedAt: r.rejected_at,
            rejectedBy: r.rejected_by,
            expiresAt: r.expires_at,
            metadata: r.metadata || {},
          }));
        }

        if (dbLogs && dbLogs.length > 0) {
          auditLogs = dbLogs.map((l) => ({
            id: l.id,
            userId: l.user_id,
            action: l.action,
            oldStatus: l.old_status,
            newStatus: l.new_status,
            performedBy: l.performed_by,
            reason: l.reason,
            timestamp: l.timestamp,
          }));
        }
      } catch (err) {
        console.warn("[Admin Subscriptions API] DB query fallback:", err);
      }
    }

    const metrics = {
      total: requests.length,
      pending: requests.filter((r) => r.subscriptionStatus === "PENDING").length,
      approved: requests.filter((r) => r.subscriptionStatus === "APPROVED").length,
      rejected: requests.filter((r) => r.subscriptionStatus === "REJECTED").length,
      expired: requests.filter((r) => r.subscriptionStatus === "EXPIRED").length,
    };

    return NextResponse.json({
      success: true,
      requests,
      auditLogs,
      metrics,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal subscriptions query failed.";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedNotificationUser(req);
    // Strictly enforce SUPER_ADMIN role for payment approval / rejection
    const isSuperAdmin =
      !isSupabaseConfigured() ||
      authUser?.role === "SUPER_ADMIN";

    if (!isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: SuperAdmin privileges are strictly required to approve or reject subscription payments.",
        },
        { status: 403 }
      );
    }

    const superadminEmail = authUser?.email || "superadmin@saarvi.app";
    const body = await req.json();
    const { action, requestId, reason, expiresAt } = body;

    if (!action || !requestId) {
      return NextResponse.json(
        { success: false, error: "Action and requestId are required." },
        { status: 400 }
      );
    }

    if (action === "reject" && (!reason || !reason.trim())) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required to maintain audit compliance." },
        { status: 400 }
      );
    }

    // Locate request in local memory or database
    let requestItem = localSubscriptionRequests.find((r) => r.id === requestId);
    let dbItem: any = null;

    if (isSupabaseConfigured()) {
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        const { data } = await adminClient
          .from("subscription_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();
        dbItem = data;
      }
    }

    const currentStatus = dbItem?.subscription_status || dbItem?.status || requestItem?.subscriptionStatus;

    // Idempotency check: prevent duplicate processing
    if (currentStatus === "APPROVED" || currentStatus === "REJECTED") {
      return NextResponse.json(
        {
          success: false,
          error: `Idempotency violation: This payment request has already been ${currentStatus.toLowerCase()}.`,
        },
        { status: 409 }
      );
    }

    const oldStatus = currentStatus || "PENDING";
    const now = new Date().toISOString();
    const targetUserId = dbItem?.user_id || requestItem?.userId || "unknown";

    if (action === "approve") {
      const newExpiry = expiresAt || new Date(Date.now() + 30 * 86400000).toISOString();
      if (requestItem) {
        requestItem.subscriptionStatus = "APPROVED";
        requestItem.approvedAt = now;
        requestItem.approvedBy = superadminEmail;
        requestItem.expiresAt = newExpiry;
      }

      const auditLog: SubscriptionAuditLog = {
        id: `audit_${Date.now()}`,
        userId: targetUserId,
        action: "APPROVED_PRO",
        oldStatus,
        newStatus: "APPROVED",
        performedBy: superadminEmail,
        reason: reason || "Payment verified & Superadmin approval granted",
        timestamp: now,
      };
      localAuditLogs.unshift(auditLog);

      if (isSupabaseConfigured()) {
        const adminClient = getSupabaseAdminClient();
        if (adminClient) {
          try {
            // 1. Update subscription_requests
            await adminClient
              .from("subscription_requests")
              .update({
                subscription_status: "APPROVED",
                status: "APPROVED",
                approved_at: now,
                approved_by: superadminEmail,
                expires_at: newExpiry,
              })
              .eq("id", requestId);

            // 2. Insert or upsert active subscription
            await adminClient.from("subscriptions").upsert({
              user_id: targetUserId,
              plan: "PRO",
              status: "active",
              current_period_start: now,
              current_period_end: newExpiry,
            });

            // 3. Update profiles table
            await adminClient
              .from("profiles")
              .update({ plan: "PRO", updated_at: now })
              .eq("id", targetUserId);

            // 4. Update auth user metadata
            await adminClient.auth.admin.updateUserById(targetUserId, {
              user_metadata: { plan: "PRO" },
            });

            // 5. Record audit log
            await adminClient.from("subscription_audit_logs").insert({
              id: auditLog.id,
              user_id: targetUserId,
              action: auditLog.action,
              old_status: oldStatus,
              new_status: "APPROVED",
              performed_by: superadminEmail,
              reason: auditLog.reason,
              timestamp: now,
            });
          } catch (err) {
            console.error("[Admin Subscriptions API] Approval persistence error:", err);
          }
        }
      }

      return NextResponse.json({ success: true, request: requestItem || dbItem, auditLog });
    }

    if (action === "reject") {
      if (requestItem) {
        requestItem.subscriptionStatus = "REJECTED";
        requestItem.rejectedAt = now;
        requestItem.rejectedBy = superadminEmail;
      }

      const auditLog: SubscriptionAuditLog = {
        id: `audit_${Date.now()}`,
        userId: targetUserId,
        action: "REJECTED",
        oldStatus,
        newStatus: "REJECTED",
        performedBy: superadminEmail,
        reason: reason.trim(),
        timestamp: now,
      };
      localAuditLogs.unshift(auditLog);

      if (isSupabaseConfigured()) {
        const adminClient = getSupabaseAdminClient();
        if (adminClient) {
          try {
            await adminClient
              .from("subscription_requests")
              .update({
                subscription_status: "REJECTED",
                status: "REJECTED",
                rejected_at: now,
                rejected_by: superadminEmail,
                admin_notes: reason.trim(),
              })
              .eq("id", requestId);

            await adminClient.from("subscription_audit_logs").insert({
              id: auditLog.id,
              user_id: targetUserId,
              action: auditLog.action,
              old_status: oldStatus,
              new_status: "REJECTED",
              performed_by: superadminEmail,
              reason: reason.trim(),
              timestamp: now,
            });
          } catch (err) {
            console.error("[Admin Subscriptions API] Rejection persistence error:", err);
          }
        }
      }

      return NextResponse.json({ success: true, request: requestItem || dbItem, auditLog });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Processing subscription action failed.";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
