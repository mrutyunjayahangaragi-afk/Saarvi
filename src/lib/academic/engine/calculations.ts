import {
  GradingBand,
  CalculationRules,
  DerivedGrade,
  CourseScoreInput,
  EvaluatedCourseResult,
  SemesterSGPAResult,
  CumulativeCGPAResult,
  AttendanceCalculationResult,
  RequiredMarksResult,
  AcademicGoalResult,
} from "../types";

/**
 * Pure helper for consistent floating-point rounding.
 */
export function roundTo(val: number, decimals: number = 2): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(6, decimals)));
  return Math.round(val * factor) / factor;
}

/**
 * Derives letter grade, grade point, and pass/fail status deterministically.
 */
export function deriveGrade(
  percentage: number,
  bands: GradingBand[],
  evaluationCheck?: {
    cieObtained?: number;
    cieMax?: number;
    minCIE?: number;
    seeObtained?: number;
    seeMax?: number;
    minSEE?: number;
    totalObtained?: number;
    minAggregate?: number;
  }
): DerivedGrade {
  const normalizedPct = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));

  // 1. Check CIE minimum threshold
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

  // 2. Check SEE minimum threshold
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

  // 3. Check aggregate total threshold
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

  // 4. Map normalized percentage to grading bands
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
    remark: "Total percentage below passing threshold",
  };
}

/**
 * Pure evaluator for a single course input.
 */
export function evaluateCourse(
  input: CourseScoreInput,
  bands: GradingBand[]
): EvaluatedCourseResult {
  const mode = input.inputMode;
  const assessment = input.assessment;
  const passingRules = assessment.passingRules;

  let totalObtained = 0;
  let maxTotal = assessment.total?.maxMarks ?? 100;
  let cieVal: number | undefined;
  let seeVal: number | undefined;

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
    assessmentMarks: {
      cie: cieVal,
      see: seeVal,
      total: totalObtained,
    },
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

/**
 * Pure Semester SGPA Calculator.
 *
 * Formula: SGPA = sum(Credit * GradePoint) / sum(Applicable Registered Credits)
 *
 * Invariant: Non-credit courses are excluded from denominator.
 * Invariant: F-grades keep registered credits in denominator (gradePoint 0).
 */
export function calculateSemesterSGPA(
  courses: EvaluatedCourseResult[],
  rules: CalculationRules = { roundingDecimals: 2, fGradeTreatment: "retain_credits" },
  totalRequiredCourses?: number
): SemesterSGPAResult {
  const decimals = rules.roundingDecimals ?? 2;
  const totalRequired = totalRequiredCourses ?? courses.length;

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
      calculationSteps: [],
      explanation: "No subjects provided for calculation.",
      courses: [],
    };
  }

  let totalApplicableCredits = 0;
  let totalEarnedCredits = 0;
  let totalCreditPoints = 0;
  const failedCourses: string[] = [];
  const stepBreakdowns: string[] = [];
  let evaluatedSubjectCount = 0;

  for (const c of courses) {
    if (!c.includedInSGPA || c.credits <= 0) {
      continue;
    }

    evaluatedSubjectCount++;
    totalApplicableCredits += c.credits;
    totalCreditPoints += c.creditPoints;

    if (c.isPassed) {
      totalEarnedCredits += c.credits;
    } else {
      failedCourses.push(c.courseCode);
    }

    stepBreakdowns.push(
      `${c.courseCode} (${c.credits} cr × ${c.gradePoint} pts = ${c.creditPoints})`
    );
  }

  const isComplete = evaluatedSubjectCount >= totalRequired && totalRequired > 0;

  if (totalApplicableCredits === 0) {
    return {
      sgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalCreditPoints: 0,
      subjectCount: evaluatedSubjectCount,
      hasBacklogs: false,
      failedCourses: [],
      isComplete,
      completedCoursesCount: evaluatedSubjectCount,
      totalRequiredCoursesCount: totalRequired,
      calculationSteps: [],
      explanation: "Total applicable credits must be greater than zero.",
      courses,
    };
  }

  const rawSGPA = totalCreditPoints / totalApplicableCredits;
  const roundedSGPA = roundTo(rawSGPA, decimals);

  const steps = [
    `Numerator (Total Credit Points) = ${stepBreakdowns.join(" + ")} = ${totalCreditPoints}`,
    `Denominator (Total Registered Credits) = ${totalApplicableCredits}`,
    `SGPA = ${totalCreditPoints} ÷ ${totalApplicableCredits} = ${roundedSGPA}`,
  ];

  let explanation = `Your SGPA is ${roundedSGPA} across ${totalApplicableCredits} registered credits.`;
  if (!isComplete) {
    explanation = `Partial calculated SGPA is ${roundedSGPA} for ${evaluatedSubjectCount} of ${totalRequired} courses.`;
  }
  if (failedCourses.length > 0) {
    explanation += ` Notice: ${failedCourses.length} course(s) with Grade F (${failedCourses.join(", ")}). Registered credits remain in the denominator.`;
  }

  return {
    sgpa: roundedSGPA,
    totalCredits: totalApplicableCredits,
    earnedCredits: totalEarnedCredits,
    totalCreditPoints,
    subjectCount: evaluatedSubjectCount,
    hasBacklogs: failedCourses.length > 0,
    failedCourses,
    isComplete,
    completedCoursesCount: evaluatedSubjectCount,
    totalRequiredCoursesCount: totalRequired,
    calculationSteps: steps,
    explanation,
    courses,
  };
}

/**
 * Pure Cumulative CGPA Calculator.
 *
 * Formula: CGPA = sum(All Semester Credit Points) / sum(All Semester Registered Credits)
 *
 * Credit-weighted (does not merely average SGPAs).
 */
export function calculateCGPA(
  semesters: Array<{
    semester: number;
    totalCredits: number;
    earnedCredits: number;
    totalCreditPoints: number;
    courses?: EvaluatedCourseResult[];
    status?: string;
    sgpa?: number;
  }>,
  rules: CalculationRules = { roundingDecimals: 2, fGradeTreatment: "retain_credits" }
): CumulativeCGPAResult {
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
      calculationSteps: [],
      explanation: "No semester records provided for CGPA calculation.",
    };
  }

  let cumulativeCredits = 0;
  let cumulativeEarnedCredits = 0;
  let cumulativeCreditPoints = 0;
  const backlogSet = new Set<string>();
  const semesterSteps: string[] = [];
  let validCount = 0;

  for (const sem of semesters) {
    if (sem.status === "not_entered" || sem.totalCredits <= 0) {
      continue;
    }

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

    semesterSteps.push(
      `Sem ${sem.semester}: ${sem.totalCredits} credits, ${sem.totalCreditPoints} credit points`
    );
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
      calculationSteps: [],
      explanation: "Cumulative registered credits must be greater than zero.",
    };
  }

  const rawCGPA = cumulativeCreditPoints / cumulativeCredits;
  const roundedCGPA = roundTo(rawCGPA, decimals);
  const percentage = rules.percentageFormula ? rules.percentageFormula(roundedCGPA) : 0;

  const steps = [
    `Semester Breakdown:`,
    ...semesterSteps.map((s) => `  • ${s}`),
    `Cumulative Credit Points = ${cumulativeCreditPoints}`,
    `Cumulative Registered Credits = ${cumulativeCredits}`,
    `CGPA = ${cumulativeCreditPoints} ÷ ${cumulativeCredits} = ${roundedCGPA}`,
  ];
  if (rules.percentageFormulaDescription) {
    steps.push(`${rules.percentageFormulaDescription} = ${percentage}%`);
  }

  let explanation = `Cumulative GPA across ${validCount} semester(s) is ${roundedCGPA}`;
  if (percentage > 0) {
    explanation += ` (${percentage}% equivalent)`;
  }
  if (backlogSet.size > 0) {
    explanation += `. You have ${backlogSet.size} active backlog(s): ${Array.from(backlogSet).join(", ")}.`;
  }

  return {
    cgpa: roundedCGPA,
    totalCredits: cumulativeCredits,
    earnedCredits: cumulativeEarnedCredits,
    totalCreditPoints: cumulativeCreditPoints,
    percentageEquivalent: percentage,
    completedSemestersCount: validCount,
    hasBacklogs: backlogSet.size > 0,
    backlogCourseCodes: Array.from(backlogSet),
    calculationSteps: steps,
    explanation,
  };
}

/**
 * Pure Attendance Calculator.
 *
 * Deterministically computes attendance %, safe skips, or classes needed.
 */
export function calculateAttendance(
  totalClasses: number,
  attendedClasses: number,
  targetPercentage: number = 75
): AttendanceCalculationResult {
  if (isNaN(totalClasses) || totalClasses <= 0) {
    return {
      currentPercentage: 0,
      isSafe: false,
      message: "Enter the total number of classes conducted.",
      error: "Total classes must be greater than zero.",
      explanation: "Attendance = (Classes Attended ÷ Total Classes) × 100",
    };
  }

  if (totalClasses < 0 || attendedClasses < 0) {
    return {
      currentPercentage: 0,
      isSafe: false,
      message: "Class counts cannot be negative.",
      error: "Class counts cannot be negative.",
      explanation: "Please enter non-negative integer numbers.",
    };
  }

  if (attendedClasses > totalClasses) {
    return {
      currentPercentage: 0,
      isSafe: false,
      message: "Classes attended cannot exceed total classes conducted.",
      error: "Attended classes cannot exceed total classes conducted.",
      explanation: "Attended classes must be less than or equal to total classes.",
    };
  }

  const rawPct = (attendedClasses / totalClasses) * 100;
  const currentPercentage = roundTo(rawPct, 2);
  const target = Math.max(1, Math.min(100, targetPercentage));
  const isSafe = currentPercentage >= target;

  if (isSafe) {
    // Formula: (attended) / (total + M) >= target / 100 => M <= (100 * attended - target * total) / target
    const maxBunkable =
      target > 0
        ? Math.max(0, Math.floor((100 * attendedClasses - target * totalClasses) / target))
        : 0;

    return {
      currentPercentage,
      isSafe: true,
      message: "You're at or above your target attendance.",
      maxBunkableClasses: maxBunkable,
      classesNeededForTarget: 0,
      explanation: `Current Attendance: ${attendedClasses}/${totalClasses} (${currentPercentage}%). Target: ${target}%. You can safely miss up to ${maxBunkable} upcoming class${maxBunkable === 1 ? "" : "es"}.`,
    };
  }

  if (target >= 100) {
    return {
      currentPercentage,
      isSafe: false,
      message: "A 100% attendance target cannot be reached if any class has been missed.",
      classesNeededForTarget: undefined,
      explanation: `Since ${totalClasses - attendedClasses} class${totalClasses - attendedClasses === 1 ? " was" : "es were"} missed, 100% attendance is mathematically impossible.`,
    };
  }

  // Formula: N = ceil((target * total - 100 * attended) / (100 - target))
  const numerator = target * totalClasses - 100 * attendedClasses;
  const denominator = 100 - target;
  const needed = Math.max(0, Math.ceil(numerator / denominator));

  return {
    currentPercentage,
    isSafe: false,
    message: `You must attend the next ${needed} consecutive class${needed === 1 ? "" : "es"} to reach ${target}%.`,
    classesNeededForTarget: needed,
    maxBunkableClasses: 0,
    explanation: `Current Attendance: ${attendedClasses}/${totalClasses} (${currentPercentage}%). Target: ${target}%. To reach ${target}%, attend the next ${needed} class${needed === 1 ? "" : "es"} without missing.`,
  };
}

/**
 * Pure Required Marks Calculator ("What marks do I need?").
 */
export function calculateRequiredMarks(
  currentMarks: number,
  currentMax: number,
  targetPercentage: number,
  remainingMax: number
): RequiredMarksResult {
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
      currentMarks: Math.max(0, currentMarks || 0),
      currentMax: Math.max(0, currentMax || 0),
      targetPercentage: Math.max(0, Math.min(100, targetPercentage || 0)),
      remainingMax: Math.max(0, remainingMax || 0),
      requiredMarks: 0,
      isAchievable: false,
      isAlreadyAchieved: false,
      explanation: "Please enter valid, non-negative numbers with remaining marks greater than zero.",
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
      explanation: `Congratulations! Your current score of ${currentMarks}/${currentMax} has already achieved your target of ${targetPercentage}%.`,
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
      explanation: `Target of ${targetPercentage}% requires ${roundedNeeded} marks, but only ${remainingMax} marks remain. This target is not mathematically achievable.`,
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
    explanation: `You need ${roundedNeeded} out of ${remainingMax} marks (${roundTo((roundedNeeded / remainingMax) * 100, 1)}%) to achieve your target of ${targetPercentage}%.`,
  };
}

/**
 * Pure Academic Goal Calculator.
 *
 * Computes the required average SGPA for remaining credits to achieve a target CGPA.
 */
export function calculateAcademicGoal(
  currentCgpa: number,
  targetCgpa: number,
  completedCredits: number,
  remainingCredits: number
): AcademicGoalResult {
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
      currentCgpa: Math.max(0, currentCgpa || 0),
      targetCgpa: Math.max(0, targetCgpa || 0),
      completedCredits: Math.max(0, completedCredits || 0),
      remainingCredits: Math.max(0, remainingCredits || 0),
      requiredAverageSgpa: 0,
      isAchievable: false,
      explanation: "Please enter valid numbers with remaining credits greater than zero.",
    };
  }

  const totalCredits = completedCredits + remainingCredits;
  const totalPointsNeeded = targetCgpa * totalCredits;
  const currentPoints = currentCgpa * completedCredits;
  const remainingPointsNeeded = totalPointsNeeded - currentPoints;
  const requiredSgpa = roundTo(remainingPointsNeeded / remainingCredits, 2);

  if (requiredSgpa <= 0) {
    return {
      currentCgpa,
      targetCgpa,
      completedCredits,
      remainingCredits,
      requiredAverageSgpa: 0,
      isAchievable: true,
      explanation: `Target CGPA of ${targetCgpa} has already been mathematically secured with your current performance.`,
    };
  }

  if (requiredSgpa > 10) {
    return {
      currentCgpa,
      targetCgpa,
      completedCredits,
      remainingCredits,
      requiredAverageSgpa: requiredSgpa,
      isAchievable: false,
      explanation: `Reaching a CGPA of ${targetCgpa} would require an average SGPA of ${requiredSgpa} across your remaining ${remainingCredits} credits, which exceeds the 10.0 scale maximum.`,
    };
  }

  return {
    currentCgpa,
    targetCgpa,
    completedCredits,
    remainingCredits,
    requiredAverageSgpa: requiredSgpa,
    isAchievable: true,
    explanation: `To achieve your goal CGPA of ${targetCgpa}, you need an average SGPA of at least ${requiredSgpa} across your remaining ${remainingCredits} credits.`,
  };
}
