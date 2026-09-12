import { CourseResultInput, SemesterResult, CGPAResult, SGPAResult } from "@/types/student";
import { roundVTU } from "./rounding";

export interface VTUSGPAResult extends SGPAResult {
  totalCreditPoints: number;
  earnedCredits: number;
  hasBacklogs: boolean;
  failedCourses: string[];
  calculationSteps: string[];
  isComplete: boolean;
  completedCoursesCount: number;
  totalRequiredCoursesCount: number;
}

export interface VTUCGPAResult extends CGPAResult {
  earnedCredits: number;
  totalCreditPoints: number;
  percentageEquivalent: number;
  hasBacklogs: boolean;
  backlogCourseCodes: string[];
  calculationSteps: string[];
  completedSemestersCount: number;
}

/**
 * Pure VTU SGPA Calculator.
 *
 * Formula: SGPA = sum(Credits * GradePoint) / sum(ApplicableCredits)
 * - Only courses with includedInSGPA === true contribute to calculation.
 * - Non-credit courses (credits === 0 or includedInSGPA === false) are ignored.
 * - Failed courses (Grade 'F') contribute credits to the denominator and 0 to the numerator.
 *
 * Time Complexity: O(N) where N is number of courses in the semester.
 */
export function calculateVTUSGPA(
  courses: CourseResultInput[],
  options: { decimals?: number; totalRequiredCourses?: number } = {}
): VTUSGPAResult {
  const decimals = options.decimals ?? 2;
  const totalRequired = options.totalRequiredCourses ?? courses.length;

  if (!courses || courses.length === 0) {
    return {
      sgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalPoints: 0,
      totalCreditPoints: 0,
      subjectCount: 0,
      hasBacklogs: false,
      failedCourses: [],
      explanation: "No subjects provided for calculation.",
      calculationSteps: [],
      isComplete: false,
      completedCoursesCount: 0,
      totalRequiredCoursesCount: totalRequired,
    };
  }

  let totalApplicableCredits = 0;
  let totalEarnedCredits = 0;
  let totalCreditPoints = 0;
  const failedCourses: string[] = [];
  const stepBreakdowns: string[] = [];
  let evaluatedSubjectCount = 0;

  for (const course of courses) {
    // Check if course is included in SGPA
    if (!course.includedInSGPA || course.credits <= 0) {
      continue;
    }

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

    stepBreakdowns.push(
      `${course.courseCode} (${credits} credits × ${gradePoint} pts = ${pointsEarned})`
    );
  }

  const isComplete = evaluatedSubjectCount >= totalRequired && totalRequired > 0;

  if (totalApplicableCredits === 0) {
    return {
      sgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalPoints: 0,
      totalCreditPoints: 0,
      subjectCount: evaluatedSubjectCount,
      hasBacklogs: false,
      failedCourses: [],
      explanation: "Total applicable credits must be greater than zero.",
      calculationSteps: [],
      isComplete,
      completedCoursesCount: evaluatedSubjectCount,
      totalRequiredCoursesCount: totalRequired,
    };
  }

  const rawSGPA = totalCreditPoints / totalApplicableCredits;
  const roundedSGPA = roundVTU(rawSGPA, decimals);

  const steps = [
    `Numerator (Total Credit Points) = ${stepBreakdowns.join(" + ")} = ${totalCreditPoints}`,
    `Denominator (Total Registered Credits) = ${totalApplicableCredits}`,
    `SGPA = ${totalCreditPoints} / ${totalApplicableCredits} = ${roundedSGPA}`,
  ];

  let explanation = `Your SGPA is ${roundedSGPA} across ${totalApplicableCredits} registered credits.`;
  if (!isComplete) {
    explanation = `Partial calculated SGPA is ${roundedSGPA} for ${evaluatedSubjectCount} of ${totalRequired} courses. Enter remaining marks to calculate final semester SGPA.`;
  }
  if (failedCourses.length > 0) {
    explanation += ` Notice: You have ${failedCourses.length} backlog course(s): ${failedCourses.join(", ")}. In accordance with VTU rules, failed course credits remain in the denominator.`;
  }

  return {
    sgpa: roundedSGPA,
    totalCredits: totalApplicableCredits,
    earnedCredits: totalEarnedCredits,
    totalPoints: totalCreditPoints,
    totalCreditPoints,
    subjectCount: evaluatedSubjectCount,
    hasBacklogs: failedCourses.length > 0,
    failedCourses,
    explanation,
    calculationSteps: steps,
    isComplete,
    completedCoursesCount: evaluatedSubjectCount,
    totalRequiredCoursesCount: totalRequired,
  };
}

/**
 * Pure VTU CGPA Calculator.
 *
 * Formula: CGPA = sum(All Semester Credit Points) / sum(All Semester Credits)
 * - Semester-aware weighting (does not simply average SGPAs).
 * - F-grade treatment: Failed courses retain their registered credits in the cumulative denominator.
 *
 * Time Complexity: O(M * N) where M is number of semesters and N is courses per semester.
 */
export function calculateVTUCGPA(
  semesters: SemesterResult[],
  options: { decimals?: number } = {}
): VTUCGPAResult {
  const decimals = options.decimals ?? 2;

  if (!semesters || semesters.length === 0) {
    return {
      cgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalPoints: 0,
      totalCreditPoints: 0,
      percentageEquivalent: 0,
      subjectCount: 0,
      hasBacklogs: false,
      backlogCourseCodes: [],
      completedSemestersCount: 0,
      explanation: "No semester data available for CGPA calculation.",
      calculationSteps: [],
    };
  }

  let cumulativeCredits = 0;
  let cumulativeEarnedCredits = 0;
  let cumulativeCreditPoints = 0;
  const backlogSet = new Set<string>();
  const semesterSteps: string[] = [];
  let validSemestersCount = 0;

  for (const sem of semesters) {
    if (sem.status === "not_entered" || sem.courses.length === 0) {
      continue;
    }

    validSemestersCount++;
    cumulativeCredits += sem.totalCredits;
    cumulativeEarnedCredits += sem.earnedCredits;
    cumulativeCreditPoints += sem.totalCreditPoints;

    for (const c of sem.courses) {
      if (!c.isPassed && c.includedInCGPA) {
        backlogSet.add(c.courseCode);
      } else if (c.isPassed && backlogSet.has(c.courseCode)) {
        // Re-attempt resolution: cleared backlog
        backlogSet.delete(c.courseCode);
      }
    }

    semesterSteps.push(
      `Sem ${sem.semester}: ${sem.totalCredits} credits, ${sem.totalCreditPoints} credit points (SGPA: ${sem.sgpa})`
    );
  }

  if (cumulativeCredits === 0) {
    return {
      cgpa: 0,
      totalCredits: 0,
      earnedCredits: 0,
      totalPoints: 0,
      totalCreditPoints: 0,
      percentageEquivalent: 0,
      subjectCount: 0,
      hasBacklogs: false,
      backlogCourseCodes: [],
      completedSemestersCount: 0,
      explanation: "Cumulative credits must be greater than zero.",
      calculationSteps: [],
    };
  }

  const rawCGPA = cumulativeCreditPoints / cumulativeCredits;
  const roundedCGPA = roundVTU(rawCGPA, decimals);
  const percentage = cgpaToPercentageVTU2022(roundedCGPA);

  const steps = [
    `Semester Breakdown:`,
    ...semesterSteps.map((s) => `  • ${s}`),
    `Cumulative Credit Points = ${cumulativeCreditPoints}`,
    `Cumulative Applicable Credits = ${cumulativeCredits}`,
    `CGPA = ${cumulativeCreditPoints} / ${cumulativeCredits} = ${roundedCGPA}`,
    `VTU 2022 Equivalent Percentage = (${roundedCGPA} - 0.75) × 10 = ${percentage}%`,
  ];

  let explanation = `Your Cumulative GPA across ${validSemestersCount} semester(s) is ${roundedCGPA} (${percentage}% equivalent).`;
  if (backlogSet.size > 0) {
    explanation += ` You have ${backlogSet.size} active backlog(s): ${Array.from(backlogSet).join(", ")}.`;
  }

  return {
    cgpa: roundedCGPA,
    totalCredits: cumulativeCredits,
    earnedCredits: cumulativeEarnedCredits,
    totalPoints: cumulativeCreditPoints,
    totalCreditPoints: cumulativeCreditPoints,
    percentageEquivalent: percentage,
    subjectCount: validSemestersCount,
    hasBacklogs: backlogSet.size > 0,
    backlogCourseCodes: Array.from(backlogSet),
    completedSemestersCount: validSemestersCount,
    explanation,
    calculationSteps: steps,
  };
}

/**
 * Official VTU 2022 Scheme Percentage Conversion.
 * Formula: Percentage = (CGPA - 0.75) * 10
 * Applicable for CGPA >= 0.75.
 */
export function cgpaToPercentageVTU2022(cgpa: number): number {
  if (isNaN(cgpa) || cgpa <= 0.75) return 0;
  const pct = (cgpa - 0.75) * 10;
  return roundVTU(Math.min(100, pct), 2);
}
