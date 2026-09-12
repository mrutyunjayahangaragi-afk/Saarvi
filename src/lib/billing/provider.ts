// DocEase Phase 13: Vendor-Agnostic Billing Provider Abstraction
// Decouples platform logic from specific payment gateways.

import {
  BillingProviderName,
  CheckoutSessionParams,
  CheckoutSessionResponse,
  WebhookVerificationResult,
  SubscriptionRecord,
} from '@/types/plan';

export interface BillingProvider {
  readonly name: BillingProviderName;

  /**
   * Generates a checkout session or order for a user to complete payment.
   */
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse>;

  /**
   * Cryptographically verifies the incoming webhook request and parses subscription details.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerificationResult>;

  /**
   * Fetches latest subscription state directly from the provider.
   */
  getSubscription(providerSubscriptionId: string): Promise<Partial<SubscriptionRecord> | null>;

  /**
   * Cancels a subscription either immediately or at period end.
   */
  cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd?: boolean
  ): Promise<{ status: string; cancelAtPeriodEnd: boolean }>;

  /**
   * Optional customer billing portal link.
   */
  getBillingPortalUrl?(providerCustomerId: string): Promise<string>;
}
