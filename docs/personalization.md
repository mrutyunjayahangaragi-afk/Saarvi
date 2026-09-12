# DocEase Intelligent Personalization Engine

**Architecture, Mathematical Priority Scoring & Deterministic Rule Specification**  
*DocEase Phase 21 — Intelligent Personalization & Student Recommendation System*

---

## 1. Principles & Design Objectives

1. **Deterministic, Rules-Driven Intelligence**: Zero non-deterministic AI models, zero heuristic guessing, and zero hallucinations. Recommendations are generated from explicit rules with verified logical constraints.
2. **Transparent & Explainable**: Every recommendation carries an explicit `reason` and calculable `score`. Students understand why an alert appeared (e.g. "Attendance is 68%, below the university 75% threshold").
3. **100% Local-First Privacy**: Personalization runs exclusively inside the user's browser using data from IndexedDB (`DocEaseAcademicDB` v4). Zero student profile, marks, or timetable records are transmitted to cloud endpoints.
4. **Action-Oriented**: Every recommendation provides a direct action route (`actionRoute`) and button (`actionLabel`) to resolve the underlying condition in one click.

---

## 2. Priority Scoring Formula

Recommendations are assigned a priority score between `0` and `100` based on baseline urgency, temporal proximity, and academic risk:

$$\text{PriorityScore} = \min\Big(100, \max\big(0, \text{BaseScore}(\text{priority}) + \text{UrgencyBoost} + \text{SeverityBoost}\big)\Big)$$

### Base Priority Weights
- `critical`: **95** (Immediate academic or interview risk, e.g. Attendance < 75% with upcoming exam)
- `high`: **80** (Action required within 24–48 hours, e.g. Overdue assignments, interview in 48h)
- `medium`: **50** (Timely proactive actions, e.g. Exam in 3–7 days, application follow-up)
- `low`: **20** (Profile polish, timetable study gap windows, resume summary additions)

### Dynamic Modifiers
| Condition | Urgency Boost | Severity Boost |
|:---|:---:|:---:|
| Due / Scheduled today ($\le 24$h) | $+15$ | $+10$ |
| Due / Scheduled within 48h | $+10$ | $+5$ |
| Attendance below 75% (Critical Exam Bar) | $+5$ | $+10$ |
| Compound Risk (Exam in $\le 14$d AND Attendance $< 75\%$) | Fixed Score: **98** | |

---

## 3. Supported Rule Generators

### 3.1 Academic Domain
1. **Critical Low Attendance (`LOW_ATTENDANCE_CRITICAL`)**:
   - Condition: Subject attendance percentage $< 75\%$.
   - Calculation: Consecutive classes needed to reach 75%:
     $$\text{ClassesNeeded} = \max\left(0, \left\lceil \frac{0.75 \times \text{Total} - \text{Attended}}{0.25} \right\rceil\right)$$
   - Action: Redirect to `/student/attendance`.
2. **Attendance Warning (`LOW_ATTENDANCE_WARNING`)**:
   - Condition: Attendance between $75\%$ and $85\%$.
   - Action: Redirect to `/student/attendance` to view safe skip margins.
3. **Upcoming Exam (`UPCOMING_EXAM`)**:
   - Condition: Exam date within 7 days.
   - Priority: `high` if $\le 2$ days, `medium` if $3–7$ days.
   - Action: Redirect to `/student/exams`.

### 3.2 Productivity Domain
1. **Overdue Coursework (`OVERDUE_ASSIGNMENTS`)**:
   - Condition: Unsubmitted assignments with `dueDate < now`.
   - Action: Redirect to `/student/assignments`.
2. **Clustered Deadlines (`CLUSTERED_DEADLINES`)**:
   - Condition: $\ge 2$ concurrent assignments or exams due within 48 hours.
   - Action: Redirect to `/student/calendar`.
3. **Timetable Study Gap (`TIMETABLE_GAP`)**:
   - Condition: $\ge 60$ minute window between adjacent classes on the current day.
   - Action: Redirect to `/student/study-planner`.

### 3.3 Career Domain
1. **Upcoming Interview (`UPCOMING_INTERVIEW`)**:
   - Condition: Scheduled interview date within 72 hours.
   - Action: Redirect to `/career/interviews`.
2. **Application Follow-Up (`APPLICATION_FOLLOWUP`)**:
   - Condition: Job application submitted $\ge 7$ days ago without a status update.
   - Action: Redirect to `/career/tracker`.
3. **Missing Resume Summary (`RESUME_SUMMARY_MISSING`)**:
   - Condition: Active resume has an empty summary field.
   - Action: Redirect to `/career/resumes/:id`.

### 3.4 Cross-Domain Compound Rules
1. **Exam + Low Attendance Compound Risk (`EXAM_LOW_ATTENDANCE_RISK`)**:
   - Condition: Exam scheduled within 14 days for a subject where attendance is currently $< 75\%$.
   - Priority: Score **98** (`critical`).
   - Action: Alerts student to clear attendance deficit before hall ticket issuance.
2. **Completed Hackathon Missing on Resume (`ADD_HACKATHON_TO_RESUME`)**:
   - Condition: User participated in or won a hackathon recorded in `/student/hackathons`, but the hackathon name is missing on their active resume.
   - Action: Prompts student to update active resume.

---

## 4. Deduplication & User Dismissal

- **Deduplication Key**: Stable string constructed as `${category}:${entityId}:${ruleType}` (e.g. `academic:att_math101:LOW_ATTENDANCE`).
- When multiple candidate alerts match the same entity, the engine retains only the alert with the highest priority score.
- **User Dismissal**: When a student clicks the "Dismiss" button on a recommendation card, its key is recorded in `localStorage.getItem("docease_dismissed_recommendations")`. Dismissed keys are filtered out of subsequent recommendation evaluations until cleared by the user.

---

## 5. Smart Daily Plan Generation

The engine provides `generateSmartDailyPlan(context, targetDate?)` which synthesizes a unified daily itinerary:
- **Classes Today**: Extracted and chronologically sorted from `TimetableEntry` for the current weekday.
- **Study Sessions**: Extracted from planned `StudySession` items for today's date.
- **Tasks**: Non-completed tasks with high priority or due today.
- **Deadlines**: Assignments and exams due within the next 48 hours with human-readable countdowns ("Due today", "In 18h", "In 2 days").
- **Commitment Hours**: Sum of scheduled class durations and study sessions.
- **Truthful Schedule Summary**: E.g. *"Today's schedule: 3 classes, 1 study session, 2 deadlines, 1 pending task."*
