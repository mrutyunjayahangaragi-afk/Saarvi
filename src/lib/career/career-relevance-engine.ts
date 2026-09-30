/**
 * Saarvi Career Intelligence — Relevance Ranking & Explainable Match Engine
 * Study. Work. Grow.
 *
 * Implements:
 * 1. calculateCareerRelevance(job, intent) (Requirements 38, 39)
 *    - Signals: Role match, Domain match, Skills match, Location match, Work mode,
 *      Opportunity type, Branch eligibility, Freshness, and Saarvi Verification.
 *    - Source quality without source bias: relevance to the user's intent is paramount.
 * 2. Explainable Match Reasons:
 *    - Concrete, transparent explanations (e.g. "Frontend Developer role match", "Bengaluru location")
 *    - Zero fabricated "97% AI match" claims.
 * 3. Controlled Relaxation (Requirement 43):
 *    - If exact filters return 0 matches, relaxes soft constraints (branch/domain)
 *      with explicit user explanation: "Some listings do not provide branch eligibility information."
 */

import type { CanonicalJobRecord } from "./career-source-connector.ts";
import type { CareerSearchIntent } from "./career-search-intent.ts";
import { CanonicalJobDeduplicationEngine } from "./career-dedupe-engine.ts";

export interface RelevanceScoreResult {
  score: number;
  matchReasons: string[];
  isRelaxedMatch?: boolean;
}

export class CareerRelevanceEngine {
  /**
   * Scores a job against the canonical CareerSearchIntent.
   */
  public static scoreJob(job: CanonicalJobRecord, intent: CareerSearchIntent): RelevanceScoreResult {
    let score = 50; // Base score
    const reasons: string[] = [];

    const jobTitleLower = (job.title || "").toLowerCase();
    const jobDescLower = (job.description || "").toLowerCase();
    const jobLocLower = (job.location || "").toLowerCase();
    const jobSkills = (job.skills || []).map((s) => s.toLowerCase());

    // 1. Role Match (High-Value: +35 for exact/alias match, +15 for keyword in title)
    if (intent.role) {
      const roleLabel = intent.role.label.toLowerCase();
      if (jobTitleLower.includes(roleLabel)) {
        score += 35;
        reasons.push(`${intent.role.label} role match`);
      } else if (intent.expandedQueryVariants.some((v) => jobTitleLower.includes(v.toLowerCase()))) {
        score += 25;
        reasons.push(`${intent.role.label} related role`);
      } else if (jobDescLower.includes(roleLabel)) {
        score += 15;
        reasons.push(`${intent.role.label} mentioned in requirements`);
      }
    } else if (intent.freeTextQuery) {
      const queryLower = intent.freeTextQuery.toLowerCase();
      if (jobTitleLower.includes(queryLower)) {
        score += 30;
        reasons.push(`Matches "${intent.freeTextQuery}"`);
      }
    }

    // 2. Domain Match (+20)
    if (intent.domain) {
      const domainLabel = intent.domain.label.toLowerCase();
      if (
        jobDescLower.includes(domainLabel) ||
        jobTitleLower.includes(domainLabel) ||
        (job.domain && job.domain.toLowerCase().includes(domainLabel))
      ) {
        score += 20;
        reasons.push(`${intent.domain.label} domain`);
      }
    }

    // 3. Opportunity Type Match (+15)
    const isInternship = job.opportunityType === "INTERNSHIP" || job.isInternship;
    const isJob = job.opportunityType === "JOB" && !job.isInternship;
    const isTraining = job.opportunityType === "TRAINING";

    if (intent.opportunityTypes.includes(job.opportunityType)) {
      score += 15;
      if (isInternship && intent.opportunityTypes.length === 1) {
        reasons.push("Internship opportunity");
      } else if (isTraining && intent.opportunityTypes.length === 1) {
        reasons.push("Training program");
      }
    }

    // 4. Location Match (+15)
    if (intent.location) {
      const targetLoc = intent.location.label.toLowerCase();
      if (jobLocLower.includes(targetLoc)) {
        score += 15;
        reasons.push(`${intent.location.label} location`);
      } else if (targetLoc.includes("bangalore") && jobLocLower.includes("bengaluru")) {
        score += 15;
        reasons.push("Bengaluru location");
      } else if (targetLoc.includes("bengaluru") && jobLocLower.includes("bangalore")) {
        score += 15;
        reasons.push("Bengaluru location");
      } else if (job.remote) {
        // Remote jobs are compatible with any location
        score += 10;
        reasons.push("Remote option");
      }
    }

    // 5. Work Mode Match (+10)
    if (intent.workMode) {
      if (intent.workMode === "remote" && job.remote) {
        score += 10;
        reasons.push("Remote work mode");
      } else if (intent.workMode === "hybrid" && job.remoteType === "hybrid") {
        score += 10;
        reasons.push("Hybrid work mode");
      } else if (intent.workMode === "onsite" && (job.remoteType === "onsite" || !job.remote)) {
        score += 10;
        reasons.push("On-site work mode");
      }
    }

    // 6. Skills Match (+15 for each matching skill up to +30)
    if (intent.skills && intent.skills.length > 0) {
      let matchedSkillsCount = 0;
      for (const skill of intent.skills) {
        const sLower = skill.toLowerCase();
        if (jobSkills.some((js) => js.includes(sLower)) || jobDescLower.includes(sLower)) {
          matchedSkillsCount++;
          if (matchedSkillsCount <= 2) {
            reasons.push(`${skill} skill`);
          }
        }
      }
      score += Math.min(matchedSkillsCount * 15, 30);
    }

    // 7. Branch Eligibility Match (+10)
    // Critical Rule 16: Missing branch metadata does NOT mean rejection!
    if (intent.branch) {
      const branchCode = intent.branch.id.toLowerCase();
      if (jobDescLower.includes(branchCode) || jobDescLower.includes(intent.branch.label.toLowerCase())) {
        score += 10;
        reasons.push(`${intent.branch.label} branch eligibility`);
      }
    }

    // 8. Freshness Boost (+10 for Fresh <= 7 days, +5 for Recent <= 30 days)
    const freshness = CanonicalJobDeduplicationEngine.evaluateFreshness(job.datePosted, job.applicationDeadline);
    if (freshness === "FRESH") {
      score += 10;
    } else if (freshness === "RECENT") {
      score += 5;
    } else if (freshness === "EXPIRED") {
      score -= 30; // Penalize expired records
    }

    // 9. Saarvi Verified Trust Boost (+10)
    if (job.verificationState === "VERIFIED" || job.verificationTier === "SAARVI_VERIFIED") {
      score += 10;
    }

    return {
      score,
      matchReasons: reasons.slice(0, 5), // Keep explanations clean, concise, and explainable
    };
  }

  /**
   * Sorts and filters candidate jobs based on intent relevance.
   * If exact matches are zero, executes controlled relaxation of soft requirements.
   */
  public static rankAndFilter(
    jobs: CanonicalJobRecord[],
    intent: CareerSearchIntent,
    options: { sortBy?: string } = {}
  ): {
    rankedJobs: CanonicalJobRecord[];
    isRelaxed: boolean;
    relaxationExplanation?: string;
  } {
    // 1. Initial Strict Filtering
    const scoredJobs = jobs
      .map((job) => {
        const { score, matchReasons } = this.scoreJob(job, intent);
        return {
          ...job,
          relevanceScore: score,
          matchReasons,
        };
      })
      .filter((job) => {
        // Hard constraint 1: Exclude expired jobs from active search
        const freshness = CanonicalJobDeduplicationEngine.evaluateFreshness(job.datePosted, job.applicationDeadline);
        if (freshness === "EXPIRED") return false;

        // Hard constraint 2: Opportunity Type (if user specifically asked for only Job or only Internship)
        if (intent.opportunityTypes.length === 1) {
          const target = intent.opportunityTypes[0];
          if (target === "INTERNSHIP" && !job.isInternship && job.opportunityType !== "INTERNSHIP") {
            return false;
          }
          if (target === "JOB" && (job.isInternship || job.opportunityType === "INTERNSHIP")) {
            return false;
          }
          if (target === "TRAINING" && job.opportunityType !== "TRAINING") {
            return false;
          }
        }

        // Hard constraint 3: Location (if location was explicitly provided and job is not remote)
        if (intent.location && !job.remote) {
          const locLower = job.location?.toLowerCase() || "";
          const target = intent.location.label.toLowerCase();
          const isMatch =
            locLower.includes(target) ||
            (target.includes("bengaluru") && locLower.includes("bangalore")) ||
            (target.includes("bangalore") && locLower.includes("bengaluru"));
          if (!isMatch) return false;
        }

        // Hard constraint 4: Remote work mode (if remote was explicitly required)
        if (intent.workMode === "remote" && !job.remote) {
          return false;
        }

        return true;
      });

    // 2. Case B: Controlled Relaxation if exact matches are 0
    if (scoredJobs.length === 0 && jobs.length > 0) {
      // Relax soft constraints (relax location strictness, allow remote / nearby)
      const relaxed = jobs
        .filter((job) => {
          const freshness = CanonicalJobDeduplicationEngine.evaluateFreshness(job.datePosted, job.applicationDeadline);
          return freshness !== "EXPIRED";
        })
        .map((job) => {
          const { score, matchReasons } = this.scoreJob(job, intent);
          return {
            ...job,
            relevanceScore: score,
            matchReasons,
            isRelaxedMatch: true,
          };
        });

      relaxed.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      return {
        rankedJobs: relaxed,
        isRelaxed: true,
        relaxationExplanation:
          "No exact matches found for all filters combined. Showing closely related opportunities. Some listings do not provide branch eligibility information.",
      };
    }

    // 3. Sort by requested sort criteria
    scoredJobs.sort((a, b) => {
      if (options.sortBy === "newest") {
        return new Date(b.datePosted || 0).getTime() - new Date(a.datePosted || 0).getTime();
      }
      return (b.relevanceScore || 0) - (a.relevanceScore || 0);
    });

    return {
      rankedJobs: scoredJobs,
      isRelaxed: false,
    };
  }
}
