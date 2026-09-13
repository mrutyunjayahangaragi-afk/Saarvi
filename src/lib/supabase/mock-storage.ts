// Resilient Local Storage Provider for DocEase
// Implements zero-configuration auth, profile, history, and resume draft persistence with strict user isolation (RLS)

import {
  UserProfile,
  ConversionHistoryRecord,
  SavedResumeDraft,
  UserPreferences,
  AuthSessionUser,
  UserRole,
  UserAccountStatus,
} from '@/types/auth';
import {
  StudyTask,
  Assignment,
  TimetableEntry,
  CertificateRecord,
  InternshipApplication,
  HackathonRecord,
  CoverLetterData,
  AcademicCalculationSnapshot,
} from '@/types/student';
import {
  PlatformSettings,
  ToolOverrideConfig,
  CurriculumVersionRecord,
  AnnouncementRecord,
  PlatformErrorRecord,
  AuditLogRecord,
  FeatureFlag,
  PlatformEventRecord,
  PlatformEventType,
} from '@/types/admin';
import {
  SubscriptionRecord,
  BillingEventRecord,
  BillingInvoiceRecord,
} from '@/types/plan';

const STORAGE_KEYS = {
  USERS: 'saarvi_users_v1',
  SESSION: 'saarvi_session_v1',
  HISTORY: 'saarvi_history_v1',
  RESUMES: 'saarvi_resumes_v1',
  PREFERENCES: 'saarvi_preferences_v1',
  STUDY_PLANS: 'saarvi_study_plans_v1',
  ASSIGNMENTS: 'saarvi_assignments_v1',
  TIMETABLES: 'saarvi_timetables_v1',
  CERTIFICATES: 'saarvi_certificates_v1',
  INTERNSHIPS: 'saarvi_internships_v1',
  HACKATHONS: 'saarvi_hackathons_v1',
  COVER_LETTERS: 'saarvi_cover_letters_v1',
  ACADEMIC_SNAPSHOTS: 'saarvi_academic_snapshots_v1',
  ACADEMIC_RECORDS: 'saarvi_academic_snapshots_v1',
  // Phase 11 Admin Platform Keys
  PLATFORM_SETTINGS: 'saarvi_platform_settings_v1',
  TOOL_OVERRIDES: 'saarvi_tool_overrides_v1',
  CURRICULUM_VERSIONS: 'saarvi_curriculum_versions_v1',
  ANNOUNCEMENTS: 'saarvi_announcements_v1',
  ERRORS: 'saarvi_system_errors_v1',
  AUDIT_LOGS: 'saarvi_audit_logs_v1',
  FEATURE_FLAGS: 'saarvi_feature_flags_v1',
  PLATFORM_EVENTS: 'saarvi_platform_events_v1',
  // Phase 13 Billing Keys
  SUBSCRIPTIONS: 'saarvi_subscriptions_v1',
  BILLING_EVENTS: 'saarvi_billing_events_v1',
  INVOICES: 'saarvi_invoices_v1',
};

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string; // simulated hash
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
  lastSignInAt?: string;
}

const DEFAULT_SUPER_ADMINS: StoredUser[] = [
  {
    id: 'admin_muttu_super',
    email: 'muttuhangaragi161@gmail.com',
    passwordHash: btoa('Muttu@123'),
    fullName: 'Muttu Hangaragi',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'admin_saarvi_super',
    email: 'admin@saarvi.app',
    passwordHash: btoa('admin123'),
    fullName: 'Saarvi SuperAdmin',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'admin_root_super',
    email: 'admin@docease.com',
    passwordHash: btoa('admin123'),
    fullName: 'Legacy SuperAdmin',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const serverMemoryStore: Record<string, unknown> = ((globalThis as unknown as Record<string, unknown>).__mockStorageServerStore as Record<string, unknown>) || {};
(globalThis as unknown as Record<string, unknown>).__mockStorageServerStore = serverMemoryStore;

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function getStored<T>(key: string, fallback: T): T {
  const legacyKey = key.startsWith('saarvi_') ? key.replace(/^saarvi_/, 'docease_') : key;
  if (!hasLocalStorage()) {
    return ((serverMemoryStore[key] ?? serverMemoryStore[legacyKey]) as T) ?? fallback;
  }
  try {
    const raw = localStorage.getItem(key) ?? (legacyKey !== key ? localStorage.getItem(legacyKey) : null);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  serverMemoryStore[key] = value;
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to persist ${key}`, e);
  }
}

function getUsersList(): StoredUser[] {
  const users = getStored<StoredUser[]>(STORAGE_KEYS.USERS, []);
  let changed = false;

  for (const defaultAdmin of DEFAULT_SUPER_ADMINS) {
    const existingIdx = users.findIndex((u) => u.email.toLowerCase() === defaultAdmin.email.toLowerCase());
    if (existingIdx === -1) {
      users.unshift(defaultAdmin);
      changed = true;
    } else {
      // Ensure seeded super admins always maintain SUPER_ADMIN role & expected password credentials
      if (users[existingIdx].role !== 'SUPER_ADMIN' || users[existingIdx].passwordHash !== defaultAdmin.passwordHash) {
        users[existingIdx].role = 'SUPER_ADMIN';
        users[existingIdx].passwordHash = defaultAdmin.passwordHash;
        users[existingIdx].status = 'ACTIVE';
        changed = true;
      }
    }
  }

  if (changed) {
    setStored(STORAGE_KEYS.USERS, users);
  }
  return users;
}

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export const MockStorageProvider = {
  getCurrentSession(): AuthSessionUser | null {
    return getStored<AuthSessionUser | null>(STORAGE_KEYS.SESSION, null);
  },

  getUserById(id: string): StoredUser | undefined {
    return getUsersList().find((u) => u.id === id);
  },

  getUserByEmail(email: string): StoredUser | undefined {
    return getUsersList().find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  signUp(params: { email: string; password: string; fullName: string }): { user: AuthSessionUser; profile: UserProfile } {
    const email = params.email.trim().toLowerCase();
    const users = getUsersList();

    if (users.some((u) => u.email === email)) {
      throw new Error('An account with this email address already exists.');
    }

    const now = new Date().toISOString();
    const newUser: StoredUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      email,
      passwordHash: btoa(params.password),
      fullName: params.fullName.trim() || 'User',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      lastSignInAt: now,
    };

    users.push(newUser);
    setStored(STORAGE_KEYS.USERS, users);

    // Record privacy-safe account event
    this.recordPlatformEvent({
      eventType: 'signup_completed',
      category: 'account',
    });

    const sessionUser: AuthSessionUser = {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      status: newUser.status,
      createdAt: newUser.createdAt,
    };

    const sessionCookie = JSON.stringify({ id: newUser.id, userId: newUser.id, email: newUser.email, role: newUser.role });
    setCookie('saarvi_local_session', sessionCookie);
    setCookie('docease_local_session', sessionCookie);
    setStored(STORAGE_KEYS.SESSION, sessionUser);

    const profile: UserProfile = {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    return { user: sessionUser, profile };
  },

  signIn(params: { email: string; password: string }): { user: AuthSessionUser; profile: UserProfile } {
    const email = params.email.trim().toLowerCase();
    const users = getUsersList();
    const found = users.find((u) => u.email === email);

    if (!found || found.passwordHash !== btoa(params.password)) {
      throw new Error("We couldn't sign you in. Please check your email and password.");
    }

    if (found.status === 'SUSPENDED' || found.status === 'DISABLED') {
      throw new Error("This account is currently suspended or disabled. Please contact support.");
    }

    const now = new Date().toISOString();
    found.lastSignInAt = now;
    const userIdx = users.findIndex((u) => u.id === found.id);
    if (userIdx !== -1) {
      users[userIdx].lastSignInAt = now;
      setStored(STORAGE_KEYS.USERS, users);
    }

    // Record privacy-safe account event
    this.recordPlatformEvent({
      eventType: 'login_completed',
      category: 'account',
    });

    const sessionUser: AuthSessionUser = {
      id: found.id,
      email: found.email,
      fullName: found.fullName,
      role: found.role,
      status: found.status,
      createdAt: found.createdAt,
    };

    const sessionCookie = JSON.stringify({ id: found.id, userId: found.id, email: found.email, role: found.role });
    setCookie('saarvi_local_session', sessionCookie);
    setCookie('docease_local_session', sessionCookie);
    setStored(STORAGE_KEYS.SESSION, sessionUser);

    const profile: UserProfile = {
      id: found.id,
      fullName: found.fullName,
      email: found.email,
      avatarUrl: found.avatarUrl,
      role: found.role,
      status: found.status,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    };

    return { user: sessionUser, profile };
  },

  signInWithGoogle(params?: { email?: string; fullName?: string }): { user: AuthSessionUser; profile: UserProfile } {
    const email = (params?.email || 'student.google@saarvi.app').trim().toLowerCase();
    const fullName = params?.fullName || 'Google Student';
    const users = getUsersList();
    let found = users.find((u) => u.email === email);

    const now = new Date().toISOString();
    if (!found) {
      // Idempotent initial profile creation for Google authentication
      found = {
        id: `usr_google_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email,
        fullName,
        role: 'USER', // Invariant: Google users are standard USERs by default
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        lastSignInAt: now,
        passwordHash: '',
      };
      users.push(found);
      setStored(STORAGE_KEYS.USERS, users);
    } else {
      // Reuse existing profile idempotently
      found.lastSignInAt = now;
      const userIdx = users.findIndex((u) => u.id === found!.id);
      if (userIdx !== -1) {
        users[userIdx].lastSignInAt = now;
        setStored(STORAGE_KEYS.USERS, users);
      }
    }

    // Record privacy-safe account event
    this.recordPlatformEvent({
      eventType: 'login_completed',
      category: 'account',
    });

    const sessionUser: AuthSessionUser = {
      id: found.id,
      email: found.email,
      fullName: found.fullName,
      role: found.role,
      status: found.status,
      createdAt: found.createdAt,
    };

    const sessionCookie = JSON.stringify({ id: found.id, userId: found.id, email: found.email, role: found.role });
    setCookie('saarvi_local_session', sessionCookie);
    setCookie('docease_local_session', sessionCookie);
    setStored(STORAGE_KEYS.SESSION, sessionUser);

    const profile: UserProfile = {
      id: found.id,
      fullName: found.fullName,
      email: found.email,
      avatarUrl: found.avatarUrl,
      role: found.role,
      status: found.status,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    };

    return { user: sessionUser, profile };
  },

  signOut(): void {
    if (hasLocalStorage()) {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem('docease_session_v1');
      removeCookie('saarvi_local_session');
      removeCookie('docease_local_session');
    }
  },

  updateProfile(userId: string, data: { fullName?: string }): UserProfile {
    const users = getStored<StoredUser[]>(STORAGE_KEYS.USERS, []);
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found.');

    const now = new Date().toISOString();
    if (data.fullName !== undefined) {
      users[idx].fullName = data.fullName.trim();
    }
    users[idx].updatedAt = now;
    setStored(STORAGE_KEYS.USERS, users);

    const session = getStored<AuthSessionUser | null>(STORAGE_KEYS.SESSION, null);
    if (session && session.id === userId) {
      session.fullName = users[idx].fullName;
      setStored(STORAGE_KEYS.SESSION, session);
    }

    return {
      id: users[idx].id,
      fullName: users[idx].fullName,
      email: users[idx].email,
      role: users[idx].role,
      createdAt: users[idx].createdAt,
      updatedAt: users[idx].updatedAt,
    };
  },

  updatePassword(userId: string, newPassword: string): void {
    const users = getStored<StoredUser[]>(STORAGE_KEYS.USERS, []);
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found.');

    users[idx].passwordHash = btoa(newPassword);
    users[idx].updatedAt = new Date().toISOString();
    setStored(STORAGE_KEYS.USERS, users);
  },

  deleteAccount(userId: string): void {
    // 1. Delete user from users table
    const users = getStored<StoredUser[]>(STORAGE_KEYS.USERS, []).filter((u) => u.id !== userId);
    setStored(STORAGE_KEYS.USERS, users);

    // 2. Cascade delete history
    const history = getStored<ConversionHistoryRecord[]>(STORAGE_KEYS.HISTORY, []).filter((h) => h.userId !== userId);
    setStored(STORAGE_KEYS.HISTORY, history);

    // 3. Cascade delete resumes
    const resumes = getStored<SavedResumeDraft[]>(STORAGE_KEYS.RESUMES, []).filter((r) => r.userId !== userId);
    setStored(STORAGE_KEYS.RESUMES, resumes);

    // 4. Cascade delete preferences
    const preferences = getStored<Record<string, UserPreferences>>(STORAGE_KEYS.PREFERENCES, {});
    delete preferences[userId];
    setStored(STORAGE_KEYS.PREFERENCES, preferences);

    // 5. Cascade delete student entities
    setStored(STORAGE_KEYS.STUDY_PLANS, getStored<StudyTask[]>(STORAGE_KEYS.STUDY_PLANS, []).filter((s) => s.userId !== userId));
    setStored(STORAGE_KEYS.ASSIGNMENTS, getStored<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, []).filter((a) => a.userId !== userId));
    setStored(STORAGE_KEYS.TIMETABLES, getStored<TimetableEntry[]>(STORAGE_KEYS.TIMETABLES, []).filter((t) => t.userId !== userId));
    setStored(STORAGE_KEYS.CERTIFICATES, getStored<CertificateRecord[]>(STORAGE_KEYS.CERTIFICATES, []).filter((c) => c.userId !== userId));
    setStored(STORAGE_KEYS.INTERNSHIPS, getStored<InternshipApplication[]>(STORAGE_KEYS.INTERNSHIPS, []).filter((i) => i.userId !== userId));
    setStored(STORAGE_KEYS.HACKATHONS, getStored<HackathonRecord[]>(STORAGE_KEYS.HACKATHONS, []).filter((h) => h.userId !== userId));
    setStored(STORAGE_KEYS.COVER_LETTERS, getStored<CoverLetterData[]>(STORAGE_KEYS.COVER_LETTERS, []).filter((c) => c.userId !== userId));

    // 6. Invalidate session
    this.signOut();
  },

  // --- RLS-Protected Conversion History ---
  getConversionHistory(userId: string): ConversionHistoryRecord[] {
    const all = getStored<ConversionHistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    // Strict RLS isolation: only records matching userId
    return all.filter((item) => item.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  recordConversion(record: Omit<ConversionHistoryRecord, 'id' | 'createdAt'>): ConversionHistoryRecord {
    const all = getStored<ConversionHistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    const newRecord: ConversionHistoryRecord = {
      ...record,
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    all.unshift(newRecord);
    setStored(STORAGE_KEYS.HISTORY, all);
    return newRecord;
  },

  clearConversionHistory(userId: string): void {
    const all = getStored<ConversionHistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    // Delete ONLY this user's records
    const remaining = all.filter((item) => item.userId !== userId);
    setStored(STORAGE_KEYS.HISTORY, remaining);
  },

  deleteConversionRecord(userId: string, recordId: string): void {
    const all = getStored<ConversionHistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    // RLS isolation: only allow deleting own records
    const remaining = all.filter((item) => !(item.id === recordId && item.userId === userId));
    setStored(STORAGE_KEYS.HISTORY, remaining);
  },

  // --- RLS-Protected Saved Resumes ---
  getResumes(userId: string): SavedResumeDraft[] {
    const all = getStored<SavedResumeDraft[]>(STORAGE_KEYS.RESUMES, []);
    return all.filter((item) => item.userId === userId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  createResume(userId: string, title: string, template = 'ats-classic', content: Record<string, unknown> = {}): SavedResumeDraft {
    const all = getStored<SavedResumeDraft[]>(STORAGE_KEYS.RESUMES, []);
    const now = new Date().toISOString();
    const newResume: SavedResumeDraft = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: title.trim() || 'Untitled Resume',
      template,
      content,
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(newResume);
    setStored(STORAGE_KEYS.RESUMES, all);
    return newResume;
  },

  updateResume(userId: string, id: string, updates: { title?: string; template?: string; content?: Record<string, unknown> }): SavedResumeDraft {
    const all = getStored<SavedResumeDraft[]>(STORAGE_KEYS.RESUMES, []);
    const idx = all.findIndex((r) => r.id === id && r.userId === userId);
    if (idx === -1) throw new Error('Resume not found or unauthorized.');

    const now = new Date().toISOString();
    all[idx] = {
      ...all[idx],
      ...updates,
      updatedAt: now,
    };
    setStored(STORAGE_KEYS.RESUMES, all);
    return all[idx];
  },

  duplicateResume(userId: string, id: string): SavedResumeDraft {
    const all = getStored<SavedResumeDraft[]>(STORAGE_KEYS.RESUMES, []);
    const target = all.find((r) => r.id === id && r.userId === userId);
    if (!target) throw new Error('Resume not found or unauthorized.');

    return this.createResume(userId, `${target.title} (Copy)`, target.template, target.content);
  },

  deleteResume(userId: string, id: string): void {
    const all = getStored<SavedResumeDraft[]>(STORAGE_KEYS.RESUMES, []);
    const remaining = all.filter((r) => !(r.id === id && r.userId === userId));
    setStored(STORAGE_KEYS.RESUMES, remaining);
  },

  // --- RLS-Protected User Preferences ---
  getPreferences(userId: string): UserPreferences {
    const all = getStored<Record<string, UserPreferences>>(STORAGE_KEYS.PREFERENCES, {});
    return all[userId] || {
      userId,
      autoDownload: true,
      theme: 'light',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  updatePreferences(userId: string, updates: Partial<Omit<UserPreferences, 'userId' | 'createdAt'>>): UserPreferences {
    const all = getStored<Record<string, UserPreferences>>(STORAGE_KEYS.PREFERENCES, {});
    const existing = all[userId] || {
      userId,
      autoDownload: true,
      theme: 'light',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    all[userId] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setStored(STORAGE_KEYS.PREFERENCES, all);
    return all[userId];
  },

  // --- RLS-Protected Study Plans ---
  getStudyPlans(userId: string): StudyTask[] {
    const all = getStored<StudyTask[]>(STORAGE_KEYS.STUDY_PLANS, []);
    return all.filter((s) => s.userId === userId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  saveStudyPlan(task: Omit<StudyTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): StudyTask {
    const all = getStored<StudyTask[]>(STORAGE_KEYS.STUDY_PLANS, []);
    const now = new Date().toISOString();
    if (task.id) {
      const idx = all.findIndex((s) => s.id === task.id && s.userId === task.userId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...task, updatedAt: now };
        setStored(STORAGE_KEYS.STUDY_PLANS, all);
        return all[idx];
      }
    }
    const newTask: StudyTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    all.push(newTask);
    setStored(STORAGE_KEYS.STUDY_PLANS, all);
    return newTask;
  },

  deleteStudyPlan(userId: string, taskId: string): void {
    const all = getStored<StudyTask[]>(STORAGE_KEYS.STUDY_PLANS, []);
    setStored(STORAGE_KEYS.STUDY_PLANS, all.filter((s) => !(s.id === taskId && s.userId === userId)));
  },

  toggleStudyPlan(userId: string, taskId: string): StudyTask | null {
    const all = getStored<StudyTask[]>(STORAGE_KEYS.STUDY_PLANS, []);
    const idx = all.findIndex((s) => s.id === taskId && s.userId === userId);
    if (idx === -1) return null;
    all[idx].completed = !all[idx].completed;
    all[idx].updatedAt = new Date().toISOString();
    setStored(STORAGE_KEYS.STUDY_PLANS, all);
    return all[idx];
  },

  // --- RLS-Protected Assignments ---
  getAssignments(userId: string): Assignment[] {
    const all = getStored<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, []);
    return all.filter((a) => a.userId === userId).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  },

  saveAssignment(assignment: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Assignment {
    const all = getStored<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, []);
    const now = new Date().toISOString();
    if (assignment.id) {
      const idx = all.findIndex((a) => a.id === assignment.id && a.userId === assignment.userId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...assignment, updatedAt: now };
        setStored(STORAGE_KEYS.ASSIGNMENTS, all);
        return all[idx];
      }
    }
    const newAssignment: Assignment = {
      ...assignment,
      id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    all.push(newAssignment);
    setStored(STORAGE_KEYS.ASSIGNMENTS, all);
    return newAssignment;
  },

  deleteAssignment(userId: string, id: string): void {
    const all = getStored<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, []);
    setStored(STORAGE_KEYS.ASSIGNMENTS, all.filter((a) => !(a.id === id && a.userId === userId)));
  },

  // --- RLS-Protected Timetables ---
  getTimetable(userId: string): TimetableEntry[] {
    const all = getStored<TimetableEntry[]>(STORAGE_KEYS.TIMETABLES, []);
    return all.filter((t) => t.userId === userId);
  },

  saveTimetable(userId: string, entries: TimetableEntry[]): TimetableEntry[] {
    const all = getStored<TimetableEntry[]>(STORAGE_KEYS.TIMETABLES, []).filter((t) => t.userId !== userId);
    const withUser = entries.map((e) => ({
      ...e,
      userId,
      id: e.id || `tt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    }));
    const updated = [...all, ...withUser];
    setStored(STORAGE_KEYS.TIMETABLES, updated);
    return withUser;
  },

  // --- RLS-Protected Certificates (Metadata only, 0 bytes file content) ---
  getCertificates(userId: string): CertificateRecord[] {
    const all = getStored<CertificateRecord[]>(STORAGE_KEYS.CERTIFICATES, []);
    return all.filter((c) => c.userId === userId).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  },

  saveCertificate(cert: Omit<CertificateRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): CertificateRecord {
    const all = getStored<CertificateRecord[]>(STORAGE_KEYS.CERTIFICATES, []);
    const now = new Date().toISOString();
    if (cert.id) {
      const idx = all.findIndex((c) => c.id === cert.id && c.userId === cert.userId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...cert, updatedAt: now };
        setStored(STORAGE_KEYS.CERTIFICATES, all);
        return all[idx];
      }
    }
    const newCert: CertificateRecord = {
      ...cert,
      id: `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(newCert);
    setStored(STORAGE_KEYS.CERTIFICATES, all);
    return newCert;
  },

  deleteCertificate(userId: string, id: string): void {
    const all = getStored<CertificateRecord[]>(STORAGE_KEYS.CERTIFICATES, []);
    setStored(STORAGE_KEYS.CERTIFICATES, all.filter((c) => !(c.id === id && c.userId === userId)));
  },

  // --- RLS-Protected Internships ---
  getInternships(userId: string): InternshipApplication[] {
    const all = getStored<InternshipApplication[]>(STORAGE_KEYS.INTERNSHIPS, []);
    return all.filter((i) => i.userId === userId).sort((a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime());
  },

  saveInternship(internship: Omit<InternshipApplication, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): InternshipApplication {
    const all = getStored<InternshipApplication[]>(STORAGE_KEYS.INTERNSHIPS, []);
    const now = new Date().toISOString();
    if (internship.id) {
      const idx = all.findIndex((i) => i.id === internship.id && i.userId === internship.userId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...internship, updatedAt: now };
        setStored(STORAGE_KEYS.INTERNSHIPS, all);
        return all[idx];
      }
    }
    const newInternship: InternshipApplication = {
      ...internship,
      id: `intern_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(newInternship);
    setStored(STORAGE_KEYS.INTERNSHIPS, all);
    return newInternship;
  },

  deleteInternship(userId: string, id: string): void {
    const all = getStored<InternshipApplication[]>(STORAGE_KEYS.INTERNSHIPS, []);
    setStored(STORAGE_KEYS.INTERNSHIPS, all.filter((i) => !(i.id === id && i.userId === userId)));
  },

  // --- RLS-Protected Hackathons ---
  getHackathons(userId: string): HackathonRecord[] {
    const all = getStored<HackathonRecord[]>(STORAGE_KEYS.HACKATHONS, []);
    return all.filter((h) => h.userId === userId).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  },

  saveHackathon(hackathon: Omit<HackathonRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): HackathonRecord {
    const all = getStored<HackathonRecord[]>(STORAGE_KEYS.HACKATHONS, []);
    const now = new Date().toISOString();
    if (hackathon.id) {
      const idx = all.findIndex((h) => h.id === hackathon.id && h.userId === hackathon.userId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...hackathon, updatedAt: now };
        setStored(STORAGE_KEYS.HACKATHONS, all);
        return all[idx];
      }
    }
    const newHackathon: HackathonRecord = {
      ...hackathon,
      id: `hack_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(newHackathon);
    setStored(STORAGE_KEYS.HACKATHONS, all);
    return newHackathon;
  },

  deleteHackathon(userId: string, id: string): void {
    const all = getStored<HackathonRecord[]>(STORAGE_KEYS.HACKATHONS, []);
    setStored(STORAGE_KEYS.HACKATHONS, all.filter((h) => !(h.id === id && h.userId === userId)));
  },

  // --- RLS-Protected Cover Letters ---
  getCoverLetters(userId: string): CoverLetterData[] {
    const all = getStored<CoverLetterData[]>(STORAGE_KEYS.COVER_LETTERS, []);
    return all.filter((c) => c.userId === userId).sort((a, b) => new Date(b.updatedAt || "").getTime() - new Date(a.updatedAt || "").getTime());
  },

  saveCoverLetter(letter: CoverLetterData): CoverLetterData {
    const all = getStored<CoverLetterData[]>(STORAGE_KEYS.COVER_LETTERS, []);
    const now = new Date().toISOString();
    if (letter.id) {
      const idx = all.findIndex((c) => c.id === letter.id && c.userId === letter.userId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...letter, updatedAt: now };
        setStored(STORAGE_KEYS.COVER_LETTERS, all);
        return all[idx];
      }
    }
    const newLetter: CoverLetterData = {
      ...letter,
      id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(newLetter);
    setStored(STORAGE_KEYS.COVER_LETTERS, all);
    return newLetter;
  },

  deleteCoverLetter(userId: string, id: string): void {
    const all = getStored<CoverLetterData[]>(STORAGE_KEYS.COVER_LETTERS, []);
    setStored(STORAGE_KEYS.COVER_LETTERS, all.filter((c) => !(c.id === id && c.userId === userId)));
  },

  // --- Academic Calculation Snapshots (Phase 10) ---
  getAcademicRecords(userId: string): AcademicCalculationSnapshot[] {
    const all = getStored<AcademicCalculationSnapshot[]>(STORAGE_KEYS.ACADEMIC_RECORDS, []);
    return all.filter((r) => r.userId === userId && r.status !== 'archived');
  },

  getLatestAcademicRecord(userId: string): AcademicCalculationSnapshot | null {
    const records = this.getAcademicRecords(userId);
    return records.length > 0 ? records[0] : null;
  },

  saveAcademicRecord(record: AcademicCalculationSnapshot): AcademicCalculationSnapshot {
    const all = getStored<AcademicCalculationSnapshot[]>(STORAGE_KEYS.ACADEMIC_RECORDS, []);
    const now = new Date().toISOString();
    const newRecord: AcademicCalculationSnapshot = {
      ...record,
      id: record.id || `acad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };
    const filtered = all.filter((r) => !(r.id === newRecord.id && r.userId === newRecord.userId));
    filtered.unshift(newRecord);
    setStored(STORAGE_KEYS.ACADEMIC_RECORDS, filtered);
    return newRecord;
  },

  // --- Live Student Activity Metrics for Dashboard ---
  getStudentSummary(userId: string): {
    resumesCount: number;
    internshipsCount: number;
    hackathonsCount: number;
    studyTasksUpcoming: number;
    assignmentsUpcoming: number;
    latestCgpa: number | null;
    latestSgpa: number | null;
    completedSemesters: number;
  } {
    const resumes = this.getResumes(userId).length;
    const internships = this.getInternships(userId).length;
    const hackathons = this.getHackathons(userId).length;
    const studyTasks = this.getStudyPlans(userId).filter((s) => !s.completed).length;
    const assignments = this.getAssignments(userId).filter((a) => a.status !== 'completed').length;
    const latestAcademic = this.getLatestAcademicRecord(userId);

    const completedSems = latestAcademic?.semesters?.filter((s) => s.status === 'completed').length || 0;
    const latestSgpa = latestAcademic?.semesters?.length
      ? latestAcademic.semesters[latestAcademic.semesters.length - 1].sgpa
      : null;

    return {
      resumesCount: resumes,
      internshipsCount: internships,
      hackathonsCount: hackathons,
      studyTasksUpcoming: studyTasks,
      assignmentsUpcoming: assignments,
      latestCgpa: latestAcademic ? latestAcademic.cgpa : null,
      latestSgpa: latestSgpa,
      completedSemesters: completedSems,
    };
  },

  // ==========================================
  // PHASE 11: COMPLETE ADMIN CONTROL CENTER
  // ==========================================

  // --- Users & Roles ---
  listAllUsers(): Array<Omit<StoredUser, 'passwordHash'>> {
    const users = getUsersList();
    return users.map(({ passwordHash, ...safeUser }) => safeUser);
  },

  updateUserStatus(userId: string, status: UserAccountStatus): void {
    const users = getUsersList();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found.');
    users[idx].status = status;
    users[idx].updatedAt = new Date().toISOString();
    setStored(STORAGE_KEYS.USERS, users);
  },

  updateUserRole(userId: string, role: UserRole): void {
    const users = getUsersList();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found.');
    users[idx].role = role;
    users[idx].updatedAt = new Date().toISOString();
    setStored(STORAGE_KEYS.USERS, users);
  },

  // --- Platform Settings ---
  getPlatformSettings(): PlatformSettings {
    const defaults: PlatformSettings = {
      appName: 'Saarvi',
      tagline: 'Saarvi — Study. Work. Grow.',
      logoUrl: '/brand/saarvi-logo.png',
      faviconUrl: '/brand/favicon.png',
      brandAccent: '#2563eb',
      supportEmail: 'support@saarvi.app',
      contactEmail: 'contact@saarvi.app',
      defaultLanguage: 'en',
      defaultTimezone: 'Asia/Kolkata',
      maintenanceMode: false,
      maintenanceMessage: 'Saarvi is temporarily under maintenance. Please try again shortly.',
      registrationEnabled: true,
      guestAccessEnabled: true,
      defaultAutoDownload: true,
      publicToolAvailability: true,
      version: 1,
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
    return getStored<PlatformSettings>(STORAGE_KEYS.PLATFORM_SETTINGS, defaults);
  },

  updatePlatformSettings(updates: Partial<PlatformSettings>, updatedBy = 'admin'): PlatformSettings {
    const current = this.getPlatformSettings();
    const updated: PlatformSettings = {
      ...current,
      ...updates,
      version: (current.version || 1) + 1,
      updatedBy,
      updatedAt: new Date().toISOString(),
    };
    setStored(STORAGE_KEYS.PLATFORM_SETTINGS, updated);
    return updated;
  },

  // --- Tool Overrides ---
  getToolOverrides(): Record<string, ToolOverrideConfig> {
    return getStored<Record<string, ToolOverrideConfig>>(STORAGE_KEYS.TOOL_OVERRIDES, {});
  },

  saveToolOverride(override: ToolOverrideConfig): ToolOverrideConfig {
    const overrides = this.getToolOverrides();
    const updated = {
      ...override,
      updatedAt: new Date().toISOString(),
    };
    overrides[override.id] = updated;
    setStored(STORAGE_KEYS.TOOL_OVERRIDES, overrides);
    return updated;
  },

  // --- Curriculum Versions ---
  getCurriculumVersions(): CurriculumVersionRecord[] {
    return getStored<CurriculumVersionRecord[]>(STORAGE_KEYS.CURRICULUM_VERSIONS, []);
  },

  saveCurriculumVersion(record: CurriculumVersionRecord): CurriculumVersionRecord {
    const all = this.getCurriculumVersions();
    const now = new Date().toISOString();
    const updated: CurriculumVersionRecord = {
      ...record,
      id: record.id || `curric_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };
    const filtered = all.filter((c) => c.id !== updated.id);
    filtered.unshift(updated);
    setStored(STORAGE_KEYS.CURRICULUM_VERSIONS, filtered);
    return updated;
  },

  // --- Announcements ---
  getAnnouncements(): AnnouncementRecord[] {
    return getStored<AnnouncementRecord[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
  },

  saveAnnouncement(announcement: AnnouncementRecord): AnnouncementRecord {
    const all = this.getAnnouncements();
    const now = new Date().toISOString();
    const updated: AnnouncementRecord = {
      ...announcement,
      id: announcement.id || `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: announcement.createdAt || now,
      updatedAt: now,
    };
    const filtered = all.filter((a) => a.id !== updated.id);
    filtered.unshift(updated);
    setStored(STORAGE_KEYS.ANNOUNCEMENTS, filtered);
    return updated;
  },

  deleteAnnouncement(id: string): void {
    const all = this.getAnnouncements();
    setStored(STORAGE_KEYS.ANNOUNCEMENTS, all.filter((a) => a.id !== id));
  },

  // --- Platform Errors Log ---
  getSystemErrors(): PlatformErrorRecord[] {
    return getStored<PlatformErrorRecord[]>(STORAGE_KEYS.ERRORS, []);
  },

  addSystemError(error: Omit<PlatformErrorRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): PlatformErrorRecord {
    const all = this.getSystemErrors();
    const newError: PlatformErrorRecord = {
      id: error.id || `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: error.timestamp || new Date().toISOString(),
      service: error.service,
      tool: error.tool,
      severity: error.severity,
      errorType: error.errorType,
      requestId: error.requestId || `req_${Date.now().toString(36)}`,
      status: error.status || 'NEW',
      safeMessage: error.safeMessage,
      diagnostics: error.diagnostics,
    };
    all.unshift(newError);
    if (all.length > 200) all.pop(); // keep last 200 errors
    setStored(STORAGE_KEYS.ERRORS, all);
    return newError;
  },

  updateSystemError(id: string, status: PlatformErrorRecord['status']): void {
    const all = this.getSystemErrors();
    const idx = all.findIndex((e) => e.id === id);
    if (idx !== -1) {
      all[idx].status = status;
      setStored(STORAGE_KEYS.ERRORS, all);
    }
  },

  // --- Audit Logs (Append-Only) ---
  getAuditLogs(): AuditLogRecord[] {
    return getStored<AuditLogRecord[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  },

  addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'timestamp'>): AuditLogRecord {
    const all = this.getAuditLogs();
    const newLog: AuditLogRecord = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    all.unshift(newLog);
    if (all.length > 500) all.pop(); // keep last 500 audit logs
    setStored(STORAGE_KEYS.AUDIT_LOGS, all);
    return newLog;
  },

  // --- Feature Flags ---
  getFeatureFlags(): FeatureFlag[] {
    const defaultFlags: FeatureFlag[] = [
      { id: 'local-pdf-conversion', name: 'Local PDF Conversion', description: 'Client-side PDF transformations', category: 'tools', status: 'ENABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'image-tools', name: 'Image Processing Tools', description: 'Client-side image conversion and resizing', category: 'tools', status: 'ENABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'student-calculators', name: 'VTU Academic Calculators', description: 'SGPA, CGPA, and attendance tools', category: 'student', status: 'ENABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'resume-builder', name: 'Resume Builder', description: 'Local ATS-optimized resume generator', category: 'student', status: 'ENABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'cover-letter', name: 'Cover Letter Builder', description: 'Targeted student cover letter creator', category: 'student', status: 'ENABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'internship-tracker', name: 'Internship Tracker', description: 'Application and milestone organizer', category: 'student', status: 'ENABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'hackathon-tracker', name: 'Hackathon Tracker', description: 'Project and submission registry', category: 'student', status: 'ENABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'ocr-engine', name: 'Optical Character Recognition', description: 'Future OCR extraction from scanned pages', category: 'future', status: 'DISABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'ai-resume', name: 'AI Resume Assistant', description: 'Future intelligent bullet point enhancer', category: 'future', status: 'DISABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'ai-pdf', name: 'AI PDF Analyzer', description: 'Future semantic document assistant', category: 'future', status: 'DISABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'pro-tier', name: 'Saarvi Pro Subscriptions', description: 'Future premium feature tier', category: 'future', status: 'DISABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
      { id: 'cloud-sync', name: 'Cloud File Storage Sync', description: 'Future remote file backup capability', category: 'future', status: 'DISABLED', updatedAt: '2026-01-01', updatedBy: 'system' },
    ];
    return getStored<FeatureFlag[]>(STORAGE_KEYS.FEATURE_FLAGS, defaultFlags);
  },

  updateFeatureFlag(flag: FeatureFlag): FeatureFlag {
    const all = this.getFeatureFlags();
    const idx = all.findIndex((f) => f.id === flag.id);
    const updated = {
      ...flag,
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }
    setStored(STORAGE_KEYS.FEATURE_FLAGS, all);
    return updated;
  },

  // --- Privacy-Safe Platform Events ---
  recordPlatformEvent(event: {
    eventType: PlatformEventType;
    targetId?: string;
    category: 'tool' | 'student' | 'account' | 'system';
  }): PlatformEventRecord {
    const events = getStored<PlatformEventRecord[]>(STORAGE_KEYS.PLATFORM_EVENTS, []);
    const record: PlatformEventRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType: event.eventType,
      targetId: event.targetId,
      category: event.category,
      timestamp: new Date().toISOString(),
    };
    events.unshift(record);
    if (events.length > 1000) {
      events.length = 1000;
    }
    setStored(STORAGE_KEYS.PLATFORM_EVENTS, events);
    return record;
  },

  getPlatformEvents(): PlatformEventRecord[] {
    return getStored<PlatformEventRecord[]>(STORAGE_KEYS.PLATFORM_EVENTS, []);
  },

  clearPlatformEvents(): void {
    if (hasLocalStorage()) {
      localStorage.removeItem(STORAGE_KEYS.PLATFORM_EVENTS);
    }
  },

  // =========================================================================
  // Phase 13: Subscriptions & Billing Persistence
  // =========================================================================

  getSubscriptions(): SubscriptionRecord[] {
    return getStored<SubscriptionRecord[]>(STORAGE_KEYS.SUBSCRIPTIONS, []);
  },

  getUserSubscription(userId: string): SubscriptionRecord | null {
    const all = getStored<SubscriptionRecord[]>(STORAGE_KEYS.SUBSCRIPTIONS, []);
    return all.find((s) => s.userId === userId) || null;
  },

  saveSubscription(sub: SubscriptionRecord): SubscriptionRecord {
    const all = getStored<SubscriptionRecord[]>(STORAGE_KEYS.SUBSCRIPTIONS, []);
    const idx = all.findIndex((s) => s.id === sub.id || s.providerSubscriptionId === sub.providerSubscriptionId);
    const updated = {
      ...sub,
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }
    setStored(STORAGE_KEYS.SUBSCRIPTIONS, all);
    return updated;
  },

  deleteSubscription(subscriptionId: string): void {
    const all = getStored<SubscriptionRecord[]>(STORAGE_KEYS.SUBSCRIPTIONS, []);
    const filtered = all.filter((s) => s.id !== subscriptionId && s.providerSubscriptionId !== subscriptionId);
    setStored(STORAGE_KEYS.SUBSCRIPTIONS, filtered);
  },

  // Webhook Event Idempotency
  getBillingEvents(): BillingEventRecord[] {
    return getStored<BillingEventRecord[]>(STORAGE_KEYS.BILLING_EVENTS, []);
  },

  isBillingEventProcessed(providerEventId: string): boolean {
    const all = getStored<BillingEventRecord[]>(STORAGE_KEYS.BILLING_EVENTS, []);
    return all.some((e) => e.providerEventId === providerEventId && e.status === 'PROCESSED');
  },

  recordBillingEvent(event: BillingEventRecord): BillingEventRecord {
    const all = getStored<BillingEventRecord[]>(STORAGE_KEYS.BILLING_EVENTS, []);
    const idx = all.findIndex((e) => e.providerEventId === event.providerEventId);
    if (idx !== -1) {
      all[idx] = event;
    } else {
      all.unshift(event);
      if (all.length > 500) {
        all.length = 500;
      }
    }
    setStored(STORAGE_KEYS.BILLING_EVENTS, all);
    return event;
  },

  // Invoices & Receipts
  getInvoices(userId?: string): BillingInvoiceRecord[] {
    const all = getStored<BillingInvoiceRecord[]>(STORAGE_KEYS.INVOICES, []);
    if (userId) {
      return all.filter((inv) => inv.userId === userId);
    }
    return all;
  },

  saveInvoice(invoice: BillingInvoiceRecord): BillingInvoiceRecord {
    const all = getStored<BillingInvoiceRecord[]>(STORAGE_KEYS.INVOICES, []);
    const idx = all.findIndex((i) => i.providerInvoiceId === invoice.providerInvoiceId);
    if (idx !== -1) {
      all[idx] = invoice;
    } else {
      all.unshift(invoice);
    }
    setStored(STORAGE_KEYS.INVOICES, all);
    return invoice;
  },
};

