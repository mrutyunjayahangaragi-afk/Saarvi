# Saarvi — Security Architecture Specification
**Product:** Saarvi — Study. Work. Grow.  
**Domain:** `https://saarvi.app`  
**Security Status:** Controls Verified • Known Attack Vectors Mitigated • Fail-Closed Design

---

## 1. Security Philosophy & Claim Standards

Saarvi adheres to an evidence-based security model:
- **No False Assertions:** We never claim the platform is "unhackable," "100% invulnerable," or "immune to attack."
- **Evidence-Based Stance:** Security controls are verified through automated adversarial test suites, bounded resource constraints, and continuous monitoring.
- **Local-First Privacy:** Student academic transcripts, marks, career resumes, and interview notes remain client-side in browser storage (`localStorage` / IndexedDB). They are never synced to persistent remote databases without explicit student initiation.

---

## 2. Core Security Controls Summary

| Defense Domain | Saarvi Architectural Implementation | Validation Test |
|:---|:---|:---|
| **Server-Side Authorization** | Session-based role check against `admins` table; capability permission matrix (`VIEW`, `MANAGE`, `PUBLISH`, `BILLING`, `SECURITY`, `SUPER_ADMIN`) | TC-01: Admin Permission Verification |
| **Production Anti-Spoofing** | Mock headers (`x-admin-role`, `x-admin-user`) rejected when `NODE_ENV === 'production'` | TC-02: Header Spoofing Prevention |
| **Row-Level Security (RLS)** | PostgreSQL RLS policies enforce `auth.uid() = user_id` across all tables | Full Platform Regression Suite |
| **Secrets Isolation** | Private credentials reside exclusively in server-side environment variables; zero private keys prefixed with `NEXT_PUBLIC_` | Build & Env Hygiene Test |
| **SSRF & Metadata Guard** | WHATWG URL parsing with IPv6 bracket stripping, blocking loopbacks, RFC 1918 subnets, IPv6 private prefixes (`fc00::/7`), and cloud metadata (`169.254.169.254`, `metadata.google.internal`) | TC-10: SSRF IPv4, IPv6 & Cloud Metadata |
| **File Upload Defense** | Magic-byte signature verification (PDF, PNG, JPG, WEBP), ZIP bomb decompression ratio clamping (10:1), executable extension blocking, path traversal sanitization | File Security Regression Tests |
| **Rate Limiting** | Sliding window counter with RFC-compliant HTTP 429 response headers (`Retry-After`, `X-RateLimit-Limit`) | TC-08: Sliding Window Rate Limiter |
| **Mutual Exclusion Locks** | Key-scoped `AsyncLock` serializes concurrent writes to shared resources (`curriculum:publish`, `feature:flags`) | TC-04: Key-Scoped Mutex Execution |
| **Fail-Closed Principle** | If credentials, signatures, or capabilities cannot be positively verified, access is denied by default | Security Fortress Suite |
