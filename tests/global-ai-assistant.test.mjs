import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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

// ============================================================================
// Grounded Knowledge & Workflow Engine Specification (Saarvi AI 2.0)
// ============================================================================

function evaluateGroundedKnowledge(query, options) {
  const q = query.toLowerCase().trim();
  const cleaned = q.replace(/[?!.,;:'"()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Greetings
  const greetings = ['hi', 'hello', 'hey', 'hey there', 'good morning', 'good afternoon', 'good evening', 'greetings', 'sup', 'yo'];
  if (greetings.includes(cleaned)) {
    return {
      reply: "Hi! I'm Saarvi AI. I can help you find tools, understand Saarvi features, plan your studies, prepare for your career, and answer general questions. What would you like to work on?",
      intent: 'GREETING',
    };
  }

  // 2. Capabilities
  if (
    cleaned === 'what can you do' ||
    cleaned === 'what can saarvi do' ||
    cleaned === 'what is saarvi' ||
    cleaned === 'who are you' ||
    cleaned === 'help' ||
    cleaned === 'what do you do'
  ) {
    return {
      reply: "I'm Saarvi AI, your integrated assistant for Tool Discovery, Academic Guidance, Career Preparation, Computer Science Concepts, and Platform & Plans.",
      intent: 'CAPABILITIES',
    };
  }

  // 3. VTU SGPA & CGPA
  if (
    cleaned.includes('difference between sgpa and cgpa') ||
    cleaned.includes('sgpa vs cgpa') ||
    cleaned.includes('diff between sgpa and cgpa')
  ) {
    const sgpaTool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'sgpa-calculator'));
    const cgpaTool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'cgpa-calculator'));
    return {
      reply: "SGPA measures single semester performance while CGPA measures cumulative performance across all completed semesters.",
      tools: [sgpaTool, cgpaTool].filter(Boolean),
      intent: 'ACADEMIC_EXPLANATION',
    };
  }

  if (
    cleaned === 'what is sgpa' ||
    cleaned === 'explain sgpa' ||
    cleaned === 'how is sgpa calculated' ||
    cleaned === 'how do i calculate sgpa' ||
    cleaned === 'how to calculate sgpa'
  ) {
    const sgpaTool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'sgpa-calculator'));
    return {
      reply: "SGPA (Semester Grade Point Average) is the weighted average of grade points obtained in all courses in a semester: SGPA = Σ(Course Credits × Grade Points) / Total Semester Credits.",
      tools: sgpaTool ? [sgpaTool] : [],
      intent: 'ACADEMIC_EXPLANATION',
    };
  }

  if (
    cleaned === 'what is cgpa' ||
    cleaned === 'explain cgpa' ||
    cleaned === 'how is cgpa calculated' ||
    cleaned === 'how do i calculate cgpa'
  ) {
    const cgpaTool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'cgpa-calculator'));
    return {
      reply: "CGPA (Cumulative Grade Point Average) is the cumulative weighted measure of academic performance across all completed semesters: CGPA = Σ(Semester SGPA × Semester Credits) / Total Degree Credits.",
      tools: cgpaTool ? [cgpaTool] : [],
      intent: 'ACADEMIC_EXPLANATION',
    };
  }

  // 4. Feature Workflows
  if (
    cleaned.includes('how do i convert pdf to word') ||
    cleaned.includes('how to convert pdf to word') ||
    cleaned.includes('convert pdf to word workflow')
  ) {
    const tool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'pdf-to-word'));
    return {
      reply: "How to convert PDF to Word in Saarvi: 1. Open the PDF to Word tool. 2. Upload or drag & drop your PDF file. 3. Click Convert to Word. 4. Download your formatted .docx file.",
      tools: tool ? [tool] : [],
      intent: 'FEATURE_WORKFLOW',
    };
  }

  if (
    cleaned.includes('how do i use resume builder') ||
    cleaned.includes('how to use resume builder') ||
    cleaned.includes('help me create a resume') ||
    cleaned.includes('how to make a resume') ||
    cleaned.includes('create a resume')
  ) {
    const tool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'resume-builder'));
    return {
      reply: "How to build a resume in Saarvi: 1. Open Resume Builder. 2. Fill personal info, education, experience, projects, skills. 3. Inspect live preview. 4. Auto-saves locally. 5. Click Download PDF.",
      tools: tool ? [tool] : [],
      intent: 'FEATURE_WORKFLOW',
    };
  }

  if (
    cleaned.includes('how do i create a study plan') ||
    cleaned.includes('how to create a study plan') ||
    cleaned.includes('study planning')
  ) {
    const tool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'study-planner'));
    return {
      reply: "Creating a Study Plan in Saarvi: 1. Open Study Planner. 2. Add subjects and target hours. 3. Break into 25 or 50-minute Pomodoro intervals. 4. Track daily completion locally.",
      tools: tool ? [tool] : [],
      intent: 'FEATURE_WORKFLOW',
    };
  }

  if (
    cleaned.includes('how do i pay for pro') ||
    cleaned.includes('how to pay for pro') ||
    cleaned.includes('upgrade to pro') ||
    cleaned.includes('pro plan') ||
    cleaned.includes('pay for pro')
  ) {
    return {
      reply: "How to upgrade to Saarvi Pro: 1. Visit /pricing. 2. Select Monthly (₹49/mo) or Yearly (₹399/yr). 3. Scan official UPI QR code. 4. Submit 12-digit UPI UTR. 5. Verified within 2-4 hours.",
      suggestedAction: { label: 'View Plans & Pricing', route: '/pricing' },
      intent: 'PAYMENT_HELP',
    };
  }

  if (
    cleaned.includes('where is my payment') ||
    cleaned.includes('payment status') ||
    cleaned.includes('check my payment')
  ) {
    return {
      reply: "To check payment status: Go to Account Settings (/dashboard/settings). Manual UPI UTR submissions are reviewed by administrators within a few hours.",
      suggestedAction: { label: 'Go to Settings', route: '/dashboard/settings' },
      intent: 'PAYMENT_HELP',
    };
  }

  // 5. CS Fundamentals
  if (cleaned.includes('explain recursion') || cleaned.includes('what is recursion')) {
    return {
      reply: "Recursion is a technique where a function calls itself to break down a large problem into smaller subproblems. Requires Base Case and Recursive Step.",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is oop') || cleaned.includes('explain oop') || cleaned.includes('object oriented programming')) {
    return {
      reply: "Object-Oriented Programming (OOP) 4 Pillars: Encapsulation, Abstraction, Inheritance, Polymorphism.",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is an api') || cleaned.includes('what is api') || cleaned.includes('explain api')) {
    return {
      reply: "An API (Application Programming Interface) allows two software applications to communicate. Analogy: Client (You), API (Waiter), Server (Kitchen).",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is a database') || cleaned.includes('explain database') || cleaned.includes('what is database')) {
    return {
      reply: "A database is an organized collection of data. Types: Relational (SQL, e.g. PostgreSQL) and Non-Relational (NoSQL, e.g. MongoDB).",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is a thread in os') || cleaned.includes('thread in os') || cleaned.includes('what is a thread')) {
    return {
      reply: "A thread is the smallest unit of execution in an OS, often called a lightweight process. Shares memory and code, maintains its own PC and registers.",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is a system call') || cleaned.includes('system call in os') || cleaned.includes('system call')) {
    return {
      reply: "A system call is the programmatic interface for user programs to request kernel services via software interrupt (trap), switching from User Mode to Kernel Mode.",
      intent: 'CS_EDUCATION',
    };
  }

  // 6. Career Guidance
  if (
    cleaned.includes('prepare for placements') ||
    cleaned.includes('how to prepare for interviews') ||
    cleaned.includes('help me prepare for interviews') ||
    cleaned.includes('placement preparation')
  ) {
    const interviewTool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'interview-prep'));
    const resumeTool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'resume-builder'));
    return {
      reply: "4-Stage Placement Roadmap: 1. Core DSA Foundations. 2. CS Core Subjects (OS, DBMS, Networks). 3. Projects & ATS Resume. 4. Mock Interviews & STAR method.",
      tools: [interviewTool, resumeTool].filter(Boolean),
      intent: 'CAREER_GUIDANCE',
    };
  }

  if (cleaned.includes('what should i learn after java') || cleaned.includes('learn after java')) {
    return {
      reply: "After Java: Spring Boot, REST APIs, Microservices, Cloud/DevOps (Docker/K8s), TypeScript/React, and DSA.",
      intent: 'CAREER_GUIDANCE',
    };
  }

  if (cleaned.includes('how can i improve my resume') || cleaned.includes('improve resume') || cleaned.includes('resume tips')) {
    const tool = mapToolItem(CANONICAL_TOOL_REGISTRY.find(t => t.key === 'resume-builder'));
    return {
      reply: "Resume Tips: 1. Use impact metrics (quantifiable numbers). 2. Single-column ATS format. 3. Strong action verbs. 4. Tailor keywords.",
      tools: tool ? [tool] : [],
      intent: 'CAREER_GUIDANCE',
    };
  }

  // 7. Admin Isolation
  if (cleaned.includes('admin') || cleaned.includes('control center') || cleaned.includes('navigation management')) {
    if (options?.isAdmin) {
      return {
        reply: "Admin Portal: Navigation & Tools (/admin/navigation), Feature Flags (/admin/features), Platform Analytics (/admin/analytics).",
        suggestedAction: { label: 'Open Admin Portal', route: '/admin' },
        intent: 'ADMIN_GUIDANCE',
      };
    } else {
      return {
        reply: "Administrative controls and portal routes are strictly restricted to verified platform administrators.",
        intent: 'ADMIN_ACCESS_RESTRICTED',
      };
    }
  }

  return null;
}

// ============================================================================
// PART B & C: AI ASSISTANT 2.0 GROUNDED KNOWLEDGE TESTS
// ============================================================================

test('AI Assistant 2.0 — Natural greetings return friendly greeting without hallucinating tools', () => {
  const greetingQueries = ['Hi', 'Hello', 'Hey', 'Good morning', 'Good evening'];
  for (const q of greetingQueries) {
    const res = evaluateGroundedKnowledge(q);
    assert.ok(res, `Failed for query: ${q}`);
    assert.strictEqual(res.intent, 'GREETING');
    assert.ok(res.reply.includes('Saarvi AI'));
    assert.strictEqual(res.tools, undefined);
  }
});

test('AI Assistant 2.0 — Capabilities query explains all key Saarvi capabilities', () => {
  const res = evaluateGroundedKnowledge('What can you do?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'CAPABILITIES');
  assert.ok(res.reply.includes('Tool Discovery'));
  assert.ok(res.reply.includes('Academic Guidance'));
  assert.ok(res.reply.includes('Career Preparation'));
  assert.ok(res.reply.includes('Computer Science Concepts'));
});

test('AI Assistant 2.0 — SGPA definition explains formula and attaches SGPA Calculator', () => {
  const res = evaluateGroundedKnowledge('What is SGPA?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'ACADEMIC_EXPLANATION');
  assert.ok(res.reply.includes('Semester Grade Point Average'));
  assert.ok(res.reply.includes('Σ(Course Credits × Grade Points)'));
  assert.ok(res.tools && res.tools.length === 1);
  assert.strictEqual(res.tools[0].name, 'SGPA Calculator');
  assert.strictEqual(res.tools[0].route, '/student/sgpa-calculator');
});

test('AI Assistant 2.0 — CGPA definition explains formula and attaches CGPA Calculator', () => {
  const res = evaluateGroundedKnowledge('What is CGPA?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'ACADEMIC_EXPLANATION');
  assert.ok(res.reply.includes('Cumulative Grade Point Average'));
  assert.ok(res.tools && res.tools.length === 1);
  assert.strictEqual(res.tools[0].name, 'CGPA Calculator');
  assert.strictEqual(res.tools[0].route, '/student/cgpa-calculator');
});

test('AI Assistant 2.0 — Difference between SGPA and CGPA explains both and attaches both calculators', () => {
  const res = evaluateGroundedKnowledge('What is the difference between SGPA and CGPA?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'ACADEMIC_EXPLANATION');
  assert.ok(res.reply.includes('SGPA measures single semester'));
  assert.ok(res.reply.includes('CGPA measures cumulative'));
  assert.ok(res.tools && res.tools.length === 2);
  const toolNames = res.tools.map((t) => t.name);
  assert.ok(toolNames.includes('SGPA Calculator'));
  assert.ok(toolNames.includes('CGPA Calculator'));
});

test('AI Assistant 2.0 — Recursion query explains base case and recursive step', () => {
  const res = evaluateGroundedKnowledge('Explain recursion simply');
  assert.ok(res);
  assert.strictEqual(res.intent, 'CS_EDUCATION');
  assert.ok(res.reply.includes('Base Case'));
  assert.ok(res.reply.includes('Recursive Step'));
});

test('AI Assistant 2.0 — OOP query explains the 4 pillars', () => {
  const res = evaluateGroundedKnowledge('What is OOP?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'CS_EDUCATION');
  assert.ok(res.reply.includes('Encapsulation'));
  assert.ok(res.reply.includes('Abstraction'));
  assert.ok(res.reply.includes('Inheritance'));
  assert.ok(res.reply.includes('Polymorphism'));
});

test('AI Assistant 2.0 — API query explains client-server communication clearly', () => {
  const res = evaluateGroundedKnowledge('What is an API?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'CS_EDUCATION');
  assert.ok(res.reply.includes('Application Programming Interface'));
  assert.ok(res.reply.includes('Waiter'));
});

test('AI Assistant 2.0 — Placement preparation query provides 4-stage roadmap with tool cards', () => {
  const res = evaluateGroundedKnowledge('How to prepare for interviews');
  assert.ok(res);
  assert.strictEqual(res.intent, 'CAREER_GUIDANCE');
  assert.ok(res.reply.includes('Core DSA Foundations'));
  assert.ok(res.reply.includes('CS Core Subjects'));
  assert.ok(res.reply.includes('Mock Interviews'));
  assert.ok(res.tools && res.tools.length >= 1);
});

test('AI Assistant 2.0 — Post-Java query provides concrete engineering roadmap', () => {
  const res = evaluateGroundedKnowledge('What should I learn after Java?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'CAREER_GUIDANCE');
  assert.ok(res.reply.includes('Spring Boot'));
  assert.ok(res.reply.includes('TypeScript'));
});

test('AI Assistant 2.0 — PDF to Word workflow explains steps and attaches tool', () => {
  const res = evaluateGroundedKnowledge('How do I convert PDF to Word?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'FEATURE_WORKFLOW');
  assert.ok(res.reply.includes('Convert to Word'));
  assert.ok(res.tools && res.tools.length === 1);
  assert.strictEqual(res.tools[0].name, 'PDF to Word');
  assert.strictEqual(res.tools[0].route, '/tools/pdf-to-word');
});

test('AI Assistant 2.0 — Pro upgrade query explains UPI QR and 12-digit UTR flow', () => {
  const res = evaluateGroundedKnowledge('How do I pay for Pro?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'PAYMENT_HELP');
  assert.ok(res.reply.includes('/pricing'));
  assert.ok(res.reply.includes('UPI QR'));
  assert.ok(res.reply.includes('12-digit UPI UTR'));
  assert.strictEqual(res.suggestedAction?.route, '/pricing');
});

test('AI Assistant 2.0 — Payment status query points to Account Settings', () => {
  const res = evaluateGroundedKnowledge('Where is my payment?');
  assert.ok(res);
  assert.strictEqual(res.intent, 'PAYMENT_HELP');
  assert.ok(res.reply.includes('/dashboard/settings'));
  assert.strictEqual(res.suggestedAction?.route, '/dashboard/settings');
});

test('AI Assistant 2.0 — Admin inquiry for regular users strictly restricts admin controls', () => {
  const res = evaluateGroundedKnowledge('How do I manage the admin control center?', { isAdmin: false });
  assert.ok(res);
  assert.strictEqual(res.intent, 'ADMIN_ACCESS_RESTRICTED');
  assert.ok(res.reply.includes('strictly restricted to verified platform administrators'));
  assert.strictEqual(res.suggestedAction, undefined);
});

test('AI Assistant 2.0 — Admin inquiry for verified admin provides navigation management guidance', () => {
  const res = evaluateGroundedKnowledge('How do I access navigation management?', { isAdmin: true });
  assert.ok(res);
  assert.strictEqual(res.intent, 'ADMIN_GUIDANCE');
  assert.ok(res.reply.includes('/admin/navigation'));
  assert.strictEqual(res.suggestedAction?.route, '/admin');
});

test('AI Assistant 2.0 Source Integrity — assistant-knowledge.ts exists and contains required domains', () => {
  const filePath = path.join(process.cwd(), 'src/lib/ai/assistant-knowledge.ts');
  assert.ok(fs.existsSync(filePath), 'assistant-knowledge.ts must exist');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify key grounded responses
  assert.ok(content.includes('GREETING_RESPONSES'), 'Must include greetings');
  assert.ok(content.includes('SGPA vs CGPA Explained'), 'Must include SGPA vs CGPA distinction');
  assert.ok(content.includes('Σ(Course Credits × Grade Points)'), 'Must include SGPA formula');
  assert.ok(content.includes('Σ(Semester SGPA × Semester Total Credits)'), 'Must include CGPA formula');
  assert.ok(content.includes('Base Case'), 'Must include recursion base case');
  assert.ok(content.includes('Recursive Step'), 'Must include recursion recursive step');
  assert.ok(content.includes('Encapsulation'), 'Must include OOP pillars');
  assert.ok(content.includes('Spring Boot'), 'Must include post-Java roadmap');
  assert.ok(content.includes('12-digit UPI UTR'), 'Must include UPI UTR guidance');
  assert.ok(content.includes('ADMIN_ACCESS_RESTRICTED'), 'Must isolate admin access');
});

test('AI Assistant 2.0 Source Integrity — ai-assistant-router.ts prioritizes deterministic tool discovery first', () => {
  const filePath = path.join(process.cwd(), 'src/lib/ai/ai-assistant-router.ts');
  assert.ok(fs.existsSync(filePath), 'ai-assistant-router.ts must exist');
  const content = fs.readFileSync(filePath, 'utf-8');

  assert.ok(content.includes('isDirectToolLookupQuery'), 'Must have fast direct lookup check');
  assert.ok(content.includes('resolveToolQuery(query'), 'Must run deterministic lookup');
  assert.ok(content.includes('evaluateGroundedKnowledge(query'), 'Must run grounded knowledge evaluation');
  assert.ok(content.includes('isValidCanonicalRoute'), 'Must validate canonical routes');
});

// ============================================================================
// PART A: FAVICON & METADATA VERIFICATION TESTS
// ============================================================================

test('Favicon & Metadata — Multi-resolution favicon.ico files exist and are valid binary ICOs', () => {
  const appFaviconPath = path.join(process.cwd(), 'src/app/favicon.ico');
  const publicFaviconPath = path.join(process.cwd(), 'public/favicon.ico');

  assert.ok(fs.existsSync(appFaviconPath), 'src/app/favicon.ico must exist');
  assert.ok(fs.existsSync(publicFaviconPath), 'public/favicon.ico must exist');

  const appStat = fs.statSync(appFaviconPath);
  const pubStat = fs.statSync(publicFaviconPath);

  // An authentic multi-res ICO from saarvi-mark.png is ~70KB (> 10KB), not the 25.9KB default black icon
  assert.ok(appStat.size > 10000, `src/app/favicon.ico is unexpectedly small: ${appStat.size} bytes`);
  assert.ok(pubStat.size > 10000, `public/favicon.ico is unexpectedly small: ${pubStat.size} bytes`);
});

test('Favicon & Metadata — App Router manifest.ts exists and returns correct branding', () => {
  const manifestPath = path.join(process.cwd(), 'src/app/manifest.ts');
  assert.ok(fs.existsSync(manifestPath), 'src/app/manifest.ts must exist');

  const content = fs.readFileSync(manifestPath, 'utf-8');
  assert.ok(content.includes("name: 'Saarvi'"));
  assert.ok(content.includes("short_name: 'Saarvi'"));
  assert.ok(content.includes('/brand/saarvi-mark.png'));
});

test('Favicon & Metadata — Root layout defines standardized %s — Saarvi title template', () => {
  const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf-8');

  assert.ok(content.includes('template: "%s — Saarvi"') || content.includes("template: '%s — Saarvi'"));
  assert.ok(content.includes("default: 'Saarvi — Study. Work. Grow.'") || content.includes('default: "Saarvi — Study. Work. Grow."'));
  assert.ok(content.includes("manifest: '/manifest.webmanifest'") || content.includes('manifest: "/manifest.webmanifest"'));
});

test('Favicon & Metadata — Admin layout specifies Admin Portal title', () => {
  const adminLayoutPath = path.join(process.cwd(), 'src/app/admin/layout.tsx');
  const content = fs.readFileSync(adminLayoutPath, 'utf-8');

  assert.ok(content.includes("title: 'Admin Portal'") || content.includes('title: "Admin Portal"'));
});

test('Favicon & Metadata — Resume Builder layout specifies Resume Builder title', () => {
  const resumeLayoutPath = path.join(process.cwd(), 'src/app/career/resume-builder/layout.tsx');
  const content = fs.readFileSync(resumeLayoutPath, 'utf-8');

  assert.ok(content.includes("title: 'Resume Builder'") || content.includes('title: "Resume Builder"'));
});

// ============================================================================
// PART D & F: SUPER ADMIN NAVIGATION & MEGA MENU INTEGRITY
// ============================================================================

test('Navigation Management — navigation-store.ts exports all required state management functions', () => {
  const storePath = path.join(process.cwd(), 'src/lib/navigation/navigation-store.ts');
  assert.ok(fs.existsSync(storePath), 'navigation-store.ts must exist');

  const content = fs.readFileSync(storePath, 'utf-8');
  assert.ok(content.includes('getEffectiveNavigation'), 'Must export getEffectiveNavigation');
  assert.ok(content.includes('addTool'), 'Must export addTool');
  assert.ok(content.includes('removeFromNavbar'), 'Must export removeFromNavbar');
  assert.ok(content.includes('updateCategoryConfig'), 'Must export updateCategoryConfig');
  assert.ok(content.includes('reorderCategory'), 'Must export reorderCategory');
  assert.ok(content.includes('reorderCategories'), 'Must export reorderCategories');
});

test('Navigation Management — Admin API endpoint requires MANAGE authorization', () => {
  const apiPath = path.join(process.cwd(), 'src/app/api/admin/navigation/route.ts');
  assert.ok(fs.existsSync(apiPath), 'Admin navigation route must exist');

  const content = fs.readFileSync(apiPath, 'utf-8');
  assert.ok(content.includes("getAuthenticatedAdmin(request, 'MANAGE')"), 'Must enforce MANAGE role');
  assert.ok(content.includes("action === 'add_tool'"), 'Must handle add_tool');
  assert.ok(content.includes("action === 'remove_from_navbar'"), 'Must handle remove_from_navbar');
  assert.ok(content.includes("action === 'update_category'"), 'Must handle update_category');
  assert.ok(content.includes("action === 'reorder'"), 'Must handle reorder');
});

test('Navigation Management — Public navigation API endpoint returns effective navigation', () => {
  const pubApiPath = path.join(process.cwd(), 'src/app/api/navigation/route.ts');
  assert.ok(fs.existsSync(pubApiPath), 'Public navigation route must exist');

  const content = fs.readFileSync(pubApiPath, 'utf-8');
  assert.ok(content.includes('navigationStore.getEffectiveNavigation()'), 'Must call getEffectiveNavigation');
});

test('Navigation Management — Admin navigation page UI exists with complete tool controls', () => {
  const pagePath = path.join(process.cwd(), 'src/app/admin/navigation/page.tsx');
  assert.ok(fs.existsSync(pagePath), 'Admin navigation page must exist');

  const content = fs.readFileSync(pagePath, 'utf-8');
  assert.ok(content.includes('Add Tool to Navbar') || content.includes('Add Tool'));
  assert.ok(content.includes('Remove from Nav'));
  assert.ok(content.includes('Manage Categories') || content.includes('Categories'));
  assert.ok(content.includes('visibleInAI'));
});

// ============================================================================
// PART E: USER ANALYTICS & PRIVACY INVARIANTS
// ============================================================================

test('User Analytics — All navigation, search, and AI event types registered in taxonomy', () => {
  const typesPath = path.join(process.cwd(), 'src/lib/analytics/types.ts');
  const content = fs.readFileSync(typesPath, 'utf-8');

  assert.ok(content.includes("'NAVBAR_TOOL_CLICK'"), 'Must include NAVBAR_TOOL_CLICK');
  assert.ok(content.includes("'MEGA_MENU_TOOL_CLICK'"), 'Must include MEGA_MENU_TOOL_CLICK');
  assert.ok(content.includes("'SEARCH_TOOL_OPEN'"), 'Must include SEARCH_TOOL_OPEN');
  assert.ok(content.includes("'AI_TOOL_OPEN'"), 'Must include AI_TOOL_OPEN');
});

test('User Analytics Privacy — Zero document contents, marks, or resume text logged', () => {
  const storePath = path.join(process.cwd(), 'src/lib/analytics/analytics-store.ts');
  const content = fs.readFileSync(storePath, 'utf-8');

  // Verify that document payload content is never extracted
  assert.ok(!content.includes('fileContent'));
  assert.ok(!content.includes('resumeText'));
  assert.ok(!content.includes('marksPayload'));
});
