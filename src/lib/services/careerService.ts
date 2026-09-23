import type {
  CareerProfile,
  ResumeVersion,
  ResumeSnapshot,
  JobApplication,
  InterviewRecord,
  CareerSkill,
  CareerSkillCategory,
  ResumeValidationResult,
  AtsFriendlyCheckItem,
  AtsCategoryScore,
  AtsRecommendation,
  SkillGapAnalysis,
  ResumeSectionId,
  JobMatchResult,
  JobApplicationStatus,
} from "@/types/career";
import { academicStorage } from "../academic/storage/academic-db";

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
    const recommendations: AtsRecommendation[] = [];

    // --- 1. CONTACT INFORMATION (Max 15) ---
    let contactScore = 0;
    const hasName = Boolean(profile.fullName && profile.fullName.trim().length > 0);
    checks.push({
      id: "check-name",
      label: "Full Name Provided",
      passed: hasName,
      severity: "error",
      tip: hasName ? "Name is clearly specified for ATS header." : "Your full name is required.",
    });
    if (hasName) contactScore += 5;
    else errors.push("Your full name is missing.");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasEmail = Boolean(profile.email && emailPattern.test(profile.email.trim()));
    checks.push({
      id: "check-email",
      label: "Valid Email Address",
      passed: hasEmail,
      severity: "error",
      tip: hasEmail ? "Valid email format detected." : "Provide a valid professional email address.",
    });
    if (hasEmail) contactScore += 5;
    else {
      if (!profile.email) errors.push("Email address is missing.");
      else errors.push("Email address appears invalid.");
    }

    const hasPhone = Boolean(profile.phone && profile.phone.trim().length >= 7);
    checks.push({
      id: "check-phone",
      label: "Phone Contact Present",
      passed: hasPhone,
      severity: "warning",
      tip: hasPhone ? "Direct phone contact available." : "Include a phone number for recruiter contact.",
    });
    if (hasPhone) contactScore += 3;
    else {
      warnings.push("Phone number is missing or unusually short.");
      recommendations.push({
        id: "rec-phone",
        category: "Contact Information",
        text: "+ Add a phone number for direct recruiter contact",
        impact: "medium",
      });
    }

    const hasLocation = Boolean(profile.location && profile.location.trim().length > 0);
    if (hasLocation) contactScore += 2;
    else {
      recommendations.push({
        id: "rec-location",
        category: "Contact Information",
        text: "+ Include your city and state/country for recruiter location filters",
        impact: "low",
      });
    }

    // --- 2. SUMMARY & ROLE ALIGNMENT (Max 15) ---
    let summaryScore = 0;
    const summaryText = (version?.summaryOverride || profile.summary || "").trim();
    const hasSummary = summaryText.length >= 15;
    const isOptimalLength = summaryText.length >= 50 && summaryText.length <= 500;
    const targetRole = version?.targetRole?.trim() || profile.professionalTitle?.trim() || "";
    
    // Check keyword alignment with target role or common industry terms
    const summaryLower = summaryText.toLowerCase();
    const roleTokens = targetRole.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const hasRoleKeyword = roleTokens.length > 0 && roleTokens.some((token) => summaryLower.includes(token));
    const hasTechIndustryKeywords = /(engineer|developer|software|analyst|frontend|backend|fullstack|data|machine learning|cloud|design|student|architect)/i.test(summaryText);
    const roleAligned = hasRoleKeyword || hasTechIndustryKeywords;

    if (hasSummary) summaryScore += 5;
    if (isOptimalLength) summaryScore += 5;
    if (roleAligned && hasSummary) summaryScore += 5;

    checks.push({
      id: "check-summary-len",
      label: "Concise Professional Summary",
      passed: hasSummary && summaryText.length <= 600,
      severity: "info",
      tip: hasSummary
        ? summaryText.length <= 600
          ? "Summary length is concise and ATS-readable."
          : "Your summary is unusually long (>600 chars). Consider shortening."
        : "Add a 2-3 sentence summary outlining your core strengths.",
    });
    if (summaryText.length > 600) warnings.push("Your summary is unusually long (>600 characters).");

    if (!hasSummary) {
      recommendations.push({
        id: "rec-summary-add",
        category: "Summary & Role Alignment",
        text: "+ Add a targeted 2-3 sentence professional summary",
        impact: "high",
      });
    } else {
      if (summaryText.length < 50) {
        recommendations.push({
          id: "rec-summary-expand",
          category: "Summary & Role Alignment",
          text: "+ Expand your summary to at least 50 characters to highlight key strengths",
          impact: "medium",
        });
      }
      if (summaryText.length > 500) {
        recommendations.push({
          id: "rec-summary-trim",
          category: "Summary & Role Alignment",
          text: "+ Shorten summary to under 500 characters for optimal ATS scanning",
          impact: "low",
        });
      }
      if (!roleAligned) {
        recommendations.push({
          id: "rec-summary-role",
          category: "Summary & Role Alignment",
          text: `+ Mention your target role "${targetRole || 'Software Engineer'}" in your summary`,
          impact: "medium",
        });
      }
    }

    // --- 3. SKILLS & KEYWORDS (Max 20) ---
    let skillsScore = 0;
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

    if (activeSkills.length >= 8) {
      skillsScore += 15;
    } else if (activeSkills.length >= 5) {
      skillsScore += 10;
    } else {
      skillsScore += activeSkills.length * 2;
    }

    const uniqueCategories = new Set(activeSkills.map((s) => s.category).filter(Boolean));
    if (uniqueCategories.size >= 2) {
      skillsScore += 5;
    } else if (activeSkills.length > 0) {
      skillsScore += 2;
    }

    if (activeSkills.length < 5) {
      recommendations.push({
        id: "rec-skills-5",
        category: "Skills & Keywords",
        text: `+ Add at least 5 core technical skills (currently ${activeSkills.length})`,
        impact: "high",
      });
    } else if (activeSkills.length < 8) {
      recommendations.push({
        id: "rec-skills-8",
        category: "Skills & Keywords",
        text: `+ Add 8+ technical skills for comprehensive keyword matching (currently ${activeSkills.length}/8)`,
        impact: "medium",
      });
    }
    if (uniqueCategories.size < 2 && activeSkills.length >= 4) {
      recommendations.push({
        id: "rec-skills-cat",
        category: "Skills & Keywords",
        text: "+ Group skills across categories (e.g., Languages, Frontend, Backend, Cloud)",
        impact: "low",
      });
    }

    // --- 4. EXPERIENCE & PROJECTS (Max 25) ---
    let expScore = 0;
    const activeProjects = version
      ? profile.projects.filter((p) => version.selectedProjectIds.length === 0 || version.selectedProjectIds.includes(p.id))
      : profile.projects;
    const activeExp = version
      ? profile.experience.filter((e) => version.selectedExperienceIds.length === 0 || version.selectedExperienceIds.includes(e.id))
      : profile.experience;
    const totalExpProjCount = activeProjects.length + activeExp.length;

    checks.push({
      id: "check-projects-experience",
      label: "Projects or Experience Present",
      passed: totalExpProjCount > 0,
      severity: "warning",
      tip: totalExpProjCount > 0
        ? `${activeProjects.length} project(s) & ${activeExp.length} experience(s).`
        : "Recruiters look for concrete projects or practical experience.",
    });
    if (totalExpProjCount === 0) warnings.push("Your resume has no projects or practical experience.");

    if (totalExpProjCount >= 2) {
      expScore += 15;
    } else if (totalExpProjCount === 1) {
      expScore += 10;
    }

    // Detect measurable metrics (percentages, numbers, multipliers, KPIs)
    const metricRegex = /\b\d+(%|\+|k|ms|s|x)?\b/i;
    let hasMetrics = false;
    let hasActionVerbs = false;
    const actionVerbRegex = /^\s*(built|developed|created|designed|implemented|engineered|optimized|led|architected|deployed|integrated|improved|reduced|increased|automated|managed|spearheaded|researched|refactored|achieved|trained)/i;

    const allBulletTexts: string[] = [
      ...activeExp.flatMap((e) => e.bullets || []),
      ...activeProjects.flatMap((p) => p.highlights || []),
      ...activeProjects.map((p) => p.description || ""),
      ...activeExp.map((e) => e.description || ""),
    ].filter(Boolean);

    for (const b of allBulletTexts) {
      if (metricRegex.test(b)) hasMetrics = true;
      if (actionVerbRegex.test(b)) hasActionVerbs = true;
    }

    if (hasMetrics) expScore += 5;
    if (hasActionVerbs) expScore += 5;

    if (totalExpProjCount === 0) {
      recommendations.push({
        id: "rec-exp-none",
        category: "Experience & Projects",
        text: "+ Add at least 1 technical project or work experience entry",
        impact: "high",
      });
    } else {
      if (totalExpProjCount === 1) {
        recommendations.push({
          id: "rec-exp-second",
          category: "Experience & Projects",
          text: "+ Add a second project or internship to demonstrate engineering breadth",
          impact: "medium",
        });
      }
      if (!hasMetrics && allBulletTexts.length > 0) {
        recommendations.push({
          id: "rec-exp-metrics",
          category: "Experience & Projects",
          text: "+ Add measurable metrics or numbers in bullet points (e.g. 20% speedup, 500+ users)",
          impact: "high",
        });
      }
      if (!hasActionVerbs && allBulletTexts.length > 0) {
        recommendations.push({
          id: "rec-exp-verbs",
          category: "Experience & Projects",
          text: "+ Begin bullet points with strong action verbs (Built, Deployed, Engineered)",
          impact: "medium",
        });
      }
    }

    // --- 5. EDUCATION (Max 15) ---
    let eduScore = 0;
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

    if (hasEdu) {
      const hasInstitutionAndDegree = activeEdu.some((e) => e.institution?.trim() && e.degree?.trim());
      if (hasInstitutionAndDegree) eduScore += 10;
      else eduScore += 5;

      const hasDatesOrGpa = activeEdu.some((e) => e.endDate || e.gpa || e.scheme || e.startDate);
      if (hasDatesOrGpa) eduScore += 5;
    }

    if (!hasEdu) {
      recommendations.push({
        id: "rec-edu-none",
        category: "Education",
        text: "+ Add your university degree and institution",
        impact: "high",
      });
    } else {
      const hasDatesOrGpa = activeEdu.some((e) => e.endDate || e.gpa || e.scheme);
      if (!hasDatesOrGpa) {
        recommendations.push({
          id: "rec-edu-details",
          category: "Education",
          text: "+ Include your graduation year, CGPA, or academic branch",
          impact: "low",
        });
      }
    }

    // --- 6. PROFESSIONAL LINKS (Max 10) ---
    let linksScore = 0;
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    let urlIssues = false;

    const hasLinkedIn = Boolean(profile.linkedin && profile.linkedin.trim().length > 3);
    const validLinkedIn = hasLinkedIn && urlPattern.test(profile.linkedin!.trim());
    if (hasLinkedIn && !validLinkedIn) {
      urlIssues = true;
      warnings.push("LinkedIn URL appears malformed.");
    }
    if (validLinkedIn) linksScore += 4;

    const hasGitHub = Boolean(profile.github && profile.github.trim().length > 3);
    const validGitHub = hasGitHub && urlPattern.test(profile.github!.trim());
    if (hasGitHub && !validGitHub) {
      urlIssues = true;
      warnings.push("GitHub URL appears malformed.");
    }
    if (validGitHub) linksScore += 3;

    const portfolioUrl = profile.portfolio || profile.website;
    const hasPortfolio = Boolean(portfolioUrl && portfolioUrl.trim().length > 3);
    const validPortfolio = hasPortfolio && urlPattern.test(portfolioUrl!.trim());
    if (hasPortfolio && !validPortfolio) {
      urlIssues = true;
      warnings.push("Portfolio URL appears malformed.");
    }
    if (validPortfolio) linksScore += 3;

    checks.push({
      id: "check-links",
      label: "Valid Profile Links",
      passed: !urlIssues && (validLinkedIn || validGitHub),
      severity: "info",
      tip: urlIssues
        ? "Ensure LinkedIn and GitHub profiles use standard URL format."
        : "Professional profile links are well-formed.",
    });

    if (!validLinkedIn) {
      recommendations.push({
        id: "rec-link-linkedin",
        category: "Professional Links",
        text: "+ Add your LinkedIn profile link",
        impact: "high",
      });
    }
    if (!validGitHub) {
      recommendations.push({
        id: "rec-link-github",
        category: "Professional Links",
        text: "+ Add your GitHub profile or code repository",
        impact: "medium",
      });
    }
    if (!validPortfolio) {
      recommendations.push({
        id: "rec-link-portfolio",
        category: "Professional Links",
        text: "+ Add a portfolio or live personal website link",
        impact: "medium",
      });
    }

    // --- 7. ATS FORMATTING & GRAPHICS CHECK ---
    const hasPhoto = Boolean(
      (profile.profileImage || profile.photoUrl) &&
      (version?.showProfilePhoto !== false)
    );
    let formattingPenalty = 0;
    if (hasPhoto) {
      formattingPenalty = 5;
      warnings.push("Profile photo detected: Some ATS parsers struggle with graphics or photos. For an ATS-first resume, avoiding photos is recommended.");
      recommendations.push({
        id: "rec-photo-ats",
        category: "Formatting & Parseability",
        text: "Consider removing profile photo for ATS-first submissions to prevent parsing errors (-5 pts)",
        impact: "medium",
      });
      checks.push({
        id: "check-photo",
        label: "ATS-Safe Formatting (No Photo)",
        passed: false,
        severity: "warning",
        tip: "Some applicant tracking systems may parse graphics inconsistently. Avoid photos for standard ATS submissions.",
      });
    } else {
      checks.push({
        id: "check-photo",
        label: "ATS-Safe Formatting (No Photo)",
        passed: true,
        severity: "info",
        tip: "Clean text-only layout ensures reliable scanning across all ATS parsers.",
      });
    }

    // --- TOTAL ATS SCORE (0 - 100) ---
    const rawTotal = contactScore + summaryScore + skillsScore + expScore + eduScore + linksScore;
    const totalAtsScore = Math.min(
      100,
      Math.max(0, rawTotal - formattingPenalty)
    );

    let scoreLabel: "Needs Work" | "Good" | "Strong" | "Exceptional" = "Needs Work";
    if (totalAtsScore >= 85) scoreLabel = "Exceptional";
    else if (totalAtsScore >= 70) scoreLabel = "Strong";
    else if (totalAtsScore >= 50) scoreLabel = "Good";

    const categoryScores: AtsCategoryScore[] = [
      {
        id: "contact",
        name: "Contact Information",
        score: contactScore,
        maxScore: 15,
        percentage: Math.round((contactScore / 15) * 100),
      },
      {
        id: "summary",
        name: "Summary & Role Alignment",
        score: summaryScore,
        maxScore: 15,
        percentage: Math.round((summaryScore / 15) * 100),
      },
      {
        id: "skills",
        name: "Skills & Keywords",
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
        id: "links",
        name: "Professional Links",
        score: linksScore,
        maxScore: 10,
        percentage: Math.round((linksScore / 10) * 100),
      },
    ];

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
      completenessScore: totalAtsScore, // Backwards compatibility
      atsScore: totalAtsScore,
      scoreLabel,
      categoryScores,
      recommendations,
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
  // DETERMINISTIC JOB DESCRIPTION MATCHING (NO HALLUCINATIONS)
  // ==========================================
  matchJobDescription(
    profile: CareerProfile,
    version: ResumeVersion | null,
    jobDescription: string
  ): JobMatchResult {
    if (!jobDescription || typeof jobDescription !== "string" || !jobDescription.trim()) {
      return {
        matchScore: 0,
        matchedKeywords: [],
        missingKeywords: [],
        skillsFound: [],
        skillsMissing: [],
        recommendations: ["Paste a job description to calculate keyword match."],
        analyzedAt: new Date().toISOString(),
      };
    }

    const jdText = jobDescription.toLowerCase();

    // 1. Gather all resume words/skills
    const activeSkills = version
      ? profile.skills.filter((s) => version.selectedSkillIds.length === 0 || version.selectedSkillIds.includes(s.id))
      : profile.skills;
    const candidateSkillNames = activeSkills.map((s) => s.name.toLowerCase());
    const candidateSkillSet = new Set(candidateSkillNames);

    const resumeFullContent = [
      profile.fullName,
      profile.professionalTitle,
      version?.targetRole,
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

    // 2. Comprehensive technical keyword lexicon
    const COMMON_TECH_KEYWORDS = [
      "python", "java", "javascript", "typescript", "c++", "c#", "golang", "rust", "sql", "html", "css",
      "react", "angular", "vue", "next.js", "node.js", "express", "django", "fastapi", "spring", "spring boot",
      "postgresql", "mysql", "mongodb", "redis", "supabase", "firebase", "sqlite",
      "docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "git", "github", "linux",
      "rest api", "graphql", "microservices", "kafka", "rabbitmq",
      "machine learning", "deep learning", "nlp", "llm", "ai", "pandas", "numpy", "pytorch", "tensorflow",
      "unit testing", "jest", "cypress", "agile", "scrum", "jira", "data structures", "algorithms", "oop", "system design"
    ];

    const jdFoundSkills: string[] = [];
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const kw of COMMON_TECH_KEYWORDS) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
      if (regex.test(jdText)) {
        jdFoundSkills.push(kw);
        if (candidateSkillSet.has(kw) || resumeFullContent.includes(kw)) {
          matchedSkills.push(kw);
        } else {
          missingSkills.push(kw);
        }
      }
    }

    // Dynamic keyword extraction from JD for general role terms
    const rawTokens = jdText.match(/[a-zA-Z]{3,}/g) || [];
    const stopWords = new Set([
      "and", "the", "for", "with", "you", "are", "our", "will", "have", "that", "this", "from", "your",
      "work", "team", "years", "experience", "looking", "candidate", "skills", "ability", "strong",
      "knowledge", "understanding", "degree", "computer", "science", "engineering", "required", "preferred"
    ]);

    const jdFreqMap = new Map<string, number>();
    for (const t of rawTokens) {
      if (!stopWords.has(t) && t.length > 2) {
        jdFreqMap.set(t, (jdFreqMap.get(t) || 0) + 1);
      }
    }

    const topJdTokens = Array.from(jdFreqMap.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([token]) => token);

    const matchedTokens: string[] = [];
    const missingTokens: string[] = [];
    for (const t of topJdTokens) {
      if (resumeFullContent.includes(t)) {
        matchedTokens.push(t);
      } else {
        missingTokens.push(t);
      }
    }

    const totalCheckPoints = jdFoundSkills.length + topJdTokens.length;
    const totalMatched = matchedSkills.length + matchedTokens.length;

    const matchScore = totalCheckPoints > 0
      ? Math.min(100, Math.max(10, Math.round((totalMatched / totalCheckPoints) * 100)))
      : 75;

    const recommendations: string[] = [];
    if (missingSkills.length > 0) {
      const displayMissing = missingSkills.slice(0, 4).join(", ");
      recommendations.push(
        `Consider adding key skills required by this role (${displayMissing}) only if you actually have experience with them.`
      );
    }
    if (matchScore < 60) {
      recommendations.push("Align your professional summary and project highlights to showcase relevant technical qualifications.");
    } else if (matchScore >= 80) {
      recommendations.push("Strong keyword alignment! Your resume demonstrates substantial coverage of key qualifications in this posting.");
    }

    return {
      matchScore,
      matchedKeywords: Array.from(new Set([...matchedSkills, ...matchedTokens])),
      missingKeywords: Array.from(new Set([...missingSkills, ...missingTokens])),
      skillsFound: matchedSkills,
      skillsMissing: missingSkills,
      recommendations,
      analyzedAt: new Date().toISOString(),
    };
  },

  // ==========================================
  // APPLICATION FUNNEL CALCULATION
  // ==========================================
  calculateApplicationFunnel(applications: JobApplication[]) {
    const funnel: Record<JobApplicationStatus, number> & { total: number } = {
      SAVED: 0,
      INTERESTED: 0,
      APPLIED: 0,
      ONLINE_ASSESSMENT: 0,
      INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
      EXPIRED: 0,
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
