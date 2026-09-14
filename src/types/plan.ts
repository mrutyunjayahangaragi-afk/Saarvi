// DocEase Phase 12: Plan & Entitlement Architecture
// Defines conceptual Guest, Free, and Pro plans, feature IDs, processing types, and limits.

export type Plan = 'guest' | 'free' | 'pro';

export type ProcessingType = 'local' | 'server' | 'mixed';

export type FeatureAvailability =
  | 'available'
  | 'beta'
  | 'coming_soon'
  | 'pro'
  | 'disabled'
  | 'maintenance';

export type FeatureCategory =
  | 'document'
  | 'student'
  | 'ocr'
  | 'ai'
  | 'workspace'
  | 'developer';

export type FeatureId =
  // Document Utilities (Client-Side & Basic)
  | 'jpg_to_pdf'
  | 'pdf_to_jpg'
  | 'png_to_jpg'
  | 'jpg_to_png'
  | 'image_to_pdf'
  | 'multiple_images_to_pdf'
  | 'image_resize'
  | 'image_crop'
  | 'image_rotate'
  | 'image_compress'
  | 'merge_pdf'
  | 'split_pdf'
  | 'extract_pdf_pages'
  | 'rotate_pdf'
  | 'compress_pdf'
  | 'organize_pdf'
  // Pro Document Utilities (Conceptual / Coming Soon)
  | 'batch_processing'
  | 'advanced_compression'
  | 'pdf_page_editor'
  // Student Utilities (Client-Side & Basic)
  | 'vtu_sgpa'
  | 'vtu_cgpa'
  | 'attendance_calculator'
  | 'percentage_calculator'
  | 'marks_calculator'
  | 'resume_builder'
  | 'cover_letter_builder'
  | 'study_planner'
  | 'assignment_tracker'
  | 'college_timetable'
  | 'certificate_organizer'
  | 'internship_tracker'
  | 'hackathon_tracker'
  // Pro Student Utilities (Conceptual / Coming Soon)
  | 'premium_resume_templates'
  | 'career_portfolio_export'
  // OCR Utilities (Conceptual / Coming Soon)
  | 'image_ocr'
  | 'scanned_pdf_ocr'
  // AI Utilities (Conceptual / Coming Soon)
  | 'ai_assistant'
  | 'ai_resume_assistant'
  | 'ai_cover_letter'
  | 'ai_pdf_assistant'
  | 'ai_study_assistant'
  // Workspace & Platform
  | 'local_workspace'
  | 'saved_preferences'
  | 'conversion_history'
  | 'cloud_sync'
  | 'cross_device_workspace'
  | 'developer_api'
  | 'navigation_management';

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  category: FeatureCategory;
  requiredPlan: Plan;
  enabled: boolean;
  availability: FeatureAvailability;
  processingType: ProcessingType;
  description: string;
  proNotice?: string;
  toolSlug?: string;
}

export interface PlanLimits {
  plan: Plan;
  displayName: string;
  maxFileSizeMB: number;
  maxBatchFiles: number;
  maxPagesPerPdf: number;
  batchProcessingEnabled: boolean;
  premiumTemplatesEnabled: boolean;
  aiAssistantEnabled: boolean;
  ocrEnabled: boolean;
  cloudSyncEnabled: boolean;
  apiAccessEnabled: boolean;
}

export type EntitlementDenialReason =
  | 'login_required'
  | 'pro_required'
  | 'disabled'
  | 'maintenance'
  | 'coming_soon';

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: 'allowed' | EntitlementDenialReason;
  message?: string;
  feature?: FeatureDefinition;
  requiredPlan?: Plan;
}

// -----------------------------------------------------------------------------
// Phase 13: Production Billing & Subscription Architecture
// -----------------------------------------------------------------------------

export type BillingProviderName = 'razorpay' | 'stripe' | 'sandbox';

export type BillingInterval = 'monthly' | 'yearly';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';

export interface SubscriptionRecord {
  id: string;
  userId: string;
  provider: BillingProviderName;
  providerCustomerId?: string;
  providerSubscriptionId: string;
  plan: 'pro';
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currency: string;
  amountCents: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInvoiceRecord {
  id: string;
  userId: string;
  subscriptionId?: string;
  providerInvoiceId: string;
  amountPaid: number;
  currency: string;
  status: string;
  invoiceUrl?: string;
  paidAt: string;
  createdAt: string;
}

export interface BillingEventRecord {
  id: string;
  provider: BillingProviderName;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'PROCESSED' | 'FAILED' | 'IGNORED';
  errorMessage?: string;
  processedAt: string;
  createdAt: string;
}

export interface CheckoutSessionParams {
  userId: string;
  userEmail: string;
  userName?: string;
  plan: 'pro';
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  provider: BillingProviderName;
  checkoutUrl?: string;
  providerSubscriptionId?: string;
  providerOrderId?: string;
  keyId?: string;
  amount: number;
  currency: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
}

export interface RazorpayPaymentSuccessCallback {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  razorpay_subscription_id?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventId?: string;
  eventType?: string;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  status?: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  rawEvent?: Record<string, unknown>;
  error?: string;
}

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: Plan;
  billingInterval?: BillingInterval;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  provider?: BillingProviderName;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

