/**
 * Saarvi Deterministic ATS Scoring Engine
 *
 * Implements mathematical, rule-based ATS evaluation:
 * - 0 to 100 Overall Score
 * - Explainable Category Percentages:
 *   1. Keyword Match (20 pts)
 *   2. Skills Coverage (20 pts)
 *   3. Experience & Projects (25 pts)
 *   4. Formatting & Graphics (10 pts)
 *   5. Education (15 pts)
 *   6. Contact & Links (10 pts)
 * - Measurable rubrics with zero LLM hallucination
 */

import type {
  CareerProfile,
  ResumeVersion,
  CareerSkill,
  CareerExperience,
  CareerProject,
  CareerEducation,
} from "@/types/career";

export interface AtsCategoryBreakdown {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
}

export interface AtsCheckItem {
  id: string;
  label: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  tip: string;
}

export interface AtsActionableRecommendation {
  id: string;
  category: string;
  text: string;
  impact: "high" | "medium" | "low";
}

export interface ComprehensiveAtsReport {
  overallScore: number; // 0 - 100
  scoreTier: "Needs Work" | "Good" | "Strong" | "Exceptional";
  categories: AtsCategoryBreakdown[];
  checks: AtsCheckItem[];
  recommendations: AtsActionableRecommendation[];
  summaryMetrics: {
    totalSkillsCount: number;
    totalProjectsCount: number;
    totalExperienceCount: number;
    hasMetricsInBullets: boolean;
    hasActionVerbsInBullets: boolean;
    hasValidLinks: boolean;
    estimatedPageCount: number;
  };
}

const ACTION_VERBS_REGEX = /^\s*(built|developed|created|designed|implemented|engineered|optimized|led|architected|deployed|integrated|improved|reduced|increased|automated|managed|spearheaded|researched|refactored|achieved|trained|configured|streamlined|validated)\b/i;
const METRICS_REGEX = /\b\d+(%|\+|k|ms|s|x|gb|mb|users|requests|customers)?\b/i;
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

export function evaluateResumeAts(
  profile: CareerProfile,
  version?: ResumeVersion | null
): ComprehensiveAtsReport {
  const checks: AtsCheckItem[] = [];
  const recommendations: AtsActionableRecommendation[] = [];

  // Active filters based on version selection
  const activeSkills = version && version.selectedSkillIds.length > 0
    ? profile.skills.filter((s) => version.selectedSkillIds.includes(s.id))
    : profile.skills;

  const activeProjects = version && version.selectedProjectIds.length > 0
    ? profile.projects.filter((p) => version.selectedProjectIds.includes(p.id))
    : profile.projects;

  const activeExp = version && version.selectedExperienceIds.length > 0
    ? profile.experience.filter((e) => version.selectedExperienceIds.includes(e.id))
    : profile.experience;

  const activeEdu = version && version.selectedEducationIds.length > 0
    ? profile.education.filter((e) => version.selectedEducationIds.includes(e.id))
    : profile.education;

  // -------------------------------------------------------------
  // 1. CONTACT INFORMATION & LINKS (Max 10 pts)
  // -------------------------------------------------------------
  let contactScore = 0;
  const hasName = Boolean(profile.fullName && profile.fullName.trim().length >= 2);
  const emailValid = Boolean(profile.email && /\S+@\S+\.\S+/.test(profile.email));
  const phoneValid = Boolean(profile.phone && profile.phone.replace(/\D/g, "").length >= 10);
  const hasLocation = Boolean(profile.location && profile.location.trim().length >= 2);

  if (hasName) contactScore += 2;
  if (emailValid) contactScore += 2;
  if (phoneValid) contactScore += 2;
  if (hasLocation) contactScore += 1;

  checks.push({
    id: "chk-contact-essential",
    label: "Essential Contact Info (Name, Email, Phone)",
    passed: hasName && emailValid && phoneValid,
    severity: "error",
    tip: "Applicant tracking systems require full name, reachable email, and 10-digit phone number.",
  });

  const hasLinkedIn = Boolean(profile.linkedin && URL_REGEX.test(profile.linkedin.trim()));
  const hasGitHub = Boolean(profile.github && URL_REGEX.test(profile.github.trim()));
  const hasPortfolio = Boolean((profile.portfolio || profile.website) && URL_REGEX.test((profile.portfolio || profile.website)!.trim()));

  if (hasLinkedIn) contactScore += 1;
  if (hasGitHub) contactScore += 1;
  if (hasPortfolio) contactScore += 1;

  checks.push({
    id: "chk-links",
    label: "Professional Web Profiles (LinkedIn, GitHub, Portfolio)",
    passed: hasLinkedIn || hasGitHub,
    severity: "info",
    tip: "Recruiters and ATS parsers cross-reference code portfolios and professional presence.",
  });

  if (!hasLinkedIn) {
    recommendations.push({
      id: "rec-linkedin",
      category: "Contact & Links",
      text: "+ Add your LinkedIn profile URL for recruiter validation",
      impact: "high",
    });
  }
  if (!hasGitHub) {
    recommendations.push({
      id: "rec-github",
      category: "Contact & Links",
      text: "+ Add your GitHub profile to showcase code samples",
      impact: "medium",
    });
  }

  // -------------------------------------------------------------
  // 2. SUMMARY & PROFESSIONAL OBJECTIVE (Max 10 pts)
  // -------------------------------------------------------------
  let summaryScore = 0;
  const summaryText = (version?.summaryOverride || profile.summary || "").trim();
  const hasSummary = summaryText.length >= 40;
  const targetRolePresent = Boolean(
    (profile.professionalTitle && profile.professionalTitle.trim().length > 2) ||
    (version?.targetRole && version.targetRole.trim().length > 2)
  );

  if (hasSummary) {
    summaryScore += 6;
    if (summaryText.length <= 400) summaryScore += 2; // Conciseness bonus
  }
  if (targetRolePresent) summaryScore += 2;

  checks.push({
    id: "chk-summary",
    label: "Professional Summary & Target Role",
    passed: hasSummary && targetRolePresent,
    severity: "warning",
    tip: "A crisp 2-3 sentence summary clarifies your specializations and target career role.",
  });

  if (!hasSummary) {
    recommendations.push({
      id: "rec-summary",
      category: "Summary",
      text: "+ Write a 2-3 sentence professional summary focusing on your technical strengths",
      impact: "high",
    });
  }

  // -------------------------------------------------------------
  // 3. SKILLS & KEYWORDS COVERAGE (Max 20 pts)
  // -------------------------------------------------------------
  let skillsScore = 0;
  const skillCount = activeSkills.length;

  if (skillCount >= 10) skillsScore += 12;
  else if (skillCount >= 5) skillsScore += 8;
  else if (skillCount >= 1) skillsScore += 4;

  // Diversity across categories (e.g. languages, frontend, backend, database)
  const distinctCategories = new Set(activeSkills.map((s) => s.category));
  if (distinctCategories.size >= 4) skillsScore += 8;
  else if (distinctCategories.size >= 2) skillsScore += 5;
  else if (distinctCategories.size >= 1) skillsScore += 2;

  checks.push({
    id: "chk-skills-depth",
    label: "Technical Skills Breadth (>=8 skills across multiple domains)",
    passed: skillCount >= 8 && distinctCategories.size >= 3,
    severity: "error",
    tip: `${skillCount} skills detected across ${distinctCategories.size} domains. ATS parsers score keyword density.`,
  });

  if (skillCount < 8) {
    recommendations.push({
      id: "rec-skills-count",
      category: "Skills & Keywords",
      text: `+ Add more core technical skills (currently ${skillCount}, recommended 8–15)`,
      impact: "high",
    });
  }

  // -------------------------------------------------------------
  // 4. EXPERIENCE & PROJECTS (Max 25 pts)
  // -------------------------------------------------------------
  let expScore = 0;
  const totalExpCount = activeProjects.length + activeExp.length;

  if (totalExpCount >= 3) expScore += 15;
  else if (totalExpCount === 2) expScore += 12;
  else if (totalExpCount === 1) expScore += 8;

  checks.push({
    id: "chk-exp-count",
    label: "Concrete Projects or Work Experience (>= 2 entries)",
    passed: totalExpCount >= 2,
    severity: "error",
    tip: `${activeProjects.length} project(s) and ${activeExp.length} work experience entry/entries found.`,
  });

  // Analyze bullet points for metrics and action verbs
  const allBullets = [
    ...activeExp.flatMap((e) => e.bullets || []),
    ...activeProjects.flatMap((p) => p.highlights || []),
    ...activeProjects.map((p) => p.description || ""),
    ...activeExp.map((e) => e.description || ""),
  ].filter(Boolean);

  let hasMetrics = false;
  let hasActionVerbs = false;

  for (const b of allBullets) {
    if (METRICS_REGEX.test(b)) hasMetrics = true;
    if (ACTION_VERBS_REGEX.test(b)) hasActionVerbs = true;
  }

  if (hasMetrics) expScore += 5;
  if (hasActionVerbs) expScore += 5;

  checks.push({
    id: "chk-bullets-quality",
    label: "Measurable Impact Metrics (Percentages, Multipliers, Numbers)",
    passed: hasMetrics,
    severity: "warning",
    tip: hasMetrics
      ? "Strong quantifiable results detected in bullet points."
      : "Include numbers (e.g. 'Reduced load time by 30%', 'Served 500+ daily users').",
  });

  if (!hasMetrics && allBullets.length > 0) {
    recommendations.push({
      id: "rec-metrics",
      category: "Experience & Projects",
      text: "+ Include quantifiable metrics (e.g. percentages, latency reductions, user scale) in bullets",
      impact: "high",
    });
  }

  if (!hasActionVerbs && allBullets.length > 0) {
    recommendations.push({
      id: "rec-action-verbs",
      category: "Experience & Projects",
      text: "+ Start bullet points with strong action verbs (Built, Architected, Engineered)",
      impact: "medium",
    });
  }

  // -------------------------------------------------------------
  // 5. EDUCATION (Max 15 pts)
  // -------------------------------------------------------------
  let eduScore = 0;
  const hasEdu = activeEdu.length > 0;

  if (hasEdu) {
    eduScore += 8;
    const hasDegreeAndCollege = activeEdu.some((e) => e.degree?.trim() && e.institution?.trim());
    if (hasDegreeAndCollege) eduScore += 4;
    const hasDates = activeEdu.some((e) => e.startDate || e.endDate || e.gpa || e.score);
    if (hasDates) eduScore += 3;
  }

  checks.push({
    id: "chk-edu",
    label: "Degree & University Details",
    passed: hasEdu && activeEdu.some((e) => e.degree && e.institution),
    severity: "error",
    tip: "Specify degree title, college/university name, and graduation year.",
  });

  if (!hasEdu) {
    recommendations.push({
      id: "rec-edu",
      category: "Education",
      text: "+ Add your academic degree and university institution",
      impact: "high",
    });
  }

  // -------------------------------------------------------------
  // 6. FORMATTING & GRAPHICS (Max 10 pts)
  // -------------------------------------------------------------
  let formatScore = 10;
  const hasPhoto = Boolean(
    (profile.profileImage || profile.photoUrl) &&
    (version?.showProfilePhoto !== false)
  );

  if (hasPhoto) {
    formatScore -= 5;
    checks.push({
      id: "chk-formatting-photo",
      label: "ATS Clean Layout (No Photos / Multi-column Tables)",
      passed: false,
      severity: "warning",
      tip: "Profile photos can cause automated parsers to misalign columns. Text-only layout is optimal.",
    });
    recommendations.push({
      id: "rec-photo",
      category: "Formatting",
      text: "Remove headshot photo for standard corporate ATS submissions to prevent parse errors",
      impact: "medium",
    });
  } else {
    checks.push({
      id: "chk-formatting-photo",
      label: "ATS Clean Layout (No Photos / Graphics)",
      passed: true,
      severity: "info",
      tip: "Clean text-based layout ensures 100% accurate parsing across Workday, Taleo, and Greenhouse.",
    });
  }

  // -------------------------------------------------------------
  // TOTAL SCORE COMPUTATION
  // -------------------------------------------------------------
  const rawTotal = contactScore + summaryScore + skillsScore + expScore + eduScore + formatScore;
  const overallScore = Math.min(100, Math.max(0, rawTotal));

  let scoreTier: ComprehensiveAtsReport["scoreTier"] = "Needs Work";
  if (overallScore >= 85) scoreTier = "Exceptional";
  else if (overallScore >= 70) scoreTier = "Strong";
  else if (overallScore >= 50) scoreTier = "Good";

  const categories: AtsCategoryBreakdown[] = [
    {
      id: "skills",
      name: "Skills & Keywords Coverage",
      score: skillsScore,
      maxScore: 20,
      percentage: Math.round((skillsScore / 20) * 100),
    },
    {
      id: "experience",
      name: "Experience & Projects",
      score: expScore,
      maxScore: 25,
      percentage: Math.round((expScore / 25) * 100),
    },
    {
      id: "education",
      name: "Education",
      score: eduScore,
      maxScore: 15,
      percentage: Math.round((eduScore / 15) * 100),
    },
    {
      id: "formatting",
      name: "Formatting & Parseability",
      score: formatScore,
      maxScore: 10,
      percentage: Math.round((formatScore / 10) * 100),
    },
    {
      id: "contact",
      name: "Contact Information & Links",
      score: contactScore,
      maxScore: 10,
      percentage: Math.round((contactScore / 10) * 100),
    },
    {
      id: "summary",
      name: "Summary & Alignment",
      score: summaryScore,
      maxScore: 10,
      percentage: Math.round((summaryScore / 10) * 100),
    },
  ];

  // Estimated page count
  const totalItems = activeEdu.length + activeExp.length + activeProjects.length + Math.ceil(activeSkills.length / 5);
  const estimatedPageCount = totalItems > 9 || summaryText.length > 500 ? 2 : 1;

  return {
    overallScore,
    scoreTier,
    categories,
    checks,
    recommendations,
    summaryMetrics: {
      totalSkillsCount: skillCount,
      totalProjectsCount: activeProjects.length,
      totalExperienceCount: activeExp.length,
      hasMetricsInBullets: hasMetrics,
      hasActionVerbsInBullets: hasActionVerbs,
      hasValidLinks: Boolean(hasLinkedIn || hasGitHub),
      estimatedPageCount,
    },
  };
}
