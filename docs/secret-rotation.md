# DocEase — Zero-Downtime Secret Rotation Guide

This document outlines the step-by-step procedures for rotating production secrets without service interruptions or transaction failures.

---

## 1. Razorpay API Secret Rotation

Razorpay supports overlapping API keys to allow zero-downtime rotation.

### Procedure
1. **Log in to Razorpay Dashboard**:
   - Navigate to **Settings > API Keys**.
2. **Generate New Key Pair**:
   - Click **Regenerate Key**.
   - Razorpay provides options:
     - *Deactivate old key immediately* (DO NOT SELECT).
     - *Deactivate old key in 24 hours* (**SELECT THIS OPTION**).
   - Copy the new `Key ID` and `Key Secret`.
3. **Update Vercel Environment Variables**:
   - Update `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID` in Vercel Project Settings.
4. **Trigger Production Redeployment**:
   - Deploy the new environment variables (`vercel --prod` or Git push).
5. **Verify Smoke Test**:
   - Perform a test checkout to confirm new credentials accept charges.
6. **Revoke Old Key**:
   - Once all traffic has shifted to the new deployment, manually deactivate the old key in Razorpay or let the 24-hour window expire.

---

## 2. Razorpay Webhook Secret Rotation

### Procedure
1. **Generate New Webhook Secret**:
   - Generate a cryptographically secure 32+ character string using OpenSSL:
     ```bash
     openssl rand -hex 24
     ```
2. **Dual-Verification Deployment**:
   - If supporting zero-downtime transition, update `razorpayClient.ts` to check both the new secret and the old secret during the 5-minute transition window.
3. **Update Webhook in Razorpay**:
   - In **Settings > Webhooks**, edit the DocEase webhook endpoint.
   - Replace the secret with the new string and click **Save**.
4. **Update Production Environment**:
   - Update `RAZORPAY_WEBHOOK_SECRET` in Vercel and redeploy.
5. **Verify Webhook Delivery**:
   - Trigger a test event or review live webhook logs to confirm signatures pass with `200 OK`.

---

## 3. Supabase Service Role Key Rotation

### Procedure
1. **Access Supabase Dashboard**:
   - Navigate to **Project Settings > API**.
2. **Generate New Service Role Key**:
   - Under **Project API keys**, click **Generate new key** next to `service_role`.
   - Set expiration for the existing key.
3. **Update Hosting Environment**:
   - Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel settings.
4. **Redeploy and Monitor**:
   - Trigger production deployment and verify `/api/health` reports healthy database connectivity.

---

## 4. Operational Safety Invariants
- Never echo or output secret values to terminal logs or CI runner outputs.
- Never commit `.env` or `.env.local` files to Git.
- Regularly audit Vercel deployment logs to ensure no secret values are printed during build or runtime.
