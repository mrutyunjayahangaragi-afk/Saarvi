// Resilient Local Storage Provider for DocEase
// Implements zero-configuration auth, profile, history, and resume draft persistence with strict user isolation (RLS)

import type {
  UserProfile,
  ConversionHistoryRecord,
  SavedResumeDraft,
  UserPreferences,
  AuthSessionUser,
  UserRole,
  UserAccountStatus,
} from '@/types/auth';
import type {
  StudyTask,
  Assignment,
  TimetableEntry,
  CertificateRecord,
  InternshipApplication,
  HackathonRecord,
  CoverLetterData,
  AcademicCalculationSnapshot,
} from '@/types/student';
import type {
  PlatformSettings,
  SeoSettings,
  ToolOverrideConfig,
  CurriculumVersionRecord,
  AnnouncementRecord,
  PlatformErrorRecord,
  AuditLogRecord,
  FeatureFlag,
  PlatformEventRecord,
  PlatformEventType,
} from '@/types/admin';
import type {
  SubscriptionRecord,
  BillingEventRecord,
  BillingInvoiceRecord,
  RazorpayPaymentOrder,
  RazorpayPaymentOrderStatus,
} from '@/types/plan';
import type {
  NotificationRecord,
  NotificationRecipientRecord,
  NotificationTemplateRecord,
  NotificationPreferenceRecord,
  NotificationSystemSettings,
  NotificationAuditLogRecord,
} from '@/types/notifications-v2';

import type { ToolControlConfig, ToolAccessAuditLog, UserToolUsageSummary } from '@/types/tool-control';

export interface RoleAuditLogRecord {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  old_role: string;
  new_role: string;
  action: string;
  reason?: string;
  timestamp: string;
}

export interface StoredBetaUsage {
  userId: string;
  toolKey: string;
  usageCount: number;
  reservedCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

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
  SEO_SETTINGS: 'saarvi_seo_settings_v1',
  PLATFORM_SYNC_TRIGGER: 'saarvi_platform_sync_trigger',
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
  // Role & Notification Keys
  ROLE_AUDIT_LOGS: 'saarvi_role_audit_logs_v1',
  NOTIFICATIONS_V2: 'saarvi_notifications_v2',
  NOTIFICATION_RECIPIENTS_V2: 'saarvi_notification_recipients_v2',
  NOTIFICATION_TEMPLATES_V2: 'saarvi_notification_templates_v2',
  NOTIFICATION_PREFERENCES_V2: 'saarvi_notification_preferences_v2',
  NOTIFICATION_AUDIT_LOGS_V2: 'saarvi_notification_audit_logs_v2',
  NOTIFICATION_SETTINGS_V2: 'saarvi_notification_settings_v2',
  // Phase 41 Tool Control Center & Beta Usage Keys
  TOOL_ACCESS_CONFIGS: 'saarvi_tool_access_configs_v1',
  TOOL_ACCESS_AUDIT_LOGS: 'saarvi_tool_access_audit_logs_v1',
  TOOL_BETA_USAGES: 'saarvi_tool_beta_usages_v1',
  // Phase 42 Razorpay Orders Key
  PAYMENT_ORDERS: 'saarvi_payment_orders_v1',
  // Phase 43 Feedback System Key
  FEEDBACK: 'saarvi_feedback_v1',
  // Phase 44 Canonical Tool Telemetry & Academic Pipeline Keys
  ACADEMIC_SUBJECTS: 'saarvi_academic_subjects_v1',
  ACADEMIC_CONFLICTS: 'saarvi_academic_conflicts_v1',
  ACADEMIC_AUDIT_LOGS: 'saarvi_academic_audit_logs_v1',
  // Phase 45 Jobs & Internships Platform Keys
  JOB_OPPORTUNITIES: 'saarvi_job_opportunities_v1',
  JOB_SOURCE_RECORDS: 'saarvi_job_source_records_v1',
  JOB_AUDIT_LOGS: 'saarvi_job_audit_logs_v1',
  SAVED_JOBS: 'saarvi_saved_jobs_v1',
  JOB_APPLICATIONS: 'saarvi_job_applications_v1',
  JOB_REPORTS: 'saarvi_job_reports_v1',
};

export interface StoredAcademicSubject {
  id: string;
  universityId: string;
  schemeId: string;
  branchId: string;
  semester: number;
  academicYear: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  courseType: string;
  seeApplicable: boolean;
  cieApplicable: boolean;
  sourceType: 'OFFICIAL_UNIVERSITY_WEBSITE' | 'OFFICIAL_CURRICULUM_PDF' | 'OFFICIAL_UNIVERSITY_API' | 'VERIFIED_ACADEMIC_DATASET' | 'MANUAL_ADMIN_ENTRY';
  sourceUrl?: string;
  sourceDocument?: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'DISPUTED' | 'CONFLICT_REQUIRES_REVIEW' | 'REJECTED';
  conflictDetails?: any;
  auditHistory?: Array<{ timestamp: string; action: string; actor: string; changes: any }>;
  version: number;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAcademicConflict {
  id: string;
  subjectCode: string;
  subjectId?: string;
  universityId: string;
  schemeId: string;
  branchId: string;
  semester: number;
  existingSource: string;
  existingData: any;
  conflictingSource: string;
  conflictingData: any;
  resolutionStatus: 'PENDING' | 'RESOLVED' | 'REJECTED';
  resolvedBy?: string;
  resolvedAt?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFeedback {
  id: string;
  userId?: string | null;
  userEmail?: string;
  userName?: string;
  rating: number;
  category: string;
  message: string;
  toolKey?: string;
  pageUrl?: string;
  status: 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'ARCHIVED';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

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
  authProvider?: 'EMAIL' | 'GOOGLE';
  plan?: 'FREE' | 'PRO';
  emailVerified?: boolean;
  emailConfirmedAt?: string;
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
    id: 'user_saarvi_standard',
    email: 'admin@saarvi.in',
    passwordHash: btoa('admin123'),
    fullName: 'Saarvi Standard User',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user_legacy_standard',
    email: 'admin@docease.com',
    passwordHash: btoa('admin123'),
    fullName: 'Legacy Standard User',
    role: 'USER',
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

function getAdminClientSafe(): any {
  if (typeof window !== 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseAdminClient } = require('./admin');
    return getSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function hydrateMockStorageFromSupabase(): Promise<void> {
  if (typeof window !== 'undefined') return;
  try {
    const supabase = getAdminClientSafe();
    if (!supabase) return;

    const [toolsRes, settingsRes] = await Promise.all([
      supabase.from('tool_overrides').select('*'),
      supabase.from('platform_settings').select('*').eq('id', 'default_config').maybeSingle(),
    ]);

    if (toolsRes.data && toolsRes.data.length > 0) {
      const overrides: Record<string, any> = (serverMemoryStore[STORAGE_KEYS.TOOL_OVERRIDES] as Record<string, any>) || {};
      for (const row of toolsRes.data) {
        overrides[row.id] = {
          id: row.id,
          name: row.name,
          category: row.category,
          status: row.status,
          requiresAuth: row.requires_auth,
          requiresPro: row.requires_pro,
          maxSizeMB: row.max_size_mb,
          maxFiles: row.max_files,
          maxPages: row.max_pages,
          orderIndex: row.order_index,
          hidden: row.hidden,
          description: row.description,
          updatedBy: row.updated_by,
          updatedAt: row.updated_at,
        };
      }
      serverMemoryStore[STORAGE_KEYS.TOOL_OVERRIDES] = overrides;
    }

    if (settingsRes.data) {
      const row = settingsRes.data;
      serverMemoryStore[STORAGE_KEYS.PLATFORM_SETTINGS] = {
        appName: row.app_name,
        tagline: row.tagline,
        logoUrl: row.logo_url,
        faviconUrl: row.favicon_url,
        brandAccent: row.brand_accent,
        supportEmail: row.support_email,
        contactEmail: row.contact_email,
        defaultLanguage: row.default_language,
        defaultTimezone: row.default_timezone,
        maintenanceMode: row.maintenance_mode,
        maintenanceMessage: row.maintenance_message,
        registrationEnabled: row.registration_enabled,
        guestAccessEnabled: row.guest_access_enabled,
        defaultAutoDownload: row.default_auto_download,
        publicToolAvailability: row.public_tool_availability,
        version: row.version,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
      };
    }
  } catch (err: any) {
    console.warn('[MockStorage Supabase hydration error]:', err?.message);
  }
}

if (typeof window === 'undefined') {
  hydrateMockStorageFromSupabase().catch(() => {});
}

function getUsersList(): StoredUser[] {
  const users = getStored<StoredUser[]>(STORAGE_KEYS.USERS, []);
  let changed = false;

  for (const defaultUser of DEFAULT_SUPER_ADMINS) {
    const existingIdx = users.findIndex((u) => u.email.toLowerCase() === defaultUser.email.toLowerCase());
    if (existingIdx === -1) {
      users.unshift(defaultUser);
      changed = true;
    } else {
      // Ensure muttuhangaragi161@gmail.com is SUPER_ADMIN and legacy admin@saarvi.in / admin@docease.com are normal USERs
      if (defaultUser.role === 'SUPER_ADMIN' && users[existingIdx].role !== 'SUPER_ADMIN') {
        users[existingIdx].role = 'SUPER_ADMIN';
        users[existingIdx].status = 'ACTIVE';
        changed = true;
      } else if (defaultUser.role === 'USER' && users[existingIdx].role === 'SUPER_ADMIN') {
        // Explicitly revoke administrative authorization while preserving user account data
        users[existingIdx].role = 'USER';
        changed = true;
      }
      if (users[existingIdx].passwordHash !== defaultUser.passwordHash) {
        users[existingIdx].passwordHash = defaultUser.passwordHash;
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
      status: 'PENDING_EMAIL_VERIFICATION',
      createdAt: now,
      updatedAt: now,
      lastSignInAt: now,
      authProvider: 'EMAIL',
      plan: 'FREE',
      emailVerified: false,
    };

    users.push(newUser);
    setStored(STORAGE_KEYS.USERS, users);

    // Record privacy-safe account lifecycle events (never treat unverified signup as active registered user)
    this.recordPlatformEvent({
      eventType: 'signup_started' as any,
      eventName: 'signup_started',
      category: 'account',
      userId: newUser.id,
    });
    this.recordPlatformEvent({
      eventType: 'signup_created' as any,
      eventName: 'signup_created',
      category: 'account',
      userId: newUser.id,
    });
    this.recordPlatformEvent({
      eventType: 'email_verification_requested' as any,
      eventName: 'email_verification_requested',
      category: 'account',
      userId: newUser.id,
    });

    const sessionUser: AuthSessionUser = {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      status: 'PENDING_EMAIL_VERIFICATION',
      createdAt: newUser.createdAt,
    };

    const profile: UserProfile = {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      status: 'PENDING_EMAIL_VERIFICATION',
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    // Unverified user is NOT logged in yet; no active session cookie is written
    return { user: sessionUser, profile };
  },

  verifyEmailOtp(email: string, code: string): { user: AuthSessionUser; profile: UserProfile } {
    const cleanEmail = email.trim().toLowerCase();
    const users = getUsersList();
    const found = users.find((u) => u.email === cleanEmail);
    if (!found) {
      throw new Error('No pending registration found for this email address.');
    }

    const cleanCode = code ? code.trim() : '';
    if (!cleanCode || cleanCode.length !== 6) {
      throw new Error('Please enter a valid 6-digit verification code.');
    }

    const now = new Date().toISOString();
    found.status = 'ACTIVE';
    found.emailVerified = true;
    found.emailConfirmedAt = now;
    found.updatedAt = now;
    found.lastSignInAt = now;

    const userIdx = users.findIndex((u) => u.id === found.id);
    if (userIdx !== -1) {
      users[userIdx] = found;
      setStored(STORAGE_KEYS.USERS, users);
    }

    // Record verified and activated user analytics
    this.recordPlatformEvent({
      eventType: 'email_verification_completed' as any,
      eventName: 'email_verification_completed',
      category: 'account',
      userId: found.id,
      success: true,
    });
    this.recordPlatformEvent({
      eventType: 'user_activated' as any,
      eventName: 'user_activated',
      category: 'account',
      userId: found.id,
      success: true,
    });

    const sessionUser: AuthSessionUser = {
      id: found.id,
      email: found.email,
      fullName: found.fullName,
      role: found.role,
      status: 'ACTIVE',
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
      role: found.role,
      status: 'ACTIVE',
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
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

    if (found.status === 'PENDING_EMAIL_VERIFICATION' || found.status === 'PENDING' || found.emailVerified === false) {
      throw new Error("Please verify your email address to activate your account. Check your inbox for the verification code.");
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
    const email = (params?.email || 'student.google@saarvi.in').trim().toLowerCase();
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
    const allUsers = getStored<StoredUser[]>(STORAGE_KEYS.USERS, []);
    const targetUser = allUsers.find((u) => u.id === userId);
    if (targetUser && targetUser.role === 'SUPER_ADMIN' && targetUser.status === 'ACTIVE') {
      const otherActiveSuperAdmins = allUsers.filter(
        (u) => u.id !== userId && u.role === 'SUPER_ADMIN' && u.status === 'ACTIVE'
      );
      if (otherActiveSuperAdmins.length === 0) {
        throw new Error('At least one active SuperAdmin is required.');
      }
    }

    // 1. Delete user from users table
    const users = allUsers.filter((u) => u.id !== userId);
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

    if (users[idx].role === 'SUPER_ADMIN' && users[idx].status === 'ACTIVE' && status !== 'ACTIVE') {
      const otherActiveSuperAdmins = users.filter(
        (u) => u.id !== userId && u.role === 'SUPER_ADMIN' && u.status === 'ACTIVE'
      );
      if (otherActiveSuperAdmins.length === 0) {
        throw new Error('At least one active SuperAdmin is required.');
      }
    }

    users[idx].status = status;
    users[idx].updatedAt = new Date().toISOString();
    setStored(STORAGE_KEYS.USERS, users);
  },

  updateUserRole(userId: string, role: UserRole): void {
    const users = getUsersList();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found.');

    if (users[idx].role === 'SUPER_ADMIN' && users[idx].status === 'ACTIVE' && role !== 'SUPER_ADMIN') {
      const otherActiveSuperAdmins = users.filter(
        (u) => u.id !== userId && u.role === 'SUPER_ADMIN' && u.status === 'ACTIVE'
      );
      if (otherActiveSuperAdmins.length === 0) {
        throw new Error('At least one active SuperAdmin is required.');
      }
    }

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
      supportEmail: 'saarvinotifications@gmail.com',
      contactEmail: 'saarvinotifications@gmail.com',
      defaultLanguage: 'en',
      defaultTimezone: 'Asia/Kolkata',
      maintenanceMode: false,
      maintenanceMessage: 'Saarvi is temporarily under maintenance. Please try again shortly.',
      registrationEnabled: true,
      guestAccessEnabled: true,
      defaultAutoDownload: true,
      publicToolAvailability: true,
      siteTitle: 'Saarvi — Study. Work. Grow.',
      siteDescription: 'High-performance browser-based PDF and image conversion tools with VTU CBCS/NEP academic calculators and resume builders.',
      canonicalBase: 'https://saarvi.app',
      ogTitle: 'Saarvi — Study. Work. Grow.',
      ogDescription: 'Fast client-side document utilities, SGPA/CGPA calculators, and career organizers.',
      robotsIndexable: true,
      keywords: ['saarvi', 'pdf tools', 'image converter', 'student tools', 'compress pdf', 'merge pdf', 'resume builder'],
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

    // Cross-tab and active window synchronization
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEYS.PLATFORM_SYNC_TRIGGER,
          JSON.stringify({ type: 'platform', timestamp: Date.now() })
        );
        window.dispatchEvent(new CustomEvent('saarvi_platform_settings_updated', { detail: updated }));
      } catch {}
    }

    try {
      const supabase = getAdminClientSafe();
      if (supabase) {
        supabase.from('platform_settings').upsert({
          id: 'default_config',
          app_name: updated.appName,
          tagline: updated.tagline,
          logo_url: updated.logoUrl,
          favicon_url: updated.faviconUrl,
          brand_accent: updated.brandAccent,
          support_email: updated.supportEmail,
          contact_email: updated.contactEmail,
          default_language: updated.defaultLanguage,
          default_timezone: updated.defaultTimezone,
          maintenance_mode: updated.maintenanceMode,
          maintenance_message: updated.maintenanceMessage,
          registration_enabled: updated.registrationEnabled,
          guest_access_enabled: updated.guestAccessEnabled,
          default_auto_download: updated.defaultAutoDownload,
          public_tool_availability: updated.publicToolAvailability,
          version: updated.version,
          updated_by: updatedBy,
          updated_at: updated.updatedAt,
        }).then(({ error }: any) => {
          if (error) console.warn('[Supabase platform_settings upsert error]:', error.message);
        }).catch(() => {});
      }
    } catch {}

    return updated;
  },

  // --- SEO Settings ---
  getSeoSettings(): SeoSettings {
    const currentPlatform = this.getPlatformSettings();
    const defaults: SeoSettings = {
      siteTitle: currentPlatform.siteTitle || 'Saarvi — Study. Work. Grow.',
      siteDescription: currentPlatform.siteDescription || 'High-performance browser-based PDF and image conversion tools with VTU CBCS/NEP academic calculators and resume builders.',
      canonicalBase: currentPlatform.canonicalBase || 'https://saarvi.app',
      ogTitle: currentPlatform.ogTitle || 'Saarvi — Study. Work. Grow.',
      ogDescription: currentPlatform.ogDescription || 'Fast client-side document utilities, SGPA/CGPA calculators, and career organizers.',
      robotsIndexable: currentPlatform.robotsIndexable !== undefined ? currentPlatform.robotsIndexable : true,
      keywords: currentPlatform.keywords || ['saarvi', 'pdf tools', 'image converter', 'student tools', 'compress pdf', 'merge pdf', 'resume builder'],
      twitterHandle: '@saarviapp',
      updatedBy: currentPlatform.updatedBy || 'system',
      updatedAt: currentPlatform.updatedAt || new Date().toISOString(),
    };
    return getStored<SeoSettings>(STORAGE_KEYS.SEO_SETTINGS, defaults);
  },

  updateSeoSettings(updates: Partial<SeoSettings>, updatedBy = 'admin'): SeoSettings {
    const current = this.getSeoSettings();
    const updated: SeoSettings = {
      ...current,
      ...updates,
      updatedBy,
      updatedAt: new Date().toISOString(),
    };
    setStored(STORAGE_KEYS.SEO_SETTINGS, updated);

    // Keep platform settings SEO fields in lock-step
    try {
      this.updatePlatformSettings(
        {
          siteTitle: updated.siteTitle,
          siteDescription: updated.siteDescription,
          canonicalBase: updated.canonicalBase,
          ogTitle: updated.ogTitle,
          ogDescription: updated.ogDescription,
          robotsIndexable: updated.robotsIndexable,
          keywords: updated.keywords,
        },
        updatedBy
      );
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEYS.PLATFORM_SYNC_TRIGGER,
          JSON.stringify({ type: 'seo', timestamp: Date.now() })
        );
        window.dispatchEvent(new CustomEvent('saarvi_seo_updated', { detail: updated }));
      } catch {}
    }

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

    try {
      const supabase = getAdminClientSafe();
      if (supabase) {
        supabase.from('tool_overrides').upsert({
          id: override.id,
          name: override.name,
          category: override.category || 'pdf',
          status: override.status,
          requires_auth: override.requiresAuth ?? false,
          requires_pro: override.requiresPro ?? false,
          max_size_mb: override.maxSizeMB ?? null,
          max_files: override.maxFiles ?? 20,
          max_pages: override.maxPages ?? 100,
          order_index: override.orderIndex ?? 0,
          hidden: override.hidden ?? false,
          description: override.description ?? null,
          updated_by: 'admin',
          updated_at: updated.updatedAt,
        }).then(({ error }: any) => {
          if (error) console.warn('[Supabase tool_overrides upsert error]:', error.message);
        }).catch(() => {});
      }
    } catch {}

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

    try {
      const supabase = getAdminClientSafe();
      if (supabase && updated.id.includes('-') && updated.id.length === 36) {
        supabase.from('curriculum_versions').upsert({
          id: updated.id,
          scheme: updated.scheme,
          branch: updated.branch,
          semester: updated.semester,
          version: updated.version,
          status: updated.status,
          source_url: updated.sourceUrl || 'manual',
          updated_at: updated.updatedAt,
        }).then(({ error }: any) => {
          if (error) console.warn('[Supabase curriculum_versions upsert error]:', error.message);
        }).catch(() => {});
      }
    } catch {}

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

    try {
      const supabase = getAdminClientSafe();
      if (supabase) {
        supabase.from('audit_logs').insert({
          admin_id: entry.adminUserId || 'system',
          action: entry.action,
          resource: `${entry.targetType}:${entry.targetId}`,
          details: entry.metadata || {},
          created_at: newLog.timestamp,
        }).then(({ error }: any) => {
          if (error) console.warn('[Supabase audit_logs insert error]:', error.message);
        }).catch(() => {});
      }
    } catch {}

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
    eventType?: PlatformEventType | string;
    eventName?: string;
    targetId?: string;
    toolKey?: string;
    userId?: string | null;
    userType?: 'authenticated' | 'guest';
    guestSessionId?: string | null;
    operationId?: string;
    success?: boolean;
    durationMs?: number;
    metadata?: Record<string, any>;
    category?: 'tool' | 'student' | 'account' | 'system' | string;
    timestamp?: string;
  }): PlatformEventRecord & Record<string, any> {
    const events = getStored<any[]>(STORAGE_KEYS.PLATFORM_EVENTS, []);
    const toolKey = event.toolKey || event.targetId || '';
    const opId = event.operationId || event.metadata?.operationId || null;

    // Strict Idempotency check: same operationId + toolKey must count only once!
    if (opId && toolKey) {
      const existing = events.find(
        (e) =>
          (e.operationId === opId || e.metadata?.operationId === opId) &&
          (e.toolKey === toolKey || e.targetId === toolKey)
      );
      if (existing) {
        return existing;
      }
    }

    const userType = event.userType || (event.userId ? 'authenticated' : 'guest');

    const record: any = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType: event.eventType || event.eventName || 'feature_used',
      eventName: event.eventName || event.eventType || 'feature_used',
      targetId: toolKey,
      toolKey,
      userId: event.userId || null,
      userType,
      guestSessionId: event.guestSessionId || null,
      operationId: opId,
      success: event.success !== false,
      durationMs: event.durationMs || 0,
      metadata: event.metadata || (opId ? { operationId: opId } : {}),
      category: event.category || 'tool',
      timestamp: event.timestamp || new Date().toISOString(),
      createdAt: event.timestamp || new Date().toISOString(),
    };
    events.unshift(record);
    if (events.length > 2000) {
      events.length = 2000;
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

  // =========================================================================
  // ROLE AUDIT LOGS (PART A)
  // =========================================================================
  getRoleAuditLogs(): RoleAuditLogRecord[] {
    return getStored<RoleAuditLogRecord[]>(STORAGE_KEYS.ROLE_AUDIT_LOGS, []);
  },

  addRoleAuditLog(record: Omit<RoleAuditLogRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): RoleAuditLogRecord {
    const logs = this.getRoleAuditLogs();
    const entry: RoleAuditLogRecord = {
      id: record.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actor_user_id: record.actor_user_id,
      target_user_id: record.target_user_id,
      old_role: record.old_role,
      new_role: record.new_role,
      action: record.action,
      reason: record.reason,
      timestamp: record.timestamp || new Date().toISOString(),
    };
    logs.unshift(entry);
    if (logs.length > 1000) logs.length = 1000;
    setStored(STORAGE_KEYS.ROLE_AUDIT_LOGS, logs);
    return entry;
  },

  // =========================================================================
  // NOTIFICATION CENTER 2.0 STORAGE METHODS
  // =========================================================================
  getNotifications(): NotificationRecord[] {
    return getStored<NotificationRecord[]>(STORAGE_KEYS.NOTIFICATIONS_V2, []);
  },

  getNotificationById(id: string): NotificationRecord | null {
    const all = this.getNotifications();
    return all.find((n) => n.id === id) || null;
  },

  saveNotification(notification: NotificationRecord): NotificationRecord {
    const all = this.getNotifications();
    const idx = all.findIndex((n) => n.id === notification.id);
    if (idx !== -1) {
      all[idx] = notification;
    } else {
      all.unshift(notification);
    }
    setStored(STORAGE_KEYS.NOTIFICATIONS_V2, all);
    return notification;
  },

  deleteNotification(id: string): boolean {
    const all = this.getNotifications();
    const filtered = all.filter((n) => n.id !== id);
    setStored(STORAGE_KEYS.NOTIFICATIONS_V2, filtered);

    // Also remove recipient jobs
    const recipients = this.getNotificationRecipients().filter((r) => r.notification_id !== id);
    setStored(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, recipients);
    return true;
  },

  getNotificationRecipients(notificationId?: string, userId?: string): NotificationRecipientRecord[] {
    let all = getStored<NotificationRecipientRecord[]>(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, []);
    if (notificationId) {
      all = all.filter((r) => r.notification_id === notificationId);
    }
    if (userId) {
      all = all.filter((r) => r.user_id === userId);
    }
    return all;
  },

  saveNotificationRecipient(recipient: NotificationRecipientRecord): NotificationRecipientRecord {
    const all = getStored<NotificationRecipientRecord[]>(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, []);
    const idx = all.findIndex((r) => r.id === recipient.id || r.idempotency_key === recipient.idempotency_key);
    if (idx !== -1) {
      all[idx] = recipient;
    } else {
      all.push(recipient);
    }
    setStored(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, all);
    return recipient;
  },

  saveNotificationRecipientsBatch(recipients: NotificationRecipientRecord[]): void {
    const all = getStored<NotificationRecipientRecord[]>(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, []);
    const keyMap = new Map<string, number>();
    all.forEach((r, idx) => keyMap.set(r.idempotency_key, idx));

    for (const r of recipients) {
      if (keyMap.has(r.idempotency_key)) {
        all[keyMap.get(r.idempotency_key)!] = r;
      } else {
        all.push(r);
        keyMap.set(r.idempotency_key, all.length - 1);
      }
    }
    setStored(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, all);
  },

  updateNotificationRecipient(id: string, updates: Partial<NotificationRecipientRecord>): NotificationRecipientRecord | null {
    const all = getStored<NotificationRecipientRecord[]>(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, []);
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    setStored(STORAGE_KEYS.NOTIFICATION_RECIPIENTS_V2, all);
    return all[idx];
  },

  getNotificationTemplates(): NotificationTemplateRecord[] {
    return getStored<NotificationTemplateRecord[]>(STORAGE_KEYS.NOTIFICATION_TEMPLATES_V2, []);
  },

  saveNotificationTemplate(template: NotificationTemplateRecord): NotificationTemplateRecord {
    const all = this.getNotificationTemplates();
    const idx = all.findIndex((t) => t.id === template.id || t.name === template.name);
    if (idx !== -1) {
      all[idx] = template;
    } else {
      all.push(template);
    }
    setStored(STORAGE_KEYS.NOTIFICATION_TEMPLATES_V2, all);
    return template;
  },

  getNotificationPreferences(userId: string): NotificationPreferenceRecord[] {
    const all = getStored<NotificationPreferenceRecord[]>(STORAGE_KEYS.NOTIFICATION_PREFERENCES_V2, []);
    return all.filter((p) => p.user_id === userId);
  },

  saveNotificationPreference(pref: NotificationPreferenceRecord): NotificationPreferenceRecord {
    const all = getStored<NotificationPreferenceRecord[]>(STORAGE_KEYS.NOTIFICATION_PREFERENCES_V2, []);
    const idx = all.findIndex((p) => p.user_id === pref.user_id && p.category === pref.category);
    if (idx !== -1) {
      all[idx] = pref;
    } else {
      all.push(pref);
    }
    setStored(STORAGE_KEYS.NOTIFICATION_PREFERENCES_V2, all);
    return pref;
  },

  getNotificationAuditLogs(): NotificationAuditLogRecord[] {
    return getStored<NotificationAuditLogRecord[]>(STORAGE_KEYS.NOTIFICATION_AUDIT_LOGS_V2, []);
  },

  addNotificationAuditLog(log: NotificationAuditLogRecord): NotificationAuditLogRecord {
    const all = this.getNotificationAuditLogs();
    all.unshift(log);
    if (all.length > 1000) all.length = 1000;
    setStored(STORAGE_KEYS.NOTIFICATION_AUDIT_LOGS_V2, all);
    return log;
  },

  getNotificationSystemSettings(): NotificationSystemSettings {
    const defaults: NotificationSystemSettings = {
      id: 'global',
      global_enabled: true,
      email_enabled: true,
      in_app_enabled: true,
      max_broadcast_size: 50000,
      require_superadmin_approval: true,
      promotional_email_enabled: true,
      default_sender_name: 'Saarvi',
      rate_limit_per_hour: 5000,
      updated_at: new Date().toISOString(),
    };
    return getStored<NotificationSystemSettings>(STORAGE_KEYS.NOTIFICATION_SETTINGS_V2, defaults);
  },

  updateNotificationSystemSettings(updates: Partial<NotificationSystemSettings>, updatedBy?: string): NotificationSystemSettings {
    const current = this.getNotificationSystemSettings();
    const updated: NotificationSystemSettings = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || current.updated_by,
    };
    setStored(STORAGE_KEYS.NOTIFICATION_SETTINGS_V2, updated);
    return updated;
  },

  // =========================================================================
  // Phase 41: Tool Control Center & Beta Usage Persistence
  // =========================================================================

  getToolAccessConfigs(): Record<string, ToolControlConfig> {
    return getStored<Record<string, ToolControlConfig>>(STORAGE_KEYS.TOOL_ACCESS_CONFIGS, {});
  },

  saveToolAccessConfig(config: ToolControlConfig): ToolControlConfig {
    const configs = this.getToolAccessConfigs();
    configs[config.toolKey] = config;
    setStored(STORAGE_KEYS.TOOL_ACCESS_CONFIGS, configs);
    return config;
  },

  saveToolAccessAuditLog(log: ToolAccessAuditLog): ToolAccessAuditLog {
    const logs = getStored<ToolAccessAuditLog[]>(STORAGE_KEYS.TOOL_ACCESS_AUDIT_LOGS, []);
    logs.unshift(log);
    if (logs.length > 200) logs.length = 200;
    setStored(STORAGE_KEYS.TOOL_ACCESS_AUDIT_LOGS, logs);
    return log;
  },

  getToolAccessAuditLogs(toolKey?: string): ToolAccessAuditLog[] {
    const logs = getStored<ToolAccessAuditLog[]>(STORAGE_KEYS.TOOL_ACCESS_AUDIT_LOGS, []);
    if (!toolKey) return logs;
    return logs.filter((l) => l.toolKey === toolKey);
  },

  rollbackToolAccessConfig(toolKey: string, targetVersion: number, adminEmail: string): ToolControlConfig | null {
    const logs = this.getToolAccessAuditLogs(toolKey);
    const targetLog = logs.find((l) => l.version === targetVersion);
    if (!targetLog || !targetLog.newConfig) return null;

    const currentConfigs = this.getToolAccessConfigs();
    const current = currentConfigs[toolKey];
    const newVersion = (current?.version || 1) + 1;

    const restored: ToolControlConfig = {
      ...(targetLog.newConfig as ToolControlConfig),
      toolKey,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };

    currentConfigs[toolKey] = restored;
    setStored(STORAGE_KEYS.TOOL_ACCESS_CONFIGS, currentConfigs);

    const rollbackAudit: ToolAccessAuditLog = {
      id: `audit_rollback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      toolKey,
      toolName: restored.displayName,
      version: newVersion,
      changedBy: adminEmail,
      timestamp: restored.updatedAt,
      reason: `Rollback to version ${targetVersion}`,
      previousConfig: current || {},
      newConfig: restored,
    };
    this.saveToolAccessAuditLog(rollbackAudit);

    return restored;
  },

  getToolBetaUsage(userId: string, toolKey: string): StoredBetaUsage | null {
    const usages = getStored<StoredBetaUsage[]>(STORAGE_KEYS.TOOL_BETA_USAGES, []);
    return usages.find((u) => u.userId === userId && u.toolKey === toolKey) || null;
  },

  getAllToolBetaUsages(): StoredBetaUsage[] {
    return getStored<StoredBetaUsage[]>(STORAGE_KEYS.TOOL_BETA_USAGES, []);
  },

  atomicReserveBetaUse(
    userId: string,
    toolKey: string,
    freeLimit: number
  ): { allowed: boolean; usageCount: number; reservedCount: number; remainingUses: number } {
    const usages = getStored<StoredBetaUsage[]>(STORAGE_KEYS.TOOL_BETA_USAGES, []);
    let item = usages.find((u) => u.userId === userId && u.toolKey === toolKey);

    if (!item) {
      item = {
        userId,
        toolKey,
        usageCount: 0,
        reservedCount: 0,
        lastUsedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      usages.push(item);
    }

    if (item.usageCount + item.reservedCount < freeLimit) {
      item.reservedCount += 1;
      item.updatedAt = new Date().toISOString();
      setStored(STORAGE_KEYS.TOOL_BETA_USAGES, usages);
      const remainingUses = Math.max(0, freeLimit - (item.usageCount + item.reservedCount));
      return {
        allowed: true,
        usageCount: item.usageCount,
        reservedCount: item.reservedCount,
        remainingUses,
      };
    }

    return {
      allowed: false,
      usageCount: item.usageCount,
      reservedCount: item.reservedCount,
      remainingUses: 0,
    };
  },

  commitBetaUse(
    userId: string,
    toolKey: string,
    durationMs: number = 0,
    operationId?: string
  ): { success: boolean; usageCount: number; remainingUses: number } {
    // Idempotency check: duplicate completion protection (PART 7.3)
    if (operationId) {
      const seenOps = getStored<string[]>('saarvi_seen_operations_v1', []);
      if (seenOps.includes(operationId)) {
        const usages = getStored<StoredBetaUsage[]>(STORAGE_KEYS.TOOL_BETA_USAGES, []);
        const existing = usages.find((u) => u.userId === userId && u.toolKey === toolKey);
        const usageCount = existing ? existing.usageCount : 0;
        return { success: true, usageCount, remainingUses: Math.max(0, 10 - usageCount) };
      }
      seenOps.push(operationId);
      if (seenOps.length > 1000) seenOps.shift();
      setStored('saarvi_seen_operations_v1', seenOps);
    }

    const usages = getStored<StoredBetaUsage[]>(STORAGE_KEYS.TOOL_BETA_USAGES, []);
    let item = usages.find((u) => u.userId === userId && u.toolKey === toolKey);

    if (!item) {
      item = {
        userId,
        toolKey,
        usageCount: 1,
        reservedCount: 0,
        lastUsedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      usages.push(item);
    } else {
      item.usageCount += 1;
      item.reservedCount = Math.max(0, item.reservedCount - 1);
      item.lastUsedAt = new Date().toISOString();
      item.updatedAt = new Date().toISOString();
    }

    setStored(STORAGE_KEYS.TOOL_BETA_USAGES, usages);

    // Record authoritative successful tool completion telemetry (PART 2.5 & 3.2)
    this.recordPlatformEvent({
      eventType: 'tool_completed' as any,
      eventName: 'tool_completed',
      toolKey,
      userId,
      success: true,
      durationMs,
      category: 'tool',
      metadata: operationId ? { operationId } : {},
    });

    return { success: true, usageCount: item.usageCount, remainingUses: Math.max(0, 10 - item.usageCount) };
  },

  releaseBetaUse(
    userId: string,
    toolKey: string,
    error?: string,
    operationId?: string
  ): { success: boolean; usageCount: number; remainingUses: number } {
    const usages = getStored<StoredBetaUsage[]>(STORAGE_KEYS.TOOL_BETA_USAGES, []);
    const item = usages.find((u) => u.userId === userId && u.toolKey === toolKey);

    if (item) {
      item.reservedCount = Math.max(0, item.reservedCount - 1);
      item.updatedAt = new Date().toISOString();
      setStored(STORAGE_KEYS.TOOL_BETA_USAGES, usages);
    }

    // Record failed platform event for health telemetry (PART 3.4)
    this.recordPlatformEvent({
      eventType: 'tool_error' as any,
      eventName: 'tool_error',
      toolKey,
      userId,
      success: false,
      metadata: error ? { error, operationId } : (operationId ? { operationId } : {}),
      category: 'tool',
    });

    const usageCount = item ? item.usageCount : 0;
    return { success: true, usageCount, remainingUses: Math.max(0, 10 - usageCount) };
  },

  getUserToolUsageSummary(userId: string): UserToolUsageSummary {
    const events = (this.getPlatformEvents() as any[]).filter(
      (e) => (e.userId === userId || e.user_id === userId) && (e.toolKey || e.tool_key || e.targetId)
    );

    const toolMap = new Map<string, { uses: number; succ: number; fail: number; lastUsed: string }>();

    for (const ev of events) {
      const k = ev.toolKey || ev.tool_key || ev.targetId;
      if (!k) continue;
      const current = toolMap.get(k) || { uses: 0, succ: 0, fail: 0, lastUsed: ev.timestamp || ev.created_at };
      current.uses += 1;
      if (ev.success !== false) current.succ += 1;
      else current.fail += 1;
      if (new Date(ev.timestamp || ev.created_at) > new Date(current.lastUsed)) {
        current.lastUsed = ev.timestamp || ev.created_at;
      }
      toolMap.set(k, current);
    }

    const tools: Array<{
      toolKey: string;
      toolName: string;
      category: string;
      totalUses: number;
      successfulUses: number;
      failedUses: number;
      lastUsedAt?: string | null;
    }> = [];

    let totalOperations = 0;
    let totalSuccess = 0;
    let mostUsedTool = 'None';
    let maxUses = 0;
    let lastUsedTool = 'None';
    let latestTime = 0;

    for (const [toolKey, stats] of toolMap.entries()) {
      totalOperations += stats.uses;
      totalSuccess += stats.succ;
      if (stats.uses > maxUses) {
        maxUses = stats.uses;
        mostUsedTool = toolKey;
      }
      const timeMs = new Date(stats.lastUsed).getTime();
      if (timeMs > latestTime) {
        latestTime = timeMs;
        lastUsedTool = toolKey;
      }
      tools.push({
        toolKey,
        toolName: toolKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        category: 'tool',
        totalUses: stats.uses,
        successfulUses: stats.succ,
        failedUses: stats.fail,
        lastUsedAt: stats.lastUsed,
      });
    }

    tools.sort((a, b) => b.totalUses - a.totalUses);

    const successRate = totalOperations > 0 ? Math.round((totalSuccess / totalOperations) * 1000) / 10 : 100.0;

    return {
      userId,
      totalOperations,
      uniqueTools: toolMap.size,
      mostUsedTool,
      lastUsedTool,
      lastActivity: latestTime > 0 ? new Date(latestTime).toISOString() : null,
      successRate,
      tools,
    };
  },

  // =========================================================================
  // RAZORPAY PAYMENT ORDERS (PART 7 & 8)
  // =========================================================================

  savePaymentOrder(order: RazorpayPaymentOrder): RazorpayPaymentOrder {
    const all = getStored<RazorpayPaymentOrder[]>(STORAGE_KEYS.PAYMENT_ORDERS, []);
    const idx = all.findIndex((o) => o.id === order.id || o.providerOrderId === order.providerOrderId);
    const updated: RazorpayPaymentOrder = {
      ...order,
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
      if (all.length > 500) all.length = 500;
    }
    setStored(STORAGE_KEYS.PAYMENT_ORDERS, all);
    return updated;
  },

  getPaymentOrder(orderId: string): RazorpayPaymentOrder | null {
    if (!orderId) return null;
    const all = getStored<RazorpayPaymentOrder[]>(STORAGE_KEYS.PAYMENT_ORDERS, []);
    return all.find((o) => o.id === orderId || o.providerOrderId === orderId) || null;
  },

  getUserPaymentOrders(userId: string): RazorpayPaymentOrder[] {
    if (!userId) return [];
    const all = getStored<RazorpayPaymentOrder[]>(STORAGE_KEYS.PAYMENT_ORDERS, []);
    return all.filter((o) => o.userId === userId);
  },

  getAllPaymentOrders(): RazorpayPaymentOrder[] {
    return getStored<RazorpayPaymentOrder[]>(STORAGE_KEYS.PAYMENT_ORDERS, []);
  },

  updatePaymentOrderStatus(
    orderId: string,
    status: RazorpayPaymentOrderStatus,
    paymentId?: string,
    error?: string
  ): RazorpayPaymentOrder | null {
    const all = getStored<RazorpayPaymentOrder[]>(STORAGE_KEYS.PAYMENT_ORDERS, []);
    const idx = all.findIndex((o) => o.id === orderId || o.providerOrderId === orderId);
    if (idx === -1) return null;

    const existing = all[idx];
    const updated: RazorpayPaymentOrder = {
      ...existing,
      status,
      providerPaymentId: paymentId || existing.providerPaymentId,
      errorMessage: error || existing.errorMessage,
      paidAt: status === 'paid' ? (existing.paidAt || new Date().toISOString()) : existing.paidAt,
      updatedAt: new Date().toISOString(),
    };

    all[idx] = updated;
    setStored(STORAGE_KEYS.PAYMENT_ORDERS, all);
    return updated;
  },

  // =========================================================================
  // FEEDBACK SYSTEM (PART 5)
  // =========================================================================

  getFeedbackList(): StoredFeedback[] {
    return getStored<StoredFeedback[]>(STORAGE_KEYS.FEEDBACK, []);
  },

  addFeedback(item: Omit<StoredFeedback, 'id' | 'createdAt' | 'updatedAt' | 'status'>): StoredFeedback {
    const all = this.getFeedbackList();
    const newFeedback: StoredFeedback = {
      ...item,
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'NEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.unshift(newFeedback);
    if (all.length > 1000) all.length = 1000;
    setStored(STORAGE_KEYS.FEEDBACK, all);
    return newFeedback;
  },

  updateFeedbackStatus(
    id: string,
    status: StoredFeedback['status'],
    adminNotes?: string
  ): StoredFeedback | null {
    const all = this.getFeedbackList();
    const idx = all.findIndex((f) => f.id === id);
    if (idx === -1) return null;

    all[idx] = {
      ...all[idx],
      status,
      adminNotes: adminNotes !== undefined ? adminNotes : all[idx].adminNotes,
      updatedAt: new Date().toISOString(),
    };
    setStored(STORAGE_KEYS.FEEDBACK, all);
    return all[idx];
  },

  getFeedbackAnalytics() {
    const list = this.getFeedbackList();
    const total = list.length;
    const avgRating = total > 0 ? Math.round((list.reduce((acc, f) => acc + f.rating, 0) / total) * 10) / 10 : 0;
    const openCount = list.filter((f) => f.status === 'NEW' || f.status === 'IN_REVIEW').length;
    const resolvedCount = list.filter((f) => f.status === 'RESOLVED').length;

    const byCategory: Record<string, number> = {};
    const byTool: Record<string, { count: number; avgRating: number; bugCount: number; featureCount: number; ratingsSum: number }> = {};

    for (const f of list) {
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      if (f.toolKey) {
        if (!byTool[f.toolKey]) {
          byTool[f.toolKey] = { count: 0, avgRating: 0, bugCount: 0, featureCount: 0, ratingsSum: 0 };
        }
        const t = byTool[f.toolKey];
        t.count++;
        t.ratingsSum += f.rating;
        t.avgRating = Math.round((t.ratingsSum / t.count) * 10) / 10;
        if (f.category === 'Bug' || f.category === 'Tool Issue') t.bugCount++;
        if (f.category === 'Feature Request') t.featureCount++;
      }
    }

    return {
      total,
      avgRating,
      openCount,
      resolvedCount,
      byCategory,
      byTool,
    };
  },

  // =========================================================================
  // Phase 44: Authoritative Academic Subjects & Conflict Management
  // =========================================================================

  getAcademicSubjects(filters?: {
    universityId?: string;
    schemeId?: string;
    branchId?: string;
    semester?: number;
    search?: string;
    status?: string;
  }): StoredAcademicSubject[] {
    let list = getStored<StoredAcademicSubject[]>(STORAGE_KEYS.ACADEMIC_SUBJECTS, []);

    if (filters?.universityId) list = list.filter((s) => s.universityId === filters.universityId);
    if (filters?.schemeId) list = list.filter((s) => s.schemeId === filters.schemeId);
    if (filters?.branchId) list = list.filter((s) => s.branchId === filters.branchId);
    if (filters?.semester !== undefined) list = list.filter((s) => s.semester === filters.semester);
    if (filters?.status) list = list.filter((s) => s.verificationStatus === filters.status);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (s) => s.subjectCode.toLowerCase().includes(q) || s.subjectName.toLowerCase().includes(q)
      );
    }

    return list;
  },

  saveAcademicSubject(subject: StoredAcademicSubject): StoredAcademicSubject {
    const list = getStored<StoredAcademicSubject[]>(STORAGE_KEYS.ACADEMIC_SUBJECTS, []);
    const idx = list.findIndex(
      (s) =>
        s.id === subject.id ||
        (s.universityId === subject.universityId &&
          s.schemeId === subject.schemeId &&
          s.branchId === subject.branchId &&
          s.semester === subject.semester &&
          s.subjectCode.toUpperCase() === subject.subjectCode.toUpperCase())
    );

    const now = new Date().toISOString();
    const updated: StoredAcademicSubject = {
      ...subject,
      updatedAt: now,
    };

    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }

    setStored(STORAGE_KEYS.ACADEMIC_SUBJECTS, list);
    return updated;
  },

  getAcademicSubjectConflicts(filters?: { status?: string }): StoredAcademicConflict[] {
    let list = getStored<StoredAcademicConflict[]>(STORAGE_KEYS.ACADEMIC_CONFLICTS, []);
    if (filters?.status) {
      list = list.filter((c) => c.resolutionStatus === filters.status);
    }
    return list;
  },

  saveAcademicSubjectConflict(conflict: StoredAcademicConflict): StoredAcademicConflict {
    const list = getStored<StoredAcademicConflict[]>(STORAGE_KEYS.ACADEMIC_CONFLICTS, []);
    const idx = list.findIndex(
      (c) =>
        c.id === conflict.id ||
        (c.universityId === conflict.universityId &&
          c.schemeId === conflict.schemeId &&
          c.branchId === conflict.branchId &&
          c.semester === conflict.semester &&
          c.subjectCode.toUpperCase() === conflict.subjectCode.toUpperCase() &&
          c.resolutionStatus === 'PENDING')
    );

    if (idx >= 0) {
      list[idx] = { ...conflict, updatedAt: new Date().toISOString() };
    } else {
      list.push(conflict);
    }

    setStored(STORAGE_KEYS.ACADEMIC_CONFLICTS, list);
    return conflict;
  },

  resolveAcademicSubjectConflict(
    conflictId: string,
    resolution: 'RESOLVED' | 'REJECTED',
    resolvedBy: string,
    notes?: string
  ): boolean {
    const list = getStored<StoredAcademicConflict[]>(STORAGE_KEYS.ACADEMIC_CONFLICTS, []);
    const item = list.find((c) => c.id === conflictId);
    if (!item) return false;

    item.resolutionStatus = resolution;
    item.resolvedBy = resolvedBy;
    item.resolvedAt = new Date().toISOString();
    if (notes) item.adminNotes = notes;
    item.updatedAt = new Date().toISOString();

    setStored(STORAGE_KEYS.ACADEMIC_CONFLICTS, list);
    return true;
  },

  recordAcademicAuditLog(entry: {
    action: string;
    subjectCode: string;
    actor: string;
    details: any;
  }): void {
    const logs = getStored<any[]>(STORAGE_KEYS.ACADEMIC_AUDIT_LOGS, []);
    logs.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    if (logs.length > 500) logs.length = 500;
    setStored(STORAGE_KEYS.ACADEMIC_AUDIT_LOGS, logs);
  },

  getAcademicAuditLogs(): any[] {
    return getStored<any[]>(STORAGE_KEYS.ACADEMIC_AUDIT_LOGS, []);
  },

  // =========================================================================
  // Phase 45: Canonical Jobs & Internships Platform Persistence
  // =========================================================================

  saveJob(userId: string, jobId: string): { success: boolean; isSaved: boolean } {
    if (!userId || !jobId) return { success: false, isSaved: false };
    const saved = getStored<Array<{ id: string; userId: string; jobId: string; createdAt: string }>>(
      STORAGE_KEYS.SAVED_JOBS,
      []
    );
    const existingIdx = saved.findIndex((s) => s.userId === userId && s.jobId === jobId);

    if (existingIdx >= 0) {
      // Already saved
      return { success: true, isSaved: true };
    }

    saved.unshift({
      id: `saved_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      jobId,
      createdAt: new Date().toISOString(),
    });

    setStored(STORAGE_KEYS.SAVED_JOBS, saved);
    return { success: true, isSaved: true };
  },

  unsaveJob(userId: string, jobId: string): { success: boolean; isSaved: boolean } {
    if (!userId || !jobId) return { success: false, isSaved: false };
    const saved = getStored<Array<{ id: string; userId: string; jobId: string; createdAt: string }>>(
      STORAGE_KEYS.SAVED_JOBS,
      []
    );
    const filtered = saved.filter((s) => !(s.userId === userId && s.jobId === jobId));
    setStored(STORAGE_KEYS.SAVED_JOBS, filtered);
    return { success: true, isSaved: false };
  },

  isJobSaved(userId: string, jobId: string): boolean {
    if (!userId || !jobId) return false;
    const saved = getStored<Array<{ id: string; userId: string; jobId: string; createdAt: string }>>(
      STORAGE_KEYS.SAVED_JOBS,
      []
    );
    return saved.some((s) => s.userId === userId && s.jobId === jobId);
  },

  getSavedJobs(userId: string): Array<{ id: string; userId: string; jobId: string; createdAt: string }> {
    if (!userId) return [];
    const saved = getStored<Array<{ id: string; userId: string; jobId: string; createdAt: string }>>(
      STORAGE_KEYS.SAVED_JOBS,
      []
    );
    return saved.filter((s) => s.userId === userId);
  },

  createOrUpdateJobApplication(
    userId: string,
    data: {
      jobId: string;
      jobTitle: string;
      companyName: string;
      status: 'SAVED' | 'APPLIED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';
      notes?: string;
    }
  ): any {
    if (!userId || !data.jobId) return null;
    const apps = getStored<any[]>(STORAGE_KEYS.JOB_APPLICATIONS, []);
    const existingIdx = apps.findIndex((a) => a.userId === userId && a.jobId === data.jobId);
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      apps[existingIdx] = {
        ...apps[existingIdx],
        ...data,
        updatedAt: now,
      };
      setStored(STORAGE_KEYS.JOB_APPLICATIONS, apps);
      return apps[existingIdx];
    }

    const newApp = {
      id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      ...data,
      appliedAt: now,
      updatedAt: now,
    };
    apps.unshift(newApp);
    setStored(STORAGE_KEYS.JOB_APPLICATIONS, apps);
    return newApp;
  },

  getJobApplications(userId: string): any[] {
    if (!userId) return [];
    const apps = getStored<any[]>(STORAGE_KEYS.JOB_APPLICATIONS, []);
    return apps.filter((a) => a.userId === userId);
  },

  reportJob(report: {
    jobId: string;
    jobTitle: string;
    companyName: string;
    reason: string;
    notes?: string;
    reporterId?: string;
  }): any {
    const reports = getStored<any[]>(STORAGE_KEYS.JOB_REPORTS, []);
    const newReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: 'PENDING',
      reportedAt: new Date().toISOString(),
      ...report,
    };
    reports.unshift(newReport);
    setStored(STORAGE_KEYS.JOB_REPORTS, reports);
    return newReport;
  },

  getJobReports(): any[] {
    return getStored<any[]>(STORAGE_KEYS.JOB_REPORTS, []);
  },
};

export const mockStorage = MockStorageProvider;

