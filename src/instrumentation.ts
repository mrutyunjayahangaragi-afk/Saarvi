/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server or build worker initiates.
 */
export async function register() {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.Iterator === "undefined") {
    class CustomIterator {}
    g.Iterator = CustomIterator;
  }
}
