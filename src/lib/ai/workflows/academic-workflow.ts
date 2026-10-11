/**
 * Academic Workflow Adapter
 * Connects conversational queries directly to Saarvi's deterministic academic calculation engines.
 *
 * Guarantees:
 * 1. ZERO LLM arithmetic hallucinations: all calculations run through calculations.ts.
 * 2. Incomplete data handling: gracefully reports missing credits or grades.
 * 3. Transparent credit and grading band breakdown.
 */

import {
  calculateSemesterSGPA,
  calculateCGPA,
  calculateAttendance,
} from '../../academic/engine/calculations.ts';
import type {
  CourseScoreInput,
  SemesterSGPAResult,
  EvaluatedCourseResult,
  CalculationRules,
  AttendanceCalculationResult,
} from '../../academic/types.ts';
import { AcademicSchemeRegistry } from '../../academic/scheme-registry.ts';

export class AcademicWorkflow {
  /**
   * Deterministically calculates SGPA from course inputs.
   */
  public static calculateSGPA(params: {
    courses: Array<{
      code?: string;
      title?: string;
      credits?: number;
      marks?: number;
      cie?: number;
      see?: number;
      grade?: string;
    }>;
    schemeCode?: string;
  }): {
    success: boolean;
    sgpa?: number;
    totalCredits?: number;
    breakdown?: string;
    missingFields?: string[];
    explanation: string;
  } {
    const courses = params.courses || [];
    if (courses.length === 0) {
      return {
        success: false,
        missingFields: ['courses'],
        explanation: 'Please provide at least one course with marks or grades and credits to calculate your SGPA.',
      };
    }

    const missingFields: string[] = [];

    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      const identifier = c.title || c.code || `Course ${i + 1}`;

      if (c.credits === undefined || c.credits <= 0) {
        missingFields.push(`Credits for ${identifier}`);
      }

      if (c.marks === undefined && c.cie === undefined && !c.grade) {
        missingFields.push(`Marks or grade for ${identifier}`);
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        missingFields,
        explanation: `Incomplete course data. Missing: ${missingFields.join(', ')}. Please provide these details to run the calculation.`,
      };
    }

    const scheme = params.schemeCode ? AcademicSchemeRegistry.getScheme(params.schemeCode) : AcademicSchemeRegistry.getScheme('vtu-2022');

    const evaluatedCourses: EvaluatedCourseResult[] = courses.map((c, i) => {
      const credits = c.credits || 3;
      let grade = c.grade;
      let gradePoint = 0;
      const percentage = c.marks ?? 0;

      if (grade) {
        const found = scheme.gradeBands.find((b) => b.grade.toUpperCase() === grade!.toUpperCase());
        if (found) {
          gradePoint = found.gradePoint;
        }
      } else if (c.marks !== undefined) {
        const derived = AcademicSchemeRegistry.deriveGrade(c.marks, scheme.schemeId);
        grade = derived.grade;
        gradePoint = derived.gradePoint;
      } else {
        grade = 'P';
        gradePoint = 4;
      }

      return {
        courseCode: c.code || `SUB${i + 1}`,
        courseTitle: c.title || `Subject ${i + 1}`,
        credits,
        assessmentMarks: {
          cie: c.cie,
          see: c.see,
          total: c.marks,
        },
        inputMode: 'total',
        totalMarks: c.marks ?? 0,
        percentage,
        grade: grade || 'P',
        gradePoint,
        creditPoints: credits * gradePoint,
        isPassed: gradePoint > 0,
        includedInSGPA: true,
        includedInCGPA: true,
      };
    });

    const rules: CalculationRules = {
      roundingDecimals: scheme.roundingDecimals ?? 2,
      fGradeTreatment: 'retain_credits',
    };

    const result: SemesterSGPAResult = calculateSemesterSGPA(evaluatedCourses, rules);

    const breakdownLines = result.courses.map((cr: EvaluatedCourseResult) => {
      return `• **${cr.courseTitle}** (${cr.credits} creds): Grade **${cr.grade}** (GP: ${cr.gradePoint}) — Credit Points: ${cr.creditPoints}`;
    });

    const breakdown =
      `**SGPA: ${result.sgpa.toFixed(2)}**\n` +
      `Total Credits: ${result.earnedCredits} / ${result.totalCredits}\n\n` +
      `**Course Breakdown:**\n` +
      breakdownLines.join('\n');

    return {
      success: true,
      sgpa: result.sgpa,
      totalCredits: result.totalCredits,
      breakdown,
      explanation: `Your calculated SGPA is **${result.sgpa.toFixed(2)}** across ${result.totalCredits} total credits based on verified deterministic formulas.`,
    };
  }

  /**
   * Deterministically calculates attendance recovery statistics.
   */
  public static calculateAttendanceStatus(attended: number, total: number, targetPct: number = 75) {
    if (total <= 0) {
      return {
        success: false,
        explanation: 'Total classes conducted must be greater than zero.',
      };
    }

    const result: AttendanceCalculationResult = calculateAttendance(total, attended, targetPct);
    let advice = '';

    if (!result.isSafe) {
      advice = `⚠️ Attendance shortage! You need to attend the next **${result.classesNeededForTarget || 0}** consecutive classes to reach ${targetPct}%.`;
    } else {
      advice = `✅ Attendance is safe at **${result.currentPercentage.toFixed(1)}%**. You can safely miss up to **${result.maxBunkableClasses || 0}** classes while remaining above ${targetPct}%.`;
    }

    return {
      success: true,
      percentage: result.currentPercentage,
      isShortage: !result.isSafe,
      classesNeeded: result.classesNeededForTarget || 0,
      bunkableClasses: result.maxBunkableClasses || 0,
      explanation: advice,
    };
  }
}
