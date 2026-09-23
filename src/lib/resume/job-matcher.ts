/**
 * Saarvi Job-Specific Resume Matching Engine
 *
 * Implements deterministic Set intersection between candidate resume and job descriptions.
 * Produces actionable keyword alignment and skill gap suggestions without hallucinations.
 */

import type { CareerProfile, ResumeVersion } from "@/types/career";
import { TECHNICAL_SKILL_LEXICON } from "./parser/document-parser.ts";

export interface JobSpecificMatchResult {
  matchPercentage: number; // 0 - 100
  matchedSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  analyzedAt: string;
}

export function matchResumeAgainstJobDescription(
  profile: CareerProfile,
  jobDescription: string,
  version?: ResumeVersion | null
): JobSpecificMatchResult {
  if (!jobDescription || !jobDescription.trim()) {
    return {
      matchPercentage: 0,
      matchedSkills: [],
      missingSkills: [],
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: ["Paste a job description to calculate keyword match and skill gaps."],
      analyzedAt: new Date().toISOString(),
    };
  }

  const jdLower = ` ${jobDescription.toLowerCase().replace(/[^a-z0-9#+.]/g, " ")} `;

  // 1. Gather all candidate skills and full resume text
  const activeSkills = version && version.selectedSkillIds.length > 0
    ? profile.skills.filter((s) => version.selectedSkillIds.includes(s.id))
    : profile.skills;

  const candidateSkillNames = new Set(activeSkills.map((s) => s.name.toLowerCase()));

  const resumeFullCorpus = [
    profile.fullName,
    profile.professionalTitle,
    profile.summary,
    version?.summaryOverride,
    ...activeSkills.map((s) => s.name),
    ...profile.experience.flatMap((e) => [e.company, e.role, e.description, ...(e.bullets || [])]),
    ...profile.projects.flatMap((p) => [p.title, p.description, ...(p.technologies || []), ...(p.highlights || [])]),
    ...profile.education.flatMap((ed) => [ed.degree, ed.fieldOfStudy, ed.institution]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // 2. Identify skills mentioned in Job Description
  const jdRequiredSkills = new Set<string>();
  for (const skill of Object.keys(TECHNICAL_SKILL_LEXICON)) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<=[\\s,;()])${escaped}(?=[\\s,;().])`, "i");
    if (pattern.test(jdLower)) {
      jdRequiredSkills.add(skill);
    }
  }

  // 3. Set Intersection
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const reqSkill of jdRequiredSkills) {
    if (candidateSkillNames.has(reqSkill) || resumeFullCorpus.includes(reqSkill)) {
      const canonical = reqSkill.charAt(0).toUpperCase() + reqSkill.slice(1);
      matchedSkills.push(canonical);
    } else {
      const canonical = reqSkill.charAt(0).toUpperCase() + reqSkill.slice(1);
      missingSkills.push(canonical);
    }
  }

  // 4. Calculate deterministic match score
  const totalRequired = jdRequiredSkills.size;
  let matchPercentage = 100;
  if (totalRequired > 0) {
    matchPercentage = Math.round((matchedSkills.length / totalRequired) * 100);
  }

  // 5. Generate ethical, actionable suggestions
  const suggestions: string[] = [];
  if (missingSkills.length > 0) {
    const topMissing = missingSkills.slice(0, 3).join(", ");
    suggestions.push(
      `Job description mentions ${topMissing}. If you have practical experience or coursework in these areas, consider highlighting relevant projects on your resume.`
    );
  } else {
    suggestions.push(
      "Outstanding alignment! Your resume covers all core technical keywords identified in this job description."
    );
  }

  return {
    matchPercentage,
    matchedSkills: matchedSkills.sort(),
    missingSkills: missingSkills.sort(),
    matchedKeywords: matchedSkills,
    missingKeywords: missingSkills,
    suggestions,
    analyzedAt: new Date().toISOString(),
  };
}
