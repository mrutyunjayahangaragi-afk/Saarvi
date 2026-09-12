# Saarvi — Known Issues & Limitations Register
**Target Domain:** `https://saarvi.app`  
**Current Release Candidate:** `saarvi-v0.1.0-rc1`

This document tracks all recognized non-blocking limitations, transient edge-case behaviors, and pending external configurations. Each issue is maintained with an honest status, workaround, role-based owner, and target resolution milestone.

---

## Active Known Issues Matrix

| Issue ID | Title | Severity | Affected Component | Status | Workaround | Owner / Role | Target Release |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | **DNS Records Not Yet Pointed** | **BLOCKING (Deploy)** | Edge Domain Routing | `PENDING_OPERATOR` | Access via local environment / staging until DNS cutover | Domain Administrator | Production Cutover |
| **ISSUE-02** | **WhatsApp Reminder Channel Decoupled** | **SEV-3 (Low)** | Notifications Service | `UNCONFIGURED` | Automated notifications fallback transparently to Gmail SMTP | Backend Maintainer | Post-Launch v0.2.0 |
| **ISSUE-03** | **Autonomous Colleges Beyond VTU 2021/2022** | **SEV-3 (Low)** | Academic Engine | `BACKLOG` | Students enter custom subjects and credits manually | Academic Data Lead | Post-Launch v0.2.0 |
| **ISSUE-04** | **Safari IndexedDB 7-Day Storage Policy** | **SEV-3 (Low)** | Local Workspace Storage | `MONITORED` | Use "Export Workspace" JSON backup if not using Saarvi weekly | Client Architecture Lead | Documented in FAQ |
| **ISSUE-05** | **Large PDF Client Memory Pressure (> 100MB)** | **SEV-3 (Low)** | Client PDF WebAssembly | `MITIGATED` | UI enforces file size warning limit before loading ArrayBuffer | Document Tool Lead | Continuous Tuning |

---

## Detailed Descriptions & Mitigations

### ISSUE-01: DNS Records Not Yet Pointed
- **Details**: Apex domain `saarvi.app` does not currently resolve to a public IP address on the public internet (`dig +short saarvi.app` returns empty).
- **Impact**: External internet traffic cannot reach the production application until the domain registrar `A` and `CNAME` records are configured.
- **Resolution**: Domain registrar operator must add `A` records pointing to the hosting edge servers.

### ISSUE-02: WhatsApp Reminder Channel Decoupled
- **Details**: Meta WhatsApp Business Cloud API is an optional reminder channel and is currently unconfigured.
- **Impact**: Study and assignment reminders are delivered strictly via Gmail SMTP email.
- **Resolution**: The decoupled architecture ensures email delivery is 100% operational regardless of WhatsApp configuration.

### ISSUE-03: Autonomous Colleges Beyond VTU 2021/2022
- **Details**: Built-in subject syllabus indexes currently provide automated lookup for VTU 2021 and 2022 engineering schemes. Autonomous engineering institutions with custom course codes are not yet pre-indexed.
- **Workaround**: The Marks and SGPA calculators allow full manual course, credit, and grade entry without restriction.

### ISSUE-04: Safari IndexedDB 7-Day Storage Eviction Policy
- **Details**: Apple WebKit on iOS/macOS Safari applies a 7-day cap on client storage for sites that are not added to Home Screen or visited regularly.
- **Workaround**: Saarvi provides a one-click "Export Workspace" JSON backup feature in Settings. Users are guided in the Support Hub to back up data periodically.
