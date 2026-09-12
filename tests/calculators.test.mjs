import test from "node:test";
import assert from "node:assert/strict";

// We test pure calculation logic by executing the compiled/standard algorithms
// 1. CGPA & SGPA calculation logic
function calculateCgpa(subjects, scaleGrades, decimals = 2) {
  if (!subjects || subjects.length === 0) return { cgpa: 0, totalCredits: 0 };
  const gradeMap = new Map(scaleGrades.map(g => [g.letter.toUpperCase().trim(), g.points]));
  let totalCredits = 0;
  let totalPoints = 0;
  for (const s of subjects) {
    const credits = Number(s.credits);
    if (isNaN(credits) || credits <= 0) continue;
    const points = gradeMap.get(s.grade?.toUpperCase().trim()) ?? 0;
    totalCredits += credits;
    totalPoints += credits * points;
  }
  if (totalCredits === 0) return { cgpa: 0, totalCredits: 0 };
  const factor = Math.pow(10, decimals);
  return {
    cgpa: Math.round((totalPoints / totalCredits) * factor) / factor,
    totalCredits,
    totalPoints
  };
}

// 2. Percentage calculation logic
function calculatePercentage(subjects, decimals = 2) {
  if (!subjects || subjects.length === 0) return { percentage: 0, totalObtained: 0, totalMaximum: 0 };
  let totalObtained = 0;
  let totalMaximum = 0;
  for (const s of subjects) {
    const obt = Number(s.obtained);
    const max = Number(s.maximum);
    if (isNaN(obt) || isNaN(max) || max <= 0) continue;
    totalObtained += Math.max(0, obt);
    totalMaximum += max;
  }
  if (totalMaximum === 0) return { percentage: 0, totalObtained: 0, totalMaximum: 0 };
  const factor = Math.pow(10, decimals);
  return {
    percentage: Math.round(((totalObtained / totalMaximum) * 100) * factor) / factor,
    totalObtained,
    totalMaximum
  };
}

// 3. Attendance calculation logic
function calculateAttendance(totalClasses, attendedClasses, target = 75) {
  if (isNaN(totalClasses) || totalClasses === 0) {
    return { error: "Total classes conducted must be greater than zero." };
  }
  if (totalClasses < 0 || attendedClasses < 0) {
    return { error: "Class counts cannot be negative." };
  }
  if (attendedClasses > totalClasses) {
    return { error: "Classes attended cannot be greater than total classes conducted." };
  }
  const currentPercentage = Math.round(((attendedClasses / totalClasses) * 100) * 100) / 100;
  const isSafe = currentPercentage >= target;

  if (isSafe) {
    const maxBunkable = Math.max(0, Math.floor((100 * attendedClasses - target * totalClasses) / target));
    return { currentPercentage, isSafe: true, maxBunkableClasses: maxBunkable, classesNeededForTarget: 0 };
  }

  if (target >= 100) {
    return { currentPercentage, isSafe: false, classesNeededForTarget: undefined };
  }

  const needed = Math.ceil((target * totalClasses - 100 * attendedClasses) / (100 - target));
  return { currentPercentage, isSafe: false, classesNeededForTarget: Math.max(0, needed) };
}

// 4. Marks calculation logic
function calculateMarks(subjects, intWeight = 40, extWeight = 60) {
  let totalScore = 0;
  let maxPossible = 0;
  for (const s of subjects) {
    const intObt = Math.max(0, Number(s.intObt) || 0);
    const intMax = Math.max(0, Number(s.intMax) || 0);
    const extObt = Math.max(0, Number(s.extObt) || 0);
    const extMax = Math.max(0, Number(s.extMax) || 0);
    if (intMax === 0 && extMax === 0) continue;

    const intScore = intMax > 0 ? (intObt / intMax) * intWeight : 0;
    const extScore = extMax > 0 ? (extObt / extMax) * extWeight : 0;
    totalScore += intScore + extScore;
    maxPossible += intWeight + extWeight;
  }
  if (maxPossible === 0) return { overallPercentage: 0 };
  return {
    overallPercentage: Math.round((totalScore / maxPossible) * 10000) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    maxPossibleScore: maxPossible
  };
}

const standard10Scale = [
  { letter: "O", points: 10 },
  { letter: "A+", points: 9 },
  { letter: "A", points: 8 },
  { letter: "B+", points: 7 },
  { letter: "B", points: 6 },
  { letter: "C", points: 5 },
  { letter: "P", points: 4 },
  { letter: "F", points: 0 }
];

test("CGPA Calculator — single subject", () => {
  const result = calculateCgpa([{ credits: 4, grade: "A+" }], standard10Scale);
  assert.equal(result.cgpa, 9.0);
  assert.equal(result.totalCredits, 4);
});

test("CGPA Calculator — multiple subjects with weighted credits", () => {
  // Subject 1: 4 credits * 10 (O) = 40
  // Subject 2: 3 credits * 8 (A) = 24
  // Subject 3: 3 credits * 6 (B) = 18
  // Total points = 82 / 10 credits = 8.20
  const subjects = [
    { credits: 4, grade: "O" },
    { credits: 3, grade: "A" },
    { credits: 3, grade: "B" }
  ];
  const result = calculateCgpa(subjects, standard10Scale);
  assert.equal(result.cgpa, 8.2);
  assert.equal(result.totalCredits, 10);
});

test("CGPA Calculator — zero credits and empty list", () => {
  assert.equal(calculateCgpa([], standard10Scale).cgpa, 0);
  assert.equal(calculateCgpa([{ credits: 0, grade: "A" }], standard10Scale).cgpa, 0);
});

test("Percentage Calculator — multiple subjects", () => {
  const subjects = [
    { obtained: 82, maximum: 100 },
    { obtained: 77, maximum: 100 },
    { obtained: 91, maximum: 100 }
  ];
  const result = calculatePercentage(subjects);
  // (82 + 77 + 91) = 250 / 300 = 83.33%
  assert.equal(result.totalObtained, 250);
  assert.equal(result.totalMaximum, 300);
  assert.equal(result.percentage, 83.33);
});

test("Percentage Calculator — zero max and decimals", () => {
  const result = calculatePercentage([{ obtained: 45.5, maximum: 50 }]);
  assert.equal(result.percentage, 91.0);
});

test("Attendance Calculator — safe attendance & bunkable classes", () => {
  // 40 attended out of 45 conducted (~88.89%), target = 75%
  // M <= (100 * 40 - 75 * 45) / 75 = (4000 - 3375) / 75 = 625 / 75 = 8.33 => 8 bunkable
  const result = calculateAttendance(45, 40, 75);
  assert.equal(result.isSafe, true);
  assert.equal(result.currentPercentage, 88.89);
  assert.equal(result.maxBunkableClasses, 8);
  assert.equal(result.classesNeededForTarget, 0);
});

test("Attendance Calculator — deficient attendance & classes needed", () => {
  // 30 attended out of 50 conducted (60%), target = 75%
  // N = ceil((75 * 50 - 100 * 30) / (100 - 75)) = ceil((3750 - 3000) / 25) = ceil(750 / 25) = 30
  // Attending 30 consecutive: 60/80 = 75%
  const result = calculateAttendance(50, 30, 75);
  assert.equal(result.isSafe, false);
  assert.equal(result.classesNeededForTarget, 30);
});

test("Attendance Calculator — edge cases and invalid inputs", () => {
  // Attended > conducted
  const over = calculateAttendance(40, 45, 75);
  assert.ok(over.error);

  // Negative values
  const neg = calculateAttendance(-10, 5, 75);
  assert.ok(neg.error);

  // Zero conducted classes
  const zero = calculateAttendance(0, 0, 75);
  assert.ok(zero.error);

  // Target 100% when a class is already missed
  const missed = calculateAttendance(10, 9, 100);
  assert.equal(missed.classesNeededForTarget, undefined);
});

test("Marks Calculator — 40:60 weightage", () => {
  // Internal: 20/25 (80% -> 32/40)
  // External: 60/75 (80% -> 48/60)
  // Total: 80%
  const result = calculateMarks([{ intObt: 20, intMax: 25, extObt: 60, extMax: 75 }], 40, 60);
  assert.equal(result.overallPercentage, 80.0);
  assert.equal(result.totalScore, 80.0);
});
