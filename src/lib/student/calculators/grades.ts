/**
 * Deterministic Grading Engine.
 *
 * Implements official VTU 2022 Scheme grading bands and passing cutoffs.
 * Algorithms / Data Structures:
 * - Uses ordered range tuples: [min, max, grade, point]
 * - Lookup complexity: O(K) where K = 8 constant grade bands.
 */

export interface GradingBand {
  min: number; // inclusive lower percentage
  max: number; // inclusive upper percentage
  grade: string;
  gradePoint: number;
  description: string;
}

export const VTU_2022_GRADING_BANDS: GradingBand[] = [
  { min: 90, max: 100, grade: "O", gradePoint: 10, description: "Outstanding" },
  { min: 80, max: 89.99, grade: "A+", gradePoint: 9, description: "Excellent" },
  { min: 70, max: 79.99, grade: "A", gradePoint: 8, description: "Very Good" },
  { min: 60, max: 69.99, grade: "B+", gradePoint: 7, description: "Good" },
  { min: 55, max: 59.99, grade: "B", gradePoint: 6, description: "Above Average" },
  { min: 50, max: 54.99, grade: "C", gradePoint: 5, description: "Average" },
  { min: 40, max: 49.99, grade: "P", gradePoint: 4, description: "Pass" },
  { min: 0, max: 39.99, grade: "F", gradePoint: 0, description: "Fail" },
];

export interface DerivedGradeResult {
  grade: string;
  gradePoint: number;
  isPassed: boolean;
  percentage: number;
  description: string;
  remark?: string;
}

/**
 * Derives the letter grade and grade point from obtained marks and percentages.
 * Evaluates official VTU 2022 passing cutoffs:
 * - CIE >= 20 out of 50 (40%)
 * - SEE >= 18 out of 50 (35%)
 * - Total >= 40 out of 100 (40%)
 */
export function deriveGrade(
  percentage: number,
  bands: GradingBand[] = VTU_2022_GRADING_BANDS,
  evaluationCheck?: {
    cieObtained?: number;
    cieMax?: number;
    seeObtained?: number;
    seeMax?: number;
  }
): DerivedGradeResult {
  const normalizedPct = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));

  // Check specific CIE cutoff (VTU: minimum 40% in CIE)
  if (
    evaluationCheck?.cieObtained !== undefined &&
    evaluationCheck?.cieMax !== undefined &&
    evaluationCheck.cieMax > 0
  ) {
    const ciePct = (evaluationCheck.cieObtained / evaluationCheck.cieMax) * 100;
    if (ciePct < 40) {
      return {
        grade: "F",
        gradePoint: 0,
        isPassed: false,
        percentage: normalizedPct,
        description: "Fail",
        remark: `CIE cutoff not satisfied (Min 40%, got ${ciePct.toFixed(1)}%)`,
      };
    }
  }

  // Check specific SEE cutoff (VTU: minimum 35% in SEE)
  if (
    evaluationCheck?.seeObtained !== undefined &&
    evaluationCheck?.seeMax !== undefined &&
    evaluationCheck.seeMax > 0
  ) {
    const seePct = (evaluationCheck.seeObtained / evaluationCheck.seeMax) * 100;
    if (seePct < 35) {
      return {
        grade: "F",
        gradePoint: 0,
        isPassed: false,
        percentage: normalizedPct,
        description: "Fail",
        remark: `SEE cutoff not satisfied (Min 35%, got ${seePct.toFixed(1)}%)`,
      };
    }
  }

  // Range matching in ordered bands
  for (const band of bands) {
    if (normalizedPct >= band.min && (normalizedPct <= band.max || (band.max === 100 && normalizedPct >= 99.99))) {
      return {
        grade: band.grade,
        gradePoint: band.gradePoint,
        isPassed: band.gradePoint > 0,
        percentage: normalizedPct,
        description: band.description,
      };
    }
  }

  // Fallback if below minimum band
  return {
    grade: "F",
    gradePoint: 0,
    isPassed: false,
    percentage: normalizedPct,
    description: "Fail",
    remark: "Total marks below passing threshold (40%)",
  };
}

/**
 * Derives grade points directly from a letter grade.
 */
export function deriveGradePoint(
  grade: string,
  bands: GradingBand[] = VTU_2022_GRADING_BANDS
): number {
  const cleanGrade = grade.trim().toUpperCase();
  for (const band of bands) {
    if (band.grade.toUpperCase() === cleanGrade) {
      return band.gradePoint;
    }
  }
  return 0;
}

import { CourseAssessmentConfig, MarksInputMode, NormalizedCourseScore } from "@/types/student";

/**
 * Derives grade, grade points, and pass status from a normalized score
 * and course assessment passing rules.
 */
export function deriveGradeFromNormalized(
  score: NormalizedCourseScore,
  assessment: CourseAssessmentConfig,
  rawMarks: { cie?: number | ""; see?: number | ""; total?: number | "" },
  mode: MarksInputMode,
  bands: GradingBand[] = VTU_2022_GRADING_BANDS
): DerivedGradeResult {
  const passingRules = assessment.passingRules;

  // 1. Evaluate component passing thresholds
  if (mode === "cie-see") {
    // If course has SEE: verify both CIE and SEE passing cutoffs
    if (assessment.hasSEE) {
      const cieVal = typeof rawMarks.cie === "number" ? rawMarks.cie : 0;
      const seeVal = typeof rawMarks.see === "number" ? rawMarks.see : 0;
      const minCie = passingRules?.minCIE ?? 20;
      const minSee = passingRules?.minSEE ?? 18;

      if (cieVal < minCie) {
        return {
          grade: "F",
          gradePoint: 0,
          isPassed: false,
          percentage: score.percentage,
          description: "Fail",
          remark: `CIE cutoff not satisfied (Min ${minCie}, got ${cieVal})`,
        };
      }

      if (seeVal < minSee) {
        return {
          grade: "F",
          gradePoint: 0,
          isPassed: false,
          percentage: score.percentage,
          description: "Fail",
          remark: `SEE cutoff not satisfied (Min ${minSee}, got ${seeVal})`,
        };
      }
    } else {
      // Course has NO SEE: verify CIE passing cutoff
      const cieVal = typeof rawMarks.cie === "number" ? rawMarks.cie : 0;
      const maxCie = assessment.cie?.maxMarks ?? 100;
      const minCie = passingRules?.minCIE ?? (maxCie * 0.4);

      if (cieVal < minCie) {
        return {
          grade: "F",
          gradePoint: 0,
          isPassed: false,
          percentage: score.percentage,
          description: "Fail",
          remark: `CIE cutoff not satisfied (Min ${minCie}, got ${cieVal})`,
        };
      }
    }
  } else if (mode === "total") {
    // Mode is total: verify aggregate cutoff
    const minAgg = passingRules?.minAggregate ?? (score.maximumMarks * 0.4);
    if (score.marksObtained < minAgg) {
      return {
        grade: "F",
        gradePoint: 0,
        isPassed: false,
        percentage: score.percentage,
        description: "Fail",
        remark: `Aggregate cutoff not satisfied (Min ${minAgg}, got ${score.marksObtained})`,
      };
    }
  }

  // 2. Minimum aggregate check
  const minAggregate = passingRules?.minAggregate ?? (score.maximumMarks * 0.4);
  if (score.marksObtained < minAggregate) {
    return {
      grade: "F",
      gradePoint: 0,
      isPassed: false,
      percentage: score.percentage,
      description: "Fail",
      remark: `Total marks below passing threshold (${minAggregate})`,
    };
  }

  // 3. Map percentage to grade bands
  return deriveGrade(score.percentage, bands);
}
