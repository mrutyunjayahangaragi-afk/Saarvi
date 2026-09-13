# Saarvi — Multi-University SGPA & Academic Administration Guide
**Subsystem:** Multi-University Academic Platform & Deterministic Calculation Engine  
**Product:** Saarvi — Study. Work. Grow.  
**Domain:** `https://saarvi.app`  

---

## 1. Executive Summary

Saarvi's academic evaluation engine provides a unified, extensible architecture supporting **Visvesvaraya Technological University (VTU)**, **Autonomous Engineering Colleges**, **State Universities**, and future administrative institutions.

The platform cleanly separates:
- **Platform Data (Curriculum, Schemes, Courses, Credits):** Super Admin managed, server-side validated, and publicly discoverable.
- **Student Data (Marks, CIE/SEE scores, SGPAs, CGPAs):** Strictly local-first in browser storage, never transmitted or persisted on remote servers.

---

## 2. Multi-University Hierarchy

```
UNIVERSITY (e.g. VTU, RVCE Autonomous, BMSCE, PESU)
 └── SCHEME / REGULATION (e.g. 2022 Scheme, 2025 Scheme)
      └── BRANCH (e.g. Computer Science, AIML, Electronics)
           └── SEMESTER (Semester 1 through Semester N)
                └── SUBJECTS (Course Code, Title, Credits, Course Type, SEE Flag)
```

### 4-Tuple Resolution Invariant:
A curriculum query must supply the exact composite 4-tuple:
`universityId` + `schemeId` + `branchId` + `semesterNumber`

If a published curriculum exists for that exact tuple, official course codes and credit allocations populate automatically.

---

## 3. Strict Deterministic Validation & Anti-Hallucination Policy

### Subject Input Rules:
- **Course Code:** Non-empty, alphanumeric string (e.g. `BCS301`, `22CS32`). Uniqueness is strictly enforced within the same `(university, scheme, branch, semester)` scope.
- **Credits:** Positive integer or floating number (`credits > 0`, clamped `0.5` to `12.0`). Negative, zero, or `NaN` credits are rejected with HTTP 400.
- **Course Type:** `Theory`, `Practical / Lab`, `Integrated`, `Project`, or `Non-Credit Mandatory`.

### Missing Curriculum Empty State:
When a student selects a university, scheme, branch, or semester combination with no published syllabus:
- The system displays: **"Curriculum not available yet."** with an **"Ask Admin to add curriculum"** action.
- **Strict Prohibition:** The platform **NEVER** fabricates synthetic course codes, guesses credits, or falls back to an unrelated university's courses.

---

## 4. Deterministic SGPA Calculation Formula

Calculations are pure functions executed client-side without network latency or external AI dependencies:

$$\text{SGPA} = \frac{\sum_{i=1}^{n} (\text{Credit}_i \times \text{GradePoint}_i)}{\sum_{i=1}^{n} \text{Credit}_i}$$

### Passing & Invalidation Rules:
- Courses with letter grade `F` (Fail) contribute `0` grade points to the numerator, but their credits **remain in the denominator**, accurately reflecting academic standing.
- Non-credit mandatory courses (`Audit` / `P/F`) are excluded from both numerator and denominator calculations.
- Pure local math ensures zero server tampering, zero floating-point drift, and instant responsiveness.
