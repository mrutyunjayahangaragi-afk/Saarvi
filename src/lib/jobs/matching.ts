/**
 * Saarvi Jobs Engine 2.0 — Deterministic Candidate Matching Engine
 *
 * Computes an explainable, weighted 0-100 match score comparing candidate
 * resume / career profile against job requirements.
 *
 * Transparent weights:
 * - Skills Match: 40%
 * - Role / Title Overlap: 20%
 * - Location Preference: 15%
 * - Experience Alignment: 10%
 * - Education / Field Alignment: 10%
 * - Freshness: 5%
 */

import type { JobItem, JobMatchingResult } from "./types.ts";
import type { CareerProfile } from "@/types/career";

export interface CandidateProfileContext {
  skills: string[];
  targetRole?: string;
  preferredLocations?: string[];
  preferredWorkType?: "remote" | "hybrid" | "onsite";
  graduationYear?: number;
  branch?: string;
  degree?: string;
  yearsExperience?: number;
}

/**
 * Extracts candidate context from CareerProfile or raw resume fields.
 */
export function extractCandidateContext(profile: Partial<CareerProfile>): CandidateProfileContext {
  const skillsList = (profile.skills || []).map((s) => (typeof s === "string" ? s : s.name));
  const latestEdu = profile.education?.[0];

  return {
    skills: skillsList,
    targetRole: profile.professionalTitle,
    preferredLocations: profile.location ? [profile.location] : undefined,
    degree: latestEdu?.degree,
    branch: latestEdu?.fieldOfStudy || latestEdu?.branch,
    graduationYear: latestEdu?.endDate ? parseInt(latestEdu.endDate.slice(0, 4), 10) : undefined,
  };
}

/**
 * Computes deterministic match between a candidate and a specific JobItem.
 */
export function calculateJobMatch(candidate: CandidateProfileContext, job: JobItem): JobMatchingResult {
  const candidateSkillsNorm = new Set(candidate.skills.map((s) => s.toLowerCase().trim()));
  const jobSkillsNorm = job.skills.map((s) => s.toLowerCase().trim());

  // 1. SKILLS MATCH (40 points)
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const sk of job.skills) {
    if (candidateSkillsNorm.has(sk.toLowerCase().trim())) {
      matchedSkills.push(sk);
    } else {
      missingSkills.push(sk);
    }
  }

  let skillsScore = 20; // Default baseline if job has no explicit skill tags
  if (job.skills.length > 0) {
    const ratio = matchedSkills.length / job.skills.length;
    skillsScore = Math.round(ratio * 40);
  }

  // 2. ROLE / TITLE OVERLAP (20 points)
  let roleScore = 10;
  const reasons: string[] = [];
  const gaps: string[] = [];

  if (candidate.targetRole && candidate.targetRole.trim()) {
    const targetTerms = candidate.targetRole.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const titleLower = job.title.toLowerCase();
    const hits = targetTerms.filter((term) => titleLower.includes(term));

    if (hits.length > 0) {
      roleScore = Math.min(20, Math.round((hits.length / targetTerms.length) * 20));
      reasons.push(`Target role matches title keywords: ${hits.join(", ")}`);
    } else {
      roleScore = 5;
    }
  }

  // 3. LOCATION MATCH (15 points)
  let locationScore = 10;
  const jobLoc = job.location.toLowerCase();

  if (job.remoteType === "remote") {
    locationScore = 15;
    reasons.push("Remote opportunity matches flexible work preferences");
  } else if (candidate.preferredLocations && candidate.preferredLocations.length > 0) {
    const locHit = candidate.preferredLocations.some((loc) => jobLoc.includes(loc.toLowerCase()));
    if (locHit) {
      locationScore = 15;
      reasons.push(`Location matches candidate preference: ${job.location}`);
    } else {
      locationScore = 5;
      gaps.push(`Located in ${job.location}, which is outside preferred locations`);
    }
  }

  // 4. EXPERIENCE ALIGNMENT (10 points)
  let experienceScore = 7;
  if (job.experienceLevel === "fresher" || job.isInternship) {
    experienceScore = 10;
    reasons.push(job.isInternship ? "Internship role suitable for current students" : "Fresher-friendly opportunity");
  } else if (job.experienceLevel === "entry-level") {
    experienceScore = 9;
    reasons.push("Entry-level role matching early career stage");
  }

  // 5. EDUCATION / FIELD ALIGNMENT (10 points)
  let educationScore = 7;
  if (candidate.branch || candidate.degree) {
    const fieldLower = `${candidate.branch || ""} ${candidate.degree || ""}`.toLowerCase();
    if (
      fieldLower.includes("computer") ||
      fieldLower.includes("information") ||
      fieldLower.includes("data") ||
      fieldLower.includes("tech")
    ) {
      educationScore = 10;
      reasons.push("Academic background aligns with technical requirements");
    }
  }

  // 6. FRESHNESS (5 points)
  let freshnessScore = 3;
  try {
    const postedTime = new Date(job.datePosted).getTime();
    if (!isNaN(postedTime)) {
      const daysOld = (Date.now() - postedTime) / (1000 * 60 * 60 * 24);
      if (daysOld <= 3) {
        freshnessScore = 5;
        reasons.push("Recently posted listing (< 3 days ago)");
      } else if (daysOld <= 7) {
        freshnessScore = 4;
      }
    }
  } catch {}

  // Record matched skills reasons
  if (matchedSkills.length > 0) {
    reasons.unshift(`Matches ${matchedSkills.length} key skill${matchedSkills.length > 1 ? "s" : ""}: ${matchedSkills.slice(0, 4).join(", ")}`);
  }

  // Record missing skills gaps
  if (missingSkills.length > 0) {
    gaps.unshift(`Missing skill requirements: ${missingSkills.slice(0, 4).join(", ")}`);
  }

  const matchScore = Math.min(
    100,
    Math.max(10, skillsScore + roleScore + locationScore + experienceScore + educationScore + freshnessScore)
  );

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    matchingReasons: reasons,
    potentialGaps: gaps,
    breakdown: {
      skillsScore,
      roleScore,
      locationScore,
      experienceScore,
      educationScore,
      freshnessScore,
    },
  };
}
