# Saarvi Security Policy & Threat Model

Saarvi is committed to delivering a robust, privacy-respecting, local-first document processing and student productivity ecosystem. This document outlines our threat model, trust boundaries, protected assets, attacker capabilities, mitigations, and security reporting procedures.

---

## 1. Trust Boundaries & Architecture

```
+-------------------------------------------------------------------------------+
| UNTRUSTED EXTERNAL WORLD                                                      |
|   - Client Browser (Local DOM, Memory, IndexedDB, Web Workers)               |
|   - Untrusted User Files (PDFs, Images, ZIPs, JSON workspace payloads)        |
|   - Untrusted Dynamic URLs (Job postings, hackathon links, certificates)      |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼ HTTPS / TLS 1.3 / CSP / HSTS
+-------------------------------------------------------------------------------+
| APPLICATION & API BOUNDARY (Next.js Serverless Routes)                         |
|   - Session Cookie Verification (Supabase Auth)                               |
|   - Timing-Safe Secret Verification (CRON_SECRET)                             |
|   - Rate Limiting (Sliding Window per User / IP)                               |
|   - SSRF Protection (Block Loopback, RFC 1918, Cloud Metadata)                |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼ Encrypted / Signed Server APIs
+-------------------------------------------------------------------------------+
| TRUSTED SERVICES & STATE ENCLAVES                                             |
|   - Razorpay Payment Gateway (HMAC SHA-256 Webhook Signatures)                |
|   - Supabase Database (Row-Level Security, Encrypted Credentials)             |
|   - AI Providers (Minimal context, prompt encapsulation, user-scoped caches)  |
+-------------------------------------------------------------------------------+
```

---

## 2. Protected Assets

1. **User Privacy & Workspace Files**:
   - Resumes, cover letters, academic transcripts, notes, and local documents are stored client-side in browser IndexedDB.
   - Zero document contents are automatically synchronized to cloud servers.
2. **Financial Data & Subscriptions**:
   - Razorpay API secrets and webhook secrets are stored strictly on the server as environment variables.
   - No payment instruments, credit cards, or CVVs ever touch DocEase servers (handled exclusively in Razorpay iframe).
3. **Academic Ground Truth**:
   - VTU SGPA, CGPA, marks, attendance, and timetable conflict calculations are purely deterministic algorithms.
   - External AI services cannot tamper with academic evaluations.
4. **Administrative & Worker Operations**:
   - Administrative endpoints (`/api/admin/*`) require verified `ADMIN` or `SUPER_ADMIN` roles.
   - Background worker pipelines (`/api/notifications/process`) require timing-safe `CRON_SECRET` validation.

---

## 3. Attacker Capabilities & Threat Model

| Threat Actor | Capabilities | Mitigations |
| :--- | :--- | :--- |
| **Malicious Client / Guest User** | Tampering with client headers, query parameters, or local state to elevate privileges or access other users' data. | Identity derived exclusively from server session cookies. IDOR ownership checks on notification scheduling and deletion. |
| **Malicious File Uploader** | Uploading binary executables disguised as PDFs, ZIP bombs, or multi-gigapixel decompression bombs. | Real binary magic-byte inspection (PE/ELF/Mach-O/Script rejection). ZIP decompression ratio checks (max 100:1). Image dimension bounds (max 10,000px / 50 MP). |
| **Stored XSS Vector** | Injecting `javascript:`, `data:`, or `vbscript:` payloads via imported workspace data or job URLs. | URL sanitization defanging non-HTTP(S) schemes to `#`. Content-Security-Policy with `object-src 'none'`, `frame-ancestors 'self'`, and nosniff headers. |
| **SSRF Probe** | Supplying intranet addresses (`localhost`, `10.0.0.0/8`, `169.254.169.254`) to fetch internal services. | Strict URL parsing blocking loopback, RFC 1918, and link-local cloud metadata endpoints. |
| **Prototype Pollution Attacker** | Crafting JSON payloads containing `__proto__`, `constructor`, or `prototype` keys to compromise JavaScript runtime. | Recursive reviver filtering in `safeJsonParse`. Strips prototype keys and rejects payloads > 10MB or > 5,000 array elements. |
| **Multi-Tenant Cache Snoop** | Leveraging AI prompt deduplication to observe or leak other users' prompt responses. | User-scoped SHA-256 caching keys (`computeInputHash(..., userScope)`). |

---

## 4. Security Mitigations Summary

### A. Authentication & Authorization
- **Session Verification**: `getAuthenticatedNotificationUser` verifies active Supabase sessions using server-authoritative cookie decoders. Test-header overrides are disabled in production (`NODE_ENV === 'production'`).
- **Administrative RBAC**: `/api/admin/notifications` strictly enforces `ADMIN` / `SUPER_ADMIN` authorization.
- **Timing-Safe Cron Secrets**: `/api/notifications/process` uses `crypto.timingSafeEqual` to prevent side-channel timing attacks.
- **IDOR Defense**: `cancelJobsForEvent` enforces matching `userId` so tenants cannot cancel other users' jobs.

### B. Input Validation & Upload Defense
- **Real Magic-Byte Inspection**: `validateInputFile` validates true file format using binary headers (`%PDF-`, `\x89PNG`, `\xFF\xD8\xFF`, `RIFF....WEBP`, `PK\x03\x04`). Rejects PE (`MZ`), ELF (`\x7fELF`), Mach-O, and Unix scripts (`#!`).
- **Path Traversal Sanitization**: `sanitizeFilename` eliminates `../`, `..\`, Windows drive letters, null bytes, control chars, hidden dotfiles, and Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`).
- **Archive Safety**: `validateZipEntryMetadata` caps entries at 500, uncompressed size at 200MB, and compression ratio at 100:1.
- **Image Bounding**: `validateImageDimensions` bounds images to 10,000px and 50 Megapixels.

### C. Output Sanitization & Web Security
- **Dynamic Link Defanging**: `sanitizeUrl` checks URL protocols; neutralizes `javascript:`, `data:`, `vbscript:`, and protocol-relative links to `#`.
- **HTTP Security Headers**: Next.js configuration enforces:
  - `Content-Security-Policy` with `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

### D. Single-Download Invariant
- **Countdown & One-Time Auto-Download**: The 3-second countdown initiates exactly one automatic download per unique result ID. Completed results are locked in-memory to prevent browser duplicate triggers, with an intentional manual download fallback.

---

## 5. Known Limitations & Roadmap

1. **Client-Side Document Execution**: Client-side PDF and image transformations occur in browser Web Workers. While isolated from cloud storage, rogue browser extensions can inspect client DOM; users should run trusted browser extensions.
2. **Supabase Row-Level Security (RLS)**: Client operations relying directly on Supabase use verified RLS policies. Direct database access without Supabase client keys is blocked.
3. **Automated Vulnerability Scanning**: Continuous integration runs `npm audit` on all PRs to maintain 0 known vulnerabilities.

---

## 6. Reporting a Vulnerability

If you discover a security vulnerability in DocEase, please report it responsibly:
- **Email**: security@docease.app
- **Response Target**: Within 48 hours with acknowledgment and triage timeline.
- **Disclosure Policy**: Coordinated vulnerability disclosure after a fix is deployed. Please do not publicly disclose vulnerabilities before a patch has been released.
