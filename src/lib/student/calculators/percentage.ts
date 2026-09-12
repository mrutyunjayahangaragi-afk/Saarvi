import { PercentageResult, SubjectMarks } from "@/types/student";

export function estimateGrade(pct: number): string {
  if (pct >= 90) return "A+ (Outstanding)";
  if (pct >= 80) return "A (Excellent)";
  if (pct >= 70) return "B+ (Very Good)";
  if (pct >= 60) return "B (Good)";
  if (pct >= 50) return "C (Above Average)";
  if (pct >= 40) return "D (Pass)";
  return "F (Fail)";
}

/**
 * Pure function to calculate multi-subject percentage.
 * Formula: Percentage = (Total Obtained / Total Maximum) * 100
 */
export function calculatePercentage(
  subjects: SubjectMarks[],
  decimals: number = 2
): PercentageResult {
  if (!subjects || subjects.length === 0) {
    return {
      percentage: 0,
      totalObtained: 0,
      totalMaximum: 0,
      subjectCount: 0,
      explanation: "Add your subjects with obtained and maximum marks.",
    };
  }

  let totalObtained = 0;
  let totalMaximum = 0;
  let count = 0;

  for (const s of subjects) {
    const obt = Number(s.obtained);
    const max = Number(s.maximum);

    if (isNaN(obt) || isNaN(max) || max <= 0) continue;

    totalObtained += Math.max(0, obt);
    totalMaximum += max;
    count++;
  }

  if (totalMaximum === 0) {
    return {
      percentage: 0,
      totalObtained: 0,
      totalMaximum: 0,
      subjectCount: count,
      explanation: "Total maximum marks must be greater than zero.",
    };
  }

  const rawPct = (totalObtained / totalMaximum) * 100;
  const factor = Math.pow(10, Math.max(1, Math.min(4, decimals)));
  const roundedPct = Math.round(rawPct * factor) / factor;

  return {
    percentage: roundedPct,
    totalObtained: Math.round(totalObtained * 100) / 100,
    totalMaximum: Math.round(totalMaximum * 100) / 100,
    subjectCount: count,
    gradeEstimate: estimateGrade(roundedPct),
    explanation: `Percentage = (${totalObtained} obtained ÷ ${totalMaximum} maximum) × 100 = ${roundedPct.toFixed(decimals)}%`,
  };
}
