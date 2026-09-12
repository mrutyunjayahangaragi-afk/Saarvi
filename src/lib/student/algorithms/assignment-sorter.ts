import { Assignment, PriorityLevel } from "@/types/student";
import { getDaysDifferenceFromToday } from "../date-utils";

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Multi-Criteria Deterministic Assignment Sorter.
 *
 * Problem: Rank assignments to highlight urgent deadlines while keeping remaining tasks organized.
 *
 * Tier Hierarchy:
 * 1. Incomplete & Overdue (daysDiff < 0) — sorted by most overdue first (earliest date)
 * 2. Incomplete & Due Today (daysDiff === 0) — sorted by highest priority
 * 3. Incomplete & Due Soon / Upcoming (daysDiff > 0) — sorted by nearest deadline first, then priority
 * 4. Completed (status === "completed") — sorted by most recently due
 *
 * Complexity:
 * - Time: O(N log N) using stable JavaScript array sort.
 * - Space: O(1) auxiliary space (in-place on shallow copy).
 */
export function sortAssignmentsMultiCriteria(assignments: Assignment[]): Assignment[] {
  if (!assignments || assignments.length <= 1) {
    return assignments ? [...assignments] : [];
  }

  return [...assignments].sort((a, b) => {
    const isCompletedA = a.status === "completed";
    const isCompletedB = b.status === "completed";

    // Completed always goes to bottom
    if (isCompletedA !== isCompletedB) {
      return isCompletedA ? 1 : -1;
    }

    // Both completed: sort by dueDate descending
    if (isCompletedA && isCompletedB) {
      return b.dueDate.localeCompare(a.dueDate);
    }

    // Both incomplete: evaluate urgency tiers
    const diffA = getDaysDifferenceFromToday(a.dueDate);
    const diffB = getDaysDifferenceFromToday(b.dueDate);

    const isOverdueA = diffA < 0;
    const isOverdueB = diffB < 0;

    // Overdue items go to the very top
    if (isOverdueA !== isOverdueB) {
      return isOverdueA ? -1 : 1;
    }

    // If both overdue: earliest overdue date first
    if (isOverdueA && isOverdueB) {
      return a.dueDate.localeCompare(b.dueDate);
    }

    // If both upcoming: nearest deadline first
    if (diffA !== diffB) {
      return diffA - diffB;
    }

    // Tie-breaker: highest priority first
    const weightA = PRIORITY_WEIGHT[a.priority] || 1;
    const weightB = PRIORITY_WEIGHT[b.priority] || 1;
    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // Final tie-breaker: title alphabetical
    return a.title.localeCompare(b.title);
  });
}
