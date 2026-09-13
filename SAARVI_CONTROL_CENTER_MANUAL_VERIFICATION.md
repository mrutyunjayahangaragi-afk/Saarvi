# Saarvi — Control Center & Multi-University Academic Verification Guide

This guide provides step-by-step manual test procedures for verifying the Unified Super Admin Control Center, Canonical Tool Registry, Multi-University Academic Platform, and Student Tools.

---

## 1. Runtime Feature Flags & Monetization Control

### Objective:
Verify runtime feature flag updates (`FREE` vs `SUBSCRIPTION`, `ENABLED`, `DISABLED`, `BETA`, `MAINTENANCE`) take effect immediately without code rebuilds or git deployments.

### Verification Steps:
1. **Access Admin Portal**:
   - Navigate to `/login` and sign in with an account having `ADMIN` or `SUPER_ADMIN` privileges.
   - Go to `/admin/features`.
2. **Inspect Centralized Tool Flags**:
   - Verify tools have generic titles ("SGPA Calculator", "CGPA Calculator", "Marks Calculator", "Resume Builder").
   - Check aggregate metric cards at the top (Total Features, Enabled, In Beta, Maintenance, Pro Subscriptions).
3. **Toggle Monetization Tier**:
   - Locate **"Resume Builder"** or **"SGPA Calculator"**.
   - Change Access Mode from `FREE` to `SUBSCRIPTION`.
   - Observe toast notification and audit log generation.
   - Refresh the page or open another tab; verify the tool now reflects `PRO / SUBSCRIPTION`.
4. **Toggle Status**:
   - Change a tool's status to `DISABLED`.
   - Open Global Search (`Cmd+K` / `Ctrl+K`) or the Navbar MegaMenu: verify the tool is immediately hidden from active discovery.
   - Try navigating directly to `/tools/[slug]`: verify the polite "Temporarily Unavailable" administrative notice appears.
   - Set status back to `ENABLED`: verify the tool is immediately restored.

---

## 2. Canonical Tool Registry & Global Discovery

### Objective:
Verify that all navigation surfaces consume the single authoritative tool registry (`CANONICAL_TOOL_REGISTRY`).

### Verification Steps:
1. **Desktop Navbar Mega Menu**:
   - Hover over **"All Tools"**, **"PDF Tools"**, **"Image Tools"**, **"Student Suite"**, **"Academic"**, **"Career"**, and **"AI Tools"**.
   - Verify all 45+ tools are categorized accurately with valid internal links.
   - Verify PRO badges appear on subscription features.
2. **Mobile Accordions**:
   - Reduce browser width below 768px or inspect in mobile mode.
   - Open mobile menu (`☰`).
   - Expand the 6 category accordions (PDF Tools, Image Tools, Academic Calculators, Student Suite, Career Tools, AI & Pro).
   - Click a tool (e.g. Resume Builder) and confirm smooth navigation to `/student/resume`.
3. **Command & Global Search (`Cmd+K`)**:
   - Press `Cmd+K` or click the search input in the Navbar.
   - Type `"sgpa"`: Verify generic "SGPA Calculator" is suggested under Academic Tools.
   - Type `"resume"`: Verify "Resume Builder" is suggested under Career Tools.
   - Type `"merge"`: Verify "Merge PDF" is suggested under PDF Tools.
4. **Tool Catalog (`/tools`)**:
   - Navigate to `/tools`.
   - Verify all category filters ("PDF Tools", "Image Tools", "Student Suite", "Academic Suite", "Career Suite", "AI & Pro Modules") filter dynamically from canonical registry data.

---

## 3. Multi-University Academic Platform

### Objective:
Verify Super Admin can manage Universities, Schemes, Branches, Semesters (1..N), Subjects, and publish curriculum for dynamic student consumption.

### Verification Steps:
1. **Open Academic Control Center**:
   - Navigate to `/admin/curriculum`.
   - Confirm the 5 operational tabs:
     1. **Curriculum & Subjects**
     2. **Universities**
     3. **Schemes & Regulations**
     4. **Branches & Degrees**
     5. **Batch Import**
2. **Inspect Pre-Seeded University Data**:
   - Check the Universities tab: Visvesvaraya Technological University (`VTU`) is active and pre-seeded.
   - Check Schemes tab: VTU 2022 Scheme and VTU 2025 Scheme are active.
3. **Add a New Autonomous University**:
   - Click **"+ Add University"**.
   - Name: `BMS College of Engineering (Autonomous)`.
   - Code: `BMSCE`.
   - Status: `ACTIVE`.
   - Click **"Create University"**. Verify BMSCE appears in the table.
4. **Create a Scheme / Regulation**:
   - Switch to **"Schemes & Regulations"** tab.
   - Click **"+ Add Scheme"**.
   - University: Select `BMSCE`.
   - Scheme Name: `2024 Autonomous Curriculum`.
   - Year: `2024`.
   - Version: `1.0`.
   - Click **"Create Scheme"**. Verify it is scoped under BMSCE without impacting VTU schemes.
5. **Add Branch & Semester**:
   - Switch to **"Branches & Degrees"** tab.
   - Click **"+ Add Branch"**: Select BMSCE, 2024 Scheme, Name: `Computer Science & Engineering`, Code: `CSE`.
   - Add Semester: Add Semester `3` and Semester `4`.
6. **Add Subjects with Validation**:
   - Switch to **"Curriculum & Subjects"** tab.
   - Scope filters to: University: BMSCE, Scheme: 2024 Scheme, Branch: CSE, Semester: 3.
   - Click **"+ Add Subject"**.
   - Test Credit Validation: Enter `0` or negative credits. Click Save. Verify error: *"Credits must be greater than zero"*.
   - Enter valid subject: Code: `24CS301`, Name: `Data Structures & Algorithms`, Credits: `4`, Course Type: `Integrated (CIE+SEE)`.
   - Click Save. Verify subject appears with status `PUBLISHED`.
   - Try adding another subject with the same code `24CS301` in Semester 3. Verify duplicate code error is displayed.
7. **Batch Import (CSV / JSON)**:
   - Switch to **"Batch Import"** tab.
   - Select BMSCE, 2024 Scheme, CSE, Semester 4.
   - Select CSV format and paste:
     ```csv
     subjectCode,subjectName,credits,courseType,seeApplicable
     24CS401,Analysis of Algorithms,4,Theory,true
     24CS402,Operating Systems,3,Theory,true
     24CS403,Microcontrollers Lab,2,Practical,true
     ```
   - Click **"Execute Import"**. Verify: *"Successfully imported 3 subjects"*.
8. **Publish / Archive Workflow**:
   - Filter to BMSCE, 2024 Scheme, CSE, Semester 4.
   - Select subjects and change status from `DRAFT` to `PUBLISHED` or `ARCHIVED`.

---

## 4. Student Multi-University SGPA Calculator

### Objective:
Verify dynamic curriculum loading, deterministic calculation, and clean missing curriculum empty states.

### Verification Steps:
1. **Navigate to SGPA Calculator**:
   - Go to `/student/sgpa-calculator`.
2. **Test Multi-University Stepper**:
   - **University Selector**: Select `Visvesvaraya Technological University (VTU)`.
   - **Scheme Selector**: Select `2022 Scheme (NEP/CBCS)`.
   - **Branch Selector**: Select `Computer Science & Engineering (CSE)`.
   - **Semester Selector**: Select `Semester 3`.
   - Verify verified official curriculum loads with real courses (`BCS301`, `BCS302`, `BCS303`, etc.) and exact VTU credits.
3. **Test Missing Curriculum Empty State**:
   - Switch University to BMSCE and select Semester 8 (unpopulated).
   - Verify informational banner:
     *"Curriculum not available yet. The curriculum for BMS College of Engineering (2024 Scheme, CSE, Semester 8) has not been published yet."*
   - Verify action buttons:
     - **"Ask Admin to add curriculum"** (copies request details to clipboard).
     - **"Custom Subject Entry"** (allows manual course entry without blocking the student).
   - **Zero Fake Subjects**: Confirm that no synthetic or incorrect subjects are injected.
4. **Deterministic SGPA Calculation**:
   - Switch to VTU, 2022 Scheme, CSE, Semester 3.
   - Click **"Sample Marks"** or enter:
     - Course 1 (4 credits): 85 (Grade A+, Grade Point 9) -> 36 Credit Points
     - Course 2 (4 credits): 92 (Grade O, Grade Point 10) -> 40 Credit Points
   - Verify calculation: `SGPA = Total Credit Points / Total Credits`.
   - Switch mode toggle to **"Total Marks"** or **"CIE + SEE"**; verify live recalculation.
   - Click **"Save Semester SGPA"**: Confirm saved to local IndexedDB workspace.

---

## 5. Student Career Suite & Privacy Invariants

### Objective:
Verify guest and student workspace privacy (local IndexedDB) and placeholder correctness.

### Verification Steps:
1. **Cover Letter Builder**:
   - Navigate to `/student/cover-letter`.
   - Verify guest default applicant name is generic `"Your Name"` (no hardcoded mock names).
   - Fill in details and generate letter: verify clean markdown/PDF export.
2. **Resume Builder**:
   - Navigate to `/student/resume`.
   - Test the 5 ATS templates (Modern Clean, Executive Classic, Minimalist Tech, Creative Compact, Formal ATS).
   - Check Live Preview synchronization on edits.
   - Click **"Download PDF"**: verify print CSS rendering matches preview.
3. **Zero Cloud Leak Invariant**:
   - Open browser Developer Tools -> Application -> IndexedDB.
   - Confirm student marks, resume edits, and cover letters are stored in `saarvi_student_db`.
   - Confirm no confidential student resume text is transmitted to server endpoints.
