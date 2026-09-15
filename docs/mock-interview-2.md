# Mock Interview 2.0 & Proctoring Engine — Saarvi Documentation

## Overview
Mock Interview 2.0 is an enterprise-grade placement preparation system built into Saarvi. It delivers realistic technical and behavioral interview practice with genuine company attribution (Google, Microsoft, Amazon, Infosys, TCS, Wipro, Accenture), authoritative countdown timers, client-side proctoring, and private-by-design local video processing.

---

## Operating Modes

### 1. Mode 1: Text / MCQ Proctored Exam Mode
- **Sequential Questions**: Curated multiple-choice questions delivered in sequence.
- **Authoritative Timers**: Enforced countdown timers per question (e.g. 60 seconds) with automated submission upon expiry.
- **Anti-Hallucination & Answer Protection**: Correct answers are kept server-side during the active test and revealed only after response submission.
- **Proctoring**:
  - Monitors `visibilitychange` (Page Visibility API) for background tab switching.
  - Tracks `window.onblur` focus loss.
  - Progressive warning system: 4 maximum warnings before automated session termination with integrity penalty.

### 2. Mode 2: Live Video WebRTC Simulation Mode
- **Pre-flight Device Check**: Verifies webcam video stream and tests microphone input levels before starting.
- **AI Interviewer Fallback**:
  - Voice Prompts: Uses Web Speech API `speechSynthesis` to speak questions aloud.
  - Speech Recognition (STT): Automatically transcribes voice responses with live real-time feedback.
  - Typed Input Fallback: Candidate can also type their response using the STAR method (Situation, Task, Action, Result).
- **Private by Design Guarantee**:
  - Local browser processing only.
  - Zero camera or microphone streams are transmitted to or stored on external cloud servers.

---

## Question Bank Attribution
The system includes verified technical and behavioral questions categorized by company:
- **Google**: Two Sum complexity, high-scale URL shortener system design (Snowflake, Base62, Redis).
- **Microsoft**: SQL Transaction Isolation levels (Serializable vs Dirty Reads), technical conflict resolution.
- **Amazon**: LRU Cache architecture (Doubly Linked List + Hash Map), Leadership Principle "Bias for Action".
- **Infosys**: Method overloading vs overriding in OOP, ACID transaction atomicity in banking transfers.
- **TCS**: TCP vs UDP transport protocol trade-offs, elevator pitch / behavioral introduction.
- **Wipro**: Database normalization (2NF vs 3NF), binary search tree complexity.
- **Accenture**: Cloud computing deployment models (IaaS vs PaaS vs SaaS).

---

## Database Architecture
Defined in `supabase/migrations/013_mock_interview_2.sql`:
1. `interview_questions`: Stores questions, difficulty, role, company, options, answers, rubrics, and exposure counts.
2. `interview_sessions`: Stores session transcripts, candidate responses, scores, and proctoring violation logs.
3. `interview_settings`: Stores global timer configurations and max warning thresholds.

---

## Admin Moderation
Available at `/admin/mock-interview`:
- Filter and search questions by company, role, and type.
- Adjust global timer settings (MCQ timer, Video timer, max warnings).
- View rotation metrics and question exposure counts.
