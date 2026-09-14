/**
 * Authoritative Payment QR Code Resolver & Validator
 *
 * Validates and resolves storage paths, public Supabase URLs, and legacy assets
 * into valid browser-loadable image URLs with zero broken-image artifacts.
 *
 * Strict Privacy & Invariants:
 * - Rejects blob:, javascript:, malformed, or empty URLs.
 * - Rejects localhost-only URLs in remote environments.
 * - Resolves relative storage paths against Supabase Public Storage.
 * - Returns null for invalid/missing sources so UIs can render safe fallbacks.
 */

const DEFAULT_SUPABASE_URL = 'https://teeronvvkemqzfrbppjo.supabase.co';

export function getSupabasePublicStorageBase(): string {
  const base =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL;
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/payment-assets`;
}

/**
 * Validates whether a given string is a usable, non-temporary QR URL.
 */
export function isValidQrUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // Explicitly reject temporary browser blob URLs
  if (trimmed.startsWith('blob:') || trimmed.toLowerCase().startsWith('blob:')) {
    return false;
  }

  // Reject script/javascript protocols
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) {
    return false;
  }

  // Allow authentic base64 image data URLs
  if (trimmed.startsWith('data:image/')) {
    return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed);
  }

  // Reject localhost in production
  if (
    trimmed.startsWith('http://localhost') ||
    trimmed.startsWith('https://localhost') ||
    trimmed.startsWith('http://127.0.0.1')
  ) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      return false;
    }
  }

  // Allow Supabase storage paths (e.g. qr-codes/saarvi-upi-qr.jpeg or payment-assets/qr-codes/...)
  if (
    trimmed.startsWith('qr-codes/') ||
    trimmed.startsWith('payment-assets/') ||
    trimmed.startsWith('/storage/v1/object/public/payment-assets/')
  ) {
    return true;
  }

  // Validate absolute URLs
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost');
  } catch {
    return false;
  }
}

/**
 * Authoritative resolver: Converts storage paths, relative paths, or full URLs into
 * a validated, browser-loadable image URL.
 * Returns null if the source is invalid, empty, or cannot be resolved.
 */
export function resolvePaymentQrImage(
  rawUrl: string | null | undefined,
  cacheBustTimestamp?: number | string
): string | null {
  if (!isValidQrUrl(rawUrl)) {
    return null;
  }

  const trimmed = rawUrl!.trim();

  // Data URLs need no resolution
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  let resolved = '';

  // Storage path starting with qr-codes/
  if (trimmed.startsWith('qr-codes/')) {
    resolved = `${getSupabasePublicStorageBase()}/${trimmed}`;
  }
  // Storage path starting with payment-assets/
  else if (trimmed.startsWith('payment-assets/')) {
    const subPath = trimmed.replace(/^payment-assets\/+/, '');
    resolved = `${getSupabasePublicStorageBase()}/${subPath}`;
  }
  // Relative storage URL
  else if (trimmed.startsWith('/storage/v1/object/public/payment-assets/')) {
    const base =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
      DEFAULT_SUPABASE_URL;
    resolved = `${base.replace(/\/+$/, '')}${trimmed}`;
  }
  // Absolute http/https URL
  else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    resolved = trimmed;
  } else {
    return null;
  }

  if (cacheBustTimestamp) {
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}t=${cacheBustTimestamp}`;
  }

  return resolved;
}
