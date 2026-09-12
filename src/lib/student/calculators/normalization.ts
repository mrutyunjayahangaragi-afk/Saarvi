import { CourseAssessmentConfig, MarksInputMode, NormalizedCourseScore } from "@/types/student";

export interface RawMarksInput {
  cie?: number | "";
  see?: number | "";
  total?: number | "";
}

export interface ValidationStatus {
  isValid: boolean;
  errorMessage?: string;
  isComplete: boolean;
}

/**
 * Validates entered marks against the course's assessment configuration.
 */
export function validateMarksInput(
  assessment: CourseAssessmentConfig,
  mode: MarksInputMode,
  marks: RawMarksInput
): ValidationStatus {
  if (mode === "total") {
    if (marks.total === "" || marks.total === undefined) {
      return { isValid: true, isComplete: false };
    }
    const max = assessment.total?.maxMarks ?? 100;
    if (marks.total < 0) {
      return { isValid: false, isComplete: false, errorMessage: "Total marks cannot be negative." };
    }
    if (marks.total > max) {
      return { isValid: false, isComplete: false, errorMessage: `Total marks cannot exceed ${max}.` };
    }
    return { isValid: true, isComplete: true };
  }

  // mode === "cie-see"
  const cieEntered = marks.cie !== "" && marks.cie !== undefined;
  const seeEntered = marks.see !== "" && marks.see !== undefined;

  const maxCie = assessment.cie?.maxMarks ?? 50;
  if (cieEntered) {
    if (Number(marks.cie) < 0) {
      return { isValid: false, isComplete: false, errorMessage: "CIE marks cannot be negative." };
    }
    if (Number(marks.cie) > maxCie) {
      return { isValid: false, isComplete: false, errorMessage: `CIE marks cannot exceed ${maxCie}.` };
    }
  }

  if (assessment.hasSEE) {
    const maxSee = assessment.see?.maxMarks ?? 50;
    if (seeEntered) {
      if (Number(marks.see) < 0) {
        return { isValid: false, isComplete: false, errorMessage: "SEE marks cannot be negative." };
      }
      if (Number(marks.see) > maxSee) {
        return { isValid: false, isComplete: false, errorMessage: `SEE marks cannot exceed ${maxSee}.` };
      }
    }

    const isComplete = cieEntered && seeEntered;
    return { isValid: true, isComplete };
  } else {
    // Course with NO SEE: only CIE is required
    const isComplete = cieEntered;
    return { isValid: true, isComplete };
  }
}

/**
 * Normalization Pipeline:
 * Converts disparate assessment modes (CIE+SEE, Total Marks, or CIE-only for No-SEE)
 * into a single normalized representation: marksObtained / maximumMarks -> percentage.
 *
 * Guaranteed to converge to the same normalized score regardless of UI entry mode.
 */
export function normalizeCourseScore(
  courseCode: string,
  assessment: CourseAssessmentConfig,
  mode: MarksInputMode,
  marks: RawMarksInput
): NormalizedCourseScore {
  let marksObtained = 0;
  let maximumMarks = 100;

  if (mode === "total") {
    const totalVal = typeof marks.total === "number" ? marks.total : 0;
    marksObtained = totalVal;

    if (assessment.total?.maxMarks) {
      maximumMarks = assessment.total.maxMarks;
    } else if (assessment.hasSEE) {
      maximumMarks = (assessment.cie?.maxMarks ?? 50) + (assessment.see?.maxMarks ?? 50);
    } else {
      maximumMarks = assessment.cie?.maxMarks ?? 100;
    }
  } else {
    // mode === "cie-see"
    const cieVal = typeof marks.cie === "number" ? marks.cie : 0;

    if (assessment.hasSEE) {
      const seeVal = typeof marks.see === "number" ? marks.see : 0;
      marksObtained = cieVal + seeVal;
      maximumMarks = (assessment.cie?.maxMarks ?? 50) + (assessment.see?.maxMarks ?? 50);
    } else {
      // Course has NO SEE
      marksObtained = cieVal;
      maximumMarks = assessment.cie?.maxMarks ?? assessment.total?.maxMarks ?? 100;
    }
  }

  const percentage = maximumMarks > 0 ? (marksObtained / maximumMarks) * 100 : 0;

  return {
    courseCode,
    marksObtained,
    maximumMarks,
    percentage,
  };
}
