# Saarvi — Global Tool UI/UX Standardization Report
**Consistent Friendly Interface for Every Tool**

---

## Executive Summary
Every user-facing tool across Saarvi has been standardized to adhere to the visual baseline established by the **PDF-to-JPG** reference implementation (`src/app/tools/[slug]/page.tsx` & `ToolRunner.tsx`). Normal user-facing tools now have **zero dark or black page backgrounds** (`bg-slate-950`, `bg-black`, `bg-slate-900` canvas elements), adopting a friendly, clean, accessible, and professional light design language (`#f8fafc` / `bg-slate-50`, crisp white cards, subtle borders, Saarvi blue accents, and accessible typography).

---

## 1. Design Standard & Architectural Hierarchy

### Visual Reference Baseline (PDF-to-JPG)
All tools follow the established canonical structure:
1. **Breadcrumb Navigation**: `Student Hub` / `Tools` / `Category` / `Tool Name` with hover micro-interactions.
2. **Standardized Header**: Clean icon badge with rounded corners, high-contrast title (`text-slate-900`), informative subtitle (`text-slate-500`), and real metadata badges (`Local-First`, `Verified Source`).
3. **Primary Working Card**: Crisp white card (`bg-white border-slate-200/90 rounded-3xl shadow-xs`), drag-and-drop input or form with rounded inputs and clear feedback.
4. **Primary Actions**: Solid Saarvi blue buttons (`bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition-colors`).
5. **Real Processing State**: Dedicated spinner and status message during async computations.
6. **Result Area**: Clean preview and download buttons.
7. **Educational FAQ / Help Area**: Clean accordion explaining privacy, features, and usage.

---

## 2. Component & Page Standardization Details

### A. Shared Standard Shell Component
- **Created**: `src/components/tools/ToolPageShell.tsx`
  - Reusable container component for all user-facing tools.
  - Implements breadcrumbs, header with icon, category badges, feature flag disabled / maintenance gates, and light card wrappers.

### B. AI & OCR Suite Light Transformation
Converted from previous dark slate (`bg-slate-950`, `bg-slate-900/60`) to crisp light design:
- **`src/components/ai/AIToolRunner.tsx`**:
  - Replaced dark backgrounds with crisp white cards (`border border-slate-200/90 bg-white rounded-3xl shadow-xs`).
  - Privacy banner styled with `border-slate-200/80 bg-white text-slate-700` and emerald/amber indicators.
  - Action buttons standardized to `bg-blue-600 hover:bg-blue-700`.
- **`src/components/ai/AIConsentModal.tsx`**:
  - Standardized backdrop to `bg-slate-900/40 backdrop-blur-xs`.
  - Converted dialog to white card (`bg-white border-slate-200 rounded-3xl shadow-2xl text-slate-900`).
- **`src/components/career/AIJobDescriptionModal.tsx`**:
  - Replaced `bg-slate-950`, `bg-slate-900` with `bg-white rounded-3xl border border-slate-200/90 shadow-2xl`.
  - Converted skill matchers to `bg-emerald-50 text-emerald-800` and `bg-amber-50 text-amber-800`.
  - Backdrop updated to `bg-slate-900/40 backdrop-blur-xs`.
- **`src/app/tools/document-summary/page.tsx`**:
  - Removed `bg-slate-950`. Added breadcrumbs, light container (`bg-[#f8fafc]`), white cards, and blue buttons.
- **`src/app/tools/document-qa/page.tsx`**:
  - Removed `bg-slate-950`. Added breadcrumbs, light container (`bg-[#f8fafc]`), white question cards, and blue buttons.
- **`src/app/tools/ocr-image/page.tsx`**:
  - Standardized dropzone and options cards to PDF-to-JPG standard. Removed `bg-slate-950`. Added breadcrumbs.
- **`src/app/tools/ocr-pdf/page.tsx`**:
  - Standardized dropzone, page range selectors, and OCR preview to PDF-to-JPG standard. Removed `bg-slate-950`. Added breadcrumbs.
- **`src/app/student/study-assistant/page.tsx`**:
  - Removed `bg-slate-950`. Standardized notes inputs, academic calculation separation notices, and light styling.

### C. Student Productivity Tools Blue System Harmony
Standardized active pills and buttons from inconsistent dark styles (`bg-slate-900`) to Saarvi blue (`bg-blue-600`):
- **`src/app/student/assignment-planner/page.tsx`**: Active filter pills and Add button -> `bg-blue-600`.
- **`src/app/student/timetable/page.tsx`**: Active day tab -> `bg-blue-600`.
- **`src/app/student/hackathons/page.tsx`**: Active filter pills and empty state CTA -> `bg-blue-600`.
- **`src/app/student/internships/page.tsx`**: Active filter pills and empty state CTA -> `bg-blue-600`.
- **`src/app/student/study-planner/page.tsx`**: Active filter tab and empty state CTA -> `bg-blue-600`.
- **`src/app/student/certificates/page.tsx`**: Active category pill and empty state CTA -> `bg-blue-600`.
- **`src/app/student/goals/page.tsx`**: Active category filter pills -> `bg-blue-600`.
- **`src/app/student/tasks/page.tsx`**: Active status filter pill -> `bg-blue-600`.
- **`src/app/student/StudentPortalView.tsx`**: Active category pill -> `bg-blue-600`.
- **`src/app/student/dashboard/page.tsx`**: Active workspace tab pill -> `bg-blue-600`.

### D. Academic Calculators
- **`src/app/student/marks-calculator/page.tsx`**:
  - Explanation banner upgraded from muddy `bg-black/15` to clean translucent `bg-white/15`.
- **`src/app/student/attendance/page.tsx`**:
  - Result status banner upgraded from `bg-black/15` to clean translucent `bg-white/15`.
- **`src/app/student/sgpa-calculator/page.tsx`**:
  - Standardized multi-university dynamic header:
    - Mode "custom": `"SGPA Calculator"`
    - When VTU selected: `"VTU SGPA Calculator"`
    - When other university selected: `"${selectedUnivObj.name} SGPA Calculator"`
    - Default fallback: `"SGPA Calculator"`
  - Added Breadcrumb navigation.

### E. Career Tools
- **`src/app/student/resume/page.tsx`**:
  - Added Breadcrumb navigation (`Student Hub / Resume & CV Builder`).
  - Standardized structured bullet buttons to `bg-blue-600`.
  - Version creation modal upgraded: backdrop `bg-slate-900/40 backdrop-blur-xs`, modal card `bg-white rounded-3xl border border-slate-200/90 shadow-2xl`.
  - Preserved side-by-side (desktop) and stacked (mobile) live A4 paper preview.
- **`src/app/student/cover-letter/page.tsx`**:
  - Added Breadcrumb navigation (`Student Hub / Cover Letter Builder`).
  - Upgraded live preview sheet to crisp white card (`bg-slate-50/70 border border-slate-200/90 rounded-2xl p-6 shadow-xs`).
  - Preserved "Your Name" placeholder when no user value entered.
  - Preserved 3-second automatic download countdown with single execution.
- **`src/app/student/applications/page.tsx`**:
  - Added Breadcrumb navigation (`Student Hub / Application Tracker`).
  - Added friendly empty state card with `+ Track Your First Opportunity` CTA when 0 applications are tracked.
  - Upgraded Add/Edit opportunity modal: backdrop `bg-slate-900/40 backdrop-blur-xs`, container `bg-white rounded-3xl shadow-2xl border border-slate-200/90`.
  - Upgraded Schedule Interview modal: backdrop `bg-slate-900/40 backdrop-blur-xs`, container `bg-white rounded-3xl shadow-2xl border border-slate-200/90`.
- **`src/app/student/career/page.tsx`**:
  - Added Breadcrumb navigation (`Student Hub / Career Suite`).
  - Upgraded Import modal: backdrop `bg-slate-900/40 backdrop-blur-xs`, container `bg-white rounded-3xl shadow-2xl border border-slate-200/90`.

---

## 3. Verification & Quality Matrix

| Test Category | Suite File | Result |
| :--- | :--- | :--- |
| **Tool UI Standardization** | `tests/tool-ui-standardization.test.mjs` | **9 / 9 PASS (100%)** |
| **Tool Route Integrity** | `tests/tool-route-integrity.test.mjs` | **4 / 4 PASS (100%)** |
| **Security Fortress (Phase 30E)** | `tests/phase30e-security-fortress.test.mjs` | **10 / 10 PASS (100%)** |
| **Admin & Gmail Auth** | `tests/admin-notifications-auth.test.mjs` | **13 / 13 PASS (100%)** |
| **Full Platform Regression** | `npm test` | **551 / 551 PASS (100%)** |
| **TypeScript Type Check** | `npx tsc --noEmit` | **0 errors (100% clean)** |
| **Production Build** | `npm run build` | **135 / 135 pages compiled successfully** |

---

## 4. Invariants Upheld
- **Local-First Privacy**: File conversions, OCR previews, and local calculators execute client-side in the browser.
- **Automatic Download Invariant**: 3-second countdown preserved with single execution protection.
- **Multi-University Math**: Deterministic SGPA calculations, CIE+SEE marks validation, and credits calculations untouched.
- **Admin Control**: Feature flags, maintenance gates, and tool overrides remain active.
- **Git Safety Rule**: All work performed locally. No commits or pushes made.
