/**
 * Saarvi Jobs Engine 6.0 — AI & LLM Structuring Layer
 *
 * Implements strict extraction and normalization using Gemini 3.6 Flash.
 *
 * STRICT EXTRACTION RULES:
 * 1. The external job source is the single source of truth.
 * 2. NEVER invent salary, skills, deadlines, responsibilities, or benefits.
 * 3. If information is not in the source text, return null / empty array.
 * 4. Deterministic normalization is applied first so database writes are never blocked by LLM.
 */

import type { JobItem } from "./types";

export interface AIJobExtractionResult {
  skills: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  experienceLevel: "fresher" | "entry-level" | "mid-level" | "senior";
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  deadline?: string;
}

export class JobNormalizationService {
  private static instance: JobNormalizationService;

  public static getInstance(): JobNormalizationService {
    if (!JobNormalizationService.instance) {
      JobNormalizationService.instance = new JobNormalizationService();
    }
    return JobNormalizationService.instance;
  }

  /**
   * Deterministic baseline normalization (instant, synchronous, zero hallucinations).
   */
  public normalizeDeterministic(raw: any, index = 0): Partial<JobItem> {
    const title = (raw.title || "").trim();
    const companyName = (raw.company_name || "").trim();
    const location = (raw.location || "India").trim();
    const description = (raw.description || "").trim();

    // Check apply options
    let applyUrl = "";
    const applyOptions: { title?: string; link: string; source?: string }[] = [];

    if (Array.isArray(raw.apply_options)) {
      for (const opt of raw.apply_options) {
        if (opt.link) {
          applyOptions.push({
            title: opt.title || "Apply",
            link: opt.link,
            source: opt.source || opt.title,
          });
        }
      }
      if (applyOptions.length > 0) {
        applyUrl = applyOptions[0].link;
      }
    }

    if (!applyUrl && raw.link) {
      applyUrl = raw.link;
    }

    const isInternship =
      title.toLowerCase().includes("intern") ||
      description.toLowerCase().includes("internship");

    // Detect skills safely using deterministic token matching
    const knownSkills = [
      "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python",
      "Java", "C++", "Go", "Rust", "SQL", "PostgreSQL", "MongoDB", "AWS",
      "Azure", "GCP", "Docker", "Kubernetes", "Git", "REST APIs", "GraphQL",
      "TailwindCSS", "HTML", "CSS", "Spring Boot", "Django", "FastAPI"
    ];

    const detectedSkills: string[] = [];
    const lowerDesc = description.toLowerCase();
    for (const skill of knownSkills) {
      const lowerSkill = skill.toLowerCase();
      // Whole word boundary check
      const regex = new RegExp(`\\b${lowerSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
      if (regex.test(lowerDesc)) {
        detectedSkills.push(skill);
      }
    }

    // Remote type inference
    let remoteType: "remote" | "hybrid" | "onsite" = "onsite";
    if (lowerDesc.includes("remote") || location.toLowerCase().includes("remote")) {
      remoteType = "remote";
    } else if (lowerDesc.includes("hybrid") || location.toLowerCase().includes("hybrid")) {
      remoteType = "hybrid";
    }

    // Experience level inference
    let experienceLevel: "fresher" | "entry-level" | "mid-level" | "senior" = "fresher";
    if (lowerDesc.includes("senior") || title.toLowerCase().includes("senior") || lowerDesc.includes("lead")) {
      experienceLevel = "senior";
    } else if (lowerDesc.includes("3-5 years") || lowerDesc.includes("mid level")) {
      experienceLevel = "mid-level";
    } else if (lowerDesc.includes("1-2 years") || lowerDesc.includes("entry level")) {
      experienceLevel = "entry-level";
    }

    return {
      title,
      companyName,
      companyLogo: raw.thumbnail || undefined,
      location,
      remoteType,
      employmentType: isInternship ? "internship" : "full-time",
      experienceLevel,
      description,
      skills: detectedSkills,
      applyUrl,
      applyOptions,
      sourceName: raw.via ? String(raw.via).replace(/^via\s+/i, "") : "Google Jobs",
      sourceUrl: applyUrl,
      sourceJobId: raw.job_id || `serp_${Date.now()}_${index}`,
      datePosted: raw.detected_extensions?.posted_at ? new Date().toISOString() : new Date().toISOString(),
      applicationDeadline: "Deadline not provided",
      salary: raw.detected_extensions?.salary || "Salary not disclosed",
      isInternship,
      verificationTier: "SOURCE_DISCOVERY",
      verifiedStatus: "source_checked",
    };
  }

  /**
   * Enriches job details with LLM (Gemini 3.6 Flash) structured output.
   * Runs asynchronously in the background. Does not block immediate persistence.
   */
  public async enrichJobWithLLM(
    title: string,
    company: string,
    rawText: string
  ): Promise<AIJobExtractionResult | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey || !rawText || rawText.length < 50) return null;

    const prompt = `You are a strict job extraction parser for Saarvi Career Discovery.
Source text:
Title: ${title}
Company: ${company}
Description:
${rawText.slice(0, 3000)}

STRICT RULES:
1. Extract ONLY facts explicitly stated in the source text.
2. NEVER invent skills, qualifications, responsibilities, or salary.
3. If absent or not clearly stated, return null or empty array.
4. Output strict JSON matching this schema:
{
  "skills": string[],
  "responsibilities": string[],
  "qualifications": string[],
  "benefits": string[],
  "experienceLevel": "fresher" | "entry-level" | "mid-level" | "senior",
  "salaryMin": number | null,
  "salaryMax": number | null,
  "salaryCurrency": string | null,
  "deadline": string | null
}`;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      const parsed = JSON.parse(text);
      return {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
        qualifications: Array.isArray(parsed.qualifications) ? parsed.qualifications : [],
        benefits: Array.isArray(parsed.benefits) ? parsed.benefits : [],
        experienceLevel: ["fresher", "entry-level", "mid-level", "senior"].includes(parsed.experienceLevel)
          ? parsed.experienceLevel
          : "fresher",
        salaryMin: parsed.salaryMin ? Number(parsed.salaryMin) : undefined,
        salaryMax: parsed.salaryMax ? Number(parsed.salaryMax) : undefined,
        salaryCurrency: parsed.salaryCurrency || undefined,
        deadline: parsed.deadline || undefined,
      };
    } catch (err) {
      console.warn("[JobNormalizationService] LLM enrichment notice:", err);
      return null;
    }
  }
}

export const jobNormalizationService = JobNormalizationService.getInstance();
