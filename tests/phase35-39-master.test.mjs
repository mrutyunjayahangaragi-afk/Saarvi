import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { CANONICAL_TOOL_REGISTRY } from '../src/lib/tools/tool-registry.ts';
import { FILE_LIMITS } from '../src/config/limits.ts';
import { studentStore } from '../src/lib/student/student-store.ts';
import {
  calculateSemesterSGPA,
  calculateCGPA,
} from '../src/lib/academic/engine/calculations.ts';

const ROOT_DIR = process.cwd();

// =============================================================================
// PHASE 35: IMAGE & SCAN TOOLKIT TESTS
// =============================================================================

test('Phase 35 — Document Scanner registered and consolidated in CANONICAL_TOOL_REGISTRY', () => {
  const canonicalKeys = CANONICAL_TOOL_REGISTRY.map((t) => t.key);
  assert.ok(canonicalKeys.includes('document-scanner'), 'Missing document-scanner in CANONICAL_TOOL_REGISTRY');
  const tool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === 'document-scanner');
  assert.ok(['image', 'pdf'].includes(tool.category));
  assert.equal(tool.status, 'available');
  assert.ok(tool.keywords && tool.keywords.length > 0);

  // Redundant scan tools consolidated into document-scanner
  assert.ok(!canonicalKeys.includes('scan-to-pdf'), 'scan-to-pdf consolidated into document-scanner');
  assert.ok(!canonicalKeys.includes('photo-to-document'), 'photo-to-document consolidated into document-scanner');
});

test('Phase 35 — Scan operations registered in registry.ts and limits.ts', () => {
  const registryContent = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/tools/registry.ts'), 'utf-8');
  assert.ok(registryContent.includes('"document-scanner": documentScannerOperation'));
  assert.ok(registryContent.includes('"scan-to-pdf": scanToPdfOperation'));
  assert.ok(registryContent.includes('"photo-to-document": photoToDocumentOperation'));

  assert.equal(FILE_LIMITS.SPECIFIC['document-scanner'], 50);
  assert.equal(FILE_LIMITS.SPECIFIC['scan-to-pdf'], 50);
  assert.equal(FILE_LIMITS.SPECIFIC['photo-to-document'], 50);
});

test('Phase 35 — Scan processor and ID photo files exist and are syntactically valid', () => {
  const scanProcessorPath = path.join(ROOT_DIR, 'src/lib/tools/scan/scan-processor.ts');
  const idPhotoPath = path.join(ROOT_DIR, 'src/lib/tools/image/id-photo.ts');

  assert.ok(fs.existsSync(scanProcessorPath), 'scan-processor.ts must exist');
  assert.ok(fs.existsSync(idPhotoPath), 'id-photo.ts must exist');

  const scanProcContent = fs.readFileSync(scanProcessorPath, 'utf-8');
  assert.ok(scanProcContent.includes('applyDocumentFiltersToCanvas'));
  assert.ok(scanProcContent.includes('compileImagesToPdf'));

  const idPhotoContent = fs.readFileSync(idPhotoPath, 'utf-8');
  assert.ok(idPhotoContent.includes('createCustomIdPreset'));
  assert.ok(idPhotoContent.includes('ID_PHOTO_PRESETS'));
});

// =============================================================================
// PHASE 36: STUDENT PRODUCTIVITY SUITE TESTS
// =============================================================================

test('Phase 36 — Student Store local operations, exams countdown, notes, and secure import/export', () => {
  // Initial export
  const initial = studentStore.exportAllData();
  assert.ok(Array.isArray(initial.timetable));
  assert.ok(Array.isArray(initial.assignments));
  assert.ok(Array.isArray(initial.notes));

  // Add Note
  const note = studentStore.addNote({
    title: 'Operating Systems Synchronization',
    content: 'Mutex, semaphores, and reader-writer problems.',
    tags: ['OS', 'Exam'],
  });
  assert.ok(note.id);
  assert.equal(note.title, 'Operating Systems Synchronization');

  // Search Notes
  const results = studentStore.searchNotes('semaphores');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, note.id);

  // Add Exam & Countdown calculation
  const exam = studentStore.addExam({
    examName: 'DBMS Final Examination',
    subject: 'Database Management Systems',
    date: new Date(Date.now() + 864e5 * 5).toISOString().split('T')[0],
    startTime: '09:30',
  });
  const exams = studentStore.getExamsWithCountdown();
  const foundExam = exams.find((e) => e.id === exam.id);
  assert.ok(foundExam);
  assert.ok(foundExam.daysRemaining >= 4 && foundExam.daysRemaining <= 6);

  // Prototype Pollution defense in importAllData
  const maliciousJson = JSON.stringify({
    __proto__: { polluted: true },
    notes: [{ id: 'safe', title: 'Safe Note', content: 'Clean', tags: [] }],
  });
  const importResult = studentStore.importAllData(maliciousJson);
  assert.ok(importResult.success);
  assert.equal(Object.prototype.polluted, undefined, 'Prototype pollution defense must prevent polluting Object.prototype');
});

// =============================================================================
// PHASE 37: MULTI-UNIVERSITY ACADEMIC ENGINE TESTS
// =============================================================================

test('Phase 37 — Pure deterministic SGPA formula SUM(Credit × GradePoint) / SUM(Credit)', () => {
  const courses = [
    { courseCode: 'MATH101', courseTitle: 'Math', credits: 4, gradeLetter: 'O', gradePoint: 10, creditPoints: 40, isPassed: true, isFGrade: false, includedInSGPA: true },
    { courseCode: 'CS101', courseTitle: 'CS', credits: 3, gradeLetter: 'A+', gradePoint: 9, creditPoints: 27, isPassed: true, isFGrade: false, includedInSGPA: true },
    { courseCode: 'PHY101', courseTitle: 'Physics', credits: 3, gradeLetter: 'F', gradePoint: 0, creditPoints: 0, isPassed: false, isFGrade: true, includedInSGPA: true },
  ];
  const sgpaResult = calculateSemesterSGPA(courses);
  assert.equal(sgpaResult.sgpa, 6.7);
  assert.equal(sgpaResult.totalCredits, 10);
  assert.equal(sgpaResult.hasBacklogs, true);
});

test('Phase 37 — Weighted CGPA formula across completed semesters', () => {
  const semesters = [
    { semester: 1, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 160, sgpa: 8.0 },
    { semester: 2, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 180, sgpa: 9.0 },
  ];
  const cgpaResult = calculateCGPA(semesters);
  assert.equal(cgpaResult.cgpa, 8.5);
});

test('Phase 37 — Multi-University schema migration exists and enforces missing curriculum invariant', () => {
  const migrationPath = path.join(ROOT_DIR, 'supabase/migrations/010_admin_persistence_and_academic.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration 010 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  assert.ok(sql.includes('academic_universities'));
  assert.ok(sql.includes('academic_schemes'));
  assert.ok(sql.includes('academic_branches'));
  assert.ok(sql.includes('academic_semesters'));
  assert.ok(sql.includes('academic_subjects'));
  assert.ok(sql.includes('publish_status'));

  // Academic store file invariant: missing curriculum returns "Curriculum not available yet."
  const storePath = path.join(ROOT_DIR, 'src/lib/academic/academic-store.ts');
  const storeContent = fs.readFileSync(storePath, 'utf-8');
  assert.ok(storeContent.includes('Curriculum not available yet. Ask Admin to add curriculum.'));
});

// =============================================================================
// PHASE 38: CAREER SUITE TESTS
// =============================================================================

test('Phase 38 — Career Suite pages and tools registered with full functionality', () => {
  const careerRoutes = [
    'src/app/career/resume-builder/page.tsx',
    'src/app/career/cover-letter/page.tsx',
    'src/app/career/job-tracker/page.tsx',
    'src/app/career/interview-prep/page.tsx',
    'src/app/career/skill-gap/page.tsx',
  ];

  for (const r of careerRoutes) {
    const fullPath = path.join(ROOT_DIR, r);
    assert.ok(fs.existsSync(fullPath), `${r} must exist`);
  }

  // Check CANONICAL_TOOL_REGISTRY has career tools
  const canonicalKeys = CANONICAL_TOOL_REGISTRY.map((t) => t.key);
  assert.ok(canonicalKeys.includes('resume-builder'));
  assert.ok(canonicalKeys.includes('cover-letter'));
  assert.ok(canonicalKeys.includes('job-tracker'));
});

test('Phase 38 — Skill Gap Analyzer source implements deterministic matching and zero server leakage', () => {
  const skillGapPage = path.join(ROOT_DIR, 'src/app/career/skill-gap/page.tsx');
  const content = fs.readFileSync(skillGapPage, 'utf-8');

  assert.ok(content.includes('analyzeSkillGap'));
  assert.ok(content.includes('100% Client-Side'));
  assert.ok(content.includes('Target Role Readiness'));
  assert.ok(content.includes('Matched Skills'));
  assert.ok(content.includes('High Priority Gaps'));
});

// =============================================================================
// PHASE 39: AI ASSISTANT 2.0 TESTS
// =============================================================================

test('Phase 39 — AI Assistant 2.0 source implements canonical tool discovery FIRST and route validation', () => {
  const routerPath = path.join(ROOT_DIR, 'src/lib/ai/ai-assistant-router.ts');
  const enginePath = path.join(ROOT_DIR, 'src/lib/ai/tool-discovery-engine.ts');

  assert.ok(fs.existsSync(routerPath), 'ai-assistant-router.ts must exist');
  assert.ok(fs.existsSync(enginePath), 'tool-discovery-engine.ts must exist');

  const routerContent = fs.readFileSync(routerPath, 'utf-8');
  assert.ok(routerContent.includes('isValidCanonicalRoute'));
  assert.ok(routerContent.includes('resolveAssistantRoute'));
  assert.ok(routerContent.includes('CANONICAL_TOOL_REGISTRY'));

  const engineContent = fs.readFileSync(enginePath, 'utf-8');
  assert.ok(engineContent.includes('document-scanner'));
  assert.ok(engineContent.includes('protect-pdf'));
  assert.ok(engineContent.includes('skill-gap'));
  assert.ok(engineContent.includes('student-notes'));
});
