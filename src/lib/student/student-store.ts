/**
 * Saarvi Student Productivity Suite — Local-First Data Store
 * All student data (timetable, assignments, study plans, exams, notes)
 * is stored 100% locally in browser storage.
 * Zero server uploads. Zero cloud sync.
 */

export interface TimetableEntry {
  id: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  period: number;
  subject: string;
  room?: string;
  teacher?: string;
  startTime: string; // HH:MM e.g. "09:00"
  endTime: string;   // HH:MM e.g. "10:00"
  notes?: string;
}

export interface StudentAssignment {
  id: string;
  title: string;
  subject: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentStudySession {
  id: string;
  subject: string;
  topic: string;
  targetDate: string; // YYYY-MM-DD
  durationMinutes: number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentExam {
  id: string;
  examName: string;
  subject: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM e.g. "09:30"
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentStoreExport {
  version: number;
  exportedAt: string;
  timetable: TimetableEntry[];
  assignments: StudentAssignment[];
  studySessions: StudentStudySession[];
  exams: StudentExam[];
  notes: StudentNote[];
}

const STORAGE_KEYS = {
  TIMETABLE: "saarvi_student_timetable_v1",
  ASSIGNMENTS: "saarvi_student_assignments_v1",
  STUDY_SESSIONS: "saarvi_student_study_v1",
  EXAMS: "saarvi_student_exams_v1",
  NOTES: "saarvi_student_notes_v1",
};

// In-memory fallback for SSR and non-browser environments
const memoryStore: Record<string, string> = {};

function getItem(key: string): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore[key] || null;
    }
  }
  return memoryStore[key] || null;
}

function setItem(key: string, value: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {}
  }
  memoryStore[key] = value;
}

export class StudentStore {
  // =========================================================================
  // 1. TIMETABLE
  // =========================================================================

  public static getTimetable(): TimetableEntry[] {
    const data = getItem(STORAGE_KEYS.TIMETABLE);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public static addTimetableEntry(entry: Omit<TimetableEntry, "id">): TimetableEntry {
    const items = this.getTimetable();
    const newEntry: TimetableEntry = {
      ...entry,
      id: "tt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    };
    items.push(newEntry);
    setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(items));
    return newEntry;
  }

  public static updateTimetableEntry(id: string, updates: Partial<TimetableEntry>): TimetableEntry | null {
    const items = this.getTimetable();
    const idx = items.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates };
    setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(items));
    return items[idx];
  }

  public static deleteTimetableEntry(id: string): boolean {
    const items = this.getTimetable();
    const filtered = items.filter((t) => t.id !== id);
    if (filtered.length === items.length) return false;
    setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(filtered));
    return true;
  }

  public static duplicateTimetableEntry(id: string, targetDay?: TimetableEntry["day"]): TimetableEntry | null {
    const items = this.getTimetable();
    const src = items.find((t) => t.id === id);
    if (!src) return null;
    const duplicated: TimetableEntry = {
      ...src,
      id: "tt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      day: targetDay || src.day,
    };
    items.push(duplicated);
    setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(items));
    return duplicated;
  }

  // =========================================================================
  // 2. ASSIGNMENTS
  // =========================================================================

  public static getAssignments(): StudentAssignment[] {
    const data = getItem(STORAGE_KEYS.ASSIGNMENTS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public static addAssignment(assignment: Omit<StudentAssignment, "id" | "createdAt" | "updatedAt">): StudentAssignment {
    const items = this.getAssignments();
    const now = new Date().toISOString();
    const newAssignment: StudentAssignment = {
      ...assignment,
      id: "as_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      createdAt: now,
      updatedAt: now,
    };
    items.push(newAssignment);
    setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(items));
    return newAssignment;
  }

  public static updateAssignment(id: string, updates: Partial<StudentAssignment>): StudentAssignment | null {
    const items = this.getAssignments();
    const idx = items.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
    setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(items));
    return items[idx];
  }

  public static deleteAssignment(id: string): boolean {
    const items = this.getAssignments();
    const filtered = items.filter((a) => a.id !== id);
    if (filtered.length === items.length) return false;
    setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(filtered));
    return true;
  }

  // =========================================================================
  // 3. STUDY SESSIONS
  // =========================================================================

  public static getStudySessions(): StudentStudySession[] {
    const data = getItem(STORAGE_KEYS.STUDY_SESSIONS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public static addStudySession(session: Omit<StudentStudySession, "id" | "createdAt" | "updatedAt">): StudentStudySession {
    const items = this.getStudySessions();
    const now = new Date().toISOString();
    const newSession: StudentStudySession = {
      ...session,
      id: "ss_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      createdAt: now,
      updatedAt: now,
    };
    items.push(newSession);
    setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(items));
    return newSession;
  }

  public static updateStudySession(id: string, updates: Partial<StudentStudySession>): StudentStudySession | null {
    const items = this.getStudySessions();
    const idx = items.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
    setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(items));
    return items[idx];
  }

  public static deleteStudySession(id: string): boolean {
    const items = this.getStudySessions();
    const filtered = items.filter((s) => s.id !== id);
    if (filtered.length === items.length) return false;
    setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(filtered));
    return true;
  }

  // =========================================================================
  // 4. EXAMS & COUNTDOWN
  // =========================================================================

  public static getExams(): StudentExam[] {
    const data = getItem(STORAGE_KEYS.EXAMS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public static getExamsWithCountdown(): Array<StudentExam & { daysRemaining: number; isPassed: boolean }> {
    const exams = this.getExams();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return exams.map((exam) => {
      const examDate = new Date(exam.date);
      examDate.setHours(0, 0, 0, 0);
      const diffTime = examDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...exam,
        daysRemaining,
        isPassed: daysRemaining < 0,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  public static addExam(exam: Omit<StudentExam, "id" | "createdAt" | "updatedAt">): StudentExam {
    const items = this.getExams();
    const now = new Date().toISOString();
    const newExam: StudentExam = {
      ...exam,
      id: "ex_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      createdAt: now,
      updatedAt: now,
    };
    items.push(newExam);
    setItem(STORAGE_KEYS.EXAMS, JSON.stringify(items));
    return newExam;
  }

  public static deleteExam(id: string): boolean {
    const items = this.getExams();
    const filtered = items.filter((e) => e.id !== id);
    if (filtered.length === items.length) return false;
    setItem(STORAGE_KEYS.EXAMS, JSON.stringify(filtered));
    return true;
  }

  /**
   * Calculates genuine remaining days, hours, and status for an exam.
   */
  public static calculateExamCountdown(examDate: string, startTime = "09:00"): {
    daysRemaining: number;
    hoursRemaining: number;
    isPast: boolean;
    label: string;
  } {
    const examDateTime = new Date(`${examDate}T${startTime}:00`);
    const now = new Date();
    const diffMs = examDateTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { daysRemaining: 0, hoursRemaining: 0, isPast: true, label: "Exam Concluded" };
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let label = `${days} days, ${hours} hrs left`;
    if (days === 0) label = `${hours} hours left today`;
    else if (days === 1) label = `Tomorrow (${hours} hrs)`;

    return { daysRemaining: days, hoursRemaining: hours, isPast: false, label };
  }

  // =========================================================================
  // 5. NOTES & SEARCH
  // =========================================================================

  public static getNotes(): StudentNote[] {
    const data = getItem(STORAGE_KEYS.NOTES);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public static addNote(note: { title: string; content: string; tags?: string[] }): StudentNote {
    const items = this.getNotes();
    const now = new Date().toISOString();
    const newNote: StudentNote = {
      id: "nt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title: note.title.trim() || "Untitled Note",
      content: note.content || "",
      tags: note.tags || [],
      createdAt: now,
      updatedAt: now,
    };
    items.push(newNote);
    setItem(STORAGE_KEYS.NOTES, JSON.stringify(items));
    return newNote;
  }

  public static updateNote(id: string, updates: Partial<StudentNote>): StudentNote | null {
    const items = this.getNotes();
    const idx = items.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
    setItem(STORAGE_KEYS.NOTES, JSON.stringify(items));
    return items[idx];
  }

  public static deleteNote(id: string): boolean {
    const items = this.getNotes();
    const filtered = items.filter((n) => n.id !== id);
    if (filtered.length === items.length) return false;
    setItem(STORAGE_KEYS.NOTES, JSON.stringify(filtered));
    return true;
  }

  public static searchNotes(query: string): StudentNote[] {
    const clean = query.toLowerCase().trim();
    if (!clean) return this.getNotes();
    return this.getNotes().filter(
      (n) =>
        n.title.toLowerCase().includes(clean) ||
        n.content.toLowerCase().includes(clean) ||
        n.tags.some((t) => t.toLowerCase().includes(clean))
    );
  }

  // =========================================================================
  // 6. EXPORT & SAFE VALIDATED IMPORT
  // =========================================================================

  public static exportAllData(): StudentStoreExport {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      timetable: this.getTimetable(),
      assignments: this.getAssignments(),
      studySessions: this.getStudySessions(),
      exams: this.getExams(),
      notes: this.getNotes(),
    };
  }

  public static importAllData(jsonStr: string): { success: boolean; error?: string; count?: number } {
    try {
      if (!jsonStr || typeof jsonStr !== "string") {
        return { success: false, error: "Invalid import payload: input must be a JSON string." };
      }

      // Check size limit: max 5MB for student JSON backup
      if (jsonStr.length > 5 * 1024 * 1024) {
        return { success: false, error: "Import file exceeds the 5MB safety limit." };
      }

      const parsed = JSON.parse(jsonStr);

      // Defend against Prototype Pollution
      if (
        Object.prototype.hasOwnProperty.call(parsed, "__proto__") ||
        Object.prototype.hasOwnProperty.call(parsed, "constructor") ||
        Object.prototype.hasOwnProperty.call(parsed, "prototype")
      ) {
        return { success: false, error: "Malformed payload rejected for security reasons." };
      }

      let totalImported = 0;

      if (Array.isArray(parsed.timetable)) {
        setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(parsed.timetable));
        totalImported += parsed.timetable.length;
      }
      if (Array.isArray(parsed.assignments)) {
        setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(parsed.assignments));
        totalImported += parsed.assignments.length;
      }
      if (Array.isArray(parsed.studySessions)) {
        setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(parsed.studySessions));
        totalImported += parsed.studySessions.length;
      }
      if (Array.isArray(parsed.exams)) {
        setItem(STORAGE_KEYS.EXAMS, JSON.stringify(parsed.exams));
        totalImported += parsed.exams.length;
      }
      if (Array.isArray(parsed.notes)) {
        setItem(STORAGE_KEYS.NOTES, JSON.stringify(parsed.notes));
        totalImported += parsed.notes.length;
      }

      return { success: true, count: totalImported };
    } catch (err: any) {
      return { success: false, error: "Failed to parse import JSON: " + err.message };
    }
  }
}

export const studentStore = StudentStore;
