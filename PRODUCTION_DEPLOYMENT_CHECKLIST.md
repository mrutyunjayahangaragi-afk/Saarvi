# Saarvi — Production Deployment Checklist
**Release Candidate Version:** 0.1.0-rc1  
**Target Canonical URL:** `https://saarvi.app`  
**Brand Philosophy:** Private by design. Fast by design. Simple by design.

This checklist outlines the mandatory technical, operational, and architectural verifications required prior to and during deployment of Saarvi to production. Every item corresponds to real configuration, scripts, or operational interfaces in the codebase.

---

## 1. Pre-Deployment Validation
- [ ] **Clean Git Workspace**: Verify that no uncommitted modifications or temporary debug logs exist.
- [ ] **Zero Secrets in Repository**: Confirm `.env` and `.env.local` remain untracked and that `.gitignore` prevents secret check-ins.
- [ ] **Type Safety Verification**: Execute `npx tsc --noEmit` and confirm exit code `0`.
- [ ] **Automated Test Suite**: Run `npm test` and verify that all 511 tests across 35 test suites pass cleanly.
- [ ] **Lint & Style Check**: Run `npm run lint` and verify clean execution with zero blocking errors.
- [ ] **Production Compilation**: Execute `npm run build` and ensure all 129 static, SSG, and dynamic routes compile successfully.

---

## 2. Environment Variables & Secret Configuration
- [ ] **Domain**: Set `NEXT_PUBLIC_APP_URL=https://saarvi.app` in the production hosting dashboard (e.g., Vercel / Cloudflare).
- [ ] **Environment**: Set `NODE_ENV=production`.
- [ ] **Supabase Public Keys**:
  - `NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_PRODUCTION_ANON_KEY]`
- [ ] **Supabase Server Keys**:
  - `SUPABASE_SERVICE_ROLE_KEY=[YOUR_PRODUCTION_SERVICE_ROLE_KEY]` (Stored strictly in server environment; NEVER exposed via `NEXT_PUBLIC_`).
- [ ] **Razorpay Live Credentials**:
  - `BILLING_PROVIDER=razorpay`
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_[PRODUCTION_KEY_ID]`
  - `RAZORPAY_KEY_ID=rzp_live_[PRODUCTION_KEY_ID]`
  - `RAZORPAY_KEY_SECRET=[PRODUCTION_KEY_SECRET]`
  - `RAZORPAY_WEBHOOK_SECRET=[PRODUCTION_WEBHOOK_SECRET]`
  - `RAZORPAY_PRO_MONTHLY_PLAN_ID=plan_[PRODUCTION_MONTHLY_99_ID]`
  - `RAZORPAY_PRO_YEARLY_PLAN_ID=plan_[PRODUCTION_YEARLY_899_ID]`
- [ ] **Gmail SMTP Production Credentials**:
  - `EMAIL_PROVIDER=gmail`
  - `SMTP_HOST=smtp.gmail.com`
  - `SMTP_PORT=465`
  - `SMTP_SECURE=true`
  - `SMTP_USER=notifications@saarvi.app`
  - `SMTP_PASS=[16_CHAR_GOOGLE_APP_PASSWORD]`
  - `EMAIL_FROM_EMAIL=notifications@saarvi.app`
  - `EMAIL_FROM_NAME=Saarvi`
- [ ] **Optional Provider Credentials**:
  - `AI_PROVIDER=gemini`
  - `AI_API_KEY=[PRODUCTION_GEMINI_API_KEY]`
  - `OCR_PROVIDER=gemini`
  - `OCR_API_KEY=[PRODUCTION_GEMINI_API_KEY]`

---

## 3. Authentication & Supabase Readiness
- [ ] **Production Database Migrations**: Apply all migrations located in `supabase/migrations/` to the production instance.
- [ ] **Row Level Security (RLS)**: Verify RLS is enabled on all tables (`profiles`, `subscriptions`, `feature_flags`, `system_audit_logs`).
- [ ] **Site URL & Redirects in Supabase**:
  - Site URL configured as `https://saarvi.app`.
  - Redirect URIs configured:
    - `https://saarvi.app/auth/callback`
    - `https://saarvi.app/reset-password`
    - `https://saarvi.app/dashboard`
- [ ] **Email Auth Templates**: Ensure Supabase confirmation and recovery email templates use `https://saarvi.app` domain links.
- [ ] **Admin Account Bootstrap**: Confirm that initial platform administrators have `role = 'ADMIN'` or `role = 'SUPER_ADMIN'` in the `profiles` table.

---

## 4. Google OAuth Production Configuration
- [ ] **Google Cloud Console Credentials**:
  - Authorized JavaScript Origins: `https://saarvi.app`
  - Authorized Redirect URI: `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
- [ ] **Account Chooser Invariant**: Confirm client configuration uses `prompt: "select_account"` (NOT `prompt: "consent"`).
- [ ] **Open-Redirect Defense**: Confirm `/auth/callback` route validates destination URLs using `sanitizeInternalRedirectUrl` to prevent phishing forwards.

---

## 5. Transactional Email & Notifications
- [ ] **Gmail App Password Active**: Verify Google 2-Step Verification is active on `notifications@saarvi.app` and App Password is generated.
- [ ] **Admin Status Verification**: Navigate to `/admin/notifications` and verify:
  - Provider displays `Gmail SMTP`
  - Status displays `Configured / Operational`
- [ ] **Test Email Probe**: Dispatch test email from `/admin/notifications` to an internal address and verify receipt within 60 seconds.
- [ ] **Reminder Scheduler**: Confirm recurring cron/worker triggers `/api/notifications/process` with authorized bearer token.

---

## 6. Razorpay Production Payments
- [ ] **Razorpay Account Activation**: Confirm Razorpay account is fully KYC-verified and switched to **Live Mode**.
- [ ] **Plan Pricing Invariants**:
  - Pro Monthly: strictly ₹99 (billing frequency: monthly).
  - Pro Yearly: strictly ₹899 (billing frequency: yearly).
- [ ] **Webhook Endpoint Registration**:
  - URL: `https://saarvi.app/api/billing/webhook`
  - Subscribed Events: `payment.captured`, `subscription.activated`, `subscription.charged`, `subscription.cancelled`
  - Secret: Matches `RAZORPAY_WEBHOOK_SECRET` in environment variables.
- [ ] **Idempotency Verification**: Confirm `processed_events` prevents double-crediting entitlements.

---

## 7. AI / OCR Decoupled Service Readiness
- [ ] **Consent Invariant**: Confirm client requires user consent before any text or image chunk is transmitted to server AI endpoints.
- [ ] **Decoupled Architecture**: Confirm that if `AI_API_KEY` is missing or exhausted, core document processing (PDF merge/compress/convert) and VTU academic calculations function 100% locally.
- [ ] **Deterministic ATS Invariant**: Confirm ATS resume scoring and keyword parsing never rely on external black-box models for basic arithmetic.

---

## 8. Security & HTTP Headers
- [ ] **Content Security Policy (CSP)**:
  - `default-src 'self'`
  - `img-src 'self' data: blob: https://*.razorpay.com https://*.googleusercontent.com`
  - `connect-src 'self' https://api.razorpay.com https://*.supabase.co`
- [ ] **Clickjacking Protection**: `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`.
- [ ] **MIME Sniffing**: `X-Content-Type-Options: nosniff`.
- [ ] **HSTS**: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- [ ] **Referrer Policy**: `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] **Permissions Policy**: `camera=(), microphone=(), geolocation=()`.

---

## 9. Domain, DNS & SSL Configuration
- [ ] **Apex & Subdomain Records**:
  - `A` / `CNAME` for `saarvi.app` pointing to production edge cluster.
  - `CNAME` for `www.saarvi.app` redirecting cleanly (301) to `https://saarvi.app`.
- [ ] **Automatic SSL/TLS**: Confirm valid Certificate Authority issuance (e.g. Let's Encrypt / DigiCert) supporting TLS 1.3.
- [ ] **Robots & Sitemap**:
  - `https://saarvi.app/robots.txt` resolves and disallows `/admin`, `/dashboard`, `/auth`.
  - `https://saarvi.app/sitemap.xml` resolves and contains all canonical public tools and landing pages.

---

## 10. Monitoring, Health Checks & Observability
- [ ] **Public Health Endpoint**: Verify `GET https://saarvi.app/api/health` returns `HTTP 200` with:
  - `checks.application === 'healthy'`
  - Provider health breakdown without secret exposure.
- [ ] **Error Reporting**: Confirm `src/lib/monitoring/errorTracker.ts` logs runtime exceptions without PII or sensitive payload contents.
- [ ] **Latency Telemetry**: Confirm telemetry p50/p95 percentiles record accurately in `/admin/analytics`.

---

## 11. Rollback Preparation
- [ ] **Previous Deployment Hash**: Tag previous stable build release in hosting dashboard.
- [ ] **Database Rollback Steps**: Verify all new migrations have idempotent revert statements.
- [ ] **Emergency Contact**: Follow incident runbook in `INCIDENT_RESPONSE.md`.
