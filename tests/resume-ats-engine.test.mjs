import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractContactInfo,
  extractSkillsFromText,
  extractSectionsFromText,
  extractTextFromTxt,
} from '../src/lib/resume/parser/document-parser.ts';
import { evaluateResumeAts } from '../src/lib/resume/ats-engine.ts';
import { matchResumeAgainstJobDescription } from '../src/lib/resume/job-matcher.ts';

test('Resume Intelligence: Contact info extractor accurately detects name, email, phone, and links', () => {
  const sampleResumeText = `
    AARAV SHARMA
    Bengaluru, India • +91 9876543210 • aarav.sharma@example.com
    https://linkedin.com/in/aarav-sharma • https://github.com/aaravsharma

    PROFESSIONAL SUMMARY
    Full Stack Developer with 2 years of experience building web applications using React and Node.js.
  `;

  const contact = extractContactInfo(sampleResumeText);

  assert.equal(contact.fullName, 'AARAV SHARMA');
  assert.equal(contact.email, 'aarav.sharma@example.com');
  assert.equal(contact.phone, '+91 9876543210');
  assert.ok(contact.location?.includes('Bengaluru'));
  assert.equal(contact.linkedin, 'https://linkedin.com/in/aarav-sharma');
  assert.equal(contact.github, 'https://github.com/aaravsharma');
});

test('Resume Intelligence: Skill extractor matches exact keywords with word boundaries without false positives', () => {
  const sampleText = `
    Technical Skills:
    Languages: Java, Python, TypeScript, SQL, Go
    Frontend: React, Next.js, HTML5, CSS3, TailwindCSS
    Backend: Node.js, Express, PostgreSQL, Redis
    DevOps: Docker, Git, Linux
  `;

  const skills = extractSkillsFromText(sampleText);
  const skillNames = skills.map((s) => s.name.toLowerCase());

  // Expected skills
  assert.ok(skillNames.includes('java'));
  assert.ok(skillNames.includes('python'));
  assert.ok(skillNames.includes('typescript'));
  assert.ok(skillNames.includes('react'));
  assert.ok(skillNames.includes('docker'));
  assert.ok(skillNames.includes('postgresql') || skillNames.includes('postgres'));

  // Ensure "Java" doesn't falsely inject "JavaScript" when not present
  assert.equal(skillNames.includes('javascript'), false);
});

test('Deterministic ATS Engine: Evaluates complete candidate profile into explainable scores', () => {
  const testProfile = {
    id: 'cand_1',
    fullName: 'Priya Patel',
    professionalTitle: 'Software Engineer',
    email: 'priya.patel@example.com',
    phone: '+91 9845123456',
    location: 'Bengaluru, India',
    linkedin: 'https://linkedin.com/in/priyapatel',
    github: 'https://github.com/priyapatel',
    summary: 'Dedicated Software Engineer with strong foundations in Data Structures, Algorithms, and Cloud Systems.',
    skills: [
      { id: '1', name: 'Java', category: 'Programming Languages' },
      { id: '2', name: 'Python', category: 'Programming Languages' },
      { id: '3', name: 'React', category: 'Frontend' },
      { id: '4', name: 'TypeScript', category: 'Frontend' },
      { id: '5', name: 'Node.js', category: 'Backend' },
      { id: '6', name: 'PostgreSQL', category: 'Database' },
      { id: '7', name: 'Docker', category: 'DevOps' },
      { id: '8', name: 'Git', category: 'Tools' },
    ],
    education: [
      {
        id: 'edu_1',
        institution: 'Visvesvaraya Technological University',
        degree: 'Bachelor of Engineering in Computer Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2022',
        endDate: '2026',
        gpa: '8.8 CGPA',
      },
    ],
    experience: [
      {
        id: 'exp_1',
        company: 'InnovateTech Solutions',
        role: 'Software Engineering Intern',
        startDate: '2025-06',
        endDate: '2025-08',
        bullets: [
          'Architected REST APIs handling 50,000+ daily requests using Node.js and PostgreSQL.',
          'Optimized database queries, reducing average API response latency by 35%.',
        ],
      },
    ],
    projects: [
      {
        id: 'proj_1',
        title: 'Distributed Task Queue',
        technologies: ['Go', 'Redis', 'Docker'],
        highlights: [
          'Engineered a high-throughput worker pool processing 10,000 tasks/second.',
        ],
      },
    ],
    certifications: [],
    achievements: [],
    hackathons: [],
    updatedAt: new Date().toISOString(),
  };

  const report = evaluateResumeAts(testProfile);

  assert.ok(report.overallScore >= 80, `Expected score >= 80, got ${report.overallScore}`);
  assert.equal(report.scoreTier, 'Strong' || 'Exceptional');
  assert.equal(report.summaryMetrics.hasMetricsInBullets, true);
  assert.equal(report.summaryMetrics.hasActionVerbsInBullets, true);
  assert.equal(report.summaryMetrics.hasValidLinks, true);

  // Check categories exist
  const catNames = report.categories.map((c) => c.name);
  assert.ok(catNames.includes('Skills & Keywords Coverage'));
  assert.ok(catNames.includes('Experience & Projects'));
  assert.ok(catNames.includes('Education'));
  assert.ok(catNames.includes('Contact Information & Links'));
});

test('Job-Specific ATS Matcher: Computes Set intersection between candidate skills and job requirements', () => {
  const profile = {
    id: 'cand_2',
    fullName: 'Rahul Verma',
    professionalTitle: 'Frontend Engineer',
    email: 'rahul@example.com',
    phone: '9988776655',
    location: 'Remote',
    skills: [
      { id: '1', name: 'React', category: 'Frontend' },
      { id: '2', name: 'TypeScript', category: 'Frontend' },
      { id: '3', name: 'HTML', category: 'Frontend' },
      { id: '4', name: 'CSS', category: 'Frontend' },
      { id: '5', name: 'Git', category: 'Tools' },
    ],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    achievements: [],
    hackathons: [],
    updatedAt: new Date().toISOString(),
  };

  const jobDescription = `
    We are seeking a Frontend Developer proficient in React, TypeScript, TailwindCSS, and Next.js.
    Knowledge of REST APIs and Git is expected.
  `;

  const match = matchResumeAgainstJobDescription(profile, jobDescription);

  // Matched: React, TypeScript, Git
  assert.ok(match.matchedSkills.includes('React'));
  assert.ok(match.matchedSkills.includes('Typescript') || match.matchedSkills.includes('TypeScript'));

  // Missing: Tailwindcss / Tailwind, Next.js, Rest api
  assert.ok(match.missingSkills.some((s) => s.toLowerCase().includes('tailwind') || s.toLowerCase().includes('next')));

  assert.ok(match.matchPercentage > 0 && match.matchPercentage < 100);
  assert.ok(match.suggestions.length > 0);
});
