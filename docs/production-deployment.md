# DocEase — Production Deployment Guide & Verification

This guide outlines the standard operating procedures for deploying DocEase to **Vercel** with a production **Supabase** backend.

---

## 1. Pre-Deployment Phase

### A. Automated Quality Gates
Before any release or branch merge, run the full verification pipeline locally:

```bash
# 1. Execute all test suites (89 unit/integration + 14 Phase 15 regression tests)
npm test

# 2. Complete static type analysis
npx tsc --noEmit

# 3. Compile optimized production build
npm run build
```

Expected Outcome:
- `tests 103, pass 103, fail 0`
- `0 TypeScript errors`
- `✓ Generating static pages (97/97) in under 1s`

### B. Environment Variable Configuration in Vercel
Set the following environment variables in **Vercel Project Settings > Environment Variables**:

| Variable Name | Scope | Description |
|---------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Supabase public anonymous key |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Production | Live Razorpay Key ID (`rzp_live_...`) |
| `BILLING_PROVIDER` | Production | Must be `razorpay` |
| `RAZORPAY_KEY_ID` | Production | Live Razorpay Key ID (`rzp_live_...`) |
| `RAZORPAY_KEY_SECRET` | Production | Live Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Production | High-entropy HMAC webhook secret |
| `RAZORPAY_PRO_MONTHLY_PLAN_ID` | Production | Monthly Pro plan ID (`plan_...`) |
| `RAZORPAY_PRO_YEARLY_PLAN_ID` | Production | Yearly Pro plan ID (`plan_...`) |

> [!CAUTION]
> The centralized environment validator (`src/lib/config/env.ts`) will **halt execution** if `rzp_test_` keys, `sandbox` provider, or missing plan IDs are detected in production.

### C. Database Migration Verification
Ensure all Supabase migrations have been sequentially applied:
1. `supabase/migrations/001_phase6_user_accounts.sql`
2. `supabase/migrations/002_phase7_indexes.sql`
3. `supabase/migrations/003_phase9_student_ecosystem.sql`
4. `supabase/migrations/004_phase10_academic_snapshots.sql`
5. `supabase/migrations/005_phase11_admin_platform.sql`
6. `supabase/migrations/006_phase13_pro_subscriptions.sql`

---

## 2. Deployment Phase

1. **Deploy via Vercel CLI or Git Push**:
   ```bash
   vercel --prod
   ```
2. **Monitor Build Logs**:
   - Confirm Next.js compilation completes with 0 warnings.
   - Confirm serverless functions for `/api/health`, `/api/billing/checkout`, `/api/billing/webhook`, and `/api/billing/subscription` are generated.

---

## 3. Post-Deployment Smoke Tests (Section 36)

Execute these checks immediately following deployment:

- [ ] **1. Public Health Check**:
  ```bash
  curl -s -i https://<your-domain>/api/health
  ```
  Expected: `HTTP 200 OK`, `status: "ok"`, `service: "docease"`.
- [ ] **2. Security Headers Verification**:
  Inspect response headers for `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`.
- [ ] **3. Home & Public Navigation**:
  Load `/`, `/tools`, `/about`, `/contact`, `/terms`, `/privacy`. Confirm zero console errors.
- [ ] **4. Free In-Browser Conversion**:
  - Open `/tools/jpg-to-pdf`.
  - Convert a sample JPG image.
  - Verify countdown (3s) and single automatic download.
  - Verify Network tab: confirm zero file bytes uploaded to server.
- [ ] **5. Free Authenticated Tools**:
  - Log in with test credentials.
  - Test `/student/cgpa-calculator` and `/student/assignment-planner`.
  - Confirm calculations and local persistence work smoothly.
- [ ] **6. Pricing Page**:
  - Visit `/pricing`.
  - Toggle between Monthly (₹99) and Yearly (₹899).
  - Verify honesty disclaimer is present.
- [ ] **7. Admin Route Protection**:
  - In an incognito window, open `/admin`.
  - Confirm immediate redirect to `/login?next=/admin`.
  - Authenticate as admin; verify Admin Dashboard loads with real metrics.
- [ ] **8. Webhook Signature Verification**:
  - Send unsigned POST to `/api/billing/webhook`.
  - Confirm server returns `HTTP 401 Unauthorized` with signature error.

---

## 4. Emergency Rollback

If a critical failure occurs post-deployment:
1. In the Vercel Dashboard, go to **Deployments**.
2. Locate the last known good deployment.
3. Click **Instant Rollback**.
4. Refer to `docs/rollback-strategy.md` for database and webhook reconciliation procedures.
