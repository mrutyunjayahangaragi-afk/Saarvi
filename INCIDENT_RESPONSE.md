# Saarvi — Incident Response Plan
**Version:** 1.0.0-rc1  
**Target Scope:** `https://saarvi.app`  
**Operational Framework:** Role-Based Ownership & Structured Lifecycle

This document defines the protocols, severity levels, communication guidelines, and mitigation steps for operational, security, and availability incidents impacting the Saarvi platform.

---

## 1. Incident Severity Classifications

| Severity | Definition | Examples | Response SLA | Target Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Catastrophic outage affecting core services, confirmed data breach, or widespread failure of authentication and payment systems. | - Entire site down (`500/502/503`) across all routes<br>- Security breach or leaked secret<br>- Razorpay double billing or open redirect takeover | Immediate (< 15 mins) | < 2 hours |
| **SEV-2 (High)** | Degradation of a major feature or provider where core local processing still functions, but user workflows are impaired. | - Google OAuth login failing<br>- Transactional email delivery offline<br>- Billing webhook failure delaying Pro upgrades | < 1 hour | < 8 hours |
| **SEV-3 (Low/Medium)** | Minor defects, edge-case UI glitches, cosmetic bugs, or localized optional tool failures with existing workarounds. | - Optional AI summary timeout<br>- Infrequent OCR recognition error<br>- Minor mobile layout distortion on specific viewports | < 4 hours | Next release cycle |

---

## 2. Role-Based Incident Team Ownership

In accordance with Saarvi's operational policies, team ownership is structured around functional roles:

- **Incident Commander (IC)**: Holds overall authority on mitigation, rollback decisions, and public status updates. Default: Lead Platform Maintainer.
- **Security Lead**: Evaluates threat vectors, secret compromises, data exposure scope, and credential rotations.
- **Infrastructure & Database Lead**: Manages hosting configuration, DNS, Supabase migrations, and CDN edge rules.
- **Communications Lead**: Handles support channel inquiries (`support@saarvi.app`, `contact@saarvi.app`) and status notices.

---

## 3. Incident Lifecycle Phases

```
[ IDENTIFY ] ──> [ CONTAIN ] ──> [ DIAGNOSE ] ──> [ RESOLVE ] ──> [ VERIFY ] ──> [ DOCUMENT ]
```

### Phase 1: Identify
- **Triggers**:
  - Alert from `/api/health` monitoring probe (status !== 'ok').
  - Elevated 5xx rate in edge analytics.
  - User support reports dispatched to `support@saarvi.app`.
  - Security vulnerability report received at `contact@saarvi.app`.
- **Action**: Classify incident severity (SEV-1, SEV-2, SEV-3) and assign Incident Commander.

### Phase 2: Contain
- **Goals**: Prevent further harm or data exposure.
- **Containment Playbooks**:
  - *Compromised API Key/Secret*: Immediately invalidate and rotate in the respective vendor dashboard (Google Cloud, Supabase, Razorpay, or Gmail).
  - *Malicious Traffic/DDoS*: Enable Cloudflare / hosting provider "Under Attack Mode" and tighten rate limits.
  - *Broken Production Release*: Execute immediate one-click rollback in hosting dashboard to previous stable release candidate (see `PRODUCTION_RUNBOOK.md`).

### Phase 3: Diagnose
- **Actions**:
  - Review `/admin/errors` and server-side logs.
  - Inspect `/api/health` provider breakdown.
  - Reproduce issue in isolated staging environment.
  - Identify root cause: Code regression, DNS misconfiguration, Third-party provider outage, or Expired credentials.

### Phase 4: Resolve
- **Actions**:
  - Apply emergency patch or configuration fix.
  - Test fix against test suite: `npm test` and `npx tsc --noEmit`.
  - Deploy fix through standard release pipeline.

### Phase 5: Verify
- **Actions**:
  - Verify endpoint health: `curl -s https://saarvi.app/api/health`.
  - Validate core user journeys using the Release Candidate smoke-test matrix.
  - Confirm `/admin/notifications` test email probe succeeds.

### Phase 6: Document & Post-Mortem
- **Actions**:
  - Complete Post-Incident Review within 48 hours for SEV-1 and SEV-2 incidents.
  - Document timeline, root cause, impact duration, and preventative action items.

---

## 4. Privacy & Local-First Invariant During Incidents

Because Saarvi operates on a **local-first privacy architecture**:
- User documents, course marks, timetables, and academic notes reside in the user's local browser `IndexedDB`.
- Incidents impacting the server, Supabase, or Razorpay **do not** compromise, corrupt, or expose user workspace documents.
- Incident responses must never attempt to bulk-upload or collect local client data for debugging purposes.

---

## 5. External Communications & Support Guidance

- **Support Inquiries**: Direct communications through established official channels:
  - `support@saarvi.app` (Technical & User Assistance)
  - `contact@saarvi.app` (Administrative & Security)
- **Public Messaging Principles**:
  - Be truthful and transparent without disclosing exploit mechanics or sensitive system topology.
  - Acknowledge the issue promptly and provide realistic recovery estimates.
  - Emphasize that student documents remain safe and private on the user's own device.
