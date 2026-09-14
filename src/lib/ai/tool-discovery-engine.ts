/**
 * Saarvi Deterministic Tool Discovery Engine
 *
 * Guarantees:
 * - Single source of truth: queries CANONICAL_TOOL_REGISTRY and CANONICAL_TOOL_CATEGORIES.
 * - Zero route hallucinations: only emits verified canonical routes.
 * - Sub-millisecond deterministic matching first (exact, aliases, natural language queries).
 * - Authoritative feature flag and Pro access awareness.
 * - Local-first privacy: queries are resolved without external document telemetry.
 */

import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_CATEGORIES,
} from '../tools/tool-registry';
import type {
  CanonicalTool,
  CanonicalToolCategory,
} from '../tools/tool-registry';

export interface DiscoveredToolItem {
  key: string;
  name: string;
  category: CanonicalToolCategory;
  categoryName: string;
  description: string;
  route: string;
  icon: string;
  badge?: string;
  requiresPro: boolean;
  isDisabled: boolean;
}

export interface ToolDiscoveryResult {
  type: 'TOOL' | 'CATEGORY' | 'MULTIPLE' | 'DISABLED' | 'PRO_REQUIRED' | 'NO_MATCH';
  reply: string;
  tools?: DiscoveredToolItem[];
  categoryRoute?: string;
  categoryName?: string;
}

const CATEGORY_NAMES: Record<CanonicalToolCategory, string> = {
  pdf: 'PDF Tools',
  image: 'Image Tools',
  student: 'Student Tools',
  academic: 'Academic Tools',
  career: 'Career Tools',
  ai: 'AI Tools',
};

const CATEGORY_ROUTES: Record<CanonicalToolCategory, string> = {
  pdf: '/tools',
  image: '/tools',
  student: '/student',
  academic: '/student',
  career: '/student',
  ai: '/tools',
};

/**
 * Normalizes user questions for natural language interpretation.
 */
function normalizeQuery(rawQuery: string): string {
  let q = rawQuery.toLowerCase().trim();
  // Strip punctuation
  q = q.replace(/[?!.,;:'"()\[\]{}]/g, ' ');
  // Strip common inquiry conversational phrases
  const stopPhrases = [
    'where is the',
    'where is a',
    'where is an',
    'where is',
    'where are the',
    'where are',
    'where can i find the',
    'where can i find a',
    'where can i find',
    'where can i get the',
    'where can i get',
    'where can i make a',
    'where can i make',
    'where can i create a',
    'where can i create',
    'where can i convert',
    'where can i',
    'where do i find',
    'how can i find',
    'how to find',
    'how do i calculate',
    'how to calculate',
    'can i use',
    'can i get',
    'can i find',
    'show me the',
    'show me',
    'tell me about',
    'find me',
    'find',
    'open the',
    'open',
    'give me',
  ];

  for (const phrase of stopPhrases) {
    if (q.startsWith(phrase + ' ')) {
      q = q.slice(phrase.length).trim();
      break;
    }
  }

  return q.trim();
}

/**
 * Maps a CanonicalTool into a DiscoveredToolItem with runtime status and accessMode evaluated.
 */
function mapToolItem(
  tool: CanonicalTool,
  featureMap?: Record<string, { status?: string; accessMode?: string }>
): DiscoveredToolItem {
  const flag = featureMap
    ? featureMap[tool.featureFlagKey] || featureMap[tool.key]
    : undefined;

  const isDisabled = flag
    ? flag.status === 'DISABLED'
    : tool.status === 'coming_soon';
  const requiresPro = flag
    ? flag.accessMode === 'SUBSCRIPTION'
    : tool.defaultAccess === 'SUBSCRIPTION';

  return {
    key: tool.key,
    name: tool.name,
    category: tool.category,
    categoryName: CATEGORY_NAMES[tool.category] || tool.category,
    description: tool.description,
    route: tool.route,
    icon: tool.icon,
    badge: tool.badge,
    requiresPro,
    isDisabled,
  };
}

/**
 * Deterministically resolves a user's natural language tool query against CANONICAL_TOOL_REGISTRY.
 */
export function resolveToolQuery(
  rawQuery: string,
  featureMap?: Record<string, { status?: string; accessMode?: string }>
): ToolDiscoveryResult {
  const query = normalizeQuery(rawQuery);
  if (!query) {
    return {
      type: 'NO_MATCH',
      reply: "I couldn't find a Saarvi tool matching that request. Try asking for PDF, Image, Student, Academic, Career, or AI tools.",
    };
  }

  // =========================================================================
  // 1. Check for Category Inquiries (e.g., "where are pdf tools?", "show me career tools")
  // =========================================================================
  const categoryKeywords: Record<CanonicalToolCategory, string[]> = {
    pdf: ['pdf', 'pdf tools', 'pdfs', 'document tools', 'adobe'],
    image: ['image', 'images', 'image tools', 'photo', 'photos', 'photo tools', 'pictures'],
    student: ['student', 'student tools', 'study tools', 'campus', 'study', 'timetable', 'attendance'],
    academic: ['academic', 'academic tools', 'academics', 'grades', 'gpa', 'university tools'],
    career: ['career', 'career tools', 'jobs', 'job tools', 'resumes', 'interviews', 'placement'],
    ai: ['ai', 'ai tools', 'artificial intelligence', 'copilot tools', 'ocr tools'],
  };

  // Check if query is explicitly asking for a whole category
  for (const [catId, keywords] of Object.entries(categoryKeywords) as Array<[CanonicalToolCategory, string[]]>) {
    const isCategoryRequest = keywords.some(
      (kw) => query === kw || query === `${kw} tools` || query === `all ${kw}`
    );

    if (isCategoryRequest) {
      const categoryName = CATEGORY_NAMES[catId];
      const categoryRoute = CATEGORY_ROUTES[catId];
      const categoryTools = CANONICAL_TOOL_REGISTRY.filter((t) => t.category === catId).map((t) => mapToolItem(t, featureMap));

      return {
        type: 'CATEGORY',
        reply: `${categoryName} are available in the ${catId === 'pdf' || catId === 'image' || catId === 'ai' ? 'Tools' : 'Student'} menu.`,
        categoryName,
        categoryRoute,
        tools: categoryTools.slice(0, 6),
      };
    }
  }

  // =========================================================================
  // 2. Direct Canonical Tool Match by Exact Name, Key, or Synonyms
  // =========================================================================
  // Common synonym map for high-frequency user intentions
  const intentMappings: Array<{ synonyms: string[]; targetKey: string }> = [
    { synonyms: ['sgpa', 'sgpa calculator', 'semester gpa', 'calculate sgpa', 'my sgpa', 'calculate my sgpa', 'academic grade calculator'], targetKey: 'sgpa-calculator' },
    { synonyms: ['cgpa', 'cgpa calculator', 'cumulative gpa', 'calculate cgpa', 'my cgpa', 'cgpa goal', 'target cgpa'], targetKey: 'cgpa-calculator' },
    { synonyms: ['resume', 'resume builder', 'create resume', 'make resume', 'make a resume', 'cv', 'cv maker', 'ats resume'], targetKey: 'resume-builder' },
    { synonyms: ['cover letter', 'cover letter builder', 'make a cover letter', 'make cover letter', 'job letter', 'internship cover letter'], targetKey: 'cover-letter' },
    { synonyms: ['pdf to excel', 'convert pdf to excel', 'make spreadsheet from pdf', 'pdf to xlsx', 'extract table from pdf', 'pdf spreadsheet'], targetKey: 'pdf-to-excel' },
    { synonyms: ['excel to pdf', 'convert excel to pdf', 'xlsx to pdf', 'spreadsheet to pdf', 'sheet to pdf', 'turn excel into pdf'], targetKey: 'excel-to-pdf' },
    { synonyms: ['pdf to powerpoint', 'convert pdf to powerpoint', 'pdf to pptx', 'pdf to slides', 'pdf to presentation'], targetKey: 'pdf-to-powerpoint' },
    { synonyms: ['powerpoint to pdf', 'turn powerpoint into pdf', 'convert powerpoint to pdf', 'pptx to pdf', 'slides to pdf', 'presentation to pdf'], targetKey: 'powerpoint-to-pdf' },
    { synonyms: ['txt to pdf', 'convert txt to pdf', 'text to pdf', 'plain text to pdf', 'notepad to pdf'], targetKey: 'txt-to-pdf' },
    { synonyms: ['csv to pdf', 'convert csv to pdf', 'csv to table pdf', 'data to pdf'], targetKey: 'csv-to-pdf' },
    { synonyms: ['html to pdf', 'convert html to pdf', 'webpage to pdf', 'save html as pdf'], targetKey: 'html-to-pdf' },
    { synonyms: ['pdf to jpg', 'convert pdf to jpg', 'pdf to image', 'extract jpg from pdf'], targetKey: 'pdf-to-jpg' },
    { synonyms: ['jpg to pdf', 'convert jpg to pdf', 'photo to pdf', 'image to pdf'], targetKey: 'jpg-to-pdf' },
    { synonyms: ['merge pdf', 'combine pdf', 'join pdf', 'combine pdfs'], targetKey: 'merge-pdf' },
    { synonyms: ['split pdf', 'cut pdf', 'separate pdf', 'extract pages'], targetKey: 'split-pdf' },
    { synonyms: ['compress pdf', 'reduce pdf size', 'shrink pdf', 'pdf compressor'], targetKey: 'compress-pdf' },
    { synonyms: ['pdf to png', 'convert pdf to png'], targetKey: 'pdf-to-png' },
    { synonyms: ['png to pdf', 'convert png to pdf'], targetKey: 'png-to-pdf' },
    { synonyms: ['id photo', 'passport photo', 'id photo maker', 'crop photo'], targetKey: 'id-photo' },
    { synonyms: ['job tracker', 'job application tracker', 'track jobs', 'job search kanban', 'internship tracker'], targetKey: 'job-tracker' },
    { synonyms: ['timetable', 'class schedule', 'timetable organizer', 'weekly schedule'], targetKey: 'timetable' },
    { synonyms: ['attendance', 'attendance tracker', 'bunk calculator', 'attendance percentage'], targetKey: 'attendance' },
    { synonyms: ['exam schedule', 'exam countdown', 'exam planner', 'exams'], targetKey: 'exams' },
    { synonyms: ['assignments', 'homework tracker', 'assignment deadline', 'homework'], targetKey: 'assignments' },
    { synonyms: ['study planner', 'study sessions', 'pomodoro', 'study timer'], targetKey: 'study-planner' },
    { synonyms: ['student notes', 'study notes', 'revision notes', 'lecture notes', 'notes', 'private notes'], targetKey: 'student-notes' },
    { synonyms: ['skill gap', 'skill gap analysis', 'analyze skills', 'tech skills gap', 'role readiness', 'skills'], targetKey: 'skill-gap' },
    { synonyms: ['interview prep', 'interview preparation', 'tech interview questions', 'dsa questions', 'coding questions'], targetKey: 'interview-prep' },
    { synonyms: ['document scanner', 'scan document', 'camera scanner', 'scan paper', 'scan with camera', 'webcam scan'], targetKey: 'document-scanner' },
    { synonyms: ['scan to pdf', 'scanned images to pdf', 'convert scan to pdf', 'camera to pdf'], targetKey: 'scan-to-pdf' },
    { synonyms: ['photo to document', 'clean photo document', 'enhance paper photo', 'photo cleanup', 'paperwork photo'], targetKey: 'photo-to-document' },
    { synonyms: ['protect pdf', 'encrypt pdf', 'password protect pdf', 'lock pdf', 'set pdf password', 'secure pdf'], targetKey: 'protect-pdf' },
    { synonyms: ['unlock pdf', 'remove pdf password', 'decrypt pdf', 'unlock protected pdf'], targetKey: 'unlock-pdf' },
    { synonyms: ['watermark pdf', 'add watermark', 'stamp pdf', 'watermark'], targetKey: 'watermark-pdf' },
    { synonyms: ['page numbers pdf', 'add page numbers', 'number pdf pages', 'number pages'], targetKey: 'page-numbers-pdf' },
    { synonyms: ['pdf header footer', 'header and footer', 'add header footer', 'page header'], targetKey: 'pdf-header-footer' },
    { synonyms: ['pdf metadata', 'edit pdf author', 'change pdf title', 'metadata editor'], targetKey: 'pdf-metadata' },
    { synonyms: ['flatten pdf', 'flatten form fields', 'flatten annotations'], targetKey: 'flatten-pdf' },
    { synonyms: ['pdf info', 'inspect pdf', 'pdf details', 'pdf properties'], targetKey: 'pdf-info' },
    { synonyms: ['ocr image', 'image to text', 'extract text from photo', 'photo to text'], targetKey: 'ocr-image' },
    { synonyms: ['ocr pdf', 'scanned pdf to text', 'searchable pdf'], targetKey: 'ocr-pdf' },
    { synonyms: ['ai copilot', 'student copilot', 'academic copilot', 'ai assistant', 'study assistant'], targetKey: 'student-copilot' },
    { synonyms: ['mock interview', 'interview coach', 'ai interview'], targetKey: 'copilot-interview' },
    { synonyms: ['ats scanner', 'ats analyzer', 'resume score', 'ats keyword scanner'], targetKey: 'ats-analyzer' },
  ];

  let matchedTool: CanonicalTool | undefined;

  // 2a. Check intent mappings
  for (const mapping of intentMappings) {
    if (mapping.synonyms.some((syn) => query === syn || query.includes(syn))) {
      matchedTool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === mapping.targetKey);
      if (matchedTool) break;
    }
  }

  // 2b. Check exact name or key
  if (!matchedTool) {
    matchedTool = CANONICAL_TOOL_REGISTRY.find(
      (t) =>
        t.key.toLowerCase() === query ||
        t.name.toLowerCase() === query ||
        t.name.toLowerCase() === `${query} calculator` ||
        t.name.toLowerCase() === `${query} builder` ||
        t.name.toLowerCase() === `${query} tools`
    );
  }

  // 2c. Check keywords
  if (!matchedTool) {
    matchedTool = CANONICAL_TOOL_REGISTRY.find((t) =>
      t.keywords?.some((kw) => query === kw.toLowerCase() || query.includes(kw.toLowerCase()))
    );
  }

  // 2d. Substring in tool name
  if (!matchedTool) {
    matchedTool = CANONICAL_TOOL_REGISTRY.find((t) =>
      t.name.toLowerCase().includes(query) || query.includes(t.name.toLowerCase())
    );
  }

  // If a specific tool was identified:
  if (matchedTool) {
    const item = mapToolItem(matchedTool, featureMap);

    // Check if tool is disabled
    if (item.isDisabled) {
      return {
        type: 'DISABLED',
        reply: `${item.name} is currently unavailable.`,
        tools: [item],
      };
    }

    // Check if tool requires Pro
    if (item.requiresPro) {
      return {
        type: 'PRO_REQUIRED',
        reply: `${item.name} is available under ${item.categoryName} and requires Pro.`,
        tools: [item],
      };
    }

    // Enabled & Free
    return {
      type: 'TOOL',
      reply: `${item.name} is available under ${item.categoryName}.`,
      tools: [item],
    };
  }

  // =========================================================================
  // 3. Multi-match search across all tools (e.g., query contains words matching multiple tools)
  // =========================================================================
  const queryTokens = query.split(/\s+/).filter((t) => t.length > 2);
  if (queryTokens.length > 0) {
    const multiMatches = CANONICAL_TOOL_REGISTRY.filter((t) => {
      const name = t.name.toLowerCase();
      const keywords = (t.keywords || []).join(' ').toLowerCase();
      const matchingTokens = queryTokens.filter(
        (token) => name.includes(token) || keywords.includes(token)
      );

      // Require at least 50% of query tokens to match or >= 2 tokens for multi-word queries
      if (queryTokens.length === 1) {
        return matchingTokens.length === 1;
      }
      return matchingTokens.length >= 2 || matchingTokens.length / queryTokens.length >= 0.5;
    }).map((t) => mapToolItem(t, featureMap));

    if (multiMatches.length > 1) {
      return {
        type: 'MULTIPLE',
        reply: 'Here are the relevant Saarvi tools found for your request:',
        tools: multiMatches.slice(0, 4),
      };
    } else if (multiMatches.length === 1) {
      const single = multiMatches[0];
      if (single.isDisabled) {
        return {
          type: 'DISABLED',
          reply: `${single.name} is currently unavailable.`,
          tools: [single],
        };
      }
      if (single.requiresPro) {
        return {
          type: 'PRO_REQUIRED',
          reply: `${single.name} is available under ${single.categoryName} and requires Pro.`,
          tools: [single],
        };
      }
      return {
        type: 'TOOL',
        reply: `${single.name} is available under ${single.categoryName}.`,
        tools: [single],
      };
    }
  }

  // =========================================================================
  // 4. No match found - never hallucinate
  // =========================================================================
  return {
    type: 'NO_MATCH',
    reply: "I couldn't find a Saarvi tool matching that request.",
  };
}
