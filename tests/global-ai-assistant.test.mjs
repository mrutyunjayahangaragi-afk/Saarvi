import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_CATEGORIES,
} from '../src/lib/tools/tool-registry.ts';

// ============================================================================
// Deterministic Tool Discovery Engine Behavioral Specification
// ============================================================================

const CATEGORY_NAMES = {
  pdf: 'PDF Tools',
  image: 'Image Tools',
  student: 'Student Tools',
  academic: 'Academic Tools',
  career: 'Career Tools',
  ai: 'AI Tools',
};

const CATEGORY_ROUTES = {
  pdf: '/tools',
  image: '/tools',
  student: '/student',
  academic: '/student',
  career: '/student',
  ai: '/tools',
};

function normalizeQuery(rawQuery) {
  let q = rawQuery.toLowerCase().trim();
  q = q.replace(/[?!.,;:'"()\[\]{}]/g, ' ');
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

function mapToolItem(tool, featureMap) {
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

function resolveToolQuery(rawQuery, featureMap) {
  const query = normalizeQuery(rawQuery);
  if (!query) {
    return {
      type: 'NO_MATCH',
      reply: "I couldn't find a Saarvi tool matching that request. Try asking for PDF, Image, Student, Academic, Career, or AI tools.",
    };
  }

  // 1. Category Inquiries
  const categoryKeywords = {
    pdf: ['pdf', 'pdf tools', 'pdfs', 'document tools', 'adobe'],
    image: ['image', 'images', 'image tools', 'photo', 'photos', 'photo tools', 'pictures'],
    student: ['student', 'student tools', 'study tools', 'campus', 'study', 'timetable', 'attendance'],
    academic: ['academic', 'academic tools', 'academics', 'grades', 'gpa', 'university tools'],
    career: ['career', 'career tools', 'jobs', 'job tools', 'resumes', 'interviews', 'placement'],
    ai: ['ai', 'ai tools', 'artificial intelligence', 'copilot tools', 'ocr tools'],
  };

  for (const [catId, keywords] of Object.entries(categoryKeywords)) {
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

  // 2. Direct Canonical Tool Match
  const intentMappings = [
    { synonyms: ['sgpa', 'sgpa calculator', 'semester gpa', 'calculate sgpa', 'my sgpa', 'calculate my sgpa', 'academic grade calculator'], targetKey: 'sgpa-calculator' },
    { synonyms: ['cgpa', 'cgpa calculator', 'cumulative gpa', 'calculate cgpa', 'my cgpa', 'cgpa goal', 'target cgpa'], targetKey: 'cgpa-calculator' },
    { synonyms: ['resume', 'resume builder', 'create resume', 'make resume', 'make a resume', 'cv', 'cv maker', 'ats resume'], targetKey: 'resume-builder' },
    { synonyms: ['cover letter', 'cover letter builder', 'make a cover letter', 'make cover letter', 'job letter', 'internship cover letter'], targetKey: 'cover-letter' },
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
    { synonyms: ['exam schedule', 'exam countdown', 'exam planner'], targetKey: 'exams' },
    { synonyms: ['ocr image', 'image to text', 'extract text from photo', 'photo to text'], targetKey: 'ocr-image' },
    { synonyms: ['ocr pdf', 'scanned pdf to text', 'searchable pdf'], targetKey: 'ocr-pdf' },
    { synonyms: ['ai copilot', 'student copilot', 'academic copilot', 'ai assistant', 'study assistant'], targetKey: 'student-copilot' },
    { synonyms: ['mock interview', 'interview coach', 'ai interview'], targetKey: 'copilot-interview' },
    { synonyms: ['ats scanner', 'ats analyzer', 'resume score', 'ats keyword scanner'], targetKey: 'ats-analyzer' },
  ];

  let matchedTool;

  for (const mapping of intentMappings) {
    if (mapping.synonyms.some((syn) => query === syn || query.includes(syn))) {
      matchedTool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === mapping.targetKey);
      if (matchedTool) break;
    }
  }

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

  if (!matchedTool) {
    matchedTool = CANONICAL_TOOL_REGISTRY.find((t) =>
      t.keywords?.some((kw) => query === kw.toLowerCase() || query.includes(kw.toLowerCase()))
    );
  }

  if (!matchedTool) {
    matchedTool = CANONICAL_TOOL_REGISTRY.find((t) =>
      t.name.toLowerCase().includes(query) || query.includes(t.name.toLowerCase())
    );
  }

  if (matchedTool) {
    const item = mapToolItem(matchedTool, featureMap);

    if (item.isDisabled) {
      return {
        type: 'DISABLED',
        reply: `${item.name} is currently unavailable.`,
        tools: [item],
      };
    }

    if (item.requiresPro) {
      return {
        type: 'PRO_REQUIRED',
        reply: `${item.name} is available under ${item.categoryName} and requires Pro.`,
        tools: [item],
      };
    }

    return {
      type: 'TOOL',
      reply: `${item.name} is available under ${item.categoryName}.`,
      tools: [item],
    };
  }

  // 3. Multi-match
  const queryTokens = query.split(/\s+/).filter((t) => t.length > 2);
  if (queryTokens.length > 0) {
    const multiMatches = CANONICAL_TOOL_REGISTRY.filter((t) => {
      const name = t.name.toLowerCase();
      const keywords = (t.keywords || []).join(' ').toLowerCase();
      const matchingTokens = queryTokens.filter(
        (token) => name.includes(token) || keywords.includes(token)
      );

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

  return {
    type: 'NO_MATCH',
    reply: "I couldn't find a Saarvi tool matching that request.",
  };
}

// ============================================================================
// TESTS
// ============================================================================

test('AI Tool Assistant — Exact query: "Where is SGPA Calculator?" resolves to Academic Tools and canonical route', () => {
  const res = resolveToolQuery('Where is SGPA Calculator?');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools.length === 1);

  const tool = res.tools[0];
  assert.strictEqual(tool.name, 'SGPA Calculator');
  assert.strictEqual(tool.categoryName, 'Academic Tools');
  assert.strictEqual(tool.route, '/student/sgpa-calculator');
  assert.strictEqual(res.reply, 'SGPA Calculator is available under Academic Tools.');
});

test('AI Tool Assistant — Exact query: "Where is the CGPA calculator?" resolves to Academic Tools and canonical route', () => {
  const res = resolveToolQuery('Where is the CGPA calculator?');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools.length === 1);

  const tool = res.tools[0];
  assert.strictEqual(tool.name, 'CGPA Calculator');
  assert.strictEqual(tool.categoryName, 'Academic Tools');
  assert.strictEqual(tool.route, '/student/cgpa-calculator');
});

test('AI Tool Assistant — Conversational query: "Where can I convert PDF to JPG?" resolves to PDF to JPG tool', () => {
  const res = resolveToolQuery('Where can I convert PDF to JPG?');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools.length === 1);

  const tool = res.tools[0];
  assert.strictEqual(tool.name, 'PDF to JPG');
  assert.strictEqual(tool.categoryName, 'PDF Tools');
  assert.strictEqual(tool.route, '/tools/pdf-to-jpg');
});

test('AI Tool Assistant — Category inquiry: "Show me image tools." resolves to Image Tools category with valid route', () => {
  const res = resolveToolQuery('Show me image tools.');
  assert.strictEqual(res.type, 'CATEGORY');
  assert.strictEqual(res.categoryName, 'Image Tools');
  assert.strictEqual(res.categoryRoute, '/tools');
  assert.ok(res.tools && res.tools.length > 0);
  assert.ok(res.tools.every((t) => t.category === 'image'));
});

test('AI Tool Assistant — Query: "Where is Resume Builder?" resolves to Career Tools and /student/resume', () => {
  const res = resolveToolQuery('Where is Resume Builder?');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools.length === 1);

  const tool = res.tools[0];
  assert.strictEqual(tool.name, 'Resume Builder');
  assert.strictEqual(tool.categoryName, 'Career Tools');
  assert.strictEqual(tool.route, '/student/resume');
});

test('AI Tool Assistant — Conversational query: "Where can I make a cover letter?" resolves to Cover Letter Builder', () => {
  const res = resolveToolQuery('Where can I make a cover letter?');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools.length === 1);

  const tool = res.tools[0];
  assert.strictEqual(tool.name, 'Cover Letter Builder');
  assert.strictEqual(tool.categoryName, 'Career Tools');
  assert.strictEqual(tool.route, '/student/cover-letter');
});

test('AI Tool Assistant — Query: "Where is Job Application Tracker?" resolves to Job Application Tracker', () => {
  const res = resolveToolQuery('Where is Job Application Tracker?');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools.length === 1);

  const tool = res.tools[0];
  assert.strictEqual(tool.name, 'Job Application Tracker');
  assert.strictEqual(tool.categoryName, 'Career Tools');
  assert.strictEqual(tool.route, '/student/jobs');
});

test('AI Tool Assistant — Category query: "Where are Student Tools?" resolves to Student Tools category', () => {
  const res = resolveToolQuery('Where are Student Tools?');
  assert.strictEqual(res.type, 'CATEGORY');
  assert.strictEqual(res.categoryName, 'Student Tools');
  assert.strictEqual(res.categoryRoute, '/student');
  assert.ok(res.tools && res.tools.length > 0);
});

test('AI Tool Assistant — Category query: "Show me Career Tools." resolves to Career Tools category', () => {
  const res = resolveToolQuery('Show me Career Tools.');
  assert.strictEqual(res.type, 'CATEGORY');
  assert.strictEqual(res.categoryName, 'Career Tools');
  assert.strictEqual(res.categoryRoute, '/student');
  assert.ok(res.tools && res.tools.length > 0);
});

test('AI Tool Assistant — Category query: "Where is AI Tools?" resolves to AI Tools category', () => {
  const res = resolveToolQuery('Where is AI Tools?');
  assert.strictEqual(res.type, 'CATEGORY');
  assert.strictEqual(res.categoryName, 'AI Tools');
  assert.strictEqual(res.categoryRoute, '/tools');
  assert.ok(res.tools && res.tools.length > 0);
});

test('AI Tool Assistant — Alias query: "calculate my sgpa" resolves to SGPA Calculator', () => {
  const res = resolveToolQuery('calculate my sgpa');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools[0].name === 'SGPA Calculator');
});

test('AI Tool Assistant — Alias query: "cv maker" resolves to Resume Builder', () => {
  const res = resolveToolQuery('cv maker');
  assert.strictEqual(res.type, 'TOOL');
  assert.ok(res.tools && res.tools[0].name === 'Resume Builder');
});

test('AI Tool Assistant — Pro tool query: AI Student Copilot indicates subscription requirement', () => {
  const res = resolveToolQuery('Where is AI Student Copilot?');
  assert.ok(res.type === 'PRO_REQUIRED' || res.type === 'TOOL');
  assert.ok(res.tools && res.tools.length > 0);
  const tool = res.tools[0];
  assert.strictEqual(tool.name, 'AI Student Copilot');
  assert.strictEqual(tool.requiresPro, true);
  assert.ok(res.reply.includes('requires Pro'));
});

test('AI Tool Assistant — Non-existent tool request never hallucinates a fake route', () => {
  const res = resolveToolQuery('Where is quantum teleportation scanner?');
  assert.strictEqual(res.type, 'NO_MATCH');
  assert.strictEqual(res.reply, "I couldn't find a Saarvi tool matching that request.");
  assert.strictEqual(res.tools, undefined);
  assert.strictEqual(res.categoryRoute, undefined);
});

test('AI Tool Assistant — Every route returned by AI assistant exists in CANONICAL_TOOL_REGISTRY', () => {
  const testQueries = [
    'Where is SGPA Calculator?',
    'Where is CGPA Calculator?',
    'Where is Resume Builder?',
    'Where is Cover Letter Builder?',
    'Where is Job Application Tracker?',
    'Where is PDF to JPG?',
    'Where is Merge PDF?',
    'Where is Split PDF?',
    'Where is Compress PDF?',
    'Where is Timetable?',
    'Where is Attendance?',
    'Where is Image to Text (OCR)?',
  ];

  const canonicalRoutes = new Set(CANONICAL_TOOL_REGISTRY.map((t) => t.route));

  for (const q of testQueries) {
    const res = resolveToolQuery(q);
    assert.ok(res.tools && res.tools.length > 0, `Query failed: ${q}`);
    const tool = res.tools[0];
    assert.ok(
      canonicalRoutes.has(tool.route),
      `Route ${tool.route} for query "${q}" is not in CANONICAL_TOOL_REGISTRY!`
    );
  }
});
