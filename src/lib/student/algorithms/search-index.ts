/**
 * Lightweight Search Index with Inverted Token Indexing.
 *
 * Implements an in-memory inverted index for fast multi-token document searching.
 *
 * Complexity:
 * - Document Indexing: O(T) where T is total tokens across indexed fields.
 * - Single Token Lookup: O(1) average lookup in Hash Map.
 * - Multi-Token Query (AND): O(min(|D_1|, |D_2|, ...)) set intersection where D_i are postings lists.
 * - Multi-Token Query (OR): O(sum(|D_i|)) set union.
 * - Multi-token scoring and ranking: Linear in candidate document count.
 */

export function normalizeSearchText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchText(text: string): string[] {
  const norm = normalizeSearchText(text);
  if (!norm) return [];
  return norm
    .split(/[\s-]+/)
    .filter((token) => token.length > 0);
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

export class LightweightSearchIndex<T> {
  private invertedIndex: Map<string, Set<string>> = new Map();
  private docMap: Map<string, T> = new Map();
  private docTextFields: Map<string, string[]> = new Map();

  /**
   * Index or update a document.
   */
  public indexDocument(id: string, item: T, textFields: (string | undefined | null)[]): void {
    if (this.docMap.has(id)) {
      this.removeDocument(id);
    }

    const cleanFields = textFields
      .filter((f): f is string => typeof f === "string" && f.trim().length > 0);

    this.docMap.set(id, item);
    this.docTextFields.set(id, cleanFields);

    const fullText = cleanFields.join(" ");
    const tokens = new Set(tokenizeSearchText(fullText));

    for (const token of tokens) {
      let docSet = this.invertedIndex.get(token);
      if (!docSet) {
        docSet = new Set<string>();
        this.invertedIndex.set(token, docSet);
      }
      docSet.add(id);
    }
  }

  /**
   * Remove a document from the index.
   */
  public removeDocument(id: string): void {
    if (!this.docMap.has(id)) return;

    const fields = this.docTextFields.get(id) || [];
    const fullText = fields.join(" ");
    const tokens = new Set(tokenizeSearchText(fullText));

    for (const token of tokens) {
      const docSet = this.invertedIndex.get(token);
      if (docSet) {
        docSet.delete(id);
        if (docSet.size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    }

    this.docMap.delete(id);
    this.docTextFields.delete(id);
  }

  /**
   * Search documents using ranking & scoring.
   */
  public searchWithScores(
    query: string,
    options: { limit?: number; mode?: "AND" | "OR" } = {}
  ): SearchHit<T>[] {
    const queryTokens = tokenizeSearchText(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const mode = options.mode || "OR";
    const limit = options.limit ?? 20;

    // Collect matching doc IDs
    let candidateIds: Set<string>;

    if (mode === "AND") {
      // Set intersection
      let smallestSet: Set<string> | null = null;
      const allSets: Set<string>[] = [];

      for (const token of queryTokens) {
        const matches = this.getDocsForToken(token);
        allSets.push(matches);
        if (!smallestSet || matches.size < smallestSet.size) {
          smallestSet = matches;
        }
      }

      if (!smallestSet || smallestSet.size === 0) {
        return [];
      }

      candidateIds = new Set<string>();
      for (const id of smallestSet) {
        if (allSets.every((s) => s.has(id))) {
          candidateIds.add(id);
        }
      }
    } else {
      // Set union
      candidateIds = new Set<string>();
      for (const token of queryTokens) {
        const matches = this.getDocsForToken(token);
        for (const id of matches) {
          candidateIds.add(id);
        }
      }
    }

    if (candidateIds.size === 0) {
      return [];
    }

    // Rank candidate documents
    const normalizedQuery = normalizeSearchText(query);
    const scored: SearchHit<T>[] = [];

    for (const id of candidateIds) {
      const item = this.docMap.get(id);
      if (!item) continue;

      const fields = this.docTextFields.get(id) || [];
      const fullText = normalizeSearchText(fields.join(" "));
      let score = 0;

      // Exact full match bonus
      if (fullText.includes(normalizedQuery)) {
        score += 10;
      }

      // Per token evaluation
      for (const qToken of queryTokens) {
        if (this.invertedIndex.get(qToken)?.has(id)) {
          score += 3; // Exact token hit
        } else {
          // Check prefix matches in fullText
          const regex = new RegExp(`\\b${qToken}`, "i");
          if (regex.test(fullText)) {
            score += 1;
          }
        }
      }

      scored.push({ item, score });
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return limit > 0 ? scored.slice(0, limit) : scored;
  }

  /**
   * Search documents and return items directly.
   */
  public search(
    query: string,
    options: { limit?: number; mode?: "AND" | "OR" } = {}
  ): T[] {
    return this.searchWithScores(query, options).map((hit) => hit.item);
  }

  /**
   * Find doc IDs that contain the token exactly or as a prefix.
   */
  private getDocsForToken(token: string): Set<string> {
    const directMatches = this.invertedIndex.get(token);
    const result = new Set<string>(directMatches || []);

    // Prefix search across invertedIndex keys if token length >= 3
    if (token.length >= 3) {
      for (const [indexedToken, docIds] of this.invertedIndex.entries()) {
        if (indexedToken !== token && indexedToken.startsWith(token)) {
          for (const docId of docIds) {
            result.add(docId);
          }
        }
      }
    }

    return result;
  }

  public getDocument(id: string): T | undefined {
    return this.docMap.get(id);
  }

  public clear(): void {
    this.invertedIndex.clear();
    this.docMap.clear();
    this.docTextFields.clear();
  }

  public size(): number {
    return this.docMap.size;
  }
}
