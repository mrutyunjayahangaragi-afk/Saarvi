/**
 * Centralized user-facing error system for DocEase processing engines.
 * Never expose raw technical exceptions to the user.
 */

export type ProcessingErrorCode =
  | "INVALID_FILE"
  | "UNSUPPORTED_FORMAT"
  | "FILE_TOO_LARGE"
  | "CORRUPTED_FILE"
  | "PROCESSING_FAILED"
  | "BROWSER_UNSUPPORTED"
  | "MEMORY_LIMIT"
  | "DOWNLOAD_FAILED"
  | "NO_PAGES_SELECTED"
  | "INVALID_PAGE_RANGE";

export const PROCESSING_ERROR_MESSAGES: Record<ProcessingErrorCode, string> = {
  INVALID_FILE: "That doesn't appear to be a valid file. Please try selecting it again.",
  UNSUPPORTED_FORMAT: "This file format isn't supported. Please check the accepted formats above.",
  FILE_TOO_LARGE:
    "This file is too large for reliable browser processing. Try a smaller file or split it first.",
  CORRUPTED_FILE:
    "We couldn't read this file. It may be corrupted or password-protected. Try opening it in another application first.",
  PROCESSING_FAILED:
    "Something went wrong during processing. Please try again. If the problem persists, try a different file.",
  BROWSER_UNSUPPORTED:
    "Your browser doesn't fully support this operation. Please use a recent version of Chrome, Firefox, Edge, or Safari.",
  MEMORY_LIMIT:
    "Your browser ran out of memory processing this file. Try a smaller file or close other browser tabs and try again.",
  DOWNLOAD_FAILED:
    "The download couldn't start. Please check your browser's download settings and try again.",
  NO_PAGES_SELECTED: "Please select at least one page to continue.",
  INVALID_PAGE_RANGE:
    "The page range you entered isn't valid. Use formats like: 1, 3, 5-7, or 2-4.",
};

export function getErrorMessage(code: ProcessingErrorCode): string {
  return PROCESSING_ERROR_MESSAGES[code] ?? PROCESSING_ERROR_MESSAGES.PROCESSING_FAILED;
}

/**
 * Converts any thrown value to a user-friendly error message.
 * Falls back to a safe generic message if the error is technical.
 */
export function toUserMessage(err: unknown, fallback?: string): string {
  if (err instanceof Error) {
    // Allow explicitly crafted user messages through unchanged
    const msg = err.message;
    if (msg.length < 300 && !msg.includes("at ") && !msg.includes("undefined")) {
      return msg;
    }
  }
  return fallback ?? getErrorMessage("PROCESSING_FAILED");
}
