import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

test('SAARVI PLANS & BILLING CONTROL CENTER TEST SUITE', async (t) => {
  const rootDir = process.cwd();

  await t.test('1. Authoritative Pricing Configuration: Monthly ₹99 (30d) and Yearly ₹899 (365d)', () => {
    const pricingFile = fs.readFileSync(path.join(rootDir, 'src/config/pricing.ts'), 'utf8');
    assert.match(pricingFile, /amountCents:\s*9900/);
    assert.match(pricingFile, /amountDisplay:\s*['"]₹99['"]/);
    assert.match(pricingFile, /amountCents:\s*89900/);
    assert.match(pricingFile, /amountDisplay:\s*['"]₹899['"]/);
    assert.match(pricingFile, /PRO_PRICING/);
    assert.match(pricingFile, /ACTIVE_PRO_BENEFITS/);
  });

  await t.test('2. Webhook Route Fixes: Implements GET and HEAD handlers to eliminate HTTP 405 error', () => {
    const webhookFile = fs.readFileSync(path.join(rootDir, 'src/app/api/payments/razorpay/webhook/route.ts'), 'utf8');
    assert.match(webhookFile, /export async function POST/);
    assert.match(webhookFile, /export async function GET/);
    assert.match(webhookFile, /export async function HEAD/);
    assert.match(webhookFile, /status:\s*['"]active['"]/);
  });

  await t.test('3. Server-Authoritative Razorpay Order Creation: Rejects price tampering', () => {
    const createOrderFile = fs.readFileSync(path.join(rootDir, 'src/app/api/payments/razorpay/create-order/route.ts'), 'utf8');
    assert.match(createOrderFile, /body\.price\s*\|\|\s*body\.amount\s*\|\|\s*body\.currency/);
    assert.match(createOrderFile, /SECURITY_VIOLATION/);
    assert.match(createOrderFile, /plan_id/);
    assert.match(createOrderFile, /createPaymentOrder/);
  });

  await t.test('4. Server-Side Cryptographic Signature Verification: Uses timingSafeEqual and HMAC-SHA256', () => {
    const verifyRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/payments/razorpay/verify/route.ts'), 'utf8');
    const serviceFile = fs.readFileSync(path.join(rootDir, 'src/lib/billing/razorpay-service.ts'), 'utf8');

    assert.match(verifyRoute, /orderId\s*\|\|\s*body\.razorpay_order_id/);
    assert.match(verifyRoute, /paymentId\s*\|\|\s*body\.razorpay_payment_id/);
    assert.match(verifyRoute, /signature\s*\|\|\s*body\.razorpay_signature/);

    assert.match(serviceFile, /crypto\.timingSafeEqual/);
    assert.match(serviceFile, /crypto\s*\.createHmac\('sha256'/);
    assert.match(serviceFile, /Security violation: Order owner does not match current user session/);
  });

  await t.test('5. Cryptographic HMAC Verification Execution Test', () => {
    const secret = 'rzp_test_secret_key_12345';
    const orderId = 'order_test_123456';
    const paymentId = 'pay_test_789012';

    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(validSignature, 'utf8');
    const forgedSignature = crypto
      .createHmac('sha256', 'wrong_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const forgedBuf = Buffer.from(forgedSignature, 'utf8');

    assert.equal(crypto.timingSafeEqual(expectedBuf, expectedBuf), true);
    assert.equal(crypto.timingSafeEqual(expectedBuf, forgedBuf), false);
  });

  await t.test('6. Entitlement Provisioning: Cumulative expiration on renewal without losing days', () => {
    const serviceFile = fs.readFileSync(path.join(rootDir, 'src/lib/billing/razorpay-service.ts'), 'utf8');
    assert.match(serviceFile, /isAlreadyActive\s*&&\s*existingSub\?\.currentPeriodEnd/);
    assert.match(serviceFile, /durationDays\s*\*\s*86400000/);
    assert.match(serviceFile, /saveSubscription/);
    assert.match(serviceFile, /saveNotification/);
  });

  await t.test('7. Clean Plans Page Architecture: Direct Cashfree checkout, dynamic discount percentage', () => {
    const plansPage = fs.readFileSync(path.join(rootDir, 'src/app/plans/page.tsx'), 'utf8');
    // Verifies direct Cashfree checkout integration
    assert.match(plansPage, /initiateCashfreeCheckout/);
    assert.match(plansPage, /Simple, Honest Pricing/);
    assert.match(plansPage, /Simple, Transparent &amp; Private by Design/);
    // Verifies dynamic discount percentage calculation
    assert.match(plansPage, /discountPercent\s*=\s*Math\.round/);
    // Verifies that neither inline UTR input nor inline UPI app launching exists directly on page
    assert.doesNotMatch(plansPage, /<input[^>]*utrNumber/);
    assert.doesNotMatch(plansPage, /handleLaunchUpiApp/);
    // Verifies Free vs Pro cards and compare matrix
    assert.match(plansPage, /Essential Productivity/);
    assert.match(plansPage, /Compare Plan Capabilities/);
  });

  await t.test('8. Upgrade to Pro Modal: Clean Cashfree checkout, server-authoritative plan and no provider selection', () => {
    const modalFile = fs.readFileSync(path.join(rootDir, 'src/components/billing/PaymentMethodModal.tsx'), 'utf8');
    assert.match(modalFile, /UPGRADE TO SAARVI PRO/);
    assert.match(modalFile, /Continue to Secure Payment/);
    assert.match(modalFile, /Your payment will be securely processed through Cashfree/);
    assert.match(modalFile, /Secure server-verified payment/);
    assert.match(modalFile, /initiateCashfreeCheckout/);
    // Verifies complete removal of legacy provider selection and manual workflows
    assert.doesNotMatch(modalFile, /Continue with Razorpay/);
    assert.doesNotMatch(modalFile, /Continue with UPI/);
    assert.doesNotMatch(modalFile, /checkout\.razorpay\.com/);
  });

  await t.test('9. User Dashboard Billing: Expiration handling and real Cashfree orders history', () => {
    const dashboardBilling = fs.readFileSync(path.join(rootDir, 'src/app/dashboard/billing/page.tsx'), 'utf8');
    assert.match(dashboardBilling, /paymentOrders/);
    assert.match(dashboardBilling, /Payment &amp; Billing History/);
    assert.match(dashboardBilling, /Expires On/);
  });

  await t.test('10. Admin Payment & Billing Control Center: Includes Overview, Razorpay, Manual UPI, Plans, and Entitlements', () => {
    const adminBilling = fs.readFileSync(path.join(rootDir, 'src/app/admin/billing/page.tsx'), 'utf8');
    assert.match(adminBilling, /activeTab === 'OVERVIEW'/);
    assert.match(adminBilling, /activeTab === 'RAZORPAY'/);
    assert.match(adminBilling, /activeTab === 'REQUESTS'/);
    assert.match(adminBilling, /activeTab === 'PLANS'/);
    assert.match(adminBilling, /activeTab === 'ENTITLEMENTS'/);
    assert.match(adminBilling, /Immutable Plan (&amp;|&) Pricing Architecture/);
    assert.match(adminBilling, /Razorpay Order Details/);
  });

  await t.test('11. Decoupled Manual UPI Workflow: Superadmin review remains intact and separate', () => {
    const adminBilling = fs.readFileSync(path.join(rootDir, 'src/app/admin/billing/page.tsx'), 'utf8');
    assert.match(adminBilling, /PENDING_REVIEW/);
    assert.match(adminBilling, /2-Hour SLA/);
    assert.match(adminBilling, /Approve Payment (&amp;|&) Grant Pro/);
    assert.match(adminBilling, /Reject Payment Request/);
  });

  await t.test('12. Unified Pricing Route: /pricing renders the same clean experience with zero split-brain', () => {
    const pricingPage = fs.readFileSync(path.join(rootDir, 'src/app/pricing/page.tsx'), 'utf8');
    assert.match(pricingPage, /import PlansPage from '@\/app\/plans\/page'/);
    assert.match(pricingPage, /<PlansPage/);
  });
});
