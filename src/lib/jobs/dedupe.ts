/**
 * Saarvi Jobs Engine 2.0 — Deterministic Deduplication
 *
 * Prevents identical jobs appearing across repeated or multi-source searches.
 * Normalizes URL tracking parameters and matches composite keys (company:title:location)
 * without erroneously collapsing different positions.
 */

import type { JobItem } from "./types.ts";

export function normalizeTextToken(text: string): string {
  return text
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
    const existingByUrl = seenUrls.get(cleanUrl);

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
