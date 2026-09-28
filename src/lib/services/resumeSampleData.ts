import type {
  CareerProfile,
  CareerEducation,
  CareerExperience,
  CareerProject,
  CareerSkill,
  CareerCertification,
} from "@/types/career";

/**
 * Authoritative Realistic Sample Resume Profile for Saarvi Resume Builder 2.0.
 * Demonstrates template typography, geometry, and styling with fictional demonstration data.
 */
export const SAMPLE_RESUME_PROFILE: CareerProfile = {
  id: "saarvi_sample_profile_demo",
  fullName: "Alex Johnson",
  professionalTitle: "Software Engineer",
  email: "alex.johnson@example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  websiteUrl: "https://alexjohnson.dev",
  website: "https://alexjohnson.dev",
  portfolio: "https://alexjohnson.dev",
  linkedinUrl: "https://linkedin.com/in/alexjohnson",
  linkedin: "https://linkedin.com/in/alexjohnson",
  githubUrl: "https://github.com/alexjohnson",
  github: "https://github.com/alexjohnson",
  summary:
    "Computer Science graduate with experience building web applications using JavaScript, React and Node.js. Interested in software engineering and scalable web technologies.",
  education: [
    {
      id: "sample_edu_1",
      institution: "ABC Institute of Technology",
      degree: "B.Tech in Computer Science",
      fieldOfStudy: "Computer Science & Engineering",
      startDate: "2022",
      endDate: "2026",
      gpa: "8.7",
      score: "8.7 CGPA",
      scheme: "VTU 2022 Scheme",
      branch: "Computer Science",
      currentSemester: 8,
      highlights: [
        "Consistent academic excellence with university honors",
        "Lead technical coordinator for university coding symposium",
      ],
      current: true,
      showOnResume: true,
    },
  ],
  experience: [
    {
      id: "sample_exp_1",
      company: "Example Technologies",
      role: "Software Engineering Intern",
      location: "Bengaluru, India",
      startDate: "2026-01",
      endDate: "2026-06",
      current: true,
      type: "internship",
      description: "Full-stack development internship focusing on scalable client web applications.",
      bullets: [
        "Developed responsive React applications with modular component architecture.",
        "Integrated REST APIs with structured error handling and deterministic data caching.",
        "Improved application performance, reducing client-side bundle size by 28%.",
        "Collaborated with cross-functional engineering team using agile sprint workflows.",
      ],
      technologies: ["React", "JavaScript", "REST APIs", "Node.js"],
      showOnResume: true,
    },
  ],
  projects: [
    {
      id: "sample_proj_1",
      title: "Task Management Platform",
      role: "Lead Full-Stack Developer",
      startDate: "2025-08",
      endDate: "2025-12",
      liveUrl: "https://github.com/alexjohnson/task-platform",
      githubUrl: "https://github.com/alexjohnson/task-platform",
      description:
        "Full-stack task management web application with responsive UI, deterministic authorization, and relational storage.",
      highlights: [
        "Built a task management application handling high-frequency team workflow updates.",
        "Implemented authentication and role-based access control with secure session tokens.",
        "Designed responsive user interface achieving 99+ accessibility score in audits.",
      ],
      bullets: [
        "Built a task management application handling high-frequency team workflow updates.",
        "Implemented authentication and role-based access control with secure session tokens.",
        "Designed responsive user interface achieving 99+ accessibility score in audits.",
      ],
      technologies: ["React", "Node.js", "PostgreSQL", "Tailwind CSS"],
      showOnResume: true,
    },
  ],
  skills: [
    { id: "s1", name: "JavaScript", category: "Programming Languages" },
    { id: "s2", name: "TypeScript", category: "Programming Languages" },
    { id: "s3", name: "React", category: "Frontend" },
    { id: "s4", name: "Node.js", category: "Backend" },
    { id: "s5", name: "SQL", category: "Database" },
    { id: "s6", name: "Git", category: "Tools" },
    { id: "s7", name: "REST APIs", category: "Backend" },
    { id: "s8", name: "PostgreSQL", category: "Database" },
  ],
  certifications: [
    {
      id: "sample_cert_1",
      name: "Cloud Fundamentals",
      issuer: "Cloud Certification Board",
      date: "2025-06",
      url: "https://credential.net/sample-cloud",
      credentialId: "sample-cloud",
      showOnResume: true,
    },
    {
      id: "sample_cert_2",
      name: "Web Development Certification",
      issuer: "Professional Software Institute",
      date: "2024-11",
      url: "https://credential.net/sample-web",
      credentialId: "sample-web",
      showOnResume: true,
    },
  ],
  hackathons: [],
  achievements: [
    {
      id: "sample_ach_1",
      title: "1st Place — National Collegiate Hackathon",
      issuer: "Tech Innovation League",
      date: "2025-09",
      description: "Built an offline-first emergency coordination mobile web app in 36 hours.",
      showOnResume: true,
    },
  ],
  leadership: [],
  volunteering: [],
  languages: [
    { id: "l1", name: "English", proficiency: "Professional" },
    { id: "l2", name: "Kannada", proficiency: "Native" },
    { id: "l3", name: "Hindi", proficiency: "Fluent" },
  ],
  customSections: [],
  isSample: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Placeholder tokens for structured template data binding
 */
export const RESUME_PLACEHOLDERS: Record<string, string> = {
  full_name: "Alex Johnson",
  job_title: "Software Engineer",
  email: "alex.johnson@example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  linkedin: "linkedin.com/in/alexjohnson",
  github: "github.com/alexjohnson",
  summary:
    "Computer Science graduate with experience building web applications using JavaScript, React and Node.js. Interested in software engineering and scalable web technologies.",
};

/**
 * Checks whether the given profile is currently sample data
 */
export function isSampleProfile(profile: CareerProfile | null | undefined): boolean {
  if (!profile) return false;
  if ((profile as any).isSample === true) return true;
  return profile.fullName === "Alex Johnson" && profile.email === "alex.johnson@example.com";
}

/**
 * Creates a clean copy of the sample profile
 */
export function createSampleProfile(): CareerProfile {
  return JSON.parse(JSON.stringify(SAMPLE_RESUME_PROFILE));
}

/**
 * Creates an empty initial profile ready for direct user entry with clear prompts
 */
export function createEmptyUserProfile(id: string = "user_career_profile"): CareerProfile {
  return {
    id,
    fullName: "",
    professionalTitle: "",
    email: "",
    phone: "",
    location: "",
    websiteUrl: "",
    linkedinUrl: "",
    githubUrl: "",
    summary: "",
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: [],
    hackathons: [],
    achievements: [],
    leadership: [],
    volunteering: [],
    languages: [],
    customSections: [],
    isSample: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Authoritative Realistic Sample Cover Letter Data for Saarvi Cover Letter Builder.
 * Demonstrates template geometry, recipient structure, and paragraph cadence with demonstration data.
 */
export interface SampleCoverLetterData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  recipientName: string;
  recipientTitle: string;
  companyName: string;
  companyAddress: string;
  targetRole: string;
  opening: string;
  bodyParagraph1: string;
  bodyParagraph2: string;
  skillsHighlight: string;
  closing: string;
}

export const SAMPLE_COVER_LETTER_DATA: SampleCoverLetterData = {
  fullName: "Alex Johnson",
  email: "alex.johnson@example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  recipientName: "Priya Sharma",
  recipientTitle: "Director of Engineering",
  companyName: "Acme Cloud Technologies",
  companyAddress: "Indiranagar, Bengaluru 560038",
  targetRole: "Software Engineer",
  opening:
    "I am writing to express my strong interest in the Software Engineer position at Acme Cloud Technologies. Having closely followed Acme's work in distributed systems and developer tools, I am enthusiastic about the opportunity to contribute to your engineering team.",
  bodyParagraph1:
    "During my recent engineering internship at Example Technologies, I developed modular React components and resilient RESTful API services that reduced client bundle latency by 28%. I collaborated directly with senior engineers to implement automated testing workflows and participated actively in architecture discussions.",
  bodyParagraph2:
    "Through my academic coursework in Computer Science and hands-on projects, I have developed a solid foundation in data structures, algorithms, and relational database systems. I pride myself on writing maintainable, readable code and approaching technical challenges with curiosity and disciplined debugging.",
  skillsHighlight:
    "My core technical competencies include TypeScript, React, Node.js, PostgreSQL, and Git version control, complemented by a collaborative communication style.",
  closing:
    "Thank you for your time and consideration. I would welcome the opportunity to discuss how my technical skills and enthusiasm for software excellence align with Acme Cloud Technologies' goals. I look forward to speaking with you.",
};

/**
 * Checks whether the given cover letter text matches demonstration sample data
 */
export function isSampleCoverLetter(letter: {
  fullName?: string;
  email?: string;
  companyName?: string;
}): boolean {
  if (!letter) return false;
  return (
    letter.fullName === "Alex Johnson" ||
    letter.email === "alex.johnson@example.com" ||
    letter.companyName === "Acme Cloud Technologies"
  );
}

/**
 * Creates a clean copy of the sample cover letter data
 */
export function createSampleCoverLetterData(): SampleCoverLetterData {
  return JSON.parse(JSON.stringify(SAMPLE_COVER_LETTER_DATA));
}

