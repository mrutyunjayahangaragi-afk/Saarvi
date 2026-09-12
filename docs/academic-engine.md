# DocEase Academic Intelligence Engine (Phase 17)

## 1. Overview & Architecture

The DocEase Academic Intelligence Engine transforms student academic calculations into a semester-aware, reliable, local-first academic platform. It is architecturally decoupled into four distinct layers:

```
┌───────────────────────────────────────────────────────────┐
│                    Academic User Interface               │
│  (/student/sgpa-calculator, /student/cgpa-calculator,     │
│   /student/attendance, /student/marks-calculator,        │
│   /student/dashboard)                                     │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                 Academic Storage Service                  │
│       (Local IndexedDB & in-memory/localStorage)          │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│              Deterministic Calculation Engine             │
│        (Pure Functions: SGPA, CGPA, Attendance,           │
│         Required Marks, Academic Goals)                   │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                University & Curriculum Config             │
│        (VTU 2022 Scheme CBCS / NEP Verified Courses)      │
└───────────────────────────────────────────────────────────┘
```

The system is deterministic, private by design, and strictly local-only.

---

## 2. University Configuration & Extensibility

All university regulations are encapsulated in `UniversityAcademicConfig` objects registered in `src/lib/academic/universities/registry.ts`.

### Primary University: Visvesvaraya Technological University (VTU)
- **Institution**: Visvesvaraya Technological University, Belagavi, Karnataka, India
- **Primary Source**: `https://vtu.ac.in/b-e-scheme-syllabus/`
- **Official Regulation**: VTU Regulations Governing Bachelor of Engineering (B.E.) Under Choice Based Credit System (CBCS) / NEP 2020
- **Supported Schemes**:
  - `2022`: CBCS / NEP 2020 (Branches: CSE, ISE, AIML, ECE; Semesters 1 to 8)
  - `2025`: Draft / Extensible scheme (Semesters 1 to 2)

New autonomous institutions or universities can be registered at runtime without modifying UI components or calculation routines.

---

## 3. Official VTU 2022 Grading Configuration

Grading bands are centralized in `src/lib/academic/universities/vtu.ts`:

| Letter Grade | Grade Points | Percentage Band | Description |
|:---:|:---:|:---:|:---|
| **O** | 10 | 90% – 100% | Outstanding |
| **A+** | 9 | 80% – 89.99% | Excellent |
| **A** | 8 | 70% – 79.99% | Very Good |
| **B+** | 7 | 60% – 69.99% | Good |
| **B** | 6 | 55% – 59.99% | Above Average |
| **C** | 5 | 50% – 54.99% | Average |
| **P** | 4 | 40% – 49.99% | Pass |
| **F** | 0 | 0% – 39.99% | Fail |

### Passing Thresholds
1. **Continuous Internal Evaluation (CIE)**: Minimum 20 marks out of 50 (40%). For courses without SEE (e.g. 100-mark CIE), minimum 40 marks (40%).
2. **Semester End Examination (SEE)**: Minimum 18 marks out of 50 (35%).
3. **Aggregate Marks**: Minimum 40 marks out of 100 (40%).

Failure to meet either CIE or SEE threshold results in an automatic **F** grade (0 grade points) regardless of total percentage.

---

## 4. Mathematical Calculation Engine

### A. Semester SGPA Calculation
$$\text{SGPA} = \frac{\sum (\text{Registered Credits}_i \times \text{Grade Point}_i)}{\sum \text{Applicable Registered Credits}_i}$$

- **Non-credit courses** (e.g., NSS, Yoga where credits = 0) are excluded from the denominator.
- **F-grade courses** retain their registered credits in the denominator with 0 grade points in the numerator.
- Results are rounded to **2 decimal places**.

### B. Cumulative CGPA Calculation
$$\text{CGPA} = \frac{\sum_{\text{all semesters}} \text{Credit Points}_i}{\sum_{\text{all semesters}} \text{Registered Credits}_i}$$

- Semester-weighted calculation (does not average SGPAs).
- Tracks active backlogs and removes backlogs when subsequently cleared.

### C. VTU 2022 Percentage Conversion Formula
$$\text{Percentage} = (\text{CGPA} - 0.75) \times 10 \quad (\text{for } \text{CGPA} \ge 0.75)$$

### D. Attendance Calculation & Safe Skips
$$\text{Current Attendance} = \left(\frac{\text{Attended Classes}}{\text{Total Classes}}\right) \times 100$$
- **Consecutive classes needed** to achieve target $T\%$:
$$N = \left\lceil \frac{T \times \text{Total} - 100 \times \text{Attended}}{100 - T} \right\rceil$$
- **Safe skips allowed** while remaining $\ge T\%$:
$$M = \left\lfloor \frac{100 \times \text{Attended} - T \times \text{Total}}{T} \right\rfloor$$

### E. Required Marks Calculation ("What marks do I need?")
$$\text{Required Score} = \left\lceil \frac{(\text{Current Max} + \text{Remaining Max}) \times \text{Target}\%}{100} \right\rceil - \text{Current Marks}$$
- If $\text{Required Score} \le 0$: Target already achieved.
- If $\text{Required Score} > \text{Remaining Max}$: Mathematically unachievable.

---

## 5. Local-First Persistence Model (IndexedDB)

Academic data is stored **strictly client-side** using browser `IndexedDB` (`DocEaseAcademicDB` v1) with in-memory / localStorage fallback:

- `studentProfiles`: Local profile metadata (id, name, university, branch, scheme).
- `semesterRecords`: Semester-wise evaluated courses, SGPA, credits, credit points, calculation steps.
- `attendanceRecords`: Subject-wise attendance entries, target percentages, safe skips.
- `academicGoals`: Target CGPA goals and projections.
- `calculationHistory`: Audit history of calculation events.

### In-Browser Data Backup & Portability
- **Export**: Generates structured `AcademicExportPayload` JSON completely client-side without network calls.
- **Import**: Validates JSON schema, number boundaries, rejects negative numbers or malformed records, and restores records to IndexedDB.

---

## 6. Privacy & Security Invariant

- **Zero Network Transmission**: Marks, grades, SGPA, CGPA, attendance, and student notes are **never** uploaded to Supabase, external APIs, AI services, or analytics.
- **Client-Side Verification**: Network tab audit verifies that no `fetch` or `XMLHttpRequest` containing marks is triggered during calculations.
