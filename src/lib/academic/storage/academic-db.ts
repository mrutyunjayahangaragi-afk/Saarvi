import {
  StudentAcademicProfile,
  SemesterRecord,
  AttendanceRecord,
  AcademicGoalRecord,
  CalculationHistoryEntry,
  AcademicExportPayload,
} from "../types";
import {
  TaskItem,
  Assignment,
  ExamRecord,
  TimetableEntry,
  StudySession,
  StudentGoal,
  CertificateRecord,
  InternshipApplication,
  HackathonRecord,
} from "@/types/student";
import {
  CareerProfile,
  ResumeVersion,
  ResumeSnapshot,
  CoverLetterVersion,
  JobApplication,
  InterviewRecord,
  CareerSkill,
  CareerWorkspaceExportPayload,
} from "@/types/career";
import {
  Conversation,
  ConversationMessage,
  ConversationExportPayload,
} from "@/types/conversation";

const DB_NAME = "DocEaseAcademicDB";
const DB_VERSION = 4;

const STORES = {
  PROFILES: "studentProfiles",
  SEMESTERS: "semesterRecords",
  ATTENDANCE: "attendanceRecords",
  GOALS: "academicGoals",
  HISTORY: "calculationHistory",
  TASKS: "tasks",
  ASSIGNMENTS: "assignments",
  EXAMS: "exams",
  TIMETABLE: "timetable",
  STUDY_SESSIONS: "studySessions",
  STUDENT_GOALS: "studentGoals",
  CERTIFICATES: "certificates",
  INTERNSHIPS: "internships",
  HACKATHONS: "hackathons",
  CAREER_PROFILES: "careerProfiles",
  RESUME_VERSIONS: "resumeVersions",
  RESUME_SNAPSHOTS: "resumeSnapshots",
  COVER_LETTERS: "coverLetters",
  JOB_APPLICATIONS: "jobApplications",
  INTERVIEWS: "interviews",
  CAREER_SKILLS: "careerSkills",
  CONVERSATIONS: "conversations",
  CONVERSATION_MESSAGES: "conversationMessages",
} as const;

// In-Memory fallback cache for SSR, Jest, and Node.js testing
const memoryStore = {
  profiles: new Map<string, StudentAcademicProfile>(),
  semesters: new Map<string, SemesterRecord>(),
  attendance: new Map<string, AttendanceRecord>(),
  goals: new Map<string, AcademicGoalRecord>(),
  history: new Map<string, CalculationHistoryEntry>(),
  tasks: new Map<string, TaskItem>(),
  assignments: new Map<string, Assignment>(),
  exams: new Map<string, ExamRecord>(),
  timetable: new Map<string, TimetableEntry>(),
  studySessions: new Map<string, StudySession>(),
  studentGoals: new Map<string, StudentGoal>(),
  certificates: new Map<string, CertificateRecord>(),
  internships: new Map<string, InternshipApplication>(),
  hackathons: new Map<string, HackathonRecord>(),
  careerProfiles: new Map<string, CareerProfile>(),
  resumeVersions: new Map<string, ResumeVersion>(),
  resumeSnapshots: new Map<string, ResumeSnapshot>(),
  coverLetters: new Map<string, CoverLetterVersion>(),
  jobApplications: new Map<string, JobApplication>(),
  interviews: new Map<string, InterviewRecord>(),
  careerSkills: new Map<string, CareerSkill>(),
  conversations: new Map<string, Conversation>(),
  conversationMessages: new Map<string, ConversationMessage>(),
};

function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error("IndexedDB is unavailable"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Version 1 stores
      if (!db.objectStoreNames.contains(STORES.PROFILES)) {
        db.createObjectStore(STORES.PROFILES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.SEMESTERS)) {
        const semStore = db.createObjectStore(STORES.SEMESTERS, { keyPath: "id" });
        semStore.createIndex("profileId", "profileId", { unique: false });
        semStore.createIndex("semester", "semester", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.ATTENDANCE)) {
        const attStore = db.createObjectStore(STORES.ATTENDANCE, { keyPath: "id" });
        attStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.GOALS)) {
        const goalStore = db.createObjectStore(STORES.GOALS, { keyPath: "id" });
        goalStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        const histStore = db.createObjectStore(STORES.HISTORY, { keyPath: "id" });
        histStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Version 2 Productivity stores
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const taskStore = db.createObjectStore(STORES.TASKS, { keyPath: "id" });
        taskStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.ASSIGNMENTS)) {
        const asgnStore = db.createObjectStore(STORES.ASSIGNMENTS, { keyPath: "id" });
        asgnStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.EXAMS)) {
        const examStore = db.createObjectStore(STORES.EXAMS, { keyPath: "id" });
        examStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.TIMETABLE)) {
        const ttStore = db.createObjectStore(STORES.TIMETABLE, { keyPath: "id" });
        ttStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.STUDY_SESSIONS)) {
        const ssStore = db.createObjectStore(STORES.STUDY_SESSIONS, { keyPath: "id" });
        ssStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.STUDENT_GOALS)) {
        const sgStore = db.createObjectStore(STORES.STUDENT_GOALS, { keyPath: "id" });
        sgStore.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.CERTIFICATES)) {
        db.createObjectStore(STORES.CERTIFICATES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.INTERNSHIPS)) {
        db.createObjectStore(STORES.INTERNSHIPS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.HACKATHONS)) {
        db.createObjectStore(STORES.HACKATHONS, { keyPath: "id" });
      }

      // Version 3 Career stores
      if (!db.objectStoreNames.contains(STORES.CAREER_PROFILES)) {
        db.createObjectStore(STORES.CAREER_PROFILES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.RESUME_VERSIONS)) {
        const rvStore = db.createObjectStore(STORES.RESUME_VERSIONS, { keyPath: "id" });
        rvStore.createIndex("targetRole", "targetRole", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.RESUME_SNAPSHOTS)) {
        const snapStore = db.createObjectStore(STORES.RESUME_SNAPSHOTS, { keyPath: "id" });
        snapStore.createIndex("resumeVersionId", "resumeVersionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.COVER_LETTERS)) {
        db.createObjectStore(STORES.COVER_LETTERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.JOB_APPLICATIONS)) {
        const appStore = db.createObjectStore(STORES.JOB_APPLICATIONS, { keyPath: "id" });
        appStore.createIndex("status", "status", { unique: false });
        appStore.createIndex("deadline", "deadline", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.INTERVIEWS)) {
        const intStore = db.createObjectStore(STORES.INTERVIEWS, { keyPath: "id" });
        intStore.createIndex("applicationId", "applicationId", { unique: false });
        intStore.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.CAREER_SKILLS)) {
        const skStore = db.createObjectStore(STORES.CAREER_SKILLS, { keyPath: "id" });
        skStore.createIndex("category", "category", { unique: false });
      }

      // Version 4 Conversation stores
      if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
        const convStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: "id" });
        convStore.createIndex("profileId", "profileId", { unique: false });
        convStore.createIndex("updatedAt", "updatedAt", { unique: false });
        convStore.createIndex("pinned", "pinned", { unique: false });
        convStore.createIndex("archived", "archived", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.CONVERSATION_MESSAGES)) {
        const msgStore = db.createObjectStore(STORES.CONVERSATION_MESSAGES, { keyPath: "id" });
        msgStore.createIndex("conversationId", "conversationId", { unique: false });
        msgStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

function executeTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        try {
          const tx = db.transaction(storeName, mode);
          const store = tx.objectStore(storeName);
          const request = operation(store);

          if (request) {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          } else {
            tx.oncomplete = () => resolve(undefined as unknown as T);
          }
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      })
  );
}

export const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_IMPORT_ARRAY_ENTRIES = 5000;

export function safeJsonParse<T = unknown>(jsonString: string): T {
  if (typeof jsonString !== "string" || jsonString.length > MAX_IMPORT_SIZE_BYTES) {
    throw new Error(`Import payload exceeds maximum safe size of ${MAX_IMPORT_SIZE_BYTES / (1024 * 1024)}MB`);
  }
  return JSON.parse(jsonString, (key, value) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return undefined;
    }
    return value;
  }) as T;
}

let currentActiveProfileId = "guest";

export const academicStorage = {
  /**
   * Scopes the active workspace identity.
   * When Account A logs in, sets to Account A's ID.
   * When Account A logs out, resets to 'guest'.
   * When Account B logs in, sets to Account B's ID.
   */
  setActiveProfileId(profileId: string | null | undefined): void {
    currentActiveProfileId = (profileId && profileId.trim()) ? profileId.trim() : "guest";
  },

  getActiveProfileId(): string {
    return currentActiveProfileId;
  },

  // ==========================================
  // STUDENT PROFILES
  // ==========================================
  async saveProfile(profile: StudentAcademicProfile): Promise<StudentAcademicProfile> {
    const cleanProfile: StudentAcademicProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };

    if (!isIndexedDBAvailable()) {
      memoryStore.profiles.set(cleanProfile.id, cleanProfile);
      return cleanProfile;
    }

    try {
      await executeTx(STORES.PROFILES, "readwrite", (store) => store.put(cleanProfile));
      return cleanProfile;
    } catch {
      memoryStore.profiles.set(cleanProfile.id, cleanProfile);
      return cleanProfile;
    }
  },

  async getProfile(id: string): Promise<StudentAcademicProfile | null> {
    if (!isIndexedDBAvailable()) {
      return memoryStore.profiles.get(id) || null;
    }

    try {
      const result = await executeTx<StudentAcademicProfile | undefined>(
        STORES.PROFILES,
        "readonly",
        (store) => store.get(id)
      );
      return result || null;
    } catch {
      return memoryStore.profiles.get(id) || null;
    }
  },

  async getAllProfiles(): Promise<StudentAcademicProfile[]> {
    if (!isIndexedDBAvailable()) {
      return Array.from(memoryStore.profiles.values());
    }

    try {
      const result = await executeTx<StudentAcademicProfile[]>(
        STORES.PROFILES,
        "readonly",
        (store) => store.getAll()
      );
      return result || [];
    } catch {
      return Array.from(memoryStore.profiles.values());
    }
  },

  // ==========================================
  // SEMESTER RECORDS
  // ==========================================
  async saveSemesterRecord(record: SemesterRecord): Promise<SemesterRecord> {
    const effectiveProfileId = (!record.profileId || record.profileId === "default_profile")
      ? currentActiveProfileId
      : record.profileId;
    const recordId = (record.id.startsWith("sem_") && !record.id.includes(effectiveProfileId))
      ? `${effectiveProfileId}_${record.id}`
      : record.id;
    const cleanRecord: SemesterRecord = {
      ...record,
      id: recordId,
      profileId: effectiveProfileId,
      updatedAt: new Date().toISOString(),
    };

    if (!isIndexedDBAvailable()) {
      memoryStore.semesters.set(cleanRecord.id, cleanRecord);
      return cleanRecord;
    }

    try {
      await executeTx(STORES.SEMESTERS, "readwrite", (store) => store.put(cleanRecord));
      return cleanRecord;
    } catch {
      memoryStore.semesters.set(cleanRecord.id, cleanRecord);
      return cleanRecord;
    }
  },

  async getSemesterRecord(id: string): Promise<SemesterRecord | null> {
    const candidateIds = [id, `${currentActiveProfileId}_${id}`];
    if (!isIndexedDBAvailable()) {
      for (const cid of candidateIds) {
        const found = memoryStore.semesters.get(cid);
        if (found) return found;
      }
      return null;
    }

    try {
      for (const cid of candidateIds) {
        const result = await executeTx<SemesterRecord | undefined>(
          STORES.SEMESTERS,
          "readonly",
          (store) => store.get(cid)
        );
        if (result) return result;
      }
      return null;
    } catch {
      for (const cid of candidateIds) {
        const found = memoryStore.semesters.get(cid);
        if (found) return found;
      }
      return null;
    }
  },

  async getSemesterRecords(profileId?: string): Promise<SemesterRecord[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (r: SemesterRecord) =>
      r.profileId === targetId || (targetId === "guest" && (!r.profileId || r.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.semesters.values());
      return all.filter(isMatch).sort((a, b) => a.semester - b.semester);
    }

    try {
      const result = await executeTx<SemesterRecord[]>(STORES.SEMESTERS, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch).sort((a, b) => a.semester - b.semester);
    } catch {
      const all = Array.from(memoryStore.semesters.values());
      return all.filter(isMatch).sort((a, b) => a.semester - b.semester);
    }
  },

  async deleteSemesterRecord(id: string): Promise<void> {
    const candidateIds = [id, `${currentActiveProfileId}_${id}`];
    for (const cid of candidateIds) {
      memoryStore.semesters.delete(cid);
    }
    if (isIndexedDBAvailable()) {
      try {
        for (const cid of candidateIds) {
          await executeTx(STORES.SEMESTERS, "readwrite", (store) => store.delete(cid));
        }
      } catch (e) {
        console.warn("IndexedDB deleteSemesterRecord failed:", e);
      }
    }
  },

  // ==========================================
  // ATTENDANCE RECORDS
  // ==========================================
  async saveAttendanceRecord(record: AttendanceRecord): Promise<AttendanceRecord> {
    const effectiveProfileId = (!record.profileId || record.profileId === "default_profile")
      ? currentActiveProfileId
      : record.profileId;
    const cleanRecord: AttendanceRecord = {
      ...record,
      profileId: effectiveProfileId,
      updatedAt: new Date().toISOString(),
    };

    if (!isIndexedDBAvailable()) {
      memoryStore.attendance.set(cleanRecord.id, cleanRecord);
      return cleanRecord;
    }

    try {
      await executeTx(STORES.ATTENDANCE, "readwrite", (store) => store.put(cleanRecord));
      return cleanRecord;
    } catch {
      memoryStore.attendance.set(cleanRecord.id, cleanRecord);
      return cleanRecord;
    }
  },

  async getAttendanceRecords(profileId?: string): Promise<AttendanceRecord[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (a: AttendanceRecord) =>
      a.profileId === targetId || (targetId === "guest" && (!a.profileId || a.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.attendance.values());
      return all.filter(isMatch);
    }

    try {
      const result = await executeTx<AttendanceRecord[]>(STORES.ATTENDANCE, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.attendance.values());
      return all.filter(isMatch);
    }
  },

  async deleteAttendanceRecord(id: string): Promise<void> {
    memoryStore.attendance.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.ATTENDANCE, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteAttendanceRecord failed:", e);
      }
    }
  },

  // ==========================================
  // CALCULATION HISTORY
  // ==========================================
  async addHistoryEntry(
    entry: Omit<CalculationHistoryEntry, "id" | "timestamp">
  ): Promise<CalculationHistoryEntry> {
    const fullEntry: CalculationHistoryEntry = {
      ...entry,
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    if (!isIndexedDBAvailable()) {
      memoryStore.history.set(fullEntry.id, fullEntry);
      return fullEntry;
    }

    try {
      await executeTx(STORES.HISTORY, "readwrite", (store) => store.put(fullEntry));
      return fullEntry;
    } catch {
      memoryStore.history.set(fullEntry.id, fullEntry);
      return fullEntry;
    }
  },

  async getHistory(limit = 20): Promise<CalculationHistoryEntry[]> {
    if (!isIndexedDBAvailable()) {
      return Array.from(memoryStore.history.values())
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);
    }

    try {
      const result = await executeTx<CalculationHistoryEntry[]>(
        STORES.HISTORY,
        "readonly",
        (store) => store.getAll()
      );
      const all = result || [];
      return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
    } catch {
      return Array.from(memoryStore.history.values())
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);
    }
  },

  // ==========================================
  // TASKS
  // ==========================================
  async saveTask(task: TaskItem): Promise<TaskItem> {
    const effectiveId = (!task.profileId || task.profileId === "default_profile")
      ? currentActiveProfileId
      : task.profileId;
    const clean: TaskItem = {
      ...task,
      profileId: effectiveId,
      userId: task.userId || effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.tasks.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.TASKS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.tasks.set(clean.id, clean);
      return clean;
    }
  },

  async getTasks(profileId?: string): Promise<TaskItem[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (t: TaskItem) =>
      t.profileId === targetId || t.userId === targetId || (targetId === "guest" && (!t.profileId || t.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.tasks.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<TaskItem[]>(STORES.TASKS, "readonly", (store) => store.getAll());
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.tasks.values());
      return all.filter(isMatch);
    }
  },

  async deleteTask(id: string): Promise<void> {
    memoryStore.tasks.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.TASKS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteTask failed:", e);
      }
    }
  },

  // ==========================================
  // ASSIGNMENTS
  // ==========================================
  async saveAssignment(asgn: Assignment): Promise<Assignment> {
    const effectiveId = (!asgn.profileId || asgn.profileId === "default_profile")
      ? currentActiveProfileId
      : asgn.profileId;
    const clean: Assignment = {
      ...asgn,
      profileId: effectiveId,
      userId: asgn.userId || effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.assignments.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.ASSIGNMENTS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.assignments.set(clean.id, clean);
      return clean;
    }
  },

  async getAssignments(profileId?: string): Promise<Assignment[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (a: Assignment) =>
      a.profileId === targetId || a.userId === targetId || (targetId === "guest" && (!a.profileId || a.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.assignments.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<Assignment[]>(STORES.ASSIGNMENTS, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.assignments.values());
      return all.filter(isMatch);
    }
  },

  async deleteAssignment(id: string): Promise<void> {
    memoryStore.assignments.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.ASSIGNMENTS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteAssignment failed:", e);
      }
    }
  },

  // ==========================================
  // EXAMS
  // ==========================================
  async saveExam(exam: ExamRecord): Promise<ExamRecord> {
    const effectiveId = (!exam.profileId || exam.profileId === "default_profile")
      ? currentActiveProfileId
      : exam.profileId;
    const clean: ExamRecord = {
      ...exam,
      profileId: effectiveId,
      userId: exam.userId || effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.exams.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.EXAMS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.exams.set(clean.id, clean);
      return clean;
    }
  },

  async getExams(profileId?: string): Promise<ExamRecord[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (e: ExamRecord) =>
      e.profileId === targetId || e.userId === targetId || (targetId === "guest" && (!e.profileId || e.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.exams.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<ExamRecord[]>(STORES.EXAMS, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.exams.values());
      return all.filter(isMatch);
    }
  },

  async deleteExam(id: string): Promise<void> {
    memoryStore.exams.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.EXAMS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteExam failed:", e);
      }
    }
  },

  // ==========================================
  // TIMETABLE
  // ==========================================
  async saveTimetableEntry(entry: TimetableEntry): Promise<TimetableEntry> {
    const effectiveId = (!entry.profileId || entry.profileId === "default_profile")
      ? currentActiveProfileId
      : entry.profileId;
    const clean: TimetableEntry = {
      ...entry,
      profileId: effectiveId,
      userId: entry.userId || effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.timetable.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.TIMETABLE, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.timetable.set(clean.id, clean);
      return clean;
    }
  },

  async getTimetable(profileId?: string): Promise<TimetableEntry[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (t: TimetableEntry) =>
      t.profileId === targetId || t.userId === targetId || (targetId === "guest" && (!t.profileId || t.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.timetable.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<TimetableEntry[]>(STORES.TIMETABLE, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.timetable.values());
      return all.filter(isMatch);
    }
  },

  async deleteTimetableEntry(id: string): Promise<void> {
    memoryStore.timetable.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.TIMETABLE, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteTimetableEntry failed:", e);
      }
    }
  },

  // ==========================================
  // STUDY SESSIONS
  // ==========================================
  async saveStudySession(session: StudySession): Promise<StudySession> {
    const effectiveId = (!session.profileId || session.profileId === "default_profile")
      ? currentActiveProfileId
      : session.profileId;
    const clean: StudySession = {
      ...session,
      profileId: effectiveId,
      userId: session.userId || effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.studySessions.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.STUDY_SESSIONS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.studySessions.set(clean.id, clean);
      return clean;
    }
  },

  async getStudySessions(profileId?: string): Promise<StudySession[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (s: StudySession) =>
      s.profileId === targetId || s.userId === targetId || (targetId === "guest" && (!s.profileId || s.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.studySessions.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<StudySession[]>(STORES.STUDY_SESSIONS, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.studySessions.values());
      return all.filter(isMatch);
    }
  },

  async deleteStudySession(id: string): Promise<void> {
    memoryStore.studySessions.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.STUDY_SESSIONS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteStudySession failed:", e);
      }
    }
  },

  // ==========================================
  // STUDENT GOALS
  // ==========================================
  async saveStudentGoal(goal: StudentGoal): Promise<StudentGoal> {
    const effectiveId = (!goal.profileId || goal.profileId === "default_profile")
      ? currentActiveProfileId
      : goal.profileId;
    const clean: StudentGoal = {
      ...goal,
      profileId: effectiveId,
      userId: goal.userId || effectiveId,
      progress: Math.max(0, Math.min(100, isNaN(goal.progress) ? 0 : goal.progress)),
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.studentGoals.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.STUDENT_GOALS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.studentGoals.set(clean.id, clean);
      return clean;
    }
  },

  async getStudentGoals(profileId?: string): Promise<StudentGoal[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (g: StudentGoal) =>
      g.profileId === targetId || g.userId === targetId || (targetId === "guest" && (!g.profileId || g.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.studentGoals.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<StudentGoal[]>(STORES.STUDENT_GOALS, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.studentGoals.values());
      return all.filter(isMatch);
    }
  },

  async deleteStudentGoal(id: string): Promise<void> {
    memoryStore.studentGoals.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.STUDENT_GOALS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteStudentGoal failed:", e);
      }
    }
  },

  // ==========================================
  // CERTIFICATES
  // ==========================================
  async saveCertificate(cert: CertificateRecord): Promise<CertificateRecord> {
    const effectiveId = (!cert.userId && !cert.profileId) ? currentActiveProfileId : (cert.userId || cert.profileId);
    const clean: CertificateRecord = {
      ...cert,
      userId: effectiveId,
      profileId: effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.certificates.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.CERTIFICATES, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.certificates.set(clean.id, clean);
      return clean;
    }
  },

  async getCertificates(profileId?: string): Promise<CertificateRecord[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (c: CertificateRecord) =>
      c.userId === targetId || c.profileId === targetId || (targetId === "guest" && (!c.userId || c.userId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.certificates.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<CertificateRecord[]>(STORES.CERTIFICATES, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.certificates.values());
      return all.filter(isMatch);
    }
  },

  async deleteCertificate(id: string): Promise<void> {
    memoryStore.certificates.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.CERTIFICATES, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteCertificate failed:", e);
      }
    }
  },

  // ==========================================
  // INTERNSHIPS
  // ==========================================
  async saveInternship(intern: InternshipApplication): Promise<InternshipApplication> {
    const effectiveId = (!intern.userId && !intern.profileId) ? currentActiveProfileId : (intern.userId || intern.profileId);
    const clean: InternshipApplication = {
      ...intern,
      userId: effectiveId,
      profileId: effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.internships.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.INTERNSHIPS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.internships.set(clean.id, clean);
      return clean;
    }
  },

  async getInternships(profileId?: string): Promise<InternshipApplication[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (i: InternshipApplication) =>
      i.userId === targetId || i.profileId === targetId || (targetId === "guest" && (!i.userId || i.userId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.internships.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<InternshipApplication[]>(
        STORES.INTERNSHIPS,
        "readonly",
        (store) => store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.internships.values());
      return all.filter(isMatch);
    }
  },

  async deleteInternship(id: string): Promise<void> {
    memoryStore.internships.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.INTERNSHIPS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteInternship failed:", e);
      }
    }
  },

  // ==========================================
  // HACKATHONS
  // ==========================================
  async saveHackathon(hack: HackathonRecord): Promise<HackathonRecord> {
    const effectiveId = (!hack.userId && !hack.profileId) ? currentActiveProfileId : (hack.userId || hack.profileId);
    const clean: HackathonRecord = {
      ...hack,
      userId: effectiveId,
      profileId: effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.hackathons.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.HACKATHONS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.hackathons.set(clean.id, clean);
      return clean;
    }
  },

  async getHackathons(profileId?: string): Promise<HackathonRecord[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (h: HackathonRecord) =>
      h.userId === targetId || h.profileId === targetId || (targetId === "guest" && (!h.userId || h.userId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.hackathons.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<HackathonRecord[]>(STORES.HACKATHONS, "readonly", (store) =>
        store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.hackathons.values());
      return all.filter(isMatch);
    }
  },

  async deleteHackathon(id: string): Promise<void> {
    memoryStore.hackathons.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.HACKATHONS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteHackathon failed:", e);
      }
    }
  },

  // ==========================================
  // FAST LOCAL WORKSPACE SEARCH
  // ==========================================
  async searchWorkspace(query: string, profileId?: string): Promise<
    Array<{ id: string; type: string; title: string; subtitle: string; route: string }>
  > {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [];
    const targetId = profileId || currentActiveProfileId;

    const [tasks, asgns, exams, tt, sessions, goals, certs, interns, hacks] = await Promise.all([
      this.getTasks(targetId),
      this.getAssignments(targetId),
      this.getExams(targetId),
      this.getTimetable(targetId),
      this.getStudySessions(targetId),
      this.getStudentGoals(targetId),
      this.getCertificates(targetId),
      this.getInternships(targetId),
      this.getHackathons(targetId),
    ]);

    const results: Array<{ id: string; type: string; title: string; subtitle: string; route: string }> = [];

    for (const t of tasks) {
      if (t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))) {
        results.push({ id: t.id, type: "Task", title: t.title, subtitle: t.category || "Task", route: "/student/tasks" });
      }
    }
    for (const a of asgns) {
      if (a.title.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q)) {
        results.push({ id: a.id, type: "Assignment", title: a.title, subtitle: a.subject, route: "/student/assignment-planner" });
      }
    }
    for (const e of exams) {
      if (e.subject.toLowerCase().includes(q) || e.examType.toLowerCase().includes(q)) {
        results.push({ id: e.id, type: "Exam", title: `${e.subject} (${e.examType})`, subtitle: e.date, route: "/student/exams" });
      }
    }
    for (const c of tt) {
      if (c.subject.toLowerCase().includes(q) || (c.room && c.room.toLowerCase().includes(q))) {
        results.push({ id: c.id, type: "Class", title: c.subject, subtitle: `${c.day} ${c.startTime}`, route: "/student/timetable" });
      }
    }
    for (const s of sessions) {
      if (s.subject.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q)) {
        results.push({ id: s.id, type: "Study", title: s.subject, subtitle: s.topic, route: "/student/study-planner" });
      }
    }
    for (const g of goals) {
      if (g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)) {
        results.push({ id: g.id, type: "Goal", title: g.title, subtitle: `${g.category} (${g.progress}%)`, route: "/student/goals" });
      }
    }
    for (const crt of certs) {
      if (crt.name.toLowerCase().includes(q) || crt.issuer.toLowerCase().includes(q)) {
        results.push({ id: crt.id, type: "Certificate", title: crt.name, subtitle: crt.issuer, route: "/student/certificates" });
      }
    }
    for (const i of interns) {
      if (i.company.toLowerCase().includes(q) || i.role.toLowerCase().includes(q)) {
        results.push({ id: i.id, type: "Internship", title: i.company, subtitle: i.role, route: "/student/internships" });
      }
    }
    for (const h of hacks) {
      if (h.name.toLowerCase().includes(q) || h.organizer.toLowerCase().includes(q)) {
        results.push({ id: h.id, type: "Hackathon", title: h.name, subtitle: h.organizer, route: "/student/hackathons" });
      }
    }

    return results.slice(0, 30);
  },

  // ==========================================
  // FULL WORKSPACE EXPORT & IMPORT
  // ==========================================
  async exportFullWorkspace(profileId?: string): Promise<string> {
    const [
      profiles,
      semesters,
      attendance,
      history,
      tasks,
      assignments,
      exams,
      timetable,
      studySessions,
      goals,
      certificates,
      internships,
      hackathons,
    ] = await Promise.all([
      this.getAllProfiles(),
      this.getSemesterRecords(),
      this.getAttendanceRecords(),
      this.getHistory(),
      this.getTasks(),
      this.getAssignments(),
      this.getExams(),
      this.getTimetable(),
      this.getStudySessions(),
      this.getStudentGoals(),
      this.getCertificates(),
      this.getInternships(),
      this.getHackathons(),
    ]);

    const payload = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      application: "Saarvi",
      profile: profiles[0] || undefined,
      semesters,
      attendance,
      history: history.slice(0, 50),
      tasks,
      assignments,
      exams,
      timetable,
      studySessions,
      goals,
      certificates,
      internships,
      hackathons,
    };

    return JSON.stringify(payload, null, 2);
  },

  async importFullWorkspace(jsonString: string): Promise<{
    importedCounts: Record<string, number>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const counts: Record<string, number> = {
      semesters: 0,
      attendance: 0,
      tasks: 0,
      assignments: 0,
      exams: 0,
      timetable: 0,
      studySessions: 0,
      goals: 0,
      certificates: 0,
      internships: 0,
      hackathons: 0,
    };

    if (!jsonString || typeof jsonString !== "string") {
      throw new Error("Import payload must be a non-empty string");
    }

    if (jsonString.length > MAX_IMPORT_SIZE_BYTES) {
      throw new Error(`Import payload exceeds maximum safe size of ${MAX_IMPORT_SIZE_BYTES / (1024 * 1024)}MB`);
    }

    let parsed: unknown;
    try {
      parsed = safeJsonParse(jsonString);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("maximum safe size")) {
        throw err;
      }
      throw new Error("Invalid JSON format");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Imported data must be an object");
    }

    const data = parsed as Record<string, unknown>;
    if (data.application !== "Saarvi" && data.application !== "DocEase") {
      throw new Error("Invalid export file: missing Saarvi application identifier");
    }

    // Guard against array-based DoS / memory exhaustion
    const arrayKeys = [
      "semesters",
      "attendance",
      "tasks",
      "assignments",
      "exams",
      "timetable",
      "studySessions",
      "goals",
      "certificates",
      "internships",
      "hackathons",
    ];
    for (const key of arrayKeys) {
      if (Array.isArray(data[key]) && (data[key] as unknown[]).length > MAX_IMPORT_ARRAY_ENTRIES) {
        throw new Error(
          `Import contains too many ${key} entries (maximum allowed: ${MAX_IMPORT_ARRAY_ENTRIES})`
        );
      }
    }

    // Step 1: Pre-validate and collect all candidate records in memory before writing to storage
    let profileToSave: StudentAcademicProfile | null = null;
    if (data.profile && typeof data.profile === "object") {
      const p = data.profile as StudentAcademicProfile;
      if (p.id && p.university && p.scheme) {
        profileToSave = p;
      }
    }

    const semestersToSave: SemesterRecord[] = [];
    if (Array.isArray(data.semesters)) {
      for (const sem of data.semesters) {
        if (
          sem &&
          typeof sem === "object" &&
          typeof sem.semester === "number" &&
          sem.semester >= 1 &&
          sem.semester <= 8 &&
          typeof sem.sgpa === "number" &&
          !isNaN(sem.sgpa) &&
          sem.sgpa >= 0 &&
          sem.sgpa <= 10
        ) {
          semestersToSave.push(sem as SemesterRecord);
          counts.semesters++;
        } else {
          errors.push(`Invalid semester record skipped`);
        }
      }
    }

    const attendanceToSave: AttendanceRecord[] = [];
    if (Array.isArray(data.attendance)) {
      for (const att of data.attendance) {
        if (
          att &&
          typeof att === "object" &&
          typeof att.subjectName === "string" &&
          typeof att.totalClasses === "number" &&
          typeof att.attendedClasses === "number" &&
          att.totalClasses >= 0 &&
          att.attendedClasses >= 0 &&
          att.attendedClasses <= att.totalClasses
        ) {
          attendanceToSave.push(att as AttendanceRecord);
          counts.attendance++;
        } else {
          errors.push(`Invalid attendance record skipped`);
        }
      }
    }

    const tasksToSave: TaskItem[] = [];
    if (Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        if (t && typeof t === "object" && t.title && t.id) {
          tasksToSave.push(t as TaskItem);
          counts.tasks++;
        }
      }
    }

    const assignmentsToSave: Assignment[] = [];
    if (Array.isArray(data.assignments)) {
      for (const a of data.assignments) {
        if (a && typeof a === "object" && a.title && a.subject && a.dueDate) {
          assignmentsToSave.push(a as Assignment);
          counts.assignments++;
        }
      }
    }

    const examsToSave: ExamRecord[] = [];
    if (Array.isArray(data.exams)) {
      for (const e of data.exams) {
        if (e && typeof e === "object" && e.subject && e.date) {
          examsToSave.push(e as ExamRecord);
          counts.exams++;
        }
      }
    }

    const timetableToSave: TimetableEntry[] = [];
    if (Array.isArray(data.timetable)) {
      for (const tt of data.timetable) {
        if (tt && typeof tt === "object" && tt.subject && tt.day && tt.startTime) {
          timetableToSave.push(tt as TimetableEntry);
          counts.timetable++;
        }
      }
    }

    const studySessionsToSave: StudySession[] = [];
    if (Array.isArray(data.studySessions)) {
      for (const s of data.studySessions) {
        if (s && typeof s === "object" && s.subject && s.date) {
          studySessionsToSave.push(s as StudySession);
          counts.studySessions++;
        }
      }
    }

    const goalsToSave: StudentGoal[] = [];
    if (Array.isArray(data.goals)) {
      for (const g of data.goals) {
        if (g && typeof g === "object" && g.title && g.category) {
          goalsToSave.push(g as StudentGoal);
          counts.goals++;
        }
      }
    }

    const certificatesToSave: CertificateRecord[] = [];
    if (Array.isArray(data.certificates)) {
      for (const c of data.certificates) {
        if (c && typeof c === "object" && c.name && c.issuer) {
          certificatesToSave.push(c as CertificateRecord);
          counts.certificates++;
        }
      }
    }

    const internshipsToSave: InternshipApplication[] = [];
    if (Array.isArray(data.internships)) {
      for (const i of data.internships) {
        if (i && typeof i === "object" && i.company && i.role) {
          internshipsToSave.push(i as InternshipApplication);
          counts.internships++;
        }
      }
    }

    const hackathonsToSave: HackathonRecord[] = [];
    if (Array.isArray(data.hackathons)) {
      for (const h of data.hackathons) {
        if (h && typeof h === "object" && h.name && h.organizer) {
          hackathonsToSave.push(h as HackathonRecord);
          counts.hackathons++;
        }
      }
    }

    // Step 2: Atomic Execution across all stores in a single transaction
    if (isIndexedDBAvailable()) {
      const storesToTouch: string[] = [];
      if (profileToSave) storesToTouch.push(STORES.PROFILES);
      if (semestersToSave.length > 0) storesToTouch.push(STORES.SEMESTERS);
      if (attendanceToSave.length > 0) storesToTouch.push(STORES.ATTENDANCE);
      if (tasksToSave.length > 0) storesToTouch.push(STORES.TASKS);
      if (assignmentsToSave.length > 0) storesToTouch.push(STORES.ASSIGNMENTS);
      if (examsToSave.length > 0) storesToTouch.push(STORES.EXAMS);
      if (timetableToSave.length > 0) storesToTouch.push(STORES.TIMETABLE);
      if (studySessionsToSave.length > 0) storesToTouch.push(STORES.STUDY_SESSIONS);
      if (goalsToSave.length > 0) storesToTouch.push(STORES.STUDENT_GOALS);
      if (certificatesToSave.length > 0) storesToTouch.push(STORES.CERTIFICATES);
      if (internshipsToSave.length > 0) storesToTouch.push(STORES.INTERNSHIPS);
      if (hackathonsToSave.length > 0) storesToTouch.push(STORES.HACKATHONS);

      if (storesToTouch.length > 0) {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
          try {
            const tx = db.transaction(storesToTouch, "readwrite");
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error("Atomic import transaction failed"));
            tx.onabort = () => reject(new Error("Atomic import transaction aborted"));

            if (profileToSave && storesToTouch.includes(STORES.PROFILES)) {
              tx.objectStore(STORES.PROFILES).put(profileToSave);
            }
            for (const sem of semestersToSave) {
              tx.objectStore(STORES.SEMESTERS).put(sem);
            }
            for (const att of attendanceToSave) {
              tx.objectStore(STORES.ATTENDANCE).put(att);
            }
            for (const t of tasksToSave) {
              tx.objectStore(STORES.TASKS).put(t);
            }
            for (const a of assignmentsToSave) {
              tx.objectStore(STORES.ASSIGNMENTS).put(a);
            }
            for (const e of examsToSave) {
              tx.objectStore(STORES.EXAMS).put(e);
            }
            for (const tt of timetableToSave) {
              tx.objectStore(STORES.TIMETABLE).put(tt);
            }
            for (const s of studySessionsToSave) {
              tx.objectStore(STORES.STUDY_SESSIONS).put(s);
            }
            for (const g of goalsToSave) {
              tx.objectStore(STORES.STUDENT_GOALS).put(g);
            }
            for (const c of certificatesToSave) {
              tx.objectStore(STORES.CERTIFICATES).put(c);
            }
            for (const i of internshipsToSave) {
              tx.objectStore(STORES.INTERNSHIPS).put(i);
            }
            for (const h of hackathonsToSave) {
              tx.objectStore(STORES.HACKATHONS).put(h);
            }
          } catch (err) {
            reject(err);
          }
        });
      }
    }

    // Step 3: Update in-memory fallback store only after persistence succeeds
    if (profileToSave) memoryStore.profiles.set(profileToSave.id, profileToSave);
    for (const sem of semestersToSave) memoryStore.semesters.set(sem.id, sem);
    for (const att of attendanceToSave) memoryStore.attendance.set(att.id, att);
    for (const t of tasksToSave) memoryStore.tasks.set(t.id, t);
    for (const a of assignmentsToSave) memoryStore.assignments.set(a.id, a);
    for (const e of examsToSave) memoryStore.exams.set(e.id, e);
    for (const tt of timetableToSave) memoryStore.timetable.set(tt.id, tt);
    for (const s of studySessionsToSave) memoryStore.studySessions.set(s.id, s);
    for (const g of goalsToSave) memoryStore.studentGoals.set(g.id, g);
    for (const c of certificatesToSave) memoryStore.certificates.set(c.id, c);
    for (const i of internshipsToSave) memoryStore.internships.set(i.id, i);
    for (const h of hackathonsToSave) memoryStore.hackathons.set(h.id, h);

    return { importedCounts: counts, errors };
  },

  // Legacy alias support for Phase 17
  async exportAcademicData(profileId?: string): Promise<string> {
    return this.exportFullWorkspace(profileId);
  },

  async exportAllAcademicData(profileId?: string): Promise<string> {
    return this.exportFullWorkspace(profileId);
  },

  async importAcademicData(jsonString: string): Promise<{
    importedSemesters: number;
    importedAttendance: number;
    errors: string[];
  }> {
    const res = await this.importFullWorkspace(jsonString);
    return {
      importedSemesters: res.importedCounts.semesters || 0,
      importedAttendance: res.importedCounts.attendance || 0,
      errors: res.errors,
    };
  },

  // ==========================================
  // CAREER PROFILES (Strictly Local)
  // ==========================================
  async saveCareerProfile(profile: CareerProfile): Promise<CareerProfile> {
    const effectiveId = (profile.id && profile.id !== "default_career_profile")
      ? profile.id
      : (currentActiveProfileId !== "guest" ? `career_${currentActiveProfileId}` : "default_career_profile");
    const cleanProfile: CareerProfile = {
      ...profile,
      id: effectiveId,
      updatedAt: new Date().toISOString(),
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.careerProfiles.set(cleanProfile.id, cleanProfile);
      return cleanProfile;
    }
    try {
      await executeTx(STORES.CAREER_PROFILES, "readwrite", (store) => store.put(cleanProfile));
      return cleanProfile;
    } catch {
      memoryStore.careerProfiles.set(cleanProfile.id, cleanProfile);
      return cleanProfile;
    }
  },

  async getCareerProfile(id?: string): Promise<CareerProfile | null> {
    const targetId = id || (currentActiveProfileId !== "guest" ? `career_${currentActiveProfileId}` : "default_career_profile");
    if (!isIndexedDBAvailable()) {
      return memoryStore.careerProfiles.get(targetId) || null;
    }
    try {
      const result = await executeTx<CareerProfile | undefined>(
        STORES.CAREER_PROFILES,
        "readonly",
        (store) => store.get(targetId)
      );
      return result || null;
    } catch {
      return memoryStore.careerProfiles.get(targetId) || null;
    }
  },

  async deleteCareerProfile(id: string = "default_career_profile"): Promise<void> {
    memoryStore.careerProfiles.delete(id);
    if (!isIndexedDBAvailable()) return;
    try {
      await executeTx(STORES.CAREER_PROFILES, "readwrite", (store) => store.delete(id));
    } catch {}
  },

  // ==========================================
  // RESUME VERSIONS (Strictly Local)
  // ==========================================
  async saveResumeVersion(version: ResumeVersion): Promise<ResumeVersion> {
    const now = new Date().toISOString();
    const effectiveId = (version.profileId && version.profileId !== "default_profile")
      ? version.profileId
      : currentActiveProfileId;
    const cleanVersion: ResumeVersion = {
      ...version,
      profileId: effectiveId,
      updatedAt: now,
      createdAt: version.createdAt || now,
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.resumeVersions.set(cleanVersion.id, cleanVersion);
      return cleanVersion;
    }
    try {
      await executeTx(STORES.RESUME_VERSIONS, "readwrite", (store) => store.put(cleanVersion));
      return cleanVersion;
    } catch {
      memoryStore.resumeVersions.set(cleanVersion.id, cleanVersion);
      return cleanVersion;
    }
  },

  async getResumeVersion(id: string): Promise<ResumeVersion | null> {
    if (!isIndexedDBAvailable()) {
      return memoryStore.resumeVersions.get(id) || null;
    }
    try {
      const result = await executeTx<ResumeVersion | undefined>(
        STORES.RESUME_VERSIONS,
        "readonly",
        (store) => store.get(id)
      );
      return result || null;
    } catch {
      return memoryStore.resumeVersions.get(id) || null;
    }
  },

  async getAllResumeVersions(profileId?: string): Promise<ResumeVersion[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (r: ResumeVersion) =>
      r.profileId === targetId || (targetId === "guest" && (!r.profileId || r.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.resumeVersions.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<ResumeVersion[]>(
        STORES.RESUME_VERSIONS,
        "readonly",
        (store) => store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.resumeVersions.values());
      return all.filter(isMatch);
    }
  },

  async deleteResumeVersion(id: string): Promise<void> {
    memoryStore.resumeVersions.delete(id);
    if (!isIndexedDBAvailable()) return;
    try {
      await executeTx(STORES.RESUME_VERSIONS, "readwrite", (store) => store.delete(id));
    } catch {}
  },

  // ==========================================
  // RESUME SNAPSHOTS (Strictly Local)
  // ==========================================
  async saveResumeSnapshot(snapshot: ResumeSnapshot): Promise<ResumeSnapshot> {
    if (!isIndexedDBAvailable()) {
      memoryStore.resumeSnapshots.set(snapshot.id, snapshot);
      return snapshot;
    }
    try {
      await executeTx(STORES.RESUME_SNAPSHOTS, "readwrite", (store) => store.put(snapshot));
      return snapshot;
    } catch {
      memoryStore.resumeSnapshots.set(snapshot.id, snapshot);
      return snapshot;
    }
  },

  async getResumeSnapshot(id: string): Promise<ResumeSnapshot | null> {
    if (!isIndexedDBAvailable()) {
      return memoryStore.resumeSnapshots.get(id) || null;
    }
    try {
      const result = await executeTx<ResumeSnapshot | undefined>(
        STORES.RESUME_SNAPSHOTS,
        "readonly",
        (store) => store.get(id)
      );
      return result || null;
    } catch {
      return memoryStore.resumeSnapshots.get(id) || null;
    }
  },

  async getAllResumeSnapshots(resumeVersionId?: string): Promise<ResumeSnapshot[]> {
    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.resumeSnapshots.values());
      return resumeVersionId ? all.filter((s) => s.resumeVersionId === resumeVersionId) : all;
    }
    try {
      const result = await executeTx<ResumeSnapshot[]>(
        STORES.RESUME_SNAPSHOTS,
        "readonly",
        (store) => store.getAll()
      );
      const items = result || [];
      return resumeVersionId ? items.filter((s) => s.resumeVersionId === resumeVersionId) : items;
    } catch {
      const all = Array.from(memoryStore.resumeSnapshots.values());
      return resumeVersionId ? all.filter((s) => s.resumeVersionId === resumeVersionId) : all;
    }
  },

  async deleteResumeSnapshot(id: string): Promise<void> {
    memoryStore.resumeSnapshots.delete(id);
    if (!isIndexedDBAvailable()) return;
    try {
      await executeTx(STORES.RESUME_SNAPSHOTS, "readwrite", (store) => store.delete(id));
    } catch {}
  },

  // ==========================================
  // COVER LETTERS (Strictly Local)
  // ==========================================
  async saveCoverLetterVersion(letter: CoverLetterVersion): Promise<CoverLetterVersion> {
    const now = new Date().toISOString();
    const effectiveId = (letter.profileId && letter.profileId !== "default_profile")
      ? letter.profileId
      : currentActiveProfileId;
    const clean: CoverLetterVersion = {
      ...letter,
      profileId: effectiveId,
      updatedAt: now,
      createdAt: letter.createdAt || now,
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.coverLetters.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.COVER_LETTERS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.coverLetters.set(clean.id, clean);
      return clean;
    }
  },

  async getCoverLetterVersion(id: string): Promise<CoverLetterVersion | null> {
    if (!isIndexedDBAvailable()) {
      return memoryStore.coverLetters.get(id) || null;
    }
    try {
      const result = await executeTx<CoverLetterVersion | undefined>(
        STORES.COVER_LETTERS,
        "readonly",
        (store) => store.get(id)
      );
      return result || null;
    } catch {
      return memoryStore.coverLetters.get(id) || null;
    }
  },

  async getAllCoverLetterVersions(profileId?: string): Promise<CoverLetterVersion[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (c: CoverLetterVersion) =>
      c.profileId === targetId || (targetId === "guest" && (!c.profileId || c.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.coverLetters.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<CoverLetterVersion[]>(
        STORES.COVER_LETTERS,
        "readonly",
        (store) => store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.coverLetters.values());
      return all.filter(isMatch);
    }
  },

  async deleteCoverLetterVersion(id: string): Promise<void> {
    memoryStore.coverLetters.delete(id);
    if (!isIndexedDBAvailable()) return;
    try {
      await executeTx(STORES.COVER_LETTERS, "readwrite", (store) => store.delete(id));
    } catch {}
  },

  // ==========================================
  // JOB APPLICATIONS (Strictly Local)
  // ==========================================
  async saveJobApplication(app: JobApplication): Promise<JobApplication> {
    const now = new Date().toISOString();
    const effectiveId = (app.profileId && app.profileId !== "default_profile")
      ? app.profileId
      : currentActiveProfileId;
    const clean: JobApplication = {
      ...app,
      profileId: effectiveId,
      updatedAt: now,
      createdAt: app.createdAt || now,
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.jobApplications.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.JOB_APPLICATIONS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.jobApplications.set(clean.id, clean);
      return clean;
    }
  },

  async getJobApplication(id: string): Promise<JobApplication | null> {
    if (!isIndexedDBAvailable()) {
      return memoryStore.jobApplications.get(id) || null;
    }
    try {
      const result = await executeTx<JobApplication | undefined>(
        STORES.JOB_APPLICATIONS,
        "readonly",
        (store) => store.get(id)
      );
      return result || null;
    } catch {
      return memoryStore.jobApplications.get(id) || null;
    }
  },

  async getAllJobApplications(profileId?: string): Promise<JobApplication[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (a: JobApplication) =>
      a.profileId === targetId || (targetId === "guest" && (!a.profileId || a.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.jobApplications.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<JobApplication[]>(
        STORES.JOB_APPLICATIONS,
        "readonly",
        (store) => store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.jobApplications.values());
      return all.filter(isMatch);
    }
  },

  async deleteJobApplication(id: string): Promise<void> {
    memoryStore.jobApplications.delete(id);
    if (!isIndexedDBAvailable()) return;
    try {
      await executeTx(STORES.JOB_APPLICATIONS, "readwrite", (store) => store.delete(id));
    } catch {}
  },

  // ==========================================
  // INTERVIEWS (Strictly Local)
  // ==========================================
  async saveInterview(interview: InterviewRecord): Promise<InterviewRecord> {
    const now = new Date().toISOString();
    const effectiveId = (interview.profileId && interview.profileId !== "default_profile")
      ? interview.profileId
      : currentActiveProfileId;
    const clean: InterviewRecord = {
      ...interview,
      profileId: effectiveId,
      updatedAt: now,
      createdAt: interview.createdAt || now,
    };
    if (!isIndexedDBAvailable()) {
      memoryStore.interviews.set(clean.id, clean);
      return clean;
    }
    try {
      await executeTx(STORES.INTERVIEWS, "readwrite", (store) => store.put(clean));
      return clean;
    } catch {
      memoryStore.interviews.set(clean.id, clean);
      return clean;
    }
  },

  async getInterview(id: string): Promise<InterviewRecord | null> {
    if (!isIndexedDBAvailable()) {
      return memoryStore.interviews.get(id) || null;
    }
    try {
      const result = await executeTx<InterviewRecord | undefined>(
        STORES.INTERVIEWS,
        "readonly",
        (store) => store.get(id)
      );
      return result || null;
    } catch {
      return memoryStore.interviews.get(id) || null;
    }
  },

  async getAllInterviews(profileId?: string): Promise<InterviewRecord[]> {
    const targetId = profileId || currentActiveProfileId;
    const isMatch = (i: InterviewRecord) =>
      i.profileId === targetId || (targetId === "guest" && (!i.profileId || i.profileId === "default_profile"));

    if (!isIndexedDBAvailable()) {
      const all = Array.from(memoryStore.interviews.values());
      return all.filter(isMatch);
    }
    try {
      const result = await executeTx<InterviewRecord[]>(
        STORES.INTERVIEWS,
        "readonly",
        (store) => store.getAll()
      );
      const all = result || [];
      return all.filter(isMatch);
    } catch {
      const all = Array.from(memoryStore.interviews.values());
      return all.filter(isMatch);
    }
  },

  async getInterviewsForApplication(applicationId: string): Promise<InterviewRecord[]> {
    const all = await this.getAllInterviews();
    return all.filter((i) => i.applicationId === applicationId);
  },

  async deleteInterview(id: string): Promise<void> {
    memoryStore.interviews.delete(id);
    if (!isIndexedDBAvailable()) return;
    try {
      await executeTx(STORES.INTERVIEWS, "readwrite", (store) => store.delete(id));
    } catch {}
  },

  // ==========================================
  // CAREER SKILLS (Strictly Local)
  // ==========================================
  async saveCareerSkill(skill: CareerSkill): Promise<CareerSkill> {
    if (!isIndexedDBAvailable()) {
      memoryStore.careerSkills.set(skill.id, skill);
      return skill;
    }
    try {
      await executeTx(STORES.CAREER_SKILLS, "readwrite", (store) => store.put(skill));
      return skill;
    } catch {
      memoryStore.careerSkills.set(skill.id, skill);
      return skill;
    }
  },

  async getAllCareerSkills(): Promise<CareerSkill[]> {
    if (!isIndexedDBAvailable()) {
      return Array.from(memoryStore.careerSkills.values());
    }
    try {
      const result = await executeTx<CareerSkill[]>(
        STORES.CAREER_SKILLS,
        "readonly",
        (store) => store.getAll()
      );
      return result || [];
    } catch {
      return Array.from(memoryStore.careerSkills.values());
    }
  },

  async deleteCareerSkill(id: string): Promise<void> {
    memoryStore.careerSkills.delete(id);
    if (!isIndexedDBAvailable()) return;
    try {
      await executeTx(STORES.CAREER_SKILLS, "readwrite", (store) => store.delete(id));
    } catch {}
  },

  // ==========================================
  // CAREER WORKSPACE PAYLOAD EXPORT / IMPORT / RESET
  // ==========================================
  async exportCareerWorkspace(): Promise<string> {
    const profile = await this.getCareerProfile("default_career_profile");
    const resumeVersions = await this.getAllResumeVersions();
    const snapshots = await this.getAllResumeSnapshots();
    const coverLetters = await this.getAllCoverLetterVersions();
    const applications = await this.getAllJobApplications();
    const interviews = await this.getAllInterviews();
    const skills = await this.getAllCareerSkills();

    const payload: CareerWorkspaceExportPayload = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      profile,
      resumeVersions,
      snapshots,
      coverLetters,
      applications,
      interviews,
      skills,
    };
    return JSON.stringify(payload, null, 2);
  },

  async importCareerWorkspace(jsonString: string): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!jsonString || typeof jsonString !== "string") {
      return { success: false, errors: ["Import payload must be a non-empty string."] };
    }
    if (jsonString.length > MAX_IMPORT_SIZE_BYTES) {
      return {
        success: false,
        errors: [`Import payload exceeds maximum safe size of ${MAX_IMPORT_SIZE_BYTES / (1024 * 1024)}MB.`],
      };
    }
    try {
      const parsed = safeJsonParse<Partial<CareerWorkspaceExportPayload>>(jsonString);
      if (!parsed || typeof parsed !== "object") {
        return { success: false, errors: ["Invalid JSON payload format."] };
      }
      for (const key of [
        "resumeVersions",
        "snapshots",
        "coverLetters",
        "applications",
        "interviews",
        "skills",
      ] as const) {
        if (Array.isArray(parsed[key]) && (parsed[key] as unknown[]).length > MAX_IMPORT_ARRAY_ENTRIES) {
          return {
            success: false,
            errors: [`Import contains too many ${key} entries (maximum allowed: ${MAX_IMPORT_ARRAY_ENTRIES}).`],
          };
        }
      }
      if (parsed.profile && typeof parsed.profile === "object") {
        await this.saveCareerProfile(parsed.profile as CareerProfile);
      }
      if (Array.isArray(parsed.resumeVersions)) {
        for (const rv of parsed.resumeVersions) {
          if (rv && rv.id && rv.name) {
            await this.saveResumeVersion(rv as ResumeVersion);
          }
        }
      }
      if (Array.isArray(parsed.snapshots)) {
        for (const snap of parsed.snapshots) {
          if (snap && snap.id) {
            await this.saveResumeSnapshot(snap as ResumeSnapshot);
          }
        }
      }
      if (Array.isArray(parsed.coverLetters)) {
        for (const cl of parsed.coverLetters) {
          if (cl && cl.id) {
            await this.saveCoverLetterVersion(cl as CoverLetterVersion);
          }
        }
      }
      if (Array.isArray(parsed.applications)) {
        for (const app of parsed.applications) {
          if (app && app.id && app.company) {
            await this.saveJobApplication(app as JobApplication);
          }
        }
      }
      if (Array.isArray(parsed.interviews)) {
        for (const intv of parsed.interviews) {
          if (intv && intv.id && intv.company) {
            await this.saveInterview(intv as InterviewRecord);
          }
        }
      }
      if (Array.isArray(parsed.skills)) {
        for (const sk of parsed.skills) {
          if (sk && sk.id && sk.name) {
            await this.saveCareerSkill(sk as CareerSkill);
          }
        }
      }
      return { success: true, errors: [] };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : "Malformed career workspace JSON."],
      };
    }
  },

  async resetCareerWorkspace(): Promise<void> {
    memoryStore.careerProfiles.clear();
    memoryStore.resumeVersions.clear();
    memoryStore.resumeSnapshots.clear();
    memoryStore.coverLetters.clear();
    memoryStore.jobApplications.clear();
    memoryStore.interviews.clear();
    memoryStore.careerSkills.clear();

    if (isIndexedDBAvailable()) {
      const careerStores = [
        STORES.CAREER_PROFILES,
        STORES.RESUME_VERSIONS,
        STORES.RESUME_SNAPSHOTS,
        STORES.COVER_LETTERS,
        STORES.JOB_APPLICATIONS,
        STORES.INTERVIEWS,
        STORES.CAREER_SKILLS,
      ];
      await Promise.all(
        careerStores.map((name) =>
          executeTx(name, "readwrite", (s) => {
            try {
              s.clear();
            } catch {}
          })
        )
      );
    }
  },

  // ==========================================
  // CONVERSATIONS & CONVERSATION MESSAGES
  // ==========================================
  async saveConversation(conv: Conversation): Promise<Conversation> {
    const effectiveProfileId = (!conv.profileId || conv.profileId === "default_profile")
      ? currentActiveProfileId
      : conv.profileId;
    const clean: Conversation = {
      ...conv,
      profileId: effectiveProfileId,
      updatedAt: conv.updatedAt || new Date().toISOString(),
    };
    memoryStore.conversations.set(clean.id, clean);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.CONVERSATIONS, "readwrite", (store) => store.put(clean));
      } catch (e) {
        console.warn("IndexedDB saveConversation failed, keeping in memoryStore:", e);
      }
    }
    return clean;
  },

  async getConversation(id: string): Promise<Conversation | null> {
    if (isIndexedDBAvailable()) {
      try {
        const item = await executeTx<Conversation | undefined>(
          STORES.CONVERSATIONS,
          "readonly",
          (store) => store.get(id)
        );
        if (item) {
          memoryStore.conversations.set(id, item);
          return item;
        }
      } catch (e) {
        console.warn("IndexedDB getConversation failed:", e);
      }
    }
    return memoryStore.conversations.get(id) || null;
  },

  async getAllConversations(profileId?: string): Promise<Conversation[]> {
    const targetId = profileId || currentActiveProfileId;
    let list: Conversation[] = [];
    if (isIndexedDBAvailable()) {
      try {
        const res = await executeTx<Conversation[]>(
          STORES.CONVERSATIONS,
          "readonly",
          (store) => store.getAll()
        );
        list = res || [];
        for (const c of list) {
          memoryStore.conversations.set(c.id, c);
        }
      } catch (e) {
        console.warn("IndexedDB getAllConversations failed:", e);
        list = Array.from(memoryStore.conversations.values());
      }
    } else {
      list = Array.from(memoryStore.conversations.values());
    }

    const isMatch = (c: Conversation) =>
      c.profileId === targetId || (targetId === "guest" && (!c.profileId || c.profileId === "default_profile"));
    list = list.filter(isMatch);

    // Sort pinned first, then updatedAt descending
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },

  async deleteConversation(id: string): Promise<void> {
    memoryStore.conversations.delete(id);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.CONVERSATIONS, "readwrite", (store) => store.delete(id));
      } catch (e) {
        console.warn("IndexedDB deleteConversation failed:", e);
      }
    }
    await this.deleteConversationMessages(id);
  },

  async saveConversationMessage(msg: ConversationMessage): Promise<ConversationMessage> {
    const clean: ConversationMessage = {
      ...msg,
      createdAt: msg.createdAt || new Date().toISOString(),
    };
    memoryStore.conversationMessages.set(clean.id, clean);
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.CONVERSATION_MESSAGES, "readwrite", (store) => store.put(clean));
      } catch (e) {
        console.warn("IndexedDB saveConversationMessage failed:", e);
      }
    }

    // Auto-update conversation updatedAt and increment messageCount in O(1) without loading all messages
    const conv = await this.getConversation(clean.conversationId);
    if (conv) {
      conv.messageCount = (typeof conv.messageCount === "number" && conv.messageCount >= 0)
        ? conv.messageCount + 1
        : 1;
      conv.updatedAt = clean.createdAt;
      conv.lastMessageAt = clean.createdAt;
      await this.saveConversation(conv);
    }

    return clean;
  },

  async getConversationMessagesPaginated(
    conversationId: string,
    options?: { limit?: number; offset?: number; order?: "asc" | "desc" }
  ): Promise<{ messages: ConversationMessage[]; total: number; hasMore: boolean }> {
    const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
    const offset = Math.max(0, options?.offset ?? 0);
    const order = options?.order ?? "asc";

    let all: ConversationMessage[] = [];
    if (isIndexedDBAvailable()) {
      try {
        const res = await executeTx<ConversationMessage[]>(
          STORES.CONVERSATION_MESSAGES,
          "readonly",
          (store) => {
            const index = store.index("conversationId");
            return index.getAll(conversationId);
          }
        );
        all = res || [];
        for (const m of all) {
          memoryStore.conversationMessages.set(m.id, m);
        }
      } catch (e) {
        console.warn("IndexedDB getConversationMessagesPaginated failed:", e);
        all = Array.from(memoryStore.conversationMessages.values()).filter(
          (m) => m.conversationId === conversationId
        );
      }
    } else {
      all = Array.from(memoryStore.conversationMessages.values()).filter(
        (m) => m.conversationId === conversationId
      );
    }

    all.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return order === "asc" ? diff : -diff;
    });

    const total = all.length;
    const paginated = all.slice(offset, offset + limit);
    const hasMore = offset + paginated.length < total;

    return {
      messages: paginated,
      total,
      hasMore,
    };
  },

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    let list: ConversationMessage[] = [];
    if (isIndexedDBAvailable()) {
      try {
        const res = await executeTx<ConversationMessage[]>(
          STORES.CONVERSATION_MESSAGES,
          "readonly",
          (store) => {
            const index = store.index("conversationId");
            return index.getAll(conversationId);
          }
        );
        list = res || [];
        for (const m of list) {
          memoryStore.conversationMessages.set(m.id, m);
        }
      } catch (e) {
        console.warn("IndexedDB getConversationMessages failed:", e);
        list = Array.from(memoryStore.conversationMessages.values()).filter(
          (m) => m.conversationId === conversationId
        );
      }
    } else {
      list = Array.from(memoryStore.conversationMessages.values()).filter(
        (m) => m.conversationId === conversationId
      );
    }

    return list.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  },

  async deleteConversationMessages(conversationId: string): Promise<void> {
    for (const [key, msg] of memoryStore.conversationMessages.entries()) {
      if (msg.conversationId === conversationId) {
        memoryStore.conversationMessages.delete(key);
      }
    }
    if (isIndexedDBAvailable()) {
      try {
        await executeTx(STORES.CONVERSATION_MESSAGES, "readwrite", (store) => {
          const index = store.index("conversationId");
          const req = index.openKeyCursor(IDBKeyRange.only(conversationId));
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              cursor.continue();
            }
          };
        });
      } catch (e) {
        console.warn("IndexedDB deleteConversationMessages failed:", e);
      }
    }
  },

  async exportConversations(profileId?: string): Promise<ConversationExportPayload> {
    const convs = await this.getAllConversations(profileId);
    const allMsgs: ConversationMessage[] = [];

    for (const c of convs) {
      const msgs = await this.getConversationMessages(c.id);
      allMsgs.push(...msgs);
    }

    return {
      schemaVersion: "1.0",
      exportedAt: new Date().toISOString(),
      profileId: profileId || "guest",
      conversations: convs,
      messages: allMsgs,
    };
  },

  async importConversations(
    payloadString: string,
    targetProfileId?: string
  ): Promise<{ success: boolean; errors: string[] }> {
    if (!payloadString || typeof payloadString !== "string") {
      return { success: false, errors: ["Import payload must be a non-empty string."] };
    }
    if (payloadString.length > MAX_IMPORT_SIZE_BYTES) {
      return {
        success: false,
        errors: [`Import payload exceeds maximum safe size of ${MAX_IMPORT_SIZE_BYTES / (1024 * 1024)}MB.`],
      };
    }
    try {
      const parsed = safeJsonParse<ConversationExportPayload>(payloadString);
      if (!parsed || parsed.schemaVersion !== "1.0" || !Array.isArray(parsed.conversations)) {
        return { success: false, errors: ["Invalid conversation export format or schema version mismatch."] };
      }
      if (
        parsed.conversations.length > MAX_IMPORT_ARRAY_ENTRIES ||
        (Array.isArray(parsed.messages) && parsed.messages.length > MAX_IMPORT_ARRAY_ENTRIES)
      ) {
        return {
          success: false,
          errors: [`Import contains too many entries (maximum allowed: ${MAX_IMPORT_ARRAY_ENTRIES}).`],
        };
      }
      for (const conv of parsed.conversations) {
        const toSave = {
          ...conv,
          profileId: targetProfileId || conv.profileId || "guest",
        };
        await this.saveConversation(toSave);
      }
      if (Array.isArray(parsed.messages)) {
        for (const msg of parsed.messages) {
          await this.saveConversationMessage(msg);
        }
      }
      return { success: true, errors: [] };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : "Malformed conversation export JSON."],
      };
    }
  },

  async getStorageHealth(): Promise<{
    usageBytes: number;
    quotaBytes: number;
    percentageUsed: number;
    isLowStorage: boolean;
    storageAvailable: boolean;
  }> {
    if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function") {
      try {
        const estimate = await navigator.storage.estimate();
        const usageBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || 0;
        const percentageUsed = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
        const isLowStorage = percentageUsed > 90 || (quotaBytes > 0 && quotaBytes - usageBytes < 50 * 1024 * 1024);
        return {
          usageBytes,
          quotaBytes,
          percentageUsed: Math.round(percentageUsed * 10) / 10,
          isLowStorage,
          storageAvailable: true,
        };
      } catch (err) {
        console.warn("navigator.storage.estimate failed:", err);
      }
    }
    return {
      usageBytes: 0,
      quotaBytes: 0,
      percentageUsed: 0,
      isLowStorage: false,
      storageAvailable: isIndexedDBAvailable(),
    };
  },

  async clearAllData(): Promise<void> {
    memoryStore.profiles.clear();
    memoryStore.semesters.clear();
    memoryStore.attendance.clear();
    memoryStore.goals.clear();
    memoryStore.history.clear();
    memoryStore.tasks.clear();
    memoryStore.assignments.clear();
    memoryStore.exams.clear();
    memoryStore.timetable.clear();
    memoryStore.studySessions.clear();
    memoryStore.studentGoals.clear();
    memoryStore.certificates.clear();
    memoryStore.internships.clear();
    memoryStore.hackathons.clear();
    memoryStore.careerProfiles.clear();
    memoryStore.resumeVersions.clear();
    memoryStore.resumeSnapshots.clear();
    memoryStore.coverLetters.clear();
    memoryStore.jobApplications.clear();
    memoryStore.interviews.clear();
    memoryStore.careerSkills.clear();
    memoryStore.conversations.clear();
    memoryStore.conversationMessages.clear();

    if (isIndexedDBAvailable()) {
      try {
        const storeNames = Object.values(STORES);
        await Promise.all(
          storeNames.map((name) =>
            executeTx(name, "readwrite", (s) => {
              try {
                s.clear();
              } catch {}
            })
          )
        );
      } catch (err) {
        console.warn("Failed to clear some IndexedDB tables:", err);
      }
    }
  },
};
