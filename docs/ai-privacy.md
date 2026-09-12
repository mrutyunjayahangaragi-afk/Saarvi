# DocEase AI & OCR Privacy Architecture Policy

## 1. Privacy Principles
DocEase operates under a strict **Local-First Privacy Architecture**:
1. **Local by Default**: Any operation technically capable of running locally in the client browser MUST execute locally with zero external network transmission.
2. **Explicit Consent for External Processing**: Features requiring external cloud intelligence (OCR and AI document operations) trigger a clear, accessible consent modal requiring the user to intentionally select **Continue**.
3. **Strict Data Minimization**: Only the minimal excerpt or preprocessed image necessary for the requested feature is transmitted.

---

## 2. Processing Boundary Classification

| Operation | Category | Processing Destination | Consent Required? |
| :--- | :--- | :--- | :--- |
| JPG to PDF, PNG to JPG | Image Transformation | **100% Local Browser** (WASM/Canvas) | No |
| Merge PDF, Split PDF, Compress PDF | PDF Document Processing | **100% Local Browser** (pdf-lib) | No |
| SGPA, CGPA, Attendance Calculations | VTU Academic Engine | **100% Local Client** (Deterministic) | No |
| Image to Text (OCR) | Document Intelligence | External OCR Provider | **Yes (Mandatory)** |
| Scanned PDF to Text (OCR) | Document Intelligence | External OCR Provider | **Yes (Mandatory)** |
| Document Summarizer | AI Assistant | External AI Provider | **Yes (Mandatory)** |
| Ask This Document (Q&A) | AI Assistant | External AI Provider (Selected chunks only) | **Yes (Mandatory)** |
| AI Resume Review | Career AI | External AI Provider (Resume text only) | **Yes (Mandatory)** |
| Job Description Skill Matcher | Career AI | External AI Provider (JD text only) | **Yes (Mandatory)** |

---

## 3. What Data Is Sent (and When)

- **Document Summarization**: Only the document text explicitly pasted or uploaded by the user is sent when the user clicks "Summarize Document".
- **Document Q&A**: Only the user's specific question and the bounded top-K relevant text chunks ($K \le 5$) are transmitted to the provider.
- **Resume Feedback**: Only the candidate's summary, skills, and target role are submitted.
- **OCR Operations**: Only the selected document image or chosen page range is sent when the user triggers OCR.

---

## 4. What Is NEVER Sent

Under no circumstances do DocEase AI/OCR requests transmit:
- Entire user workspace records or files
- Payment, card, or Razorpay subscription details
- Authentication passwords, tokens, or session secrets
- Unrelated academic course, marks, or attendance history
- Browser browsing history or local device telemetry
- Unselected files from the user's desktop or file system

---

## 5. Consent Storage & Ephemeral Lifecycle

- **Consent Storage**: Minimal metadata is stored locally in the user's browser localStorage under key `docease_ai_consent`:
  ```json
  {
    "aiProcessingConsent": true,
    "consentVersion": "1.0",
    "consentTimestamp": "2026-09-12T17:00:00.000Z"
  }
  ```
  No document text, queries, or private content are stored in consent metadata.
- **Server Ephemerality**: Server-side API routes never permanently save user document content to databases. Processing buffers exist ephemerally during the request lifecycle and are cleared upon completion.
