import { CGPAResult, GradingScale, SubjectGrade } from "@/types/student";

export const DEFAULT_GRADING_SCALES: GradingScale[] = [
  {
    id: "10-point",
    name: "10-Point Scale (VTU, CBSE, Mumbai Univ, etc.)",
    maxPoints: 10,
    grades: [
      { letter: "O", points: 10 },
      { letter: "A+", points: 9 },
      { letter: "A", points: 8 },
      { letter: "B+", points: 7 },
      { letter: "B", points: 6 },
      { letter: "C", points: 5 },
      { letter: "P", points: 4 },
      { letter: "F", points: 0 },
    ],
  },
  {
    id: "10-point-standard",
    name: "10-Point Letter Scale (A+, A, B+, B, C, D, F)",
    maxPoints: 10,
    grades: [
      { letter: "A+", points: 10 },
      { letter: "A", points: 9 },
      { letter: "B+", points: 8 },
      { letter: "B", points: 7 },
      { letter: "C+", points: 6 },
      { letter: "C", points: 5 },
      { letter: "D", points: 4 },
      { letter: "F", points: 0 },
    ],
  },
  {
    id: "4-point",
    name: "4.0 Scale (US / International)",
    maxPoints: 4,
    grades: [
      { letter: "A+", points: 4.0 },
      { letter: "A", points: 4.0 },
      { letter: "A-", points: 3.7 },
      { letter: "B+", points: 3.3 },
      { letter: "B", points: 3.0 },
      { letter: "B-", points: 2.7 },
      { letter: "C+", points: 2.3 },
      { letter: "C", points: 2.0 },
      { letter: "C-", points: 1.7 },
      { letter: "D+", points: 1.3 },
      { letter: "D", points: 1.0 },
      { letter: "F", points: 0.0 },
    ],
  },
];

/**
 * Pure function to calculate Cumulative Grade Point Average (CGPA).
 * Formula: CGPA = sum(credits * gradePoints) / sum(credits)
 */
export function calculateCGPA(
  subjects: SubjectGrade[],
  scale: GradingScale = DEFAULT_GRADING_SCALES[0],
  decimals: number = 2
): CGPAResult {
  if (!subjects || subjects.length === 0) {
    return {
      cgpa: 0,
      totalCredits: 0,
      totalPoints: 0,
      subjectCount: 0,
      explanation: "Add at least one subject with credits and grade to calculate your CGPA.",
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
      cgpa: 0,
      totalCredits: 0,
      totalPoints: 0,
      subjectCount: validSubjectCount,
      explanation: "Total credits must be greater than zero.",
    };
  }

  const rawCgpa = totalPoints / totalCredits;
  const factor = Math.pow(10, Math.max(1, Math.min(4, decimals)));
  const roundedCgpa = Math.round(rawCgpa * factor) / factor;

  return {
    cgpa: roundedCgpa,
    totalCredits,
    totalPoints: Math.round(totalPoints * 100) / 100,
    subjectCount: validSubjectCount,
    explanation: `CGPA = Total Weighted Points (${totalPoints.toFixed(2)}) ÷ Total Credits (${totalCredits}) = ${roundedCgpa.toFixed(decimals)}`,
  };
}
