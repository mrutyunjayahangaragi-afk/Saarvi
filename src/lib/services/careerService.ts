import {
  CareerProfile,
  ResumeVersion,
  ResumeSnapshot,
  JobApplication,
  InterviewRecord,
  CareerSkill,
  CareerSkillCategory,
  ResumeValidationResult,
  AtsFriendlyCheckItem,
  SkillGapAnalysis,
  ResumeSectionId,
} from "@/types/career";
import { academicStorage } from "@/lib/academic/storage/academic-db";

const DEFAULT_PROFILE_ID = "default_career_profile";

export const DEFAULT_SECTION_ORDER: ResumeSectionId[] = [
  "summary",
  "education",
  "skills",
  "experience",
  "projects",
  "certifications",
  "hackathons",
  "achievements",
  "leadership",
  "volunteering",
  "languages",
  "additional",
];

export const ALL_SKILL_CATEGORIES: CareerSkillCategory[] = [
  "Programming Languages",
  "Frontend",
  "Backend",
  "Database",
  "Cloud",
  "DevOps",
  "AI/ML",
  "Tools",
  "Soft Skills",
  "Other",
];

export const ACTION_VERBS = [
  "Architected",
  "Built",
  "Configured",
  "Deployed",
  "Designed",
  "Developed",
  "Engineered",
  "Implemented",
  "Integrated",
  "Optimized",
  "Refactored",
  "Spearheaded",
  "Streamlined",
  "Trained",
  "Validated",
];

const STANDARD_ROLE_SKILLS: Record<string, { required: string[]; optional: string[] }> = {
  "Software Engineer": {
    required: ["Data Structures", "Algorithms", "Git", "Problem Solving", "Object-Oriented Programming"],
    optional: ["System Design", "SQL", "Docker", "Unit Testing", "CI/CD"],
  },
  "Frontend Developer": {
    required: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Responsive Design", "Git"],
    optional: ["Next.js", "Tailwind CSS", "Redux", "Web Performance", "Accessibility", "Jest"],
  },
  "Backend Developer": {
    required: ["Node.js", "Python", "REST APIs", "SQL", "Database Design", "Git"],
    optional: ["Docker", "PostgreSQL", "MongoDB", "Authentication", "Redis", "Microservices"],
  },
  "Full Stack Developer": {
    required: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "REST APIs", "Git"],
    optional: ["Next.js", "Docker", "PostgreSQL", "Tailwind CSS", "GraphQL", "AWS"],
  },
  "Data Scientist": {
    required: ["Python", "SQL", "Pandas", "NumPy", "Data Visualization", "Statistics"],
    optional: ["Machine Learning", "Scikit-Learn", "TensorFlow", "Deep Learning", "Tableau", "R"],
  },
  "DevOps Engineer": {
    required: ["Linux", "Docker", "CI/CD", "Git", "Bash", "Networking"],
    optional: ["Kubernetes", "AWS", "Terraform", "Ansible", "Monitoring", "Prometheus"],
  },
  "Mobile Developer": {
    required: ["Mobile UI", "REST APIs", "Git", "State Management", "Debugging"],
    optional: ["React Native", "Flutter", "Kotlin", "Swift", "Android Studio", "Firebase"],
  },
};

export const careerService = {
  // ==========================================
  // PROFILE MANAGEMENT
  // ==========================================
  async getOrCreateProfile(id?: string): Promise<CareerProfile> {
    const activeProfileId = academicStorage.getActiveProfileId();
    const effectiveId = (id && id !== DEFAULT_PROFILE_ID)
      ? id
      : (activeProfileId && activeProfileId !== 'guest')
        ? `career_${activeProfileId}`
        : DEFAULT_PROFILE_ID;

    const existing = await academicStorage.getCareerProfile(effectiveId);
    if (existing) return existing;

    const initial: CareerProfile = {
      id: effectiveId,
      fullName: "",
      professionalTitle: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      linkedin: "",
      github: "",
      portfolio: "",
      summary: "",
      skills: [],
      education: [],
      experience: [],
      projects: [],
      certifications: [],
      achievements: [],
      hackathons: [],
      volunteering: [],
      leadership: [],
      languages: [],
      additionalInfo: "",
      updatedAt: new Date().toISOString(),
    };

    return academicStorage.saveCareerProfile(initial);
  },

  async saveProfile(profile: CareerProfile): Promise<CareerProfile> {
    return academicStorage.saveCareerProfile(profile);
  },

  // ==========================================
  // LOCAL DATA SYNC (Academic, Projects, Certificates, Hackathons, Internships)
  // ==========================================
  async syncExistingDataToProfile(profile: CareerProfile): Promise<{
    profile: CareerProfile;
    imported: {
      education: number;
      certificates: number;
      hackathons: number;
      internships: number;
    };
  }> {
    const updated = { ...profile };
    const imported = { education: 0, certificates: 0, hackathons: 0, internships: 0 };

    // 1. Sync Academic Profile
    try {
      const academicProfiles = await academicStorage.getAllProfiles();
      if (academicProfiles.length > 0) {
        const acad = academicProfiles[0];
        const semRecords = await academicStorage.getSemesterRecords();
        let calculatedCgpa = "";
        if (semRecords.length > 0) {
          const totalCredits = semRecords.reduce((acc, s) => acc + (s.totalCredits || 0), 0);
          const weightedSgpa = semRecords.reduce((acc, s) => acc + (s.sgpa || 0) * (s.totalCredits || 0), 0);
          if (totalCredits > 0) {
            calculatedCgpa = (weightedSgpa / totalCredits).toFixed(2);
          }
        }

        const existingEduIdx = updated.education.findIndex(
          (e) => e.fieldOfStudy === acad.branch || e.institution.includes("VTU")
        );

        if (existingEduIdx === -1 && (acad.branch || acad.scheme)) {
          updated.education.push({
            id: `edu_sync_${Date.now()}`,
            institution: "Visvesvaraya Technological University (VTU)",
            degree: "Bachelor of Engineering (B.E.)",
            fieldOfStudy: acad.branch ? `${acad.branch} Engineering` : "Engineering",
            startDate: "2022",
            endDate: "2026",
            current: true,
            gpa: calculatedCgpa ? `${calculatedCgpa} CGPA` : undefined,
            scheme: acad.scheme,
            branch: acad.branch,
            currentSemester: acad.currentSemester,
            showOnResume: true,
          });
          imported.education++;
        }
      }
    } catch {}

    // 2. Sync Certificates
    try {
      const certs = await academicStorage.getCertificates();
      for (const c of certs) {
        if (!updated.certifications.some((uc) => uc.sourceRefId === c.id || uc.name === c.name)) {
          updated.certifications.push({
            id: `cert_sync_${c.id}`,
            name: c.name,
            issuer: c.issuer,
            date: c.issueDate,
            url: c.verificationUrl,
            credentialId: c.credentialId,
            sourceRefId: c.id,
            showOnResume: true,
          });
          imported.certificates++;
        }
      }
    } catch {}

    // 3. Sync Hackathons
    try {
      const hacks = await academicStorage.getHackathons();
      for (const h of hacks) {
        if (!updated.hackathons.some((uh) => uh.sourceRefId === h.id || uh.title === h.name)) {
          let outcome: "Winner" | "Runner-up" | "Finalist" | "Participant" = "Participant";
          if (h.status === "winner") {
            outcome = "Winner";
          } else if (h.status === "finalist") {
            outcome = "Finalist";
          }

          updated.hackathons.push({
            id: `hack_sync_${h.id}`,
            title: h.name,
            role: "Participant",
            outcome,
            projectTitle: h.teamName ? `Team: ${h.teamName}` : undefined,
            date: h.startDate || new Date().toISOString().split("T")[0],
            technologies: [],
            sourceRefId: h.id,
            showOnResume: true,
          });
          imported.hackathons++;
        }
      }
    } catch {}

    // 4. Sync Internships to Experience
    try {
      const internships = await academicStorage.getInternships();
      for (const intn of internships) {
        if (!updated.experience.some((ue) => ue.company === intn.company && ue.role === intn.role)) {
          updated.experience.push({
            id: `exp_sync_${intn.id}`,
            company: intn.company,
            role: intn.role,
            location: intn.location || "Remote",
            startDate: intn.applicationDate || new Date().toISOString().split("T")[0],
            current: intn.status === "offer",
            bullets: intn.notes ? [intn.notes] : [],
            type: "internship",
            showOnResume: true,
          });
          imported.internships++;
        }
      }
    } catch {}

    const saved = await academicStorage.saveCareerProfile(updated);
    return { profile: saved, imported };
  },

  // ==========================================
  // RESUME VERSION MANAGEMENT
  // ==========================================
  createDefaultResumeVersion(name: string = "General Resume", targetRole: string = "Software Engineer"): ResumeVersion {
    const enabledSections: Record<ResumeSectionId, boolean> = {
      contact: true,
      summary: true,
      education: true,
      skills: true,
      experience: true,
      projects: true,
      certifications: true,
      achievements: true,
      hackathons: true,
      leadership: false,
      volunteering: false,
      languages: false,
      additional: false,
    };

    return {
      id: `resume_v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      targetRole,
      template: "classic-ats",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      enabledSections,
      selectedEducationIds: [],
      selectedExperienceIds: [],
      selectedProjectIds: [],
      selectedSkillIds: [],
      selectedCertificationIds: [],
      selectedHackathonIds: [],
      selectedAchievementIds: [],
      selectedLeadershipIds: [],
      selectedVolunteeringIds: [],
      preferOnePage: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  // ==========================================
  // DETERMINISTIC RESUME VALIDATION & ATS CHECKS
  // ==========================================
  validateResume(profile: CareerProfile, version?: ResumeVersion): ResumeValidationResult {
    const checks: AtsFriendlyCheckItem[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Full name
    const hasName = Boolean(profile.fullName && profile.fullName.trim().length > 0);
    checks.push({
      id: "check-name",
      label: "Full Name Provided",
      passed: hasName,
      severity: "error",
      tip: hasName ? "Name is clearly specified for ATS header." : "Your full name is required.",
    });
    if (!hasName) errors.push("Your full name is missing.");

    // 2. Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasEmail = Boolean(profile.email && emailPattern.test(profile.email.trim()));
    checks.push({
      id: "check-email",
      label: "Valid Email Address",
      passed: hasEmail,
      severity: "error",
      tip: hasEmail ? "Valid email format detected." : "Provide a valid professional email address.",
    });
    if (!hasEmail) {
      if (!profile.email) errors.push("Email address is missing.");
      else errors.push("Email address appears invalid.");
    }

    // 3. Phone validation
    const hasPhone = Boolean(profile.phone && profile.phone.trim().length >= 7);
    checks.push({
      id: "check-phone",
      label: "Phone Contact Present",
      passed: hasPhone,
      severity: "warning",
      tip: hasPhone ? "Direct phone contact available." : "Include a phone number for recruiter contact.",
    });
    if (!hasPhone) warnings.push("Phone number is missing or unusually short.");

    // 4. Education or Experience
    const activeEdu = version
      ? profile.education.filter((e) => version.selectedEducationIds.length === 0 || version.selectedEducationIds.includes(e.id))
      : profile.education;
    const hasEdu = activeEdu.length > 0;
    checks.push({
      id: "check-education",
      label: "Education Record Included",
      passed: hasEdu,
      severity: "warning",
      tip: hasEdu ? `${activeEdu.length} education item(s) included.` : "Add at least one degree or institution.",
    });
    if (!hasEdu) warnings.push("Your resume contains no education entries.");

    // 5. Skills
    const activeSkills = version
      ? profile.skills.filter((s) => version.selectedSkillIds.length === 0 || version.selectedSkillIds.includes(s.id))
      : profile.skills;
    const hasSkills = activeSkills.length > 0;
    checks.push({
      id: "check-skills",
      label: "Key Skills Listed",
      passed: hasSkills,
      severity: "warning",
      tip: hasSkills ? `${activeSkills.length} skill(s) listed.` : "Add core technical and programming skills.",
    });
    if (!hasSkills) warnings.push("Your resume has no listed skills.");

    // 6. Projects or Experience
    const activeProjects = version
      ? profile.projects.filter((p) => version.selectedProjectIds.length === 0 || version.selectedProjectIds.includes(p.id))
      : profile.projects;
    const activeExp = version
      ? profile.experience.filter((e) => version.selectedExperienceIds.length === 0 || version.selectedExperienceIds.includes(e.id))
      : profile.experience;
    const hasProjectsOrExp = activeProjects.length > 0 || activeExp.length > 0;
    checks.push({
      id: "check-projects-experience",
      label: "Projects or Experience Present",
      passed: hasProjectsOrExp,
      severity: "warning",
      tip: hasProjectsOrExp
        ? `${activeProjects.length} project(s) & ${activeExp.length} experience(s).`
        : "Recruiters look for concrete projects or practical experience.",
    });
    if (!hasProjectsOrExp) warnings.push("Your resume has no projects or practical experience.");

    // 7. URLs validity
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    let urlIssues = false;
    if (profile.linkedin && !urlPattern.test(profile.linkedin.trim())) {
      urlIssues = true;
      warnings.push("LinkedIn URL appears malformed.");
    }
    if (profile.github && !urlPattern.test(profile.github.trim())) {
      urlIssues = true;
      warnings.push("GitHub URL appears malformed.");
    }
    checks.push({
      id: "check-links",
      label: "Valid Profile Links",
      passed: !urlIssues,
      severity: "info",
      tip: urlIssues ? "Ensure LinkedIn and GitHub profiles use standard URL format." : "Profile links are well-formed.",
    });

    // 8. Summary Length
    const summaryText = (version?.summaryOverride || profile.summary || "").trim();
    const summaryReasonable = summaryText.length <= 600;
    checks.push({
      id: "check-summary-len",
      label: "Concise Professional Summary",
      passed: summaryReasonable,
      severity: "info",
      tip: summaryReasonable ? "Summary length is concise and ATS-readable." : "Your summary is unusually long (>600 chars). Consider shortening.",
    });
    if (!summaryReasonable) warnings.push("Your summary is unusually long (>600 characters).");

    // 9. Completeness Score (0 - 100%)
    let score = 0;
    if (hasName) score += 15;
    if (hasEmail) score += 15;
    if (hasPhone) score += 10;
    if (profile.location) score += 5;
    if (profile.linkedin || profile.github) score += 5;
    if (summaryText.length > 20) score += 10;
    if (hasEdu) score += 15;
    if (hasSkills) score += 10;
    if (activeProjects.length > 0) score += 10;
    if (activeExp.length > 0 || profile.certifications.length > 0 || profile.hackathons.length > 0) score += 5;

    // Estimate page count
    const totalItems =
      activeEdu.length +
      activeExp.length +
      activeProjects.length +
      Math.ceil(activeSkills.length / 5) +
      profile.certifications.length +
      profile.hackathons.length;
    const estimatedPages = totalItems > 9 || summaryText.length > 400 ? 2 : 1;

    return {
      isValid: errors.length === 0,
      completenessScore: Math.min(100, score),
      checks,
      warnings,
      errors,
      estimatedPages,
    };
  },

  // ==========================================
  // DETERMINISTIC SUMMARY GENERATOR (NO AI)
  // ==========================================
  generateDeterministicSummary(params: {
    targetRole?: string;
    level?: string;
    specialization?: string;
    careerFocus?: string;
    topSkills?: string[];
  }): string {
    const role = params.targetRole?.trim() || "Software Engineer";
    const level = params.level?.trim() || "Dedicated engineering student";
    const spec = params.specialization?.trim();
    const focus = params.careerFocus?.trim();
    const skills = params.topSkills && params.topSkills.length > 0 ? params.topSkills.slice(0, 5).join(", ") : "";

    let sentence1 = `${level} pursuing roles in ${role}`;
    if (spec) {
      sentence1 += ` with strong specialization in ${spec}`;
    }
    sentence1 += ".";

    let sentence2 = "";
    if (focus) {
      sentence2 = ` Focused on ${focus}.`;
    }

    let sentence3 = "";
    if (skills) {
      sentence3 = ` Core technical strengths include ${skills}.`;
    }

    return `${sentence1}${sentence2}${sentence3}`;
  },

  // ==========================================
  // DETERMINISTIC BULLET POINT BUILDER (NO AI)
  // ==========================================
  generateDeterministicBullet(params: {
    actionVerb: string;
    technology?: string;
    outcome: string;
  }): string {
    const verb = params.actionVerb.trim() || "Built";
    const tech = params.technology?.trim();
    const outcome = params.outcome.trim();

    if (tech && outcome) {
      return `${verb} solutions using ${tech} to ${outcome}.`;
    } else if (tech) {
      return `${verb} features and workflows leveraging ${tech}.`;
    } else if (outcome) {
      return `${verb} deliverables to ${outcome}.`;
    }
    return `${verb} engineering components according to project requirements.`;
  },

  // ==========================================
  // SKILL GAP ANALYSIS (Deterministic O(N+M) with Sets)
  // ==========================================
  analyzeSkillGap(targetRole: string, userSkills: string[]): SkillGapAnalysis {
    const userSkillSet = new Set(userSkills.map((s) => s.trim().toLowerCase()));
    const roleConfig =
      STANDARD_ROLE_SKILLS[targetRole] || STANDARD_ROLE_SKILLS["Software Engineer"];

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    const optionalSkills: string[] = [];
    let matchedRequiredCount = 0;

    for (const req of roleConfig.required) {
      if (userSkillSet.has(req.toLowerCase())) {
        matchedSkills.push(req);
        matchedRequiredCount++;
      } else {
        missingSkills.push(req);
      }
    }

    for (const opt of roleConfig.optional) {
      if (userSkillSet.has(opt.toLowerCase())) {
        matchedSkills.push(opt);
      } else {
        optionalSkills.push(opt);
      }
    }

    const totalRequired = roleConfig.required.length;
    const matchPercentage =
      totalRequired > 0 ? Math.round((matchedRequiredCount / totalRequired) * 100) : 0;

    return {
      targetRole,
      matchedSkills,
      missingSkills,
      optionalSkills,
      matchPercentage,
    };
  },

  // ==========================================
  // APPLICATION FUNNEL CALCULATION
  // ==========================================
  calculateApplicationFunnel(applications: JobApplication[]) {
    const funnel = {
      SAVED: 0,
      APPLIED: 0,
      ONLINE_ASSESSMENT: 0,
      INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
      total: applications.length,
    };

    for (const app of applications) {
      if (funnel[app.status] !== undefined) {
        funnel[app.status]++;
      }
    }

    return funnel;
  },

  // ==========================================
  // DETERMINISTIC CAREER INSIGHTS
  // ==========================================
  generateCareerInsights(params: {
    applications: JobApplication[];
    interviews: InterviewRecord[];
    versions: ResumeVersion[];
    profile: CareerProfile;
  }): string[] {
    const insights: string[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    // Follow-ups due
    const followUpsDue = params.applications.filter(
      (a) => a.followUpDate && a.followUpDate <= todayStr && a.status !== "OFFER" && a.status !== "REJECTED" && a.status !== "WITHDRAWN"
    );
    if (followUpsDue.length > 0) {
      insights.push(`You have ${followUpsDue.length} application(s) awaiting follow-up.`);
    }

    // Upcoming interviews
    const upcomingInterviews = params.interviews.filter(
      (i) => i.date >= todayStr && i.status === "SCHEDULED"
    );
    if (upcomingInterviews.length > 0) {
      const nearest = upcomingInterviews.sort((a, b) => a.date.localeCompare(b.date))[0];
      insights.push(`Interview scheduled on ${nearest.date} with ${nearest.company} (${nearest.round}).`);
    }

    // Approaching deadlines
    const approachingDeadlines = params.applications.filter(
      (a) => a.deadline && a.deadline >= todayStr && a.status === "SAVED"
    );
    if (approachingDeadlines.length > 0) {
      insights.push(`${approachingDeadlines.length} saved job opportunity has an approaching application deadline.`);
    }

    // Profile quality
    if (params.profile.projects.length === 0) {
      insights.push("Your career profile has no projects listed yet. Adding projects improves resume impact.");
    }
    if (params.profile.skills.length < 5) {
      insights.push("You have fewer than 5 skills listed. Consider adding your primary programming languages and frameworks.");
    }

    return insights;
  },

  // ==========================================
  // DETERMINISTIC RESUME SNAPSHOT
  // ==========================================
  createSnapshot(
    version: ResumeVersion,
    profile: CareerProfile,
    pageCount: number
  ): ResumeSnapshot {
    return {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      resumeVersionId: version.id,
      versionName: version.name,
      targetRole: version.targetRole,
      template: version.template,
      exportedAt: new Date().toISOString(),
      pageCount,
      sectionOrder: [...version.sectionOrder],
      profileSnapshot: {
        fullName: profile.fullName,
        professionalTitle: profile.professionalTitle,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedin: profile.linkedin,
        github: profile.github,
        website: profile.website,
      },
      itemCounts: {
        education: profile.education.length,
        experience: profile.experience.length,
        projects: profile.projects.length,
        skills: profile.skills.length,
        certifications: profile.certifications.length,
        hackathons: profile.hackathons.length,
      },
    };
  },
};
