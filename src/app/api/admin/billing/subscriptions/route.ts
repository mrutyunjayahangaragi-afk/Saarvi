import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
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
    amount: 49.0,
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
    // Ensure admin / superadmin authorization
    const isSuperAdmin =
      !isSupabaseConfigured() ||
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN";

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Superadmin role required." },
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
          .order("requested_at", { ascending: false });

        const { data: dbLogs } = await supabase
          .from("subscription_audit_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(50);

        if (dbRequests && dbRequests.length > 0) {
          requests = dbRequests.map((r) => ({
            id: r.id,
            userId: r.user_id,
            userEmail: r.user_email,
            plan: r.plan,
            paymentReference: r.payment_reference,
            provider: r.provider,
            amount: Number(r.amount),
            currency: r.currency,
            paymentStatus: r.payment_status,
            subscriptionStatus: r.subscription_status,
            requestedAt: r.requested_at,
            approvedAt: r.approved_at,
            approvedBy: r.approved_by,
            rejectedAt: r.rejected_at,
            rejectedBy: r.rejected_by,
            expiresAt: r.expires_at,
            metadata: r.metadata,
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
    const superadminEmail = authUser?.email || "superadmin@saarvi.app";

    const body = await req.json();
    const { action, requestId, reason, expiresAt } = body;

    if (!action || !requestId) {
      return NextResponse.json(
        { success: false, error: "Action and requestId are required." },
        { status: 400 }
      );
    }

    // Locate request
    let requestItem = localSubscriptionRequests.find((r) => r.id === requestId);
    const oldStatus = requestItem?.subscriptionStatus;
    const now = new Date().toISOString();

    if (action === "approve") {
      const newExpiry = expiresAt || new Date(Date.now() + 30 * 86400000).toISOString();
      if (requestItem) {
        requestItem.subscriptionStatus = "APPROVED";
        requestItem.approvedAt = now;
        requestItem.approvedBy = superadminEmail;
        requestItem.expiresAt = newExpiry;
      }

      // Record audit log
      const auditLog: SubscriptionAuditLog = {
        id: `audit_${Date.now()}`,
        userId: requestItem?.userId || "unknown",
        action: "APPROVED_PRO",
        oldStatus,
        newStatus: "APPROVED",
        performedBy: superadminEmail,
        reason: reason || "Payment verified & Superadmin approval granted",
        timestamp: now,
      };
      localAuditLogs.unshift(auditLog);

      if (isSupabaseConfigured() && requestItem) {
        try {
          const supabase = await createClient();
          await supabase
            .from("subscription_requests")
            .update({
              subscription_status: "APPROVED",
              approved_at: now,
              approved_by: superadminEmail,
              expires_at: newExpiry,
            })
            .eq("id", requestId);

          // Update user's profile to PRO plan
          await supabase
            .from("profiles")
            .update({ plan: "PRO" })
            .eq("id", requestItem.userId);

          await supabase.from("subscription_audit_logs").insert({
            id: auditLog.id,
            user_id: requestItem.userId,
            action: auditLog.action,
            old_status: oldStatus,
            new_status: "APPROVED",
            performed_by: superadminEmail,
            reason: auditLog.reason,
            timestamp: now,
          });
        } catch (err) {
          console.warn("[Admin Subscriptions API] DB update failed:", err);
        }
      }

      return NextResponse.json({ success: true, request: requestItem, auditLog });
    }

    if (action === "reject") {
      if (requestItem) {
        requestItem.subscriptionStatus = "REJECTED";
        requestItem.rejectedAt = now;
        requestItem.rejectedBy = superadminEmail;
      }

      const auditLog: SubscriptionAuditLog = {
        id: `audit_${Date.now()}`,
        userId: requestItem?.userId || "unknown",
        action: "REJECTED",
        oldStatus,
        newStatus: "REJECTED",
        performedBy: superadminEmail,
        reason: reason || "Payment reference could not be verified",
        timestamp: now,
      };
      localAuditLogs.unshift(auditLog);

      if (isSupabaseConfigured() && requestItem) {
        try {
          const supabase = await createClient();
          await supabase
            .from("subscription_requests")
            .update({
              subscription_status: "REJECTED",
              rejected_at: now,
              rejected_by: superadminEmail,
            })
            .eq("id", requestId);

          await supabase.from("subscription_audit_logs").insert({
            id: auditLog.id,
            user_id: requestItem.userId,
            action: auditLog.action,
            old_status: oldStatus,
            new_status: "REJECTED",
            performed_by: superadminEmail,
            reason: auditLog.reason,
            timestamp: now,
          });
        } catch {}
      }

      return NextResponse.json({ success: true, request: requestItem, auditLog });
    }

    if (action === "suspend") {
      if (requestItem) {
        requestItem.subscriptionStatus = "EXPIRED";
      }

      const auditLog: SubscriptionAuditLog = {
        id: `audit_${Date.now()}`,
        userId: requestItem?.userId || "unknown",
        action: "SUSPENDED",
        oldStatus,
        newStatus: "EXPIRED",
        performedBy: superadminEmail,
        reason: reason || "Superadmin manual suspension",
        timestamp: now,
      };
      localAuditLogs.unshift(auditLog);

      if (isSupabaseConfigured() && requestItem) {
        try {
          const supabase = await createClient();
          await supabase
            .from("subscription_requests")
            .update({ subscription_status: "EXPIRED" })
            .eq("id", requestId);

          await supabase
            .from("profiles")
            .update({ plan: "FREE" })
            .eq("id", requestItem.userId);

          await supabase.from("subscription_audit_logs").insert({
            id: auditLog.id,
            user_id: requestItem.userId,
            action: auditLog.action,
            old_status: oldStatus,
            new_status: "EXPIRED",
            performed_by: superadminEmail,
            reason: auditLog.reason,
            timestamp: now,
          });
        } catch {}
      }

      return NextResponse.json({ success: true, request: requestItem, auditLog });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Superadmin action execution failed.";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
