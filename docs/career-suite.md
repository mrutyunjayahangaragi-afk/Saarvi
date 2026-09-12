# DocEase Career, Resume & Placement Application Suite (Phase 20)

## Overview
DocEase Phase 20 introduces a unified, strictly local-first **Career & Placement Suite** built specifically for engineering and college students. It connects academic records (VTU scheme, CGPA, branch), technical projects, hackathon achievements, certifications, and internships to targeted, ATS-friendly resumes and job/internship application tracking.

All career records remain strictly local in the user's browser via **IndexedDB** (`DocEaseAcademicDB` v3), guaranteeing complete privacy with zero automatic cloud sync to Supabase or third-party endpoints.

---

## 1. Unified Career Profile (`CareerProfile`)
The `CareerProfile` acts as the single source of truth for the student's professional identity:
- **Personal Details**: Full name, professional title, email, phone, location, LinkedIn URL, GitHub URL, portfolio URL.
- **Professional Summary**: Concise overview of background, technical domain, and career goals.
- **Core Entities**:
  - `skills`: Categorized into 10 domains (Programming Languages, Frontend, Backend, Database, Cloud, DevOps, AI/ML, Tools, Soft Skills, Other).
  - `education`: University, degree, branch, start/end dates, VTU scheme, current semester, CGPA.
  - `experience`: Company, role, location, start/end dates, current status, structured bullet points, type (`internship`, `full-time`, etc.).
  - `projects`: Title, role, technologies used, GitHub/live links, structured highlights.
  - `certifications`: Name, issuer, issue date, credential ID, verification URL.
  - `hackathons`: Title, organizer, dates, outcome (`Winner`, `Runner-up`, `Finalist`, `Participant`), project title, technologies.
  - `achievements`, `leadership`, `volunteering`, `languages`.

---

## 2. Multi-Version Resume Builder (`ResumeVersion`)
Students can maintain distinct, targeted resumes for different job types (e.g. "Software Engineer", "Frontend Developer", "Data Science", "Internship", "General") referencing the same underlying Career Profile:
- **Independent Configuration**:
  - `targetRole`: The focal role for the version.
  - `template`: Selected professional template (`classic-ats`, `modern-professional`, `executive`, `student-clean`, `minimal`).
  - `sectionOrder`: User-defined ordering of all 13 sections (Education first, or Experience first, etc.).
  - `enabledSections`: Section-by-section toggle control.
  - `preferOnePage`: Layout preference with automatic overflow warning.
  - Selective inclusion: Filter which projects, skills, or experiences appear on each resume version without retyping records.

---

## 3. Professional Templates
Five clean, recruiter-oriented templates are provided:
1. **Classic ATS**: Single-column, standard uppercase bold headings, clean horizontal divider lines, pure text layout for 100% text extractability by automated ATS systems.
2. **Modern Professional**: Refined royal blue accent headers (`#1e40af`), clear metadata hierarchy, subtle separators, and inline skill chips.
3. **Executive**: Deep navy accents, polished typography, prominent leadership and experience framing.
4. **Student Clean**: Prominently highlights education (with VTU branch, scheme, and CGPA) placed directly beneath the summary, followed by Technical Projects, Hackathons, and Skills.
5. **Minimal**: Maximum information density, condensed typography, zero decorative dividers or graphics.

---

## 4. ATS-Friendly Validation & Completeness Engine
The resume engine performs deterministic, rule-based validation checks before export:
- **Full Name Check**: Verifies candidate name exists for the resume header.
- **Valid Email & Phone**: Validates email format and reasonable phone digit length.
- **Education & Experience Requirements**: Checks that at least one credential or project/experience entry is present.
- **Key Skills Listed**: Verifies technical skills section is populated.
- **Profile URLs**: Ensures LinkedIn and GitHub links are formatted correctly.
- **Summary Length**: Flags summaries exceeding 600 characters to prevent recruiter fatigue.
- **Completeness Score**: Calculates a deterministic percentage (0 - 100%) based strictly on populated sections.

---

## 5. Client-Side Vector PDF Export & 3-Second Single Download
PDF export is generated purely client-side using `pdf-lib`:
- **Vector Typography**: Uses standard vector fonts (`Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`) for selectable, searchable text.
- **Automatic Page Breaking**: Computes text heights, wraps lines cleanly, and starts new pages when necessary while preventing orphan headers.
- **Deterministic Snapshots**: Automatically records a `ResumeSnapshot` metadata entry upon export so prior submissions can be reproduced.
- **Single Download Rule**: Processing triggers a 3-second countdown (`3... 2... 1...`) leading to exactly one automatic file download. Manual "Download Again" is available for intentional repeats.

---

## 6. Cover Letter Builder & Versions (`CoverLetterVersion`)
- **Version Types**: General, Company-Specific, Internship, Software Engineer, Frontend Developer, Custom.
- **Deterministic Draft Assistance**: Structured opening, body, and closing templates without using AI.
- **Vector PDF Generation**: Export to clean A4 letter formats (Classic, Modern, Minimal).
- **Local Persistence**: Stored in IndexedDB table `coverLetters`.

---

## 7. Job & Internship Application Tracker (`JobApplication`)
- **Pipeline Kanban & Table Views**:
  - Statuses: `SAVED`, `APPLIED`, `ONLINE_ASSESSMENT`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`.
- **Fields Tracked**: Company, role, application date, deadline, location, job URL, priority, notes, follow-up date, salary, source.
- **Document Linking**: Connects each application to the specific `resumeVersionId` and `coverLetterId` used.
- **Timeline Events**: Logs historical progression across hiring stages.

---

## 8. Interview Tracker & Smart Planning Reminders (`InterviewRecord`)
- **Interview Details**: Round name, date, time, interview type (`Online`, `Phone`, `Technical`, `HR`, `Managerial`, `Other`), meeting link, private notes, status.
- **Notification Integration**: Reuses Phase 19 Smart Planning Notifications (`notificationService`):
  - Free Email reminders by default.
  - Optional WhatsApp reminders.
  - Respects quiet hours, timezone (`Asia/Kolkata`), and duplicate-preventing idempotency keys.

---

## 9. Career Dashboard & Skill Gap Analysis
- **KPI Metrics**: Real counts of resumes, applications, active interviews, offers, skills, projects, certificates, and hackathons.
- **Deterministic Funnel**: Visualizes `Saved -> Applied -> Assessment -> Interview -> Offer`. Shows clean empty state if no applications exist.
- **Deterministic Insights**: Actionable notifications based on real data (approaching deadlines, scheduled interviews, follow-ups due).
- **Skill Gap View**: Compares student's skills against standard industry requirements for target roles (Frontend Developer, Software Engineer, Backend Developer, Data Scientist, DevOps Engineer, Mobile Developer) to display:
  - **Matched Skills**
  - **Recommended to Learn**
  - **Optional Strengths**
  - **Coverage Percentage**

---

## 10. Local-First Storage & Privacy Architecture
- **IndexedDB Schema (`DocEaseAcademicDB` v3)**:
  - `careerProfiles`
  - `resumeVersions`
  - `resumeSnapshots`
  - `coverLetters`
  - `jobApplications`
  - `interviews`
  - `careerSkills`
- **Zero Cloud Leakage**: No resume, cover letter, application, or private note is uploaded to Supabase, Razorpay, external AI, OCR, or analytics.
- **Export / Import**: Full Career Workspace export as JSON (and CSV for applications), with schema validation and clean reset capabilities.
