export type ResumeSectionId =
  | "contact"
  | "summary"
  | "education"
  | "skills"
  | "experience"
  | "projects"
  | "certifications"
  | "achievements"
  | "hackathons"
  | "leadership"
  | "volunteering"
  | "languages"
  | "additional";

export type ResumeTemplateId =
  | "classic-ats"
  | "ats-latex"
  | "modern-professional"
  | "executive"
  | "student-clean"
  | "minimal"
  | "creative-accent"
  | "tech-minimal"
  | (string & {});

export interface ResumeTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: "STANDARD" | "TECHNICAL" | "ACADEMIC" | "CREATIVE" | "EXECUTIVE";
  isActive: boolean;
  isPro: boolean;
  isFeatured: boolean;
  sortOrder: number;
  primaryColor: string;
  fontFamily: string;
  layout: "single-column" | "two-column-left" | "two-column-right";
  badges?: string[];
  thumbnailPreview?: string;
  sourceType?: "ORIGINAL" | "REFERENCE_RECREATION";
  licenseNote?: string;
  referenceSourceNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CareerSkillCategory =
  | "Programming Languages"
  | "Frontend"
  | "Backend"
  | "Database"
  | "Cloud"
  | "DevOps"
  | "AI/ML"
  | "Tools"
  | "Soft Skills"
  | "Other";

export interface CareerSkill {
  id: string;
  name: string;
  category: CareerSkillCategory;
  proficiency?: "beginner" | "intermediate" | "advanced" | "expert";
  highlighted?: boolean;
}

export interface CareerEducation {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  current?: boolean;
  gpa?: string; // CGPA or percentage
  score?: string; // Score / Grade / CGPA alias
  scheme?: string; // e.g., VTU 2022 Scheme
  branch?: string;
  currentSemester?: number;
  showOnResume?: boolean;
  highlights?: string[];
}

export interface CareerExperience {
  id: string;
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  bullets: string[];
  technologies?: string[];
  type?: "internship" | "full-time" | "part-time" | "freelance";
  showOnResume?: boolean;
}

export interface CareerProject {
  id: string;
  title: string;
  role?: string;
  description?: string;
  technologies: string[];
  startDate?: string;
  endDate?: string;
  liveUrl?: string;
  githubUrl?: string;
  highlights: string[];
  bullets?: string[];
  sourceRefId?: string; // e.g. local project / portfolio reference
  showOnResume?: boolean;
}

export interface CareerCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  description?: string;
  expiryDate?: string;
  url?: string;
  credentialId?: string;
  sourceRefId?: string; // e.g. from local certificates store
  showOnResume?: boolean;
}

export interface CareerHackathon {
  id: string;
  title: string;
  role?: string;
  outcome: "Winner" | "Runner-up" | "Finalist" | "Participant" | "Special Mention";
  projectTitle?: string;
  organization?: string;
  date: string;
  description?: string;
  technologies?: string[];
  sourceRefId?: string; // from local hackathons store
  showOnResume?: boolean;
}

export interface CareerAchievement {
  id: string;
  title: string;
  issuer?: string;
  date?: string;
  description?: string;
  showOnResume?: boolean;
}

export interface CareerVolunteering {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  showOnResume?: boolean;
}

export interface CareerLeadership {
  id: string;
  title: string;
  organization: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  showOnResume?: boolean;
}

export interface CareerLanguage {
  id: string;
  name: string;
  proficiency?: "Native" | "Fluent" | "Professional" | "Intermediate" | "Basic";
}

export interface CareerProfile {
  id: string;
  fullName: string;
  professionalTitle: string;
  email: string;
  phone: string;
  location: string;
  website?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  photoUrl?: string;
  profileImage?: string;
  summary?: string;
  skills: CareerSkill[];
  education: CareerEducation[];
  experience: CareerExperience[];
  projects: CareerProject[];
  certifications: CareerCertification[];
  achievements: CareerAchievement[];
  hackathons: CareerHackathon[];
  volunteering?: CareerVolunteering[];
  leadership?: CareerLeadership[];
  languages?: CareerLanguage[];
  additionalInfo?: string;
  isSample?: boolean;
  websiteUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  customSections?: any[];
  createdAt?: string;
  updatedAt: string;
}

export interface JobMatchResult {
  matchScore: number; // 0 to 100
  matchedKeywords: string[];
  missingKeywords: string[];
  skillsFound: string[];
  skillsMissing: string[];
  recommendations: string[];
  analyzedAt: string;
}

export interface ResumeVersion {
  id: string;
  profileId?: string;
  name: string; // e.g. "Software Engineer", "Frontend Developer", "Internship", "General"
  targetRole: string;
  template: ResumeTemplateId;
  summaryOverride?: string;
  sectionOrder: ResumeSectionId[];
  enabledSections: Record<ResumeSectionId, boolean>;
  selectedEducationIds: string[];
  selectedExperienceIds: string[];
  selectedProjectIds: string[];
  selectedSkillIds: string[];
  selectedCertificationIds: string[];
  selectedHackathonIds: string[];
  selectedAchievementIds: string[];
  selectedLeadershipIds: string[];
  selectedVolunteeringIds: string[];
  preferOnePage: boolean;
  showProfilePhoto?: boolean;
  dismissedImageAtsWarning?: boolean;
  jobDescriptionText?: string;
  lastJobMatch?: JobMatchResult;
  customSummaryData?: {
    yearsOfExperience?: string;
    specialization?: string;
    careerFocus?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSnapshot {
  id: string;
  profileId?: string;
  resumeVersionId: string;
  versionName: string;
  targetRole: string;
  template: ResumeTemplateId;
  exportedAt: string;
  pageCount: number;
  sectionOrder: ResumeSectionId[];
  profileSnapshot: {
    fullName: string;
    professionalTitle: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  itemCounts: {
    education: number;
    experience: number;
    projects: number;
    skills: number;
    certifications: number;
    hackathons: number;
  };
}

export type JobApplicationStatus =
  | "SAVED"
  | "INTERESTED"
  | "APPLIED"
  | "ONLINE_ASSESSMENT"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

export type JobApplicationPriority = "high" | "medium" | "low";

export type InterviewType = "Online" | "Phone" | "Technical" | "HR" | "Managerial" | "Other";

export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";

export interface InterviewRecord {
  id: string;
  profileId?: string;
  applicationId: string;
  company: string;
  role: string;
  round: string; // e.g. "Round 1 - Coding", "Round 2 - System Design", "HR"
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  type: InterviewType;
  locationOrLink?: string;
  notes?: string;
  status: InterviewStatus;
  reminderScheduled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationTimelineEvent {
  id: string;
  status: JobApplicationStatus;
  date: string;
  notes?: string;
}

export interface JobApplication {
  id: string;
  profileId?: string;
  company: string;
  role: string;
  applicationDate: string; // YYYY-MM-DD
  deadline?: string; // YYYY-MM-DD
  location?: string;
  jobUrl?: string;
  status: JobApplicationStatus;
  priority: JobApplicationPriority;
  notes?: string;
  followUpDate?: string; // YYYY-MM-DD
  resumeVersionId?: string;
  coverLetterId?: string;
  salary?: string;
  source?: string;
  events: ApplicationTimelineEvent[];
  interviews?: InterviewRecord[];
  createdAt: string;
  updatedAt: string;
}

export type CoverLetterType =
  | "general"
  | "company-specific"
  | "internship"
  | "software-engineer"
  | "frontend-developer"
  | "custom";

export interface CoverLetterVersion {
  id: string;
  profileId?: string;
  name: string;
  type: CoverLetterType;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  date: string;
  recipientName?: string;
  recipientTitle?: string;
  companyName: string;
  companyAddress?: string;
  targetRole: string;
  opening: string;
  bodyParagraph1: string;
  bodyParagraph2?: string;
  skillsHighlight?: string;
  relevantProject?: string;
  closing: string;
  template: "classic" | "modern" | "minimal";
  createdAt: string;
  updatedAt: string;
}

export interface AtsFriendlyCheckItem {
  id: string;
  label: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  tip: string;
}

export interface AtsCategoryScore {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
}

export interface AtsRecommendation {
  id: string;
  category: string;
  text: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ResumeValidationResult {
  isValid: boolean;
  completenessScore: number; // 0 to 100 (kept for backwards compatibility)
  atsScore: number; // 0 to 100
  scoreLabel: 'Needs Work' | 'Good' | 'Strong' | 'Exceptional';
  categoryScores: AtsCategoryScore[];
  recommendations: AtsRecommendation[];
  checks: AtsFriendlyCheckItem[];
  warnings: string[];
  errors: string[];
  estimatedPages: number;
}

export interface SkillGapAnalysis {
  targetRole: string;
  matchedSkills: string[];
  missingSkills: string[];
  optionalSkills: string[];
  matchPercentage: number;
}

export interface CareerWorkspaceExportPayload {
  version: "1.0";
  exportedAt: string;
  profile: CareerProfile | null;
  resumeVersions: ResumeVersion[];
  snapshots: ResumeSnapshot[];
  coverLetters: CoverLetterVersion[];
  applications: JobApplication[];
  interviews: InterviewRecord[];
  skills: CareerSkill[];
}
