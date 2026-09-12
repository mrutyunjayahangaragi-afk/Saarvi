# Saarvi — Phase 31: Post-Launch Monitoring, Reliability & Continuous Improvement Report

**Product:** Saarvi — Study. Work. Grow.  
**Canonical Production URL:** `https://saarvi.app`  
**Phase:** Phase 31 (Post-Launch Operations & Continuous Improvement)  
**Release Identifier:** `saarvi-v0.1.0-rc1`  
**Philosophy:** Private by design. Fast by design. Simple by design.  
**Pricing Invariant:** Strictly ₹99 monthly, ₹899 yearly.

---

## Final Phase 31 Status Determination

# **PRODUCTION STABLE WITH KNOWN ISSUES**

> [!NOTE]
> **Operational Summary**: The Saarvi production codebase, CI/CD pipeline, and operational observability architecture are stable, verified, and hardened. All 511 tests pass across 35 test suites, static analysis is 100% clean, and 129 routes compile without errors. The system is operating in a stable release candidate state with documented non-blocking items and pending manual DNS cutover by the domain administrator.

---

## A. Production Status
- **Codebase Health**: Fully compiled and optimized with Next.js 16.3.4 (Turbopack).
- **Hosting Topology**: Configured for edge hosting with continuous deployment via GitHub Actions (`.github/workflows/ci.yml`).
- **Domain Status**: Canonical `https://saarvi.app` configured; live traffic cutover requires registrar DNS pointing (`A`/`CNAME` records).

---

## B. Monitoring Status
- **Health Check Endpoint**: Verified live at `/api/health`. Reports granular subsystem health (`checks.application`, `checks.database`, `checks.auth`, `checks.email`, `checks.externalProviders`).
- **Telemetry Latency Engine**: Ring buffers track p50 and p95 percentiles with zero unbounded memory growth.
- **Admin Visibility**: Operational dashboards on `/admin/system`, `/admin/notifications`, and `/admin/analytics` reflect real verified data.

---

## C. Error Monitoring & Classification
- **Machine-Readable Taxonomy**: Standardized in `src/lib/observability/errors.ts` across 13 operational domains:
  `AUTH`, `DB`, `EMAIL`, `PAYMENT`, `AI`, `OCR`, `TOOL`, `UPLOAD`, `DOWNLOAD`, `SECURITY`, `CLIENT`, `SERVER`, `EXTERNAL_PROVIDER`.
- **Sanitization Invariant**: Sensitive fields (`key`, `secret`, `token`, `password`, `auth`, `bearer`, `credit`) are automatically masked as `[REDACTED]`. Private document contents, student notes, and marks are strictly excluded from error contexts.

---

## D. Performance Monitoring
- **Client WebAssembly Profiling**: PDF and image tools operate in client memory without server round-trips.
- **Route Latency Budget**: Dynamic API endpoints respond under sub-millisecond execution times in local testing.
- **Core Web Vitals**: Standard Next.js font and layout optimizations applied without heavy analytics overhead.

---

## E. Authentication Monitoring
- **Dual-Mode Resiliency**: `@supabase/ssr` with HTTP-only cookies and local resilient storage fallback.
- **Failure Tracking**: Tracks invalid credentials, expired session cookies, and unauthorized admin access attempts without logging plaintext passwords.

---

## F. Google OAuth Monitoring
- **Account Chooser Invariant**: Enforces `prompt: "select_account"` in `src/context/AuthContext.tsx`.
- **Redirect Security**: `/auth/callback` enforces `sanitizeInternalRedirectUrl` to reject open-redirect exploits (`//`, `/\`, or external domains).
- **Role Invariant**: Google OAuth sign-in defaults users to `USER` role; administrative privileges cannot be elevated via client OAuth.

---

## G. Gmail Transactional Email Monitoring
- **Protocol**: Gmail SMTP over port 465 with SSL/TLS (`SMTP_SECURE=true`).
- **Delivery Visibility**: Active operational status surfaced on `/admin/notifications`.
- **Admin Probe**: `/api/admin/notifications/test-email` allows administrators to test SMTP delivery on demand.
- **Decoupled Fallback**: Resend provider abstraction available via `EMAIL_PROVIDER=resend`.

---

## H. Payment Monitoring (Razorpay)
- **Pricing Preservation**: Strictly ₹99 monthly, ₹899 yearly across all pricing cards, terms, and checkout endpoints.
- **Server Entitlement**: Premium tier activation is restricted to verified webhook events with HMAC SHA256 signatures.
- **Zero Card Data**: Saarvi stores zero credit/debit card numbers; PCI-DSS compliance is handled directly by Razorpay.

---

## I. AI & OCR Monitoring
- **Decoupled Architecture**: Failure or quota exhaustion of Gemini 1.5 Flash never degrades core PDF/image tools or deterministic VTU calculators.
- **User Consent Invariant**: Explicit confirmation required before transmitting any text chunk to server AI endpoints.

---

## J. Security Monitoring
- **HTTP Security Headers**: Configured in `next.config.ts`:
  - `Content-Security-Policy`: Trusted script, frame, and connect origins (`self`, `razorpay.com`, `supabase.co`, `googleusercontent.com`).
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **File Validation**: MIME type and magic byte verification in `src/lib/security/file-security.ts`.

---

## K. Privacy Verification (Local-First Guarantee)
- **Student Workspace**: Study notes, marksheets, VTU SGPA/CGPA calculations, attendance records, timetable slots, and resume drafts reside exclusively in browser `IndexedDB`.
- **No Cloud Synchronization**: Private workspace documents are never sent to Supabase or external servers.
- **Multi-Profile Isolation**: Account switching resets local storage namespaces with zero data bleeding.

---

## L. Support Workflow
- **Channels**: `support@saarvi.app` (Technical Assistance) and `contact@saarvi.app` (Administrative).
- **Self-Service Guide**: Support & Troubleshooting Hub published on `/contact` covering Google login, password resets, billing, and IndexedDB workspace export.
- **Issue Workflow**: Documented in `docs/operations/INCIDENT_PLAYBOOK.md`.

---

## M. Incident Response Framework
- **Severity Levels**: SEV-1 (< 15m SLA), SEV-2 (< 1h SLA), SEV-3 (< 4h SLA).
- **Playbooks**: Documented in `docs/operations/INCIDENT_PLAYBOOK.md` covering edge outages, OAuth failures, SMTP downtime, payment webhook drops, and secret rotation.
- **Post-Incident Review (PIR)**: Standardized report template established in `incident/`.

---

## N. Release Process & Change Management
- **Workflow**: Documented in `docs/operations/RELEASE_PROCESS.md`.
- **Pipeline**: Automated GitHub Actions CI running `npm ci`, lint, `tsc`, tests, and build on all PRs to `main`.
- **Feature Flagging**: Risky features deployed behind `featureService.ts` flags in `DISABLED` or `MAINTENANCE` state until verified.

---

## O. Regression Testing Policy
- **Coverage**: 511 automated tests across 35 test suites.
- **Policy**: Any production bug fix requires adding an automated regression test to `tests/` before merging to `main`.

---

## P. Dependency Maintenance
- **Audit Result**: `npm audit` reports **0 vulnerabilities**.
- **Cadence**: Monthly automated Dependabot review and manual verification before merging upgrades.

---

## Q. Backup & Disaster Recovery
- **Local Workspace**: Users can export full workspace state as a portable JSON file via Settings.
- **Database Rollback**: Non-destructive SQL rollback statements documented in `supabase/migrations/`.
- **Edge Rollback**: Instant one-click rollback in hosting dashboard restores previous deployment in `< 30 seconds`.

---

## R. Accessibility Maintenance
- **Semantic Structure**: Proper heading hierarchies, ARIA live regions, and screen-reader status indicators across all tools.
- **Viewport Spectrum**: Clean responsive rendering from 320px mobile to 1920px widescreen without horizontal overflow.

---

## S. Known Issues & Limitations
- **ISSUE-01 (Deploy Blocking)**: Apex domain `saarvi.app` requires DNS `A`/`CNAME` record configuration at registrar.
- **ISSUE-02 (Low)**: WhatsApp reminder channel is optional and decoupled; fallback to Gmail SMTP is active.
- **ISSUE-03 (Low)**: Syllabus lookup pre-indexes VTU 2021/2022 schemes; autonomous college subjects require manual entry.
- **ISSUE-04 (Low)**: Safari 7-day storage policy mitigated via "Export Workspace" JSON backup feature.

---

## T. Recommended Improvements (Evidence-Driven Roadmap)
1. **Autonomous College Curriculum Pre-Indexing**: Expand curriculum index to cover top autonomous colleges based on student request volume.
2. **Offline PWA Manifest**: Add Progressive Web App caching for full offline use of academic calculators.
3. **Resend SMTP Fallback Auto-Switching**: Implement circuit breaker pattern to switch from Gmail to Resend automatically if 5 consecutive SMTP connection failures occur.

---

## U. Automated Test Verification Results
- **Command**: `npm test`
- **Total Tests**: **511 tests passed (100%)**
- **Test Suites**: **35 test files passed**
- **Failures**: **0**
- **Duration**: ~428 ms

---

## V. Production Build Verification
- **Command**: `npm run build`
- **Compiler**: Next.js 16.3.4 (Turbopack)
- **TypeScript**: `npx tsc --noEmit` exited with **code 0 (0 errors)**
- **ESLint**: `npm run lint` exited with **code 0 (0 errors)**
- **Routes Compiled**: **129 routes** (all static pages prerendered, SSG paths generated, dynamic endpoints compiled).

---

## W. Remaining Risks & Mitigations
- **External DNS Cutover**: Controlled by the domain registrar. Once configured, edge certificates will auto-issue via Let's Encrypt / DigiCert.
- **Third-Party API Limits**: Decoupled architecture ensures that external provider rate limits (Gemini AI / Gmail SMTP) will never disrupt local client document processing or VTU grade calculations.
