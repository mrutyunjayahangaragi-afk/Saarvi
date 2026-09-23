import { timeStringToMinutes, minutesToTimeString } from "../date-utils.ts";

export interface TimeIntervalItem {
  id: string;
  title: string;
  groupKey: string; // e.g. date "2026-09-15" or day "Monday"
  startTime: string; // "HH:MM" e.g. "19:00"
  endTime?: string; // "HH:MM" e.g. "20:30"
  durationMinutes?: number; // e.g. 90
}

export interface ConflictDetail {
  conflictingId: string;
  conflictingTitle: string;
  timeRange: string;
  overlapMinutes: number;
}

export interface IntervalConflictResult {
  hasAnyConflict: boolean;
  conflictingIds: Set<string>;
  conflictMap: Map<string, ConflictDetail[]>;
}

/**
 * Interval-Overlap Conflict Detection Algorithm.
 *
 * Problem: Detect scheduling clashes among study sessions or timetable classes.
 * Approach:
 * 1. Partition events into buckets by day/date using Map (O(N)).
 * 2. In each bucket, sort intervals by start time (O(K log K) where K <= N).
 * 3. Linear sweep across sorted intervals to test overlap: max(startA, startB) < min(endA, endB) (O(K)).
 *
 * Complexity:
 * - Time: O(N log N) overall.
 * - Space: O(N) auxiliary space.
 */
export function detectIntervalConflicts(items: TimeIntervalItem[]): IntervalConflictResult {
  const conflictingIds = new Set<string>();
  const conflictMap = new Map<string, ConflictDetail[]>();

  if (!items || items.length <= 1) {
    return {
      hasAnyConflict: false,
      conflictingIds,
      conflictMap,
    };
  }

  // 1. Group by groupKey (date or day)
  const groups = new Map<string, Array<{ item: TimeIntervalItem; start: number; end: number }>>();

  for (const item of items) {
    const start = timeStringToMinutes(item.startTime);
    let end: number;

    if (item.endTime) {
      end = timeStringToMinutes(item.endTime);
    } else if (item.durationMinutes && item.durationMinutes > 0) {
      end = start + item.durationMinutes;
    } else {
      end = start + 60; // default 1 hour
    }

    // Wrap around or cap at midnight (1440 min)
    end = Math.min(1440, Math.max(start + 1, end));

    const key = item.groupKey.trim().toLowerCase();
    const list = groups.get(key) || [];
    list.push({ item, start, end });
    groups.set(key, list);
  }

  // 2. Process each group independently
  for (const [, groupItems] of groups.entries()) {
    if (groupItems.length <= 1) continue;

    // Stable sort by start time: O(K log K)
    groupItems.sort((a, b) => a.start - b.start);

    // O(K) sweep: check for pairwise overlaps
    for (let i = 0; i < groupItems.length; i++) {
      for (let j = i + 1; j < groupItems.length; j++) {
        const a = groupItems[i];
        const b = groupItems[j];

        // Since sorted by start: if next item starts at or after current item ends, no more overlaps with item i
        if (b.start >= a.end) {
          break;
        }

        // Overlap detected! [max(a.start, b.start), min(a.end, b.end)]
        const overlapStart = Math.max(a.start, b.start);
        const overlapEnd = Math.min(a.end, b.end);
        const overlapDuration = overlapEnd - overlapStart;

        if (overlapDuration > 0) {
          conflictingIds.add(a.item.id);
          conflictingIds.add(b.item.id);

          const timeRangeA = `${minutesToTimeString(a.start)} - ${minutesToTimeString(a.end)}`;
          const timeRangeB = `${minutesToTimeString(b.start)} - ${minutesToTimeString(b.end)}`;

          const listA = conflictMap.get(a.item.id) || [];
          listA.push({
            conflictingId: b.item.id,
            conflictingTitle: b.item.title,
            timeRange: timeRangeB,
            overlapMinutes: overlapDuration,
          });
          conflictMap.set(a.item.id, listA);

          const listB = conflictMap.get(b.item.id) || [];
          listB.push({
            conflictingId: a.item.id,
            conflictingTitle: a.item.title,
            timeRange: timeRangeA,
            overlapMinutes: overlapDuration,
          });
          conflictMap.set(b.item.id, listB);
        }
      }
    }
  }

  return {
    hasAnyConflict: conflictingIds.size > 0,
    conflictingIds,
    conflictMap,
  };
}

/**
 * Returns English day of week name (e.g. "Monday") for a given "YYYY-MM-DD" local date string.
 */
export function getDayNameFromDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return "";
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("en-US", { weekday: "long" });
  } catch {
    return "";
  }
}

export interface CrossConflictItem {
  id: string;
  type: "class" | "study" | "exam";
  title: string;
  dateStr?: string; // YYYY-MM-DD
  dayOfWeek?: string; // e.g. "Monday"
  startTime: string; // "HH:MM"
  endTime?: string; // "HH:MM"
  durationMinutes?: number;
}

export interface CrossConflictRecord {
  hasClash: boolean;
  itemA: CrossConflictItem;
  itemB: CrossConflictItem;
  reason: string;
  overlapMinutes: number;
}

/**
 * Detects clashes across different activity types (e.g. Study Session vs College Class, or Study Session vs Exam).
 */
export function detectCrossActivityConflicts(
  classes: Array<{ id: string; subject: string; day: string; startTime: string; endTime: string }>,
  studySessions: Array<{ id: string; subject: string; date: string; startTime: string; durationMinutes: number }>,
  exams: Array<{ id: string; subject: string; date: string; time?: string }> = []
): CrossConflictRecord[] {
  const clashes: CrossConflictRecord[] = [];

  // 1. Study Sessions vs Classes on the same weekday
  for (const session of studySessions) {
    const sessionDay = getDayNameFromDate(session.date);
    if (!sessionDay) continue;

    const sessionStart = timeStringToMinutes(session.startTime);
    const sessionEnd = Math.min(1440, sessionStart + (session.durationMinutes || 60));

    for (const cls of classes) {
      if (cls.day.toLowerCase() === sessionDay.toLowerCase()) {
        const clsStart = timeStringToMinutes(cls.startTime);
        const clsEnd = cls.endTime ? timeStringToMinutes(cls.endTime) : clsStart + 60;

        const overlapStart = Math.max(sessionStart, clsStart);
        const overlapEnd = Math.min(sessionEnd, clsEnd);
        const overlapDuration = overlapEnd - overlapStart;

        if (overlapDuration > 0) {
          clashes.push({
            hasClash: true,
            itemA: {
              id: session.id,
              type: "study",
              title: `Study: ${session.subject}`,
              dateStr: session.date,
              startTime: session.startTime,
              durationMinutes: session.durationMinutes,
            },
            itemB: {
              id: cls.id,
              type: "class",
              title: `Class: ${cls.subject}`,
              dayOfWeek: cls.day,
              startTime: cls.startTime,
              endTime: cls.endTime,
            },
            reason: `Study session "${session.subject}" overlaps with scheduled class "${cls.subject}" on ${cls.day} (${minutesToTimeString(clsStart)} - ${minutesToTimeString(clsEnd)}).`,
            overlapMinutes: overlapDuration,
          });
        }
      }
    }
  }

  // 2. Study Sessions vs Exams on the same date
  for (const session of studySessions) {
    const sessionStart = timeStringToMinutes(session.startTime);
    const sessionEnd = Math.min(1440, sessionStart + (session.durationMinutes || 60));

    for (const exam of exams) {
      if (exam.date === session.date && exam.time) {
        const examStart = timeStringToMinutes(exam.time);
        const examEnd = Math.min(1440, examStart + 180); // standard 3-hour exam window

        const overlapStart = Math.max(sessionStart, examStart);
        const overlapEnd = Math.min(sessionEnd, examEnd);
        const overlapDuration = overlapEnd - overlapStart;

        if (overlapDuration > 0) {
          clashes.push({
            hasClash: true,
            itemA: {
              id: session.id,
              type: "study",
              title: `Study: ${session.subject}`,
              dateStr: session.date,
              startTime: session.startTime,
              durationMinutes: session.durationMinutes,
            },
            itemB: {
              id: exam.id,
              type: "exam",
              title: `Exam: ${exam.subject}`,
              dateStr: exam.date,
              startTime: exam.time,
            },
            reason: `Study session "${session.subject}" overlaps with exam "${exam.subject}" on ${exam.date}.`,
            overlapMinutes: overlapDuration,
          });
        }
      }
    }
  }

  return clashes;
}
