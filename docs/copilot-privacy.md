# DocEase Copilot Privacy & Data Governance Architecture

## 1. Core Principles

DocEase is engineered from the ground up as a **Local-First Privacy Architecture**. AI assistance is strictly opt-in and supplementary. The Copilot strictly adheres to five core privacy guarantees:

1. **Explicit Category Consent**: Context is never gathered globally. Only the categories toggled **ON** by the student (`Academic`, `Productivity`, `Career`, `Document`, `Memory`) are inspected.
2. **Intent-Grounded Minimization**: Even among enabled categories, only the minimal slice required by the specific intent is retrieved (e.g. an exam question accesses only academic records, not career applications).
3. **Strict Bounds**: Record counts are clamped ($\le 5$ items per list) and character volume is capped ($\le 10,000$ characters).
4. **Zero Cloud Syncing**: IndexedDB remains the authoritative primary database. Workspace files and databases are never synced to remote clouds.
5. **Zero Server Retention / Zero Model Training**: Data sent to `/api/copilot/chat` is processed ephemerally solely for generating the immediate inference response. It is never logged in full, never persisted on servers, and never used to train third-party AI models.

---

## 2. Permitted vs. Forbidden Context

| Context Element | Status | Justification & Safeguards |
| :--- | :--- | :--- |
| **Academic Marks & SGPA** | Permitted (Opt-in) | Verified VTU marks needed to explain grading bands and credit requirements. |
| **Attendance Summaries** | Permitted (Opt-in) | Needed to recommend recovery classes when attendance drops below 75%. |
| **Timetable & Daily Classes** | Permitted (Opt-in) | Needed to find open study windows without class conflicts. |
| **Career Skills & Target Role** | Permitted (Opt-in) | Needed to identify missing skills and tailor interview practice. |
| **Document Snippet** | Permitted (Opt-in) | Explicitly provided text from notes or syllabus for Q&A. |
| **User Passwords & Hashes** | **STRICTLY FORBIDDEN** | Never loaded into context builder under any condition. |
| **Razorpay / Billing Secrets** | **STRICTLY FORBIDDEN** | Stored strictly server-side in secure environment variables; zero client exposure. |
| **Payment History / Subscriptions** | **STRICTLY FORBIDDEN** | Billing logic is completely decoupled from AI context engines. |
| **Private Files Outside Workspace** | **STRICTLY FORBIDDEN** | Client cannot access filesystem beyond user-selected inputs. |
| **Other Profiles' Data** | **STRICTLY FORBIDDEN** | IndexedDB queries are hard-scoped to the active `profileId` (guest vs authenticated user). |

---

## 3. Safe Audit Logging Standard

To ensure debugging capability without violating student confidentiality, the Copilot audit logging system (`src/lib/ai/audit.ts`) records only non-identifying telemetry:

```typescript
{
  "requestId": "cpl_1726143000000_abc12",
  "feature": "copilot-chat",
  "provider": "GeminiAIProvider",
  "timestamp": "2026-09-12T12:00:00.000Z",
  "durationMs": 342,
  "status": "success"
}
```

- **Query text is never logged.**
- **Response markdown is never logged.**
- **Student names, USNs, and marks are never logged.**
- **SHA-256 idempotency hashes** store only cryptographic digests of queries for 15-minute sliding deduplication.

---

## 4. User Controls

Students retain full control over their data in the `/student/copilot` interface:
- **Interactive Context Pills**: Toggle Academic, Productivity, Career, Document, or Conversation Memory on/off in real-time.
- **New Chat**: Instantly wipes the active UI thread and spins up an isolated conversation session.
- **Document Clear**: Clears ephemeral attached snippets with one click.
- **Zero Lock-In**: Complete workspace export available anytime via Settings.
