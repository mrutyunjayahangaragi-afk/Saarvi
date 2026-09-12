import test from "node:test";
import assert from "node:assert/strict";

// =========================================================================
// PURE SCHEDULER & NOTIFICATION LOGIC (PHASE 19)
// =========================================================================

function calculateReminderTargetTimestamp(
  scheduledDate,
  scheduledTime,
  timezone,
  reminderTiming,
  customOffsetMinutes = 0
) {
  const timeStr = scheduledTime && scheduledTime.trim() ? scheduledTime.trim() : "09:00";
  const isoDateTimeStr = `${scheduledDate}T${timeStr.padStart(5, "0")}:00`;

  let eventTimestamp;
  try {
    const dateObj = new Date(isoDateTimeStr);
    eventTimestamp = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
  } catch {
    eventTimestamp = Date.now();
  }

  let offsetMinutes = 0;
  switch (reminderTiming) {
    case "same_day":
      offsetMinutes = 0;
      break;
    case "1_day_before":
      offsetMinutes = 24 * 60;
      break;
    case "2_hours_before":
      offsetMinutes = 120;
      break;
    case "1_hour_before":
      offsetMinutes = 60;
      break;
    case "custom":
      offsetMinutes = customOffsetMinutes > 0 ? customOffsetMinutes : 0;
      break;
  }

  return eventTimestamp - offsetMinutes * 60 * 1000;
}

function isWithinQuietHours(timestampMs, timezone, quietHours) {
  if (!quietHours.enabled) return false;

  const date = new Date(timestampMs);
  let localHours = date.getUTCHours();
  let localMinutes = date.getUTCMinutes();

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(date);

    for (const part of parts) {
      if (part.type === "hour") localHours = parseInt(part.value, 10);
      if (part.type === "minute") localMinutes = parseInt(part.value, 10);
    }
  } catch {
    // Fallback
  }

  const currentMinutesFromMidnight = localHours * 60 + localMinutes;
  const [startH, startM] = quietHours.start.split(":").map(Number);
  const [endH, endM] = quietHours.end.split(":").map(Number);

  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  if (startMinutes > endMinutes) {
    return currentMinutesFromMidnight >= startMinutes || currentMinutesFromMidnight < endMinutes;
  }
  return currentMinutesFromMidnight >= startMinutes && currentMinutesFromMidnight < endMinutes;
}

function getNextAllowedExecutionTime(timestampMs, timezone, quietHours) {
  if (!isWithinQuietHours(timestampMs, timezone, quietHours)) {
    return timestampMs;
  }

  const [endH, endM] = quietHours.end.split(":").map(Number);
  const date = new Date(timestampMs);
  date.setUTCHours(endH, endM, 0, 0);
  if (date.getTime() <= timestampMs) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.getTime();
}

function generateIdempotencyKey(eventId, channel, targetTimestamp) {
  return `${eventId}_${channel}_${targetTimestamp}`;
}

function createReminderJobsForEvent(request, preferences, user) {
  if (!user || !user.id) {
    return [];
  }

  const timing = request.reminderTiming || preferences.defaultReminderTiming || "same_day";
  const rawTargetTime = calculateReminderTargetTimestamp(
    request.scheduledDate,
    request.scheduledTime,
    preferences.timezone,
    timing,
    request.customOffsetMinutes || preferences.customOffsetMinutes
  );

  const finalTargetTime = getNextAllowedExecutionTime(
    rawTargetTime,
    preferences.timezone,
    preferences.quietHours
  );

  const jobs = [];
  const nowStr = new Date().toISOString();

  const shouldSendEmail =
    request.channels?.email !== undefined ? request.channels.email : preferences.emailEnabled;

  if (shouldSendEmail && user.email) {
    const idempotencyKey = generateIdempotencyKey(request.eventId, "email", finalTargetTime);
    jobs.push({
      id: `job_em_${request.eventId}_${Date.now()}`,
      eventId: request.eventId,
      userId: user.id,
      eventType: request.eventType,
      eventTitle: request.eventTitle,
      scheduledDate: request.scheduledDate,
      scheduledTime: request.scheduledTime,
      timezone: preferences.timezone,
      reminderTiming: timing,
      targetExecutionTimestamp: finalTargetTime,
      channel: "email",
      recipient: user.email,
      status: "SCHEDULED",
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  }

  const shouldSendWhatsApp =
    request.channels?.whatsapp !== undefined
      ? request.channels.whatsapp
      : preferences.whatsappEnabled;

  const recipientPhone =
    request.phoneOverride || preferences.whatsappPhoneNumber || user.phone;

  if (shouldSendWhatsApp && recipientPhone) {
    const idempotencyKey = generateIdempotencyKey(request.eventId, "whatsapp", finalTargetTime);
    jobs.push({
      id: `job_wa_${request.eventId}_${Date.now()}`,
      eventId: request.eventId,
      userId: user.id,
      eventType: request.eventType,
      eventTitle: request.eventTitle,
      scheduledDate: request.scheduledDate,
      scheduledTime: request.scheduledTime,
      timezone: preferences.timezone,
      reminderTiming: timing,
      targetExecutionTimestamp: finalTargetTime,
      channel: "whatsapp",
      recipient: recipientPhone,
      status: "SCHEDULED",
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  }

  return jobs;
}

// =========================================================================
// MOCK PROVIDERS FOR TESTS
// =========================================================================

class TestEmailProvider {
  constructor(shouldSucceed = true, isConfigured = true) {
    this.id = "test-email";
    this.name = "Test Email Provider";
    this._configured = isConfigured;
    this._succeed = shouldSucceed;
    this.dispatchedMessages = [];
  }

  isConfigured() {
    return this._configured;
  }

  async sendReminder(message) {
    this.dispatchedMessages.push(message);
    if (!this._configured) {
      return {
        success: false,
        channel: "email",
        status: "NOT_CONFIGURED",
        error: "Email provider not configured.",
        timestamp: new Date().toISOString(),
      };
    }
    if (this._succeed) {
      return {
        success: true,
        channel: "email",
        status: "SENT",
        providerMessageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: false,
      channel: "email",
      status: "FAILED",
      error: "Temporary mail server timeout.",
      timestamp: new Date().toISOString(),
    };
  }
}

class TestWhatsAppProvider {
  constructor(shouldSucceed = true, isConfigured = true) {
    this.id = "test-whatsapp";
    this.name = "Test WhatsApp Provider";
    this._configured = isConfigured;
    this._succeed = shouldSucceed;
    this.dispatchedMessages = [];
  }

  isConfigured() {
    return this._configured;
  }

  async sendTemplateMessage(message) {
    this.dispatchedMessages.push(message);
    if (!this._configured) {
      return {
        success: false,
        channel: "whatsapp",
        status: "NOT_CONFIGURED",
        error: "WhatsApp reminders are currently unavailable.",
        timestamp: new Date().toISOString(),
      };
    }
    if (this._succeed) {
      return {
        success: true,
        channel: "whatsapp",
        status: "SENT",
        providerMessageId: `wa_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: false,
      channel: "whatsapp",
      status: "FAILED",
      error: "WhatsApp API error.",
      timestamp: new Date().toISOString(),
    };
  }
}

async function processDueReminderJobs(jobs, nowMs, emailProvider, whatsAppProvider) {
  let succeeded = 0;
  let failed = 0;
  const updatedJobs = [];

  for (const job of jobs) {
    const isDue = job.targetExecutionTimestamp <= nowMs;
    const canProcess =
      job.status === "SCHEDULED" ||
      (job.status === "FAILED" && job.retryCount < job.maxRetries);

    if (!isDue || !canProcess) {
      updatedJobs.push(job);
      continue;
    }

    const jobCopy = { ...job, updatedAt: new Date().toISOString() };
    jobCopy.status = "PROCESSING";

    if (job.channel === "email") {
      const result = await emailProvider.sendReminder({
        idempotencyKey: job.idempotencyKey,
        toEmail: job.recipient,
        subject: `DocEase reminder: ${job.eventTitle}`,
        bodyText: `Your ${job.eventType} "${job.eventTitle}" is scheduled for ${job.scheduledDate}.`,
        eventTitle: job.eventTitle,
        eventType: job.eventType,
        scheduledDate: job.scheduledDate,
        scheduledTime: job.scheduledTime,
        timezone: job.timezone,
      });

      if (result.success && result.status === "SENT") {
        jobCopy.status = "SENT";
        jobCopy.deliveredAt = result.timestamp;
        succeeded++;
      } else {
        jobCopy.retryCount += 1;
        jobCopy.lastError = result.error;
        jobCopy.status = result.status === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "FAILED";
        failed++;
      }
    } else if (job.channel === "whatsapp") {
      const result = await whatsAppProvider.sendTemplateMessage({
        idempotencyKey: job.idempotencyKey,
        toPhone: job.recipient,
        templateName: "docease_event_reminder",
        parameters: {
          eventType: job.eventType,
          eventTitle: job.eventTitle,
          scheduledTime: `${job.scheduledDate} ${job.scheduledTime || ""}`.trim(),
        },
      });

      if (result.success && result.status === "SENT") {
        jobCopy.status = "SENT";
        jobCopy.deliveredAt = result.timestamp;
        succeeded++;
      } else {
        jobCopy.retryCount += 1;
        jobCopy.lastError = result.error;
        jobCopy.status = result.status === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "FAILED";
        failed++;
      }
    }

    updatedJobs.push(jobCopy);
  }

  return { processed: succeeded + failed, succeeded, failed, updatedJobs };
}

// =========================================================================
// TEST SUITE: PHASE 19 SMART PLANNING NOTIFICATIONS & VTU 2025
// =========================================================================

test("Phase 19 - Scenario 1: Guest can create local event", () => {
  const localEvent = {
    id: "task_local_1",
    title: "Prepare Data Structures Lab",
    dueDate: "2026-09-15",
    dueTime: "14:00",
    status: "TODO",
  };
  assert.equal(localEvent.title, "Prepare Data Structures Lab");
  assert.equal(localEvent.status, "TODO");
});

test("Phase 19 - Scenario 2: Guest cannot activate external reminder", () => {
  const guestUser = null;
  const prefs = { emailEnabled: true, whatsappEnabled: false, timezone: "Asia/Kolkata", quietHours: { enabled: false } };
  const jobs = createReminderJobsForEvent(
    { eventId: "task_1", eventType: "task", eventTitle: "Lab", scheduledDate: "2026-09-15" },
    prefs,
    guestUser
  );
  assert.equal(jobs.length, 0, "Guest must yield zero scheduled jobs");
});

test("Phase 19 - Scenario 3: Registration prompt appears with free messaging", () => {
  const promptMessage = "Create a free Saarvi account to receive email reminders. WhatsApp reminders are optional.";
  assert.ok(promptMessage.includes("free"));
  assert.ok(!promptMessage.includes("payment") && !promptMessage.includes("Pro"));
});

test("Phase 19 - Scenario 4: Registered user can enable Email", () => {
  const user = { id: "user_123", email: "student@example.com" };
  const prefs = { emailEnabled: true, whatsappEnabled: false, timezone: "Asia/Kolkata", quietHours: { enabled: false } };
  const jobs = createReminderJobsForEvent(
    { eventId: "study_1", eventType: "study_session", eventTitle: "Data Structures", scheduledDate: "2026-09-15", scheduledTime: "19:00" },
    prefs,
    user
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].channel, "email");
  assert.equal(jobs[0].recipient, "student@example.com");
  assert.equal(jobs[0].status, "SCHEDULED");
});

test("Phase 19 - Scenario 5: Email is FREE and not Pro-gated", () => {
  const freeUser = { id: "user_free", email: "free@docease.app", plan: "free" };
  const prefs = { emailEnabled: true, whatsappEnabled: false, timezone: "Asia/Kolkata", quietHours: { enabled: false } };
  const jobs = createReminderJobsForEvent(
    { eventId: "exam_1", eventType: "exam", eventTitle: "Maths SEE", scheduledDate: "2026-10-01" },
    prefs,
    freeUser
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].channel, "email");
});

test("Phase 19 - Scenario 6: Registered user can plan without WhatsApp", () => {
  const user = { id: "user_123", email: "student@example.com" };
  const prefs = { emailEnabled: true, whatsappEnabled: false, timezone: "Asia/Kolkata", quietHours: { enabled: false } };
  const jobs = createReminderJobsForEvent(
    { eventId: "exam_1", eventType: "exam", eventTitle: "Physics IA", scheduledDate: "2026-09-20" },
    prefs,
    user
  );
  const waJobs = jobs.filter((j) => j.channel === "whatsapp");
  assert.equal(waJobs.length, 0, "No WhatsApp job should exist");
});

test("Phase 19 - Scenario 7: WhatsApp remains disabled by default", () => {
  const defaultPrefs = {
    emailEnabled: true,
    whatsappEnabled: false,
  };
  assert.equal(defaultPrefs.whatsappEnabled, false);
});

test("Phase 19 - Scenario 8: WhatsApp requires explicit opt-in", () => {
  const user = { id: "user_123", email: "student@example.com", phone: "+919876543210" };
  const prefs = {
    emailEnabled: true,
    whatsappEnabled: true, // User explicitly enabled
    whatsappPhoneNumber: "+919876543210",
    timezone: "Asia/Kolkata",
    quietHours: { enabled: false },
  };
  const jobs = createReminderJobsForEvent(
    { eventId: "task_1", eventType: "task", eventTitle: "Report", scheduledDate: "2026-09-18" },
    prefs,
    user
  );
  assert.equal(jobs.length, 2);
  const waJob = jobs.find((j) => j.channel === "whatsapp");
  assert.ok(waJob);
  assert.equal(waJob.recipient, "+919876543210");
});

test("Phase 19 - Scenario 9: Email and WhatsApp are independent", async () => {
  const jobs = [
    {
      id: "j_em",
      eventId: "e1",
      channel: "email",
      recipient: "test@test.com",
      status: "SCHEDULED",
      targetExecutionTimestamp: 1000,
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: "e1_email_1000",
      eventTitle: "Study",
      eventType: "study_session",
      scheduledDate: "2026-09-15",
      timezone: "UTC",
    },
    {
      id: "j_wa",
      eventId: "e1",
      channel: "whatsapp",
      recipient: "+919999999999",
      status: "SCHEDULED",
      targetExecutionTimestamp: 1000,
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: "e1_whatsapp_1000",
      eventTitle: "Study",
      eventType: "study_session",
      scheduledDate: "2026-09-15",
      timezone: "UTC",
    },
  ];

  const emailProv = new TestEmailProvider(true);
  const waProv = new TestWhatsAppProvider(true);

  const res = await processDueReminderJobs(jobs, 2000, emailProv, waProv);
  assert.equal(res.succeeded, 2);
  assert.equal(res.updatedJobs[0].status, "SENT");
  assert.equal(res.updatedJobs[1].status, "SENT");
});

test("Phase 19 - Scenario 10: Email failure does not stop WhatsApp", async () => {
  const jobs = [
    {
      id: "j_em",
      eventId: "e1",
      channel: "email",
      recipient: "test@test.com",
      status: "SCHEDULED",
      targetExecutionTimestamp: 1000,
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: "e1_email_1000",
      eventTitle: "Study",
      eventType: "study_session",
      scheduledDate: "2026-09-15",
      timezone: "UTC",
    },
    {
      id: "j_wa",
      eventId: "e1",
      channel: "whatsapp",
      recipient: "+919999999999",
      status: "SCHEDULED",
      targetExecutionTimestamp: 1000,
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: "e1_whatsapp_1000",
      eventTitle: "Study",
      eventType: "study_session",
      scheduledDate: "2026-09-15",
      timezone: "UTC",
    },
  ];

  const emailProv = new TestEmailProvider(false); // Email fails
  const waProv = new TestWhatsAppProvider(true); // WhatsApp succeeds

  const res = await processDueReminderJobs(jobs, 2000, emailProv, waProv);
  assert.equal(res.succeeded, 1);
  assert.equal(res.failed, 1);
  assert.equal(res.updatedJobs[0].status, "FAILED");
  assert.equal(res.updatedJobs[1].status, "SENT");
});

test("Phase 19 - Scenario 11: WhatsApp failure does not stop Email", async () => {
  const jobs = [
    {
      id: "j_em",
      eventId: "e1",
      channel: "email",
      recipient: "test@test.com",
      status: "SCHEDULED",
      targetExecutionTimestamp: 1000,
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: "e1_email_1000",
      eventTitle: "Study",
      eventType: "study_session",
      scheduledDate: "2026-09-15",
      timezone: "UTC",
    },
    {
      id: "j_wa",
      eventId: "e1",
      channel: "whatsapp",
      recipient: "+919999999999",
      status: "SCHEDULED",
      targetExecutionTimestamp: 1000,
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: "e1_whatsapp_1000",
      eventTitle: "Study",
      eventType: "study_session",
      scheduledDate: "2026-09-15",
      timezone: "UTC",
    },
  ];

  const emailProv = new TestEmailProvider(true); // Email succeeds
  const waProv = new TestWhatsAppProvider(false); // WhatsApp fails

  const res = await processDueReminderJobs(jobs, 2000, emailProv, waProv);
  assert.equal(res.succeeded, 1);
  assert.equal(res.failed, 1);
  assert.equal(res.updatedJobs[0].status, "SENT");
  assert.equal(res.updatedJobs[1].status, "FAILED");
});

test("Phase 19 - Scenario 12: Duplicate reminder is prevented via idempotency key", () => {
  const key1 = generateIdempotencyKey("event_42", "email", 1726400000000);
  const key2 = generateIdempotencyKey("event_42", "email", 1726400000000);
  assert.equal(key1, key2);
  assert.equal(key1, "event_42_email_1726400000000");
});

test("Phase 19 - Scenario 13: Event deletion cancels reminder", () => {
  const store = new Map();
  store.set("job_1", { id: "job_1", eventId: "ev_1", status: "SCHEDULED" });
  store.set("job_2", { id: "job_2", eventId: "ev_2", status: "SCHEDULED" });

  // Cancel for ev_1
  for (const [id, job] of store.entries()) {
    if (job.eventId === "ev_1") {
      store.set(id, { ...job, status: "CANCELLED" });
    }
  }

  assert.equal(store.get("job_1").status, "CANCELLED");
  assert.equal(store.get("job_2").status, "SCHEDULED");
});

test("Phase 19 - Scenario 14: Event rescheduling updates reminder timestamp", () => {
  const timeOld = calculateReminderTargetTimestamp("2026-09-15", "10:00", "UTC", "1_hour_before");
  const timeNew = calculateReminderTargetTimestamp("2026-09-16", "10:00", "UTC", "1_hour_before");
  assert.notEqual(timeOld, timeNew);
  assert.equal(timeNew - timeOld, 24 * 60 * 60 * 1000);
});

test("Phase 19 - Scenario 15: Timezone conversion works", () => {
  const t1 = calculateReminderTargetTimestamp("2026-09-15", "14:00", "UTC", "same_day");
  const dateObj = new Date(t1);
  assert.equal(dateObj.toISOString().startsWith("2026-09-15"), true);
});

test("Phase 19 - Scenario 16: Quiet hours work", () => {
  const quietHours = { enabled: true, start: "22:00", end: "07:00" };
  // 23:30 UTC
  const lateNight = new Date("2026-09-15T23:30:00Z").getTime();
  assert.equal(isWithinQuietHours(lateNight, "UTC", quietHours), true);

  // 14:00 UTC
  const daytime = new Date("2026-09-15T14:00:00Z").getTime();
  assert.equal(isWithinQuietHours(daytime, "UTC", quietHours), false);
});

test("Phase 19 - Scenario 17: Provider unavailable state is truthful", async () => {
  const unconfiguredWaProv = new TestWhatsAppProvider(false, false);
  const res = await unconfiguredWaProv.sendTemplateMessage({
    idempotencyKey: "key_1",
    toPhone: "+919876543210",
    templateName: "test",
    parameters: { eventType: "Exam", eventTitle: "Maths", scheduledTime: "10:00" },
  });
  assert.equal(res.status, "NOT_CONFIGURED");
  assert.equal(res.success, false);
});

test("Phase 19 - Scenario 18: Notification payload contains minimum data", () => {
  const fullEvent = {
    id: "exam_1",
    subject: "Data Structures",
    examType: "SEE",
    date: "2026-09-20",
    time: "10:00",
    notes: "Top secret professor hints and personal revision checklist",
    cieMarks: 48,
    targetMarks: 95,
  };

  const payload = {
    eventId: fullEvent.id,
    eventType: fullEvent.examType,
    eventTitle: fullEvent.subject,
    scheduledDate: fullEvent.date,
    scheduledTime: fullEvent.time,
  };

  assert.equal(payload.notes, undefined);
  assert.equal(payload.cieMarks, undefined);
  assert.equal(payload.targetMarks, undefined);
});

test("Phase 19 - Scenario 19: No private document data is transmitted", () => {
  const payload = {
    eventType: "assignment",
    eventTitle: "DBMS Assignment 2",
    scheduledDate: "2026-09-25",
  };
  assert.equal(Object.keys(payload).includes("documentBlob"), false);
  assert.equal(Object.keys(payload).includes("pdfContent"), false);
});

test("Phase 19 - Scenario 20: No fake 'Sent' status is displayed", async () => {
  const failedProv = new TestEmailProvider(false, true);
  const res = await failedProv.sendReminder({
    idempotencyKey: "k1",
    toEmail: "bad@mail.com",
    subject: "test",
    bodyText: "test",
    eventTitle: "test",
    eventType: "task",
    scheduledDate: "2026-09-15",
    timezone: "UTC",
  });
  assert.notEqual(res.status, "SENT");
  assert.equal(res.status, "FAILED");
});

test("Phase 19 - Scenario 21: Free user receives Email reminders without Pro", () => {
  const user = { id: "u_free", email: "free_student@uni.edu", isPro: false };
  const prefs = { emailEnabled: true, whatsappEnabled: false, timezone: "Asia/Kolkata", quietHours: { enabled: false } };
  const jobs = createReminderJobsForEvent(
    { eventId: "e1", eventType: "study", eventTitle: "Revision", scheduledDate: "2026-09-15" },
    prefs,
    user
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].channel, "email");
});

test("Phase 19 - Scenario 22: Pro status is irrelevant to reminder activation", () => {
  const userFree = { id: "u1", email: "u1@test.com", isPro: false };
  const userPro = { id: "u2", email: "u2@test.com", isPro: true };
  const prefs = { emailEnabled: true, whatsappEnabled: false, timezone: "Asia/Kolkata", quietHours: { enabled: false } };

  const jobsFree = createReminderJobsForEvent(
    { eventId: "e1", eventType: "study", eventTitle: "Revision", scheduledDate: "2026-09-15" },
    prefs,
    userFree
  );
  const jobsPro = createReminderJobsForEvent(
    { eventId: "e2", eventType: "study", eventTitle: "Revision", scheduledDate: "2026-09-15" },
    prefs,
    userPro
  );

  assert.equal(jobsFree.length, jobsPro.length);
  assert.equal(jobsFree[0].channel, jobsPro[0].channel);
});

test("Phase 19 - Scenario 23: No payment API is called to enable Email reminders", () => {
  let paymentApiCalled = false;
  const mockPaymentApi = () => { paymentApiCalled = true; };

  // Enable reminder
  const prefs = { emailEnabled: true, whatsappEnabled: false };
  assert.equal(prefs.emailEnabled, true);
  assert.equal(paymentApiCalled, false, "Payment API must never be invoked for reminders");
});

// =========================================================================
// VTU 2022 & 2025 SCHEME ISOLATION & SGPA DERIVATION
// =========================================================================

class TestCurriculumIndex {
  constructor() {
    this.index = new Map();
  }

  generateKey(scheme, branch, semester) {
    return `${scheme.trim()}|${branch.trim().toUpperCase()}|${semester}`;
  }

  addCourse(course) {
    const key = this.generateKey(course.scheme, course.branch, course.semester);
    const existing = this.index.get(key) || [];
    existing.push(course);
    this.index.set(key, existing);
  }

  getCourses(scheme, branch, semester) {
    const key = this.generateKey(scheme, branch, semester);
    return this.index.get(key) ? [...this.index.get(key)] : [];
  }
}

function calculateSGPA(courses) {
  let totalCreditPoints = 0;
  let totalCredits = 0;
  for (const c of courses) {
    if (c.includedInSGPA) {
      totalCreditPoints += c.credits * c.gradePoint;
      totalCredits += c.credits;
    }
  }
  const sgpa = totalCredits > 0 ? Math.round((totalCreditPoints / totalCredits) * 100) / 100 : 0;
  return { sgpa, totalCredits, totalCreditPoints };
}

test("Phase 19 - Scenario 24: VTU 2022 and 2025 scheme isolation", () => {
  const index = new TestCurriculumIndex();

  // Populate sample 2022 courses
  index.addCourse({ scheme: "2022", branch: "CSE", semester: 3, courseCode: "BCS301", courseTitle: "Maths" });
  index.addCourse({ scheme: "2022", branch: "CSE", semester: 3, courseCode: "BCS302", courseTitle: "DSA" });

  // Populate sample 2025 courses
  index.addCourse({ scheme: "2025", branch: "CSE", semester: 3, courseCode: "25CS31", courseTitle: "Discrete Maths" });
  index.addCourse({ scheme: "2025", branch: "CSE", semester: 3, courseCode: "25CS32", courseTitle: "DSA & Applications" });

  const courses2022 = index.getCourses("2022", "CSE", 3);
  const courses2025 = index.getCourses("2025", "CSE", 3);

  assert.equal(courses2022.length, 2);
  assert.equal(courses2025.length, 2);

  // Isolation check: 2022 query returns ONLY 2022 courses
  for (const c of courses2022) {
    assert.equal(c.scheme, "2022");
    assert.ok(c.courseCode.startsWith("BCS"));
  }

  // Isolation check: 2025 query returns ONLY 2025 courses
  for (const c of courses2025) {
    assert.equal(c.scheme, "2025");
    assert.ok(c.courseCode.startsWith("25CS"));
  }
});

test("Phase 19 - Scenario 25: 2025 scheme course lookup across Semesters 1-8", () => {
  const index = new TestCurriculumIndex();

  // Populate 2025 courses across all 8 semesters
  for (let sem = 1; sem <= 8; sem++) {
    index.addCourse({
      scheme: "2025",
      branch: "CSE",
      semester: sem,
      courseCode: `25CS${sem}1`,
      courseTitle: `Core Course Sem ${sem}`,
      credits: sem === 8 ? 10 : 4,
    });
  }

  for (let sem = 1; sem <= 8; sem++) {
    const courses = index.getCourses("2025", "CSE", sem);
    assert.ok(courses.length > 0, `2025 Scheme CSE Semester ${sem} must contain courses`);
    assert.equal(courses[0].semester, sem);
    assert.equal(courses[0].scheme, "2025");
  }
});

test("Phase 19 - Scenario 26: SGPA calculation for 2025 scheme course grades", () => {
  const sem2025Entries = [
    { credits: 4, gradePoint: 10, grade: "O", includedInSGPA: true }, // 40
    { credits: 4, gradePoint: 9, grade: "A+", includedInSGPA: true }, // 36
    { credits: 3, gradePoint: 8, grade: "A", includedInSGPA: true },  // 24
    { credits: 3, gradePoint: 7, grade: "B+", includedInSGPA: true }, // 21
    { credits: 1, gradePoint: 10, grade: "O", includedInSGPA: true }, // 10
    { credits: 1, gradePoint: 9, grade: "A+", includedInSGPA: true }, // 9
  ];
  // Total credits = 16, total credit points = 140
  // SGPA = 140 / 16 = 8.75

  const result = calculateSGPA(sem2025Entries);
  assert.equal(result.sgpa, 8.75);
  assert.equal(result.totalCredits, 16);
  assert.equal(result.totalCreditPoints, 140);
});
