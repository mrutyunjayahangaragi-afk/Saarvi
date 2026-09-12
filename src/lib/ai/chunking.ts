import { ContextChunk } from "@/types/ai";
import { AI_LIMITS } from "./limits";

/**
 * Splits document text into deterministic, overlapping chunks.
 * Natural paragraph and sentence boundaries are preserved where possible.
 */
export function chunkDocumentText(
  text: string,
  options?: {
    documentSessionId?: string;
    chunkSize?: number;
    overlap?: number;
    pageNumber?: number;
  }
): ContextChunk[] {
  if (!text || typeof text !== "string") return [];

  const chunkSize = options?.chunkSize !== undefined ? options.chunkSize : AI_LIMITS.CHUNK_SIZE_CHARS;
  const overlap = options?.overlap !== undefined ? options.overlap : AI_LIMITS.CHUNK_OVERLAP_CHARS;
  const sessionId = options?.documentSessionId || "session_doc";
  const defaultPage = options?.pageNumber;

  const cleanText = text.replace(/\r\n/g, "\n");
  if (cleanText.length <= chunkSize) {
    return [
      {
        chunkId: `${sessionId}_c0`,
        documentSessionId: sessionId,
        text: cleanText.trim(),
        pageNumber: defaultPage,
        charCount: cleanText.length,
        tokenEstimate: Math.ceil(cleanText.length / 4),
      },
    ];
  }

  // Split into paragraphs
  const paragraphs = cleanText.split(/\n\s*\n/);
  const chunks: ContextChunk[] = [];
  let currentBuffer = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (currentBuffer.length + trimmedPara.length + 2 <= chunkSize) {
      currentBuffer += (currentBuffer ? "\n\n" : "") + trimmedPara;
    } else {
      if (currentBuffer) {
        chunks.push({
          chunkId: `${sessionId}_c${chunkIndex++}`,
          documentSessionId: sessionId,
          text: currentBuffer.trim(),
          pageNumber: defaultPage,
          charCount: currentBuffer.length,
          tokenEstimate: Math.ceil(currentBuffer.length / 4),
        });

        // Compute overlap from end of currentBuffer
        const overlapStart = Math.max(0, currentBuffer.length - overlap);
        currentBuffer = currentBuffer.slice(overlapStart);
      }

      // If a single paragraph is larger than chunkSize, break by sentence
      if (trimmedPara.length > chunkSize) {
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [trimmedPara];
        for (const sentence of sentences) {
          if (currentBuffer.length + sentence.length <= chunkSize) {
            currentBuffer += (currentBuffer ? " " : "") + sentence.trim();
          } else {
            if (currentBuffer) {
              chunks.push({
                chunkId: `${sessionId}_c${chunkIndex++}`,
                documentSessionId: sessionId,
                text: currentBuffer.trim(),
                pageNumber: defaultPage,
                charCount: currentBuffer.length,
                tokenEstimate: Math.ceil(currentBuffer.length / 4),
              });
              const overlapStart = Math.max(0, currentBuffer.length - overlap);
              currentBuffer = currentBuffer.slice(overlapStart);
            }
            currentBuffer += (currentBuffer ? " " : "") + sentence.trim();
          }
        }
      } else {
        currentBuffer += (currentBuffer ? "\n\n" : "") + trimmedPara;
      }
    }
  }

  if (currentBuffer.trim().length > 0) {
    chunks.push({
      chunkId: `${sessionId}_c${chunkIndex++}`,
      documentSessionId: sessionId,
      text: currentBuffer.trim(),
      pageNumber: defaultPage,
      charCount: currentBuffer.length,
      tokenEstimate: Math.ceil(currentBuffer.length / 4),
    });
  }

  return chunks;
}

/**
 * Chunks multi-page document results while preserving page numbers.
 */
export function chunkMultiPageDocument(
  pages: { pageNumber: number; text: string }[],
  sessionId?: string
): ContextChunk[] {
  const allChunks: ContextChunk[] = [];
  const activeSessionId = sessionId || `doc_${Date.now()}`;

  for (const p of pages) {
    if (!p.text || !p.text.trim()) continue;
    const pageChunks = chunkDocumentText(p.text, {
      documentSessionId: activeSessionId,
      pageNumber: p.pageNumber,
    });
    allChunks.push(...pageChunks);
  }

  return allChunks;
}
