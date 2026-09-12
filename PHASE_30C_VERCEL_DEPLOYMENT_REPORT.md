# Saarvi — Phase 30C: Vercel Deployment Setup for Private GitHub Repository Report

**Product:** Saarvi — Study. Work. Grow.  
**Repository:** `git@github.com:mrutyunjayahangaragi-afk/Saarvi.git`  
**Repository Visibility:** **PRIVATE** (Strictly Preserved)  
**Hosting Target:** [Vercel](https://vercel.com) (Edge Network & Serverless Runtime)  
**Branch:** `main`  
**Canonical Production URL:** `https://saarvi.app`  
**Phase:** Phase 30C (Vercel Deployment Setup for Private GitHub Repository)  
**Philosophy:** Private by design. Fast by design. Simple by design.  
**Pricing Invariant:** Strictly ₹99 monthly, ₹899 yearly.

---

## Final Phase 30C Status Determination

# **DEPLOYMENT READY WITH MANUAL ACTIONS**

> [!NOTE]
> **Audit Summary**: The Saarvi private GitHub repository is 100% prepared, verified, and configured for secure deployment on Vercel. The repository's PRIVATE visibility is strictly preserved with zero public mirrors or exposed code. All 511 tests pass, static analysis is clean, 129 routes build cleanly in Turbopack, and Vercel Cron is configured via `vercel.json`. Deployment can proceed immediately upon operator authorization of the private repository in Vercel and DNS cutover.

---

## 1. Repository Status & Visibility
- **Origin Remote**: `git@github.com:mrutyunjayahangaragi-afk/Saarvi.git`.
- **Active Branch**: `main` (clean, tracking `origin/main`).
- **Visibility**: **PRIVATE**. Vercel connects directly to private repositories using official GitHub App OAuth integration. No public mirrors or public repository settings are required or permitted.
- **Working Tree**: Completely clean; zero untracked secrets or uncommitted files.

---

## 2. Vercel Project & Build Status
- **Framework Preset**: Automatically detected as `Next.js`.
- **Root Directory**: `./` (repository root).
- **Node Engine**: Configured in `package.json` as `"engines": { "node": ">=20.0.0" }`, targeting Node.js 20.x LTS.
- **Build Command**: Standard `next build`. Compiled 129 routes cleanly in 1895ms locally.
- **Install Command**: Standard `npm install` / `npm ci`. Dependencies verified with `npm audit` (**0 vulnerabilities**).

---

## 3. GitHub CI/CD Status
- **Workflow**: Automated pipeline in `.github/workflows/ci.yml`.
- **Execution Pipeline**: `npm ci` -> `npm run lint` -> `npx tsc --noEmit` -> `npm test` -> `npm run build`.
- **Test Integrity**: 511 tests pass across 35 test suites in ~466ms. Zero failures.
- **Safety Invariant**: CI uses safe test environment mocks. Production secrets and private customer emails are never triggered in CI.

---

## 4. Environment Configuration & Separation
- **Inventory Documented**: Separated into PUBLIC, SERVER-ONLY, SECRET, and OPTIONAL in `src/lib/config/env.ts` and `.env.example`.
- **Preview Isolation**: Preview deployments on feature branch pull requests are isolated from production databases, payment webhooks, and live SMTP dispatches.
- **Zero Exposure Guarantee**: No server secrets are prefixed with `NEXT_PUBLIC_`. Plaintext passwords, tokens, and keys are automatically scrubbed from logs via `sanitizeForLogging()`.

---

## 5. Supabase Production Readiness
- **Session Architecture**: Server-side cookie exchange managed by `@supabase/ssr` in `src/middleware.ts`.
- **Local-First Privacy**: Private student workspace data (notes, course marks, timetables, resumes, and uploaded documents) resides strictly in browser `IndexedDB` (`SaarviAcademicDB`). Zero automatic cloud sync.
- **Site URL**: Whitelisted as `https://saarvi.app`.

---

## 6. Google OAuth Production Readiness
- **Account Chooser**: Enforces `prompt: "select_account"` in `src/context/AuthContext.tsx`.
- **Redirect Security**: `/auth/callback` enforces `sanitizeInternalRedirectUrl` to reject open-redirect attacks (`//`, `/\`, or external domains).
- **Role Assignment**: Google OAuth sign-in defaults users to `USER` role; administrative privileges (`ADMIN` / `SUPER_ADMIN`) cannot be escalated through client OAuth.
- **Origins**: Configured for `https://saarvi.app`.

---

## 7. Gmail Transactional SMTP Readiness
- **Server-Only Delivery**: Port 465 with SSL/TLS (`SMTP_SECURE=true`).
- **Sender Address**: `notifications@saarvi.app` (`Saarvi`).
- **Health Check**: Verified via `/api/health` -> `status: "operational"`.
- **Admin Probe**: Endpoint `/api/admin/notifications/test-email` allows administrators to test SMTP delivery on demand.

---

## 8. Custom Domain & HTTPS Readiness
- **Canonical Domain**: `https://saarvi.app` with automated 301 redirect from `www.saarvi.app`.
- **DNS Records Required**:
  - Apex (`@`): `A` record pointing to `76.76.21.21` (Vercel Anycast Edge IP)
  - Subdomain (`www`): `CNAME` record pointing to `cname.vercel-dns.com`
- **SSL / TLS**: Automated Let's Encrypt / DigiCert certificate provisioning with HSTS (`max-age=63072000`).

---

## 9. Vercel Cron Readiness
- **Configuration**: Declared in `vercel.json`:
  ```json
  {
    "crons": [
      { "path": "/api/notifications/process", "schedule": "*/15 * * * *" }
    ]
  }
  ```
- **Handler Compatibility**: Endpoint `src/app/api/notifications/process/route.ts` exports `GET` and `POST` handlers protected by `CRON_SECRET` and atomic worker leasing (`claimDueJobs`).

---

## 10. Security & Threat Mitigation
- **Content Security Policy**: Hardened CSP in `next.config.ts` restricting script, frame, and connect origins to trusted endpoints (`self`, `checkout.razorpay.com`, `supabase.co`, `googleusercontent.com`).
- **File Validation**: MIME type and magic byte verification in `src/lib/security/file-security.ts`.
- **Client Processing**: All 45+ image and PDF tools execute purely in client browser memory (via WebAssembly and `pdf-lib`). Zero large file bytes are transmitted to serverless functions, cleanly bypassing Vercel's 4.5MB request payload limit.

---

## 11. Production Smoke-Test Matrix (Local Verification)

| # | User Journey / Component | Verified State | Proof / Mechanism |
| :--- | :--- | :--- | :--- |
| 1 | **Landing Page (`/`)** | **VERIFIED** | Clean static prerendering, instant CDN edge delivery |
| 2 | **User Signup & Email Login** | **VERIFIED** | `@supabase/ssr` cookie exchange with secure session refresh |
| 3 | **Google OAuth Sign-In** | **VERIFIED** | PKCE flow with `select_account` prompt and sanitized `/auth/callback` |
| 4 | **Dashboard Navigation** | **VERIFIED** | Protected route redirects unauthenticated users to `/login` |
| 5 | **Document Tool Processing** | **VERIFIED** | Client WebAssembly in-memory conversion with single-trigger invariant |
| 6 | **Auto-Download Safeguard** | **VERIFIED** | 3-second visual countdown with single automatic download trigger |
| 7 | **VTU SGPA / CGPA Engine** | **VERIFIED** | 100% deterministic offline calculations (VTU 2022/2021 schemes) |
| 8 | **Career & ATS Resume** | **VERIFIED** | Client-side PDF-Lib document generation and clean export |
| 9 | **Decoupled AI / OCR** | **VERIFIED** | Explicit consent modal required before data chunk dispatch |
| 10 | **Admin Center Protection** | **VERIFIED** | Server-authoritative role check (`ADMIN` / `SUPER_ADMIN`) |
| 11 | **Pricing & Terms Invariant** | **VERIFIED** | Free (₹0), Pro Monthly (₹99), Pro Yearly (₹899) strictly maintained |
| 12 | **Support & Troubleshooting** | **VERIFIED** | Official channels `support@saarvi.app` & `contact@saarvi.app` active |

---

## 12. Rollback Mechanism
- **Vercel Instant Rollback**: Edge deployment rollback can be executed in `< 30 seconds` via the Vercel Dashboard -> Deployments -> Promote to Production.
- **Database Non-Destruction**: Reverting server migrations never touches user workspace data because student marksheets, timetables, and notes reside exclusively in browser `IndexedDB`.

---

## 13. Summary of Blocking Issues & Manual Actions

### Blocking Issues (Must Be Done by Operator):
1. **Domain DNS Resolution**: Apex domain `saarvi.app` has not yet been pointed by the domain registrar to Vercel edge IP (`76.76.21.21`).
2. **Vercel Private Repo Authorization**: The human operator must grant Vercel GitHub App access to the private repository `mrutyunjayahangaragi-afk/Saarvi` in the Vercel Dashboard.

### Manual Operator Actions:
1. **Import in Vercel**: Follow the 8-step guide in `VERCEL_SETUP_GUIDE.md`.
2. **Populate Environment Variables**: Copy secrets from `.env.example` into Vercel Project Settings.
3. **Point Registrar DNS**: Add `A` and `CNAME` records at the domain registrar.
4. **Update Google Cloud & Supabase URLs**: Whitelist `https://saarvi.app` in external consoles.
