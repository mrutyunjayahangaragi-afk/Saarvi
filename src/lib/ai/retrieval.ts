import { ContextChunk } from "@/types/ai";
import { AI_LIMITS } from "./limits";

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
  "between", "both", "but", "by", "could", "did", "do", "does", "doing", "down",
  "during", "each", "few", "for", "from", "further", "had", "has", "have",
  "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me",
  "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on",
  "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
  "over", "own", "same", "she", "should", "so", "some", "such", "than", "that",
  "the", "their", "theirs", "them", "themselves", "then", "there", "these",
  "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "we", "were", "what", "when", "where", "which", "while",
  "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself",
  "yourselves"
]);

/**
 * Tokenizes text into lowercase normalized alphanumeric tokens, omitting stop words.
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/);

  const tokens: string[] = [];
  for (const w of words) {
    if (w.length > 2 && !STOP_WORDS.has(w)) {
      tokens.push(w);
    }
  }
  return tokens;
}

/**
 * Scores and retrieves top-K relevant chunks for a user question using term frequency weighting.
 */
export function retrieveRelevantChunks(
  question: string,
  chunks: ContextChunk[],
  topK: number = AI_LIMITS.MAX_RETRIEVAL_CHUNKS
): ContextChunk[] {
  if (!chunks || chunks.length === 0) return [];
  if (chunks.length <= topK) return chunks;

  const queryTokens = tokenizeText(question);
  if (queryTokens.length === 0) {
    // If no meaningful query tokens, return initial chunks
    return chunks.slice(0, topK);
  }

  // Pre-calculate inverse document frequency (IDF) for query terms across chunks
  const docFrequency = new Map<string, number>();
  const totalChunks = chunks.length;

  for (const token of queryTokens) {
    let count = 0;
    for (const chunk of chunks) {
      if (chunk.text.toLowerCase().includes(token)) {
        count++;
      }
    }
    docFrequency.set(token, count);
  }

  // Score each chunk
  const scoredChunks: (ContextChunk & { score: number; index: number })[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTokens = tokenizeText(chunk.text);
    const tokenCounts = new Map<string, number>();

    for (const t of chunkTokens) {
      tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
    }

    let score = 0;
    for (const qToken of queryTokens) {
      const tf = tokenCounts.get(qToken) || 0;
      if (tf > 0) {
        const df = docFrequency.get(qToken) || 1;
        // Standard TF-IDF weighting: tf * log(1 + totalChunks / df)
        const idf = Math.log(1 + totalChunks / df);
        score += tf * idf;
      }
    }

    // Exact phrase bonus
    const cleanQ = question.toLowerCase().trim();
    if (cleanQ.length > 5 && chunk.text.toLowerCase().includes(cleanQ)) {
      score += 10.0;
    }

    scoredChunks.push({
      ...chunk,
      score,
      index: i,
    });
  }

  // Sort descending by score
  scoredChunks.sort((a, b) => b.score - a.score);

  // Take top-K and restore original document ordering for coherent reading
  const topSelected = scoredChunks
    .slice(0, topK)
    .sort((a, b) => a.index - b.index)
    .map(({ ...chunk }) => chunk);

  return topSelected;
}
