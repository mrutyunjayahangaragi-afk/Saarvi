# Saarvi — GitHub Deployment & Production Operations Guide
**Repository:** `git@github.com:mrutyunjayahangaragi-afk/Saarvi.git`  
**Default Branch:** `main`  
**Production Canonical Domain:** `https://saarvi.app`  
**Philosophy:** Private by design. Fast by design. Simple by design.

This guide outlines the standard end-to-end Git workflow and continuous integration/deployment (CI/CD) procedure for the Saarvi platform.

---

## 1. Branching & Contribution Workflow

To protect the integrity of the production deployment:
1. **The `main` Branch**: Reserved exclusively for production-ready, verified code. Never push experimental or untested changes directly to `main`.
2. **Feature & Patch Branches**: Create branches from `main` following standard naming conventions:
   ```bash
   git checkout -b feature/academic-tools-v2
   # or
   git checkout -b fix/oauth-callback-url
   ```
3. **Commit Messages**: Use clean, conventional commit messages summarizing the technical change:
   ```bash
   git commit -m "feat(auth): sanitize redirect parameters in OAuth callback"
   ```

---

## 2. Automated Continuous Integration (CI) Lifecycle

Every pull request and push to `main` automatically triggers the GitHub Actions CI pipeline configured in `.github/workflows/ci.yml`.

```
[ Git Push / PR ]
       │
       ▼
[ GitHub Actions Runner (Ubuntu Latest) ]
       │
       ├─► 1. npm ci                   (Clean deterministic install)
       ├─► 2. npm run lint             (ESLint code quality checks)
       ├─► 3. npx tsc --noEmit         (Strict TypeScript type safety)
       ├─► 4. npm test                 (511 tests across 35 test suites)
       └─► 5. npm run build            (Next.js 16 production compilation of 129 routes)
```

### CI Failure Policy
- If **any** step fails (lint error, type error, broken unit test, or build failure), the pipeline fails immediately.
- Merging to `main` must be blocked by GitHub branch protection until all CI status checks pass.

---

## 3. Production Deployment Execution

### Recommended Hosting Platform: Vercel / Cloudflare Pages / Node.js
Next.js 16 App Router is natively optimized for edge deployment on Vercel:

1. **Connect GitHub Repository**:
   - Log in to the hosting dashboard (e.g. [vercel.com](https://vercel.com)).
   - Import `mrutyunjayahangaragi-afk/Saarvi`.
   - Production branch: `main`.
   - Framework preset: `Next.js`.
2. **Configure Production Environment Variables**:
   In the hosting dashboard settings, configure the environment variables specified in `.env.example`:
   - `NEXT_PUBLIC_APP_URL`: `https://saarvi.app`
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://[PROJECT_REF].supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `[ANON_KEY]`
   - `SUPABASE_SERVICE_ROLE_KEY`: `[SERVICE_ROLE_KEY]`
   - `BILLING_PROVIDER`: `razorpay`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`: `rzp_live_[KEY_ID]`
   - `RAZORPAY_KEY_ID`: `rzp_live_[KEY_ID]`
   - `RAZORPAY_KEY_SECRET`: `[SECRET]`
   - `RAZORPAY_WEBHOOK_SECRET`: `[WEBHOOK_SECRET]`
   - `RAZORPAY_PRO_MONTHLY_PLAN_ID`: `plan_[MONTHLY_99_ID]`
   - `RAZORPAY_PRO_YEARLY_PLAN_ID`: `plan_[YEARLY_899_ID]`
   - `EMAIL_PROVIDER`: `gmail`
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `465`
   - `SMTP_SECURE`: `true`
   - `SMTP_USER`: `notifications@saarvi.app`
   - `SMTP_PASS`: `[16_CHAR_GOOGLE_APP_PASSWORD]`
   - `EMAIL_FROM_EMAIL`: `notifications@saarvi.app`
   - `EMAIL_FROM_NAME`: `Saarvi`
   - `AI_PROVIDER`: `gemini`
   - `AI_API_KEY`: `[GEMINI_API_KEY]`
   - `OCR_PROVIDER`: `gemini`
   - `OCR_API_KEY`: `[GEMINI_API_KEY]`
3. **Trigger Deployment**:
   - Once environment variables are configured, merge the PR or push the release commit to `main`.
   - The hosting provider will build and deploy the application.

---

## 4. Post-Deployment Verification & Smoke Testing

Immediately following deployment, run the following verification checks:

1. **Edge Health Probe**:
   ```bash
   curl -s -i https://saarvi.app/api/health
   ```
   Confirm response is `HTTP 200 OK` with:
   - `status: "ok"`
   - `checks.application: "healthy"`
   - `checks.email.status: "operational"`
2. **Core Journey Spot Checks**:
   - Load homepage: `https://saarvi.app`
   - Test Google sign-in: Verify `prompt: "select_account"` triggers Google account selection.
   - Test document tool: Open `/tools/jpg-to-pdf`, process a local file, and verify the 3-second auto-download executes once.
   - Test VTU SGPA calculator: Verify deterministic marks calculation runs offline.
   - Test Admin Center: Navigate to `/admin` with an authenticated admin account and verify RBAC protection.

---

## 5. Instant Rollback Procedure

If a critical bug or regression escapes to production:
1. Open the Hosting Dashboard (e.g. Vercel Deployments).
2. Locate the previous healthy deployment artifact.
3. Click **Instant Rollback** or **Promote to Production**.
4. Edge routing updates across all CDN nodes in `< 30 seconds`.
5. Verify recovery with `curl -s https://saarvi.app/api/health`.
6. Refer to [PRODUCTION_RUNBOOK.md](file:///Users/mrutyunjayaashokhangaragi/.gemini/antigravity-ide/scratch/smart/PRODUCTION_RUNBOOK.md) for full incident instructions.
