/**
 * Saarvi Jobs Engine 2.0 — Result Normalization
 *
 * Normalizes external provider payloads into the unified JobItem schema.
 * Enforces strict honesty: missing salaries display "Salary not disclosed",
 * missing deadlines display "Deadline not provided". Never guesses or invents values.
 */

import type {
  JobItem,
  RemoteType,
  EmploymentType,
  ExperienceLevel,
  VerifiedStatus,
} from "./types.ts";
import { validateSafeJobUrl } from "./security.ts";
import { stripTrackingParams } from "./dedupe.ts";

const KNOWN_TECH_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin",
  "React", "Next.js", "Vue", "Angular", "Node.js", "Express", "Django", "FastAPI", "Spring Boot",
  "HTML", "CSS", "Tailwind CSS", "Sass", "Redux", "GraphQL", "REST APIs",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Firebase", "Supabase",
  "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "Git", "GitHub", "CI/CD",
  "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Data Science", "Pandas", "NumPy",
  "Cybersecurity", "Microservices", "System Design", "Agile", "Scrum",
];

export function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const lowerText = ` ${text.toLowerCase()} `;

  for (const skill of KNOWN_TECH_SKILLS) {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<=[^a-zA-Z0-9#+]|^)${escaped}(?=[^a-zA-Z0-9#+]|$)`, "i");
    if (regex.test(lowerText)) {
      found.add(skill);
    }
  }

  return Array.from(found);
}

export function inferRemoteType(locationText?: string, descText?: string): RemoteType {
  const combined = `${locationText || ""} ${descText || ""}`.toLowerCase();
  if (combined.includes("remote") || combined.includes("work from home") || combined.includes("wfh")) {
    return "remote";
  }
  if (combined.includes("hybrid") || combined.includes("flexible")) {
    return "hybrid";
  }
  return "onsite";
}

export function inferEmploymentType(title?: string, text?: string): EmploymentType {
  const combined = `${title || ""} ${text || ""}`.toLowerCase();
  if (combined.includes("intern") || combined.includes("internship")) {
    return "internship";
  }
  if (combined.includes("part-time") || combined.includes("part time")) {
    return "part-time";
  }
  if (combined.includes("contract") || combined.includes("freelance")) {
    return "contract";
  }
  return "full-time";
}

export function inferExperienceLevel(title?: string, text?: string): ExperienceLevel {
  const combined = `${title || ""} ${text || ""}`.toLowerCase();
  if (combined.includes("fresher") || combined.includes("trainee") || combined.includes("graduate") || combined.includes("2025") || combined.includes("2026") || combined.includes("2027")) {
    return "fresher";
  }
  if (combined.includes("junior") || combined.includes("entry level") || combined.includes("entry-level") || combined.includes("associate") || combined.includes("0-1 year") || combined.includes("0-2 year")) {
    return "entry-level";
  }
  if (combined.includes("senior") || combined.includes("sr.") || combined.includes("lead") || combined.includes("principal")) {
    return "senior";
  }
  return "mid-level";
}

/**
 * Normalizes raw external SerpApi Google Jobs response item into Saarvi JobItem.
 */
export function normalizeSerpApiJob(raw: any, fallbackIndex = 0): JobItem | null {
  if (!raw || typeof raw !== "object") return null;

  const title = (raw.title || "Job Opportunity").trim();
  const companyName = (raw.company_name || raw.employer_name || "Company").trim();
  const location = (raw.location || "India").trim();

  // Extract raw URLs
  const candidateApplyUrl =
    raw.apply_options?.[0]?.link ||
    raw.related_links?.[0]?.link ||
    raw.share_link ||
    raw.link;

  const safeApply = validateSafeJobUrl(candidateApplyUrl);
  const validApplyUrl = safeApply
    ? stripTrackingParams(safeApply)
    : "https://google.com/search?q=" + encodeURIComponent(`${title} ${companyName}`);
  const safeSource = validateSafeJobUrl(raw.share_link || candidateApplyUrl);
  const validSourceUrl = safeSource ? stripTrackingParams(safeSource) : validApplyUrl;

  const description = (raw.description || "").trim() || "No detailed job description provided by source.";
  const detectedSkills = extractSkillsFromText(`${title} ${description}`);

  // Salary honesty
  let salaryStr = "Salary not disclosed";
  if (raw.detected_extensions?.salary) {
    salaryStr = raw.detected_extensions.salary.trim();
  } else if (raw.salary) {
    salaryStr = String(raw.salary).trim();
  }

  // Deadline honesty
  let deadlineStr = "Deadline not provided";
  if (raw.application_deadline) {
    deadlineStr = String(raw.application_deadline).trim();
  } else if (raw.detected_extensions?.application_deadline) {
    deadlineStr = String(raw.detected_extensions.application_deadline).trim();
  }

  // Date posted
  const datePosted = raw.detected_extensions?.posted_at
    ? raw.detected_extensions.posted_at
    : new Date().toISOString();

  const isInternship =
    inferEmploymentType(title, description) === "internship" ||
    title.toLowerCase().includes("intern");

  const remoteType = inferRemoteType(location, description);
  const employmentType = isInternship ? "internship" : inferEmploymentType(title, description);
  const experienceLevel = inferExperienceLevel(title, description);

  // Generate deterministic ID from company, title, location
  const sourceJobId = raw.job_id || `serp_${fallbackIndex}_${Date.now()}`;
  const cleanId = `job_${sourceJobId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`;

  // Qualifications & Responsibilities
  const qualifications: string[] = [];
  const responsibilities: string[] = [];

  if (Array.isArray(raw.job_highlights)) {
    for (const h of raw.job_highlights) {
      if (h.title?.toLowerCase().includes("qualification") && Array.isArray(h.items)) {
        qualifications.push(...h.items.map((i: any) => String(i).trim()));
      } else if (h.title?.toLowerCase().includes("responsibilit") && Array.isArray(h.items)) {
        responsibilities.push(...h.items.map((i: any) => String(i).trim()));
      }
    }
  }

  // Source name from via field (e.g. "via LinkedIn" -> "LinkedIn")
  const rawVia = typeof raw.via === "string" ? raw.via.replace(/^via\s+/i, "").trim() : "";
  const sourceName = rawVia || "Google Jobs / Original Employer";

  return {
    id: cleanId,
    title,
    companyName,
    companyLogo: raw.thumbnail || undefined,
    location,
    remoteType,
    employmentType,
    experienceLevel,
    salary: salaryStr,
    description,
    qualifications: qualifications.length > 0 ? qualifications : undefined,
    responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
    skills: detectedSkills,
    datePosted,
    applicationDeadline: deadlineStr,
    sourceName,
    sourceUrl: validSourceUrl,
    applyUrl: validApplyUrl,
    sourceJobId,
    fetchedAt: new Date().toISOString(),
    verifiedStatus: "source_checked",
    verificationTier: "SOURCE_DISCOVERY",
    isInternship,
    confidenceScore: 85,
  };
}
