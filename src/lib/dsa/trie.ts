/**
 * Trie (Prefix Tree) implementation for fast prefix-based search retrieval.
 * Provides deterministic O(M) lookup where M is the prefix length.
 */

class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public itemIds: Set<string> = new Set();
  public isEndOfWord: boolean = false;
}

export class Trie {
  private root: TrieNode = new TrieNode();

  /**
   * Inserts a word into the Trie associated with an item identifier.
   */
  public insert(word: string, itemId: string): void {
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) return;

    let current = this.root;
    for (let i = 0; i < cleanWord.length; i++) {
      const char = cleanWord[i];
      let next = current.children.get(char);
      if (!next) {
        next = new TrieNode();
        current.children.set(char, next);
      }
      current = next;
      current.itemIds.add(itemId);
    }
    current.isEndOfWord = true;
  }

  /**
   * Retrieves all item IDs that have the given prefix.
   */
  public searchPrefix(prefix: string): Set<string> {
    const cleanPrefix = prefix.trim().toLowerCase();
    if (!cleanPrefix) return new Set();

    let current = this.root;
    for (let i = 0; i < cleanPrefix.length; i++) {
      const char = cleanPrefix[i];
      const next = current.children.get(char);
      if (!next) {
        return new Set();
      }
      current = next;
    }

    return new Set(current.itemIds);
  }

  /**
   * Clears the Trie.
   */
  public clear(): void {
    this.root = new TrieNode();
  }
}
