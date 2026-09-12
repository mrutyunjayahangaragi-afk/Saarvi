import {
  StudySession,
  Assignment,
  ExamRecord,
  TaskItem,
  TimetableEntry,
  InternshipApplication,
} from "@/types/student";
import { AttendanceRecord } from "@/lib/academic/types";
import { getTodayDateString, parseLocalDate } from "../date-utils";
import { calculateDaysRemaining } from "./deadline-engine";
import { detectIntervalConflicts, detectCrossActivityConflicts } from "./conflict-detector";

export interface StudyHoursSummary {
  todayHours: number;
  thisWeekHours: number;
  thisMonthHours: number;
  totalCompletedSessions: number;
}

/**
 * Returns Monday of the week containing the given date.
 */
function getStartOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  // day 0 is Sunday. In Monday-first week, diff is (day === 0 ? -6 : 1 - day)
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Returns Sunday of the week containing the given date.
 */
function getEndOfWeek(d: Date): Date {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Calculates real completed study hours for today, this week, and this month.
 * Only accounts for sessions with status === "COMPLETED".
 */
export function calculateStudyHours(
  sessions: StudySession[],
  baseDateStr?: string
): StudyHoursSummary {
  const baseStr = baseDateStr || getTodayDateString();
  const baseDate = parseLocalDate(baseStr);
  const startOfWeek = getStartOfWeek(baseDate);
  const endOfWeek = getEndOfWeek(baseDate);
  const baseYear = baseDate.getFullYear();
  const baseMonth = baseDate.getMonth();

  let todayMinutes = 0;
  let weekMinutes = 0;
  let monthMinutes = 0;
  let totalCompletedSessions = 0;

  for (const s of sessions) {
    if (s.status !== "COMPLETED") continue;
    const dur = typeof s.durationMinutes === "number" && s.durationMinutes > 0 ? s.durationMinutes : 60;
    totalCompletedSessions++;

    if (s.date === baseStr) {
      todayMinutes += dur;
    }

    const sessionDate = parseLocalDate(s.date);
    if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
      weekMinutes += dur;
    }

    if (sessionDate.getFullYear() === baseYear && sessionDate.getMonth() === baseMonth) {
      monthMinutes += dur;
    }
  }

  const roundHours = (mins: number) => Math.round((mins / 60) * 10) / 10;

  return {
    todayHours: roundHours(todayMinutes),
    thisWeekHours: roundHours(weekMinutes),
    thisMonthHours: roundHours(monthMinutes),
    totalCompletedSessions,
  };
}

export interface WorkspaceInsight {
  id: string;
  type: "deadline" | "exam" | "attendance" | "conflict" | "study" | "career";
  level: "info" | "warning" | "success" | "critical";
  message: string;
  actionRoute?: string;
  actionText?: string;
}

/**
 * Generates deterministic insights from actual student records (No AI).
 */
export function generateWorkspaceInsights(data: {
  assignments?: Assignment[];
  exams?: ExamRecord[];
  tasks?: TaskItem[];
  timetable?: TimetableEntry[];
  studySessions?: StudySession[];
  attendance?: AttendanceRecord[];
  internships?: InternshipApplication[];
  baseDateStr?: string;
}): WorkspaceInsight[] {
  const insights: WorkspaceInsight[] = [];
  const baseStr = data.baseDateStr || getTodayDateString();

  // 1. Assignments Due This Week or Overdue
  if (data.assignments && data.assignments.length > 0) {
    const incomplete = data.assignments.filter((a) => a.status !== "completed" && a.status !== "submitted");
    const overdue = incomplete.filter((a) => calculateDaysRemaining(a.dueDate, baseStr) < 0);
    const dueThisWeek = incomplete.filter((a) => {
      const diff = calculateDaysRemaining(a.dueDate, baseStr);
      return diff >= 0 && diff <= 7;
    });

    if (overdue.length > 0) {
      insights.push({
        id: "insight_overdue_asgns",
        type: "deadline",
        level: "critical",
        message: `You have ${overdue.length} overdue assignment${overdue.length === 1 ? "" : "s"}.`,
        actionRoute: "/student/assignment-planner",
        actionText: "View Assignments",
      });
    } else if (dueThisWeek.length > 0) {
      insights.push({
        id: "insight_week_asgns",
        type: "deadline",
        level: "warning",
        message: `You have ${dueThisWeek.length} assignment${dueThisWeek.length === 1 ? "" : "s"} due this week.`,
        actionRoute: "/student/assignment-planner",
        actionText: "Review Plan",
      });
    }
  }

  // 2. Upcoming Exams
  if (data.exams && data.exams.length > 0) {
    const upcomingExams = data.exams
      .map((e) => ({ ...e, days: calculateDaysRemaining(e.date, baseStr) }))
      .filter((e) => e.days >= 0)
      .sort((a, b) => a.days - b.days);

    if (upcomingExams.length > 0) {
      const nextExam = upcomingExams[0];
      const daysText =
        nextExam.days === 0
          ? "is today"
          : nextExam.days === 1
          ? "is tomorrow"
          : `is in ${nextExam.days} days`;

      insights.push({
        id: "insight_next_exam",
        type: "exam",
        level: nextExam.days <= 3 ? "critical" : "info",
        message: `Your next exam (${nextExam.subject} - ${nextExam.examType}) ${daysText}.`,
        actionRoute: "/student/exams",
        actionText: "Open Exam Planner",
      });
    }
  }

  // 3. Timetable & Schedule Conflicts
  if (data.timetable && data.timetable.length > 1) {
    const classItems = data.timetable.map((c) => ({
      id: c.id,
      title: c.subject,
      groupKey: c.day,
      startTime: c.startTime,
      endTime: c.endTime,
    }));
    const clashCheck = detectIntervalConflicts(classItems);
    if (clashCheck.hasAnyConflict) {
      insights.push({
        id: "insight_timetable_clash",
        type: "conflict",
        level: "warning",
        message: "You have overlapping classes detected in your weekly timetable.",
        actionRoute: "/student/timetable",
        actionText: "Fix Timetable",
      });
    }
  }

  // Cross activity clash check (study vs class)
  if (data.timetable && data.studySessions && data.timetable.length > 0 && data.studySessions.length > 0) {
    const activeSessions = data.studySessions.filter((s) => s.status === "PLANNED" || s.status === "IN_PROGRESS");
    const crossClashes = detectCrossActivityConflicts(
      data.timetable.map((t) => ({ id: t.id, subject: t.subject, day: t.day, startTime: t.startTime, endTime: t.endTime })),
      activeSessions.map((s) => ({ id: s.id, subject: s.subject, date: s.date, startTime: s.startTime, durationMinutes: s.durationMinutes })),
      data.exams ? data.exams.map((e) => ({ id: e.id, subject: e.subject, date: e.date, time: e.time })) : []
    );
    if (crossClashes.length > 0) {
      insights.push({
        id: "insight_cross_clash",
        type: "conflict",
        level: "warning",
        message: `Schedule conflict: ${crossClashes[0].reason}`,
        actionRoute: "/student/study-planner",
        actionText: "Adjust Schedule",
      });
    }
  }

  // 4. Attendance Alerts
  if (data.attendance && data.attendance.length > 0) {
    const criticalSubjects = data.attendance.filter(
      (a) => a.totalClasses > 0 && a.currentPercentage < 75
    );
    if (criticalSubjects.length > 0) {
      insights.push({
        id: "insight_attendance_warning",
        type: "attendance",
        level: "critical",
        message: `Attendance warning: ${criticalSubjects.length} subject${
          criticalSubjects.length === 1 ? "" : "s"
        } below 75% threshold.`,
        actionRoute: "/student/attendance",
        actionText: "Check Attendance",
      });
    }
  }

  // 5. Study Productivity Positive Feedback
  if (data.studySessions && data.studySessions.length > 0) {
    const summary = calculateStudyHours(data.studySessions, baseStr);
    if (summary.thisWeekHours >= 5) {
      insights.push({
        id: "insight_study_progress",
        type: "study",
        level: "success",
        message: `Great focus! You've logged ${summary.thisWeekHours} study hours this week.`,
        actionRoute: "/student/study-planner",
        actionText: "Study Planner",
      });
    }
  }

  // 6. Career Application Follow-Ups
  if (data.internships && data.internships.length > 0) {
    const pendingInterviews = data.internships.filter((i) => i.status === "interview");
    if (pendingInterviews.length > 0) {
      insights.push({
        id: "insight_internship_interview",
        type: "career",
        level: "info",
        message: `You have ${pendingInterviews.length} active interview pipeline${
          pendingInterviews.length === 1 ? "" : "s"
        }.`,
        actionRoute: "/student/internships",
        actionText: "View Pipeline",
      });
    }
  }

  return insights;
}
