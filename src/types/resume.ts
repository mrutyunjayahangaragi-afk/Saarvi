export interface ResumeEducation {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  description?: string;
}

export interface ResumeExperience {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}

export interface ResumeProject {
  id: string;
  title: string;
  role?: string;
  link?: string;
  date?: string;
  bullets: string[];
  techStack: string[];
}

export interface ResumeSkillCategory {
  id: string;
  category: string;
  items: string[];
}

export interface ResumeCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url?: string;
}

export interface ResumePersonalInfo {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  website?: string;
  linkedin?: string;
  github?: string;
  summary: string;
}

export interface ResumeTheme {
  primaryColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  spacing: 'compact' | 'normal' | 'spacious';
  template: 'ats-classic' | 'ats-modern' | 'student-clean' | 'technical';
}

export interface ResumeData {
  personalInfo: ResumePersonalInfo;
  education: ResumeEducation[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  skills: ResumeSkillCategory[];
  certifications: ResumeCertification[];
  theme: ResumeTheme;
}

export * from "./career";
