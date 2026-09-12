# Saarvi — Production Monitoring & Observability Guide
**Version:** 1.0.0 (Post-Launch Operations)  
**System Canonical URL:** `https://saarvi.app`  
**Core Architecture:** Next.js 16 + Supabase SSR Auth + Client-Side IndexedDB Workspace + Razorpay Payments + Gmail SMTP

---

## 1. Overview & Monitoring Philosophy

Saarvi operates under strict privacy and performance invariants:
- **Private by Design**: Monitoring captures purely operational telemetry (latencies, HTTP status codes, error classifications, route throughput). Under no circumstances are student documents, course marks, notes, resumes, or private conversations inspected, logged, or transmitted.
- **Fast by Design**: Lightweight in-memory ring buffers and zero-dependency percentiles track p50 and p95 latencies without introducing heavyweight monitoring agents that degrade client performance.
- **Simple by Design**: Errors are categorized into machine-readable domains with consistent safe metadata.

---

## 2. Standardized Error Classification

Every operational failure in the platform maps to a standardized, machine-readable category defined in `src/lib/observability/errors.ts`:

| Category | Description | Scope / Components | Example Failure |
| :--- | :--- | :--- | :--- |
| **`AUTH`** | User authentication & session management | Supabase Auth, Google OAuth, Session Cookies | OAuth code exchange failure, expired session |
| **`DB`** | Server & local storage operations | Supabase PostgreSQL, Client `IndexedDB` | Storage quota exceeded, connection timeout |
| **`EMAIL`** | Transactional message dispatch | Gmail SMTP, Nodemailer, Resend fallback | SMTP handshake timeout, invalid recipient |
| **`PAYMENT`** | Subscription & payment processing | Razorpay Client, Webhooks, Signature Verifier | HMAC signature mismatch, duplicate webhook |
| **`AI`** | Optional AI study assistant & resume analysis | Gemini 1.5 Flash, OpenRouter | Quota limit exceeded, model response timeout |
| **`OCR`** | Optional OCR image/document extraction | Vision OCR Provider | Unreadable scan, provider rate limit |
| **`TOOL`** | Document & image manipulation utilities | PDF-Lib, Canvas, WebAssembly workers | Corrupted PDF structure, unsupported format |
| **`UPLOAD`** | Client file intake & memory allocation | File dropzones, ArrayBuffer loaders | File size exceeds memory limit, MIME mismatch |
| **`DOWNLOAD`** | Output file generation & auto-download | Blob URLs, Auto-download countdown hook | Popup blocked, download countdown cancelled |
| **`SECURITY`** | Security defenses & policy enforcement | SSRF shield, Redirect sanitizer, CSP | Open redirect attempt, malicious URL blocked |
| **`CLIENT`** | Client runtime & React lifecycle exceptions | React Error Boundaries, Browser events | DOMException, client viewport rendering error |
| **`SERVER`** | Next.js Server & Edge route exceptions | App Router dynamic routes, Middlewares | Unhandled 500 exception, internal route error |
| **`EXTERNAL_PROVIDER`** | Third-party service dependencies | External REST APIs, Edge CDNs | Third-party network outage, gateway timeout |

---

## 3. Privacy-Preserving Sanitization Rules

Before any log entry or error record is registered:
1. **Credentials Redaction**: Any key or string matching `key`, `secret`, `token`, `password`, `auth`, `bearer`, `cookie`, or `credit` is automatically replaced with `[REDACTED]`.
2. **Payload Protection**: Request bodies containing student documents, cover letters, exam notes, or VTU grades are completely excluded from logs.
3. **Trace Identifier**: All logs are tagged with a collision-resistant trace ID (`req_...` or `err_...`) for distributed tracking across client and server.

---

## 4. Subsystem Monitoring Procedures

### A. Authentication & Google OAuth
- **Monitored Metrics**: Signup success rate, login failures, OAuth initiation rate, callback redirect sanitizations.
- **Invariant**: Google OAuth must enforce `prompt: "select_account"` to allow seamless student/personal account selection.
- **Alert Trigger**: Spikes in callback errors (`> 5%` of authentication requests over 5 minutes) indicate potential Google Cloud Console redirect URI misconfigurations.

### B. Transactional Email (Gmail SMTP)
- **Monitored Metrics**: Send attempts, provider acceptance rate, SMTP connection latency on port 465, queue length.
- **Admin Visibility**: Status actively surfaced on `/admin/notifications` (`OPERATIONAL`, `NOT_CONFIGURED`, or `CONNECTION_FAILURE`).
- **Alert Trigger**: `> 3` consecutive SMTP connection failures or authentication errors trigger an immediate SEV-2 operational alert.

### C. Payment & Entitlement Verification (Razorpay)
- **Monitored Metrics**: Checkout initialization rate, webhook signature verification success rate, webhook idempotency deduplications.
- **Invariant**: Strictly ₹99 monthly and ₹899 yearly. Zero client-side premium elevation.
- **Alert Trigger**: Any webhook HMAC verification failure (`/api/billing/webhook` returning 400) triggers an immediate security alert to investigate tampering.

### D. Decoupled AI & OCR
- **Monitored Metrics**: Request latency, timeout rate, provider fallback rate.
- **Invariant**: Core document tools (PDF merge, convert, compress) and deterministic VTU SGPA calculations must never depend on AI availability.
- **Degradation Policy**: If Gemini returns 429 (rate limit) or 503, the client UI gracefully falls back with a friendly notification while local tools remain operational.

---

## 5. Availability & Health Check Architecture

The public health check endpoint `GET /api/health` provides real-time status with sub-millisecond response latency and `no-store, no-cache` cache control headers.

### Health Check Schema
```json
{
  "status": "ok",
  "service": "saarvi",
  "version": "0.1.0",
  "environment": "production",
  "checks": {
    "application": "healthy",
    "database": "supabase_configured",
    "auth": "supabase_auth",
    "email": {
      "provider": "gmail",
      "status": "operational"
    },
    "externalProviders": {
      "billing": { "provider": "razorpay", "configured": true },
      "whatsapp": "optional_unconfigured",
      "ai": "configured",
      "ocr": "configured"
    }
  },
  "latencyMs": 1
}
```

An outage in an optional provider (e.g. AI or WhatsApp) updates `externalProviders` state without marking `checks.application` as down.

---

## 6. Actionable Alert Matrix

| Alert Name | Severity | Condition | Investigation Procedure | Immediate Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **Site Down** | **SEV-1** | `/api/health` fails or returns non-200 for 2 consecutive minutes | Check hosting provider status, DNS resolution, and edge CDN | Roll back to previous deployment artifact |
| **Auth Outage** | **SEV-1** | Callback failures > 15% or Supabase Auth 5xx | Inspect Supabase dashboard and Google Cloud OAuth credentials | Verify OAuth redirect URIs and session cookies |
| **Payment Failure Spike** | **SEV-2** | Webhook verification failures > 3 within 15 minutes | Inspect webhook logs in Razorpay Dashboard for secret mismatch | Verify `RAZORPAY_WEBHOOK_SECRET` environment variable |
| **SMTP Delivery Failure** | **SEV-2** | Email send failures > 5 consecutive attempts | Check `/admin/notifications` card status and test email probe | Verify Google App Password validity on `notifications@saarvi.app` |
| **AI Provider Outage** | **SEV-3** | AI endpoint error rate > 50% | Check Google AI Studio or OpenRouter status | Client UI displays local fallback notification automatically |
