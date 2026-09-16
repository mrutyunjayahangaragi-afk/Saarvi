/**
 * Knuth-Morris-Pratt (KMP) Substring Search Algorithm
 * Provides deterministic O(N + M) substring search avoiding redundant comparisons.
 */

/**
 * Computes the Longest Proper Prefix which is also Suffix (LPS) table.
 */
export function computeLPSArray(pattern: string): number[] {
  const m = pattern.length;
  const lps = new Array<number>(m).fill(0);
  let len = 0;
  let i = 1;

  while (i < m) {
    if (pattern[i] === pattern[len]) {
      len++;
      lps[i] = len;
      i++;
    } else {
      if (len !== 0) {
        len = lps[len - 1];
      } else {
        lps[i] = 0;
        i++;
      }
    }
  }

  return lps;
}

/**
 * Searches for all occurrences of pattern in text using KMP.
 * Returns array of starting indices.
 */
export function kmpSearch(text: string, pattern: string): number[] {
  const matches: number[] = [];
  const n = text.length;
  const m = pattern.length;

  if (m === 0 || n === 0 || m > n) {
    return matches;
  }

  const lps = computeLPSArray(pattern);
  let i = 0; // index for text
  let j = 0; // index for pattern

  while (i < n) {
    if (text[i] === pattern[j]) {
      i++;
      j++;
    }

    if (j === m) {
      matches.push(i - j);
      j = lps[j - 1];
    } else if (i < n && text[i] !== pattern[j]) {
      if (j !== 0) {
        j = lps[j - 1];
      } else {
        i++;
      }
    }
  }

  return matches;
}

/**
 * Tokenizes and normalizes text for search indexing.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length > 0);
}
