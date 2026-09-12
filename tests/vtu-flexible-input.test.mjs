import test from 'node:test';
import assert from 'node:assert/strict';

// ==========================================
// 1. NORMALIZATION & VALIDATION IMPLEMENTATION
// ==========================================
function validateMarksInput(assessment, mode, marks) {
  if (mode === 'total') {
    if (marks.total === '' || marks.total === undefined) {
      return { isValid: true, isComplete: false };
    }
    const max = assessment.total?.maxMarks ?? 100;
    if (marks.total < 0) {
      return { isValid: false, isComplete: false, errorMessage: 'Total marks cannot be negative.' };
    }
    if (marks.total > max) {
      return { isValid: false, isComplete: false, errorMessage: `Total marks cannot exceed ${max}.` };
    }
    return { isValid: true, isComplete: true };
  }

  // mode === "cie-see"
  const cieEntered = marks.cie !== '' && marks.cie !== undefined;
  const seeEntered = marks.see !== '' && marks.see !== undefined;

  const maxCie = assessment.cie?.maxMarks ?? 50;
  if (cieEntered) {
    if (Number(marks.cie) < 0) {
      return { isValid: false, isComplete: false, errorMessage: 'CIE marks cannot be negative.' };
    }
    if (Number(marks.cie) > maxCie) {
      return { isValid: false, isComplete: false, errorMessage: `CIE marks cannot exceed ${maxCie}.` };
    }
  }

  if (assessment.hasSEE) {
    const maxSee = assessment.see?.maxMarks ?? 50;
    if (seeEntered) {
      if (Number(marks.see) < 0) {
        return { isValid: false, isComplete: false, errorMessage: 'SEE marks cannot be negative.' };
      }
      if (Number(marks.see) > maxSee) {
        return { isValid: false, isComplete: false, errorMessage: `SEE marks cannot exceed ${maxSee}.` };
      }
    }

    const isComplete = cieEntered && seeEntered;
    return { isValid: true, isComplete };
  } else {
    // Course with NO SEE: only CIE is required
    const isComplete = cieEntered;
    return { isValid: true, isComplete };
  }
}

function normalizeCourseScore(courseCode, assessment, mode, marks) {
  let marksObtained = 0;
  let maximumMarks = 100;

  if (mode === 'total') {
    const totalVal = typeof marks.total === 'number' ? marks.total : 0;
    marksObtained = totalVal;

    if (assessment.total?.maxMarks) {
      maximumMarks = assessment.total.maxMarks;
    } else if (assessment.hasSEE) {
      maximumMarks = (assessment.cie?.maxMarks ?? 50) + (assessment.see?.maxMarks ?? 50);
    } else {
      maximumMarks = assessment.cie?.maxMarks ?? 100;
    }
  } else {
    // mode === "cie-see"
    const cieVal = typeof marks.cie === 'number' ? marks.cie : 0;

    if (assessment.hasSEE) {
      const seeVal = typeof marks.see === 'number' ? marks.see : 0;
      marksObtained = cieVal + seeVal;
      maximumMarks = (assessment.cie?.maxMarks ?? 50) + (assessment.see?.maxMarks ?? 50);
    } else {
      // Course has NO SEE
      marksObtained = cieVal;
      maximumMarks = assessment.cie?.maxMarks ?? assessment.total?.maxMarks ?? 100;
    }
  }

  const percentage = maximumMarks > 0 ? (marksObtained / maximumMarks) * 100 : 0;

  return {
    courseCode,
    marksObtained,
    maximumMarks,
    percentage,
  };
}

// ==========================================
// 2. VTU GRADING BANDS & DERIVATION
// ==========================================
const VTU_2022_GRADING_BANDS = [
  { min: 90, max: 100, grade: 'O', gradePoint: 10, description: 'Outstanding' },
  { min: 80, max: 89.99, grade: 'A+', gradePoint: 9, description: 'Excellent' },
  { min: 70, max: 79.99, grade: 'A', gradePoint: 8, description: 'Very Good' },
  { min: 60, max: 69.99, grade: 'B+', gradePoint: 7, description: 'Good' },
  { min: 55, max: 59.99, grade: 'B', gradePoint: 6, description: 'Above Average' },
  { min: 50, max: 54.99, grade: 'C', gradePoint: 5, description: 'Average' },
  { min: 40, max: 49.99, grade: 'P', gradePoint: 4, description: 'Pass' },
  { min: 0, max: 39.99, grade: 'F', gradePoint: 0, description: 'Fail' },
];

function deriveGrade(percentage) {
  const normalizedPct = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));
  for (const band of VTU_2022_GRADING_BANDS) {
    if (normalizedPct >= band.min && (normalizedPct <= band.max || (band.max === 100 && normalizedPct >= 99.99))) {
      return { grade: band.grade, gradePoint: band.gradePoint, isPassed: band.gradePoint > 0, percentage: normalizedPct };
    }
  }
  return { grade: 'F', gradePoint: 0, isPassed: false, percentage: normalizedPct };
}

function deriveGradeFromNormalized(score, assessment, rawMarks, mode) {
  const passingRules = assessment.passingRules;

  if (mode === 'cie-see') {
    if (assessment.hasSEE) {
      const cieVal = typeof rawMarks.cie === 'number' ? rawMarks.cie : 0;
      const seeVal = typeof rawMarks.see === 'number' ? rawMarks.see : 0;
      const minCie = passingRules?.minCIE ?? 20;
      const minSee = passingRules?.minSEE ?? 18;

      if (cieVal < minCie) {
        return { grade: 'F', gradePoint: 0, isPassed: false, percentage: score.percentage, remark: `CIE cutoff not satisfied (Min ${minCie}, got ${cieVal})` };
      }
      if (seeVal < minSee) {
        return { grade: 'F', gradePoint: 0, isPassed: false, percentage: score.percentage, remark: `SEE cutoff not satisfied (Min ${minSee}, got ${seeVal})` };
      }
    } else {
      // Course has NO SEE
      const cieVal = typeof rawMarks.cie === 'number' ? rawMarks.cie : 0;
      const maxCie = assessment.cie?.maxMarks ?? 100;
      const minCie = passingRules?.minCIE ?? (maxCie * 0.4);

      if (cieVal < minCie) {
        return { grade: 'F', gradePoint: 0, isPassed: false, percentage: score.percentage, remark: `CIE cutoff not satisfied (Min ${minCie}, got ${cieVal})` };
      }
    }
  } else if (mode === 'total') {
    const minAgg = passingRules?.minAggregate ?? (score.maximumMarks * 0.4);
    if (score.marksObtained < minAgg) {
      return { grade: 'F', gradePoint: 0, isPassed: false, percentage: score.percentage, remark: `Aggregate cutoff not satisfied (Min ${minAgg}, got ${score.marksObtained})` };
    }
  }

  const minAggregate = passingRules?.minAggregate ?? (score.maximumMarks * 0.4);
  if (score.marksObtained < minAggregate) {
    return { grade: 'F', gradePoint: 0, isPassed: false, percentage: score.percentage, remark: `Total marks below passing threshold (${minAggregate})` };
  }

  return deriveGrade(score.percentage);
}

function calculateVTUSGPA(courses, options = {}) {
  const decimals = options.decimals ?? 2;
  const totalRequired = options.totalRequiredCourses ?? courses.length;

  if (!courses || courses.length === 0) {
    return { sgpa: 0, totalCredits: 0, earnedCredits: 0, totalCreditPoints: 0, isComplete: false, completedCoursesCount: 0, totalRequiredCoursesCount: totalRequired };
  }

  let totalApplicableCredits = 0;
  let totalEarnedCredits = 0;
  let totalCreditPoints = 0;
  const failedCourses = [];
  let evaluatedSubjectCount = 0;

  for (const course of courses) {
    if (!course.includedInSGPA || course.credits <= 0) continue;

    evaluatedSubjectCount++;
    const credits = course.credits;
    const gradePoint = course.gradePoint || 0;
    const pointsEarned = credits * gradePoint;

    totalApplicableCredits += credits;
    totalCreditPoints += pointsEarned;

    if (course.isPassed) {
      totalEarnedCredits += credits;
    } else {
      failedCourses.push(course.courseCode);
    }
  }

  const isComplete = evaluatedSubjectCount >= totalRequired && totalRequired > 0;

  if (totalApplicableCredits === 0) {
    return { sgpa: 0, totalCredits: 0, earnedCredits: 0, totalCreditPoints: 0, isComplete, completedCoursesCount: evaluatedSubjectCount, totalRequiredCoursesCount: totalRequired };
  }

  const rawSGPA = totalCreditPoints / totalApplicableCredits;
  const factor = Math.pow(10, decimals);
  const roundedSGPA = Math.round((rawSGPA + Number.EPSILON) * factor) / factor;

  return {
    sgpa: roundedSGPA,
    totalCredits: totalApplicableCredits,
    earnedCredits: totalEarnedCredits,
    totalCreditPoints,
    isComplete,
    completedCoursesCount: evaluatedSubjectCount,
    totalRequiredCoursesCount: totalRequired,
    failedCourses,
  };
}

// ==========================================
// 3. UNIT TESTS (SECTIONS 39 - 43)
// ==========================================

test('Section 39: Test — CIE + SEE Mode Calculation', () => {
  const bcs401Assessment = {
    hasSEE: true,
    cie: { maxMarks: 50 },
    see: { maxMarks: 50 },
    total: { maxMarks: 100 },
    allowedInputModes: ['cie-see', 'total'],
    passingRules: { minCIE: 20, minSEE: 18, minAggregate: 40 },
  };

  const rawMarks = { cie: 42, see: 38 };
  const normalized = normalizeCourseScore('BCS401', bcs401Assessment, 'cie-see', rawMarks);

  assert.equal(normalized.marksObtained, 80, 'Marks obtained should be 42 + 38 = 80');
  assert.equal(normalized.maximumMarks, 100, 'Maximum marks should be 50 + 50 = 100');
  assert.equal(normalized.percentage, 80, 'Percentage should be 80%');

  const gradeResult = deriveGradeFromNormalized(normalized, bcs401Assessment, rawMarks, 'cie-see');
  assert.equal(gradeResult.grade, 'A+', 'Grade for 80% should be A+');
  assert.equal(gradeResult.gradePoint, 9, 'Grade point for A+ should be 9');
  assert.equal(gradeResult.isPassed, true, 'isPassed should be true');

  const credits = 3;
  const creditPoint = credits * gradeResult.gradePoint;
  assert.equal(creditPoint, 27, 'Credit point should be 3 credits × 9 pts = 27');
});

test('Section 40: Test — Total Marks Mode Calculation', () => {
  const bcs401Assessment = {
    hasSEE: true,
    cie: { maxMarks: 50 },
    see: { maxMarks: 50 },
    total: { maxMarks: 100 },
    allowedInputModes: ['cie-see', 'total'],
    passingRules: { minCIE: 20, minSEE: 18, minAggregate: 40 },
  };

  const rawMarks = { total: 80 };
  const normalized = normalizeCourseScore('BCS401', bcs401Assessment, 'total', rawMarks);

  assert.equal(normalized.marksObtained, 80, 'Marks obtained should be 80');
  assert.equal(normalized.maximumMarks, 100, 'Maximum marks should be 100');
  assert.equal(normalized.percentage, 80, 'Percentage should be 80%');

  const gradeResult = deriveGradeFromNormalized(normalized, bcs401Assessment, rawMarks, 'total');
  assert.equal(gradeResult.grade, 'A+', 'Grade should be A+');
  assert.equal(gradeResult.gradePoint, 9, 'Grade point should be 9');

  const credits = 3;
  const creditPoint = credits * gradeResult.gradePoint;
  assert.equal(creditPoint, 27, 'Credit point should be 27');
});

test('Section 40 & 43: Test — Mode Convergence & Consistency', () => {
  const courseAssessment = {
    hasSEE: true,
    cie: { maxMarks: 50 },
    see: { maxMarks: 50 },
    total: { maxMarks: 100 },
    allowedInputModes: ['cie-see', 'total'],
    passingRules: { minCIE: 20, minSEE: 18, minAggregate: 40 },
  };

  const testCases = [
    { cie: 48, see: 47, total: 95, expectedGrade: 'O', expectedGP: 10 },
    { cie: 42, see: 38, total: 80, expectedGrade: 'A+', expectedGP: 9 },
    { cie: 38, see: 36, total: 74, expectedGrade: 'A', expectedGP: 8 },
    { cie: 32, see: 33, total: 65, expectedGrade: 'B+', expectedGP: 7 },
    { cie: 28, see: 29, total: 57, expectedGrade: 'B', expectedGP: 6 },
    { cie: 26, see: 25, total: 51, expectedGrade: 'C', expectedGP: 5 },
    { cie: 22, see: 23, total: 45, expectedGrade: 'P', expectedGP: 4 },
  ];

  for (const tc of testCases) {
    const normCieSee = normalizeCourseScore('C', courseAssessment, 'cie-see', { cie: tc.cie, see: tc.see });
    const normTotal = normalizeCourseScore('C', courseAssessment, 'total', { total: tc.total });

    assert.equal(normCieSee.percentage, normTotal.percentage, `Percentages must converge for ${tc.total}`);

    const resCieSee = deriveGradeFromNormalized(normCieSee, courseAssessment, { cie: tc.cie, see: tc.see }, 'cie-see');
    const resTotal = deriveGradeFromNormalized(normTotal, courseAssessment, { total: tc.total }, 'total');

    assert.equal(resCieSee.grade, tc.expectedGrade, `CIE+SEE Grade mismatch for ${tc.total}`);
    assert.equal(resTotal.grade, tc.expectedGrade, `Total Grade mismatch for ${tc.total}`);
    assert.equal(resCieSee.gradePoint, resTotal.gradePoint, `Grade points must converge for ${tc.total}`);
  }
});

test('Section 41: Test — Course with NO SEE (e.g. Social Connect BSCK307)', () => {
  const bsck307Assessment = {
    hasSEE: false,
    cie: { maxMarks: 100 },
    total: { maxMarks: 100 },
    allowedInputModes: ['cie-see', 'total'],
    passingRules: { minCIE: 40, minAggregate: 40 },
  };

  // Student enters CIE only
  const validation = validateMarksInput(bsck307Assessment, 'cie-see', { cie: 78 });
  assert.equal(validation.isValid, true, 'CIE input should be valid');
  assert.equal(validation.isComplete, true, 'Should be complete without requiring SEE input');

  // Verify normalize doesn't expect or add SEE
  const normalized = normalizeCourseScore('BSCK307', bsck307Assessment, 'cie-see', { cie: 78 });
  assert.equal(normalized.marksObtained, 78, 'Marks obtained should be CIE marks (78)');
  assert.equal(normalized.maximumMarks, 100, 'Maximum marks should be 100');
  assert.equal(normalized.percentage, 78, 'Percentage should be 78%');

  const gradeResult = deriveGradeFromNormalized(normalized, bsck307Assessment, { cie: 78 }, 'cie-see');
  assert.equal(gradeResult.grade, 'A', 'Grade for 78% should be A');
  assert.equal(gradeResult.gradePoint, 8, 'Grade point should be 8');
  assert.equal(gradeResult.isPassed, true, 'isPassed should be true');

  // Test failing CIE in no-SEE course
  const failNormalized = normalizeCourseScore('BSCK307', bsck307Assessment, 'cie-see', { cie: 35 });
  const failResult = deriveGradeFromNormalized(failNormalized, bsck307Assessment, { cie: 35 }, 'cie-see');
  assert.equal(failResult.grade, 'F', 'CIE < 40 must result in F');
  assert.equal(failResult.gradePoint, 0, 'Grade point must be 0 for F');
});

test('Section 42: Test — Boundary & Input Validations', () => {
  const assessment = {
    hasSEE: true,
    cie: { maxMarks: 50 },
    see: { maxMarks: 50 },
    total: { maxMarks: 100 },
    allowedInputModes: ['cie-see', 'total'],
    passingRules: { minCIE: 20, minSEE: 18, minAggregate: 40 },
  };

  // 0 marks (minimum boundary)
  const vZero = validateMarksInput(assessment, 'cie-see', { cie: 0, see: 0 });
  assert.equal(vZero.isValid, true, '0 marks is valid boundary');

  // Maximum boundary
  const vMax = validateMarksInput(assessment, 'cie-see', { cie: 50, see: 50 });
  assert.equal(vMax.isValid, true, 'Max marks 50 is valid boundary');

  // One below maximum
  const vBelow = validateMarksInput(assessment, 'cie-see', { cie: 49, see: 49 });
  assert.equal(vBelow.isValid, true, '49 marks is valid');

  // One above maximum
  const vAboveCie = validateMarksInput(assessment, 'cie-see', { cie: 51, see: 40 });
  assert.equal(vAboveCie.isValid, false, 'CIE 51 must be invalid (max is 50)');

  const vAboveSee = validateMarksInput(assessment, 'cie-see', { cie: 40, see: 51 });
  assert.equal(vAboveSee.isValid, false, 'SEE 51 must be invalid (max is 50)');

  // Negative marks
  const vNeg = validateMarksInput(assessment, 'cie-see', { cie: -1, see: 40 });
  assert.equal(vNeg.isValid, false, 'Negative marks must be invalid');

  // Decimals support (e.g. 42.5 + 37.5 = 80)
  const vDec = validateMarksInput(assessment, 'cie-see', { cie: 42.5, see: 37.5 });
  assert.equal(vDec.isValid, true, 'Decimal marks are valid');
  const normDec = normalizeCourseScore('C', assessment, 'cie-see', { cie: 42.5, see: 37.5 });
  assert.equal(normDec.marksObtained, 80, '42.5 + 37.5 should equal 80');

  // Empty marks
  const vEmpty = validateMarksInput(assessment, 'cie-see', { cie: '', see: '' });
  assert.equal(vEmpty.isValid, true, 'Empty is valid (not yet entered)');
  assert.equal(vEmpty.isComplete, false, 'Empty is incomplete');
});

test('Section 34: Test — Passing Rules (CIE < 20 or SEE < 18 Failures)', () => {
  const assessment = {
    hasSEE: true,
    cie: { maxMarks: 50 },
    see: { maxMarks: 50 },
    total: { maxMarks: 100 },
    allowedInputModes: ['cie-see', 'total'],
    passingRules: { minCIE: 20, minSEE: 18, minAggregate: 40 },
  };

  // Student got high CIE (45) but failed SEE (17) -> Aggregate 62 (would normally be B+)
  // But per VTU 2022 Scheme rule: SEE < 18 is an automatic F!
  const seeFailNorm = normalizeCourseScore('C', assessment, 'cie-see', { cie: 45, see: 17 });
  const seeFailRes = deriveGradeFromNormalized(seeFailNorm, assessment, { cie: 45, see: 17 }, 'cie-see');
  assert.equal(seeFailRes.grade, 'F', 'Failing SEE cutoff must yield F grade');
  assert.equal(seeFailRes.gradePoint, 0, 'F grade must yield 0 grade points');

  // Student got passing SEE (40) but failed CIE (19) -> Aggregate 59
  // CIE < 20 is an automatic F!
  const cieFailNorm = normalizeCourseScore('C', assessment, 'cie-see', { cie: 19, see: 40 });
  const cieFailRes = deriveGradeFromNormalized(cieFailNorm, assessment, { cie: 19, see: 40 }, 'cie-see');
  assert.equal(cieFailRes.grade, 'F', 'Failing CIE cutoff must yield F grade');
  assert.equal(cieFailRes.gradePoint, 0, 'F grade must yield 0 grade points');
});

test('Section 20 & 31: Test — Non-Credit Exclusion & Partial SGPA', () => {
  const courses = [
    {
      courseCode: 'BCS401',
      courseTitle: 'DAA',
      credits: 3,
      gradePoint: 9,
      isPassed: true,
      includedInSGPA: true,
    },
    {
      courseCode: 'BCS402',
      courseTitle: 'Microcontrollers',
      credits: 3,
      gradePoint: 8,
      isPassed: true,
      includedInSGPA: true,
    },
    {
      courseCode: 'BNSK359',
      courseTitle: 'NSS/PE/Yoga',
      credits: 0,
      gradePoint: 10,
      isPassed: true,
      includedInSGPA: false, // Non-credit course
    },
  ];

  // SGPA should only evaluate BCS401 and BCS402 (total 6 credits)
  // Non-credit BNSK359 must NOT inflate numerator or denominator
  const res = calculateVTUSGPA(courses, { totalRequiredCourses: 3 });

  // Numerator = (3 × 9) + (3 × 8) = 27 + 24 = 51
  // Denominator = 3 + 3 = 6
  // SGPA = 51 / 6 = 8.5
  assert.equal(res.totalCredits, 6, 'Total credits should be 6 (excluding 0 credit course)');
  assert.equal(res.totalCreditPoints, 51, 'Total credit points should be 51');
  assert.equal(res.sgpa, 8.5, 'SGPA should be 8.5');
  assert.equal(res.completedCoursesCount, 2, '2 credit courses completed');
});
