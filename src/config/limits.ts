/**
 * Centralized file size and browser processing limits.
 * Protects client memory and prevents tab crashes.
 */

export const FILE_LIMITS = {
  // Maximum file size in Megabytes for client-side processing
  IMAGE_MAX_MB: 25,
  PDF_MAX_MB: 50,
  BATCH_TOTAL_MAX_MB: 100,

  // Tool specific overrides
  SPECIFIC: {
    "jpg-to-pdf": 25,
    "png-to-jpg": 25,
    "jpg-to-png": 25,
    "image-to-pdf": 30,
    "multiple-images-to-pdf": 50,
    "image-resize": 30,
    "pdf-to-jpg": 40,
    "merge-pdf": 50,
    "split-pdf": 50,
    "rotate-pdf": 50,
    "extract-pdf-pages": 50,
    "compress-pdf": 50
  } as Record<string, number>
};

export function getMaxFileSizeMB(toolSlug: string): number {
  if (FILE_LIMITS.SPECIFIC[toolSlug]) {
    return FILE_LIMITS.SPECIFIC[toolSlug];
  }
  return toolSlug.includes("pdf") ? FILE_LIMITS.PDF_MAX_MB : FILE_LIMITS.IMAGE_MAX_MB;
}

export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: (filename: string, maxMB: number) =>
    `"${filename}" exceeds the ${maxMB}MB limit. Large files may exceed browser memory and crash your tab.`,
  UNSUPPORTED_FORMAT: (filename: string, formats: string[]) =>
    `"${filename}" has an unsupported format. Supported formats: ${formats.join(", ")}.`,
  CORRUPTED_FILE:
    "We couldn't read this file. It may be password-protected, truncated, or corrupted.",
  GENERIC_PROCESSING_ERROR:
    "Something went wrong while processing your document locally. Please check the file and try again.",
  EMPTY_FILE_LIST:
    "Please select at least one file to process."
};
