# DocEase Phase 19: Smart Planning Notifications & VTU 2025 Architecture

## Overview

DocEase Phase 19 introduces automated smart planning notifications for student workspace events (Study Sessions, Assignments, Exams, Coursework Tasks, Goals, Internships, and Hackathons) while preserving the platform's core local-first privacy architecture and incorporating the VTU 2025 CBCS/NEP Scheme (Semesters 1–8).

---

## 1. Free Email Reminders (Core Architecture)

- **Default & Free**: Email reminders are the **default FREE notification channel** for all registered DocEase users.
- **No Paywalls / Pro Gating**: Email reminders are **NOT** a Pro feature and are never placed behind Razorpay, subscriptions, or payment gates.
- **Provider Abstraction**: Dispatches via `NotificationEmailProvider` (Resend API or transactional SMTP). In local dev and testing environments without configured API credentials, truthful status (`NOT_CONFIGURED` or simulated delivery) is reported.
- **Fair Use & Quotas**: Does not claim "unlimited free emails"; provider-level rate limits and quotas are handled internally without charging students.

---

## 2. WhatsApp is Strictly Optional & Decoupled

- **Optional Channel**: WhatsApp is **OFF by default** and strictly optional.
- **Independent Reliability**:
  - Users can completely ignore WhatsApp and use Email only.
  - If WhatsApp is unconfigured, disabled, or encounters provider errors, **Email reminders continue to function normally**.
  - WhatsApp failure will **never** cause the overall reminder or student planning workspace to fail.
- **Official Meta Cloud API Only**:
  - Operates strictly with official Meta WhatsApp Cloud API credentials (`WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`).
  - **Zero browser automation, zero unofficial WhatsApp web scraping, zero QR logins**.
- **Transparent Status**: When unconfigured, the UI displays *"WhatsApp reminders are currently unavailable."*

---

## 3. Guest & Local-First Planning Flow

- **Non-Blocking Planning**: Guests can freely create, edit, and organize local events (Study Sessions, Assignments, Exams, Tasks, Goals, etc.).
- **Registration Requirement for External Dispatch**: Because external email/WhatsApp delivery requires a verified recipient endpoint, guests who toggle reminders see an informative message:
  > *"Your plan is saved locally. Create a free DocEase account to receive email reminders. WhatsApp reminders are optional."*
- **No Data Loss**: The local event is **never** deleted or rejected simply because the user is not logged in.
- **No Payment Prompts**: Guests are never asked to pay for reminders.

---

## 4. Server-Side Scheduler & Reliability

- **No Browser Dependency**: Operates independently of the user's browser tab remaining open.
- **Idempotency Guarantee**: Every notification occurrence computes a deterministic key:
  $$\text{IdempotencyKey} = \text{eventId} + \text{"\_"} + \text{channel} + \text{"\_"} + \text{targetTimestamp}$$
  Preventing duplicate dispatches during retries.
- **Failure Retries**: Failed dispatches are retried up to 3 times with exponential backoff before being marked `FAILED`.
- **Truthful Status Lifecycle**:
  - `SCHEDULED`: Job queued for future execution.
  - `PROCESSING`: Job currently being dispatched.
  - `SENT`: Accepted and confirmed by provider.
  - `FAILED`: Exhausted maximum retry attempts (3).
  - `CANCELLED`: Event deleted or rescheduled before delivery.
  - `NOT_CONFIGURED`: Provider credentials not set up.
  - `AWAITING_VERIFICATION`: Recipient address/phone requires verification.
- **Quiet Hours & Timezone Awareness**: Configurable quiet hours (e.g. 10:00 PM – 7:00 AM) defer reminder execution until the quiet window concludes.

---

## 5. Strict Privacy & Data Minimization Invariant

External notification payloads receive **only** the minimum necessary reminder fields:
- `eventId`
- `eventType` (e.g. `Study Session`, `Exam`, `Assignment`, `Task`)
- `eventTitle` (e.g. `Data Structures`)
- `scheduledDate` (e.g. `2026-09-15`)
- `scheduledTime` (e.g. `19:00`)
- `timezone` (e.g. `Asia/Kolkata`)
- `recipient` (email or phone number)

### Data Never Transmitted Over External Notification Channels:
- Private study notes / goals text
- Academic marks, internal scores (CIE/SEE)
- SGPA / CGPA values
- Attendance statistics
- Document files, PDFs, images, resumes

---

## 6. Administrative Operations

Located at `/admin/notifications`:
- **Provider Status**: Real-time operational check for Email and WhatsApp dispatchers.
- **Aggregate Metrics**: Total scheduled, delivered (Email vs. WhatsApp breakdown), pending, and failure counts.
- **Zero Student Access**: Administrators cannot view student private notes, grades, or assignment contents.

---

## 7. VTU 2025 Scheme Coexistence & Isolation

- **Official Coverage**: Full CBCS/NEP curriculum for Semesters 1 through 8 across `CSE`, `ISE`, `AIML`, and `ECE`.
- **Strict Isolation**: 2022 Scheme and 2025 Scheme courses reside under unique composite keys (`scheme|branch|semester`) in `CurriculumIndex`. Querying the 2022 scheme will never return 2025 courses, and vice-versa.
- **Assessment Patterns**: Verified against official VTU standard 50:50 CIE/SEE and 100-CIE evaluation rules.
