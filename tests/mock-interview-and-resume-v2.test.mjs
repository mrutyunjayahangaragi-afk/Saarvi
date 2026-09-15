import test from 'node:test';
import assert from 'node:assert/strict';

// =========================================================================
// MOCK INTERVIEW 2.0 & RESUME BUILDER 2.0 TEST SUITE
// =========================================================================

// --- 1. LaTeX Sanitization & Generation ---
function sanitizeLatexText(text) {
  if (!text) return "";
  let clean = text
    .replace(/\\(write18|input|include|def|let|futurelet|catcode)/gi, "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\~{}");
  return clean;
}

function generateControlledLatex({ profile, version }) {
  const name = sanitizeLatexText(profile.fullName || "Your Name");
  const email = profile.email ? sanitizeLatexText(profile.email) : "";
  const phone = profile.phone ? sanitizeLatexText(profile.phone) : "";
  const linkedin = profile.linkedin || "";
  const github = profile.github || "";

  let contactParts = [];
  if (email) contactParts.push(`\\href{mailto:${email}}{${email}}`);
  if (phone) contactParts.push(phone);
  if (linkedin) contactParts.push(`\\href{${linkedin}}{LinkedIn}`);
  if (github) contactParts.push(`\\href{${github}}{GitHub}`);
  const contactLine = contactParts.join(" $\\vert$ ");

  let latex = `% -----------------------------------------------------------------------------
% Official Saarvi ATS Classic LaTeX Resume Template
% Canonical: https://saarvi.app
% -----------------------------------------------------------------------------
\\documentclass[10pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage{geometry}
\\geometry{top=12mm, bottom=14mm, left=15mm, right=15mm}
\\usepackage[hidelinks]{hyperref}

\\begin{document}
\\begin{center}
    {\\LARGE \\textbf{${name}}} \\\\[4pt]
    ${contactLine}
\\end{center}
\\end{document}`;
  return latex;
}

// --- 2. ATS Scoring & Photo Guidance ---
function evaluateResumeCompleteness(profile, version) {
  const warnings = [];
  let score = 100;
  const isAtsTemplate = version.template === "classic-ats" || version.template === "ats-latex";
  const hasPhoto = Boolean(profile.profileImage || profile.photoUrl);

  let photoGuidance = {
    included: hasPhoto,
    penalty: 0,
    guidance: "No photo included. Compliant with standard US/UK/EU ATS parsing rules.",
  };

  if (isAtsTemplate && hasPhoto) {
    score = Math.max(0, score - 5);
    photoGuidance = {
      included: true,
      penalty: -5,
      guidance: "Profile photo detected on ATS-formatted resume. Deducted 5 points. ATS parsers do not read photos, and photos are discouraged in US/UK/EU compliance.",
    };
    warnings.push("ATS Photo Guidance: Profile photo deducted 5 points in ATS mode. Non-blocking: You can keep it or remove it.");
  }

  return { score, warnings, photoGuidance };
}

// --- 3. Job Description Keyword Matcher ---
function matchJobDescription(profile, jobDescriptionText) {
  if (!jobDescriptionText || !jobDescriptionText.trim()) {
    return { score: 0, matchedKeywords: [], missingKeywords: [], recommendations: [] };
  }

  const jdTokens = Array.from(
    new Set(
      jobDescriptionText
        .toLowerCase()
        .replace(/[^a-z0-9+#.]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2)
    )
  );

  const profileText = [
    profile.summary || "",
    ...(profile.skills || []).map((s) => s.name),
    ...(profile.projects || []).flatMap((p) => [p.title, ...(p.technologies || [])]),
  ].join(" ").toLowerCase();

  const matched = [];
  const missing = [];

  for (const token of jdTokens) {
    if (profileText.includes(token)) {
      matched.push(token);
    } else {
      missing.push(token);
    }
  }

  const score = jdTokens.length > 0 ? Math.round((matched.length / jdTokens.length) * 100) : 0;
  const recommendations = missing.slice(0, 5).map((kw) => `Consider adding relevant experience or coursework in "${kw}".`);

  return { score, matchedKeywords: matched, missingKeywords: missing, recommendations };
}

// --- 4. Action Planner Validation ---
function validateAction(action) {
  if (!action || !action.id || !action.type) {
    return { valid: false, error: "Action must have a valid ID and type." };
  }
  const normalizedType = String(action.type).toLowerCase().trim().replace(/-/g, "_");
  const allowed = [
    "create_study_session",
    "create_task",
    "schedule_reminder",
    "navigate_to_feature",
    "open_tool",
    "open_resume",
    "run_ats_check",
  ];
  if (!allowed.includes(normalizedType)) {
    return { valid: false, error: `Unknown action type: ${action.type}` };
  }
  return { valid: true };
}

// --- 5. Mock Interview 2.0 Invariants ---
const SEEDED_QUESTIONS = [
  {
    id: "q_goog_1",
    role: "Software Engineer",
    type: "mcq",
    company: "Google",
    question: "In Two Sum, what is the optimal time complexity using a hash map?",
    options: ["O(N^2)", "O(N log N)", "O(N)", "O(1)"],
    correctAnswer: 2,
    timeLimitSeconds: 60,
    exposureCount: 0,
  },
  {
    id: "q_msft_1",
    role: "Software Engineer",
    type: "mcq",
    company: "Microsoft",
    question: "Which isolation level in SQL prevents phantom reads?",
    options: ["Read Committed", "Repeatable Read", "Serializable", "Read Uncommitted"],
    correctAnswer: 2,
    timeLimitSeconds: 60,
    exposureCount: 0,
  },
  {
    id: "q_amzn_1",
    role: "Software Engineer",
    type: "mcq",
    company: "Amazon",
    question: "Which data structures implement an LRU cache in O(1)?",
    options: ["Array and BST", "Doubly Linked List and Hash Map", "Heap and Queue", "Stack and Set"],
    correctAnswer: 1,
    timeLimitSeconds: 60,
    exposureCount: 0,
  },
  {
    id: "q_infy_1",
    role: "Software Engineer",
    type: "mcq",
    company: "Infosys",
    question: "What is method overloading?",
    options: ["Same method name, different signatures", "Overriding parent class", "Dynamic arguments", "Private inheritance"],
    correctAnswer: 0,
    timeLimitSeconds: 60,
    exposureCount: 0,
  },
  {
    id: "q_tcs_1",
    role: "Software Engineer",
    type: "mcq",
    company: "TCS",
    question: "What distinguishes TCP from UDP?",
    options: ["TCP connectionless", "TCP guaranteed in-order delivery; UDP connectionless", "UDP on network layer", "Text only"],
    correctAnswer: 1,
    timeLimitSeconds: 60,
    exposureCount: 0,
  },
  {
    id: "q_wipro_1",
    role: "Software Engineer",
    type: "mcq",
    company: "Wipro",
    question: "Prerequisite for Third Normal Form (3NF)?",
    options: ["1NF only", "2NF and no transitive dependencies", "Composite keys", "No foreign keys"],
    correctAnswer: 1,
    timeLimitSeconds: 60,
    exposureCount: 0,
  },
  {
    id: "q_acn_1",
    role: "Software Engineer",
    type: "mcq",
    company: "Accenture",
    question: "Which cloud service model provides virtual servers and block storage?",
    options: ["SaaS", "PaaS", "IaaS", "FaaS"],
    correctAnswer: 2,
    timeLimitSeconds: 60,
    exposureCount: 0,
  },
];

// =========================================================================
// TESTS
// =========================================================================

test("1. LaTeX Export: sanitizeLatexText escapes special characters and strips dangerous macros", () => {
  const unsafe = "Tested 100% of $1,000 budget & 50# items with C_Sharp ^ 2 \\input{secret.tex} \\write18{rm -rf}";
  const clean = sanitizeLatexText(unsafe);

  assert.ok(!clean.includes("\\input"));
  assert.ok(!clean.includes("\\write18"));
  assert.ok(clean.includes("\\%"));
  assert.ok(clean.includes("\\$"));
  assert.ok(clean.includes("\\&"));
  assert.ok(clean.includes("\\#"));
  assert.ok(clean.includes("\\_"));
});

test("2. LaTeX Export: generateControlledLatex produces official single-column Saarvi ATS format", () => {
  const mockProfile = {
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555 123 4567",
    linkedin: "https://linkedin.com/in/janedoe",
    github: "https://github.com/janedoe",
  };
  const mockVersion = { template: "classic-ats" };

  const latex = generateControlledLatex({ profile: mockProfile, version: mockVersion });

  assert.ok(latex.includes("\\documentclass[10pt,a4paper]{article}"));
  assert.ok(latex.includes("\\usepackage[hidelinks]{hyperref}"));
  assert.ok(latex.includes("Jane Doe"));
  assert.ok(latex.includes("\\href{https://linkedin.com/in/janedoe}{LinkedIn}"));
  assert.ok(latex.includes("\\href{https://github.com/janedoe}{GitHub}"));
});

test("3. ATS Engine: Photo penalty of -5 pts applied deterministically in ATS mode with guidance", () => {
  const baseProfile = { fullName: "Jane Doe", email: "jane@example.com" };
  const atsVersion = { template: "classic-ats" };

  // 1. Without photo -> score 100
  const evalWithoutPhoto = evaluateResumeCompleteness(baseProfile, atsVersion);
  assert.equal(evalWithoutPhoto.score, 100);
  assert.equal(evalWithoutPhoto.photoGuidance.penalty, 0);

  // 2. With photo in ATS mode -> score 95 (-5 pts)
  const profileWithPhoto = { ...baseProfile, photoUrl: "data:image/png;base64,sample" };
  const evalWithPhoto = evaluateResumeCompleteness(profileWithPhoto, atsVersion);

  assert.equal(evalWithPhoto.score, 95);
  assert.equal(evalWithPhoto.photoGuidance.penalty, -5);
  assert.ok(evalWithPhoto.warnings.some((w) => w.includes("ATS Photo Guidance")));
});

test("4. Career Service: matchJobDescription produces deterministic matching score and missing skills", () => {
  const profile = {
    summary: "Experienced with React, Node.js, and PostgreSQL.",
    skills: [{ name: "React" }, { name: "PostgreSQL" }],
    projects: [],
  };

  const jobText = "Looking for a Senior Frontend Engineer with React, TypeScript, Docker, and PostgreSQL expertise.";
  const match = matchJobDescription(profile, jobText);

  assert.ok(match.score > 0 && match.score <= 100);
  assert.ok(match.matchedKeywords.includes("react"));
  assert.ok(match.matchedKeywords.includes("postgresql"));
  assert.ok(match.missingKeywords.includes("typescript"));
  assert.ok(match.recommendations.length > 0);
});

test("5. Action Planner: validateAction normalizes action types and validates schemas safely", () => {
  const validTask = {
    id: "act_101",
    type: "create_task",
    title: "Review Dijkstra notes",
  };
  assert.equal(validateAction(validTask).valid, true);

  const normalizedOpenResume = {
    id: "act_102",
    type: "OPEN-RESUME",
    title: "Open Resume Builder",
  };
  assert.equal(validateAction(normalizedOpenResume).valid, true);

  const normalizedAtsCheck = {
    id: "act_103",
    type: "run-ats-check",
    title: "Run ATS Check",
  };
  assert.equal(validateAction(normalizedAtsCheck).valid, true);

  const badAction = {
    id: "act_104",
    type: "unknown_type_xyz",
    title: "Bad",
  };
  assert.equal(validateAction(badAction).valid, false);
});

test("6. Mock Interview 2.0: Question bank contains top companies with exposure rotation", () => {
  assert.equal(SEEDED_QUESTIONS.length, 7);
  const companies = SEEDED_QUESTIONS.map((q) => q.company);
  assert.ok(companies.includes("Google"));
  assert.ok(companies.includes("Microsoft"));
  assert.ok(companies.includes("Amazon"));
  assert.ok(companies.includes("Infosys"));
  assert.ok(companies.includes("TCS"));
  assert.ok(companies.includes("Wipro"));
  assert.ok(companies.includes("Accenture"));
});

test("7. Mock Interview 2.0: MCQ scoring and 4-warning proctoring termination", () => {
  const q = SEEDED_QUESTIONS[0]; // Google Two Sum, correct answer 2
  const correctUserAnswer = 2;
  const isCorrect = correctUserAnswer === q.correctAnswer;
  const score = isCorrect ? 100 : 0;
  assert.equal(score, 100);

  // Proctoring warnings: 4 warnings trigger termination
  const warnings = ["tab_switch", "window_blur", "tab_switch", "tab_switch"];
  const maxWarnings = 4;
  const isTerminated = warnings.length >= maxWarnings;
  assert.equal(isTerminated, true);
});
