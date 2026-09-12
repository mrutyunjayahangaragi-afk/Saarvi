# DocEase Phase 23 — AI Student & Career Copilot Architecture

## 1. Executive Overview

The **DocEase AI Student & Career Copilot** (`/student/copilot` and `/student/copilot/interview`) delivers an intelligent, unified companion that bridges the Academic, Productivity, Career, and Document layers of the DocEase workspace.

Unlike generic LLM wrappers, the DocEase Copilot operates under an uncompromising design invariant:
> **The Deterministic Engine is the Single Source of Truth; AI is solely for explanation, synthesis, and planning assistance.**

All official academic metrics (VTU 2022/2025 SGPA, cumulative CGPA, attendance recovery percentages, and CIE/SEE marks boundaries) and career metrics (Set-based skill matching percentages) are computed by verified local engines. AI never recalculates, alters, or overrides these numbers.

---

## 2. High-Level Architecture Flow

```mermaid
graph TD
    UserQuery[User Query via UI] --> IntentRouter[Deterministic Intent Router]
    
    IntentRouter -->|ACADEMIC_RESULT or Direct Attendance| FastPath[Deterministic Fast Path]
    FastPath --> LocalEngines[Local Calculators & IndexedDB]
    LocalEngines --> FastResponse[Immediate Response with 'Calculated by DocEase' Badge]
    
    IntentRouter -->|Complex / Planning / Career| ContextEngine[Context Builder & Minimizer]
    ContextEngine --> ContextSlices[Active & Minimized Context Slices]
    ContextSlices --> PromptBuilder[Versioned Prompt Templates + Injection Defense]
    
    PromptBuilder --> ServerRoute[/api/copilot/chat with Rate Limit & SHA-256 Idempotency]
    ServerRoute --> AIProvider[AI Provider Abstraction: Gemini / OpenRouter / Mock]
    AIProvider --> SchemaValidator[Strict JSON Output Schema Validation]
    
    SchemaValidator --> CopilotResponse[Grounded Markdown + Structured Action Proposals]
    CopilotResponse --> ActionCard[Action Preview Cards in UI]
    
    ActionCard -->|User Clicks Confirm| ActionPlanner[Action Planner & Local Services Execution]
    ActionCard -->|User Clicks Dismiss| Dismissed[Action Dismissed: Zero State Change]
    
    CopilotResponse --> LocalMemory[IndexedDB Conversation Service]
```

---

## 3. Core Components

### 3.1 Deterministic Intent Router (`src/lib/ai/copilot/intent-router.ts`)
Queries are analyzed using zero-latency keyword patterns and regular expressions:
- `ACADEMIC_RESULT`: Direct numerical queries (*"What is my SGPA?"*, *"Show my CGPA"*)
- `ATTENDANCE`: Attendance status and shortage inquiries
- `EXAM`: Exam dates, CIE/SEE schedules
- `STUDY_PLANNING`: Study plans, day planning, session scheduling
- `TASK`: Assignments, tasks, homework deadlines
- `RESUME`: Resume formatting, ATS suggestions, summaries
- `INTERVIEW`: Mock questions, interview prep
- `APPLICATION`: Job applications, recruiter follow-ups
- `CAREER`: Missing skills, role targets
- `DOCUMENT`: Queries referencing attached document snippets
- `ACADEMIC_EXPLANATION`: VTU grading rules, credit systems
- `GENERAL`: General student productivity questions

### 3.2 Context Builder & Data Minimization (`src/lib/ai/copilot/context-builder.ts`)
Strict data minimization prevents sending the full workspace to the remote model:
- Retrieves **only** the active categories enabled by user toggles and required by the routed intent.
- Enforces hard record limits ($\le 5$ records per slice) and character bounds ($\le 10,000$ characters total).
- Never retrieves auth credentials, payment details, or unrelated private files.

### 3.3 Fast-Path Deterministic Resolution
Queries asking for verifiable facts are answered immediately on the client side using local IndexedDB data and deterministic calculators (`calculateSemesterSGPA`, `calculateCGPA`, `calculateAttendance`).
- Zero external API calls are made.
- Latency is $< 15$ ms.
- Displays the verified **"Calculated by DocEase"** emerald badge.

### 3.4 Versioned Prompt Templates & Injection Protection (`src/lib/ai/prompts/copilot-templates.ts`)
- `COPILOT_PROMPT_VERSION = "1.0"`
- User context and query are encapsulated in `<user_context_data>` and `<user_query>` tags.
- Tag closing attempts (`</user_context_data>`) are automatically sanitized.
- System prompt mandates treating all context as passive data, never executing embedded instructions, and truthfully responding *"I don't have enough information in your workspace to answer that"* if data is missing.

### 3.5 Action Planner & Confirmation Safety (`src/lib/ai/copilot/action-planner.ts`)
AI cannot directly mutate user data. When proposing study sessions, tasks, or reminders:
1. AI returns structured JSON proposals with `status: "suggested"`.
2. The UI renders interactive Action Preview Cards displaying all payload attributes (date, time, subject, duration).
3. Local services (`studentService`, `notificationService`) execute only when the user clicks **[Confirm & Save]**.
4. Time interval conflicts are detected locally before scheduling.

### 3.6 Local Conversation Memory (`src/lib/services/conversationService.ts`)
- Sessions are saved locally in IndexedDB (`DocEaseAcademicDB` store `conversations` and `conversationMessages`).
- Cross-profile isolation ensures Guest and authenticated profiles never share message history.
- The Copilot loads only the last 5 messages as context, ensuring a bounded token footprint.

### 3.7 Mock Interview Coach (`src/app/student/copilot/interview/page.tsx`)
- Interactive technical and behavioral interview practice grounded in the student's target role and recorded skills.
- Evaluates candidate answers with qualitative ratings (*"Strong"*, *"Needs improvement"*, *"Could be clearer"*), concise review notes, and actionable improvement tips.
