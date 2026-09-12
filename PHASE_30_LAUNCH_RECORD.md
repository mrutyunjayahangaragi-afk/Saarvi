# Saarvi — Phase 30: Public Production Launch Record
**Release Identifier:** `saarvi-v0.1.0-rc1`  
**Deployment Timestamp:** 2026-09-12T18:50:00Z / 2026-09-13T00:20:00+05:30  
**Target Domain:** `https://saarvi.app`  
**Application Identity:** Saarvi — Study. Work. Grow.  
**Core Architecture Invariant:** Private by design. Fast by design. Simple by design.  
**Pricing Model:** Strictly ₹99 monthly, ₹899 yearly.

---

## 1. Executive Status & Launch Determination

### **Determination: LAUNCH BLOCKED**
*(Awaiting External Operator DNS Cutover & Live Credentials)*

> [!IMPORTANT]
> **Audit Finding**: In accordance with the Phase 30 mandate (*"DO NOT deploy blindly. If any blocking issue remains: STOP before public deployment. Do not fabricate readiness. Only use LAUNCHED SUCCESSFULLY when the production site and critical journeys have actually been verified"*):
> - The codebase is fully verified, type-safe, lint-compliant, and production-compiled with **511/511 tests passing**.
> - However, live DNS query `dig +short saarvi.app` returns **no public IP address** and `curl https://saarvi.app` fails with `CURLE_COULDNT_RESOLVE_HOST (Error 6)`.
> - The public launch is therefore **BLOCKED** pending human operator DNS configuration at the domain registrar and live credential provisioning in cloud dashboards.

---

## 2. Release & Codebase Specifications

- **Package Version**: `0.1.0`
- **Release Candidate Tag**: `saarvi-v0.1.0-rc1`
- **Framework**: Next.js 16.3.4 (App Router, Turbopack)
- **Node Engine**: Node.js v24.20.0
- **TypeScript**: TypeScript 5.x
- **Total Compiled Routes**: 129 routes (all static, SSG, and dynamic endpoints generated cleanly)
- **Security Baseline**: CSP with strict origins, HSTS (`max-age=63072000`), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 3. Automated Validation Summary

| Test / Check | Tool / Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Comprehensive Test Suite** | `npm test` | **PASSED (511/511)** | 35 suites; 0 failures; duration: 428ms |
| **Type Safety** | `npx tsc --noEmit` | **PASSED (0 errors)** | Clean exit code 0 |
| **Linting & Code Quality** | `npm run lint` | **PASSED (0 errors)** | Zero syntax or compiler errors (warnings permitted) |
| **Production Build** | `npm run build` | **PASSED (Exit 0)** | 129 static, SSG, and dynamic routes compiled in 589ms |
| **Health API Probe** | `curl http://localhost:3000/api/health` | **PASSED (HTTP 200)** | Real-time status, sub-millisecond latency |
| **Zero Secrets Check** | Phase 29 test suite | **PASSED (0 exposed)** | `.env.example` has only safe dummy placeholders |

---

## 4. Production Environment Status Report

In accordance with Section 4 (*"Never print secret values. Only report: configured, missing, invalid"*):

| Variable Name | Classification | Current Local State | Required Production State |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | PUBLIC | **Configured** (`https://saarvi.app`) | `https://saarvi.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC | **Configured** | Production project endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC | **Configured** | Production public key |
| `SUPABASE_SERVICE_ROLE_KEY` | SERVER_ONLY | **Optional in dev** | Production service role key |
| `BILLING_PROVIDER` | SERVER_ONLY | **Configured** (`razorpay`) | `razorpay` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | PUBLIC | **Missing (Safe default)** | `rzp_live_[KEY_ID]` |
| `RAZORPAY_KEY_ID` | SERVER_ONLY | **Missing (Safe default)** | `rzp_live_[KEY_ID]` |
| `RAZORPAY_KEY_SECRET` | SECRET | **Missing (Safe default)** | `[SECRET]` |
| `RAZORPAY_WEBHOOK_SECRET` | SECRET | **Missing (Safe default)** | `[WEBHOOK_SECRET]` |
| `RAZORPAY_PRO_MONTHLY_PLAN_ID`| SERVER_ONLY | **Missing (Safe default)** | `plan_[MONTHLY_99_ID]` |
| `RAZORPAY_PRO_YEARLY_PLAN_ID` | SERVER_ONLY | **Missing (Safe default)** | `plan_[YEARLY_899_ID]` |
| `EMAIL_PROVIDER` | SERVER_ONLY | **Configured** (`gmail`) | `gmail` |
| `SMTP_HOST` | SERVER_ONLY | **Configured** (`smtp.gmail.com`) | `smtp.gmail.com` |
| `SMTP_PORT` | SERVER_ONLY | **Configured** (`465`) | `465` |
| `SMTP_SECURE` | SERVER_ONLY | **Configured** (`true`) | `true` |
| `SMTP_USER` | SERVER_ONLY | **Configured** | `notifications@saarvi.app` |
| `SMTP_PASS` | SECRET | **Configured** | 16-character App Password |
| `EMAIL_FROM_EMAIL` | SERVER_ONLY | **Configured** | `notifications@saarvi.app` |
| `EMAIL_FROM_NAME` | SERVER_ONLY | **Configured** (`Saarvi`) | `Saarvi` |
| `AI_PROVIDER` | SERVER_ONLY | **Configured** (`gemini`) | `gemini` |
| `AI_API_KEY` | SECRET | **Configured** | `[AI_KEY]` |
| `OCR_PROVIDER` | SERVER_ONLY | **Configured** (`gemini`) | `gemini` |
| `OCR_API_KEY` | SECRET | **Configured** | `[OCR_KEY]` |

---

## 5. Domain, DNS & SSL Verification

- **Configured Canonical Domain**: `https://saarvi.app`
- **DNS Lookup Test**:
  ```bash
  dig +short saarvi.app
  # Output: (empty)
  ```
- **Connection Test**:
  ```bash
  curl -s -I https://saarvi.app/api/health
  # Output: curl: (6) Could not resolve host: saarvi.app
  ```
- **Root Cause**: Apex domain DNS `A` or `CNAME` records have not yet been pointed by the domain registrar to the production edge servers.
- **Blocking Status**: This is a hard prerequisite for live traffic cutover.

---

## 6. Authentication & Google OAuth Verification

- **Google OAuth Mode**: `prompt: "select_account"` confirmed in `src/context/AuthContext.tsx`.
- **Open-Redirect Defense**: Tested and verified in `src/app/auth/callback/route.ts` using `sanitizeInternalRedirectUrl`. Protocol-relative (`//`) and backslash (`/\`) exploits are strictly blocked and defaulted to `/dashboard`.
- **Role Assignment Invariant**: Google OAuth sign-in defaults users to `USER` role. Administrative privileges (`ADMIN`, `SUPER_ADMIN`) cannot be granted via client OAuth flows.
- **Avatar Integration**: CSP `img-src` includes `https://*.googleusercontent.com`.

---

## 7. Transactional Email & Notifications Verification

- **Provider**: Gmail SMTP on port 465 with SSL/TLS.
- **Sender Address**: `notifications@saarvi.app` (Display: `Saarvi`).
- **Health Check Status**: Verified via `/api/health` -> `email.status === "operational"`, `email.provider === "gmail"`.
- **Test Email Probe**: Verified endpoint `POST /api/admin/notifications/test-email` enforces admin authentication, rate limiting, and email format validation.
- **Logs Hygiene**: Zero email credentials or passwords logged during delivery attempts.

---

## 8. Payment & Subscription Verification

- **Pricing Consistency**: Verified in `src/config/pricing.ts`, `src/app/pricing/page.tsx`, and `src/app/terms/page.tsx`:
  - Free Plan: ₹0
  - Pro Monthly: ₹99
  - Pro Yearly: ₹899
- **Server Entitlement**: Subscriptions are activated exclusively upon cryptographically verified Razorpay webhooks (`src/app/api/billing/webhook/route.ts`).
- **Test / Live Separation**: Code prevents `rzp_test_*` credentials from being deployed in production mode.
- **Cardholder Data**: Saarvi stores zero card, CVV, or banking details.

---

## 9. Core User Journeys Smoke-Test Results

| # | Journey Description | Verified State | Proof / Mechanism |
| :--- | :--- | :--- | :--- |
| 1 | **Landing Page -> Signup -> Login -> Dashboard** | **VERIFIED** | Clean static rendering, SSR Auth middleware, profile redirection |
| 2 | **Landing Page -> Continue with Google -> Dashboard** | **VERIFIED** | PKCE flow with `select_account` prompt and sanitized `/auth/callback` |
| 3 | **Tool -> Local Processing -> 3s Countdown -> Auto-Download** | **VERIFIED** | WebAssembly in-memory conversion with single-trigger invariant |
| 4 | **Dashboard -> Student Tools -> VTU Calculator** | **VERIFIED** | 100% deterministic offline calculations (VTU 2022/2021 schemes) |
| 5 | **Dashboard -> Career -> ATS Resume -> Export** | **VERIFIED** | PDF-Lib client generation and clean download |
| 6 | **Dashboard -> AI/OCR with User Consent** | **VERIFIED** | Explicit consent modal required before data chunk dispatch |
| 7 | **Dashboard -> Notifications -> Email Alert** | **VERIFIED** | Decoupled queue processing and Gmail SMTP dispatch |

---

## 10. Local-First Privacy Architecture Verification

- **Private Workspace Data**: Notes, study planners, course marks, VTU SGPA/CGPA records, attendance logs, timetables, resumes, and document files are stored in client-side **`IndexedDB`** (`DocEaseAcademicDB` / `SaarviAcademicDB`).
- **Zero Cloud Leakage**: No automatic background synchronization uploads private workspace documents to Supabase.
- **Multi-Account Isolation**: Switching profiles or logging out resets active client workspace keys without cross-account contamination (verified in Phase 28 QA tests).

---

## 11. Known Non-Blocking Items

1. **WhatsApp Cloud API**: Optional reminder delivery channel remains unconfigured; decoupled architecture ensures fallback to Gmail SMTP.
2. **Additional Autonomous University Schemes**: Currently supports VTU 2022 and 2021 schemes; autonomous college schemas will be introduced in subsequent content patches.

---

## 12. Rollback Reference

In the event of an operational regression post-DNS cutover:
- **Application Rollback**: In the hosting dashboard, promote previous deployment commit. Time to restore: `< 30 seconds`.
- **Database Rollback**: Revert statements documented in `PRODUCTION_RUNBOOK.md` and `supabase/migrations/`.
- **Emergency Secret Rotation**: Follow rotation playbooks in `INCIDENT_RESPONSE.md`.
