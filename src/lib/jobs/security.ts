/**
 * Saarvi Jobs Engine 2.0 — Security & SSRF Defense
 *
 * Enforces strict input validation, SSRF defense, open redirect prevention,
 * and malicious protocol blocking.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // AWS Metadata IP
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "blob:",
  "vbscript:",
  "about:",
]);

/**
 * Validates and sanitizes external apply/source URLs.
 * Rejects SSRF targets, loopbacks, internal clouds, and non-HTTP protocols.
 */
export function validateSafeJobUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  for (const protocol of BLOCKED_PROTOCOLS) {
    if (lower.startsWith(protocol)) return null;
  }

  try {
    const parsed = new URL(trimmed);

    // Enforce HTTP / HTTPS only
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block local / cloud metadata hosts
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return null;
    }

    // Block private RFC 1918 subnets
    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return null;
    }

    // Block dotless hostnames (e.g. internal network services like "intranet")
    if (!hostname.includes(".") && hostname !== "localhost") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitizes search query string.
 * Prevents huge queries, excessive pagination abuse, and injection.
 */
export function sanitizeSearchQuery(query: string | undefined | null, maxLength = 120): string {
  if (!query || typeof query !== "string") return "";

  // Strip excessive characters and normalize whitespace
  const sanitized = query
    .replace(/[<>'"`;\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.slice(0, maxLength);
}

/**
 * Bounds pagination parameters to prevent memory exhaustion.
 */
export function sanitizePagination(page?: number, limit?: number, maxLimit = 50): { page: number; limit: number } {
  const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, maxLimit));
  return { page: safePage, limit: safeLimit };
}
