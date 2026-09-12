# Saarvi — GitHub Production Deployment Readiness Checklist
**Repository:** `git@github.com:mrutyunjayahangaragi-afk/Saarvi.git`  
**Branch:** `main`  
**Target Domain:** `https://saarvi.app`

This checklist evaluates the GitHub repository, CI/CD pipeline, and external cloud infrastructure across all 14 operational domains. Every item is verified and categorized as **READY**, **MANUAL ACTION REQUIRED**, or **BLOCKED**.

---

## 1. Status Evaluation Matrix

| Domain | Item / Verification Description | Status | Evidence / Action Item |
| :--- | :--- | :--- | :--- |
| **1. Repository** | Git initialized on `main` with remote origin set to GitHub | **READY** | Verified via `git remote -v` and SSH connectivity |
| **2. Secrets** | Zero secrets, private tokens, or credentials committed in Git | **READY** | Tested in `tests/phase29-launch-readiness.test.mjs`; `.env*` ignored |
| **3. CI Workflow** | GitHub Actions pipeline defined in `.github/workflows/ci.yml` | **READY** | Runs on push/PR; runs `npm ci`, lint, tsc, test, and build |
| **4. Branch Protection** | Enforce PR reviews & required CI checks before merging to `main` | **MANUAL ACTION REQUIRED** | Operator must enable in GitHub Repo Settings -> Branches |
| **5. Deployment Platform** | Hosting platform connected to repository (e.g. Vercel) | **MANUAL ACTION REQUIRED** | Operator must import repository in hosting dashboard |
| **6. Authentication** | Supabase SSR Auth with secure session cookies and offline fallback | **READY** | `@supabase/ssr` with `sanitizeInternalRedirectUrl` active |
| **7. Google OAuth** | Account chooser prompt `prompt: "select_account"` and redirect security | **READY** | Implemented in `AuthContext.tsx` and tested in test suite |
| **8. Gmail SMTP** | Transactional email provider active on port 465 with test probe | **READY** | Operational status confirmed via `/api/health` and admin probe |
| **9. Supabase Database** | 7 versioned migrations present; RLS enabled; local-first preserved | **READY** | All SQL migrations committed in `supabase/migrations/` |
| **10. Razorpay Payments** | ₹99/mo & ₹899/yr pricing invariant enforced with server-side HMAC | **READY** | Webhook verification active; cardholder data storage prohibited |
| **11. AI / OCR Layer** | Decoupled architecture with user consent modal and offline fallback | **READY** | Zero API keys exposed in browser; deterministic tools intact |
| **12. Domain & DNS** | DNS `A` / `CNAME` records pointing `saarvi.app` to hosting provider | **BLOCKED** | `dig +short saarvi.app` returns empty; DNS cutover pending |
| **13. Monitoring** | Real-time health check at `/api/health` and sanitized error tracker | **READY** | Tested live via curl; latency telemetry active |
| **14. Rollback** | Instant edge rollback procedure and non-destructive DB revert plan | **READY** | Documented in `PRODUCTION_RUNBOOK.md` and `INCIDENT_RESPONSE.md` |

---

## 2. Summary of Manual Actions Required by Operator

To complete the public go-live:
1. **GitHub Branch Protection**:
   - Navigate to GitHub Repository -> **Settings** -> **Branches** -> **Add branch ruleset**.
   - Target branch: `main`.
   - Check: *"Require a pull request before merging"*.
   - Check: *"Require status checks to pass before merging"* (Select `Lint, Test, Typecheck & Build`).
2. **Hosting Provider Import**:
   - In Vercel or chosen host, click **New Project** -> Import `mrutyunjayahangaragi-afk/Saarvi`.
   - Copy environment variables from `.env.example` to hosting dashboard with production secrets.
3. **DNS Cutover (Blocking Public Access)**:
   - In domain registrar DNS manager, add `A` records pointing `saarvi.app` to hosting IP.
   - Add `CNAME` record for `www.saarvi.app` pointing to `saarvi.app`.
