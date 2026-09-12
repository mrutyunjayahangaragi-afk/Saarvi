# DocEase — Incident Response Procedures

This guide provides operational runbooks for resolving production incidents across payment, database, entitlement, and security boundaries.

---

## 1. Incident Severity Classification

| Level | Definition | Target Resolution |
|-------|------------|-------------------|
| **SEV-1 (Critical)** | Payments failing across all users; data breach; secret compromised; full site outage. | < 30 minutes |
| **SEV-2 (High)** | Webhooks failing; user unable to activate Pro after successful payment; database latency spike. | < 2 hours |
| **SEV-3 (Medium)** | Rate limiter blocking legitimate users; false warning in admin health probe. | < 8 hours |
| **SEV-4 (Low)** | Minor logging discrepancy or UI cosmetic alignment. | Next sprint |

---

## 2. Runbook: Razorpay Webhook Failures

### Symptoms
- Customers pay successfully in Razorpay Checkout, but their Pro plan does not activate.
- `/checkout/confirmation` reaches the 30-second timeout showing "Payment received. We're still confirming your subscription."

### Triage & Resolution
1. **Check Webhook Delivery Status in Razorpay Dashboard**:
   - Go to **Settings > Webhooks > Logs**.
   - Check HTTP response code:
     - `401 Unauthorized`: Indicates `RAZORPAY_WEBHOOK_SECRET` mismatch or missing raw body parsing. Verify environment variable in Vercel.
     - `500 Internal Server Error`: Check Vercel Function logs for uncaught exceptions in `subscriptionService.ts`.
     - `429 Too Many Requests`: Verify IP rate limiter configuration on `/api/billing/webhook`.
2. **Review Idempotency Table**:
   - Inspect `public.billing_events` table for the specific `provider_event_id`.
3. **Trigger Manual Replay**:
   - Once the server configuration is fixed, click **Resend** in the Razorpay Webhook log.
   - Confirm user subscription switches to `ACTIVE`.

---

## 3. Runbook: Billing Database Outage

### Symptoms
- `GET /api/health` reports `database: "unhealthy"` or connection timeout.
- Checkout returns `503 Service Unavailable`.

### Triage & Resolution
1. **Preserve Free Document Tools**:
   - Verify that guest and free browser-based file tools (JPG $\to$ PDF, PDF Merge, etc.) continue operating in-browser. DocEase's local-first architecture ensures client conversions succeed even when the database is unreachable.
2. **Check Supabase Project Status**:
   - Visit [Supabase Status](https://status.supabase.com) and your project dashboard.
   - Check connection pool exhaustion (PgBouncer) or CPU spikes.
3. **Restart Connection Poolers**:
   - If pooling connection limit is exceeded, restart PgBouncer in Supabase dashboard.

---

## 4. Runbook: Compromised Secret or Key Leak

### Symptoms
- Secret detected in public Git repository or third-party log.
- Suspicious API calls observed in Razorpay or Supabase logs.

### Triage & Resolution
1. **Immediately Rotate Key** (Follow `docs/secret-rotation.md`).
2. **Invalidate Old Key in Razorpay**:
   - Generate a new Key ID and Key Secret in Razorpay Dashboard.
   - Set expiry on the old key to 1 hour (or immediate revoke).
3. **Update Vercel Environment Variables**:
   - Deploy new environment variables to production.
4. **Audit Billing Events**:
   - Review all `billing_events` and `subscriptions` created in the last 24 hours for anomalies.

---

## 5. Runbook: Duplicate Subscription or Double-Click Incidents

### Symptoms
- User reports two active subscriptions or two charges for the same billing cycle.

### Triage & Resolution
1. **Inspect Subscription Records**:
   - Query user's subscriptions in database:
     ```sql
     SELECT * FROM public.subscriptions WHERE user_id = '<user_uuid>';
     ```
2. **Server Enforcement Check**:
   - DocEase's `POST /api/billing/checkout` strictly rejects duplicate checkouts if an active subscription exists (`409 Conflict`).
   - If two charges occurred (e.g. user paid on two different devices simultaneously), identify the duplicate in Razorpay Dashboard.
3. **Issue Provider Refund**:
   - Inside Razorpay Dashboard, locate the duplicate payment and trigger a full refund.
   - Cancel the redundant subscription in Razorpay.
   - Run safe reconciliation in DocEase to ensure the user retains exactly one `ACTIVE` subscription.

---

## 6. Runbook: Rate Limiting False Positives

### Symptoms
- Legitimate users report `429 Too Many Requests` on checkout or confirmation pages.

### Triage & Resolution
1. **Check IP Masking & Proxies**:
   - Ensure the IP resolver in `rateLimit.ts` properly parses `x-forwarded-for` from Vercel edge headers so multiple users behind a corporate NAT or college Wi-Fi are not lumped into a single IP quota.
2. **Adjust Limits via Environment**:
   - If necessary, increase rate limits from 15/min to 30/min in `src/lib/billing/rateLimit.ts`.
