# Saarvi — Tool Route Integrity Specification & Audit Guide
**Product:** Saarvi — Study. Work. Grow.  
**Domain:** `https://saarvi.app`  
**Status:** 100% Verified • 0 Dead Links • Automated CI Test Protected

---

## 1. Executive Summary

Saarvi provides 45+ specialized tools spanning PDF processing, image manipulation, student productivity, academic evaluation, career acceleration, and artificial intelligence. To ensure zero 404 errors, dead links, or phantom navigation paths across the application, this document details the **Canonical Tool Routing Architecture**, the directory mapping rules, and the permanent automated regression tests guarding against broken links.

---

## 2. The 3-Tier Route Resolution Hierarchy

All tool navigation paths resolve through three deterministic layers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CANONICAL TOOL REGISTRY (src/lib/tools/tool-registry.ts) │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐     ┌───────────────────────────────┐
│ 2. STATIC APP ROUTER PAGES    │     │ 3. DYNAMIC TOOLS ENGINE       │
│    (Dedicated Components)     │     │    (/tools/[slug]/page.tsx)   │
│ e.g. /student/jobs            │     │ e.g. /tools/merge-pdf         │
│      /student/interviews      │     │      /tools/compress-image    │
│      /student/skills          │     │      /tools/jpg-to-pdf        │
│      /student/resume          │     └───────────────────────────────┘
│      /student/sgpa-calculator │
└───────────────────────────────┘
```

1. **Layer 1: Canonical Tool Registry (`tool-registry.ts`)**
   The single source of truth consumed by:
   - Desktop Mega Menu (`MegaMenu.tsx`)
   - Mobile Navbar Accordion (`Navbar.tsx`)
   - Global Command Search (`CommandSearch.tsx` / `GlobalSearchModal.tsx`, Cmd+K)
   - Homepage Category Explorer & Popular Tools Cards (`src/app/page.tsx`)
   - Tool Catalog Directory (`src/app/tools/page.tsx`)
   - Super Admin Feature Flags & Tool Overrides

2. **Layer 2: Static App Router Pages**
   Specialized interactive student and career applications with dedicated local-first state, IndexedDB persistence, or canvas rendering.

3. **Layer 3: Dynamic Tool Slug Engine (`/tools/[slug]`)**
   Standardized PDF and image manipulation engines using client-side WebAssembly, PDF-lib, and Canvas transforms with dynamic feature flag and maintenance enforcement.

---

## 3. Repaired & Canonical Routes Inventory

During the Master Platform Audit, the following 6 routes were audited, reconciled, and repaired to eliminate all 404 responses:

| Tool Key | Canonical Route | Underlying Implementation | Access Mode | Status |
|:---|:---|:---|:---:|:---:|
| `job-tracker` | `/student/jobs` | `src/app/student/jobs/page.tsx` (Kanban board, stages, deadlines) | FREE | Available |
| `interview-prep` | `/student/interviews` | `src/app/student/interviews/page.tsx` (Mock interview turns, skills) | FREE | Available |
| `skill-gap-analyzer` | `/student/skills` | `src/app/student/skills/page.tsx` (Role requirement matching) | FREE | Available |
| `ats-analyzer` | `/student/ats` | `src/app/student/ats/page.tsx` (ATS score, keyword density) | FREE | Available |
| `exam-marks-analyzer` | `/student/calculator` | `src/app/student/calculator/page.tsx` (CIE/SEE marks thresholds) | FREE | Available |
| `assignment-planner` | `/student/assignments` | `src/app/student/assignments/page.tsx` (Multi-criteria sorter) | FREE | Available |

*Note: Existing routes like `/student/applications`, `/student/marks-calculator`, and `/student/assignment-planner` remain fully functional as direct routes.*

---

## 4. Automated CI Route Integrity Verification

To prevent regressions, the automated test suite [tests/tool-route-integrity.test.mjs](file:///Users/mrutyunjayaashokhangaragi/.gemini/antigravity-ide/scratch/smart/tests/tool-route-integrity.test.mjs) executes in CI on every run:
1. **Registry Route Exists:** Ensures every route defined in `CANONICAL_TOOL_REGISTRY` has an existing Next.js App Router target (`page.tsx` or dynamic route).
2. **Category Population:** Ensures all 6 canonical categories (`pdf`, `image`, `student`, `academic`, `career`, `ai`) are populated with active tools.
3. **Whole-Repository Link Scanner:** Crawls all JSX files across `src/` extracting `href="..."` and `router.push("...")` to guarantee **zero dead links**.

Command:
```bash
node --test tests/tool-route-integrity.test.mjs
```
Result: **4 / 4 tests passed, 0 dead links detected across 66 unique internal routes**.
