import { AttendanceResult } from "@/types/student";

/**
 * Pure function to calculate attendance percentage and required classes to reach target.
 */
export function calculateAttendance(
  totalClasses: number,
  attendedClasses: number,
  targetPercentage: number = 75
): AttendanceResult {
  // 1. Validation checks
  if (isNaN(totalClasses) || totalClasses === 0) {
    return {
      currentPercentage: 0,
      isSafe: false,
      message: "Enter the number of classes conducted.",
      error: "Total classes conducted must be greater than zero.",
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
      error: "Classes attended cannot be greater than total classes conducted.",
      explanation: "Attended classes must be less than or equal to total classes.",
    };
  }

  const rawPct = (attendedClasses / totalClasses) * 100;
  const currentPercentage = Math.round(rawPct * 100) / 100;
  const target = Math.max(1, Math.min(100, targetPercentage));
  const isSafe = currentPercentage >= target;

  // If already at or above target
  if (isSafe) {
    // How many classes can be safely skipped while staying >= target?
    // Formula: (attended) / (total + M) >= target / 100 => M <= (100 * attended - target * total) / target
    const maxBunkable = target > 0
      ? Math.max(0, Math.floor((100 * attendedClasses - target * totalClasses) / target))
      : 0;

    return {
      currentPercentage,
      isSafe: true,
      message: "You're already above your target.",
      maxBunkableClasses: maxBunkable,
      classesNeededForTarget: 0,
      explanation: `Current Attendance: ${attendedClasses}/${totalClasses} (${currentPercentage}%). Target: ${target}%. You can safely miss up to ${maxBunkable} upcoming class${maxBunkable === 1 ? "" : "es"} and still stay above your target.`,
    };
  }

  // Below target: calculate how many consecutive classes need to be attended
  // Formula: N = ceil((target * total - 100 * attended) / (100 - target))
  if (target >= 100) {
    return {
      currentPercentage,
      isSafe: false,
      message: "A 100% attendance target cannot be reached if any class has been missed.",
      classesNeededForTarget: undefined,
      explanation: `Since ${totalClasses - attendedClasses} class${totalClasses - attendedClasses === 1 ? " has" : "es have"} already been missed, mathematical 100% is no longer possible.`,
    };
  }

  const numerator = target * totalClasses - 100 * attendedClasses;
  const denominator = 100 - target;
  const needed = Math.ceil(numerator / denominator);

  return {
    currentPercentage,
    isSafe: false,
    message: `You need to attend approximately ${needed} more consecutive class${needed === 1 ? "" : "es"} to reach ${target}%.`,
    classesNeededForTarget: Math.max(0, needed),
    maxBunkableClasses: 0,
    explanation: `Current Attendance: ${attendedClasses}/${totalClasses} (${currentPercentage}%). Target: ${target}%. To reach ${target}%, you must attend the next ${needed} class${needed === 1 ? "" : "es"} without missing any.`,
  };
}
