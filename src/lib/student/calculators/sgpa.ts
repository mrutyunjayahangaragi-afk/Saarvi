import { SGPAResult, GradingScale, SubjectGrade } from "@/types/student";
import { DEFAULT_GRADING_SCALES } from "./cgpa";
export { DEFAULT_GRADING_SCALES } from "./cgpa";

/**
 * Pure function to calculate Semester Grade Point Average (SGPA).
 * Formula: SGPA = sum(credits * gradePoints) / sum(credits) for a single semester's subjects.
 */
export function calculateSGPA(
  subjects: SubjectGrade[],
  scale: GradingScale = DEFAULT_GRADING_SCALES[0],
  decimals: number = 2
): SGPAResult {
  if (!subjects || subjects.length === 0) {
    return {
      sgpa: 0,
      totalCredits: 0,
      totalPoints: 0,
      subjectCount: 0,
      explanation: "Add at least one subject with credits and grade to calculate your SGPA.",
    };
  }

  const gradeMap = new Map<string, number>();
  for (const g of scale.grades) {
    gradeMap.set(g.letter.toUpperCase().trim(), g.points);
  }

  let totalCredits = 0;
  let totalPoints = 0;
  let validSubjectCount = 0;

  for (const s of subjects) {
    const credits = Number(s.credits);
    if (isNaN(credits) || credits <= 0) continue;

    const gradeKey = s.grade?.toUpperCase().trim() ?? "";
    const points = gradeMap.has(gradeKey) ? gradeMap.get(gradeKey)! : 0;

    totalCredits += credits;
    totalPoints += credits * points;
    validSubjectCount++;
  }

  if (totalCredits === 0) {
    return {
      sgpa: 0,
      totalCredits: 0,
      totalPoints: 0,
      subjectCount: validSubjectCount,
      explanation: "Total semester credits must be greater than zero.",
    };
  }

  const rawSgpa = totalPoints / totalCredits;
  const factor = Math.pow(10, Math.max(1, Math.min(4, decimals)));
  const roundedSgpa = Math.round(rawSgpa * factor) / factor;

  return {
    sgpa: roundedSgpa,
    totalCredits,
    totalPoints: Math.round(totalPoints * 100) / 100,
    subjectCount: validSubjectCount,
    explanation: `SGPA is calculated for this semester: Weighted Grade Points (${totalPoints.toFixed(2)}) ÷ Semester Credits (${totalCredits}) = ${roundedSgpa.toFixed(decimals)}.`,
  };
}
