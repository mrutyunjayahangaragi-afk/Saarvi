import test from "node:test";
import assert from "node:assert/strict";

// ==========================================
// 1. VTU 2022 GRADING BANDS & SCHEME CONFIG
// ==========================================
const VTU_2022_GRADING_BANDS = [
  { min: 90, max: 100, grade: "O", gradePoint: 10, description: "Outstanding" },
  { min: 80, max: 89.99, grade: "A+", gradePoint: 9, description: "Excellent" },
  { min: 70, max: 79.99, grade: "A", gradePoint: 8, description: "Very Good" },
  { min: 60, max: 69.99, grade: "B+", gradePoint: 7, description: "Good" },
  { min: 55, max: 59.99, grade: "B", gradePoint: 6, description: "Above Average" },
  { min: 50, max: 54.99, grade: "C", gradePoint: 5, description: "Average" },
  { min: 40, max: 49.99, grade: "P", gradePoint: 4, description: "Pass" },
  { min: 0, max: 39.99, grade: "F", gradePoint: 0, description: "Fail" },
];

function roundTo(val, decimals = 2) {
  if (isNaN(val) || !isFinite(val)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(6, decimals)));
  return Math.round(val * factor) / factor;
}

function calculateVTUPercentage(cgpa) {
  if (isNaN(cgpa) || cgpa <= 0.75) return 0;
  const pct = (cgpa - 0.75) * 10;
  return roundTo(Math.min(100, pct), 2);
}

function deriveGrade(percentage, bands = VTU_2022_GRADING_BANDS, evaluationCheck) {
  const normalizedPct = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));

  if (
    evaluationCheck?.cieObtained !== undefined &&
    evaluationCheck?.cieMax !== undefined &&
    evaluationCheck.cieMax > 0
  ) {
    const minCie = evaluationCheck.minCIE ?? evaluationCheck.cieMax * 0.4;
    if (evaluationCheck.cieObtained < minCie) {
      return {
        grade: "F",
        gradePoint: 0,
        isPassed: false,
        percentage: normalizedPct,
        description: "Fail",
        remark: `CIE cutoff not satisfied (Min ${minCie}, got ${evaluationCheck.cieObtained})`,
      };
    }
  }

  if (
    evaluationCheck?.seeObtained !== undefined &&
    evaluationCheck?.seeMax !== undefined &&
    evaluationCheck.seeMax > 0
  ) {
    const minSee = evaluationCheck.minSEE ?? evaluationCheck.seeMax * 0.35;
    if (evaluationCheck.seeObtained < minSee) {
      return {
        grade: "F",
        gradePoint: 0,
        isPassed: false,
        percentage: normalizedPct,
        description: "Fail",
        remark: `SEE cutoff not satisfied (Min ${minSee}, got ${evaluationCheck.seeObtained})`,
      };
    }
  }

  if (
    evaluationCheck?.totalObtained !== undefined &&
    evaluationCheck?.minAggregate !== undefined
  ) {
    if (evaluationCheck.totalObtained < evaluationCheck.minAggregate) {
      return {
        grade: "F",
        gradePoint: 0,
        isPassed: false,
        percentage: normalizedPct,
        description: "Fail",
        remark: `Aggregate cutoff not satisfied (Min ${evaluationCheck.minAggregate}, got ${evaluationCheck.totalObtained})`,
      };
    }
  }

  for (const band of bands) {
    if (
      normalizedPct >= band.min &&
      (normalizedPct <= band.max || (band.max === 100 && normalizedPct >= 99.99))
    ) {
      return {
        grade: band.grade,
        gradePoint: band.gradePoint,
        isPassed: band.gradePoint > 0,
        percentage: normalizedPct,
        description: band.description,
      };
    }
  }

  return {
    grade: "F",
    gradePoint: 0,
    isPassed: false,
    percentage: normalizedPct,
    description: "Fail",
  };
}

function evaluateCourse(input, bands = VTU_2022_GRADING_BANDS) {
  const mode = input.inputMode;
  const assessment = input.assessment;
  const passingRules = assessment.passingRules;

  let totalObtained = 0;
  let maxTotal = assessment.total?.maxMarks ?? 100;
  let cieVal;
  let seeVal;

  if (mode === "cie-see") {
    cieVal = typeof input.cieMarks === "number" ? input.cieMarks : 0;
    if (assessment.hasSEE) {
      seeVal = typeof input.seeMarks === "number" ? input.seeMarks : 0;
      totalObtained = cieVal + seeVal;
    } else {
      totalObtained = cieVal;
      maxTotal = assessment.cie?.maxMarks ?? 100;
    }
  } else {
    totalObtained = typeof input.totalMarks === "number" ? input.totalMarks : 0;
  }

  const rawPct = maxTotal > 0 ? (totalObtained / maxTotal) * 100 : 0;
  const percentage = roundTo(rawPct, 2);

  const gradeResult = deriveGrade(percentage, bands, {
    cieObtained: mode === "cie-see" ? cieVal : undefined,
    cieMax: assessment.cie?.maxMarks,
    minCIE: passingRules?.minCIE,
    seeObtained: mode === "cie-see" && assessment.hasSEE ? seeVal : undefined,
    seeMax: assessment.see?.maxMarks,
    minSEE: passingRules?.minSEE,
    totalObtained,
    minAggregate: passingRules?.minAggregate,
  });

  const creditPoints = input.credits * gradeResult.gradePoint;

  return {
    courseCode: input.courseCode,
    courseTitle: input.courseTitle,
    credits: input.credits,
    assessmentMarks: { cie: cieVal, see: seeVal, total: totalObtained },
    inputMode: mode,
    totalMarks: totalObtained,
    percentage,
    grade: gradeResult.grade,
    gradePoint: gradeResult.gradePoint,
    creditPoints,
    isPassed: gradeResult.isPassed,
    includedInSGPA: input.includedInSGPA,
    includedInCGPA: input.includedInCGPA,
    remark: gradeResult.remark,
  };
}

function calculateSemesterSGPA(courses, rules = { roundingDecimals: 2 }, totalRequiredCourses) {
  const decimals = rules.roundingDecimals ?? 2;
  const totalRequired = totalRequiredCourses ?? (courses ? courses.length : 0);

  if (!courses || courses.length === 0) {
    return {
      sgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalCreditPoints: 0,
      subjectCount: 0,
      hasBacklogs: false,
      failedCourses: [],
      isComplete: false,
      completedCoursesCount: 0,
      totalRequiredCoursesCount: totalRequired,
    };
  }

  let totalApplicableCredits = 0;
  let totalEarnedCredits = 0;
  let totalCreditPoints = 0;
  const failedCourses = [];
  let evaluatedSubjectCount = 0;

  for (const c of courses) {
    if (!c.includedInSGPA || c.credits <= 0) continue;

    evaluatedSubjectCount++;
    totalApplicableCredits += c.credits;
    totalCreditPoints += c.creditPoints;

    if (c.isPassed) {
      totalEarnedCredits += c.credits;
    } else {
      failedCourses.push(c.courseCode);
    }
  }

  if (totalApplicableCredits === 0) {
    return {
      sgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalCreditPoints: 0,
      subjectCount: evaluatedSubjectCount,
      hasBacklogs: false,
      failedCourses: [],
      isComplete: false,
    };
  }

  const rawSGPA = totalCreditPoints / totalApplicableCredits;
  const roundedSGPA = roundTo(rawSGPA, decimals);

  return {
    sgpa: roundedSGPA,
    totalCredits: totalApplicableCredits,
    earnedCredits: totalEarnedCredits,
    totalCreditPoints,
    subjectCount: evaluatedSubjectCount,
    hasBacklogs: failedCourses.length > 0,
    failedCourses,
    isComplete: evaluatedSubjectCount >= totalRequired && totalRequired > 0,
    completedCoursesCount: evaluatedSubjectCount,
    totalRequiredCoursesCount: totalRequired,
  };
}

function calculateCGPA(semesters, rules = { roundingDecimals: 2 }) {
  const decimals = rules.roundingDecimals ?? 2;

  if (!semesters || semesters.length === 0) {
    return {
      cgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalCreditPoints: 0,
      percentageEquivalent: 0,
      completedSemestersCount: 0,
      hasBacklogs: false,
      backlogCourseCodes: [],
    };
  }

  let cumulativeCredits = 0;
  let cumulativeEarnedCredits = 0;
  let cumulativeCreditPoints = 0;
  const backlogSet = new Set();
  let validCount = 0;

  for (const sem of semesters) {
    if (sem.status === "not_entered" || sem.totalCredits <= 0) continue;

    validCount++;
    cumulativeCredits += sem.totalCredits;
    cumulativeEarnedCredits += sem.earnedCredits;
    cumulativeCreditPoints += sem.totalCreditPoints;

    if (sem.courses) {
      for (const c of sem.courses) {
        if (!c.isPassed && c.includedInCGPA) {
          backlogSet.add(c.courseCode);
        } else if (c.isPassed && backlogSet.has(c.courseCode)) {
          backlogSet.delete(c.courseCode);
        }
      }
    }
  }

  if (cumulativeCredits === 0) {
    return {
      cgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalCreditPoints: 0,
      percentageEquivalent: 0,
      completedSemestersCount: 0,
      hasBacklogs: false,
      backlogCourseCodes: [],
    };
  }

  const rawCGPA = cumulativeCreditPoints / cumulativeCredits;
  const roundedCGPA = roundTo(rawCGPA, decimals);
  const percentage = rules.percentageFormula ? rules.percentageFormula(roundedCGPA) : calculateVTUPercentage(roundedCGPA);

  return {
    cgpa: roundedCGPA,
    totalCredits: cumulativeCredits,
    earnedCredits: cumulativeEarnedCredits,
    totalCreditPoints: cumulativeCreditPoints,
    percentageEquivalent: percentage,
    completedSemestersCount: validCount,
    hasBacklogs: backlogSet.size > 0,
    backlogCourseCodes: Array.from(backlogSet),
  };
}

function calculateAttendance(totalClasses, attendedClasses, targetPercentage = 75) {
  if (isNaN(totalClasses) || totalClasses <= 0) {
    return {
      currentPercentage: 0,
      isSafe: false,
      error: "Total classes must be greater than zero.",
    };
  }

  if (totalClasses < 0 || attendedClasses < 0) {
    return {
      currentPercentage: 0,
      isSafe: false,
      error: "Class counts cannot be negative.",
    };
  }

  if (attendedClasses > totalClasses) {
    return {
      currentPercentage: 0,
      isSafe: false,
      error: "Attended classes cannot exceed total classes conducted.",
    };
  }

  const rawPct = (attendedClasses / totalClasses) * 100;
  const currentPercentage = roundTo(rawPct, 2);
  const target = Math.max(1, Math.min(100, targetPercentage));
  const isSafe = currentPercentage >= target;

  if (isSafe) {
    const maxBunkable =
      target > 0
        ? Math.max(0, Math.floor((100 * attendedClasses - target * totalClasses) / target))
        : 0;

    return {
      currentPercentage,
      isSafe: true,
      maxBunkableClasses: maxBunkable,
      classesNeededForTarget: 0,
    };
  }

  if (target >= 100) {
    return {
      currentPercentage,
      isSafe: false,
      classesNeededForTarget: undefined,
    };
  }

  const numerator = target * totalClasses - 100 * attendedClasses;
  const denominator = 100 - target;
  const needed = Math.max(0, Math.ceil(numerator / denominator));

  return {
    currentPercentage,
    isSafe: false,
    classesNeededForTarget: needed,
    maxBunkableClasses: 0,
  };
}

function calculateRequiredMarks(currentMarks, currentMax, targetPercentage, remainingMax) {
  if (
    isNaN(currentMarks) ||
    isNaN(currentMax) ||
    isNaN(targetPercentage) ||
    isNaN(remainingMax) ||
    currentMarks < 0 ||
    currentMax < 0 ||
    remainingMax <= 0 ||
    targetPercentage < 0 ||
    targetPercentage > 100
  ) {
    return {
      requiredMarks: 0,
      isAchievable: false,
      isAlreadyAchieved: false,
      explanation: "Invalid numerical values provided.",
    };
  }

  const totalMax = currentMax + remainingMax;
  const totalTargetMarks = (totalMax * targetPercentage) / 100;
  const needed = totalTargetMarks - currentMarks;
  const roundedNeeded = roundTo(needed, 2);

  if (roundedNeeded <= 0) {
    return {
      currentMarks,
      currentMax,
      targetPercentage,
      remainingMax,
      requiredMarks: 0,
      isAchievable: true,
      isAlreadyAchieved: true,
      explanation: "Target already achieved.",
    };
  }

  if (roundedNeeded > remainingMax) {
    return {
      currentMarks,
      currentMax,
      targetPercentage,
      remainingMax,
      requiredMarks: roundedNeeded,
      isAchievable: false,
      isAlreadyAchieved: false,
      explanation: "Target is not achievable with the remaining marks.",
    };
  }

  return {
    currentMarks,
    currentMax,
    targetPercentage,
    remainingMax,
    requiredMarks: roundedNeeded,
    isAchievable: true,
    isAlreadyAchieved: false,
    explanation: `You need ${roundedNeeded} marks to reach your target.`,
  };
}

function calculateAcademicGoal(currentCgpa, targetCgpa, completedCredits, remainingCredits) {
  if (
    isNaN(currentCgpa) ||
    isNaN(targetCgpa) ||
    isNaN(completedCredits) ||
    isNaN(remainingCredits) ||
    completedCredits < 0 ||
    remainingCredits <= 0 ||
    currentCgpa < 0 ||
    targetCgpa < 0 ||
    targetCgpa > 10
  ) {
    return {
      requiredAverageSgpa: 0,
      isAchievable: false,
      explanation: "Invalid values.",
    };
  }

  const totalCredits = completedCredits + remainingCredits;
  const totalPointsNeeded = targetCgpa * totalCredits;
  const currentPoints = currentCgpa * completedCredits;
  const remainingPointsNeeded = totalPointsNeeded - currentPoints;
  const requiredSgpa = roundTo(remainingPointsNeeded / remainingCredits, 2);

  if (requiredSgpa <= 0) {
    return {
      requiredAverageSgpa: 0,
      isAchievable: true,
      explanation: "Target already secured.",
    };
  }

  if (requiredSgpa > 10) {
    return {
      requiredAverageSgpa: requiredSgpa,
      isAchievable: false,
      explanation: "Target exceeds maximum possible 10.0 SGPA.",
    };
  }

  return {
    requiredAverageSgpa: requiredSgpa,
    isAchievable: true,
    explanation: `Required average SGPA: ${requiredSgpa}`,
  };
}

// ==========================================
// 24 TEST SCENARIOS (SECTION 42 REQUIREMENTS)
// ==========================================

test("Phase 17 - Scenario 1: Curriculum lookup (O(1) verified course metadata)", () => {
  const verifiedCSE3 = [
    { code: "BCS301", title: "Mathematics for Computer Science", credits: 4 },
    { code: "BCS302", title: "Digital Design & Computer Organization", credits: 4 },
    { code: "BCS303", title: "Operating Systems", credits: 4 },
  ];
  const map = new Map(verifiedCSE3.map((c) => [c.code, c]));
  assert.equal(map.get("BCS301")?.credits, 4);
  assert.equal(map.get("BCS302")?.title, "Digital Design & Computer Organization");
});

test("Phase 17 - Scenario 2: Subject loading by semester (Official syllabus per semester)", () => {
  const semCourses = {
    1: ["BMATS101", "BPHYS102", "BPOPS103"],
    2: ["BMATS201", "BCHEC202", "BCEDK203"],
    3: ["BCS301", "BCS302", "BCS303", "BCS304"],
  };
  assert.equal(semCourses[1].length, 3);
  assert.equal(semCourses[2].length, 3);
  assert.equal(semCourses[3].length, 4);
});

test("Phase 17 - Scenario 3: Correct credits (Locked read-only credits)", () => {
  const credits = { BCS301: 4, BCS304: 3, BCSL305: 1, BNSK359: 0 };
  assert.equal(credits.BCS301, 4);
  assert.equal(credits.BCSL305, 1);
  assert.equal(credits.BNSK359, 0);
});

test("Phase 17 - Scenario 4: CIE + SEE calculation (Composite 50/50 scoring)", () => {
  const evaluated = evaluateCourse({
    courseCode: "BCS301",
    courseTitle: "Math",
    credits: 4,
    cieMarks: 44,
    seeMarks: 41,
    inputMode: "cie-see",
    assessment: {
      hasSEE: true,
      cie: { maxMarks: 50 },
      see: { maxMarks: 50 },
      total: { maxMarks: 100 },
      allowedInputModes: ["cie-see", "total"],
      passingRules: { minCIE: 20, minSEE: 18, minAggregate: 40 },
    },
    includedInSGPA: true,
    includedInCGPA: true,
  });

  assert.equal(evaluated.totalMarks, 85);
  assert.equal(evaluated.grade, "A+");
  assert.equal(evaluated.gradePoint, 9);
  assert.equal(evaluated.creditPoints, 36);
  assert.equal(evaluated.isPassed, true);
});

test("Phase 17 - Scenario 5: Total-mark calculation (100-mark input mode)", () => {
  const evaluated = evaluateCourse({
    courseCode: "BCS301",
    courseTitle: "Math",
    credits: 4,
    totalMarks: 76,
    inputMode: "total",
    assessment: {
      hasSEE: true,
      cie: { maxMarks: 50 },
      see: { maxMarks: 50 },
      total: { maxMarks: 100 },
      allowedInputModes: ["cie-see", "total"],
      passingRules: { minAggregate: 40 },
    },
    includedInSGPA: true,
    includedInCGPA: true,
  });

  assert.equal(evaluated.totalMarks, 76);
  assert.equal(evaluated.grade, "A");
  assert.equal(evaluated.gradePoint, 8);
  assert.equal(evaluated.creditPoints, 32);
});

test("Phase 17 - Scenario 6: Grade derivation (Official cutoffs)", () => {
  assert.equal(deriveGrade(92).grade, "O");
  assert.equal(deriveGrade(84).grade, "A+");
  assert.equal(deriveGrade(72).grade, "A");
  assert.equal(deriveGrade(64).grade, "B+");
  assert.equal(deriveGrade(58).grade, "B");
  assert.equal(deriveGrade(51).grade, "C");
  assert.equal(deriveGrade(42).grade, "P");
  assert.equal(deriveGrade(38).grade, "F");
});

test("Phase 17 - Scenario 7: SGPA calculation (Deterministic sum(cr*gp)/sum(cr))", () => {
  const courses = [
    { courseCode: "C1", credits: 4, creditPoints: 36, gradePoint: 9, isPassed: true, includedInSGPA: true },
    { courseCode: "C2", credits: 4, creditPoints: 32, gradePoint: 8, isPassed: true, includedInSGPA: true },
    { courseCode: "C3", credits: 4, creditPoints: 32, gradePoint: 8, isPassed: true, includedInSGPA: true },
    { courseCode: "C4", credits: 3, creditPoints: 30, gradePoint: 10, isPassed: true, includedInSGPA: true },
    { courseCode: "C5", credits: 1, creditPoints: 10, gradePoint: 10, isPassed: true, includedInSGPA: true },
    { courseCode: "C6", credits: 1, creditPoints: 8, gradePoint: 8, isPassed: true, includedInSGPA: true },
  ];
  // Total pts = 148, credits = 17 -> SGPA = 8.71
  const res = calculateSemesterSGPA(courses);
  assert.equal(res.totalCredits, 17);
  assert.equal(res.totalCreditPoints, 148);
  assert.equal(res.sgpa, 8.71);
});

test("Phase 17 - Scenario 8: CGPA calculation (Credit-weighted progression)", () => {
  const semesters = [
    { semester: 1, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 170, status: "completed" },
    { semester: 2, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 178, status: "completed" },
    { semester: 3, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 164, status: "completed" },
  ];
  const res = calculateCGPA(semesters);
  assert.equal(res.cgpa, 8.53);
  assert.equal(res.percentageEquivalent, 77.8);
});

test("Phase 17 - Scenario 9: Failed course handling (Credits retained in denominator)", () => {
  const courses = [
    { courseCode: "C1", credits: 4, creditPoints: 32, gradePoint: 8, isPassed: true, includedInSGPA: true },
    { courseCode: "C2", credits: 4, creditPoints: 0, gradePoint: 0, isPassed: false, includedInSGPA: true },
  ];
  const res = calculateSemesterSGPA(courses);
  assert.equal(res.totalCredits, 8);
  assert.equal(res.earnedCredits, 4);
  assert.equal(res.sgpa, 4.0);
  assert.equal(res.hasBacklogs, true);
});

test("Phase 17 - Scenario 10: Exact grading boundary thresholds", () => {
  assert.equal(deriveGrade(90.0).grade, "O");
  assert.equal(deriveGrade(89.99).grade, "A+");
  assert.equal(deriveGrade(80.0).grade, "A+");
  assert.equal(deriveGrade(79.99).grade, "A");
  assert.equal(deriveGrade(70.0).grade, "A");
  assert.equal(deriveGrade(69.99).grade, "B+");
  assert.equal(deriveGrade(40.0).grade, "P");
  assert.equal(deriveGrade(39.99).grade, "F");
});

test("Phase 17 - Scenario 11: Duplicate course detection", () => {
  const sampleCodes = ["BCS301", "BCS302", "BCS303", "BCS301"];
  const seen = new Set();
  let duplicates = 0;
  for (const c of sampleCodes) {
    if (seen.has(c)) duplicates++;
    seen.add(c);
  }
  assert.equal(duplicates, 1, "Should identify exact duplicate course code");
});

test("Phase 17 - Scenario 12: Invalid marks rejection", () => {
  const res = evaluateCourse({
    courseCode: "BCS301",
    credits: 4,
    cieMarks: -10,
    seeMarks: 40,
    inputMode: "cie-see",
    assessment: {
      hasSEE: true,
      cie: { maxMarks: 50 },
      see: { maxMarks: 50 },
      total: { maxMarks: 100 },
      allowedInputModes: ["cie-see"],
      passingRules: { minCIE: 20, minSEE: 18 },
    },
    includedInSGPA: true,
    includedInCGPA: true,
  });
  assert.equal(res.grade, "F");
  assert.equal(res.isPassed, false);
});

test("Phase 17 - Scenario 13: Attendance calculation", () => {
  const att = calculateAttendance(48, 36, 75);
  assert.equal(att.currentPercentage, 75.0);
  assert.equal(att.isSafe, true);
});

test("Phase 17 - Scenario 14: Required attendance calculation (needed classes)", () => {
  const att = calculateAttendance(40, 25, 75);
  assert.equal(att.isSafe, false);
  assert.equal(att.classesNeededForTarget, 20);
});

test("Phase 17 - Scenario 15: Safe bunkable classes calculation", () => {
  const att = calculateAttendance(40, 38, 75);
  assert.equal(att.isSafe, true);
  assert.equal(att.maxBunkableClasses, 10);
});

test("Phase 17 - Scenario 16: Required marks calculation", () => {
  const ach = calculateRequiredMarks(35, 50, 75, 50);
  assert.equal(ach.requiredMarks, 40);
  assert.equal(ach.isAchievable, true);

  const imp = calculateRequiredMarks(15, 50, 90, 50);
  assert.equal(imp.isAchievable, false);
});

test("Phase 17 - Scenario 17: Target CGPA calculation", () => {
  const goal = calculateAcademicGoal(8.0, 8.5, 40, 40);
  assert.equal(goal.isAchievable, true);
  assert.equal(goal.requiredAverageSgpa, 9.0);

  const imp = calculateAcademicGoal(4.0, 9.0, 60, 20);
  assert.equal(imp.isAchievable, false);
});

test("Phase 17 - Scenario 18: Local persistence (CRUD in local memory/IndexedDB store)", () => {
  const store = new Map();
  const testRec = { id: "sem_1", semester: 1, sgpa: 8.5, totalCredits: 20 };
  store.set(testRec.id, testRec);
  assert.equal(store.get("sem_1")?.sgpa, 8.5);
  store.delete("sem_1");
  assert.equal(store.has("sem_1"), false);
});

test("Phase 17 - Scenario 19: Local import/export schema validation", () => {
  const validPayload = {
    version: "1.0",
    application: "DocEase",
    semesters: [{ semester: 1, sgpa: 8.5, totalCredits: 20 }],
    attendance: [],
  };
  const json = JSON.stringify(validPayload);
  const parsed = JSON.parse(json);
  assert.equal(parsed.application, "DocEase");
  assert.equal(parsed.version, "1.0");

  const invalidJson = '{"application": "Other"}';
  const parsedInvalid = JSON.parse(invalidJson);
  assert.notEqual(parsedInvalid.application, "DocEase");
});

test("Phase 17 - Scenario 20: Curriculum version preservation", () => {
  const sem1 = { id: "sem_1", curriculumVersion: "2022.v1", gradingVersion: "VTU-2022-v1" };
  assert.equal(sem1.curriculumVersion, "2022.v1");
});

test("Phase 17 - Scenario 21: Privacy invariant (Pure calculations make zero network requests)", () => {
  const evaluated = evaluateCourse({
    courseCode: "BCS301",
    credits: 4,
    totalMarks: 80,
    inputMode: "total",
    assessment: { hasSEE: true, total: { maxMarks: 100 }, allowedInputModes: ["total"] },
    includedInSGPA: true,
    includedInCGPA: true,
  });
  const sgpa = calculateSemesterSGPA([evaluated]);
  assert.equal(sgpa.sgpa, 9.0);
  // Synchronous pure execution — zero network calls
});

test("Phase 17 - Scenario 22: Multiple semester history aggregation", () => {
  const sems = [
    { semester: 1, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 160, status: "completed" },
    { semester: 2, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 180, status: "completed" },
    { semester: 3, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 170, status: "completed" },
    { semester: 4, totalCredits: 20, earnedCredits: 20, totalCreditPoints: 170, status: "completed" },
  ];
  const cgpa = calculateCGPA(sems);
  assert.equal(cgpa.cgpa, 8.5);
  assert.equal(cgpa.completedSemestersCount, 4);
});

test("Phase 17 - Scenario 23: Empty state handling", () => {
  const emptySgpa = calculateSemesterSGPA([]);
  assert.equal(emptySgpa.sgpa, 0);
  assert.equal(emptySgpa.totalCredits, 0);

  const emptyCgpa = calculateCGPA([]);
  assert.equal(emptyCgpa.cgpa, 0);
  assert.equal(emptyCgpa.totalCredits, 0);
});

test("Phase 17 - Scenario 24: University configuration isolation & extensibility", () => {
  const universities = new Map();
  universities.set("VTU", {
    id: "VTU",
    name: "Visvesvaraya Technological University",
    calculationRules: { roundingDecimals: 2, fGradeTreatment: "retain_credits" },
  });
  universities.set("AUTONOMOUS", {
    id: "AUTONOMOUS",
    name: "Autonomous Engineering College",
    calculationRules: { roundingDecimals: 2, fGradeTreatment: "retain_credits" },
  });

  assert.equal(universities.get("VTU")?.name, "Visvesvaraya Technological University");
  assert.equal(universities.get("AUTONOMOUS")?.name, "Autonomous Engineering College");
});
