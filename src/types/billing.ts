export type SubscriptionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export type BillingPlan = "FREE" | "PRO";

export interface SubscriptionRequest {
  id: string;
  userId: string;
  userEmail: string;
  plan: BillingPlan;
  paymentReference: string; // UTR or Payment transaction id
  provider: "manual_upi" | "razorpay" | "stripe" | "sandbox";
  amount: number;
  currency: string;
  paymentStatus: "PENDING" | "VERIFIED" | "FAILED";
  subscriptionStatus: SubscriptionStatus;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export type SubscriptionAuditAction =
  | "REQUEST_CREATED"
  | "APPROVED_PRO"
  | "REJECTED"
  | "SUSPENDED"
  | "REACTIVATED"
  | "PLAN_CHANGED"
  | "EXPIRY_EXTENDED";

export interface SubscriptionAuditLog {
  id: string;
  userId: string;
  action: SubscriptionAuditAction;
  oldStatus?: SubscriptionStatus | string;
  newStatus?: SubscriptionStatus | string;
  performedBy: string;
  reason?: string;
  timestamp: string;
}
