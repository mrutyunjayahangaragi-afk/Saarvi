import { Trie } from "@/lib/dsa/trie";
import { kmpSearch, tokenize } from "@/lib/algorithms/kmp";

export interface SearchableItem {
  id: string;
  title: string;
  description: string;
  category: string;
  route: string;
  keywords?: string[];
  badge?: string;
  metadata?: Record<string, any>;
}

export interface SearchResult<T extends SearchableItem> {
  item: T;
  score: number;
  matchType: "exact" | "prefix" | "substring" | "keyword" | "token";
}

export class SearchEngine<T extends SearchableItem> {
  private itemMap: Map<string, T> = new Map();
  private exactMap: Map<string, Set<string>> = new Map();
  private trie: Trie = new Trie();
  private invertedIndex: Map<string, Set<string>> = new Map();

  /**
   * Clears the search engine index.
   */
  public clear(): void {
    this.itemMap.clear();
    this.exactMap.clear();
    this.trie.clear();
    this.invertedIndex.clear();
  }

  /**
   * Adds an item to the search engine index.
   */
  public indexItem(item: T): void {
    this.itemMap.set(item.id, item);

    // 1. Exact title index
    const normalizedTitle = item.title.trim().toLowerCase();
    this.addToExactMap(normalizedTitle, item.id);

    // 2. Trie prefix indexing
    const words = tokenize(item.title);
    for (const w of words) {
      this.trie.insert(w, item.id);
    }
    if (item.keywords) {
      for (const kw of item.keywords) {
        const kwWords = tokenize(kw);
        for (const kwWord of kwWords) {
          this.trie.insert(kwWord, item.id);
          this.addToExactMap(kw.toLowerCase(), item.id);
        }
      }
    }

    // 3. Inverted index for all searchable tokens
    const searchableText = `${item.title} ${item.description} ${item.category} ${
      item.keywords ? item.keywords.join(" ") : ""
    }`;
    const allTokens = tokenize(searchableText);
    const uniqueTokens = new Set(allTokens);

    for (const token of uniqueTokens) {
      let set = this.invertedIndex.get(token);
      if (!set) {
        set = new Set();
        this.invertedIndex.set(token, set);
      }
      set.add(item.id);
    }
  }

  /**
   * Bulk indexes an array of items.
   */
  public indexBatch(items: T[]): void {
    for (const item of items) {
      this.indexItem(item);
    }
  }

  /**
   * Executes a multi-technique ranked search query.
   */
  public search(query: string, options?: { limit?: number; categoryFilter?: string }): SearchResult<T>[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const limit = options?.limit || 25;
    const queryTokens = tokenize(cleanQuery);
    const scoredIds = new Map<string, { score: number; matchType: SearchResult<T>["matchType"] }>();

    // 1. Exact title / keyword match (highest priority)
    const exactMatches = this.exactMap.get(cleanQuery);
    if (exactMatches) {
      for (const id of exactMatches) {
        this.addScore(scoredIds, id, 1000, "exact");
      }
    }

    // 2. Prefix matching via Trie
    for (const token of queryTokens) {
      const prefixHits = this.trie.searchPrefix(token);
      for (const id of prefixHits) {
        this.addScore(scoredIds, id, 250, "prefix");
      }
    }

    // 3. Substring matching via KMP / native search on full title & description
    for (const [id, item] of this.itemMap.entries()) {
      const normalizedTitle = item.title.toLowerCase();
      const normalizedDesc = item.description.toLowerCase();

      // KMP check on title
      if (kmpSearch(normalizedTitle, cleanQuery).length > 0) {
        this.addScore(scoredIds, id, 200, "substring");
      } else if (normalizedTitle.includes(cleanQuery)) {
        this.addScore(scoredIds, id, 150, "substring");
      } else if (normalizedDesc.includes(cleanQuery)) {
        this.addScore(scoredIds, id, 50, "token");
      }
    }

    // 4. Inverted index token matching
    for (const token of queryTokens) {
      const tokenHits = this.invertedIndex.get(token);
      if (tokenHits) {
        for (const id of tokenHits) {
          this.addScore(scoredIds, id, 60, "token");
        }
      }
    }

    // Convert to ranked results
    const results: SearchResult<T>[] = [];
    for (const [id, meta] of scoredIds.entries()) {
      const item = this.itemMap.get(id);
      if (!item) continue;

      if (options?.categoryFilter && item.category !== options.categoryFilter) {
        continue;
      }

      results.push({
        item,
        score: meta.score,
        matchType: meta.matchType,
      });
    }

    // Deterministic stable sort: higher score first, tie-break by title alphabetical
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.item.title.localeCompare(b.item.title);
    });

    return results.slice(0, limit);
  }

  private addToExactMap(key: string, id: string): void {
    let set = this.exactMap.get(key);
    if (!set) {
      set = new Set();
      this.exactMap.set(key, set);
    }
    set.add(id);
  }

  private addScore(
    map: Map<string, { score: number; matchType: SearchResult<T>["matchType"] }>,
    id: string,
    points: number,
    matchType: SearchResult<T>["matchType"]
  ): void {
    const existing = map.get(id);
    if (existing) {
      existing.score += points;
      // keep the highest-priority match type
      if (points > 150) existing.matchType = matchType;
    } else {
      map.set(id, { score: points, matchType });
    }
  }
}
