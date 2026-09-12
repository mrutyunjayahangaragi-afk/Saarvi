# Saarvi — Production Rollback Procedure
**Target Domain:** `https://saarvi.app`  
**Max Target Rollback Time:** < 60 seconds

This procedure outlines the exact steps to roll back a problematic production deployment to a known healthy state.

---

## 1. When to Initiate Rollback

Initiate rollback immediately if any of the following occur post-deployment:
- Core health check `GET /api/health` fails or throws 500 errors.
- Critical authentication regression (users unable to log in via Google or password).
- Critical conversion tool failure across multiple PDF/image tools.
- Unexpected spike in client-side runtime errors reported in `/admin/errors`.

---

## 2. Edge Hosting Rollback (< 30 Seconds)

### Step 1: Access Hosting Dashboard
1. Log in to your hosting provider control panel (e.g. Vercel Dashboard).
2. Navigate to **Deployments** under the `Saarvi` project.

### Step 2: Select Previous Stable Deployment
1. Locate the deployment immediately preceding the failing release (tagged with previous commit SHA).
2. Click the `...` menu on that deployment and select **Instant Rollback** or **Promote to Production**.

### Step 3: Edge Propagation & Verification
1. Edge routers update DNS routing within 10–30 seconds.
2. Verify production edge status:
   ```bash
   curl -s -i https://saarvi.app/api/health
   ```
   Confirm `status: "ok"` and `checks.application: "healthy"`.

---

## 3. Database Migration Rollback Procedure

If the release included database schema modifications in Supabase:
1. Open the Supabase Dashboard -> **SQL Editor**.
2. Locate the corresponding rollback SQL script (see `supabase/migrations/`).
3. Execute the `DROP` or `ALTER` reverse statements to restore the previous schema.
4. **Local-First Privacy Guarantee**: Because student notes, marks, timetables, and documents are stored in browser-local `IndexedDB`, database schema rollbacks **never** destroy, alter, or lose student workspace files.

---

## 4. Emergency Secret Rollback / Rotation

If a production environment variable or secret was misconfigured:
1. Open Hosting Dashboard -> **Settings** -> **Environment Variables**.
2. Update the affected variable (e.g., `SMTP_PASS`, `RAZORPAY_KEY_SECRET`).
3. Trigger a manual **Redeploy** of the current release without cache.
4. Verify `/api/health` reports the provider status as operational.

---

## 5. Post-Rollback Verification Checklist

- [ ] `GET https://saarvi.app/api/health` returns `HTTP 200 OK`.
- [ ] Google OAuth login tested and succeeds.
- [ ] At least one document tool (e.g. `/tools/jpg-to-pdf`) runs and produces output.
- [ ] At least one student tool (e.g. `/student/sgpa-calculator`) calculates marks correctly.
- [ ] Incident report initiated in `incident/` as per `INCIDENT_PLAYBOOK.md`.
