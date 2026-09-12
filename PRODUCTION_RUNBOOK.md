# Saarvi — Production Runbook
**Version:** 0.1.0-rc1  
**System URL:** `https://saarvi.app`  
**Architecture:** Next.js 16 (App Router) + Supabase SSR Auth + Client-Side IndexedDB Workspace + Razorpay Payments + Gmail SMTP

This runbook provides step-by-step procedures for deploying, maintaining, troubleshooting, and recovering the Saarvi production environment.

---

## 1. Routine Deployment Procedure

### Pre-Deployment Checks
1. Ensure all local tests pass:
   ```bash
   npm test
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
2. Check for missing environment variables:
   ```bash
   node -e "const { validateProductionEnv } = require('./src/lib/config/env.ts'); console.log(validateProductionEnv());"
   ```

### Deployment Steps
1. **Push Code**: Push the release commit to the production branch (`main` or `release/v0.1.0`).
2. **Build Trigger**: Verify that the hosting provider (e.g., Vercel / Cloudflare Pages) initiates the build.
3. **Database Migration**: If database schema changes are required, apply them via Supabase CLI or Supabase Dashboard SQL Editor before traffic hits new routes.
4. **Smoke Test Health**:
   ```bash
   curl -s -i https://saarvi.app/api/health
   ```
   Verify response is `HTTP 200` with `application: "healthy"`.
5. **Post-Deployment Verification**: Run through the Release Candidate smoke test matrix.

---

## 2. Instant Rollback Procedure

### Application / Edge Rollback
If a critical regression, unexpected 500 error spike, or broken client script occurs:
1. Navigate to your Hosting Provider Dashboard (e.g. Vercel Deployments).
2. Locate the previous known-healthy deployment artifact.
3. Click **Rollback** or **Promote to Production**. Deployment takes < 30 seconds.
4. Purge edge CDN caches for all HTML routes (`/`, `/student/*`, `/tools/*`).
5. Verify health:
   ```bash
   curl -s https://saarvi.app/api/health
   ```

### Database Migration Rollback
If a database migration causes errors:
1. Check `supabase/migrations/` for the corresponding reverse SQL statements.
2. Execute the revert script in the Supabase SQL editor.
3. Note: Since student workspace documents are strictly local-first (stored in browser IndexedDB), user workspace data cannot be corrupted or lost by database rollbacks.

---

## 3. Google OAuth Failure & Recovery

### Symptoms
- Users clicking "Sign in with Google" receive an OAuth error screen (`access_denied`, `redirect_uri_mismatch`).
- Callback returns to `/login?error=Google+authentication+could+not+be+completed`.

### Triage & Resolution
1. **Check Google Cloud Console**:
   - Go to Google Cloud Console -> **APIs & Services** -> **Credentials**.
   - Select the OAuth 2.0 Client ID for Web Application.
   - Verify **Authorized JavaScript Origins** contains:
     - `https://saarvi.app`
   - Verify **Authorized Redirect URIs** contains:
     - `https://[YOUR_SUPABASE_REF].supabase.co/auth/v1/callback`
2. **Check Supabase Provider Settings**:
   - Go to Supabase Dashboard -> **Authentication** -> **Providers** -> **Google**.
   - Verify **Client ID** and **Client Secret** match the Google Cloud credentials.
   - Confirm toggle is set to **Enabled**.
3. **Check Client Code Configuration**:
   - Confirm `src/context/AuthContext.tsx` uses `prompt: "select_account"` and redirect URL `https://saarvi.app/auth/callback`.
4. **Temporary Fallback**:
   - Direct users to standard Email/Password authentication or Password Reset while Google Cloud propagates credentials.

---

## 4. Transactional Email Failure (Gmail SMTP)

### Symptoms
- Password reset emails, test emails, or scheduled reminders fail to deliver.
- `/admin/notifications` displays `Provider Error` or `Connection Failure`.

### Triage & Resolution
1. **Inspect Admin Notification Status**:
   - Open `https://saarvi.app/admin/notifications`.
   - Check the Transactional Email card error message.
2. **Verify Google App Password**:
   - Ensure the Google Account (`notifications@saarvi.app`) has **2-Step Verification** enabled.
   - If password was rotated or revoked, generate a fresh 16-character App Password at `myaccount.google.com/apppasswords`.
   - Update `SMTP_PASS` in the hosting environment variables and redeploy/restart.
3. **Test Email Probe**:
   - On `/admin/notifications`, click **Send Test Email** to an internal admin address.
   - Verify SMTP TLS handshake on port 465.
4. **Emergency Fallback Provider**:
   - If Gmail SMTP has an outage, switch `EMAIL_PROVIDER=resend` in environment variables with valid `RESEND_API_KEY`. The provider abstraction switches automatically without code edits.

---

## 5. Supabase Database & Auth Outage

### Symptoms
- API calls to Supabase return `503 Service Unavailable` or timeout.
- User login / signup fails with connection errors.

### Triage & Resolution
1. **Status Verification**:
   - Check official Supabase status at `status.supabase.com`.
2. **Platform Resiliency Invariant**:
   - Observe that Saarvi's **Local Resilient Store** automatically kicks in:
     - Guests and unauthenticated users can continue using all 45+ PDF/image tools locally.
     - Student tools (VTU SGPA/CGPA, Timetable, Attendance, Task Planner) continue functioning via client `IndexedDB`.
3. **Recovery**:
   - Once Supabase recovers, sessions refresh transparently via `@supabase/ssr` middleware.

---

## 6. Payment / Razorpay Failure

### Symptoms
- Checkout modal fails to initialize.
- Users complete payment but Pro tier does not activate.
- `/api/billing/webhook` returns 400 or 500.

### Triage & Resolution
1. **Inspect Razorpay Webhook Logs**:
   - Log into Razorpay Dashboard -> **Settings** -> **Webhooks**.
   - Review failed webhook delivery attempts.
   - Verify endpoint URL: `https://saarvi.app/api/billing/webhook`.
2. **Signature Verification**:
   - Ensure `RAZORPAY_WEBHOOK_SECRET` in production hosting exactly matches the secret set in Razorpay Dashboard.
3. **Manual Entitlement Activation (Admin Emergency)**:
   - If a student paid and webhook dropped, Super Admin can navigate to `/admin/billing` or `/admin/users` and reconcile subscription status with the Razorpay Payment ID (`pay_...`).
4. **Card / Gateway Issues**:
   - Saarvi does not process or store card data; direct payment gateway issues are handled by Razorpay. Users should retry or use alternative payment modes (UPI / Cards / NetBanking).

---

## 7. AI & OCR Provider Outage

### Symptoms
- Resume feedback, AI document summary, or OCR extraction returns timeout or error alert.

### Triage & Resolution
1. **Decoupled Graceful Degradation**:
   - Core application functionality is NOT blocked by AI/OCR outages.
   - Client UI displays user-friendly alert: *"AI document assistant is temporarily unavailable. Local document processing remains operational."*
2. **Provider Switch**:
   - If Gemini is degraded, switch `AI_PROVIDER=openrouter` in production environment variables.
3. **Rate Limits**:
   - If quota exhausted, check Google AI Studio or OpenRouter billing console.

---

## 8. Domain & SSL / DNS Failure

### Symptoms
- Domain fails to resolve (`NXDOMAIN`, `ERR_SSL_PROTOCOL_ERROR`).

### Triage & Resolution
1. **Check DNS Records**:
   - Apex domain (`saarvi.app`): Verify `A` / `ALIAS` records match hosting edge IP.
   - Subdomain (`www.saarvi.app`): Verify `CNAME` points to canonical host.
2. **SSL Certificate Expiration / Renewal**:
   - In hosting control panel, check SSL certificate status. Request manual renewal if auto-provisioning stalled.
3. **HSTS Invariant**:
   - Notice `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` is enforced; all HTTP requests are permanently upgraded to HTTPS.

---

## 9. Security Incident Handling

### Rapid Containment
1. If a compromised credential is suspected:
   - Immediately rotate the secret in the external provider console (Supabase, Razorpay, Google App Password).
   - Update production environment variables.
   - Redeploy the application.
2. Follow full incident procedures defined in `INCIDENT_RESPONSE.md`.
