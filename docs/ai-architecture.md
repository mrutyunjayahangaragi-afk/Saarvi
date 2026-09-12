# DocEase AI & OCR Architecture Documentation

## 1. Executive Summary
Phase 22 introduces a production-ready, privacy-respecting **AI + OCR Intelligent Document Layer** to DocEase. The system is designed around the core tenet:
> **AI is an optional assistant, NOT the source of truth.**
> Local processing remains the default for standard document transformations. Deterministic academic calculations (SGPA, CGPA, attendance) and ATS formatting checks remain 100% authoritative and independent of AI.

---

## 2. Core Architecture Pipeline

```
                     +---------------------------+
                     | User Selects Feature      |
                     +-------------+-------------+
                                   |
                     +-------------v-------------+
                     | Local-First Decision      |
                     | Engine                    |
                     +------+-------------+------+
                            |             |
                 Supports   |             | Requires External
                 Local      |             | AI / OCR
                            |             |
           +----------------v---+   +-----v---------------------+
           | Browser In-Memory  |   | Privacy Notice & Explicit |
           | Execution (Canvas, |   | User Consent ([Continue]) |
           | WASM, Web Workers) |   +-------------+-------------+
           +--------------------+                 |
                                    +-------------v-------------+
                                    | Data Minimization Engine  |
                                    | (Extract text / chunks    |
                                    | or downsample image)      |
                                    +-------------+-------------+
                                                  |
                                    +-------------v-------------+
                                    | Server-Side API Layer     |
                                    | (Rate limiting, Hash      |
                                    | idempotency, Safe audit)  |
                                    +-------------+-------------+
                                                  |
                                    +-------------v-------------+
                                    | Pluggable Provider Adapter|
                                    | (Gemini / OpenRouter /    |
                                    | Cloud Vision / Mock)      |
                                    +-------------+-------------+
                                                  |
                                    +-------------v-------------+
                                    | Schema Validation &       |
                                    | Text Cleanup              |
                                    +-------------+-------------+
                                                  |
                                    +-------------v-------------+
                                    | Client Result Review      |
                                    | (Editable, Copy, Single-  |
                                    | download rule, Local save)|
                                    +---------------------------+
```

---

## 3. Provider Abstraction Layer

All AI and OCR operations interact solely through strict interfaces:
- **`AIProvider`** (`src/lib/ai/types.ts`):
  - `generateText(prompt, options)`
  - `summarize(text, options)`
  - `answerQuestion(question, chunks, options)`
  - `extractStructuredData(text, schema, options)`
  - `analyzeResume(resumeText, targetRole, options)`
  - `analyzeJobDescription(jobText, candidateSkills, options)`
  - `explainStudyMaterial(materialText, topic, options)`
- **`OCRProvider`** (`src/lib/ocr/types.ts`):
  - `extractTextFromImage(imageBuffer, mimeType, options)`
  - `extractTextFromPdf(pdfBuffer, options)`

### Implemented Adapters:
1. `GeminiAIProvider`: Server-to-server HTTP invocation using Google Gemini APIs with structured JSON output modes.
2. `OpenRouterAIProvider`: Server-to-server OpenAI-compatible interface for OpenRouter-hosted models.
3. `CloudVisionOCRProvider`: Multimodal vision OCR integration.
4. `MockAIProvider` & `MockOCRProvider`: Deterministic adapters for automated tests, CI, and local dev.
5. `NullAIProvider` & `NullOCRProvider`: Production fallback when no provider keys are configured; truthfully reports unavailability and never emits fake responses.

---

## 4. Prompt Management & Prompt Injection Defense

All prompts reside in centralized versioned templates (`src/lib/ai/prompts/templates.ts`).
- **Isolation of Untrusted Text**: User document text is enclosed inside `<user_document_data>` and `</user_document_data>` tags. User inputs attempting to close tags are sanitized.
- **Strict Precedence Rules**: System instructions explicitly mandate that document contents must be interpreted purely as passive data, never as directives to override persona or reveal credentials.
- **Untrusted Output Rule**: AI responses are treated as untrusted strings. No returned string is evaluated as JavaScript, shell commands, or raw HTML.

---

## 5. Document Chunking & Lightweight Retrieval

For large documents up to 50,000 characters:
- **Deterministic Chunking** (`src/lib/ai/chunking.ts`): Splits text along paragraph and sentence boundaries into chunks of ~1,200 characters with 150-character overlap.
- **Lightweight Term-Frequency Retrieval** (`src/lib/ai/retrieval.ts`): Tokenizes queries and excerpts, computes TF-IDF-inspired relevance scores, and retrieves only top-K relevant chunks ($K \le 5$).
- **No Vector DB Overhead**: Keeps the system private, fast, and dependency-free.

---

## 6. Rate Limiting, Idempotency & Audit Logging

- **Rate Limiting**: AI and OCR routes enforce IP/user sliding-window rate limits (`AI_LIMITS.MAX_AI_REQUESTS_PER_MINUTE = 15`, `MAX_OCR_REQUESTS_PER_MINUTE = 10`).
- **Request Idempotency**: SHA-256 hashes of `(operation + input)` are checked in an in-memory TTL cache to prevent duplicate processing on double clicks or page re-renders.
- **Safe Audit Logging** (`src/lib/ai/audit.ts`): Logs only operational metadata (`requestId`, `feature`, `provider`, `durationMs`, `status`, `errorCode`). **Full document text, resume content, and academic records are strictly excluded.**
