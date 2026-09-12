import { MarksResult, SubjectMarksBreakdown } from "@/types/student";

export interface MarksWeightageConfig {
  internalWeight: number; // e.g. 40 or 50 or 30 (%)
  externalWeight: number; // e.g. 60 or 50 or 70 (%)
}

export const COMMON_MARKS_WEIGHTAGES: { name: string; internal: number; external: number }[] = [
  { name: "50% Internal / 50% External", internal: 50, external: 50 },
  { name: "40% Internal / 60% External (Autonomous / Deemed)", internal: 40, external: 60 },
  { name: "30% Internal / 70% External (State Universities)", internal: 30, external: 70 },
  { name: "20% Internal / 80% External (CBSE / State Boards)", internal: 20, external: 80 },
  { name: "Raw Sum (No Weightage Scaling)", internal: 0, external: 0 },
];

/**
 * Pure function to calculate composite internal/external marks with configurable weightages.
 */
export function calculateMarks(
  subjects: SubjectMarksBreakdown[],
  weightage: MarksWeightageConfig = { internalWeight: 40, externalWeight: 60 }
): MarksResult {
  if (!subjects || subjects.length === 0) {
    return {
      overallPercentage: 0,
      totalInternalScaled: 0,
      totalExternalScaled: 0,
      totalScore: 0,
      maxPossibleScore: 0,
      explanation: "Add at least one subject with internal and external scores.",
    };
  }

  let totalScore = 0;
  let maxPossible = 0;
  let totalIntScaled = 0;
  let totalExtScaled = 0;
  let count = 0;

  const isRaw = weightage.internalWeight === 0 && weightage.externalWeight === 0;

  for (const s of subjects) {
    const intObt = Math.max(0, Number(s.internalObtained) || 0);
    const intMax = Math.max(0, Number(s.internalMax) || 0);
    const extObt = Math.max(0, Number(s.externalObtained) || 0);
    const extMax = Math.max(0, Number(s.externalMax) || 0);

    if (intMax === 0 && extMax === 0) continue;

    if (isRaw) {
      // Direct raw addition
      const subTotal = intObt + extObt;
      const subMax = intMax + extMax;
      totalScore += subTotal;
      maxPossible += subMax;
      totalIntScaled += intObt;
      totalExtScaled += extObt;
    } else {
      // Normalized weightage
      const intRatio = intMax > 0 ? intObt / intMax : 0;
      const extRatio = extMax > 0 ? extObt / extMax : 0;

      const intScore = intRatio * weightage.internalWeight;
      const extScore = extRatio * weightage.externalWeight;

      const subScaledTotal = intScore + extScore;
      const subScaledMax = weightage.internalWeight + weightage.externalWeight;

      totalScore += subScaledTotal;
      maxPossible += subScaledMax;
      totalIntScaled += intScore;
      totalExtScaled += extScore;
    }
    count++;
  }

  if (maxPossible === 0) {
    return {
      overallPercentage: 0,
      totalInternalScaled: 0,
      totalExternalScaled: 0,
      totalScore: 0,
      maxPossibleScore: 0,
      explanation: "Enter non-zero maximum marks for your subjects.",
    };
  }

  const overallPercentage = Math.round((totalScore / maxPossible) * 10000) / 100;

  const explanation = isRaw
    ? `Calculated using direct sum across ${count} subject${count === 1 ? "" : "s"}: Score = ${totalScore} ÷ ${maxPossible} = ${overallPercentage}%.`
    : `Weighted across ${count} subject${count === 1 ? "" : "s"} using ${weightage.internalWeight}% Internal and ${weightage.externalWeight}% External weightage: Overall = ${overallPercentage}%. Note: Evaluation formulas vary by university.`;

  return {
    overallPercentage,
    totalInternalScaled: Math.round(totalIntScaled * 100) / 100,
    totalExternalScaled: Math.round(totalExtScaled * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    maxPossibleScore: Math.round(maxPossible * 100) / 100,
    explanation,
  };
}
