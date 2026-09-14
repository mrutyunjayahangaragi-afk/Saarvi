import type * as PdfjsLib from "pdfjs-dist";

let pdfjsLibPromise: Promise<typeof PdfjsLib> | null = null;

/**
 * Lazily loads pdfjs-dist. Only browsers run this code (all callers are
 * client-side file conversions), but the operations registry is imported
 * by server components too, so a top-level `import "pdfjs-dist"` would get
 * evaluated during SSR/static generation and crash on Node versions whose
 * V8 lacks the global `Iterator` that pdf.js's bundled util.js references.
 */
export function loadPdfjs(): Promise<typeof PdfjsLib> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((mod) => {
      if (typeof window !== "undefined") {
        mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return mod;
    });
  }
  return pdfjsLibPromise;
}
