/**
 * Global Iterator Polyfill
 * Fixes ReferenceError: Iterator is not defined in Node.js environments
 * when modern libraries (such as pdfjs-dist 6+) check Iterator.prototype.join
 */
const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.Iterator === "undefined") {
  class CustomIterator {}
  g.Iterator = CustomIterator;
}

export {};
