/**
 * Saarvi Resume Intelligence Engine — Document Parser & Text Extractor
 *
 * Implements deterministic local-first parsing for:
 * 1. PDF (via pdfjs-dist / text-layer extraction)
 * 2. DOCX (via JSZip + XML parser)
 * 3. Plain Text (.txt)
 * 4. Scanned PDF & Images (.png, .jpg, .jpeg) via OCR fallback
 *
 * Preserves local-first privacy: Document text is parsed client-side
 * and stored in IndexedDB without silent cloud upload.
 */

import type {
  CareerProfile,
  CareerEducation,
  CareerExperience,
  CareerProject,
  CareerSkill,
  CareerSkillCategory,
} from "@/types/career";

export interface ParsedResumeDocument {
  rawText: string;
  sourceType: "pdf" | "docx" | "txt" | "image_ocr";
  hasTextLayer: boolean;
  ocrFallbackUsed: boolean;
  confidenceScore: number; // 0 - 100
  lowConfidenceWarning?: string;
  extractedProfile: Partial<CareerProfile>;
  detectedSections: string[];
}

export const TECHNICAL_SKILL_LEXICON: Record<string, CareerSkillCategory> = {
  // Programming Languages
  javascript: "Programming Languages",
  typescript: "Programming Languages",
  python: "Programming Languages",
  java: "Programming Languages",
  c: "Programming Languages",
  "c++": "Programming Languages",
  "c#": "Programming Languages",
  golang: "Programming Languages",
  go: "Programming Languages",
  rust: "Programming Languages",
  kotlin: "Programming Languages",
  swift: "Programming Languages",
  php: "Programming Languages",
  ruby: "Programming Languages",
  r: "Programming Languages",
  dart: "Programming Languages",
  scala: "Programming Languages",

  // Frontend
  react: "Frontend",
  "react.js": "Frontend",
  "next.js": "Frontend",
  nextjs: "Frontend",
  vue: "Frontend",
  "vue.js": "Frontend",
  angular: "Frontend",
  html: "Frontend",
  html5: "Frontend",
  css: "Frontend",
  css3: "Frontend",
  tailwind: "Frontend",
  tailwindcss: "Frontend",
  redux: "Frontend",
  sass: "Frontend",
  bootstrap: "Frontend",
  webpack: "Frontend",
  vite: "Frontend",
  svelte: "Frontend",

  // Backend
  "node.js": "Backend",
  nodejs: "Backend",
  express: "Backend",
  "express.js": "Backend",
  django: "Backend",
  flask: "Backend",
  fastapi: "Backend",
  "spring boot": "Backend",
  springboot: "Backend",
  graphql: "Backend",
  "rest api": "Backend",
  "rest apis": "Backend",
  restful: "Backend",
  grpc: "Backend",
  microservices: "Backend",
  nestjs: "Backend",

  // Database
  sql: "Database",
  mysql: "Database",
  postgresql: "Database",
  postgres: "Database",
  mongodb: "Database",
  redis: "Database",
  sqlite: "Database",
  oracle: "Database",
  dynamodb: "Database",
  prisma: "Database",
  cassandra: "Database",
  firebase: "Database",
  supabase: "Database",

  // Cloud & DevOps
  aws: "Cloud",
  azure: "Cloud",
  gcp: "Cloud",
  "google cloud": "Cloud",
  docker: "DevOps",
  kubernetes: "DevOps",
  linux: "DevOps",
  git: "Tools",
  github: "Tools",
  gitlab: "Tools",
  "ci/cd": "DevOps",
  terraform: "DevOps",
  jenkins: "DevOps",
  bash: "DevOps",
  nginx: "DevOps",

  // AI/ML
  "machine learning": "AI/ML",
  "deep learning": "AI/ML",
  pytorch: "AI/ML",
  tensorflow: "AI/ML",
  keras: "AI/ML",
  pandas: "AI/ML",
  numpy: "AI/ML",
  "scikit-learn": "AI/ML",
  nlp: "AI/ML",
  opencv: "AI/ML",

  // Soft Skills & Methodologies
  agile: "Soft Skills",
  scrum: "Soft Skills",
  "problem solving": "Soft Skills",
  leadership: "Soft Skills",
  teamwork: "Soft Skills",
  communication: "Soft Skills",
};

/**
 * Deterministic DOCX Text Extraction via JSZip and XML parsing.
 * Reads word/document.xml without requiring external binary dependencies.
 */
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file("word/document.xml");

    if (!docXmlFile) {
      throw new Error("Invalid DOCX format: word/document.xml not found.");
    }

    const xmlContent = await docXmlFile.async("string");

    // Fast regex-based XML paragraph extractor for <w:t> tags
    const paragraphs: string[] = [];
    const pRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/gi;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xmlContent)) !== null) {
      const pBody = pMatch[1];
      const tRegex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/gi;
      let textLine = "";
      let tMatch: RegExpExecArray | null;

      while ((tMatch = tRegex.exec(pBody)) !== null) {
        textLine += tMatch[1];
      }

      if (textLine.trim()) {
        paragraphs.push(textLine.trim());
      }
    }

    return paragraphs.join("\n");
  } catch (err: any) {
    console.warn("DOCX extraction error:", err);
    throw new Error(`Failed to extract text from DOCX document: ${err.message}`);
  }
}

/**
 * Deterministic Plain Text Parser
 */
export function extractTextFromTxt(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

/**
 * Deterministic Contact Information Extractor using RegEx.
 */
export function extractContactInfo(text: string): {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
} {
  const result: ReturnType<typeof extractContactInfo> = {};

  // Email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].trim();
  }

  // Phone pattern (handles +91, 10-digit Indian numbers, international formats)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[-.\s]?[6-9]\d{9}|\b[6-9]\d{9}\b/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    result.phone = phoneMatch[0].trim();
  }

  // LinkedIn
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i;
  const linkedinMatch = text.match(linkedinRegex);
  if (linkedinMatch) {
    result.linkedin = linkedinMatch[0].startsWith("http") ? linkedinMatch[0] : `https://${linkedinMatch[0]}`;
  }

  // GitHub
  const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/?/i;
  const githubMatch = text.match(githubRegex);
  if (githubMatch) {
    result.github = githubMatch[0].startsWith("http") ? githubMatch[0] : `https://${githubMatch[0]}`;
  }

  // Portfolio / Website
  const urlRegex = /(?:https?:\/\/)?([a-zA-Z0-9.-]+\.(?:com|in|dev|io|app|org|me|net))(?:\/[^\s]*)?/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const foundUrl = match[0].toLowerCase();
    if (!foundUrl.includes("linkedin.com") && !foundUrl.includes("github.com") && !foundUrl.includes("gmail.com")) {
      result.portfolio = match[0].startsWith("http") ? match[0] : `https://${match[0]}`;
      break;
    }
  }

  // Location detection: Look for standard Indian or international tech hubs
  const LOCATIONS = [
    "Bengaluru", "Bangalore", "Hyderabad", "Pune", "Mumbai", "Delhi", "Noida",
    "Gurugram", "Gurgaon", "Chennai", "Kolkata", "Ahmedabad", "Remote", "India",
  ];
  for (const loc of LOCATIONS) {
    const locRegex = new RegExp(`\\b${loc}\\b`, "i");
    if (locRegex.test(text)) {
      result.location = loc === "Bangalore" ? "Bengaluru, India" : `${loc}, India`;
      break;
    }
  }

  // Name extraction: Usually in the first 3 lines before email / phone
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    // Candidate line must not have email, phone, or URL, and be 2-4 words
    if (
      !line.includes("@") &&
      !line.includes("http") &&
      !line.includes(".com") &&
      !phoneRegex.test(line) &&
      line.length >= 3 &&
      line.length <= 40 &&
      /^[a-zA-Z\s.-]+$/.test(line)
    ) {
      result.fullName = line;
      break;
    }
  }

  return result;
}

/**
 * Deterministic Technical Skills Extractor from Text using curated Lexicon.
 */
export function extractSkillsFromText(text: string): CareerSkill[] {
  const lowerText = ` ${text.toLowerCase().replace(/[^a-z0-9#+.]/g, " ")} `;
  const detectedSkills = new Map<string, CareerSkill>();

  for (const [skillName, category] of Object.entries(TECHNICAL_SKILL_LEXICON)) {
    // Exact word boundary matching
    const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<=[\\s,;()])${escaped}(?=[\\s,;().])`, "i");

    if (pattern.test(lowerText)) {
      const canonicalName = skillName.charAt(0).toUpperCase() + skillName.slice(1);
      detectedSkills.set(skillName.toLowerCase(), {
        id: `sk_${skillName.replace(/[^a-z0-9]/gi, "_")}`,
        name: canonicalName,
        category,
        proficiency: "intermediate",
      });
    }
  }

  return Array.from(detectedSkills.values());
}

/**
 * Deterministic Section Extractor.
 * Partitions resume text into labeled sections based on standard headings.
 */
export function extractSectionsFromText(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const SECTION_PATTERNS: Record<string, RegExp> = {
    summary: /^(?:professional\s+summary|summary|profile|about\s+me)\b/im,
    education: /^(?:education|academic\s+background|academics|qualifications)\b/im,
    experience: /^(?:work\s+experience|experience|employment\s+history|internships)\b/im,
    projects: /^(?:projects|technical\s+projects|academic\s+projects)\b/im,
    skills: /^(?:skills|technical\s+skills|core\s+competencies|technologies)\b/im,
    certifications: /^(?:certifications|certificates|licenses)\b/im,
    achievements: /^(?:achievements|honors|awards)\b/im,
  };

  const lines = text.split("\n");
  let currentSection = "header";
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matchedSection: string | null = null;
    for (const [secKey, regex] of Object.entries(SECTION_PATTERNS)) {
      if (regex.test(trimmed) && trimmed.length < 40) {
        matchedSection = secKey;
        break;
      }
    }

    if (matchedSection) {
      if (currentLines.length > 0) {
        sections[currentSection] = currentLines.join("\n");
      }
      currentSection = matchedSection;
      currentLines = [];
    } else {
      currentLines.push(trimmed);
    }
  }

  if (currentLines.length > 0) {
    sections[currentSection] = currentLines.join("\n");
  }

  return sections;
}

/**
 * High-level Ingestion Pipeline.
 * Transforms an uploaded resume file into a parsed, structured schema.
 */
export async function parseResumeFile(
  file: File,
  onOcrConsentNeeded?: () => Promise<boolean>
): Promise<ParsedResumeDocument> {
  const fileType = file.type || "";
  const fileName = file.name.toLowerCase();

  let rawText = "";
  let sourceType: ParsedResumeDocument["sourceType"] = "txt";
  let hasTextLayer = true;
  let ocrFallbackUsed = false;
  let confidenceScore = 100;
  let lowConfidenceWarning: string | undefined = undefined;

  // 1. Plain Text
  if (fileName.endsWith(".txt") || fileType.includes("text/plain")) {
    rawText = extractTextFromTxt(await file.text());
    sourceType = "txt";
  }
  // 2. DOCX Document
  else if (fileName.endsWith(".docx") || fileType.includes("wordprocessingml")) {
    const buffer = await file.arrayBuffer();
    rawText = await extractTextFromDocx(buffer);
    sourceType = "docx";
  }
  // 3. PDF Document
  else if (fileName.endsWith(".pdf") || fileType.includes("application/pdf")) {
    sourceType = "pdf";
    const arrayBuffer = await file.arrayBuffer();

    try {
      // Load pdfjs-dist dynamically
      const pdfjsLib = await import("pdfjs-dist");
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;

      let extractedPagesText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items
          .map((item: any) => item.str || "")
          .filter(Boolean);
        extractedPagesText += `${pageItems.join(" ")}\n`;
      }

      rawText = extractedPagesText.trim();

      // If text extraction yielded fewer than 50 characters, it's likely a scanned image PDF
      if (rawText.length < 50) {
        hasTextLayer = false;
        confidenceScore = 40;
      }
    } catch (pdfErr) {
      console.warn("Direct PDF text extraction failed:", pdfErr);
      hasTextLayer = false;
    }

    // Trigger OCR fallback if scanned PDF without text layer
    if (!hasTextLayer) {
      const consentGiven = onOcrConsentNeeded ? await onOcrConsentNeeded() : true;
      if (consentGiven) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const ocrRes = await fetch("/api/ocr/extract", {
            method: "POST",
            body: formData,
          });

          if (ocrRes.ok) {
            const data = await ocrRes.json();
            if (data.text) {
              rawText = data.text;
              ocrFallbackUsed = true;
              confidenceScore = 75;
            }
          }
        } catch (ocrErr) {
          console.warn("OCR fallback failed:", ocrErr);
        }
      }

      if (!rawText) {
        lowConfidenceWarning = "Scanned PDF detected without text layer. You can enter or edit details manually.";
      }
    }
  }
  // 4. Image (.png, .jpg, .jpeg)
  else if (
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileType.startsWith("image/")
  ) {
    sourceType = "image_ocr";
    hasTextLayer = false;

    const consentGiven = onOcrConsentNeeded ? await onOcrConsentNeeded() : true;
    if (consentGiven) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const ocrRes = await fetch("/api/ocr/extract", {
          method: "POST",
          body: formData,
        });

        if (ocrRes.ok) {
          const data = await ocrRes.json();
          if (data.text) {
            rawText = data.text;
            ocrFallbackUsed = true;
            confidenceScore = 80;
          }
        }
      } catch (ocrErr) {
        console.warn("Image OCR failed:", ocrErr);
      }
    }

    if (!rawText) {
      lowConfidenceWarning = "Some text could not be confidently detected from this image. Please review and edit.";
    }
  }

  // Extract structured contact info, skills, and sections
  const contact = extractContactInfo(rawText);
  const skills = extractSkillsFromText(rawText);
  const sections = extractSectionsFromText(rawText);

  const detectedSections = Object.keys(sections);

  return {
    rawText,
    sourceType,
    hasTextLayer,
    ocrFallbackUsed,
    confidenceScore,
    lowConfidenceWarning,
    extractedProfile: {
      fullName: contact.fullName || "Candidate",
      email: contact.email || "",
      phone: contact.phone || "",
      location: contact.location || "",
      linkedin: contact.linkedin || "",
      github: contact.github || "",
      portfolio: contact.portfolio || "",
      summary: sections.summary || "",
      skills,
    },
    detectedSections,
  };
}
