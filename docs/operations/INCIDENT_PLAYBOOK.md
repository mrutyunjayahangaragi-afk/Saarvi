# Saarvi — Production Incident Playbook & Response Runbook
**Target Scope:** `https://saarvi.app`  
**Operational Framework:** Role-Based Incident Management & Structured Playbooks

This playbook defines specific, actionable procedures for responding to production outages, security anomalies, and provider degradations.

---

## 1. Incident Severity Definitions

- **SEV-1 (Critical)**: Total platform outage, critical authentication failure, confirmed security compromise, or payment processing failure.
  - *SLA*: Immediate response (< 15 mins), Target resolution: < 2 hours.
- **SEV-2 (Major)**: Degradation of a major feature (Google OAuth, Gmail SMTP, billing webhooks) where core local document tools still function.
  - *SLA*: Response < 1 hour, Target resolution: < 8 hours.
- **SEV-3 (Minor)**: Cosmetic glitches, non-blocking UI bugs, or temporary optional AI/OCR provider timeouts with existing fallbacks.
  - *SLA*: Response < 4 hours, Target resolution: Next sprint release.

---

## 2. Standard 6-Phase Incident Lifecycle

```
1. IDENTIFY ──► 2. CONTAIN ──► 3. DIAGNOSE ──► 4. FIX ──► 5. VERIFY ──► 6. PIR
```

1. **Identify**: Triage incoming alert from `/api/health`, admin dashboard, or support email (`support@saarvi.app`). Assign Incident Commander.
2. **Contain**: Prevent further impact (e.g. roll back edge deployment, rotate compromised secret, or disable broken external integration).
3. **Diagnose**: Analyze safe error logs in `/admin/errors` and telemetry percentiles.
4. **Fix**: Develop targeted patch, run automated regression tests (`npm test`, `npx tsc --noEmit`), and deploy via standard CI/CD.
5. **Verify**: Test endpoints using live curl probes and release candidate smoke-test matrix.
6. **Post-Incident Review (PIR)**: Complete a post-mortem within 48 hours for all SEV-1 and SEV-2 incidents.

---

## 3. Dedicated Subsystem Playbooks

### Playbook A: Total Application Outage (SEV-1)
1. **Check Edge Status**: Run `curl -s -i https://saarvi.app/api/health`.
2. **Hosting Provider**: Log in to Vercel/hosting dashboard; check for build or edge deployment crash.
3. **Action**: If latest deployment introduced a crash, execute an **Instant Rollback** to the last known stable deployment (< 30s).
4. **DNS**: If domain does not resolve, check registrar DNS records (`A` and `CNAME`).

### Playbook B: Google OAuth Failure (SEV-2)
1. **Symptom**: Users receive `access_denied` or callback redirects with error.
2. **Check Google Cloud Console**:
   - Verify Authorized JavaScript Origins: `https://saarvi.app`.
   - Verify Authorized Redirect URIs: `https://[SUPABASE_PROJECT].supabase.co/auth/v1/callback`.
3. **Check Supabase Provider**:
   - Confirm Google Provider is toggled ON and client credentials match Google Cloud Console.
4. **Communication**: Advise users to use Email/Password sign-in while Google OAuth propagates.

### Playbook C: Gmail SMTP Outage (SEV-2)
1. **Symptom**: Password reset emails or scheduled reminders fail to send.
2. **Check Admin Notifications**: Open `/admin/notifications` and inspect Gmail SMTP card.
3. **App Password Verification**:
   - Check if the 16-character Google App Password on `notifications@saarvi.app` was revoked or expired.
   - Generate a fresh App Password at `myaccount.google.com/apppasswords`.
   - Update `SMTP_PASS` in hosting environment variables and redeploy.
4. **Emergency Provider Fallback**: Switch `EMAIL_PROVIDER=resend` with valid `RESEND_API_KEY` to restore delivery immediately.

### Playbook D: Razorpay Payment & Webhook Failure (SEV-1/SEV-2)
1. **Symptom**: User successfully pays on checkout, but Pro tier does not activate.
2. **Inspect Webhook Delivery**:
   - Open Razorpay Dashboard -> **Settings** -> **Webhooks**.
   - Review recent deliveries to `https://saarvi.app/api/billing/webhook`.
3. **Signature Mismatch**:
   - Verify `RAZORPAY_WEBHOOK_SECRET` in hosting matches the secret in Razorpay Dashboard.
4. **Manual Entitlement Reconcile**:
   - Admin verifies Razorpay Payment ID (`pay_...`) and activates entitlement via `/admin/billing`.

### Playbook E: Secret Compromise / Security Anomaly (SEV-1)
1. **Immediate Invalidation**: Rotate the affected secret immediately at the provider source (Google Cloud, Supabase, Razorpay, or Google Account).
2. **Environment Update**: Replace the secret in the hosting provider dashboard.
3. **Redeploy**: Trigger production redeployment.
4. **Audit**: Review `/admin/audit-logs` for unauthorized actions during the vulnerability window.

---

## 4. Post-Incident Review (PIR) Template

For every SEV-1 and SEV-2 incident, save a report to `incident/YYYY-MM-DD-[short-name].md` using this template:

```markdown
# Incident Report: [YYYY-MM-DD] - [Short Incident Title]

## Executive Summary
- **Incident ID**: INC-[YYYYMMDD]
- **Severity**: SEV-[1|2]
- **Start Time**: YYYY-MM-DD HH:MM UTC
- **End Time**: YYYY-MM-DD HH:MM UTC
- **Total Duration**: [X] minutes
- **Incident Commander**: [Role / Name]

## Impact
- Features affected: [e.g. Google OAuth, Email, Billing]
- User impact: [e.g. 15 login attempts delayed; zero workspace data compromised]

## Timeline
- **HH:MM** - Incident detected via [Alert / User Report]
- **HH:MM** - Incident Commander assigned; SEV-[X] declared
- **HH:MM** - Containment action executed
- **HH:MM** - Root cause identified
- **HH:MM** - Fix deployed to production
- **HH:MM** - Verification confirmed via /api/health; incident resolved

## Root Cause Analysis
[Technical explanation of the underlying cause]

## Action Items & Preventative Measures
- [ ] Add regression test in `tests/` (Owner: Lead Engineer)
- [ ] Update documentation / runbook (Owner: Ops Lead)
- [ ] Monitoring alert threshold adjustment (Owner: DevOps)
```
