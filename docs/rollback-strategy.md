# DocEase — Rollback Strategy & Data Integrity

This document defines the safe rollback procedures for the DocEase application, database, and billing systems during an operational incident.

---

## 1. Core Rollback Invariant

> [!CAUTION]
> **Never roll back database migrations blindly during a billing incident.**
> Subscriptions, payments, and invoices represent real customer financial commitments. Deleting columns or rolling back tables can permanently destroy proof of customer payments and trigger unauthorized entitlement revocation.

---

## 2. Application Layer Rollback (Vercel)

### When to Execute
- Runtime errors in Next.js pages or UI components.
- CSP header incompatibilities breaking assets or modal frames.
- Performance regressions in client-side WebAssembly tools.

### Execution Procedure
1. Navigate to **Vercel Dashboard > Deployments**.
2. Find the prior verified production deployment.
3. Click the three dots `...` and select **Promote to Production** (or **Instant Rollback**).
4. Vercel routes 100% of incoming production traffic to the prior build within seconds without rebuild delays.

---

## 3. Database Migration Safety & Rollback Rules

### Forward-Compatible Migrations
All DocEase migrations (such as `006_phase13_pro_subscriptions.sql`) are designed to be **additive and non-breaking**:
- Tables use `CREATE TABLE IF NOT EXISTS`.
- Columns are added with safe default values or nullable types.
- Constraints use unique indexes.

### If a Schema Incident Occurs
1. **Do NOT run `DROP TABLE`** on `subscriptions`, `billing_events`, or `invoices`.
2. If an index or constraint causes locks:
   - Identify the specific index via `pg_stat_activity`.
   - Safely drop the index concurrently:
     ```sql
     DROP INDEX CONCURRENTLY IF EXISTS idx_problematic_name;
     ```
3. If an RLS policy blocks legitimate admin queries:
   - Inspect existing policies:
     ```sql
     SELECT * FROM pg_policies WHERE tablename = 'subscriptions';
     ```
   - Reapply the verified policy from `006_phase13_pro_subscriptions.sql`.

---

## 4. Webhook Replay & Idempotency Safeguards

In the event of a webhook processing outage (e.g. server outage while Razorpay was delivering events):

1. **Razorpay Automated Retries**:
   - Razorpay automatically retries failed webhooks with exponential backoff over a 24-hour window.
2. **Idempotency Guarantee**:
   - DocEase records every event in `public.billing_events` using `provider_event_id UNIQUE`.
   - When webhooks are redelivered or manually replayed from the Razorpay Dashboard, DocEase detects existing records and returns `200 OK` with zero duplicate mutations or duplicate invoices.
3. **Manual Replay Procedure**:
   - In Razorpay Dashboard > Settings > Webhooks > Select Webhook > View Logs.
   - Filter by status `Failed`.
   - Click **Resend Webhook** for each failed event.
   - Confirm server logs show successful processing.

---

## 5. Billing Discrepancy Reconciliation

If an application rollback caused a temporary mismatch between Razorpay status and local database records:

1. **Do NOT manually force Pro in database.**
2. Use the safe server-side reconciliation method:
   ```ts
   await subscriptionService.reconcileSubscriptionWithProvider(userId, {
     adminId: currentAdmin.id,
     adminEmail: currentAdmin.email,
   });
   ```
3. The system queries Razorpay directly via official API, updates local database state to match verified provider status, and writes an immutable audit record.
