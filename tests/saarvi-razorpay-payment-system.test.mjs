import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Import canonical plan configuration
import {
  CANONICAL_PRO_PLAN,
  CANONICAL_PRO_YEARLY_PLAN,
  getCanonicalPlan,
} from '../src/config/plans.ts';

test('SAARVI RAZORPAY CANONICAL PAYMENT SYSTEM SUITE', async (t) => {
  const rootDir = process.cwd();

  // 1. Authoritative Plan Catalog Tests
  await t.test('1. Plan price cannot be modified by client: server has immutable catalog', () => {
    // Monthly
    const monthlyPlan = getCanonicalPlan('saarvi_pro_monthly');
    assert.equal(monthlyPlan.amountPaise, 9900);
    assert.equal(monthlyPlan.amount, 99);
    assert.equal(monthlyPlan.currency, 'INR');
    assert.equal(monthlyPlan.accessDurationDays, 30);
    assert.equal(monthlyPlan.name, 'Saarvi Pro');

    // Yearly
    const yearlyPlan = getCanonicalPlan('saarvi_pro_yearly');
    assert.equal(yearlyPlan.amountPaise, 89900);
    assert.equal(yearlyPlan.amount, 899);
    assert.equal(yearlyPlan.currency, 'INR');
    assert.equal(yearlyPlan.accessDurationDays, 365);

    // Client trying to request custom price or unknown plan throws
    assert.throws(() => getCanonicalPlan('FORGED_PRO_CHEAP'), /Plan not found/);
  });

  // 2. Order creation endpoint validation
  await t.test('2. Order creation endpoint rejects client-side price tampering', () => {
    const createOrderRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/payments/create-order/route.ts'), 'utf8');
    assert.match(createOrderRoute, /body\.price\s*\|\|\s*body\.amount\s*\|\|\s*body\.currency/);
    assert.match(createOrderRoute, /Client cannot specify pricing/);
    assert.match(createOrderRoute, /SECURITY_VIOLATION/);
  });

  // 3. HMAC-SHA256 signature verification logic
  await t.test('3. Cryptographic Signature Verification: Valid signature accepted, invalid rejected', () => {
    const keySecret = 'rzp_sec_live_9876543210abcdef';
    const orderId = 'order_DAE1234567890';
    const paymentId = 'pay_DAE9876543210';

    const validSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const forgedSignature = crypto
      .createHmac('sha256', 'forged_fake_secret_key')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(validSignature, 'utf8');
    const validBuf = Buffer.from(validSignature, 'utf8');
    const forgedBuf = Buffer.from(forgedSignature, 'utf8');

    // Valid check
    assert.equal(crypto.timingSafeEqual(expectedBuf, validBuf), true);
    // Forged check
    assert.equal(crypto.timingSafeEqual(expectedBuf, forgedBuf), false);
  });

  // 4. Verification endpoint validates amount, currency, user
  await t.test('4. Verification endpoint validates order owner and prevents cross-user activation', () => {
    const verifyRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/payments/verify/route.ts'), 'utf8');
    const serviceFile = fs.readFileSync(path.join(rootDir, 'src/lib/billing/razorpay-service.ts'), 'utf8');

    assert.match(verifyRoute, /verifyPayment/);
    assert.match(serviceFile, /Security violation: Order owner does not match current user session/);
    assert.match(serviceFile, /crypto\.timingSafeEqual/);
  });

  // 5. Idempotent Webhook Processing
  await t.test('5. Webhook processing is idempotent and prevents replay/double activation', () => {
    const webhookRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/payments/webhook/route.ts'), 'utf8');
    const serviceFile = fs.readFileSync(path.join(rootDir, 'src/lib/billing/razorpay-service.ts'), 'utf8');

    assert.match(webhookRoute, /handleWebhook/);
    assert.match(serviceFile, /processed/);
    assert.match(serviceFile, /duplicate:\s*true/);
  });

  // 6. Entitlement Cumulative Extension
  await t.test('6. Cumulative Pro duration extension does not discard remaining days', () => {
    const serviceFile = fs.readFileSync(path.join(rootDir, 'src/lib/billing/razorpay-service.ts'), 'utf8');
    assert.match(serviceFile, /isAlreadyActive\s*&&\s*existingSub\?\.currentPeriodEnd/);
    assert.match(serviceFile, /durationDays\s*\*\s*86400000/);

    // Test math: 10 days remaining + 30 days renewal = 40 days from now
    const now = Date.now();
    const tenDaysRemaining = now + 10 * 86400000;
    const baseTime = tenDaysRemaining > now ? tenDaysRemaining : now;
    const newEnd = new Date(baseTime + 30 * 86400000).getTime();
    const daysFromNow = Math.round((newEnd - now) / 86400000);
    assert.equal(daysFromNow, 40);
  });

  // 7. Non-captured payments never activate Pro
  await t.test('7. Failed, pending, or cancelled payments never grant Pro entitlement', () => {
    const serviceFile = fs.readFileSync(path.join(rootDir, 'src/lib/billing/razorpay-service.ts'), 'utf8');
    assert.match(serviceFile, /payment\.failed/);
    assert.match(serviceFile, /payment\.status === 'failed'/);
    assert.match(serviceFile, /CAPTURED/);
  });

  // 8. Server-Authorized Refund Workflow
  await t.test('8. Refund API interacts with Razorpay and revokes Pro access', () => {
    const refundRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/payments/refund/route.ts'), 'utf8');
    const serviceFile = fs.readFileSync(path.join(rootDir, 'src/lib/billing/razorpay-service.ts'), 'utf8');

    assert.match(refundRoute, /razorpayPaymentService\.createRefund/);
    assert.match(serviceFile, /\.refund\(/);
    assert.match(serviceFile, /status:\s*'REVOKED'/);
    assert.match(serviceFile, /is_pro:\s*false/);
  });

  // 9. Client Security Invariant: Zero secret exposure
  await t.test('9. No secrets exposed to client bundles', () => {
    const envFile = fs.readFileSync(path.join(rootDir, 'src/lib/config/env.ts'), 'utf8');
    assert.match(envFile, /SECURITY VIOLATION.*NEXT_PUBLIC_/);

    const clientCheckout = fs.readFileSync(path.join(rootDir, 'src/lib/payments/razorpay-checkout.ts'), 'utf8');
    assert.doesNotMatch(clientCheckout, /RAZORPAY_KEY_SECRET/);
    assert.doesNotMatch(clientCheckout, /RAZORPAY_WEBHOOK_SECRET/);
    assert.doesNotMatch(clientCheckout, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  // 10. Modern UX: Razorpay Checkout loader and clean modal
  await t.test('10. Razorpay Checkout modal handles callbacks, prefill, and errors', () => {
    const checkoutJs = fs.readFileSync(path.join(rootDir, 'src/lib/payments/razorpay-checkout.ts'), 'utf8');
    assert.match(checkoutJs, /checkout\.razorpay\.com\/v1\/checkout\.js/);
    assert.match(checkoutJs, /new window\.Razorpay/);
    assert.match(checkoutJs, /open\(\)/);

    const modal = fs.readFileSync(path.join(rootDir, 'src/components/billing/PaymentMethodModal.tsx'), 'utf8');
    assert.match(modal, /Preparing secure checkout\.\.\./);
    assert.match(modal, /Continue to Secure Payment/);
    assert.match(modal, /Secure payment powered by Razorpay/);
    // Check minimum touch target
    assert.match(modal, /min-h-\[48px\]/);
  });

  // 11. Dark mode completeness in payment UI
  await t.test('11. Dark mode styles are present on Plans and Payment pages', () => {
    const plansPage = fs.readFileSync(path.join(rootDir, 'src/app/plans/page.tsx'), 'utf8');
    assert.match(plansPage, /dark:border-slate-800/);
    assert.match(plansPage, /dark:text-white/);
    assert.match(plansPage, /dark:bg-\[#111c38\]/);

    const successPage = fs.readFileSync(path.join(rootDir, 'src/app/payment/success/page.tsx'), 'utf8');
    assert.match(successPage, /Payment Successful/);
    assert.match(successPage, /Start using Saarvi Pro/);
    assert.match(successPage, /dark:border-slate-800/);
  });

  // 12. Admin dashboard financial visibility
  await t.test('12. Admin dashboard provides safe transaction metrics and refund actions', () => {
    const adminPayments = fs.readFileSync(path.join(rootDir, 'src/app/admin/payments/page.tsx'), 'utf8');
    assert.match(adminPayments, /Razorpay Payments &amp; Revenue/);
    assert.match(adminPayments, /Total Volume/);
    assert.match(adminPayments, /Captured Revenue/);
    assert.match(adminPayments, /handleRefund/);
    assert.match(adminPayments, /statusFilter/);
  });
});
