# DocEase AI & OCR Operational Limits & Safeguards

## 1. Centralized Safety Limits

All thresholds are centralized in `src/lib/ai/limits.ts` and enforced uniformly across client validations and server API routes.

| Constraint | Limit Value | Rationale |
| :--- | :--- | :--- |
| **Max Document Characters** | 50,000 characters (~10,000 words) | Prevents provider payload overflow and runaway context costs |
| **Max Scanned PDF Pages** | 20 pages per request | Prevents server memory exhaustion and long timeouts |
| **Max Question Length** | 500 characters | Prevents prompt injection abuse and oversized prompts |
| **Max Output Tokens** | 2,048 tokens | Bounds generation latency and provider billing |
| **AI Request Timeout** | 25,000 ms (25 seconds) | Prevents hanging connections and memory leaks |
| **OCR Request Timeout** | 30,000 ms (30 seconds) | Accommodates large image encoding and OCR recognition |
| **Max AI Requests / Min** | 15 requests / minute / IP | Protects AI endpoints from brute-force and request storms |
| **Max OCR Requests / Min** | 10 requests / minute / IP | Restricts CPU-intensive vision recognition traffic |
| **Max Image Pixels** | 4,000,000 pixels (~2000x2000) | Enforces client-side downsampling for massive uploads |
| **Max Image File Size** | 15 MB | Caps incoming image upload buffers |
| **Max PDF File Size** | 25 MB | Caps incoming scanned PDF documents |
| **Max Retrieval Chunks** | Top 5 chunks | Enforces data minimization for Q&A operations |

---

## 2. Idempotency & Deduplication
- **SHA-256 Hash Caching**: Repeated identical operations submitted within 120 seconds are returned immediately from the in-memory cache.
- **Double-Click Protection**: Client UI buttons are disabled upon submission, and server endpoints utilize client `x-request-id` headers to guarantee single-execution semantics.

---

## 3. Truthful Provider Failure & Fallback Invariant
- If an AI or OCR service key is not configured in production, endpoints return `503 Service Unavailable` with user-facing notification:
  *"AI assistance is currently unavailable. No provider configured."*
- Mock providers are strictly forbidden in production builds (`process.env.NODE_ENV === "production"`).
- Failure of external AI/OCR endpoints has **zero impact** on client-side document processing (JPG to PDF, merge, organize, compress, VTU calculators continue to execute 100% locally).
