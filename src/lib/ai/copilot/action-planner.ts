import { CopilotAction, CopilotActionType } from "@/types/copilot";
import { studentService } from "@/lib/services/studentService";
import { notificationService } from "@/lib/services/notificationService";

export interface ActionValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a structured CopilotAction against its expected schema.
 */
export function validateAction(action: CopilotAction): ActionValidationResult {
  if (!action || !action.id || !action.type) {
    return { valid: false, error: "Action must have a valid ID and type." };
  }

  const payload = action.payload || {};

  switch (action.type) {
    case "create_study_session": {
      const subject = payload.subject;
      const date = payload.date;
      const startTime = payload.startTime;
      const duration = payload.durationMinutes;

      if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
        return { valid: false, error: "Subject is required for study session." };
      }
      if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { valid: false, error: "Valid date (YYYY-MM-DD) is required for study session." };
      }
      if (!startTime || typeof startTime !== "string" || !/^\d{2}:\d{2}$/.test(startTime)) {
        return { valid: false, error: "Valid start time (HH:mm) is required for study session." };
      }
      if (typeof duration !== "number" || duration <= 0 || duration > 480) {
        return { valid: false, error: "Duration must be a positive number up to 480 minutes." };
      }
      return { valid: true };
    }

    case "create_task": {
      const title = payload.title;
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return { valid: false, error: "Task title is required." };
      }
      return { valid: true };
    }

    case "schedule_reminder": {
      const eventTitle = payload.eventTitle || action.title;
      const scheduledDate = payload.scheduledDate || payload.date;
      if (!eventTitle || typeof eventTitle !== "string") {
        return { valid: false, error: "Event title is required for reminder." };
      }
      if (!scheduledDate || typeof scheduledDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
        return { valid: false, error: "Valid scheduled date (YYYY-MM-DD) is required for reminder." };
      }
      return { valid: true };
    }

    case "navigate_to_feature": {
      const route = payload.route;
      if (!route || typeof route !== "string" || !route.startsWith("/")) {
        return { valid: false, error: "Valid local route starting with '/' is required." };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: `Unknown action type: ${(action as any).type}` };
  }
}

/**
 * Checks if a proposed study session conflicts with existing scheduled study sessions.
 */
export async function checkStudySessionConflict(
  date: string,
  startTime: string,
  durationMinutes: number,
  profileId: string = "guest"
): Promise<{ hasConflict: boolean; conflictingSession?: string }> {
  try {
    const sessions = await studentService.getStudySessions(profileId);
    const [startH, startM] = startTime.split(":").map(Number);
    const newStart = startH * 60 + startM;
    const newEnd = newStart + durationMinutes;

    for (const s of sessions) {
      if (s.date === date && s.startTime) {
        const [existingH, existingM] = s.startTime.split(":").map(Number);
        const existingStart = existingH * 60 + existingM;
        const existingEnd = existingStart + (s.durationMinutes || 60);

        // Check time interval overlap
        if (newStart < existingEnd && newEnd > existingStart) {
          return {
            hasConflict: true,
            conflictingSession: `${s.subject} (${s.startTime})`,
          };
        }
      }
    }
  } catch {
    // If lookup fails, allow action with no conflict assumed
  }

  return { hasConflict: false };
}

/**
 * Dispatches an approved action to local services.
 * GUARANTEE: Never executes an action unless action.status === 'confirmed'.
 */
export async function executeAction(
  action: CopilotAction,
  profileId: string = "guest"
): Promise<{ success: boolean; message: string; data?: any }> {
  // STRICT SAFETY CHECK: User confirmation required
  if (action.status !== "confirmed") {
    return {
      success: false,
      message: "Action rejected: user confirmation is strictly required before mutating workspace data.",
    };
  }

  const validation = validateAction(action);
  if (!validation.valid) {
    return {
      success: false,
      message: `Invalid action schema: ${validation.error}`,
    };
  }

  const payload = action.payload || {};

  try {
    switch (action.type) {
      case "create_study_session": {
        const rawPriority = String(payload.priority || "medium").toLowerCase();
        const priority: "low" | "medium" | "high" =
          rawPriority === "high" ? "high" : rawPriority === "low" ? "low" : "medium";
        const saved = await studentService.saveStudyPlan({
          userId: profileId,
          subject: String(payload.subject),
          date: String(payload.date),
          startTime: String(payload.startTime),
          durationMinutes: Number(payload.durationMinutes || 60),
          priority,
          notes: payload.notes ? String(payload.notes) : "Scheduled via Saarvi Copilot",
          completed: false,
        });

        action.status = "executed";
        return {
          success: true,
          message: `Study session for "${saved.subject}" successfully scheduled on ${saved.date} at ${saved.startTime}.`,
          data: saved,
        };
      }

      case "create_task": {
        const rawPriority = String(payload.priority || "MEDIUM").toUpperCase();
        const priority: "LOW" | "MEDIUM" | "HIGH" =
          rawPriority === "HIGH" ? "HIGH" : rawPriority === "LOW" ? "LOW" : "MEDIUM";
        const now = new Date().toISOString();
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const saved = await studentService.saveTask({
          id: taskId,
          userId: profileId,
          title: String(payload.title),
          priority,
          status: "TODO",
          dueDate: payload.dueDate ? String(payload.dueDate) : undefined,
          description: payload.description ? String(payload.description) : undefined,
          category: payload.category ? String(payload.category) : "Copilot",
          createdAt: now,
          updatedAt: now,
        });

        action.status = "executed";
        return {
          success: true,
          message: `Task "${saved.title}" created successfully.`,
          data: saved,
        };
      }

      case "schedule_reminder": {
        const scheduleReq = {
          eventId: String(payload.eventId || `event_${Date.now()}`),
          eventType: String(payload.eventType || "study_session"),
          eventTitle: String(payload.eventTitle || action.title),
          scheduledDate: String(payload.scheduledDate || payload.date),
          scheduledTime: payload.scheduledTime ? String(payload.scheduledTime) : undefined,
          reminderTiming: (payload.reminderTiming as any) || "same_day",
          channels: {
            email: true,
            whatsapp: Boolean(payload.whatsapp),
          },
        };

        const reminderResult = await notificationService.scheduleReminder(scheduleReq);
        action.status = "executed";
        return {
          success: reminderResult.success,
          message: reminderResult.success
            ? `Reminder scheduled for "${scheduleReq.eventTitle}".`
            : reminderResult.error || "Failed to schedule reminder with notification service.",
          data: reminderResult,
        };
      }

      case "navigate_to_feature": {
        action.status = "executed";
        return {
          success: true,
          message: `Navigate to ${payload.route}`,
          data: { route: payload.route },
        };
      }

      default:
        return {
          success: false,
          message: `Unsupported action type: ${(action as any).type}`,
        };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to execute action: ${err?.message || "Unknown error"}`,
    };
  }
}
