/**
 * DocEase Security: URL Sanitization & SSRF Defense.
 *
 * Guarantees:
 * - Neutralizes XSS vector schemes (javascript:, data:, vbscript:) in dynamic link attributes.
 * - Protects server-side HTTP calls against Server-Side Request Forgery (SSRF).
 * - Blocks loopback, internal private subnets, and cloud metadata services (169.254.169.254).
 */

const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:"];

/**
 * Sanitizes an untrusted URL string for safe use in <a href="..."> and redirects.
 * Neutralizes XSS payload schemes by returning a safe fallback (default "#").
 */
export function sanitizeUrl(rawUrl?: string | null, fallback: string = "#"): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallback;
  }

  const trimmed = rawUrl.trim();

  // Empty string -> fallback
  if (!trimmed) {
    return fallback;
  }

  // Safe relative paths starting with /
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  // Check for dangerous protocol prefixes (case-insensitive and stripping control chars)
  const normalized = trimmed.replace(/[\x00-\x20]/g, "").toLowerCase();

  for (const dangerous of DANGEROUS_PROTOCOLS) {
    if (normalized.startsWith(dangerous)) {
      return fallback;
    }
  }

  // Check for protocol relative URLs (e.g. "//evil.com")
  if (trimmed.startsWith("//")) {
    return fallback;
  }

  // Verify valid URL structure
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    // Only allow http:, https:, mailto:, and tel:
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:") {
      return trimmed;
    }
  } catch {
    // Malformed URL string
    return fallback;
  }

  return fallback;
}

/**
 * Validates and sanitizes internal redirect URLs (e.g. for OAuth returnTo / next parameters).
 * Strict Invariants:
 * - Prohibits open redirects (rejects external domains and scheme changes).
 * - Prohibits dangerous URI schemes (javascript:, data:, vbscript:, file:).
 * - Prohibits protocol-relative URLs (//evil.com) and backslash confusion (/\\evil.com).
 * - Prohibits CRLF / header injection attempts.
 * - Always returns a safe relative internal path or the designated fallback (default '/dashboard').
 */
export function sanitizeInternalRedirectUrl(rawUrl?: string | null, fallback: string = "/dashboard"): string {
  const safeFallback = fallback && fallback.startsWith("/") && !fallback.startsWith("//") ? fallback : "/dashboard";

  if (!rawUrl || typeof rawUrl !== "string") {
    return safeFallback;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return safeFallback;
  }

  // 1. Disallow control characters and CRLF
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return safeFallback;
  }

  // 2. Disallow protocol-relative or backslash prefixes
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return safeFallback;
  }

  // 3. Must start with a single leading slash
  if (!trimmed.startsWith("/")) {
    return safeFallback;
  }

  // 4. Reject any explicit protocol scheme in the path (e.g. /https://evil.com or javascript:...)
  const dangerousPrefixes = ["javascript:", "data:", "vbscript:", "file:", "http:", "https:"];
  const lower = trimmed.toLowerCase();
  for (const prefix of dangerousPrefixes) {
    if (lower.includes(prefix)) {
      // Check if it's acting as a scheme
      if (lower.startsWith(prefix) || lower.startsWith("/" + prefix) || lower.startsWith("//" + prefix)) {
        return safeFallback;
      }
    }
  }

  // 5. Test resolution against trusted base to prevent host spoofing
  try {
    const dummyBase = "https://saarvi.app";
    const parsed = new URL(trimmed, dummyBase);

    // Origin must remain strictly identical to dummy base (no domain escaping)
    if (parsed.origin !== dummyBase) {
      return safeFallback;
    }

    // Pathname must start with '/' and not contain backslashes
    if (!parsed.pathname.startsWith("/") || parsed.pathname.includes("\\")) {
      return safeFallback;
    }

    // Prevent double-slash or encoded protocol-relative patterns in pathname
    if (parsed.pathname.startsWith("//")) {
      return safeFallback;
    }

    // Double-check decoded URI components for evasion
    try {
      const decoded = decodeURIComponent(trimmed);
      if (
        decoded.startsWith("//") ||
        decoded.startsWith("/\\") ||
        decoded.startsWith("\\") ||
        dangerousPrefixes.some((p) => decoded.toLowerCase().startsWith(p))
      ) {
        return safeFallback;
      }
    } catch {
      // Malformed URI encoding -> reject to fallback
      return safeFallback;
    }

    // Return the safe relative path (pathname + search + hash)
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return safeFallback;
  }
}

/**
 * SSRF Defense: Validates whether a remote destination URL is safe to contact from server-side code.
 * Blocks localhost, private subnets (RFC 1918), link-local addresses, and cloud metadata endpoints.
 */
export function isSafeRemoteUrl(rawUrl: string): { safe: boolean; error?: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { safe: false, error: "URL must be a non-empty string." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, error: "Malformed URL syntax." };
  }

  // Enforce HTTP / HTTPS schemes only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, error: `Disallowed URL protocol: "${parsed.protocol}". Only HTTP(S) permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Loopback & Localhost check
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    return { safe: false, error: "Access to loopback/localhost network addresses is strictly prohibited." };
  }

  // 2. Cloud metadata service check (AWS, GCP, Azure metadata IP: 169.254.169.254)
  if (hostname === "169.254.169.254" || hostname.startsWith("169.254.")) {
    return { safe: false, error: "Access to cloud instance metadata services is strictly prohibited." };
  }

  // 3. IPv4 Private Range Check (RFC 1918)
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octet1 = parseInt(ipv4Match[1], 10);
    const octet2 = parseInt(ipv4Match[2], 10);

    // 10.0.0.0/8
    if (octet1 === 10) {
      return { safe: false, error: "Access to private 10.0.0.0/8 subnet is prohibited." };
    }

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
      return { safe: false, error: "Access to private 172.16.0.0/12 subnet is prohibited." };
    }

    // 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168) {
      return { safe: false, error: "Access to private 192.168.0.0/16 subnet is prohibited." };
    }

    // 127.0.0.0/8
    if (octet1 === 127) {
      return { safe: false, error: "Access to loopback 127.0.0.0/8 range is prohibited." };
    }
  }

  return { safe: true };
}
