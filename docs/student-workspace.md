# DocEase Student Productivity & Planning Ecosystem (Phase 18)

## 1. Overview & Architectural Principles

The DocEase Student Productivity Ecosystem connects curriculum intelligence (VTU 2022 Scheme CBCS / NEP) with daily student workflows:
- Semester course marks & SGPA/CGPA tracking
- Subject-level attendance tracking and safe bunk / needed classes planning
- Weekly class timetable with $O(N \log N)$ interval overlap conflict detection
- Real student task manager with priority tiers and status workflows
- Coursework and assignment tracker with dynamic overdue calculation
- Exam planner with configurable assessment types (Internal, SEE, Lab, Practical, Quiz) and dynamic countdowns
- Study session planner with cross-activity conflict detection and study hours analytics
- Semester and personal growth goals with manual progress sliders (0–100%)
- Unified Deadline Center aggregating deadlines across 6 entity types
- Career pipelines: zero-upload certificate vault, internship pipeline, and hackathon tracker
- In-browser JSON workspace backup and schema-validated restore

### Strict Local-First Privacy Model
```
┌────────────────────────────────────────────────────────────────────────┐
│                        Student User Interface                          │
│   • Unified Workspace (/student/dashboard)                             │
│   • Timetable (/student/timetable)                                     │
│   • Assignments (/student/assignment-planner)                          │
│   • Exams (/student/exams)                                             │
│   • Study Sessions (/student/study-planner)                            │
│   • Tasks (/student/tasks)                                             │
│   • Goals (/student/goals)                                             │
│   • Attendance (/student/attendance)                                   │
│   • Career Trackers (/student/internships, /hackathons, /certificates) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
  ┌─────────────────────────────────┐   ┌────────────────────────────────┐
  │      Domain Algorithms Layer    │   │       Service Abstraction      │
  │ • Deadline Engine (Dynamic)     │   │ • studentService               │
  │ • Conflict Detector (O(N log N))│   │   - 100% Client-Side           │
  │ • Prioritization & Sorting      │   │   - Zero Network Requests      │
  │ • Study Hours Analytics         │   │   - Pure Web API Interfacing   │
  │ • Attendance Formula Engine     │   └────────────────┬───────────────┘
  └─────────────────────────────────┘                    │
                                                         │
                                   ┌─────────────────────┘
                                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                 Local Storage (Browser IndexedDB v2)                 │
  │  Stores: profiles, semesters, attendance, goals, history, tasks,     │
  │  assignments, exams, timetable, studySessions, certificates,         │
  │  internships, hackathons                                             │
  │                                                                      │
  │  • Fallback: Memory cache + LocalStorage                             │
  │  • Backup & Restore: Version 2.0 JSON format                         │
  │  • ZERO student records transmitted to Supabase or remote analytics  │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## 2. IndexedDB Schema Design (`DocEaseAcademicDB` v2)

The client database maintains 13 object stores:

| Store Name | Primary Key | Indexes | Stored Entity |
| :--- | :--- | :--- | :--- |
| `studentProfiles` | `id` | — | University, Scheme, Branch, Current Semester |
| `semesterRecords` | `id` | `profileId`, `semester` | Course results, SGPA, earned credits |
| `attendanceRecords` | `id` | `profileId` | Subject attendance, total held, attended |
| `academicGoals` | `id` | `profileId` | Academic CGPA milestones |
| `calculationHistory`| `id` | `timestamp` | Historical calculation snapshots |
| `tasks` | `id` | `profileId` | Student task items (TODO, IN_PROGRESS, COMPLETED) |
| `assignments` | `id` | `profileId` | Coursework assignments with due dates & hours |
| `exams` | `id` | `profileId` | Midterms, finals, lab practicals with times |
| `timetable` | `id` | `profileId` | Weekly class slots with day, room, instructor |
| `studySessions` | `id` | `profileId` | Planned revisions, durations, topics |
| `studentGoals` | `id` | `profileId` | Goals across Academic, Coding, Career, Fitness |
| `certificates` | `id` | — | Verified credentials, issuers, verification URLs |
| `internships` | `id` | — | Applications, roles, deadlines, pipeline stages |
| `hackathons` | `id` | — | Hackathon registrations, teams, prizes |

---

## 3. Data Models & Type Specifications

### Task Item
```typescript
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type TaskItemStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface TaskItem {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subjectId?: string;
  title: string;
  description?: string;
  category?: string;
  priority: TaskPriority;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  status: TaskItemStatus;
  createdAt: string;
  updatedAt: string;
}
```

### Assignment
```typescript
export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "completed";

export interface Assignment {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subjectId?: string;
  title: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  priority: "low" | "medium" | "high";
  description?: string;
  status: AssignmentStatus;
  estimatedHours?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Exam Record
```typescript
export type ExamType = "Internal" | "SEE" | "Lab" | "Practical" | "Quiz" | "Other";

export interface ExamRecord {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subject: string;
  subjectId?: string;
  examType: ExamType | string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Timetable Entry
```typescript
export interface TimetableEntry {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subjectId?: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  subject: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  room?: string;
  teacher?: string;
  type?: string;
  notes?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### Study Session
```typescript
export type StudySessionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface StudySession {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subject: string;
  subjectId?: string;
  topic: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime?: string;
  durationMinutes: number;
  priority: "low" | "medium" | "high";
  notes?: string;
  status: StudySessionStatus;
  createdAt: string;
  updatedAt: string;
}
```

### Student Goal
```typescript
export type GoalCategory = "Academic" | "Coding" | "Projects" | "Career" | "Fitness" | "Personal";
export type GoalStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED";

export interface StudentGoal {
  id: string;
  userId?: string;
  profileId?: string;
  title: string;
  category: GoalCategory;
  targetDate: string; // YYYY-MM-DD
  progress: number; // 0 - 100
  status: GoalStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Key Algorithms & Mathematical Formulations

### Dynamic Countdown & Urgency Classification
Target dates are dynamically compared to current local midnight:
$$\Delta d = \text{round}\left(\frac{T_{\text{target}} - T_{\text{today}}}{86400000}\right)$$
Urgency Tiers:
- **Overdue**: $\Delta d < 0$
- **Today**: $\Delta d = 0$
- **Tomorrow**: $\Delta d = 1$
- **This Week**: $2 \le \Delta d \le 7$
- **Later**: $\Delta d > 7$

### Interval-Overlap Conflict Detection
Intervals on identical days/dates are evaluated using standard sweep-line logic:
$$\text{Overlap} = \max(\text{Start}_A, \text{Start}_B) < \min(\text{End}_A, \text{End}_B)$$
Applied to:
1. Class vs Class on identical weekdays.
2. Study Session vs Study Session on identical calendar dates.
3. Cross-activity clashes: Study Session vs Class (when calendar date resolves to class weekday).

### Attendance Health & Safe Margin
For attendance target $R$ (e.g. 75% or 85%):
- **Current Percentage**: $P = \frac{A}{T} \times 100$
- **Safe Bunkable Classes** ($P \ge R$):
  $$B = \left\lfloor \frac{100A - RT}{R} \right\rfloor$$
- **Classes Needed to Reach Target** ($P < R$):
  $$N = \left\lceil \frac{RT - 100A}{100 - R} \right\rceil$$

### Study Hours Analytics
Completed study hours for period $[T_{\text{start}}, T_{\text{end}}]$ are summed only from verified sessions where $\text{status} = \text{"COMPLETED"}$:
$$\text{Hours} = \frac{\sum_{i \in \text{Completed}} \text{durationMinutes}_i}{60}$$

---

## 5. Workspace Backup & Restore Format (v2.0)

Export payloads are serialized to `.json` files:
```json
{
  "version": "2.0",
  "exportedAt": "2026-09-12T15:00:00.000Z",
  "application": "DocEase",
  "profile": { ... },
  "semesters": [ ... ],
  "attendance": [ ... ],
  "tasks": [ ... ],
  "assignments": [ ... ],
  "exams": [ ... ],
  "timetable": [ ... ],
  "studySessions": [ ... ],
  "goals": [ ... ],
  "certificates": [ ... ],
  "internships": [ ... ],
  "hackathons": [ ... ]
}
```
Validation rules:
- Requires `"application": "DocEase"`.
- Rejects non-object root payloads.
- Validates marks $\ge 0$, percentages $0-100$, and valid date strings.
- Gracefully handles backward-compatible Phase 17 `"1.0"` academic backups.

---

## 6. Privacy & Security Invariant

1. **Client Isolation**: All student productivity records are stored solely in the user's browser IndexedDB.
2. **Zero Remote Sync**: No HTTP requests are dispatched to Supabase or third-party servers containing private marks, tasks, notes, or schedules.
3. **Admin Isolation**: Admin users cannot query or access private student workspaces.
