# DocEase — Production Payment Checklist (Razorpay Live Mode Migration)

This checklist specifies the exact, mandatory operational steps required before migrating DocEase Pro subscription billing from Razorpay Test Mode to Razorpay Live Mode.

> [!IMPORTANT]
> External business onboarding and KYC steps are **MANUAL REQUIREMENTS** that must be executed directly by the business owner inside the [Razorpay Merchant Dashboard](https://dashboard.razorpay.com). Do not claim any onboarding step is complete without administrative verification.

---

## 1. Merchant Onboarding & Business Verification
- [ ] **Step 1: Razorpay Account Registration**
  - Register the official DocEase legal entity on Razorpay.
  - Verify registered business email, primary phone number, and two-factor authentication (2FA).
- [ ] **Step 2: Business KYC & Banking Verification**
  - Submit business entity documents (Certificate of Incorporation, GSTIN, PAN).
  - Submit authorized signatory identity and address proofs.
  - Complete Penny-drop verification for the corporate settlement bank account.
  - Receive "Account Activated" status in Razorpay Dashboard.

---

## 2. Live API Credentials & Configuration
- [ ] **Step 3: Generate Live API Key Pair**
  - Navigate to **Dashboard > Settings > API Keys > Generate Key**.
  - Copy `RAZORPAY_KEY_ID` (starts with `rzp_live_`).
  - Copy `RAZORPAY_KEY_SECRET`. Store immediately in a secure team password manager; it is displayed only once.
  - Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to identical `rzp_live_` Key ID.
- [ ] **Step 4: Create Live Subscription Plans**
  - Navigate to **Subscriptions > Plans > Create Plan**.
  - **Plan 1: Pro Monthly**
    - Name: `DocEase Pro Monthly`
    - Amount: `₹99.00` (9900 paise)
    - Billing Frequency: Monthly (`1 Month`)
    - Copy Plan ID $\to$ `RAZORPAY_PRO_MONTHLY_PLAN_ID` (`plan_...`)
  - **Plan 2: Pro Yearly**
    - Name: `DocEase Pro Yearly`
    - Amount: `₹899.00` (89900 paise)
    - Billing Frequency: Yearly (`12 Months`)
    - Copy Plan ID $\to$ `RAZORPAY_PRO_YEARLY_PLAN_ID` (`plan_...`)

---

## 3. Webhook Integration
- [ ] **Step 5: Configure Production Webhook URL**
  - Navigate to **Settings > Webhooks > Add New Webhook**.
  - Webhook URL: `https://<your-production-domain>/api/billing/webhook`
  - Secret: Generate a high-entropy 32+ character random string $\to$ `RAZORPAY_WEBHOOK_SECRET`.
  - Alert Email: Add on-call engineering email for webhook delivery failure alerts.
- [ ] **Step 6: Select Required Webhook Events**
  - Active Events:
    - `subscription.authenticated`
    - `subscription.activated`
    - `subscription.charged`
    - `subscription.cancelled`
    - `payment.captured`
    - `payment.failed`

---

## 4. Live Verification & Validation
- [ ] **Step 7: Verify Live Credit/Debit Card Transaction**
  - Perform one real ₹99 transaction using an active personal debit or credit card.
  - Ensure payment passes through Razorpay Checkout without console errors.
- [ ] **Step 8: Verify Live UPI Payment**
  - Perform one real transaction using UPI Mobile Intent or desktop UPI QR scan.
  - Ensure status confirms in browser via `/checkout/confirmation`.
- [ ] **Step 9: Verify Cryptographic Webhook Delivery**
  - Check Razorpay Webhook logs: ensure `200 OK` response with latency under 500ms.
  - Confirm entry exists in `public.billing_events` table with `status = 'PROCESSED'`.
- [ ] **Step 10: Verify Pro Entitlement Activation**
  - Confirm user profile reflects `plan = 'pro'` in `/dashboard/profile` and `/dashboard/billing`.
  - Confirm batch conversion limit expands to 50 files and 100MB per file.
- [ ] **Step 11: Verify Subscription Cancellation**
  - In `/dashboard/billing`, click "Cancel Renewal".
  - Confirm `cancel_at_period_end = true` in database.
  - Confirm user retains Pro benefits until `current_period_end`.
- [ ] **Step 12: Verify Invoice Persistence**
  - Confirm receipt record is written to `public.invoices` table.
  - Check that the invoice is visible to the user on `/dashboard/billing`.
- [ ] **Step 13: Verify Real Admin Billing Analytics**
  - Access `/admin/billing` as administrator.
  - Confirm real MRR/ARR increments accurately with zero fake test data.
- [ ] **Step 14: Privacy Invariant Audit**
  - Inspect browser Network tab during payment and document conversion.
  - Ensure zero document bytes, file names, or resume texts are transmitted to Razorpay or `/api/billing/*`.
- [ ] **Step 15: Rollback & Emergency Plan Signoff**
  - Verify operations team has tested switching `BILLING_PROVIDER=sandbox` in preview and knows how to revert deployment within 5 minutes if provider outages occur.
