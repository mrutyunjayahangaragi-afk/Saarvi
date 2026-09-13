# Saarvi — Super Admin Control Center & Feature Flags Guide
**Subsystem:** Administrative Architecture, Runtime Toggles & Zero-Code Propagation  
**Product:** Saarvi — Study. Work. Grow.  
**Domain:** `https://saarvi.app`  

---

## 1. Architectural Foundation & Separation of Concerns

Saarvi enforces a strict three-layer architectural separation:

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: SOURCE CODE (Developer Controlled)                 │
│ Git Repo -> Vercel Builds -> Immutable Deployments         │
├─────────────────────────────────────────────────────────────┤
│ LAYER 2: PLATFORM CONFIGURATION (Super Admin Controlled)    │
│ Feature Flags • Free/Subscription • Multi-University Store │
│ Immediate runtime propagation; ZERO rebuilds or git pushes  │
├─────────────────────────────────────────────────────────────┤
│ LAYER 3: USER PRIVATE DATA (Student Local-First Controlled) │
│ Browser localStorage & IndexedDB • Zero Cloud Leaks         │
└─────────────────────────────────────────────────────────────┘
```

### Invariant:
**Normal administrative configuration changes must NEVER require:**
- A `git commit` or `git push`
- A source-code modification
- A Vercel deployment or frontend container rebuild

---

## 2. Super Admin Capabilities & Permission Matrix

Administrative requests require cryptographic session validation against the `admins` table. Client-provided roles, user IDs, or headers (`x-admin-role`) are **strictly rejected in production environments**.

| Permission | Scope & Actions | Authorized Roles |
|:---|:---|:---|
| `VIEW` | Read-only access to system telemetry, error reports, and analytics | `admin`, `super_admin`, `auditor` |
| `MANAGE` | Toggle tool statuses, update feature flags, modify system announcements | `admin`, `super_admin` |
| `PUBLISH` | Deploy new curriculum versions, schemes, branches, or syllabi | `curriculum_editor`, `super_admin` |
| `BILLING` | Manage plans, review subscriptions, and trigger refunds | `billing_admin`, `super_admin` |
| `SECURITY` | Provision admins, inspect audit logs, enforce IP rate limits | `security_admin`, `super_admin` |
| `SUPER_ADMIN` | Master capability spanning all operational and security boundaries | `super_admin` |

---

## 3. Dynamic Feature Flags Control Center

Located at `/admin/features`, the control center empowers Super Admins to dynamically adjust feature availability and monetization modes in real time:

### Status Transitions:
- `ENABLED`: Available and active across all public menus, search, and routes.
- `DISABLED`: Globally disabled. Navigation cards display disabled badges; direct route access displays a friendly "Tool currently unavailable" screen.
- `MAINTENANCE`: Displays a non-blocking maintenance notice.
- `BETA`: Tagged with a purple Beta badge for experimental student access.

### Access Modes:
- `FREE`: Available to all students without requiring payment or subscription tiers.
- `SUBSCRIPTION`: Marked with a golden **PRO** badge across Navbar, MegaMenu, and Search. Direct routes enforce entitlement checking. Pricing remains strictly fixed at **₹99/month** or **₹899/year**.

---

## 4. Runtime Propagation & Scoped Cache Invalidation

When an admin updates a feature flag via `PATCH /api/admin/features`:
1. **Mutual Exclusion Lock:** Request acquires key-scoped mutex `GLOBAL_LOCK.withLock('feature:' + id, ...)` to eliminate concurrent write collisions.
2. **Server-Side Store Mutation:** `featureServerStore.updateFeature(...)` updates the in-memory authoritative map and persists an immutable audit log entry.
3. **Scoped Cache Invalidation:** `GLOBAL_SCOPED_CACHE.invalidatePrefix('feature:')` purges stale cached responses immediately.
4. **Instant Client Propagation:** Client-side components querying `/api/features` receive updated states without polling loops or code changes.

---

## 5. Audit Logging Specifications

Every privileged mutation records a structured audit event in `admin_audit_logs`:
- `admin_id`: Authenticated user UUID
- `action`: e.g. `FEATURE_TOGGLED`, `ACCESS_MODE_CHANGED`, `CURRICULUM_PUBLISHED`
- `resource_type`: `feature_flag`, `university`, `scheme`, `subject`
- `resource_id`: Target identifier
- `ip_address`: Sanitized client IP (Cloudflare / X-Forwarded-For)
- `timestamp`: ISO-8601 UTC string
- `diff`: Previous vs. New state payload

**Privacy Guarantee:** Audit logs never capture student resumes, marks, grades, or personal documents.
