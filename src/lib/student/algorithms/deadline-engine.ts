import {
  UnifiedDeadline,
  DeadlineUrgency,
  Assignment,
  ExamRecord,
  TaskItem,
  StudentGoal,
  InternshipApplication,
  HackathonRecord,
} from "@/types/student";
import { getTodayDateString, parseLocalDate } from "../date-utils";

/**
 * Calculates calendar day difference between a target date string and base date.
 * If baseDateStr is omitted, today's local date is used.
 * Negative = overdue / past
 * 0 = today
 * 1 = tomorrow
 * > 1 = future days
 */
export function calculateDaysRemaining(targetDateStr: string, baseDateStr?: string): number {
  if (!targetDateStr) return 0;
  const target = parseLocalDate(targetDateStr);
  const base = parseLocalDate(baseDateStr || getTodayDateString());
  const diffMs = target.getTime() - base.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Deterministic countdown text generator.
 * Formats remaining time dynamically without storing static numbers.
 */
export function formatCountdownText(targetDateStr: string, baseDateStr?: string): string {
  const diff = calculateDaysRemaining(targetDateStr, baseDateStr);

  if (diff < 0) {
    const abs = Math.abs(diff);
    return abs === 1 ? "Overdue by 1 day" : `Overdue by ${abs} days`;
  }
  if (diff === 0) {
    return "Due today";
  }
  if (diff === 1) {
    return "Tomorrow";
  }
  if (diff <= 6) {
    return `${diff} days remaining`;
  }
  if (diff <= 13) {
    return "In 1 week";
  }
  if (diff <= 27) {
    const weeks = Math.round(diff / 7);
    return `In ${weeks} weeks`;
  }
  const months = Math.max(1, Math.round(diff / 30));
  return months === 1 ? "In 1 month" : `In ${months} months`;
}

/**
 * Classifies target date into one of the 5 canonical urgency tiers:
 * - overdue (< 0 days)
 * - today (0 days)
 * - tomorrow (1 day)
 * - this_week (2 to 7 days)
 * - later (> 7 days)
 */
export function classifyDeadlineUrgency(targetDateStr: string, baseDateStr?: string): DeadlineUrgency {
  const diff = calculateDaysRemaining(targetDateStr, baseDateStr);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "this_week";
  return "later";
}

const PRIORITY_MAP: Record<string, number> = {
  high: 3,
  HIGH: 3,
  medium: 2,
  MEDIUM: 2,
  low: 1,
  LOW: 1,
};

export interface MultiEntityDeadlineInput {
  assignments?: Assignment[];
  exams?: ExamRecord[];
  tasks?: TaskItem[];
  goals?: StudentGoal[];
  internships?: InternshipApplication[];
  hackathons?: HackathonRecord[];
  baseDateStr?: string;
}

/**
 * Aggregates all student entities with deadlines into a unified list.
 * Applies deterministic sorting:
 * 1. Incomplete items before completed items
 * 2. Overdue items by earliest date first
 * 3. Upcoming items by nearest date first, then time, then priority
 */
export function aggregateDeadlines(input: MultiEntityDeadlineInput): UnifiedDeadline[] {
  const baseDate = input.baseDateStr || getTodayDateString();
  const list: UnifiedDeadline[] = [];

  // 1. Assignments
  if (input.assignments) {
    for (const a of input.assignments) {
      if (!a.dueDate) continue;
      const days = calculateDaysRemaining(a.dueDate, baseDate);
      const isCompleted = a.status === "completed" || a.status === "submitted";
      list.push({
        id: `deadline_asgn_${a.id}`,
        sourceId: a.id,
        sourceType: "Assignment",
        title: a.title,
        subtitle: a.subject,
        subjectId: a.subjectId,
        targetDate: a.dueDate,
        priority: a.priority,
        urgency: classifyDeadlineUrgency(a.dueDate, baseDate),
        countdownText: formatCountdownText(a.dueDate, baseDate),
        daysRemaining: days,
        isCompleted,
        route: "/student/assignment-planner",
      });
    }
  }

  // 2. Exams
  if (input.exams) {
    for (const e of input.exams) {
      if (!e.date) continue;
      const days = calculateDaysRemaining(e.date, baseDate);
      const isPast = days < 0;
      list.push({
        id: `deadline_exam_${e.id}`,
        sourceId: e.id,
        sourceType: "Exam",
        title: `${e.subject} (${e.examType})`,
        subtitle: e.location ? `Room: ${e.location}` : e.time ? `Time: ${e.time}` : "Exam",
        subjectId: e.subjectId,
        targetDate: e.date,
        targetTime: e.time,
        priority: "high",
        urgency: classifyDeadlineUrgency(e.date, baseDate),
        countdownText: formatCountdownText(e.date, baseDate),
        daysRemaining: days,
        isCompleted: isPast,
        route: "/student/exams",
      });
    }
  }

  // 3. Tasks
  if (input.tasks) {
    for (const t of input.tasks) {
      if (!t.dueDate) continue;
      const days = calculateDaysRemaining(t.dueDate, baseDate);
      const isCompleted = t.status === "COMPLETED" || t.status === "CANCELLED";
      const prio = (t.priority?.toLowerCase() as "low" | "medium" | "high") || "medium";
      list.push({
        id: `deadline_task_${t.id}`,
        sourceId: t.id,
        sourceType: "Task",
        title: t.title,
        subtitle: t.category || "Task",
        subjectId: t.subjectId,
        targetDate: t.dueDate,
        targetTime: t.dueTime,
        priority: prio,
        urgency: classifyDeadlineUrgency(t.dueDate, baseDate),
        countdownText: formatCountdownText(t.dueDate, baseDate),
        daysRemaining: days,
        isCompleted,
        route: "/student/tasks",
      });
    }
  }

  // 4. Goals
  if (input.goals) {
    for (const g of input.goals) {
      if (!g.targetDate) continue;
      const days = calculateDaysRemaining(g.targetDate, baseDate);
      const isCompleted = g.status === "COMPLETED" || g.status === "CANCELLED";
      list.push({
        id: `deadline_goal_${g.id}`,
        sourceId: g.id,
        sourceType: "Goal",
        title: g.title,
        subtitle: `${g.category} Goal (${g.progress}% completed)`,
        targetDate: g.targetDate,
        priority: "medium",
        urgency: classifyDeadlineUrgency(g.targetDate, baseDate),
        countdownText: formatCountdownText(g.targetDate, baseDate),
        daysRemaining: days,
        isCompleted,
        route: "/student/goals",
      });
    }
  }

  // 5. Internships
  if (input.internships) {
    for (const i of input.internships) {
      if (!i.deadline) continue;
      const days = calculateDaysRemaining(i.deadline, baseDate);
      const isCompleted = i.status === "rejected" || i.status === "withdrawn" || i.status === "offer";
      list.push({
        id: `deadline_intern_${i.id}`,
        sourceId: i.id,
        sourceType: "Internship",
        title: `${i.company} Application Deadline`,
        subtitle: i.role,
        targetDate: i.deadline,
        priority: "high",
        urgency: classifyDeadlineUrgency(i.deadline, baseDate),
        countdownText: formatCountdownText(i.deadline, baseDate),
        daysRemaining: days,
        isCompleted,
        route: "/student/internships",
      });
    }
  }

  // 6. Hackathons
  if (input.hackathons) {
    for (const h of input.hackathons) {
      const regDeadline = h.registrationDeadline || h.startDate;
      if (!regDeadline) continue;
      const days = calculateDaysRemaining(regDeadline, baseDate);
      const isCompleted = h.status === "completed" || h.status === "did_not_participate";
      list.push({
        id: `deadline_hack_${h.id}`,
        sourceId: h.id,
        sourceType: "Hackathon",
        title: `${h.name} Registration`,
        subtitle: h.organizer,
        targetDate: regDeadline,
        priority: "medium",
        urgency: classifyDeadlineUrgency(regDeadline, baseDate),
        countdownText: formatCountdownText(regDeadline, baseDate),
        daysRemaining: days,
        isCompleted,
        route: "/student/hackathons",
      });
    }
  }

  // Deterministic sorting
  list.sort((a, b) => {
    // Completed items at the bottom
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }

    // Overdue items first
    const isOverdueA = a.daysRemaining < 0;
    const isOverdueB = b.daysRemaining < 0;
    if (isOverdueA !== isOverdueB) {
      return isOverdueA ? -1 : 1;
    }

    // Date ascending
    const dateCmp = a.targetDate.localeCompare(b.targetDate);
    if (dateCmp !== 0) return dateCmp;

    // Time ascending if present
    if (a.targetTime && b.targetTime) {
      const timeCmp = a.targetTime.localeCompare(b.targetTime);
      if (timeCmp !== 0) return timeCmp;
    } else if (a.targetTime && !b.targetTime) {
      return -1;
    } else if (!a.targetTime && b.targetTime) {
      return 1;
    }

    // Priority descending
    const prioA = PRIORITY_MAP[a.priority] || 1;
    const prioB = PRIORITY_MAP[b.priority] || 1;
    if (prioA !== prioB) {
      return prioB - prioA;
    }

    // Title alphabetical
    return a.title.localeCompare(b.title);
  });

  return list;
}

/**
 * Groups a list of unified deadlines by their urgency tier.
 */
export function groupDeadlinesByUrgency(
  deadlines: UnifiedDeadline[]
): Record<DeadlineUrgency, UnifiedDeadline[]> {
  const result: Record<DeadlineUrgency, UnifiedDeadline[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
  };

  for (const d of deadlines) {
    if (!d.isCompleted) {
      result[d.urgency].push(d);
    }
  }

  return result;
}
