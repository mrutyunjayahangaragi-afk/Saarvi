import type { CareerProfile, ResumeSectionId, ResumeVersion } from "@/types/career";

export type WizardStepId =
  | "contact"
  | "summary"
  | "education"
  | "experience"
  | "projects"
  | "skills"
  | "certifications"
  | "hackathons"
  | "achievements"
  | "leadership"
  | "volunteering"
  | "languages"
  | "additional"
  | "review";

export type SectionLevel = "CORE" | "RECOMMENDED" | "OPTIONAL";

export type SectionStatus =
  | "completed"
  | "current"
  | "not_started"
  | "skipped"
  | "not_applicable";

export type ResumeReadinessState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_TO_EXPORT";

export interface WizardStep {
  id: WizardStepId;
  sectionId?: ResumeSectionId;
  targetId: string; // e.g. "resume-personal"
  label: string;
  shortDesc: string;
  level: SectionLevel;
  status: SectionStatus;
  isComplete: boolean;
  isSkipped: boolean;
  isNotApplicable: boolean;
  stepNumber: number;
  badgeText: string;
  canSkip: boolean;
  canMarkNotApplicable: boolean;
}

export interface ResumeCompletionReport {
  steps: WizardStep[];
  percentage: number;
  totalSteps: number;
  completedSteps: number;
  completedCore: number;
  totalCore: number;
  completedRecommended: number;
  totalRecommended: number;
  optionalAdded: number;
  totalOptional: number;
  skippedCount: number;
  readinessState: ResumeReadinessState;
  readinessMessage: string;
  nextRecommendedStep: WizardStep | null;
  firstIncompleteMeaningfulStep: WizardStep | null;
  missingOptionalSteps: WizardStep[];
  canExport: boolean;
  exportBlockingReasons: string[];
}

export interface ExportValidationResult {
  isValid: boolean;
  missingSection: WizardStepId | null;
  missingField: string | null;
  message: string | null;
}

export const WIZARD_STEP_DEFINITIONS: Array<{
  id: WizardStepId;
  sectionId?: ResumeSectionId;
  targetId: string;
  label: string;
  shortDesc: string;
  level: SectionLevel;
  canSkip: boolean;
  canMarkNotApplicable: boolean;
}> = [
  {
    id: "contact",
    sectionId: "contact",
    targetId: "resume-personal",
    label: "Personal Information",
    shortDesc: "Name, title, email, phone, and professional links.",
    level: "CORE",
    canSkip: false,
    canMarkNotApplicable: false,
  },
  {
    id: "summary",
    sectionId: "summary",
    targetId: "resume-summary",
    label: "Professional Summary",
    shortDesc: "2–4 lines describing your background, strengths and direction.",
    level: "RECOMMENDED",
    canSkip: true,
    canMarkNotApplicable: false,
  },
  {
    id: "education",
    sectionId: "education",
    targetId: "resume-education",
    label: "Education & Academics",
    shortDesc: "College, degree, branch, dates, and CGPA.",
    level: "RECOMMENDED",
    canSkip: true,
    canMarkNotApplicable: false,
  },
  {
    id: "experience",
    sectionId: "experience",
    targetId: "resume-experience",
    label: "Work Experience",
    shortDesc: "Internships, full-time roles, or select 'No experience yet'.",
    level: "RECOMMENDED",
    canSkip: true,
    canMarkNotApplicable: true,
  },
  {
    id: "projects",
    sectionId: "projects",
    targetId: "resume-projects",
    label: "Technical Projects",
    shortDesc: "Key projects, technologies used, live and GitHub links.",
    level: "RECOMMENDED",
    canSkip: true,
    canMarkNotApplicable: false,
  },
  {
    id: "skills",
    sectionId: "skills",
    targetId: "resume-skills",
    label: "Technical Skills",
    shortDesc: "Languages, frameworks, tools, and technical competencies.",
    level: "RECOMMENDED",
    canSkip: true,
    canMarkNotApplicable: false,
  },
  {
    id: "certifications",
    sectionId: "certifications",
    targetId: "resume-certifications",
    label: "Certifications",
    shortDesc: "Industry credentials, course completions, and licenses.",
    level: "OPTIONAL",
    canSkip: true,
    canMarkNotApplicable: true,
  },
  {
    id: "leadership",
    sectionId: "leadership",
    targetId: "resume-leadership",
    label: "Leadership & Activities",
    shortDesc: "Club positions, student representation, and initiatives.",
    level: "OPTIONAL",
    canSkip: true,
    canMarkNotApplicable: true,
  },
  {
    id: "volunteering",
    sectionId: "volunteering",
    targetId: "resume-volunteering",
    label: "Volunteering",
    shortDesc: "Community service, social initiatives, and outreach.",
    level: "OPTIONAL",
    canSkip: true,
    canMarkNotApplicable: true,
  },
  {
    id: "languages",
    sectionId: "languages",
    targetId: "resume-languages",
    label: "Languages",
    shortDesc: "Languages spoken and proficiency levels.",
    level: "OPTIONAL",
    canSkip: true,
    canMarkNotApplicable: true,
  },
  {
    id: "additional",
    sectionId: "additional",
    targetId: "resume-additional",
    label: "Additional Information",
    shortDesc: "Awards, publications, memberships, or interests.",
    level: "OPTIONAL",
    canSkip: true,
    canMarkNotApplicable: true,
  },
  {
    id: "review",
    targetId: "resume-review",
    label: "Review & Export",
    shortDesc: "Verify your completed sections and export your resume.",
    level: "RECOMMENDED",
    canSkip: false,
    canMarkNotApplicable: false,
  },
];

export const resumeCompletionService = {
  /**
   * Validate email format reasonably without over-rejecting international addresses
   */
  isValidEmail(email?: string): boolean {
    if (!email) return false;
    const trimmed = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  },

  /**
   * Check whether a specific step's data is completed in the profile
   */
  isStepComplete(stepId: WizardStepId, profile: CareerProfile, version?: ResumeVersion): boolean {
    switch (stepId) {
      case "contact": {
        const hasName = Boolean(profile.fullName && profile.fullName.trim().length > 0);
        const hasValidEmail = this.isValidEmail(profile.email);
        return hasName && hasValidEmail;
      }
      case "summary": {
        const summary = (version?.summaryOverride || profile.summary || "").trim();
        return summary.length >= 15;
      }
      case "education": {
        return (profile.education || []).some(
          (e) => Boolean(e.institution?.trim()) && Boolean(e.degree?.trim())
        );
      }
      case "experience": {
        return (profile.experience || []).some(
          (e) => Boolean(e.company?.trim()) && Boolean(e.role?.trim())
        );
      }
      case "projects": {
        return (profile.projects || []).some((p) => Boolean(p.title?.trim()));
      }
      case "skills": {
        return (profile.skills || []).length > 0;
      }
      case "certifications": {
        return (profile.certifications || []).some((c) => Boolean(c.name?.trim()));
      }
      case "hackathons": {
        return (profile.hackathons || []).some((h) => Boolean(h.title?.trim()));
      }
      case "achievements": {
        return (profile.achievements || []).some((a) => Boolean(a.title?.trim()));
      }
      case "leadership": {
        return (profile.leadership || []).some(
          (l) => Boolean(l.organization?.trim()) && Boolean(l.title?.trim() || l.role?.trim())
        );
      }
      case "volunteering": {
        return (profile.volunteering || []).some(
          (v) => Boolean(v.organization?.trim()) && Boolean(v.role?.trim())
        );
      }
      case "languages": {
        return (profile.languages || []).some((l) => Boolean(l.name?.trim()));
      }
      case "additional": {
        const hasText = Boolean(profile.additionalInfo && profile.additionalInfo.trim().length > 0);
        const hasItems = (profile.additionalItems || []).some((i) => Boolean(i.title?.trim() || i.value?.trim()));
        return hasText || hasItems;
      }
      case "review": {
        return this.isStepComplete("contact", profile, version);
      }
      default:
        return false;
    }
  },

  /**
   * Calculate all steps with their status, badges, and completion flags
   */
  calculateSteps(
    profile: CareerProfile,
    version?: ResumeVersion,
    activeStepId: WizardStepId = "contact",
    skippedSet: Set<string> = new Set(),
    notApplicableSet: Set<string> = new Set()
  ): WizardStep[] {
    return WIZARD_STEP_DEFINITIONS.map((def, index) => {
      const isComplete = this.isStepComplete(def.id, profile, version);
      const isSkipped = skippedSet.has(def.id);
      const isNotApplicable = notApplicableSet.has(def.id);

      let status: SectionStatus = "not_started";
      if (isComplete) {
        status = "completed";
      } else if (isNotApplicable) {
        status = "not_applicable";
      } else if (isSkipped) {
        status = "skipped";
      } else if (activeStepId === def.id) {
        status = "current";
      }

      let badgeText: string = def.level;
      if (status === "completed") {
        badgeText = "Completed";
      } else if (status === "skipped") {
        badgeText = "Skipped";
      } else if (status === "not_applicable") {
        badgeText = "N/A";
      }

      return {
        id: def.id,
        sectionId: def.sectionId,
        targetId: def.targetId,
        label: def.label,
        shortDesc: def.shortDesc,
        level: def.level,
        status,
        isComplete,
        isSkipped,
        isNotApplicable,
        stepNumber: index + 1,
        badgeText,
        canSkip: def.canSkip,
        canMarkNotApplicable: def.canMarkNotApplicable,
      };
    });
  },

  /**
   * Deterministic completion score and comprehensive status report
   */
  generateReport(
    profile: CareerProfile,
    version?: ResumeVersion,
    activeStepId: WizardStepId = "contact",
    skippedSet: Set<string> = new Set(),
    notApplicableSet: Set<string> = new Set()
  ): ResumeCompletionReport {
    const steps = this.calculateSteps(profile, version, activeStepId, skippedSet, notApplicableSet);

    // Core steps calculation
    const coreSteps = steps.filter((s) => s.level === "CORE");
    const completedCore = coreSteps.filter((s) => s.isComplete).length;
    const totalCore = coreSteps.length;

    // Recommended steps (excluding review from denominator calculation)
    const recommendedContentSteps = steps.filter(
      (s) => s.level === "RECOMMENDED" && s.id !== "review"
    );
    const totalRecommended = recommendedContentSteps.length;
    const completedRecommended = recommendedContentSteps.filter((s) => s.isComplete).length;

    // Optional steps
    const optionalSteps = steps.filter((s) => s.level === "OPTIONAL");
    const totalOptional = optionalSteps.length;
    const optionalAdded = optionalSteps.filter((s) => s.isComplete).length;
    const skippedCount = steps.filter((s) => s.isSkipped || s.isNotApplicable).length;

    // Deterministic progress calculation
    // Core weight: 35 points
    let corePoints = 0;
    if (this.isValidEmail(profile.email)) corePoints += 17;
    if (profile.fullName && profile.fullName.trim().length > 0) corePoints += 18;

    // Recommended weight: 50 points
    // Breakdown:
    // - Education: 15
    // - Experience OR Projects (Practical path): 15
    //   If Experience has entries -> 15.
    //   If Experience is marked skipped/N/A ("No experience yet") AND Projects has entries -> 15.
    //   If both have entries -> 15 points + 5 bonus points from projects pool.
    // - Skills: 10
    // - Summary: 10
    let recPoints = 0;

    const hasEducation = this.isStepComplete("education", profile, version);
    const hasExp = this.isStepComplete("experience", profile, version);
    const hasProjects = this.isStepComplete("projects", profile, version);
    const hasSkills = this.isStepComplete("skills", profile, version);
    const hasSummary = this.isStepComplete("summary", profile, version);
    const expSkipped = skippedSet.has("experience") || notApplicableSet.has("experience");

    if (hasEducation) recPoints += 15;
    if (hasSkills) recPoints += 10;
    if (hasSummary) recPoints += 10;

    if (hasExp && hasProjects) {
      recPoints += 15; // full practical path
    } else if (hasExp) {
      recPoints += 15;
    } else if (hasProjects) {
      recPoints += 15; // valid fresher/project path
    } else if (expSkipped) {
      // Experience intentionally skipped, user is directed to projects
      // points will be added when projects are added
    }

    // Optional weight: 15 points
    // User can achieve full 100% if they either add optional items OR intentionally skip them!
    // Each completed optional adds 3 points (up to 15).
    // If all remaining optional sections are skipped or marked not applicable, they do NOT hold back completion!
    const unaddressedOptional = optionalSteps.filter(
      (s) => !s.isComplete && !s.isSkipped && !s.isNotApplicable
    );

    let optionalPoints = optionalAdded * 3;
    if (optionalPoints > 15) optionalPoints = 15;

    // If core and recommended paths are fully satisfied, and all optional sections have been either
    // added or explicitly skipped/not applicable, the resume is 100% complete!
    const coreDone = completedCore === totalCore;
    const practicalPathDone = (hasExp || hasProjects || expSkipped) && (hasProjects || hasExp);
    const recDone = hasEducation && hasSkills && practicalPathDone;

    let percentage = corePoints + recPoints + optionalPoints;

    if (coreDone && recDone) {
      if (unaddressedOptional.length === 0) {
        percentage = 100;
      } else {
        // scale between current points and 95% if some optional are not yet visited
        percentage = Math.min(95, Math.max(80, percentage));
      }
    } else {
      percentage = Math.min(90, percentage);
    }

    // Never exceed 100 or fall below 0
    percentage = Math.max(0, Math.min(100, Math.round(percentage)));

    // Readiness determination
    let readinessState: ResumeReadinessState = "NOT_STARTED";
    let readinessMessage = "Begin by adding your contact details to start your resume.";
    const exportBlockingReasons: string[] = [];

    if (!profile.fullName || profile.fullName.trim().length === 0) {
      exportBlockingReasons.push("Full Name is required.");
    }
    if (!this.isValidEmail(profile.email)) {
      exportBlockingReasons.push("A valid email address is required.");
    }

    const canExport = exportBlockingReasons.length === 0;

    if (!canExport) {
      readinessState = percentage > 0 ? "IN_PROGRESS" : "NOT_STARTED";
      readinessMessage = "Complete your core contact information to enable resume export.";
    } else {
      if (percentage >= 80 || (coreDone && recDone)) {
        readinessState = "READY_TO_EXPORT";
        const skippedOptional = optionalSteps.filter((s) => s.isSkipped || s.isNotApplicable).length;
        if (skippedOptional > 0) {
          readinessMessage = "Your resume has all essential information and is ready to export. Skipped optional sections will not appear on your resume.";
        } else {
          readinessMessage = "Your resume is fully completed and ready to export.";
        }
      } else {
        readinessState = "IN_PROGRESS";
        readinessMessage = "Your resume has essential contact info. Complete recommended sections to make your resume stand out.";
      }
    }

    // Calculate next recommended step
    let nextRecommendedStep: WizardStep | null = null;
    if (!this.isStepComplete("contact", profile, version)) {
      nextRecommendedStep = steps.find((s) => s.id === "contact") || null;
    } else if (!hasSummary && !skippedSet.has("summary")) {
      nextRecommendedStep = steps.find((s) => s.id === "summary") || null;
    } else if (!hasEducation && !skippedSet.has("education")) {
      nextRecommendedStep = steps.find((s) => s.id === "education") || null;
    } else if (!hasExp && !expSkipped) {
      nextRecommendedStep = steps.find((s) => s.id === "experience") || null;
    } else if (!hasProjects && !skippedSet.has("projects")) {
      nextRecommendedStep = steps.find((s) => s.id === "projects") || null;
    } else if (!hasSkills && !skippedSet.has("skills")) {
      nextRecommendedStep = steps.find((s) => s.id === "skills") || null;
    } else {
      // Look for first unaddressed optional
      nextRecommendedStep =
        steps.find(
          (s) => s.level === "OPTIONAL" && !s.isComplete && !s.isSkipped && !s.isNotApplicable
        ) || steps.find((s) => s.id === "review") || null;
    }

    // Calculate first incomplete meaningful step on return
    let firstIncompleteMeaningfulStep: WizardStep | null = null;
    if (!this.isStepComplete("contact", profile, version)) {
      firstIncompleteMeaningfulStep = steps.find((s) => s.id === "contact") || null;
    } else if (!hasEducation && !skippedSet.has("education")) {
      firstIncompleteMeaningfulStep = steps.find((s) => s.id === "education") || null;
    } else if (!hasExp && !expSkipped && !hasProjects) {
      firstIncompleteMeaningfulStep = steps.find((s) => s.id === "experience") || null;
    } else if (!hasProjects && !skippedSet.has("projects")) {
      firstIncompleteMeaningfulStep = steps.find((s) => s.id === "projects") || null;
    } else if (!hasSkills && !skippedSet.has("skills")) {
      firstIncompleteMeaningfulStep = steps.find((s) => s.id === "skills") || null;
    } else if (!hasSummary && !skippedSet.has("summary")) {
      firstIncompleteMeaningfulStep = steps.find((s) => s.id === "summary") || null;
    } else {
      firstIncompleteMeaningfulStep = steps.find((s) => s.id === "review") || null;
    }

    // Missing optional steps
    const missingOptionalSteps = optionalSteps.filter(
      (s) => !s.isComplete && !s.isSkipped && !s.isNotApplicable
    );

    return {
      steps,
      percentage,
      totalSteps: steps.length,
      completedSteps: steps.filter((s) => s.isComplete).length,
      completedCore,
      totalCore,
      completedRecommended,
      totalRecommended,
      optionalAdded,
      totalOptional,
      skippedCount,
      readinessState,
      readinessMessage,
      nextRecommendedStep,
      firstIncompleteMeaningfulStep,
      missingOptionalSteps,
      canExport,
      exportBlockingReasons,
    };
  },

  /**
   * Determine the subsequent step when completing or continuing from current step
   */
  getNextStepAfter(
    currentStepId: WizardStepId,
    profile: CareerProfile,
    version?: ResumeVersion,
    skippedSet: Set<string> = new Set(),
    notApplicableSet: Set<string> = new Set()
  ): WizardStepId {
    const sequence: WizardStepId[] = [
      "contact",
      "summary",
      "education",
      "experience",
      "projects",
      "skills",
      "certifications",
      "hackathons",
      "achievements",
      "leadership",
      "volunteering",
      "languages",
      "additional",
      "review",
    ];

    const currentIndex = sequence.indexOf(currentStepId);
    if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
      return "review";
    }

    // Adaptive branch:
    // If on experience and experience is empty or marked skipped, navigate directly to projects
    if (currentStepId === "experience") {
      const hasExp = this.isStepComplete("experience", profile, version);
      const isExpSkipped = skippedSet.has("experience") || notApplicableSet.has("experience");
      if (!hasExp || isExpSkipped) {
        return "projects";
      }
    }

    // Find next non-skipped or meaningful step
    for (let i = currentIndex + 1; i < sequence.length; i++) {
      const stepId = sequence[i];
      if (stepId === "review") return "review";

      // If optional and marked skipped or not applicable, continue forward
      const isSkipped = skippedSet.has(stepId) || notApplicableSet.has(stepId);
      if (!isSkipped) {
        return stepId;
      }
    }

    return "review";
  },

  /**
   * Strict Core Export Validator
   * Never blocks on optional sections; identifies exact field for auto-focus
   */
  validateForExport(profile: CareerProfile): ExportValidationResult {
    if (!profile.fullName || profile.fullName.trim().length === 0) {
      return {
        isValid: false,
        missingSection: "contact",
        missingField: "fullName",
        message: "Please enter your Full Name in Personal Information before downloading your resume.",
      };
    }

    if (!profile.email || profile.email.trim().length === 0) {
      return {
        isValid: false,
        missingSection: "contact",
        missingField: "email",
        message: "Please provide an Email Address in Personal Information before downloading your resume.",
      };
    }

    if (!this.isValidEmail(profile.email)) {
      return {
        isValid: false,
        missingSection: "contact",
        missingField: "email",
        message: "Please enter a valid Email Address (e.g. name@example.com) in Personal Information.",
      };
    }

    return {
      isValid: true,
      missingSection: null,
      missingField: null,
      message: null,
    };
  },
};
