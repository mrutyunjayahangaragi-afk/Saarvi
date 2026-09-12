/**
 * Shared Student Date & Time Utilities.
 *
 * Provides deterministic, timezone-safe date parsing, day diffing,
 * and schedule status calculation without external heavy libraries.
 */

export type DateUrgencyStatus = "overdue" | "due_today" | "due_soon" | "upcoming" | "past";

/**
 * Returns today's date formatted as "YYYY-MM-DD" in user's local timezone.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a "YYYY-MM-DD" string into a Date object at midnight local time.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

/**
 * Calculates calendar day difference between target date and today.
 * Negative = past/overdue
 * 0 = due today
 * 1 = tomorrow
 * > 1 = future
 */
export function getDaysDifferenceFromToday(dateStr: string): number {
  if (!dateStr) return 0;
  const target = parseLocalDate(dateStr);
  const today = parseLocalDate(getTodayDateString());
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determines urgency status for a given target date.
 */
export function getDateUrgencyStatus(dateStr: string): DateUrgencyStatus {
  const diff = getDaysDifferenceFromToday(dateStr);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= 3) return "due_soon";
  return "upcoming";
}

/**
 * Formats a date string for display (e.g., "Sep 15, 2026").
 */
export function formatStudentDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Parses a "HH:MM" 24-hour time string into total minutes from midnight.
 * e.g., "09:30" -> 570 minutes.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);
  return Math.max(0, Math.min(23, isNaN(hours) ? 0 : hours)) * 60 +
         Math.max(0, Math.min(59, isNaN(minutes) ? 0 : minutes));
}

/**
 * Converts total minutes from midnight into 12-hour formatted string (e.g. "9:30 AM").
 */
export function minutesToTimeString(totalMinutes: number): string {
  const norm = Math.max(0, Math.min(1439, totalMinutes));
  const hours24 = Math.floor(norm / 60);
  const mins = norm % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}
