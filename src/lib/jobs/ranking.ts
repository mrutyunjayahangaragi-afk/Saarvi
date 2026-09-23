/**
 * Saarvi Jobs Engine 2.0 — Deterministic Relevance Ranking & Sorting
 *
 * Computes deterministic relevance scores based on query terms, title overlap,
 * skill matches, location proximity, and freshness.
 * Supports sorting by relevance, date posted, deadline, or candidate profile match.
 */

import type { JobItem, JobSearchParams, JobSortOption } from "./types.ts";

/**
 * Calculates a 0-100 deterministic relevance score for a job given search criteria.
 */
export function calculateJobRelevance(job: JobItem, params: JobSearchParams): number {
  let score = 50; // Baseline

  const queryTerms = (params.q || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();
  const companyLower = job.companyName.toLowerCase();
  const locLower = job.location.toLowerCase();

  // 1. Query Term Matches (Up to +30 points)
  if (queryTerms.length > 0) {
    let queryHits = 0;
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        queryHits += 3;
      } else if (companyLower.includes(term)) {
        queryHits += 2;
      } else if (descLower.includes(term)) {
        queryHits += 1;
      }
    }
    const queryScore = Math.min(30, (queryHits / (queryTerms.length * 3)) * 30);
    score += queryScore;
  }

  // 2. Skill Overlap (Up to +15 points)
  if (params.skills && params.skills.length > 0) {
    const filterSkills = params.skills.map((s) => s.toLowerCase());
    const jobSkills = job.skills.map((s) => s.toLowerCase());
    const matched = jobSkills.filter((s) => filterSkills.includes(s));
    const skillRatio = matched.length / filterSkills.length;
    score += Math.min(15, skillRatio * 15);
  }

  // 3. Location Match (Up to +10 points)
  if (params.location && params.location.trim()) {
    const targetLoc = params.location.toLowerCase().trim();
    if (locLower.includes(targetLoc)) {
      score += 10;
    } else if (targetLoc === "remote" && job.remoteType === "remote") {
      score += 10;
    }
  }

  // 4. Remote / Work Mode Match (Up to +5 points)
  if (params.remote && params.remote !== "all") {
    if (job.remoteType === params.remote) {
      score += 5;
    }
  }

  // 5. Experience Match (Up to +5 points)
  if (params.experience && params.experience !== "all") {
    if (job.experienceLevel === params.experience) {
      score += 5;
    }
  }

  // 6. Freshness Boost (Up to +5 points)
  try {
    const postedTime = new Date(job.datePosted).getTime();
    if (!isNaN(postedTime)) {
      const ageHours = (Date.now() - postedTime) / (1000 * 60 * 60);
      if (ageHours < 24) {
        score += 5;
      } else if (ageHours < 72) {
        score += 3;
      } else if (ageHours < 168) {
        score += 1;
      }
    }
  } catch {}

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Sorts jobs deterministically according to chosen criteria.
 */
export function sortJobs(
  jobs: JobItem[],
  sortBy: JobSortOption = "relevant",
  params: JobSearchParams = {},
  matchScores?: Map<string, number>
): JobItem[] {
  const cloned = [...jobs];

  switch (sortBy) {
    case "newest":
      return cloned.sort((a, b) => {
        const timeA = new Date(a.datePosted).getTime() || 0;
        const timeB = new Date(b.datePosted).getTime() || 0;
        return timeB - timeA;
      });

    case "deadline_soon":
      return cloned.sort((a, b) => {
        const dlA = a.applicationDeadline !== "Deadline not provided" ? new Date(a.applicationDeadline).getTime() : Infinity;
        const dlB = b.applicationDeadline !== "Deadline not provided" ? new Date(b.applicationDeadline).getTime() : Infinity;
        return dlA - dlB;
      });

    case "match_score":
      if (matchScores && matchScores.size > 0) {
        return cloned.sort((a, b) => {
          const scoreA = matchScores.get(a.id) ?? 0;
          const scoreB = matchScores.get(b.id) ?? 0;
          return scoreB - scoreA;
        });
      }
      // Fallback to relevance
      return cloned.sort((a, b) => calculateJobRelevance(b, params) - calculateJobRelevance(a, params));

    case "relevant":
    default:
      return cloned.sort((a, b) => calculateJobRelevance(b, params) - calculateJobRelevance(a, params));
  }
}
