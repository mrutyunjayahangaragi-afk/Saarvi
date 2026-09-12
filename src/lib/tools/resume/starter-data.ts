import { ResumeData } from "@/types/resume";

export const EMPTY_STUDENT_RESUME: ResumeData = {
  personalInfo: {
    fullName: "",
    jobTitle: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    linkedin: "",
    github: "",
    summary: "",
  },
  education: [],
  experience: [],
  projects: [],
  skills: [],
  certifications: [],
  theme: {
    primaryColor: "#2563eb",
    fontFamily: "sans",
    spacing: "normal",
    template: "ats-classic",
  },
};

// Aliased for backwards compatibility with legacy importers, starting completely empty
export const SAMPLE_STUDENT_RESUME: ResumeData = EMPTY_STUDENT_RESUME;
