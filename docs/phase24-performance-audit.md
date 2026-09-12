# DocEase Phase 24 — Full Performance, Scalability & Reliability Audit

## 1. Executive Summary

This comprehensive audit evaluates the entire DocEase architecture across all 18 core subsystems. The audit assesses computational complexity, memory allocation patterns, concurrency hazards, bundle sizes, network footprints, and rendering efficiency.

Our primary goal: **Ensure DocEase is fast, memory-efficient, scalable, concurrency-safe, resilient, and observable without adding architectural complexity or modifying existing billing and deterministic business formulas.**

---

## 2. Subsystem-by-Subsystem Audit Findings

### 2.1 Document Engine & File Processors
- **Current Behavior**: PDF manipulations (merge, split, rotate, delete, compress) use `pdf-lib` in-browser. Images use `createImageBitmap` and `HTMLCanvasElement`.
- **Identified Bottlenecks**:
  - *Buffer Duplication*: Multi-step conversions sometimes copy an `ArrayBuffer` to `Uint8Array`, then to `Blob`, and finally to another buffer before embedding.
  - *Unbounded Batch Processing*: When users upload 20+ images in batch format converter or image-to-pdf, running all concurrently can exhaust browser heap on mobile devices (e.g. 2GB RAM budget).
- **Required Optimization**:
  - Implement a bounded adaptive concurrency queue (2–4 parallel tasks max depending on hardware capability).
  - Explicitly invoke `bitmap.close()` and revoke object URLs immediately after each file in a batch is completed.
  - Preserve the single-download invariant (3s countdown, exactly 1 automatic download).

### 2.2 VTU Curriculum & Academic Engine
- **Current Behavior**: 2022 and 2025 Scheme curriculum data comprises courses across multiple engineering branches (CSE, ISE, ECE, ME, CV, AIML).
- **Identified Bottlenecks**:
  - Components look up courses using array filters or basic keys.
  - Repeated serialization of static curriculum objects wastes CPU cycles.
- **Required Optimization**:
  - Implement a composite multi-level in-memory hash map index: `Map<scheme|branch|semester, CurriculumCourse[]>`.
  - Maintain $O(1)$ secondary reverse lookups by `scheme|courseCode` and `subjectId`.
  - Ensure shared immutable references so curriculum data is never duplicated in heap memory.

### 2.3 Academic Calculations (SGPA, CGPA, Attendance)
- **Current Behavior**: Pure functions in `src/lib/academic/engine/calculations.ts`.
- **Performance Evaluation**:
  - SGPA and CGPA operate in a single linear pass $O(N)$ where $N$ is course count ($\le 12$ per semester).
  - Attendance recovery is an analytical $O(1)$ algebraic calculation ($\lceil \frac{target \times total - 100 \times attended}{100 - target} \rceil$).
  - **Verdict**: Fully optimal. No algorithmic rewrite required. Ensure derived calculations in dashboards are memoized to avoid re-running on unrelated renders.

### 2.4 Student & Career Dashboards
- **Current Behavior**: Dashboards load tasks, exams, timetable, assignments, study sessions, applications, and interviews from IndexedDB.
- **Identified Bottlenecks**:
  - Multiple sibling components independently query IndexedDB stores, resulting in multiple concurrent transactions for the same data.
  - Unstable object references in parent states trigger re-renders of list components.
- **Required Optimization**:
  - Implement a unified data-loader/selector layer for local dashboard data with user/profile scoping.
  - Use `useMemo` for aggregated metrics (total hours, pending counts, upcoming deadlines).

### 2.5 IndexedDB Storage (`DocEaseAcademicDB`)
- **Current Behavior**: Managed in `src/lib/academic/storage/academic-db.ts` across 21 stores.
- **Identified Bottlenecks**:
  - **Critical Bottleneck Found in Conversation Messages**: `saveConversationMessage` re-queried ALL messages in a conversation (`getConversationMessages`) solely to update `conv.messageCount`! For conversations with 500 messages, adding 10 messages performed 5,000 read operations ($O(N^2)$).
  - **Un-indexed Scans**: Some queries filter by status or date in JavaScript rather than using IndexedDB indexes.
  - **Non-Atomic Workspace Import**: Import wrote stores sequentially without a single rollback transaction. A corrupt or malformed payload could leave the local database in a partially imported state.
- **Required Optimization**:
  - Fix message write: update `conv.messageCount = (conv.messageCount || 0) + 1` directly ($O(1)$).
  - Add message pagination with limit/offset cursor queries.
  - Implement atomic single-transaction workspace import with validation rollback.
  - Add storage quota detection via `navigator.storage.estimate()` with graceful user messaging.

### 2.6 Global Search
- **Current Behavior**: Inverted token index in `LightweightSearchIndex`.
- **Identified Bottlenecks**:
  - On every modal open, `GlobalSearchModal.tsx` re-queried all 8 IndexedDB stores and rebuilt the index from scratch.
- **Required Optimization**:
  - Cache the indexed data in-memory per profile.
  - When records change, perform selective incremental updates (`indexDocument`, `removeDocument`) instead of a full index wipe and reload.

### 2.7 Smart Planning Notifications
- **Current Behavior**: Background reminder scheduler in `src/lib/notifications/server-store.ts` and `scheduler-engine.ts`.
- **Identified Bottlenecks**:
  - **Linear Idempotency Scan**: `saveJobs` performed a linear `for...of` loop over all jobs in memory to check `idempotencyKey` ($O(N)$).
  - **Concurrency Hazard**: Two concurrent scheduler workers could process the same due job simultaneously because jobs remained in `SCHEDULED` until fully sent.
  - **Stuck-Job Hazard**: If a worker crashed while a job was in `PROCESSING`, the job remained stuck forever.
- **Required Optimization**:
  - Secondary index `idempotencyKeyMap: Map<string, string>` for $O(1)$ deduplication.
  - Atomic lease/claim mechanism with worker ID and timeout (`leaseExpiresAt`).
  - Automatic stuck-job recovery: reclaim jobs where `status === 'PROCESSING'` and `leaseExpiresAt <= nowMs`.
  - Distinguish permanent failures (invalid email syntax) from transient network failures so retries are not wasted.

### 2.8 AI / OCR & Copilot
- **Current Behavior**: Bounded context chunking and intent routing.
- **Identified Bottlenecks**:
  - Copilot context builder could query unnecessary categories if user intent was not isolated.
- **Optimization Already Implemented in Phase 23 & Validated**:
  - Intent router restricts context strictly to required categories.
  - Hard bounds enforced: $\le 5$ items per list, $\le 10,000$ characters.
  - SHA-256 idempotency cache prevents duplicate API calls on double clicks.
  - Deterministic fast paths resolve verified factual queries in $< 15$ ms with 0 remote calls.

### 2.9 Rate Limiting & Billing
- **Current Behavior**: Sliding window rate limiting in `src/lib/billing/rateLimit.ts` and Razorpay billing.
- **Performance Evaluation**:
  - In-memory rate limiting operates in $O(1)$ using timestamp records.
  - Billing logic and Razorpay webhooks remain 100% untouched.

---

## 3. Realistic Workload Model (Stress-Test Scenarios)

To ensure reliable performance under extreme conditions, we establish the following stress-test targets:

| Domain | Stress Workload Target | Justification |
| :--- | :--- | :--- |
| **Curriculum Records** | **50,000 courses** | Covers 10 VTU schemes, 50 engineering branches, 8 semesters, and elective permutations. |
| **Student Workspace** | **5,000 records** | Simulates a 4-year degree tracking daily classes, weekly tasks, and study sessions. |
| **Conversations** | **5,000 conversations / 50,000 messages** | Heavy multi-year conversational AI and Copilot interaction history. |
| **Career Workspace** | **1,000 applications / 500 interviews** | Extensive campus placement and off-campus recruitment tracking. |
| **Scheduled Reminders** | **10,000 reminder jobs** | Dense scheduling across exams, assignments, classes, and follow-ups. |
| **Document Processing** | **100 MB files / 25 batch files** | Heavy multi-page PDF documents and high-resolution camera scans. |
| **AI Context** | **50,000 characters** | Comprehensive textbook chapter or syllabus excerpt Q&A. |

---

## 4. Performance Budgets

| Operation | Performance Budget | Target Complexity |
| :--- | :--- | :--- |
| **Curriculum Lookup** | $< 1.0$ ms | $O(1)$ average hash map lookup |
| **Global Search (Typing)** | $< 16$ ms (60 FPS) | $O(\text{candidate tokens})$ inverted index |
| **SGPA/CGPA Calculation** | $< 2.0$ ms | $O(N)$ single pass linear scan |
| **Attendance Recovery** | $< 0.1$ ms | $O(1)$ closed-form algebraic calculation |
| **Conversation Message Save** | $< 5.0$ ms | $O(1)$ append + counter increment |
| **Notification Job Deduplication** | $< 0.1$ ms | $O(1)$ map lookup (was $O(N)$) |
| **Batch Concurrency Queue** | Bounded to 2–4 workers | Memory clamped to $\le 100$ MB peak heap |
| **Atomic Workspace Import** | All-or-nothing rollback | Single readwrite transaction |
