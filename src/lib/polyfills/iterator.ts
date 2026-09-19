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

if (typeof (Uint8Array.prototype as any).toHex === "undefined") {
  (Uint8Array.prototype as any).toHex = function () {
    let hex = "";
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, "0");
    }
    return hex;
  };
}

if (typeof (Uint8Array as any).fromHex === "undefined") {
  (Uint8Array as any).fromHex = function (hex: string) {
    const bytes = new Uint8Array(Math.floor(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  };
}

export {};
