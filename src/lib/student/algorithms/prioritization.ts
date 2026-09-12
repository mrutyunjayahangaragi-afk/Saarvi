import { StudyTask, PriorityLevel } from "@/types/student";
import { getDaysDifferenceFromToday, timeStringToMinutes } from "../date-utils";

const PRIORITY_SCORE_BASE: Record<PriorityLevel, number> = {
  high: 40,
  medium: 25,
  low: 10,
};

export interface TaskPriorityScore {
  totalScore: number;
  priorityBase: number;
  proximityBonus: number;
  durationFactor: number;
  explanation: string;
}

/**
 * Deterministic Task Prioritization Engine.
 *
 * Scoring Formula:
 * - Base Priority: High (40), Medium (25), Low (10)
 * - Proximity Factor:
 *     - Today (diff === 0): +30
 *     - Tomorrow (diff === 1): +20
 *     - Within 3 days (diff <= 3): +10
 *     - Overdue (diff < 0): +35
 * - Duration Factor: min(15, floor(durationMinutes / 15) * 2)
 *
 * Completed tasks always receive score 0.
 */
export function calculateTaskPriorityScore(task: StudyTask): TaskPriorityScore {
  if (task.completed) {
    return {
      totalScore: 0,
      priorityBase: 0,
      proximityBonus: 0,
      durationFactor: 0,
      explanation: "Task completed",
    };
  }

  const priorityBase = PRIORITY_SCORE_BASE[task.priority] || 10;
  const diffDays = getDaysDifferenceFromToday(task.date);

  let proximityBonus = 0;
  if (diffDays < 0) {
    proximityBonus = 35; // overdue
  } else if (diffDays === 0) {
    proximityBonus = 30; // today
  } else if (diffDays === 1) {
    proximityBonus = 20; // tomorrow
  } else if (diffDays <= 3) {
    proximityBonus = 10;
  }

  const durationFactor = Math.min(15, Math.floor((task.durationMinutes || 60) / 15) * 2);
  const totalScore = priorityBase + proximityBonus + durationFactor;

  return {
    totalScore,
    priorityBase,
    proximityBonus,
    durationFactor,
    explanation: `Base (${priorityBase}) + Proximity (${proximityBonus}) + Duration (${durationFactor}) = ${totalScore}`,
  };
}

/**
 * Sorts study tasks deterministically using their priority score and chronological schedule.
 */
export function sortStudyTasksByPriority(tasks: StudyTask[]): StudyTask[] {
  if (!tasks || tasks.length <= 1) return tasks ? [...tasks] : [];

  return [...tasks].sort((a, b) => {
    // Completed tasks to the bottom
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    if (a.completed && b.completed) {
      return b.date.localeCompare(a.date);
    }

    // Both incomplete: score descending
    const scoreA = calculateTaskPriorityScore(a).totalScore;
    const scoreB = calculateTaskPriorityScore(b).totalScore;

    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    // Tie-breaker: date ascending
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;

    // Tie-breaker: start time ascending
    return timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime);
  });
}
