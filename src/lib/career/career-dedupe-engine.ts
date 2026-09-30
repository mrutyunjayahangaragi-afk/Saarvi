/**
 * Saarvi Career Intelligence — Canonical Job Deduplication & Freshness Engine
 * Study. Work. Grow.
 *
 * Implements:
 * 1. CanonicalJobDeduplicationEngine (Requirements 33, 34, 35)
 *    - Merges identical opportunities across multiple sources (Google Jobs, ATS, DB)
 *    - Preserves sourceReferences array
 *    - Assigns one canonical ID: SAARVI-JOB-XXXXXXXX
 * 2. Freshness & Lifecycle Evaluation (Requirement 37)
 *    - FRESH (<= 7 days), RECENT (<= 30 days), STALE (> 30 days), EXPIRED (past deadline)
 * 3. Deterministic Verification Policy (Requirement 36)
 */

import type { CanonicalJobRecord } from "./career-source-connector.ts";

export type FreshnessState = "FRESH" | "RECENT" | "STALE" | "EXPIRED" | "UNKNOWN";

export class CanonicalJobDeduplicationEngine {
  /**
   * Normalizes a text token for deterministic fingerprint comparison.
   */
  private static cleanToken(str?: string | null): string {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  /**
   * Computes a deterministic fingerprint key for an opportunity.
   * Identical positions across multiple sources (e.g. Google Jobs and Greenhouse)
   * will share the exact same key.
   */
  public static computeCanonicalKey(job: Partial<CanonicalJobRecord>): string {
    const company = this.cleanToken(job.company || job.companyName);
    const title = this.cleanToken(job.title)
      .replace(/internship/g, "intern")
      .replace(/developer/g, "engineer")
      .replace(/associate/g, "");
    const location = this.cleanToken(job.location)
      .replace(/bangalore/g, "bengaluru")
      .replace(/india/g, "");

    return `ck_${company}_${title.slice(0, 16)}_${location.slice(0, 10)}`;
  }

  /**
   * Evaluates freshness state deterministically without fabricating dates.
   */
  public static evaluateFreshness(datePosted?: string | null, deadline?: string | null): FreshnessState {
    const now = Date.now();

    // Check deadline expiration first
    if (deadline && deadline !== "Deadline not provided" && deadline !== "Rolling admission") {
      const deadlineDate = new Date(deadline).getTime();
      if (!isNaN(deadlineDate) && deadlineDate < now) {
        return "EXPIRED";
      }
    }

    if (!datePosted) return "UNKNOWN";

    const postedTime = new Date(datePosted).getTime();
    if (isNaN(postedTime)) return "UNKNOWN";

    const diffDays = (now - postedTime) / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) return "FRESH";
    if (diffDays <= 30) return "RECENT";
    return "STALE";
  }

  /**
   * Generates a canonical Saarvi ID (SAARVI-JOB-XXXXXXXX).
   */
  public static generateCanonicalId(key: string, existingId?: string): string {
    if (existingId && existingId.startsWith("SAARVI-JOB-")) {
      return existingId;
    }
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
    return `SAARVI-JOB-${hex}`;
  }

  /**
   * Deduplicates a stream of CanonicalJobRecords into unique canonical jobs.
   * Merges multi-source occurrences and accumulates sourceReferences.
   */
  public static deduplicateAndMerge(jobs: CanonicalJobRecord[]): {
    uniqueJobs: CanonicalJobRecord[];
    duplicatesMergedCount: number;
  } {
    const map = new Map<string, CanonicalJobRecord>();
    let duplicatesMerged = 0;

    for (const job of jobs) {
      const key = this.computeCanonicalKey(job);

      if (!map.has(key)) {
        const canonicalId = this.generateCanonicalId(key, job.id);
        const initialReferences = job.sourceReferences?.length
          ? [...job.sourceReferences]
          : [
              {
                source: job.sourceKey || job.sourceName || "Direct",
                sourceJobId: job.sourceJobId || job.id,
                sourceUrl: job.sourceUrl || job.applyUrl,
                discoveredAt: job.datePosted || new Date().toISOString(),
              },
            ];

        map.set(key, {
          ...job,
          id: job.id || canonicalId, // Maintain backwards compatible ID if already set
          canonicalId,
          sourceReferences: initialReferences,
        });
      } else {
        // Merge with existing canonical record
        duplicatesMerged++;
        const existing = map.get(key)!;

        // If newly discovered job has higher verification, upgrade attribution
        if (job.verificationState === "VERIFIED" && existing.verificationState !== "VERIFIED") {
          existing.verificationState = "VERIFIED";
          existing.sourceAttribution = "✓ Saarvi Verified";
          existing.verificationTier = "SAARVI_VERIFIED";
          existing.verifiedStatus = "verified";
        }

        // Add to source references if not already present
        const incomingRef = job.sourceReferences?.[0] || {
          source: job.sourceKey || job.sourceName || "Direct",
          sourceJobId: job.sourceJobId || job.id,
          sourceUrl: job.sourceUrl || job.applyUrl,
          discoveredAt: job.datePosted || new Date().toISOString(),
        };

        const hasSource = existing.sourceReferences.some(
          (r) => r.source === incomingRef.source && r.sourceJobId === incomingRef.sourceJobId
        );

        if (!hasSource) {
          existing.sourceReferences.push(incomingRef);
        }

        // Fill in missing fields from incoming record
        if (!existing.salary && job.salary && job.salary !== "Salary not disclosed") {
          existing.salary = job.salary;
        }
        if (!existing.companyLogo && job.companyLogo) {
          existing.companyLogo = job.companyLogo;
        }
        if ((!existing.skills || existing.skills.length === 0) && job.skills && job.skills.length > 0) {
          existing.skills = job.skills;
        }
      }
    }

    return {
      uniqueJobs: Array.from(map.values()),
      duplicatesMergedCount: duplicatesMerged,
    };
  }
}
