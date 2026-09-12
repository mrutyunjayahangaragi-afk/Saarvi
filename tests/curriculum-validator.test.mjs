import test from 'node:test';
import assert from 'node:assert/strict';

function validateCurriculumCourses(courses, meta) {
  const errors = [];
  const warnings = [];
  const seenCodes = new Set();

  if (!courses || courses.length === 0) {
    errors.push({
      type: 'ERROR',
      code: 'EMPTY_CURRICULUM',
      message: 'Curriculum version must contain at least one course definition.',
    });
  }

  if (meta && !meta.sourceUrl) {
    warnings.push({
      type: 'WARNING',
      code: 'MISSING_SOURCE_CITATION',
      message: 'No official syllabus source URL is provided for verification.',
    });
  }

  for (const course of (courses || [])) {
    const codeKey = (course.courseCode || '').trim().toUpperCase();

    // 1. Duplicate code
    if (seenCodes.has(codeKey)) {
      errors.push({
        type: 'ERROR',
        code: 'DUPLICATE_COURSE_CODE',
        courseCode: codeKey,
        message: `Duplicate course code detected: ${codeKey}.`,
      });
    }
    seenCodes.add(codeKey);

    // 2. Credits
    if (course.credits === undefined || course.credits === null || course.credits < 0 || course.credits > 10) {
      errors.push({
        type: 'ERROR',
        code: 'INVALID_CREDITS',
        courseCode: codeKey,
        message: `Course ${codeKey} has invalid credits: ${course.credits}. Must be between 0 and 10.`,
      });
    }

    // 3. Semester
    if (!course.semester || course.semester < 1 || course.semester > 8) {
      errors.push({
        type: 'ERROR',
        code: 'INVALID_SEMESTER',
        courseCode: codeKey,
        message: `Course ${codeKey} has invalid semester ${course.semester}. Must be 1 to 8.`,
      });
    }

    // 4. Missing title
    if (!course.courseTitle || course.courseTitle.trim().length === 0) {
      errors.push({
        type: 'ERROR',
        code: 'MISSING_COURSE_TITLE',
        courseCode: codeKey,
        message: `Course ${codeKey} is missing a course title.`,
      });
    }

    // 5. Assessment
    if (!course.assessment) {
      errors.push({
        type: 'ERROR',
        code: 'MISSING_ASSESSMENT_CONFIG',
        courseCode: codeKey,
        message: `Course ${codeKey} has no assessment configuration specified.`,
      });
    } else if (course.assessment.hasSEE) {
      if (!course.assessment.cie?.maxMarks || !course.assessment.see?.maxMarks || course.assessment.cie.maxMarks <= 0 || course.assessment.see.maxMarks <= 0) {
        errors.push({
          type: 'ERROR',
          code: 'INVALID_CIE_SEE_DISTRIBUTION',
          courseCode: codeKey,
          message: `Course ${codeKey} uses CIE+SEE mode but lacks valid max CIE (${course.assessment.cie?.maxMarks}) or max SEE (${course.assessment.see?.maxMarks}).`,
        });
      }
    } else {
      if (!course.assessment.cie?.maxMarks || course.assessment.cie.maxMarks <= 0) {
        errors.push({
          type: 'ERROR',
          code: 'INVALID_CONTINUOUS_MAX',
          courseCode: codeKey,
          message: `Course ${codeKey} has no SEE but lacks valid continuous CIE max marks.`,
        });
      }
    }

    // 6. Scheme check
    if (meta?.scheme && course.scheme !== meta.scheme) {
      warnings.push({
        type: 'WARNING',
        code: 'SCHEME_MISMATCH',
        courseCode: codeKey,
        message: `Course scheme (${course.scheme}) does not match package scheme (${meta.scheme}).`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

test('Section 31: Curriculum Validator — Valid Course Package Passes', () => {
  const validCourses = [
    {
      courseCode: 'BCS301',
      courseTitle: 'Mathematics for Computer Science',
      credits: 4,
      semester: 3,
      scheme: '2022',
      assessment: {
        hasSEE: true,
        cie: { maxMarks: 50 },
        see: { maxMarks: 50 },
        total: { maxMarks: 100 },
      },
    },
    {
      courseCode: 'BSCK307',
      courseTitle: 'Social Connect & Responsibility',
      credits: 1,
      semester: 3,
      scheme: '2022',
      assessment: {
        hasSEE: false,
        cie: { maxMarks: 100 },
        total: { maxMarks: 100 },
      },
    },
  ];

  const result = validateCurriculumCourses(validCourses, {
    scheme: '2022',
    sourceUrl: 'https://vtu.ac.in/syllabus',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
});

test('Section 31: Curriculum Validator — Catches Duplicate Course Codes', () => {
  const duplicateCourses = [
    {
      courseCode: 'BCS301',
      courseTitle: 'Mathematics for Computer Science',
      credits: 4,
      semester: 3,
      assessment: { hasSEE: true, cie: { maxMarks: 50 }, see: { maxMarks: 50 } },
    },
    {
      courseCode: 'bcs301', // case-insensitive duplicate
      courseTitle: 'Duplicate Entry',
      credits: 4,
      semester: 3,
      assessment: { hasSEE: true, cie: { maxMarks: 50 }, see: { maxMarks: 50 } },
    },
  ];

  const result = validateCurriculumCourses(duplicateCourses, { sourceUrl: 'https://vtu.ac.in' });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === 'DUPLICATE_COURSE_CODE'));
});

test('Section 31: Curriculum Validator — Catches Invalid Credits & Out of Range Semester', () => {
  const invalidCourses = [
    {
      courseCode: 'BAD1',
      courseTitle: 'Invalid Credit Course',
      credits: -2, // invalid
      semester: 0, // invalid (must be 1-8)
      assessment: { hasSEE: true, cie: { maxMarks: 50 }, see: { maxMarks: 50 } },
    },
    {
      courseCode: 'BAD2',
      courseTitle: 'Over-semester Course',
      credits: 15, // invalid > 10
      semester: 9, // invalid > 8
      assessment: { hasSEE: true, cie: { maxMarks: 50 }, see: { maxMarks: 50 } },
    },
  ];

  const result = validateCurriculumCourses(invalidCourses, { sourceUrl: 'https://vtu.ac.in' });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === 'INVALID_CREDITS'));
  assert.ok(result.errors.some((e) => e.code === 'INVALID_SEMESTER'));
});

test('Section 31: Curriculum Validator — Catches Missing Assessment Distribution', () => {
  const invalidAssessment = [
    {
      courseCode: 'BCS302',
      courseTitle: 'Digital Design',
      credits: 4,
      semester: 3,
      assessment: {
        hasSEE: true,
        cie: { maxMarks: 0 }, // invalid 0
        see: { maxMarks: 50 },
      },
    },
  ];

  const result = validateCurriculumCourses(invalidAssessment, { sourceUrl: 'https://vtu.ac.in' });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === 'INVALID_CIE_SEE_DISTRIBUTION'));
});

test('Section 31: Curriculum Validator — Empty Package and Source Citation Warning', () => {
  const emptyResult = validateCurriculumCourses([], { sourceUrl: '' });
  assert.equal(emptyResult.isValid, false);
  assert.ok(emptyResult.errors.some((e) => e.code === 'EMPTY_CURRICULUM'));
  assert.ok(emptyResult.warnings.some((w) => w.code === 'MISSING_SOURCE_CITATION'));
});
