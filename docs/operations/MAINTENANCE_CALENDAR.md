# Saarvi — Production Maintenance & Operational Review Calendar
**Scope:** `https://saarvi.app`  
**Review Cycle:** Daily, Weekly, Monthly, and Quarterly Operations

This operational calendar establishes the recurring schedules and checklists required to maintain high availability, security, privacy compliance, and peak performance for Saarvi.

---

## 1. Operational Cadence Overview

```
Daily Health Check ──► Weekly Triage ──► Monthly Maintenance ──► Quarterly Audit
  (Uptime & Errors)     (Auth, SMTP, Webhooks)   (Audit, Dep, A11y)      (Privacy & Capacity)
```

---

## 2. Daily Health & Error Review (< 10 Minutes)
*Owner: Operational On-Call / Platform Maintainer*

- [ ] **Health Endpoint Check**: Verify `curl -s https://saarvi.app/api/health` returns `status: "ok"`.
- [ ] **Critical Errors**: Check `/admin/errors` for any unresolved `ERROR` or `CRITICAL` severity events.
- [ ] **Email Card Status**: Verify `/admin/notifications` card displays `Gmail SMTP: Operational`.
- [ ] **Support Queue**: Review unread emails in `support@saarvi.app` for high-severity user issues.

---

## 3. Weekly Operational Triage (Every Monday)
*Owner: Engineering Team*

- [ ] **Authentication Trends**: Inspect signup and login success rates in Supabase dashboard.
- [ ] **Google OAuth Status**: Confirm zero redirect URI errors or spike in callback cancellations.
- [ ] **Razorpay Webhooks**: Check Razorpay webhook dashboard for any failed delivery attempts.
- [ ] **Email Quota & Delivery**: Review Gmail SMTP daily send counts against Google limits.
- [ ] **Telemetry Latency Review**: Review p50 and p95 API response times in `/admin/analytics`.
- [ ] **Open Support Tickets**: Review and categorize open issues in `support@saarvi.app`.

---

## 4. Monthly System & Dependency Maintenance (1st Week of Month)
*Owner: Tech Lead*

- [ ] **Security Vulnerability Audit**: Run `npm audit` and address any flagged CVEs.
- [ ] **Framework & Dependencies**: Review and apply non-breaking minor updates for Next.js, React, Tailwind, and Supabase client libraries.
- [ ] **Accessibility Audit**: Run automated Lighthouse / axe accessibility audit on core pages (`/`, `/student/*`, `/tools/*`).
- [ ] **Performance Budget Verification**: Verify production bundle size has not regressed and key tools load under performance thresholds.
- [ ] **Backup Verification**: Verify Supabase daily backup health and test a local JSON workspace export and import.

---

## 5. Quarterly Strategic & Privacy Audit (Every 3 Months)
*Owner: Platform Maintainer & Architect*

- [ ] **Local-First Privacy Review**: Verify that no recent feature commits introduced automatic cloud storage of user documents or private notes.
- [ ] **Legal & Disclosures Review**: Confirm `/privacy` and `/terms` accurately reflect current third-party subprocessors and pricing invariants.
- [ ] **Incident Post-Mortem Review**: Review all PIR documents generated during the quarter to identify recurring failure patterns.
- [ ] **Capacity & Rate Limits**: Review Supabase database sizing, Gmail SMTP rate limits, and Gemini AI quota tier against active user growth.
- [ ] **Curriculum Expansion**: Review VTU scheme updates and add newly published scheme subjects to the curriculum registry.
