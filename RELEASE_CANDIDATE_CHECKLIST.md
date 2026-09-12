# Saarvi — Release Candidate Checklist (v0.1.0-rc1)
**Canonical Production URL:** `https://saarvi.app`  
**Phase:** Phase 29 — Final Launch Preparation, Legal, Support & Operational Readiness  
**Release Rule:** DO NOT deploy publicly in this phase. This phase concludes with an audited, verified Release Candidate.

This checklist categorizes all release readiness requirements into **BLOCKING**, **NON-BLOCKING**, and **MANUAL VERIFICATION REQUIRED** items. The release candidate cannot be certified for public launch until every blocking requirement has passed with verifiable evidence.

---

## 1. BLOCKING REQUIREMENTS (All Must Pass)

| ID | Category | Requirement | Status | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | **Build & Compilation** | Full Next.js production build succeeds with zero errors across all 129 routes | **PASSED** | Verified via `npm run build` |
| **BLK-02** | **Type Safety** | TypeScript compiler check completes cleanly with zero errors | **PASSED** | Verified via `npx tsc --noEmit` |
| **BLK-03** | **Automated Tests** | Full automated test suite passes (511/511 tests across 35 test files) | **PASSED** | Verified via `npm test` |
| **BLK-04** | **Linting Standards** | ESLint passes with zero syntax or compiler errors | **PASSED** | Verified via `npm run lint` |
| **BLK-05** | **Zero Exposed Secrets** | `.env.example` contains only safe placeholder templates; zero secrets in Git | **PASSED** | Automated test in `tests/phase29-launch-readiness.test.mjs` |
| **BLK-06** | **Canonical Domain** | All links, metadata, Open Graph, and sitemaps point to `https://saarvi.app` | **PASSED** | Verified in `site.ts`, `metadata.ts`, `robots.ts`, `sitemap.ts` |
| **BLK-07** | **Pricing Invariants** | Pro tier remains strictly ₹99 monthly and ₹899 yearly; zero deviation | **PASSED** | Verified in `src/config/pricing.ts` and `src/app/terms/page.tsx` |
| **BLK-08** | **Privacy Architecture** | Local-first IndexedDB storage guaranteed; zero automatic file upload to cloud | **PASSED** | Verified in `src/app/privacy/page.tsx` and academic storage |
| **BLK-09** | **Deterministic Math** | VTU SGPA / CGPA calculations remain pure, offline, and independent of external AI | **PASSED** | Verified in `tests/vtu-engine.test.mjs` and `sgpa.ts` |
| **BLK-10** | **Admin Security** | Admin routes protected server-side with strict role checks (`ADMIN` / `SUPER_ADMIN`) | **PASSED** | Verified in `src/components/admin/AdminGuard.tsx` |
| **BLK-11** | **Security Headers** | Comprehensive CSP, HSTS, X-Frame-Options, and nosniff configured in `next.config.ts` | **PASSED** | Verified in `next.config.ts` |
| **BLK-12** | **Open-Redirect Defense** | OAuth and return URLs sanitized via `sanitizeInternalRedirectUrl` | **PASSED** | Verified in `src/lib/security/url-security.ts` |

---

## 2. MANUAL VERIFICATION REQUIRED (Prior to Public DNS Cutover)

These items require human operator action in external provider consoles (Google Cloud, Supabase, Razorpay) when provisioning the live production infrastructure:

| ID | Provider / Area | Required Operator Action | Verification Steps |
| :--- | :--- | :--- | :--- |
| **MAN-01** | **DNS & SSL** | Configure DNS `A` / `CNAME` records for `saarvi.app` pointing to production hosting | Verify resolution via `dig saarvi.app` and test TLS certificate |
| **MAN-02** | **Google Cloud OAuth** | Add `https://saarvi.app` to Authorized JavaScript Origins and `https://[SUPABASE_REF].supabase.co/auth/v1/callback` to Authorized Redirect URIs | Perform test Google sign-in using production client credentials |
| **MAN-03** | **Supabase Auth** | Set Site URL to `https://saarvi.app` and apply database migrations to live instance | Test user registration and password recovery flow |
| **MAN-04** | **Gmail SMTP** | Generate 16-character Google App Password on `notifications@saarvi.app` and set in hosting env | Dispatch test email from `/admin/notifications` |
| **MAN-05** | **Razorpay Live Mode** | Activate Live Key ID and Key Secret; create webhook endpoint at `https://saarvi.app/api/billing/webhook` | Trigger test ₹1 transaction in live mode or verify webhook signature |
| **MAN-06** | **Legal Review** | Final read-through of Privacy Policy and Terms of Service by legal counsel if desired | Confirm compliance with target jurisdictional policies |

---

## 3. NON-BLOCKING ITEMS (Post-Launch Operational Roadmap)

These items do not prevent public release and represent ongoing enhancements or optional integrations:

| ID | Area | Description | Expected Timeline |
| :--- | :--- | :--- | :--- |
| **NON-01** | **WhatsApp Integration** | WhatsApp Business Cloud API reminder channel is optional and decoupled | Post-launch rollout |
| **NON-02** | **AI Quota Tuning** | Fine-tuning Gemini 1.5 Flash tokens and rate-limiting limits for high-traffic spikes | Continuous monitoring |
| **NON-03** | **Additional Schemes** | Expanding curriculum index beyond VTU 2022/2021 schemes to additional autonomous colleges | Next curriculum update |
| **NON-04** | **International Payments** | Adding international payment currencies via Razorpay if global users scale | Future roadmap |

---

## 4. Final Release Candidate Determination

- **Blocking Criteria**: **12 / 12 PASSED (100%)**
- **Automated Validation**: **511 / 511 TESTS PASSING (100%)**
- **Build Status**: **SUCCESSFUL (129 Routes Compiled)**
- **Public Launch Status**: **HELD FOR MANUAL OPERATOR PROVISIONING**

**RELEASE CANDIDATE STATUS: READY FOR OPERATOR PROVISIONING (RC-1)**
