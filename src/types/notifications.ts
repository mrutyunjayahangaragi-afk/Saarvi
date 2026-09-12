export type NotificationChannel = 'email' | 'whatsapp';

export type NotificationStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'NOT_CONFIGURED'
  | 'AWAITING_VERIFICATION';

export type ReminderTiming =
  | 'same_day'
  | '1_day_before'
  | '2_hours_before'
  | '1_hour_before'
  | 'custom';

export type PlanningEventType =
  | 'study_session'
  | 'assignment'
  | 'exam'
  | 'task'
  | 'goal'
  | 'internship'
  | 'hackathon'
  | 'interview'
  | 'application'
  | 'other';

export interface NotificationPreferences {
  emailEnabled: boolean; // default true (free)
  whatsappEnabled: boolean; // default false (optional)
  whatsappPhoneNumber?: string;
  whatsappVerified: boolean;
  defaultReminderTiming: ReminderTiming; // default "same_day"
  customOffsetMinutes?: number;
  timezone: string; // default "Asia/Kolkata"
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "07:00"
  };
}

export interface ScheduledReminderJob {
  id: string;
  eventId: string;
  userId: string;
  eventType: string;
  eventTitle: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  timezone: string;
  reminderTiming: ReminderTiming;
  targetExecutionTimestamp: number; // UTC ms
  channel: NotificationChannel;
  recipient: string; // email address or phone number
  status: NotificationStatus;
  retryCount: number;
  maxRetries: number; // default 3
  idempotencyKey: string; // `${eventId}_${channel}_${targetExecutionTimestamp}`
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  deliveredAt?: string;
  lockedBy?: string;
  lockExpiresAt?: number;
}

export interface DeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  status: NotificationStatus;
  providerMessageId?: string;
  error?: string;
  timestamp: string;
}

export interface ReminderEmailMessage {
  idempotencyKey: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  eventTitle: string;
  eventType: string;
  scheduledDate: string;
  scheduledTime?: string;
  timezone: string;
}

export interface ReminderWhatsAppMessage {
  idempotencyKey: string;
  toPhone: string;
  templateName: string;
  parameters: {
    eventType: string;
    eventTitle: string;
    scheduledTime: string;
  };
}

export interface NotificationHistoryEntry {
  id: string;
  eventId: string;
  eventTitle: string;
  eventType: string;
  channel: NotificationChannel;
  scheduledDate: string;
  scheduledTime?: string;
  targetExecutionTimestamp: number;
  status: NotificationStatus;
  updatedAt: string;
  lastError?: string;
}

export interface ReminderScheduleRequest {
  eventId: string;
  eventType: string;
  eventTitle: string;
  scheduledDate: string;
  scheduledTime?: string;
  reminderTiming?: ReminderTiming;
  customOffsetMinutes?: number;
  channels?: {
    email: boolean;
    whatsapp?: boolean;
  };
  phoneOverride?: string;
}
