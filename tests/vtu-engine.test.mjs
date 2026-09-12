import test from 'node:test';
import assert from 'node:assert/strict';

// ==========================================
// 1. VTU 2022 GRADING & ROUNDING ENGINES
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

function deriveGrade(percentage, bands = VTU_2022_GRADING_BANDS, evaluationCheck) {
  const normalizedPct = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));

  if (evaluationCheck?.cieObtained !== undefined && evaluationCheck?.cieMax !== undefined && evaluationCheck.cieMax > 0) {
    const ciePct = (evaluationCheck.cieObtained / evaluationCheck.cieMax) * 100;
    if (ciePct < 40) {
      return { grade: 'F', gradePoint: 0, isPassed: false, percentage: normalizedPct, remark: 'CIE cutoff not satisfied' };
    }
  }

  if (evaluationCheck?.seeObtained !== undefined && evaluationCheck?.seeMax !== undefined && evaluationCheck.seeMax > 0) {
    const seePct = (evaluationCheck.seeObtained / evaluationCheck.seeMax) * 100;
    if (seePct < 35) {
      return { grade: 'F', gradePoint: 0, isPassed: false, percentage: normalizedPct, remark: 'SEE cutoff not satisfied' };
    }
  }

  for (const band of bands) {
    if (normalizedPct >= band.min && (normalizedPct <= band.max || (band.max === 100 && normalizedPct >= 99.99))) {
      return { grade: band.grade, gradePoint: band.gradePoint, isPassed: band.gradePoint > 0, percentage: normalizedPct };
    }
  }

  return { grade: 'F', gradePoint: 0, isPassed: false, percentage: normalizedPct };
}

function roundVTU(value, decimals = 2) {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(4, decimals)));
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function cgpaToPercentageVTU2022(cgpa) {
  if (isNaN(cgpa) || cgpa <= 0.75) return 0;
  const pct = (cgpa - 0.75) * 10;
  return roundVTU(Math.min(100, pct), 2);
}

// ==========================================
// 2. VTU SGPA & CGPA ENGINE LOGIC
// ==========================================
function calculateVTUSGPA(courses, options = {}) {
  const decimals = options.decimals ?? 2;
  if (!courses || courses.length === 0) {
    return { sgpa: 0, totalCredits: 0, earnedCredits: 0, totalCreditPoints: 0, hasBacklogs: false, failedCourses: [] };
  }

  let totalApplicableCredits = 0;
  let totalEarnedCredits = 0;
  let totalCreditPoints = 0;
  const failedCourses = [];

  for (const course of courses) {
    if (!course.includedInSGPA || course.credits <= 0) continue;

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

  if (totalApplicableCredits === 0) {
    return { sgpa: 0, totalCredits: 0, earnedCredits: 0, totalCreditPoints: 0, hasBacklogs: false, failedCourses: [] };
  }

  const rawSGPA = totalCreditPoints / totalApplicableCredits;
  return {
    sgpa: roundVTU(rawSGPA, decimals),
    totalCredits: totalApplicableCredits,
    earnedCredits: totalEarnedCredits,
    totalCreditPoints,
    hasBacklogs: failedCourses.length > 0,
    failedCourses,
  };
}

function calculateVTUCGPA(semesters, options = {}) {
  const decimals = options.decimals ?? 2;
  if (!semesters || semesters.length === 0) {
    return { cgpa: 0, totalCredits: 0, earnedCredits: 0, totalCreditPoints: 0, percentageEquivalent: 0, hasBacklogs: false };
  }

  let cumulativeCredits = 0;
  let cumulativeEarnedCredits = 0;
  let cumulativeCreditPoints = 0;
  const backlogSet = new Set();
  let validSemesters = 0;

  for (const sem of semesters) {
    if (sem.status === 'not_entered' || sem.courses.length === 0) continue;

    validSemesters++;
    cumulativeCredits += sem.totalCredits;
    cumulativeEarnedCredits += sem.earnedCredits;
    cumulativeCreditPoints += sem.totalCreditPoints;

    for (const c of sem.courses) {
      if (!c.isPassed && c.includedInCGPA) {
        backlogSet.add(c.courseCode);
      } else if (c.isPassed && backlogSet.has(c.courseCode)) {
        backlogSet.delete(c.courseCode);
      }
    }
  }

  if (cumulativeCredits === 0) {
    return { cgpa: 0, totalCredits: 0, earnedCredits: 0, totalCreditPoints: 0, percentageEquivalent: 0, hasBacklogs: false };
  }

  const rawCGPA = cumulativeCreditPoints / cumulativeCredits;
  const roundedCGPA = roundVTU(rawCGPA, decimals);
  return {
    cgpa: roundedCGPA,
    totalCredits: cumulativeCredits,
    earnedCredits: cumulativeEarnedCredits,
    totalCreditPoints: cumulativeCreditPoints,
    percentageEquivalent: cgpaToPercentageVTU2022(roundedCGPA),
    hasBacklogs: backlogSet.size > 0,
    backlogCourseCodes: Array.from(backlogSet),
    completedSemestersCount: validSemesters,
  };
}

// ==========================================
// 3. INTERVAL CONFLICT DETECTION LOGIC
// ==========================================
function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return Math.max(0, Math.min(23, isNaN(hours) ? 0 : hours)) * 60 + Math.max(0, Math.min(59, isNaN(minutes) ? 0 : minutes));
}

function detectIntervalConflicts(items) {
  const conflictingIds = new Set();
  if (!items || items.length <= 1) return { hasAnyConflict: false, conflictingIds };

  const groups = new Map();
  for (const item of items) {
    const start = timeStringToMinutes(item.startTime);
    const end = item.endTime ? timeStringToMinutes(item.endTime) : start + (item.durationMinutes || 60);
    const key = item.groupKey.trim().toLowerCase();
    const list = groups.get(key) || [];
    list.push({ item, start, end: Math.min(1440, Math.max(start + 1, end)) });
    groups.set(key, list);
  }

  for (const [, groupItems] of groups.entries()) {
    if (groupItems.length <= 1) continue;
    groupItems.sort((a, b) => a.start - b.start);

    for (let i = 0; i < groupItems.length; i++) {
      for (let j = i + 1; j < groupItems.length; j++) {
        const a = groupItems[i];
        const b = groupItems[j];
        if (b.start >= a.end) break;
        if (Math.max(a.start, b.start) < Math.min(a.end, b.end)) {
          conflictingIds.add(a.item.id);
          conflictingIds.add(b.item.id);
        }
      }
    }
  }

  return { hasAnyConflict: conflictingIds.size > 0, conflictingIds };
}

// ==========================================
// 4. DUPLICATE CERTIFICATE DETECTION
// ==========================================
function generateCertificateCompositeKey(name, issuer, issueDate) {
  const normName = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normIssuer = (issuer || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanDate = (issueDate || '').trim();
  return `${normName}|${normIssuer}|${cleanDate}`;
}

function checkCertificateDuplicate(candidate, existing) {
  if (!existing || existing.length === 0) return { isDuplicate: false };
  const candidateKey = generateCertificateCompositeKey(candidate.name, candidate.issuer, candidate.issueDate);
  for (const cert of existing) {
    if (candidate.id && cert.id === candidate.id) continue;
    if (candidateKey === generateCertificateCompositeKey(cert.name, cert.issuer, cert.issueDate)) {
      return { isDuplicate: true, matchingCertificate: cert };
    }
  }
  return { isDuplicate: false };
}

// ==========================================
// 5. MULTI-CRITERIA ASSIGNMENT SORTER
// ==========================================
function sortAssignmentsMultiCriteria(assignments, todayStr = '2026-09-11') {
  if (!assignments || assignments.length <= 1) return assignments ? [...assignments] : [];

  const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

  return [...assignments].sort((a, b) => {
    const isCompletedA = a.status === 'completed';
    const isCompletedB = b.status === 'completed';
    if (isCompletedA !== isCompletedB) return isCompletedA ? 1 : -1;
    if (isCompletedA && isCompletedB) return b.dueDate.localeCompare(a.dueDate);

    const isOverdueA = a.dueDate < todayStr;
    const isOverdueB = b.dueDate < todayStr;
    if (isOverdueA !== isOverdueB) return isOverdueA ? -1 : 1;
    if (isOverdueA && isOverdueB) return a.dueDate.localeCompare(b.dueDate);

    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);

    const weightA = PRIORITY_WEIGHT[a.priority] || 1;
    const weightB = PRIORITY_WEIGHT[b.priority] || 1;
    return weightB - weightA;
  });
}

// ==========================================
// TEST SUITES
// ==========================================

test('VTU Grade Derivation — Official 2022 Scheme Cutoffs & Letter Grades', () => {
  assert.strictEqual(deriveGrade(95).grade, 'O');
  assert.strictEqual(deriveGrade(95).gradePoint, 10);
  assert.strictEqual(deriveGrade(82).grade, 'A+');
  assert.strictEqual(deriveGrade(82).gradePoint, 9);
  assert.strictEqual(deriveGrade(74).grade, 'A');
  assert.strictEqual(deriveGrade(74).gradePoint, 8);
  assert.strictEqual(deriveGrade(65).grade, 'B+');
  assert.strictEqual(deriveGrade(65).gradePoint, 7);
  assert.strictEqual(deriveGrade(57).grade, 'B');
  assert.strictEqual(deriveGrade(57).gradePoint, 6);
  assert.strictEqual(deriveGrade(52).grade, 'C');
  assert.strictEqual(deriveGrade(52).gradePoint, 5);
  assert.strictEqual(deriveGrade(42).grade, 'P');
  assert.strictEqual(deriveGrade(42).gradePoint, 4);
  assert.strictEqual(deriveGrade(38).grade, 'F');
  assert.strictEqual(deriveGrade(38).gradePoint, 0);

  // Passing cutoff check: CIE < 20 out of 50 -> Fail despite high SEE
  const failCie = deriveGrade(75, undefined, { cieObtained: 18, cieMax: 50, seeObtained: 40, seeMax: 50 });
  assert.strictEqual(failCie.grade, 'F');
  assert.strictEqual(failCie.gradePoint, 0);

  // Passing cutoff check: SEE < 18 out of 50 -> Fail
  const failSee = deriveGrade(70, undefined, { cieObtained: 40, cieMax: 50, seeObtained: 15, seeMax: 50 });
  assert.strictEqual(failSee.grade, 'F');
  assert.strictEqual(failSee.isPassed, false);
});

test('VTU SGPA Engine — Sample Marksheet Calculation', () => {
  const sampleCourses = [
    { courseCode: 'BCS301', credits: 4, gradePoint: 9, isPassed: true, includedInSGPA: true },
    { courseCode: 'BCS302', credits: 4, gradePoint: 8, isPassed: true, includedInSGPA: true },
    { courseCode: 'BCS303', credits: 4, gradePoint: 7, isPassed: true, includedInSGPA: true },
    { courseCode: 'BCS304', credits: 3, gradePoint: 10, isPassed: true, includedInSGPA: true },
    { courseCode: 'BCSL305', credits: 1, gradePoint: 10, isPassed: true, includedInSGPA: true },
    { courseCode: 'BCS306', credits: 3, gradePoint: 8, isPassed: true, includedInSGPA: true },
    { courseCode: 'BSCK307', credits: 1, gradePoint: 9, isPassed: true, includedInSGPA: true },
    { courseCode: 'BCS358', credits: 1, gradePoint: 10, isPassed: true, includedInSGPA: true },
    { courseCode: 'BNSK359', credits: 0, gradePoint: 9, isPassed: true, includedInSGPA: false }, // audit course
  ];

  const result = calculateVTUSGPA(sampleCourses);
  assert.strictEqual(result.totalCredits, 21);
  assert.strictEqual(result.totalCreditPoints, 179);
  assert.strictEqual(result.sgpa, 8.52);
  assert.strictEqual(result.hasBacklogs, false);
});

test('VTU SGPA Engine — F-Grade Treatment (Credits retained in denominator)', () => {
  const coursesWithFail = [
    { courseCode: 'SUB1', credits: 4, gradePoint: 10, isPassed: true, includedInSGPA: true },
    { courseCode: 'SUB2', credits: 4, gradePoint: 0, isPassed: false, includedInSGPA: true },
  ];

  const result = calculateVTUSGPA(coursesWithFail);
  assert.strictEqual(result.totalCredits, 8);
  assert.strictEqual(result.earnedCredits, 4);
  assert.strictEqual(result.totalCreditPoints, 40);
  assert.strictEqual(result.sgpa, 5.0);
  assert.strictEqual(result.hasBacklogs, true);
  assert.deepStrictEqual(result.failedCourses, ['SUB2']);
});

test('VTU CGPA Engine & Percentage Conversion', () => {
  const sem1 = {
    semester: 1,
    courses: [{ courseCode: 'C1', credits: 20, gradePoint: 8, isPassed: true, includedInCGPA: true }],
    totalCredits: 20,
    earnedCredits: 20,
    totalCreditPoints: 160,
    status: 'completed',
  };

  const sem2 = {
    semester: 2,
    courses: [{ courseCode: 'C2', credits: 20, gradePoint: 9, isPassed: true, includedInCGPA: true }],
    totalCredits: 20,
    earnedCredits: 20,
    totalCreditPoints: 180,
    status: 'completed',
  };

  const cgpaResult = calculateVTUCGPA([sem1, sem2]);
  assert.strictEqual(cgpaResult.totalCredits, 40);
  assert.strictEqual(cgpaResult.totalCreditPoints, 340);
  assert.strictEqual(cgpaResult.cgpa, 8.5);
  assert.strictEqual(cgpaResult.percentageEquivalent, 77.5);

  assert.strictEqual(cgpaToPercentageVTU2022(9.25), 85.0);
  assert.strictEqual(cgpaToPercentageVTU2022(7.75), 70.0);
});

test('Interval Overlap Conflict Detector Algorithm — O(N log N)', () => {
  const items = [
    { id: '1', title: 'OS', groupKey: 'Monday', startTime: '10:00', endTime: '11:30' },
    { id: '2', title: 'DS', groupKey: 'Monday', startTime: '11:00', endTime: '12:00' },
    { id: '3', title: 'Math', groupKey: 'Monday', startTime: '14:00', endTime: '15:00' },
  ];

  const conflictResult = detectIntervalConflicts(items);
  assert.strictEqual(conflictResult.hasAnyConflict, true);
  assert.ok(conflictResult.conflictingIds.has('1'));
  assert.ok(conflictResult.conflictingIds.has('2'));
  assert.ok(!conflictResult.conflictingIds.has('3'));

  const adjacentItems = [
    { id: 'a', title: 'Class A', groupKey: 'Tuesday', startTime: '10:00', endTime: '11:00' },
    { id: 'b', title: 'Class B', groupKey: 'Tuesday', startTime: '11:00', endTime: '12:00' },
  ];
  const adjacentResult = detectIntervalConflicts(adjacentItems);
  assert.strictEqual(adjacentResult.hasAnyConflict, false);
});

test('Certificate Duplicate Detector Algorithm — O(1) Composite Key', () => {
  const existing = [
    { id: 'c1', name: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', issueDate: '2025-06-15' },
  ];

  const candidateDup = {
    name: '  aws cloud practitioner  ',
    issuer: 'Amazon Web Services ',
    issueDate: '2025-06-15',
  };

  const check1 = checkCertificateDuplicate(candidateDup, existing);
  assert.strictEqual(check1.isDuplicate, true);

  const candidateUnique = {
    name: 'Google Cloud Certified',
    issuer: 'Google',
    issueDate: '2025-07-20',
  };
  const check2 = checkCertificateDuplicate(candidateUnique, existing);
  assert.strictEqual(check2.isDuplicate, false);
});

test('Assignment Multi-Criteria Sorter Algorithm — Hierarchy Ordering', () => {
  const list = [
    { id: '1', title: 'Future Low', dueDate: '2029-10-10', priority: 'low', status: 'not_started' },
    { id: '2', title: 'Overdue Task', dueDate: '2020-01-01', priority: 'high', status: 'in_progress' },
    { id: '3', title: 'Finished Task', dueDate: '2020-01-01', priority: 'high', status: 'completed' },
  ];

  const sorted = sortAssignmentsMultiCriteria(list, '2026-09-11');
  assert.strictEqual(sorted[0].id, '2', 'Overdue task must be first');
  assert.strictEqual(sorted[1].id, '1', 'Upcoming task must be second');
  assert.strictEqual(sorted[2].id, '3', 'Completed task must be at the bottom');
});
