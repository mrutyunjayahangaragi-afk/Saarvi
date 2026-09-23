/**
 * Saarvi Smart Academic Calendar — Unified Event Model & Conflict Engine
 *
 * Implements:
 * 1. Deterministic Calendar Event Model with TypeScript Discriminated Unions
 * 2. Interval-Overlap Sweep-Line Conflict Detection (O(N log N))
 * 3. Dynamic Recurrence Rule Expansion (Daily, Weekly, Monthly, Semester)
 * 4. RFC 5545 Compliant iCalendar (.ics) Exporter
 * 5. Timetable <-> Calendar Synchronization
 */

import { detectIntervalConflicts, type TimeIntervalItem, type IntervalConflictResult } from "../student/algorithms/conflict-detector.ts";
import type { TimetableEntry } from "../../types/student.ts";

export type CalendarEventType =
  | "academic"
  | "job_deadline"
  | "internship_deadline"
  | "assignment"
  | "exam"
  | "study_session"
  | "interview"
  | "application_followup"
  | "scholarship_deadline"
  | "reminder";

export type CalendarEventSource = "timetable" | "manual" | "career" | "academic" | "system";
export type CalendarEventPriority = "low" | "medium" | "high";
export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled" | "completed";

export interface EventRecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "semester";
  interval?: number; // e.g., every 1 week
  daysOfWeek?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  until?: string; // YYYY-MM-DD
  count?: number;
}

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  description?: string;
  startAt: string; // ISO 8601 string (e.g., 2026-09-24T09:00:00.000Z or local YYYY-MM-DDTHH:mm:ss)
  endAt: string;   // ISO 8601 string
  allDay: boolean;
  location?: string;
  source: CalendarEventSource;
  priority: CalendarEventPriority;
  status: CalendarEventStatus;
  linkedEntityId?: string; // e.g. timetable entry ID, job application ID, assignment ID
  recurrenceRule?: EventRecurrenceRule;
  reminderMinutesBefore?: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpandedCalendarEventInstance {
  instanceId: string;
  masterEventId: string;
  event: CalendarEvent;
  startAt: Date;
  endAt: Date;
  isRecurringInstance: boolean;
}

export const EVENT_TYPE_METADATA: Record<
  CalendarEventType,
  { label: string; color: string; bgClass: string; borderClass: string; textClass: string; icon: string }
> = {
  academic: {
    label: "Class / Lecture",
    color: "#2563eb",
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
    borderClass: "border-blue-200 dark:border-blue-800",
    textClass: "text-blue-700 dark:text-blue-300",
    icon: "GraduationCap",
  },
  job_deadline: {
    label: "Job Deadline",
    color: "#dc2626",
    bgClass: "bg-red-50 dark:bg-red-950/40",
    borderClass: "border-red-200 dark:border-red-800",
    textClass: "text-red-700 dark:text-red-300",
    icon: "Briefcase",
  },
  internship_deadline: {
    label: "Internship Deadline",
    color: "#ea580c",
    bgClass: "bg-orange-50 dark:bg-orange-950/40",
    borderClass: "border-orange-200 dark:border-orange-800",
    textClass: "text-orange-700 dark:text-orange-300",
    icon: "Sparkles",
  },
  assignment: {
    label: "Assignment",
    color: "#d97706",
    bgClass: "bg-amber-50 dark:bg-amber-950/40",
    borderClass: "border-amber-200 dark:border-amber-800",
    textClass: "text-amber-700 dark:text-amber-300",
    icon: "FileText",
  },
  exam: {
    label: "Exam",
    color: "#9333ea",
    bgClass: "bg-purple-50 dark:bg-purple-950/40",
    borderClass: "border-purple-200 dark:border-purple-800",
    textClass: "text-purple-700 dark:text-purple-300",
    icon: "Award",
  },
  study_session: {
    label: "Study Session",
    color: "#0891b2",
    bgClass: "bg-cyan-50 dark:bg-cyan-950/40",
    borderClass: "border-cyan-200 dark:border-cyan-800",
    textClass: "text-cyan-700 dark:text-cyan-300",
    icon: "BookOpen",
  },
  interview: {
    label: "Interview",
    color: "#059669",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    textClass: "text-emerald-700 dark:text-emerald-300",
    icon: "Video",
  },
  application_followup: {
    label: "Application Follow-up",
    color: "#4f46e5",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/40",
    borderClass: "border-indigo-200 dark:border-indigo-800",
    textClass: "text-indigo-700 dark:text-indigo-300",
    icon: "Clock",
  },
  scholarship_deadline: {
    label: "Scholarship Deadline",
    color: "#0d9488",
    bgClass: "bg-teal-50 dark:bg-teal-950/40",
    borderClass: "border-teal-200 dark:border-teal-800",
    textClass: "text-teal-700 dark:text-teal-300",
    icon: "Trophy",
  },
  reminder: {
    label: "Reminder",
    color: "#64748b",
    bgClass: "bg-slate-50 dark:bg-slate-900/40",
    borderClass: "border-slate-200 dark:border-slate-700",
    textClass: "text-slate-700 dark:text-slate-300",
    icon: "Bell",
  },
};

/**
 * Expand recurring events within a designated date window [windowStart, windowEnd].
 * Prevents allocating thousands of database records while supporting weekly/daily classes.
 */
export function expandEventsForWindow(
  events: CalendarEvent[],
  windowStart: Date,
  windowEnd: Date
): ExpandedCalendarEventInstance[] {
  const instances: ExpandedCalendarEventInstance[] = [];

  for (const event of events) {
    const origStart = new Date(event.startAt);
    const origEnd = new Date(event.endAt);
    const durationMs = Math.max(15 * 60 * 1000, origEnd.getTime() - origStart.getTime());

    // Non-recurring event
    if (!event.recurrenceRule) {
      if (origEnd >= windowStart && origStart <= windowEnd) {
        instances.push({
          instanceId: event.id,
          masterEventId: event.id,
          event,
          startAt: origStart,
          endAt: origEnd,
          isRecurringInstance: false,
        });
      }
      continue;
    }

    // Recurring rule expansion
    const rule = event.recurrenceRule;
    const ruleUntil = rule.until ? new Date(rule.until) : null;
    if (ruleUntil) {
      ruleUntil.setHours(23, 59, 59, 999);
    }

    const effectiveEnd = ruleUntil && ruleUntil < windowEnd ? ruleUntil : windowEnd;
    let cursor = new Date(origStart);

    let instanceCount = 0;
    const maxInstances = rule.count || 1000;

    while (cursor <= effectiveEnd && instanceCount < maxInstances) {
      const cursorEnd = new Date(cursor.getTime() + durationMs);

      let matchesFrequency = false;

      if (rule.frequency === "daily") {
        matchesFrequency = true;
      } else if (rule.frequency === "weekly" || rule.frequency === "semester") {
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          matchesFrequency = rule.daysOfWeek.includes(cursor.getDay());
        } else {
          matchesFrequency = cursor.getDay() === origStart.getDay();
        }
      } else if (rule.frequency === "monthly") {
        matchesFrequency = cursor.getDate() === origStart.getDate();
      }

      if (matchesFrequency && cursorEnd >= windowStart && cursor <= effectiveEnd) {
        const dateKey = cursor.toISOString().split("T")[0];
        instances.push({
          instanceId: `${event.id}_${dateKey}`,
          masterEventId: event.id,
          event,
          startAt: new Date(cursor),
          endAt: cursorEnd,
          isRecurringInstance: cursor.getTime() !== origStart.getTime(),
        });
        instanceCount++;
      }

      // Advance cursor
      if (rule.frequency === "daily") {
        cursor.setDate(cursor.getDate() + (rule.interval || 1));
      } else if (rule.frequency === "weekly" || rule.frequency === "semester") {
        cursor.setDate(cursor.getDate() + 1);
      } else if (rule.frequency === "monthly") {
        cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
      } else {
        break;
      }
    }
  }

  return instances.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/**
 * Detect interval conflicts among calendar event instances using O(N log N) sweep-line detector.
 */
export function detectCalendarConflicts(instances: ExpandedCalendarEventInstance[]): IntervalConflictResult {
  const items: TimeIntervalItem[] = instances
    .filter((inst) => !inst.event.allDay && inst.event.status !== "cancelled")
    .map((inst) => {
      const year = inst.startAt.getFullYear();
      const month = String(inst.startAt.getMonth() + 1).padStart(2, "0");
      const day = String(inst.startAt.getDate()).padStart(2, "0");
      const groupKey = `${year}-${month}-${day}`;

      const startHours = String(inst.startAt.getHours()).padStart(2, "0");
      const startMins = String(inst.startAt.getMinutes()).padStart(2, "0");
      const startTime = `${startHours}:${startMins}`;

      const endHours = String(inst.endAt.getHours()).padStart(2, "0");
      const endMins = String(inst.endAt.getMinutes()).padStart(2, "0");
      const endTime = `${endHours}:${endMins}`;

      return {
        id: inst.instanceId,
        title: inst.event.title,
        groupKey,
        startTime,
        endTime,
      };
    });

  return detectIntervalConflicts(items);
}

/**
 * Convert Timetable entries to Semester-Recurring Calendar Events.
 * Preserves deterministic timetable sync without duplicating database rows.
 */
export const DAY_NAME_TO_INT: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function syncTimetableToCalendarEvents(
  timetableEntries: TimetableEntry[],
  existingEvents: CalendarEvent[],
  semesterEndDate?: string
): CalendarEvent[] {
  // 1. Keep all non-timetable events intact
  const manualEvents = existingEvents.filter((e) => e.source !== "timetable");

  // 2. Generate recurring events for each timetable entry
  const now = new Date();
  const defaultUntil = semesterEndDate || new Date(now.getFullYear(), now.getMonth() + 6, 1).toISOString().split("T")[0];

  const generatedEvents: CalendarEvent[] = timetableEntries.map((entry) => {
    const dayInt = DAY_NAME_TO_INT[entry.day] ?? 1;

    // Find next occurrence of that weekday starting from beginning of current week
    const targetDate = new Date(now);
    const currentDay = targetDate.getDay();
    const diff = (dayInt - currentDay + 7) % 7;
    targetDate.setDate(targetDate.getDate() + diff);

    const [startH, startM] = entry.startTime.split(":").map(Number);
    const [endH, endM] = entry.endTime.split(":").map(Number);

    const startAt = new Date(targetDate);
    startAt.setHours(startH || 9, startM || 0, 0, 0);

    const endAt = new Date(targetDate);
    endAt.setHours(endH || 10, endM || 30, 0, 0);

    return {
      id: `cal_tt_${entry.id}`,
      type: "academic",
      title: entry.subject,
      description: entry.notes || `${entry.type || "Class"} ${entry.teacher ? `with ${entry.teacher}` : ""}`,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: false,
      location: entry.room || undefined,
      source: "timetable",
      priority: "medium",
      status: "confirmed",
      linkedEntityId: entry.id,
      recurrenceRule: {
        frequency: "weekly",
        daysOfWeek: [dayInt],
        until: defaultUntil,
      },
      reminderMinutesBefore: 15,
      color: "#2563eb",
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  return [...manualEvents, ...generatedEvents];
}

/**
 * Generate RFC 5545 compliant iCalendar (.ics) string.
 * Generates a valid calendar file purely client-side without cloud upload.
 */
export function generateIcsCalendar(events: CalendarEvent[], calendarTitle = "Saarvi Academic Calendar"): string {
  const formatUtcDate = (d: Date): string => {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const escapeIcsText = (str: string): string => {
    return (str || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Saarvi//Smart Academic Calendar 2.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarTitle)}`,
    "X-WR-TIMEZONE:Asia/Kolkata",
  ];

  for (const event of events) {
    if (event.status === "cancelled") continue;

    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const now = new Date();

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@saarvi.app`);
    lines.push(`DTSTAMP:${formatUtcDate(now)}`);

    if (event.allDay) {
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, "0");
      const d = String(start.getDate()).padStart(2, "0");
      lines.push(`DTSTART;VALUE=DATE:${y}${m}${d}`);

      const nextDay = new Date(start);
      nextDay.setDate(nextDay.getDate() + 1);
      const ey = nextDay.getFullYear();
      const em = String(nextDay.getMonth() + 1).padStart(2, "0");
      const ed = String(nextDay.getDate()).padStart(2, "0");
      lines.push(`DTEND;VALUE=DATE:${ey}${em}${ed}`);
    } else {
      lines.push(`DTSTART:${formatUtcDate(start)}`);
      lines.push(`DTEND:${formatUtcDate(end)}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    if (event.recurrenceRule) {
      const rule = event.recurrenceRule;
      let rrule = `RRULE:FREQ=${rule.frequency.toUpperCase()}`;
      if (rule.interval && rule.interval > 1) {
        rrule += `;INTERVAL=${rule.interval}`;
      }
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const dayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        const byDay = rule.daysOfWeek.map((d) => dayMap[d]).join(",");
        rrule += `;BYDAY=${byDay}`;
      }
      if (rule.until) {
        const u = new Date(rule.until);
        u.setHours(23, 59, 59, 0);
        rrule += `;UNTIL=${formatUtcDate(u)}`;
      }
      lines.push(rrule);
    }

    // Alarm reminder
    if (event.reminderMinutesBefore && event.reminderMinutesBefore > 0) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeIcsText(event.title)}`);
      lines.push(`TRIGGER:-PT${event.reminderMinutesBefore}M`);
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}
