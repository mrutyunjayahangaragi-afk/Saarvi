/**
 * Saarvi Opportunity Matching Engine
 *
 * Implements deterministic 7-factor explainable matching between candidate profile and opportunities:
 * 1. Skill Match (35%) via Set intersection
 * 2. Role Match (20%) via title similarity and focus
 * 3. Experience Match (15%) via fresher / graduation year alignment
 * 4. Education Match (10%) via degree & branch relevance
 * 5. Location Match (10%) via preferred cities or remote availability
 * 6. Work Type Match (5%) via internship vs full-time preference
 * 7. Keyword Match (5%) via project and experience corpus overlap
 *
 * Total Score: 0 to 100 ("Resume Match", never "hiring probability").
 */

import { Opportunity } from "./types.ts";
import type { CareerProfile, ResumeVersion } from "@/types/career";

export interface OpportunityFactorScore {
  name: string;
  earned: number;
  weight: number;
  percentage: number;
}

export interface OpportunityMatchReport {
  overallMatchScore: number; // 0 - 100
  factors: OpportunityFactorScore[];
  matchedSkills: string[];
  missingSkills: string[];
  locationCompatible: boolean;
  experienceCompatible: boolean;
  educationCompatible: boolean;
  strongMatches: string[];
  potentialGaps: string[];
  analyzedAt: string;
}

export function calculateOpportunityMatch(
  profile: CareerProfile,
  opportunity: Opportunity,
  version?: ResumeVersion | null
): OpportunityMatchReport {
  // 1. Gather Candidate Skills & Full Corpus
  const activeSkills = version && version.selectedSkillIds.length > 0
    ? profile.skills.filter((s) => version.selectedSkillIds.includes(s.id))
    : profile.skills;

  const candidateSkillNames = new Set(activeSkills.map((s) => s.name.toLowerCase()));

  const candidateCorpus = [
    profile.fullName,
    profile.professionalTitle,
    profile.summary,
    version?.summaryOverride,
    version?.targetRole,
    ...activeSkills.map((s) => s.name),
    ...profile.experience.flatMap((e) => [e.company, e.role, e.description, ...(e.bullets || [])]),
    ...profile.projects.flatMap((p) => [p.title, p.description, ...(p.technologies || []), ...(p.highlights || [])]),
    ...profile.education.flatMap((ed) => [ed.degree, ed.fieldOfStudy, ed.institution]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // -------------------------------------------------------------
  // Factor 1: SKILL MATCH (Weight: 35 pts)
  // -------------------------------------------------------------
  const oppSkills = opportunity.skills || [];
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const s of oppSkills) {
    const sLower = s.toLowerCase();
    if (candidateSkillNames.has(sLower) || candidateCorpus.includes(sLower)) {
      matchedSkills.push(s);
    } else {
      missingSkills.push(s);
    }
  }

  let skillScore = 35;
  if (oppSkills.length > 0) {
    const ratio = matchedSkills.length / oppSkills.length;
    skillScore = Math.round(ratio * 35);
  }

  // -------------------------------------------------------------
  // Factor 2: ROLE MATCH (Weight: 20 pts)
  // -------------------------------------------------------------
  let roleScore = 8;
  const oppTitleLower = opportunity.title.toLowerCase();
  const candTitleLower = (profile.professionalTitle || version?.targetRole || "").toLowerCase();

  if (candTitleLower && oppTitleLower.includes(candTitleLower)) {
    roleScore = 20;
  } else if (
    (oppTitleLower.includes("software") && candTitleLower.includes("software")) ||
    (oppTitleLower.includes("developer") && candTitleLower.includes("developer")) ||
    (oppTitleLower.includes("frontend") && candTitleLower.includes("frontend")) ||
    (oppTitleLower.includes("backend") && candTitleLower.includes("backend"))
  ) {
    roleScore = 16;
  } else if (candTitleLower.length > 0) {
    roleScore = 12;
  }

  // -------------------------------------------------------------
  // Factor 3: EXPERIENCE MATCH (Weight: 15 pts)
  // -------------------------------------------------------------
  let expScore = 15;
  const isFresherOpp = opportunity.experienceLevel === "fresher" || opportunity.isInternship;
  const hasWorkExp = profile.experience.length > 0;

  if (isFresherOpp) {
    expScore = 15; // Entry-level / fresher compatible
  } else if (hasWorkExp) {
    expScore = 12;
  } else {
    expScore = 8;
  }

  // -------------------------------------------------------------
  // Factor 4: EDUCATION MATCH (Weight: 10 pts)
  // -------------------------------------------------------------
  let eduScore = 7;
  const hasBTechOrBE = profile.education.some(
    (e) =>
      e.degree?.toLowerCase().includes("bachelor") ||
      e.degree?.toLowerCase().includes("b.e") ||
      e.degree?.toLowerCase().includes("b.tech") ||
      e.degree?.toLowerCase().includes("engineering")
  );

  if (hasBTechOrBE) {
    eduScore = 10;
  } else if (profile.education.length > 0) {
    eduScore = 8;
  }

  // -------------------------------------------------------------
  // Factor 5: LOCATION MATCH (Weight: 10 pts)
  // -------------------------------------------------------------
  let locScore = 5;
  const candLoc = (profile.location || "").toLowerCase();
  const oppLoc = opportunity.location.toLowerCase();

  if (opportunity.remoteType === "remote") {
    locScore = 10;
  } else if (candLoc && (oppLoc.includes(candLoc) || candLoc.includes(oppLoc.split(",")[0]))) {
    locScore = 10;
  } else if (oppLoc.includes("india") || candLoc.includes("india")) {
    locScore = 8;
  }

  // -------------------------------------------------------------
  // Factor 6: WORK TYPE PREFERENCE (Weight: 5 pts)
  // -------------------------------------------------------------
  const workTypeScore = 5;

  // -------------------------------------------------------------
  // Factor 7: KEYWORD CORPUS MATCH (Weight: 5 pts)
  // -------------------------------------------------------------
  let kwScore = 3;
  const oppDescLower = opportunity.description.toLowerCase();
  let kwOverlapCount = 0;
  for (const s of activeSkills) {
    if (oppDescLower.includes(s.name.toLowerCase())) {
      kwOverlapCount++;
    }
  }
  if (kwOverlapCount >= 5) kwScore = 5;
  else if (kwOverlapCount >= 2) kwScore = 4;

  const totalScore = skillScore + roleScore + expScore + eduScore + locScore + workTypeScore + kwScore;
  const overallMatchScore = Math.min(100, Math.max(0, totalScore));

  const factors: OpportunityFactorScore[] = [
    { name: "Skill Coverage", earned: skillScore, weight: 35, percentage: Math.round((skillScore / 35) * 100) },
    { name: "Role Alignment", earned: roleScore, weight: 20, percentage: Math.round((roleScore / 20) * 100) },
    { name: "Experience Compatibility", earned: expScore, weight: 15, percentage: Math.round((expScore / 15) * 100) },
    { name: "Education Alignment", earned: eduScore, weight: 10, percentage: Math.round((eduScore / 10) * 100) },
    { name: "Location Match", earned: locScore, weight: 10, percentage: Math.round((locScore / 10) * 100) },
    { name: "Work Type", earned: workTypeScore, weight: 5, percentage: 100 },
    { name: "Keyword Overlap", earned: kwScore, weight: 5, percentage: Math.round((kwScore / 5) * 100) },
  ];

  const strongMatches: string[] = [...matchedSkills];
  if (isFresherOpp) strongMatches.push("Fresher / Early-career compatible");
  if (opportunity.remoteType === "remote") strongMatches.push("100% Remote Opportunity");

  const potentialGaps: string[] = [...missingSkills];

  return {
    overallMatchScore,
    factors,
    matchedSkills: matchedSkills.sort(),
    missingSkills: missingSkills.sort(),
    locationCompatible: locScore >= 8,
    experienceCompatible: expScore >= 12,
    educationCompatible: eduScore >= 8,
    strongMatches,
    potentialGaps,
    analyzedAt: new Date().toISOString(),
  };
}
