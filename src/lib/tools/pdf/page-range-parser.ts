/**
 * Unified Page Range Parser for Saarvi PDF Toolkit
 * Supports:
 * - Single pages: "1", "5"
 * - Ranges: "1-3", "4-6"
 * - Comma-separated lists: "1,3,5"
 * - Mixed combinations: "2-5,8", "1, 4-6, 9"
 *
 * Requirements:
 * - Reject invalid syntax (letters, negative numbers, empty tokens)
 * - Reject page 0 (pages are 1-indexed)
 * - Reject pages outside document bounds (> totalPages)
 * - Deduplicate repeated page numbers while preserving requested order
 * - Return 0-indexed page numbers for pdf-lib usage
 */

export interface PageRangeParseResult {
  valid: boolean;
  pageNumbers: number[]; // 1-based page numbers e.g. [1, 2, 3, 5]
  indices: number[]; // 0-based page indices e.g. [0, 1, 2, 4]
  error?: string;
}

export function parsePageRange(rangeStr: string, totalPages: number): PageRangeParseResult {
  if (!rangeStr || !rangeStr.trim()) {
    return {
      valid: false,
      pageNumbers: [],
      indices: [],
      error: "Page range string cannot be empty.",
    };
  }

  if (typeof totalPages !== "number" || totalPages <= 0) {
    return {
      valid: false,
      pageNumbers: [],
      indices: [],
      error: `Invalid document total pages: ${totalPages}`,
    };
  }

  const clean = rangeStr.trim();
  // Valid characters: digits, comma, hyphen, whitespace
  if (!/^[0-9,\-\s]+$/.test(clean)) {
    return {
      valid: false,
      pageNumbers: [],
      indices: [],
      error: `Invalid page range syntax: "${clean}". Only numbers, commas, and hyphens are allowed.`,
    };
  }

  const tokens = clean.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return {
      valid: false,
      pageNumbers: [],
      indices: [],
      error: "No valid page numbers found in range.",
    };
  }

  const pageNumbers: number[] = [];
  const seen = new Set<number>();

  for (const token of tokens) {
    if (token.includes("-")) {
      const parts = token.split("-").map((p) => p.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return {
          valid: false,
          pageNumbers: [],
          indices: [],
          error: `Malformed page range token: "${token}". Expected format "start-end" (e.g. "1-3").`,
        };
      }

      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);

      if (isNaN(start) || isNaN(end)) {
        return {
          valid: false,
          pageNumbers: [],
          indices: [],
          error: `Non-numeric values in page range: "${token}".`,
        };
      }

      if (start === 0 || end === 0) {
        return {
          valid: false,
          pageNumbers: [],
          indices: [],
          error: `Page 0 does not exist. PDF pages are 1-indexed (1 to ${totalPages}).`,
        };
      }

      if (start > totalPages || end > totalPages) {
        return {
          valid: false,
          pageNumbers: [],
          indices: [],
          error: `Page range "${token}" exceeds total document pages (${totalPages}).`,
        };
      }

      const step = start <= end ? 1 : -1;
      for (let p = start; step > 0 ? p <= end : p >= end; p += step) {
        if (!seen.has(p)) {
          seen.add(p);
          pageNumbers.push(p);
        }
      }
    } else {
      const p = parseInt(token, 10);
      if (isNaN(p)) {
        return {
          valid: false,
          pageNumbers: [],
          indices: [],
          error: `Invalid page number: "${token}".`,
        };
      }

      if (p === 0) {
        return {
          valid: false,
          pageNumbers: [],
          indices: [],
          error: `Page 0 does not exist. PDF pages are 1-indexed (1 to ${totalPages}).`,
        };
      }

      if (p > totalPages) {
        return {
          valid: false,
          pageNumbers: [],
          indices: [],
          error: `Page ${p} exceeds total document pages (${totalPages}).`,
        };
      }

      if (!seen.has(p)) {
        seen.add(p);
        pageNumbers.push(p);
      }
    }
  }

  if (pageNumbers.length === 0) {
    return {
      valid: false,
      pageNumbers: [],
      indices: [],
      error: `No valid pages specified for document with ${totalPages} pages.`,
    };
  }

  return {
    valid: true,
    pageNumbers,
    indices: pageNumbers.map((p) => p - 1),
  };
}
