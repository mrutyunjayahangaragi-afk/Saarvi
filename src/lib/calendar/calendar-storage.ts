/**
 * Saarvi Smart Academic Calendar — Local-First Storage Layer
 *
 * Persists calendar events locally with zero cloud leakage by default.
 * Provides synchronization with timetable, assignments, exams, and job applications.
 */

import {
  CalendarEvent,
  syncTimetableToCalendarEvents,
  expandEventsForWindow,
  detectCalendarConflicts,
  type ExpandedCalendarEventInstance,
} from "./calendar-model.ts";
import { academicStorage } from "../academic/storage/academic-db";
import { studentService } from "../services/studentService";

const CALENDAR_STORAGE_KEY_PREFIX = "saarvi_calendar_events_";

class CalendarStorageService {
  private getStorageKey(profileId = "default_student"): string {
    return `${CALENDAR_STORAGE_KEY_PREFIX}${profileId}`;
  }

  public async getCalendarEvents(profileId = "default_student"): Promise<CalendarEvent[]> {
    if (typeof window === "undefined") return [];

    try {
      const raw = localStorage.getItem(this.getStorageKey(profileId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Failed to read calendar events from local storage:", err);
      return [];
    }
  }

  public async saveCalendarEvents(events: CalendarEvent[], profileId = "default_student"): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.getStorageKey(profileId), JSON.stringify(events));
    } catch (err) {
      console.error("Failed to persist calendar events to local storage:", err);
    }
  }

  public async addCalendarEvent(
    event: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">,
    profileId = "default_student"
  ): Promise<CalendarEvent> {
    const existing = await this.getCalendarEvents(profileId);
    const newEvent: CalendarEvent = {
      ...event,
      id: `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...existing, newEvent];
    await this.saveCalendarEvents(updated, profileId);
    return newEvent;
  }

  public async updateCalendarEvent(
    id: string,
    patch: Partial<CalendarEvent>,
    profileId = "default_student"
  ): Promise<CalendarEvent | null> {
    const existing = await this.getCalendarEvents(profileId);
    const index = existing.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const updatedEvent: CalendarEvent = {
      ...existing[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    existing[index] = updatedEvent;
    await this.saveCalendarEvents(existing, profileId);
    return updatedEvent;
  }

  public async deleteCalendarEvent(id: string, profileId = "default_student"): Promise<boolean> {
    const existing = await this.getCalendarEvents(profileId);
    const filtered = existing.filter((e) => e.id !== id);
    if (filtered.length === existing.length) return false;

    await this.saveCalendarEvents(filtered, profileId);
    return true;
  }

  /**
   * Syncs weekly timetable entries into recurring academic calendar events.
   * Preserves manual events and removes only stale timetable events.
   */
  public async syncWithTimetable(profileId = "default_student"): Promise<CalendarEvent[]> {
    try {
      const timetable = await studentService.getTimetable();
      const existing = await this.getCalendarEvents(profileId);

      const synced = syncTimetableToCalendarEvents(timetable || [], existing);
      await this.saveCalendarEvents(synced, profileId);
      return synced;
    } catch (err) {
      console.error("Failed to sync timetable with calendar:", err);
      return this.getCalendarEvents(profileId);
    }
  }

  /**
   * Aggregates all student entities (timetable, assignments, exams, job applications)
   * into a consolidated calendar stream for the current date window.
   */
  public async getConsolidatedEvents(
    windowStart: Date,
    windowEnd: Date,
    profileId = "default_student"
  ): Promise<{
    instances: ExpandedCalendarEventInstance[];
    hasConflicts: boolean;
    conflictingIds: Set<string>;
  }> {
    const calendarEvents = await this.getCalendarEvents(profileId);

    // Also pull assignments, exams, and job applications as virtual calendar events
    const virtualEvents: CalendarEvent[] = [];

    try {
      const [assignments, exams, applications, interviews] = await Promise.all([
        academicStorage.getAssignments().catch(() => []),
        academicStorage.getExams().catch(() => []),
        academicStorage.getAllJobApplications().catch(() => []),
        academicStorage.getAllInterviews().catch(() => []),
      ]);

      // Assignments
      for (const a of assignments) {
        if (!a.dueDate) continue;
        const due = new Date(`${a.dueDate}T23:59:00`);
        virtualEvents.push({
          id: `virt_assign_${a.id}`,
          type: "assignment",
          title: `Assignment Due: ${a.title}`,
          description: `${a.subject} • Priority: ${a.priority}`,
          startAt: due.toISOString(),
          endAt: due.toISOString(),
          allDay: true,
          source: "academic",
          priority: a.priority === "high" ? "high" : "medium",
          status: a.status === "completed" ? "completed" : "confirmed",
          linkedEntityId: a.id,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        });
      }

      // Exams
      for (const e of exams) {
        if (!e.date) continue;
        const [timeH, timeM] = (e.time || "09:30").split(":").map(Number);
        const start = new Date(`${e.date}T00:00:00`);
        start.setHours(timeH || 9, timeM || 30, 0, 0);
        const end = new Date(start.getTime() + 3 * 60 * 60 * 1000); // 3-hour exam

        virtualEvents.push({
          id: `virt_exam_${e.id}`,
          type: "exam",
          title: `Exam: ${e.subject} (${e.examType})`,
          description: e.notes || undefined,
          location: e.location || undefined,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          allDay: !e.time,
          source: "academic",
          priority: "high",
          status: "confirmed",
          linkedEntityId: e.id,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        });
      }

      // Job Applications
      for (const app of applications) {
        if (app.deadline) {
          const deadlineDate = new Date(`${app.deadline}T23:59:00`);
          virtualEvents.push({
            id: `virt_app_dl_${app.id}`,
            type: "job_deadline",
            title: `Application Deadline: ${app.company} — ${app.role}`,
            description: `Status: ${app.status} • Apply/Portal URL: ${app.jobUrl || "None"}`,
            startAt: deadlineDate.toISOString(),
            endAt: deadlineDate.toISOString(),
            allDay: true,
            source: "career",
            priority: app.priority === "high" ? "high" : "medium",
            status: "confirmed",
            linkedEntityId: app.id,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
          });
        }

        if (app.followUpDate) {
          const followDate = new Date(`${app.followUpDate}T10:00:00`);
          virtualEvents.push({
            id: `virt_app_fu_${app.id}`,
            type: "application_followup",
            title: `Follow Up: ${app.company}`,
            description: `Check status for ${app.role}`,
            startAt: followDate.toISOString(),
            endAt: new Date(followDate.getTime() + 30 * 60 * 1000).toISOString(),
            allDay: false,
            source: "career",
            priority: "medium",
            status: "confirmed",
            linkedEntityId: app.id,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
          });
        }
      }

      // Interviews
      for (const intv of interviews) {
        if (!intv.date) continue;
        const [timeH, timeM] = (intv.time || "10:00").split(":").map(Number);
        const start = new Date(`${intv.date}T00:00:00`);
        start.setHours(timeH || 10, timeM || 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1-hour interview

        virtualEvents.push({
          id: `virt_intv_${intv.id}`,
          type: "interview",
          title: `Interview: ${intv.company} (${intv.round})`,
          description: `Type: ${intv.type}${intv.locationOrLink ? ` • Location/Link: ${intv.locationOrLink}` : ""}${intv.notes ? ` • ${intv.notes}` : ""}`,
          location: intv.locationOrLink || undefined,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          allDay: !intv.time,
          source: "career",
          priority: "high",
          status: intv.status === "COMPLETED" ? "completed" : "confirmed",
          linkedEntityId: intv.id,
          createdAt: intv.createdAt,
          updatedAt: intv.updatedAt,
        });
      }
    } catch (err) {
      console.warn("Could not load external academic records into calendar:", err);
    }

    const allEvents = [...calendarEvents, ...virtualEvents];
    const instances = expandEventsForWindow(allEvents, windowStart, windowEnd);
    const conflicts = detectCalendarConflicts(instances);

    return {
      instances,
      hasConflicts: conflicts.hasAnyConflict,
      conflictingIds: conflicts.conflictingIds,
    };
  }
}

export const calendarStorage = new CalendarStorageService();
