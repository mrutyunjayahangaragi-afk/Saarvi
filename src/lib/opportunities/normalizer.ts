/**
 * Saarvi Opportunity Normalizer
 *
 * Implements deterministic data cleaning, skill extraction, URL validation,
 * and content-hash generation for multi-source opportunities.
 */

import type { Opportunity, OpportunityCategory, RemoteType, EmploymentType, ExperienceLevel } from "./types.ts";
import { TECHNICAL_SKILL_LEXICON } from "../resume/parser/document-parser.ts";

/**
 * Validates external URL safety:
 * 1. Must use HTTPS or HTTP
 * 2. Rejects javascript:, data:, vbscript:, file:
 * 3. Blocks SSRF targets (localhost, 127.0.0.1, private IPs)
 */
export function validateSafeExternalUrl(urlStr: string): string | null {
  if (!urlStr || typeof urlStr !== "string") return null;

  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".internal") ||
      host.endsWith(".local")
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Normalizes company name by stripping legal corporate suffixes.
 */
export function normalizeCompanyName(company: string): string {
  if (!company) return "";
  return company
    .trim()
    .toLowerCase()
    .replace(/\b(private\s+limited|pvt\s+ltd|ltd|inc|llc|technologies|solutions|corporation|corp)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes job title.
 */
export function normalizeJobTitle(title: string): string {
  if (!title) return "";
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts skills from job title and description using the 150+ skill lexicon.
 */
export function extractOpportunitySkills(title: string, description: string): string[] {
  const combined = ` ${title.toLowerCase()} ${description.toLowerCase()} `;
  const detected = new Set<string>();

  for (const skill of Object.keys(TECHNICAL_SKILL_LEXICON)) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<=[\\s,;()./])${escaped}(?=[\\s,;()./])`, "i");

    if (pattern.test(combined)) {
      const canonical = skill.charAt(0).toUpperCase() + skill.slice(1);
      detected.add(canonical);
    }
  }

  return Array.from(detected).sort();
}

/**
 * Deterministic Content Hash Generator for Change Detection.
 * Generates an alphanumeric hash representing the key opportunity attributes.
 */
export function generateOpportunityContentHash(params: {
  title: string;
  company: string;
  location: string;
  deadline?: string | null;
  applyUrl: string;
  skills: string[];
}): string {
  const normalizedStr = [
    normalizeJobTitle(params.title),
    normalizeCompanyName(params.company),
    params.location.trim().toLowerCase(),
    params.deadline || "none",
    params.applyUrl.trim(),
    params.skills.slice().sort().join(","),
  ].join("|");

  // Simple, deterministic 32-bit FNV-1a hash formatted in hex
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalizedStr.length; i++) {
    hash ^= normalizedStr.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Determines remote type from location and description.
 */
export function inferRemoteType(location: string, text: string): RemoteType {
  const combined = `${location.toLowerCase()} ${text.toLowerCase()}`;
  if (combined.includes("remote") || combined.includes("work from home") || combined.includes("wfh")) {
    return "remote";
  }
  if (combined.includes("hybrid")) {
    return "hybrid";
  }
  return "onsite";
}

/**
 * Determines employment type and category.
 */
export function inferOpportunityCategory(title: string, text: string): {
  category: OpportunityCategory;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  isInternship: boolean;
  isJob: boolean;
} {
  const combined = `${title.toLowerCase()} ${text.toLowerCase()}`;
  const isIntern =
    combined.includes("intern") ||
    combined.includes("internship") ||
    combined.includes("trainee") ||
    combined.includes("summer analyst");

  const isHack = combined.includes("hackathon") || combined.includes("coding challenge");
  const isSchol = combined.includes("scholarship") || combined.includes("fellowship");

  if (isHack) {
    return {
      category: "hackathon",
      employmentType: "temporary",
      experienceLevel: "fresher",
      isInternship: false,
      isJob: false,
    };
  }

  if (isSchol) {
    return {
      category: "scholarship",
      employmentType: "temporary",
      experienceLevel: "fresher",
      isInternship: false,
      isJob: false,
    };
  }

  if (isIntern) {
    return {
      category: "internship",
      employmentType: "internship",
      experienceLevel: "fresher",
      isInternship: true,
      isJob: false,
    };
  }

  const isFresher =
    combined.includes("fresher") ||
    combined.includes("graduate") ||
    combined.includes("entry level") ||
    combined.includes("0-1 years") ||
    combined.includes("2026 batch") ||
    combined.includes("2025 batch");

  return {
    category: "job",
    employmentType: "full-time",
    experienceLevel: isFresher ? "fresher" : "entry-level",
    isInternship: false,
    isJob: true,
  };
}
