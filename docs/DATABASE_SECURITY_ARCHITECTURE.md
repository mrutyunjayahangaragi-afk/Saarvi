# Saarvi — Database & Authentication Security Architecture
**Saarvi — Study. Work. Grow.**

This document outlines the formal database security architecture, authentication integrity model, row-level security (RLS) enforcement, and privacy boundaries for the Saarvi production platform.

---

## 1. Authentication Source of Truth

Saarvi adheres to a strict, server-authoritative identity architecture:
- **Supabase Auth (`auth.users`)**: The sole, trusted authority for user identity and credential verification.
- **Provider Federation**: Google OAuth 2.0 and Email/Password credentials terminate directly in Supabase Auth.
- **Session Tokens**: Identity is verified via server-side session cookies managed by `@supabase/ssr`.
- **Server Identity Derivation**: Protected server actions, API routes, and RPC functions derive user identity exclusively through:
  ```
  Authenticated Supabase Session / Cookie
           ↓
  Verified auth.users.id (auth.uid())
           ↓
  Server Authorization & Role Evaluation
           ↓
  Database Operation / Query Builder
  ```
- **Untrusted Client Inputs**:
  - Request body `userId` is **NEVER** trusted. Any mismatch against the verified session results in `403 Forbidden` (`FORBIDDEN_USER_MISMATCH`).
  - Request body `userEmail` is **NEVER** trusted as identity authority.
  - Client-supplied `role`, `isAdmin`, or `permissions` fields are strictly ignored.
  - Custom mock headers (e.g. `x-user-id`) are restricted exclusively to automated test runners (`process.env.NODE_ENV === 'test'`).

---

## 2. Database Purpose

The Saarvi PostgreSQL database (hosted on Supabase) serves exclusively operational and relational purposes:
1. **User Identity & Account Profiles**: Link authenticated sessions to display names, avatars, and global user roles (`USER`, `ADMIN`, `SUPER_ADMIN`).
2. **Operational Tool Metadata**: Track document processing events, timestamps, tool slugs, file sizes, and processing metrics (zero bytes of file content).
3. **Draft Resume Templates**: Store structured ATS resume builder draft configurations (JSON metadata) for users who opt into cloud draft saving.
4. **User Preferences**: Persist cross-device UI preferences (theme, auto-download preferences).
5. **Subscription & Billing**: Enforce server-authoritative Razorpay subscription states, webhook idempotency keys, and payment invoice histories.
6. **Platform Administration**: Store global operational configurations (tool overrides, announcements, system error logs, and immutable audit logs).

> [!IMPORTANT]
> Private user documents, files, PDFs, student academic marks, VTU calculation snapshots, attendance records, study plans, assignments, and conversation transcripts are **NOT** stored in PostgreSQL. They reside strictly within the browser's local-first IndexedDB storage.

---

## 3. Table Inventory

The complete inventory of all 21 PostgreSQL tables across migrations `001` through `007`:

| Table Name | Purpose | Primary Key | Foreign Keys | RLS Status |
| :--- | :--- | :--- | :--- | :--- |
| `public.profiles` | User account display metadata & roles | `id` (UUID) | `REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.conversion_history` | Document tool processing metadata | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.resumes` | Resume builder draft template JSON | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.user_preferences` | User UI preferences (theme, auto-download) | `user_id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_study_plans` | Schema for study sessions *(local-first in app)* | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_assignments` | Schema for assignment tracking *(local-first in app)*| `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_timetables` | Schema for timetable records *(local-first in app)* | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_certificates` | Schema for certificate verification *(local-first)*| `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_internships` | Schema for internship applications *(local-first)* | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_hackathons` | Schema for hackathon participation *(local-first)* | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_cover_letters`| Schema for cover letters *(local-first in app)* | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.student_academic_records`| Schema for academic snapshots *(local-first in app)*| `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.platform_settings` | Global platform configuration & maintenance | `id` (TEXT) | None | ENABLED |
| `public.tool_overrides` | Dynamic tool status overrides & limits | `id` (TEXT) | None | ENABLED |
| `public.curriculum_versions` | Official VTU curriculum syllabus records | `id` (UUID) | None | ENABLED |
| `public.announcements` | System & maintenance notices | `id` (UUID) | None | ENABLED |
| `public.system_errors` | Sanitized system exception log | `id` (UUID) | None | ENABLED |
| `public.audit_logs` | Immutable administrative audit log | `id` (UUID) | None | ENABLED |
| `public.subscriptions` | Razorpay subscription states & entitlements | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |
| `public.billing_events` | Webhook idempotency keys & payloads | `id` (UUID) | None | ENABLED |
| `public.invoices` | Billing transaction receipts & URLs | `id` (UUID) | `user_id REFERENCES auth.users(id) ON DELETE CASCADE` | ENABLED |

---

## 4. Data Classification

All data fields within the platform are categorized under the following data taxonomy:

| Classification | Description | Storage Boundary |
| :--- | :--- | :--- |
| **AUTH_IDENTITY** | User ID, email, hashed auth records, OAuth provider links | Supabase Auth (`auth.users`), `profiles` |
| **SERVER_OPERATIONAL** | File conversion metadata, tool execution timing, error categories | PostgreSQL (`conversion_history`, `system_errors`) |
| **BILLING** | Subscription ID, customer ID, plan, interval, webhook event ID | PostgreSQL (`subscriptions`, `billing_events`, `invoices`) |
| **NOTIFICATION** | In-app notification preferences, job scheduling queue | In-memory server store (`server-store.ts`) |
| **ADMIN** | Platform settings, tool overrides, curriculum definitions, audit trails | PostgreSQL (`platform_settings`, `tool_overrides`, `audit_logs`) |
| **ANALYTICS** | Pseudonymous telemetry, route counts, latency percentiles | In-memory ring buffer (500 events) |
| **PRIVATE_WORKSPACE** | Resumes, PDFs, academic marks, SGPA/CGPA, attendance, timetable, notes, conversations | **Client-Side IndexedDB (`DocEaseAcademicDB` v4)** |
| **SECRET** | API keys, service-role keys, Razorpay secret, webhook HMAC secrets | Server Environment Variables (`.env.local`) |
| **SENSITIVE** | Passwords, UPI PINs, OAuth client secrets | **NEVER STORED ANYWHERE** |
| **PUBLIC** | Tool lists, FAQ items, SEO metadata, landing page assets | Public Web Bundle / Static HTML |
| **SYSTEM** | Next.js build cache, runtime health metrics | Server Memory |

---

## 5. RLS Architecture

Row Level Security is explicitly activated on 100% of user-accessible and operational tables via:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
```

### Policy Structure:
1. **User Identity Boundary**: Every user-owned table enforces strict equality against `auth.uid()`:
   - `SELECT`: `USING (auth.uid() = user_id)` (or `auth.uid() = id` on `profiles`)
   - `INSERT`: `WITH CHECK (auth.uid() = user_id)`
   - `UPDATE`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
   - `DELETE`: `USING (auth.uid() = user_id)`
2. **Prohibited Unsafe Defaults**:
   - `USING (true)` and `WITH CHECK (true)` are strictly forbidden on all user-owned tables.
   - Public read access is permitted solely on read-only public resources: `platform_settings`, `tool_overrides`, `curriculum_versions (status = 'ACTIVE')`, and `announcements (status = 'PUBLISHED')`.
3. **Hardened Trigger Protections**:
   - The `handle_new_user()` trigger enforces `SET search_path = public` to prevent schema search path hijacking.
   - The `protect_profile_role()` trigger blocks any direct client UPDATE on `profiles.role`.

---

## 6. Ownership Model

- **1:1 User Binding**: Every user profile is mapped 1:1 with `auth.users(id)` through a foreign key constraint with `ON DELETE CASCADE`.
- **No Orphan Records**: Cascading deletes guarantee that if an auth user is removed, all linked metadata rows (`conversion_history`, `resumes`, `user_preferences`, `subscriptions`, `invoices`) are automatically cleaned up.
- **Cross-User Isolation**: A user authenticated as `User A` can never read, modify, or delete records belonging to `User B`. RLS policies evaluate `auth.uid() = user_id` inside PostgreSQL kernel space, independent of frontend state.

---

## 7. Admin Authorization

Administrative privileges follow a multi-layered verification model:
1. **Database Role Verification**:
   - Admin policies evaluate:
     ```sql
     EXISTS (
       SELECT 1 FROM public.profiles
       WHERE public.profiles.id = auth.uid()
       AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
     )
     ```
2. **Immutable Role Guarding**:
   - Standard users cannot promote themselves to `ADMIN` or `SUPER_ADMIN`.
   - The `protect_profile_role()` trigger throws an exception if an authenticated caller without `SUPER_ADMIN` credentials attempts to modify the `role` column.
3. **Client Parameter Rejection**:
   - Server endpoints never trust `request.body.role`, `request.body.isAdmin`, or untrusted headers for elevated operations.

---

## 8. Notification Data

- **Architecture**: In-app notifications, notifications history, and scheduling are managed by a server-authoritative in-memory ring buffer and scheduling worker (`src/lib/notifications/server-store.ts`).
- **Database Footprint**: Zero notification tables exist in PostgreSQL, completely preventing database lock contention and orphan notification state.
- **Session Guarding**: All notification endpoints (`/api/notifications/schedule`, `/history`, `/preferences`) require session authentication via `getAuthenticatedNotificationUser(request)`. Users cannot view or schedule notifications for another user.

---

## 9. Billing Data

- **Provider**: Razorpay Payment Gateway (Cards, UPI, Netbanking).
- **Invariants**: Pricing is immutable: ₹99/month, ₹899/year.
- **Server Authority**:
  - `/api/billing/checkout`: Derives identity strictly from verified session. Validates plan and interval. Rejects client-submitted amounts, prices, currencies, or discounts with `400 SECURITY_VIOLATION`.
  - `/api/billing/subscription`: Rejects cross-user queries with `403 FORBIDDEN_USER_MISMATCH`.
  - `/api/billing/webhook`: Verifies HMAC SHA-256 signatures with replay protection and enforces event idempotency via `public.billing_events.provider_event_id UNIQUE`.

---

## 10. Analytics Data

- **Scope**: Purely operational telemetry (route names, tool categories, execution durations, HTTP status codes, error classifications).
- **Privacy Enforcement**:
  - Passwords, auth tokens, marks, SGPA/CGPA, prompts, file contents, and document bytes are stripped before storage.
  - Search telemetry collects zero raw query text.
  - Event payloads are bounded to 1,000 characters to prevent inadvertent data dumping.
  - Telemetry is held in an in-memory ring buffer of 500 records; zero telemetry data is written to persistent relational tables.

---

## 11. Local-First Boundary

Saarvi's core student and document workspace features are strictly **local-first**:

```
Client Browser Action
       │
       ▼
Local Service Layer (src/lib/services/)
       │
       ▼
IndexedDB Storage Engine (DocEaseAcademicDB v4)
       │
       ├── studentProfiles
       ├── semesterRecords
       ├── attendanceRecords
       ├── academicGoals
       ├── tasks & assignments
       ├── timetable & studySessions
       ├── certificates & internships
       ├── hackathons & coverLetters
       ├── jobApplications & careerSkills
       └── conversations & conversationMessages
```

**Zero Cloud Sync Guarantee**:
- Academic marks, attendance records, study planners, assignment deadlines, cover letters, career profiles, and AI chat histories are never transmitted to Supabase.
- When exporting a workspace, data is serialized client-side into JSON for local download.

---

## 12. Secret Handling

All production secrets are strictly segregated:
- **Server-Only Secrets**: `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`, `AI_API_KEY`, `OCR_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- **Prohibited in Client Bundles**: No server secret may be prefixed with `NEXT_PUBLIC_` or imported into client components (`'use client'`).
- **Log Redaction**: All logging utilities and error classifiers redact sensitive credential patterns (`eyJ...`, `rzp_...`, `Bearer...`) before writing output.

---

## 13. Migration Policy

- **Linear Migrations**: All database schema changes are managed via numbered, timestamped SQL migration files in `supabase/migrations/`.
- **Non-Destructive Operations**: Production migrations must use `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and avoid `DROP TABLE` or `DROP COLUMN` without safe data migration scripts.
- **Mandatory RLS**: Any new table created in a migration must include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and explicit policies.

---

## 14. Retention Behavior

- **Account Profiles**: Retained while the user account remains active in `auth.users`.
- **Conversion History Metadata**: Metadata retained for 90 days or until user deletion; contains zero document contents.
- **Resume Builder Drafts**: Retained until updated or deleted by user.
- **Billing Records**: Subscriptions and invoices retained indefinitely for financial compliance and audit reconciliation.
- **Local IndexedDB Workspace**: Retained permanently in browser storage until the user manually deletes records, clears site data, or exports the workspace.

---

## 15. Known Limitations & Mitigations

1. **Client-Side Account Deletion**:
   - *Limitation*: The Supabase Client SDK cannot delete rows from `auth.users` without the service-role key.
   - *Mitigation*: Migration `007` adds an explicit `DELETE` policy on `public.profiles` allowing users to delete their application profile. Complete account purging from `auth.users` requires calling a server route handler backed by `SUPABASE_SERVICE_ROLE_KEY`.
2. **IndexedDB Local Storage Durability**:
   - *Limitation*: Browser cache clearing or aggressive browser storage cleanup can purge local IndexedDB databases.
   - *Mitigation*: Saarvi provides a comprehensive 1-click **Export Full Workspace** JSON backup feature in `src/lib/academic/storage/academic-db.ts`.
