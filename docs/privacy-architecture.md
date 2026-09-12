# DocEase Privacy Architecture & Local-First Security Specification

**Phase 21 Privacy Invariants, Storage Isolation & Local-First Memory**  
*DocEase Platform Architecture Document*

---

## 1. Core Privacy Invariants

DocEase operates on an uncompromising **Local-First Privacy Architecture**:
1. **Zero Cloud Sync for User Intelligence**: Conversation histories, personal notes, student marks, study timetables, job applications, interview logs, and resume drafts are **never transmitted to external cloud servers, AI providers, analytics platforms, or third-party APIs**.
2. **Zero Telemetry on Private Content**: File contents, chat messages, resume bullet points, and attendance records stay inside the user's browser runtime.
3. **No AI Scraping / Model Training**: Zero user documents or conversation messages are used to train machine learning models.
4. **Offline Resilience**: The platform functions seamlessly offline or on restricted campus networks; IndexedDB powers the persistence layer locally.

---

## 2. IndexedDB Schema Evolution (Version 4)

All academic, career, productivity, and conversational state is persisted in client-side IndexedDB under the database name `DocEaseAcademicDB`.

### Active Stores in Version 4:
| Object Store | Version Introduced | Key Path | Indices Configured | Data Contained |
|:---|:---:|:---|:---|:---|
| `studentProfiles` | v1 | `id` | None | Student USN, Scheme, Branch |
| `semesterRecords` | v1 | `id` | `profileId`, `semester` | SGPA, CIE, SEE marks |
| `attendanceRecords` | v1 | `id` | `profileId` | Subject classes & attendance |
| `academicGoals` | v1 | `id` | `profileId` | Target CGPA & study hours |
| `calculationHistory` | v1 | `id` | `timestamp` | Calculator audit trails |
| `tasks` | v2 | `id` | `profileId` | Academic & personal tasks |
| `assignments` | v2 | `id` | `profileId` | Coursework deadlines |
| `exams` | v2 | `id` | `profileId` | Internal & SEE exam schedules |
| `timetable` | v2 | `id` | `profileId` | Weekly period schedule |
| `studySessions` | v2 | `id` | `profileId` | Planned study blocks |
| `studentGoals` | v2 | `id` | `profileId` | Long-term student targets |
| `certificates` | v2 | `id` | None | Academic certifications |
| `internships` | v2 | `id` | None | Internship tracking |
| `hackathons` | v2 | `id` | None | Hackathon submissions |
| `careerProfiles` | v3 | `id` | None | Master resume profile |
| `resumeVersions` | v3 | `id` | `targetRole` | Role-specific resume versions |
| `resumeSnapshots` | v3 | `id` | `resumeVersionId` | Versioned historical snapshots |
| `coverLetters` | v3 | `id` | None | Cover letter drafts |
| `jobApplications` | v3 | `id` | `status`, `deadline` | Job application pipeline |
| `interviews` | v3 | `id` | `applicationId`, `date` | Interview prep & schedules |
| `careerSkills` | v3 | `id` | `category` | Verified technical skills |
| **`conversations`** | **v4** | `id` | `profileId`, `updatedAt`, `pinned`, `archived` | Chat sessions & workspace memory |
| **`conversationMessages`** | **v4** | `id` | `conversationId`, `createdAt` | Threaded user & assistant messages |

---

## 3. Profile Scoping & Multi-User Isolation

To prevent accidental data leakage on shared computers (e.g. library terminals, campus labs, shared laptops):

1. **Profile-Scoped Queries**: All retrieval methods (`getAllConversations`, `getTasks`, `getAssignments`, etc.) enforce strict filtering by `profileId`.
2. **Account Boundary Guarantee**: Account A (`profileId: "usr_alice"`) cannot read, index, or search Account B (`profileId: "usr_bob"`) conversations or records.
3. **Guest Session Isolation**: Unauthenticated users operate in a sandboxed `"guest"` profile. Guest records are completely isolated and can be selectively migrated upon authentication via `migrateGuestConversations("guest", newUserId)`.

---

## 4. Search Privacy & Local Inverted Indexing

The `GlobalSearchModal` and `LightweightSearchIndex`:
- Build inverted token maps (`Map<string, Set<string>>`) entirely in client memory.
- Search queries are evaluated locally using set intersections.
- Zero search keystrokes or query tokens are dispatched over network sockets.
- Search history (up to 8 items) is stored in the user's browser `localStorage` and can be wiped instantly with the "Clear" button.

---

## 5. Export & Import Integrity

- **Export**: Users can export their entire conversation memory to standard JSON (`schemaVersion: "1.0"`) or Markdown (`.md`).
- **Import**: Imported payloads are strictly validated against schema version constraints. Corrupt, tampered, or mismatched schemas are rejected before mutation.
- **Portability**: Users retain 100% data ownership with zero platform lock-in.
