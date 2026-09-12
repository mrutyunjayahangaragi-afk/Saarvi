import { academicStorage } from "@/lib/academic/storage/academic-db";
import {
  StudyTask,
  StudySession,
  Assignment,
  TimetableEntry,
  CertificateRecord,
  InternshipApplication,
  HackathonRecord,
  CoverLetterData,
  AcademicCalculationSnapshot,
  TaskItem,
  ExamRecord,
  StudentGoal,
} from "@/types/student";

const GUEST_KEYS = {
  COVER_LETTERS: "saarvi_guest_cover_letters_v1",
  LEGACY_COVER_LETTERS: "docease_guest_cover_letters_v1",
};

function getLocal<T>(key: string, fallback: T, legacyKey?: string): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save to ${key}`, e);
  }
}

export const studentService = {
  // ==========================================
  // STUDY PLANS & SESSIONS
  // ==========================================
  async getStudyPlans(): Promise<StudyTask[]> {
    const sessions = await academicStorage.getStudySessions();
    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      subject: s.subject,
      date: s.date,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      priority: s.priority,
      notes: s.notes,
      completed: s.status === "COMPLETED",
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  },

  async saveStudyPlan(
    task: Omit<StudyTask, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<StudyTask> {
    const now = new Date().toISOString();
    const id = task.id || `study_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const session: StudySession = {
      id,
      userId: task.userId,
      subject: task.subject,
      topic: task.notes || task.subject,
      date: task.date,
      startTime: task.startTime,
      durationMinutes: task.durationMinutes,
      priority: task.priority,
      notes: task.notes,
      status: task.completed ? "COMPLETED" : "PLANNED",
      createdAt: now,
      updatedAt: now,
    };
    await academicStorage.saveStudySession(session);
    return {
      ...task,
      id,
      createdAt: now,
      updatedAt: now,
    };
  },

  async deleteStudyPlan(id: string): Promise<void> {
    await academicStorage.deleteStudySession(id);
  },

  // Direct StudySession API
  async getStudySessions(profileId?: string): Promise<StudySession[]> {
    return academicStorage.getStudySessions(profileId);
  },

  async saveStudySession(session: StudySession): Promise<StudySession> {
    return academicStorage.saveStudySession(session);
  },

  async deleteStudySession(id: string): Promise<void> {
    return academicStorage.deleteStudySession(id);
  },

  // ==========================================
  // TASKS
  // ==========================================
  async getTasks(profileId?: string): Promise<TaskItem[]> {
    return academicStorage.getTasks(profileId);
  },

  async saveTask(task: TaskItem): Promise<TaskItem> {
    return academicStorage.saveTask(task);
  },

  async deleteTask(id: string): Promise<void> {
    return academicStorage.deleteTask(id);
  },

  // ==========================================
  // ASSIGNMENTS
  // ==========================================
  async getAssignments(profileId?: string): Promise<Assignment[]> {
    return academicStorage.getAssignments(profileId);
  },

  async saveAssignment(
    asgn: Omit<Assignment, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<Assignment> {
    const now = new Date().toISOString();
    const id = asgn.id || `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: Assignment = {
      ...asgn,
      id,
      createdAt: now,
      updatedAt: now,
    };
    return academicStorage.saveAssignment(record);
  },

  async deleteAssignment(id: string): Promise<void> {
    return academicStorage.deleteAssignment(id);
  },

  // ==========================================
  // EXAMS
  // ==========================================
  async getExams(profileId?: string): Promise<ExamRecord[]> {
    return academicStorage.getExams(profileId);
  },

  async saveExam(exam: ExamRecord): Promise<ExamRecord> {
    return academicStorage.saveExam(exam);
  },

  async deleteExam(id: string): Promise<void> {
    return academicStorage.deleteExam(id);
  },

  // ==========================================
  // TIMETABLE
  // ==========================================
  async getTimetable(profileId?: string): Promise<TimetableEntry[]> {
    return academicStorage.getTimetable(profileId);
  },

  async saveTimetableEntry(entry: TimetableEntry): Promise<TimetableEntry> {
    return academicStorage.saveTimetableEntry(entry);
  },

  async saveTimetable(entries: TimetableEntry[]): Promise<TimetableEntry[]> {
    const saved: TimetableEntry[] = [];
    for (const e of entries) {
      const res = await academicStorage.saveTimetableEntry(e);
      saved.push(res);
    }
    return saved;
  },

  async deleteTimetableEntry(id: string): Promise<void> {
    return academicStorage.deleteTimetableEntry(id);
  },

  // ==========================================
  // GOALS
  // ==========================================
  async getGoals(profileId?: string): Promise<StudentGoal[]> {
    return academicStorage.getStudentGoals(profileId);
  },

  async saveGoal(goal: StudentGoal): Promise<StudentGoal> {
    return academicStorage.saveStudentGoal(goal);
  },

  async deleteGoal(id: string): Promise<void> {
    return academicStorage.deleteStudentGoal(id);
  },

  // ==========================================
  // CERTIFICATES
  // ==========================================
  async getCertificates(): Promise<CertificateRecord[]> {
    return academicStorage.getCertificates();
  },

  async saveCertificate(
    cert: Omit<CertificateRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<CertificateRecord> {
    const now = new Date().toISOString();
    const id = cert.id || `cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const full: CertificateRecord = {
      ...cert,
      id,
      createdAt: now,
      updatedAt: now,
    };
    return academicStorage.saveCertificate(full);
  },

  async deleteCertificate(id: string): Promise<void> {
    return academicStorage.deleteCertificate(id);
  },

  // ==========================================
  // INTERNSHIPS
  // ==========================================
  async getInternships(): Promise<InternshipApplication[]> {
    return academicStorage.getInternships();
  },

  async saveInternship(
    internship: Omit<InternshipApplication, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<InternshipApplication> {
    const now = new Date().toISOString();
    const id = internship.id || `intern_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const full: InternshipApplication = {
      ...internship,
      id,
      createdAt: now,
      updatedAt: now,
    };
    return academicStorage.saveInternship(full);
  },

  async deleteInternship(id: string): Promise<void> {
    return academicStorage.deleteInternship(id);
  },

  // ==========================================
  // HACKATHONS
  // ==========================================
  async getHackathons(): Promise<HackathonRecord[]> {
    return academicStorage.getHackathons();
  },

  async saveHackathon(
    hackathon: Omit<HackathonRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<HackathonRecord> {
    const now = new Date().toISOString();
    const id = hackathon.id || `hack_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const full: HackathonRecord = {
      ...hackathon,
      id,
      createdAt: now,
      updatedAt: now,
    };
    return academicStorage.saveHackathon(full);
  },

  async deleteHackathon(id: string): Promise<void> {
    return academicStorage.deleteHackathon(id);
  },

  // ==========================================
  // COVER LETTERS (Local Only)
  // ==========================================
  async getCoverLetters(): Promise<CoverLetterData[]> {
    return getLocal<CoverLetterData[]>(GUEST_KEYS.COVER_LETTERS, [], GUEST_KEYS.LEGACY_COVER_LETTERS);
  },

  async saveCoverLetter(letter: CoverLetterData): Promise<CoverLetterData> {
    const all = getLocal<CoverLetterData[]>(GUEST_KEYS.COVER_LETTERS, [], GUEST_KEYS.LEGACY_COVER_LETTERS);
    const now = new Date().toISOString();
    if (letter.id) {
      const idx = all.findIndex((l) => l.id === letter.id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...letter, updatedAt: now };
        setLocal(GUEST_KEYS.COVER_LETTERS, all);
        return all[idx];
      }
    }
    const newLetter: CoverLetterData = {
      ...letter,
      id: `letter_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    all.push(newLetter);
    setLocal(GUEST_KEYS.COVER_LETTERS, all);
    return newLetter;
  },

  async deleteCoverLetter(id: string): Promise<void> {
    const all = getLocal<CoverLetterData[]>(GUEST_KEYS.COVER_LETTERS, [], GUEST_KEYS.LEGACY_COVER_LETTERS);
    setLocal(
      GUEST_KEYS.COVER_LETTERS,
      all.filter((l) => l.id !== id)
    );
  },

  // ==========================================
  // ACADEMIC RECORDS (Strictly Local)
  // ==========================================
  async getAcademicRecords(): Promise<AcademicCalculationSnapshot[]> {
    const records = await academicStorage.getSemesterRecords();
    return records.map((r) => ({
      id: r.id,
      university: r.university,
      scheme: r.scheme,
      branch: r.branch,
      curriculumVersion: r.curriculumVersion,
      gradingVersion: r.gradingVersion,
      calculatedAt: r.updatedAt,
      semesters: [],
      cgpa: r.sgpa,
      totalCredits: r.totalCredits,
      earnedCredits: r.earnedCredits,
      totalCreditPoints: r.totalCreditPoints,
      status: "active",
      createdAt: r.updatedAt,
      updatedAt: r.updatedAt,
    }));
  },

  async getLatestAcademicRecord(): Promise<AcademicCalculationSnapshot | null> {
    const all = await this.getAcademicRecords();
    return all.length > 0 ? all[all.length - 1] : null;
  },

  async saveAcademicRecord(
    record: Omit<AcademicCalculationSnapshot, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<AcademicCalculationSnapshot> {
    const now = new Date().toISOString();
    const snap: AcademicCalculationSnapshot = {
      ...record,
      id: record.id || `academic_snap_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    return snap;
  },

  async getStudentSummary(): Promise<{
    resumesCount: number;
    internshipsCount: number;
    hackathonsCount: number;
    studyTasksUpcoming: number;
    assignmentsUpcoming: number;
    latestCgpa?: number | null;
    latestSgpa?: number | null;
    completedSemesters?: number;
    studyPlansCount?: number;
    assignmentsCount?: number;
    timetableCount?: number;
    certificatesCount?: number;
    hasAcademicRecord?: boolean;
  }> {
    const today = new Date().toISOString().split("T")[0];
    const [plans, asgns, tt, certs, interns, hacks, semesters] = await Promise.all([
      this.getStudyPlans(),
      this.getAssignments(),
      this.getTimetable(),
      this.getCertificates(),
      this.getInternships(),
      this.getHackathons(),
      academicStorage.getSemesterRecords(),
    ]);

    const upcomingPlans = plans.filter((p) => !p.completed && p.date >= today).length;
    const upcomingAsgns = asgns.filter((a) => a.status !== "completed" && a.dueDate >= today).length;

    let latestSgpa: number | null = null;
    let latestCgpa: number | null = null;
    if (semesters.length > 0) {
      const sorted = [...semesters].sort((a, b) => a.semester - b.semester);
      latestSgpa = sorted[sorted.length - 1].sgpa;
      const totalPts = sorted.reduce((sum, s) => sum + s.totalCreditPoints, 0);
      const totalCrs = sorted.reduce((sum, s) => sum + s.totalCredits, 0);
      latestCgpa = totalCrs > 0 ? Math.round((totalPts / totalCrs) * 100) / 100 : null;
    }

    return {
      resumesCount: 0,
      internshipsCount: interns.length,
      hackathonsCount: hacks.length,
      studyTasksUpcoming: upcomingPlans,
      assignmentsUpcoming: upcomingAsgns,
      latestCgpa,
      latestSgpa,
      completedSemesters: semesters.length,
      studyPlansCount: plans.length,
      assignmentsCount: asgns.length,
      timetableCount: tt.length,
      certificatesCount: certs.length,
      hasAcademicRecord: semesters.length > 0,
    };
  },
};
