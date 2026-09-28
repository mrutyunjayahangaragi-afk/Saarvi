/**
 * Saarvi Jobs Engine 2.0 — Deterministic Deduplication
 *
 * Prevents identical jobs appearing across repeated or multi-source searches.
 * Normalizes URL tracking parameters and matches composite keys (company:title:location:domain)
 * without erroneously collapsing different positions.
 */

import type { JobItem } from "./types.ts";

export function normalizeTextToken(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Strips tracking parameters (utm_*, gclid, fbclid, ref, etc.) from canonical URL.
 */
export function stripTrackingParams(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const trackingKeys = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "gclid", "fbclid", "msclkid", "ref", "source", "trk", "trkinfo", "original_referer",
    ];

    for (const key of trackingKeys) {
      parsed.searchParams.delete(key);
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Computes deterministic deduplication composite key.
 */
export function getJobCompositeKey(job: JobItem): string {
  const normCompany = normalizeTextToken(job.companyName);
  const normTitle = normalizeTextToken(job.title);
  const normLocation = normalizeTextToken(job.location);

  return `${normCompany}::${normTitle}::${normLocation}`;
}

/**
 * Generates an authoritative canonical job key across company, title, location, and apply domain.
 */
export function generateCanonicalJobKey(
  company: string,
  title: string,
  location: string,
  applyUrl?: string
): string {
  const normCompany = normalizeTextToken(company);
  const normTitle = normalizeTextToken(title);
  const normLocation = normalizeTextToken(location);

  let domain = "";
  if (applyUrl) {
    try {
      const parsed = new URL(applyUrl);
      domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      domain = "";
    }
  }

  return `${normCompany}::${normTitle}::${normLocation}${domain ? `::${domain}` : ""}`;
}

/**
 * Computes deterministic content hash of description and facts to detect changes.
 */
export function generateContentHash(text: string): string {
  if (!text) return "00000000";
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Checks whether candidate job is a duplicate against an existing list of jobs.
 */
export function isDuplicateJob(
  existingJobs: JobItem[],
  candidate: JobItem
): {
  isDuplicate: boolean;
  matchType?: "SOURCE_ID" | "COMPOSITE_KEY" | "CANONICAL_URL";
  existingMatch?: JobItem;
} {
  const cleanCandidateUrl = stripTrackingParams(candidate.applyUrl || candidate.sourceUrl).toLowerCase();
  const candidateKey = getJobCompositeKey(candidate);

  for (const existing of existingJobs) {
    // 1. Same sourceJobId from same source
    if (existing.sourceJobId && candidate.sourceJobId && existing.sourceJobId === candidate.sourceJobId) {
      return { isDuplicate: true, matchType: "SOURCE_ID", existingMatch: existing };
    }

    // 2. Same clean apply URL
    const existingCleanUrl = stripTrackingParams(existing.applyUrl || existing.sourceUrl).toLowerCase();
    if (cleanCandidateUrl && existingCleanUrl && cleanCandidateUrl === existingCleanUrl) {
      return { isDuplicate: true, matchType: "CANONICAL_URL", existingMatch: existing };
    }

    // 3. Composite key match
    if (candidateKey === getJobCompositeKey(existing)) {
      return { isDuplicate: true, matchType: "COMPOSITE_KEY", existingMatch: existing };
    }
  }

  return { isDuplicate: false };
}

/**
 * Deduplicates an array of jobs deterministically.
 * Preserves the richest record (e.g. one with logo, salary, or verified status).
 */
export function deduplicateJobs(jobs: JobItem[]): {
  uniqueJobs: JobItem[];
  duplicatesRemoved: number;
} {
  const seenKeys = new Map<string, JobItem>();
  const seenUrls = new Map<string, JobItem>();
  let duplicatesRemoved = 0;

  for (const job of jobs) {
    const compositeKey = getJobCompositeKey(job);
    const cleanUrl = stripTrackingParams(job.applyUrl || job.sourceUrl);

    const existingByKey = seenKeys.get(compositeKey);
    const existingByUrl = cleanUrl ? seenUrls.get(cleanUrl) : undefined;

    const existing = existingByKey || existingByUrl;

    if (existing) {
      duplicatesRemoved++;
      // Merge: preserve more informative record
      if (!existing.companyLogo && job.companyLogo) {
        existing.companyLogo = job.companyLogo;
      }
      if (existing.salary === "Salary not disclosed" && job.salary !== "Salary not disclosed") {
        existing.salary = job.salary;
      }
      if (existing.applicationDeadline === "Deadline not provided" && job.applicationDeadline !== "Deadline not provided") {
        existing.applicationDeadline = job.applicationDeadline;
      }
      if (job.skills.length > existing.skills.length) {
        existing.skills = Array.from(new Set([...existing.skills, ...job.skills]));
      }
      continue;
    }

    seenKeys.set(compositeKey, job);
    if (cleanUrl) {
      seenUrls.set(cleanUrl, job);
    }
  }

  return {
    uniqueJobs: Array.from(seenKeys.values()),
    duplicatesRemoved,
  };
}
