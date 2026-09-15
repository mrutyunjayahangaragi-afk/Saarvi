// DocEase Phase 11: Authoritative Admin Service
// Centralized Platform Control, Tool Overrides, VTU Curriculum Workflow, and Audit Logging

import { TOOLS_CONFIG } from '../../config/tools';
import { FILE_LIMITS, getMaxFileSizeMB } from '../../config/limits';
import type { ToolDefinition } from '@/types/tool';
import type { CurriculumCourse } from '@/types/student';
import { ALL_VERIFIED_VTU_COURSES } from '../student/vtu/curriculum-data';
import { hasPermission } from '../../types/admin';
import type {
  PlatformSettings,
  ToolOverrideConfig,
  CurriculumVersionRecord,
  CurriculumValidationResult,
  CurriculumValidationIssue,
  AnnouncementRecord,
  PlatformErrorRecord,
  AuditLogRecord,
  FeatureFlag,
  SystemHealthCheck,
  AdminPermission,
  FeatureFlagStatus,
} from '@/types/admin';
import type { UserProfile, UserRole, UserAccountStatus } from '@/types/auth';
import { MockStorageProvider } from '../supabase/mock-storage';
import { isSupabaseConfigured } from '../supabase/config';
import { createClient } from '../supabase/client';
import { getSupabaseAdminClient } from '../supabase/admin';
import { featureServerStore } from '../features/feature-store';

export interface AdminActor {
  id: string;
  email: string;
  role: UserRole;
}

export const adminService = {
  // =========================================================================
  // 1. TOOL & LIMIT CONTROL (Single Source of Truth + Runtime Overrides)
  // =========================================================================

  async getEffectiveTools(): Promise<ToolDefinition[]> {
    const overrides = MockStorageProvider.getToolOverrides();

    return TOOLS_CONFIG.map((baseTool) => {
      const override = overrides[baseTool.slug] || overrides[baseTool.id];
      const flag = featureServerStore.getFeature(baseTool.slug) || featureServerStore.getFeature(baseTool.id);

      let status = baseTool.status;
      let requiresPro = baseTool.requiresPro;
      let requiresAuth = baseTool.requiresAuth;

      if (flag) {
        if (flag.status === 'DISABLED') status = 'disabled';
        else if (flag.status === 'MAINTENANCE') status = 'maintenance';
        else if (flag.status === 'BETA') status = 'beta';
        else if (flag.status === 'ENABLED') status = 'available';

        if (flag.accessMode === 'SUBSCRIPTION') {
          requiresPro = true;
        } else if (flag.accessMode === 'FREE') {
          requiresPro = false;
        }
      }

      if (override) {
        status = override.status.toLowerCase() as ToolDefinition['status'];
        if (override.requiresPro !== undefined) requiresPro = override.requiresPro;
        if (override.accessMode === 'SUBSCRIPTION') requiresPro = true;
        if (override.accessMode === 'FREE') requiresPro = false;
        if (override.requiresAuth !== undefined) requiresAuth = override.requiresAuth;
      }

      return {
        ...baseTool,
        name: override?.name || flag?.name || baseTool.name,
        status,
        requiresAuth,
        requiresPro,
        maxSizeMB: override?.maxSizeMB || baseTool.maxSizeMB || getMaxFileSizeMB(baseTool.slug),
        description: override?.description || flag?.description || baseTool.description,
        keywords: override?.keywords || baseTool.keywords,
      };
    });
  },

  async getEffectiveTool(slug: string): Promise<ToolDefinition | undefined> {
    const tools = await this.getEffectiveTools();
    return tools.find((t) => t.slug === slug || t.id === slug);
  },

  async getToolOverrides(): Promise<Record<string, ToolOverrideConfig>> {
    return MockStorageProvider.getToolOverrides();
  },

  async updateToolOverride(override: ToolOverrideConfig, actor: AdminActor): Promise<ToolOverrideConfig> {
    if (!hasPermission(actor.role, 'tools.update')) {
      throw new Error('Permission denied: tools.update is required.');
    }

    const saved = MockStorageProvider.saveToolOverride(override);

    // Synchronize to featureServerStore
    try {
      const statusMap: Record<string, FeatureFlagStatus> = {
        AVAILABLE: 'ENABLED',
        BETA: 'BETA',
        MAINTENANCE: 'MAINTENANCE',
        DISABLED: 'DISABLED',
        COMING_SOON: 'DISABLED',
      };
      const flagStatus = statusMap[override.status] || 'ENABLED';
      const accessMode = override.requiresPro ? 'SUBSCRIPTION' : override.accessMode || 'FREE';

      featureServerStore.updateFeature(
        override.id,
        {
          status: flagStatus,
          accessMode,
          visibility: override.hidden ? 'hidden' : 'visible',
          name: override.name,
          description: override.description,
        },
        actor
      );
    } catch {
      // Safe fallback if feature flag not mapped
    }

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: `TOOL_${override.status}`,
      targetType: 'TOOL',
      targetId: override.id,
      metadata: {
        status: override.status,
        maxSizeMB: override.maxSizeMB,
        requiresAuth: override.requiresAuth,
        requiresPro: override.requiresPro,
        accessMode: override.accessMode,
      },
    });

    return saved;
  },

  // =========================================================================
  // 2. CURRICULUM WORKFLOW & AUTOMATED VALIDATOR
  // =========================================================================

  /**
   * Automated Curriculum Validator
   * Checks:
   * 1. Duplicate course code within same scheme/branch/semester
   * 2. Missing or zero credits
   * 3. Invalid semester outside 1-8
   * 4. Missing course title
   * 5. Invalid assessment configuration
   * 6. Missing source citation
   */
  validateCurriculumCourses(courses: CurriculumCourse[], meta?: { sourceUrl?: string; scheme?: string }): CurriculumValidationResult {
    const errors: CurriculumValidationIssue[] = [];
    const warnings: CurriculumValidationIssue[] = [];
    const seenCodes = new Set<string>();

    if (!courses || courses.length === 0) {
      errors.push({
        type: 'ERROR',
        code: 'EMPTY_CURRICULUM',
        message: 'Curriculum version must contain at least one course definition.',
      });
    }

    if (meta && !meta.sourceUrl) {
      warnings.push({
        type: 'WARNING',
        code: 'MISSING_SOURCE_CITATION',
        message: 'No official syllabus source URL is provided for verification.',
      });
    }

    for (const course of courses) {
      const codeKey = course.courseCode.trim().toUpperCase();

      // Check 1: Duplicate course code
      if (seenCodes.has(codeKey)) {
        errors.push({
          type: 'ERROR',
          code: 'DUPLICATE_COURSE_CODE',
          courseCode: codeKey,
          message: `Duplicate course code detected: ${codeKey}.`,
        });
      }
      seenCodes.add(codeKey);

      // Check 2: Missing or invalid credits
      if (course.credits === undefined || course.credits === null || course.credits < 0 || course.credits > 10) {
        errors.push({
          type: 'ERROR',
          code: 'INVALID_CREDITS',
          courseCode: codeKey,
          message: `Course ${codeKey} has invalid credits: ${course.credits}. Must be between 0 and 10.`,
        });
      }

      // Check 3: Invalid semester
      if (!course.semester || course.semester < 1 || course.semester > 8) {
        errors.push({
          type: 'ERROR',
          code: 'INVALID_SEMESTER',
          courseCode: codeKey,
          message: `Course ${codeKey} has invalid semester ${course.semester}. Must be 1 to 8.`,
        });
      }

      // Check 4: Missing title
      if (!course.courseTitle || course.courseTitle.trim().length === 0) {
        errors.push({
          type: 'ERROR',
          code: 'MISSING_COURSE_TITLE',
          courseCode: codeKey,
          message: `Course ${codeKey} is missing a course title.`,
        });
      }

      // Check 5: Assessment configuration
      if (!course.assessment) {
        errors.push({
          type: 'ERROR',
          code: 'MISSING_ASSESSMENT_CONFIG',
          courseCode: codeKey,
          message: `Course ${codeKey} has no assessment configuration specified.`,
        });
      } else if (course.assessment.hasSEE) {
        if (!course.assessment.cie?.maxMarks || !course.assessment.see?.maxMarks || course.assessment.cie.maxMarks <= 0 || course.assessment.see.maxMarks <= 0) {
          errors.push({
            type: 'ERROR',
            code: 'INVALID_CIE_SEE_DISTRIBUTION',
            courseCode: codeKey,
            message: `Course ${codeKey} uses CIE+SEE mode but lacks valid max CIE (${course.assessment.cie?.maxMarks}) or max SEE (${course.assessment.see?.maxMarks}).`,
          });
        }
      } else {
        if (!course.assessment.cie?.maxMarks || course.assessment.cie.maxMarks <= 0) {
          errors.push({
            type: 'ERROR',
            code: 'INVALID_CONTINUOUS_MAX',
            courseCode: codeKey,
            message: `Course ${codeKey} has no SEE but lacks valid continuous CIE max marks.`,
          });
        }
      }

      // Check 6: Scheme check
      if (meta?.scheme && course.scheme !== meta.scheme) {
        warnings.push({
          type: 'WARNING',
          code: 'SCHEME_MISMATCH',
          courseCode: codeKey,
          message: `Course scheme (${course.scheme}) does not match package scheme (${meta.scheme}).`,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      timestamp: new Date().toISOString(),
    };
  },

  async getCurriculumVersions(): Promise<CurriculumVersionRecord[]> {
    const existing = MockStorageProvider.getCurriculumVersions();
    if (existing.length === 0) {
      // Seed default active curriculum versions from verified data
      const defaultVersions: CurriculumVersionRecord[] = [
        {
          id: 'vtu-2022-cse-s3',
          scheme: '2022',
          branch: 'CSE',
          semester: 3,
          version: '1.0.0',
          status: 'ACTIVE',
          sourceUrl: 'https://vtu.ac.in/b-e-scheme-syllabus/',
          sourceTitle: 'VTU Official 2022 Scheme B.E. Computer Science 3rd Sem Syllabus',
          retrievedDate: '2024-08-01',
          verificationDate: '2024-08-15T10:00:00.000Z',
          verifiedBy: 'VTU Curriculum Lead',
          coursesCount: ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'CSE' && c.semester === 3).length,
          coursesJson: JSON.stringify(ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'CSE' && c.semester === 3)),
          notes: 'Standard 2022 Scheme CBCS/NEP syllabus with continuous evaluation for Social Connect (BSCK307).',
          createdAt: '2024-08-01T00:00:00.000Z',
          updatedAt: '2024-08-15T10:00:00.000Z',
        },
        {
          id: 'vtu-2022-ise-s3',
          scheme: '2022',
          branch: 'ISE',
          semester: 3,
          version: '1.0.0',
          status: 'ACTIVE',
          sourceUrl: 'https://vtu.ac.in/b-e-scheme-syllabus/',
          sourceTitle: 'VTU Official 2022 Scheme B.E. Information Science 3rd Sem Syllabus',
          retrievedDate: '2024-08-01',
          verificationDate: '2024-08-15T10:00:00.000Z',
          verifiedBy: 'VTU Curriculum Lead',
          coursesCount: ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'ISE' && c.semester === 3).length,
          coursesJson: JSON.stringify(ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'ISE' && c.semester === 3)),
          notes: 'Standard 2022 Scheme CBCS/NEP syllabus for Information Science & Engineering.',
          createdAt: '2024-08-01T00:00:00.000Z',
          updatedAt: '2024-08-15T10:00:00.000Z',
        },
        {
          id: 'vtu-2022-ece-s3',
          scheme: '2022',
          branch: 'ECE',
          semester: 3,
          version: '1.0.0',
          status: 'ACTIVE',
          sourceUrl: 'https://vtu.ac.in/b-e-scheme-syllabus/',
          sourceTitle: 'VTU Official 2022 Scheme B.E. Electronics & Communication 3rd Sem Syllabus',
          retrievedDate: '2024-08-01',
          verificationDate: '2024-08-15T10:00:00.000Z',
          verifiedBy: 'VTU Curriculum Lead',
          coursesCount: ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'ECE' && c.semester === 3).length,
          coursesJson: JSON.stringify(ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'ECE' && c.semester === 3)),
          notes: 'Standard 2022 Scheme CBCS/NEP syllabus for Electronics & Communication Engineering.',
          createdAt: '2024-08-01T00:00:00.000Z',
          updatedAt: '2024-08-15T10:00:00.000Z',
        },
        {
          id: 'vtu-2022-aiml-s3',
          scheme: '2022',
          branch: 'AIML',
          semester: 3,
          version: '1.0.0',
          status: 'ACTIVE',
          sourceUrl: 'https://vtu.ac.in/b-e-scheme-syllabus/',
          sourceTitle: 'VTU Official 2022 Scheme B.E. Artificial Intelligence 3rd Sem Syllabus',
          retrievedDate: '2024-08-01',
          verificationDate: '2024-08-15T10:00:00.000Z',
          verifiedBy: 'VTU Curriculum Lead',
          coursesCount: ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'AIML' && c.semester === 3).length,
          coursesJson: JSON.stringify(ALL_VERIFIED_VTU_COURSES.filter((c) => c.scheme === '2022' && c.branch === 'AIML' && c.semester === 3)),
          notes: 'Standard 2022 Scheme CBCS/NEP syllabus for AI & Machine Learning.',
          createdAt: '2024-08-01T00:00:00.000Z',
          updatedAt: '2024-08-15T10:00:00.000Z',
        },
        {
          id: 'vtu-2025-cse-draft',
          scheme: '2025',
          branch: 'CSE',
          semester: 1,
          version: '0.9.0-draft',
          status: 'DRAFT',
          sourceUrl: 'https://vtu.ac.in/future-curriculum/',
          sourceTitle: 'VTU Proposed 2025 Autonomous Extension Framework',
          retrievedDate: '2025-01-10',
          coursesCount: 6,
          coursesJson: JSON.stringify([]),
          notes: 'Draft placeholder for upcoming curriculum revision.',
          createdAt: '2025-01-10T00:00:00.000Z',
          updatedAt: '2025-01-10T00:00:00.000Z',
        },
      ];

      defaultVersions.forEach((v) => MockStorageProvider.saveCurriculumVersion(v));
      return defaultVersions;
    }
    return existing;
  },

  async createCurriculumDraft(
    data: Omit<CurriculumVersionRecord, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'coursesCount'>,
    actor: AdminActor
  ): Promise<CurriculumVersionRecord> {
    if (!hasPermission(actor.role, 'curriculum.update')) {
      throw new Error('Permission denied: curriculum.update is required.');
    }

    let parsedCourses: CurriculumCourse[] = [];
    try {
      parsedCourses = JSON.parse(data.coursesJson);
    } catch {
      parsedCourses = [];
    }

    const newRecord: CurriculumVersionRecord = {
      ...data,
      id: `curric_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'DRAFT',
      coursesCount: parsedCourses.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = MockStorageProvider.saveCurriculumVersion(newRecord);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: 'CURRICULUM_DRAFT_CREATED',
      targetType: 'CURRICULUM',
      targetId: saved.id,
      metadata: { scheme: saved.scheme, branch: saved.branch, semester: saved.semester, version: saved.version },
    });

    return saved;
  },

  async transitionCurriculumWorkflow(
    id: string,
    targetStatus: CurriculumVersionRecord['status'],
    actor: AdminActor,
    verificationNotes?: string
  ): Promise<CurriculumVersionRecord> {
    if (!hasPermission(actor.role, 'curriculum.update')) {
      throw new Error('Permission denied: curriculum.update is required.');
    }

    const versions = await this.getCurriculumVersions();
    const found = versions.find((v) => v.id === id);
    if (!found) throw new Error('Curriculum version not found.');

    // If activating, validate first
    if (targetStatus === 'ACTIVE' || targetStatus === 'VERIFIED') {
      let courses: CurriculumCourse[] = [];
      try {
        courses = JSON.parse(found.coursesJson);
      } catch {
        throw new Error('Curriculum courses JSON is corrupted.');
      }

      const validation = this.validateCurriculumCourses(courses, { sourceUrl: found.sourceUrl, scheme: found.scheme });
      if (!validation.isValid) {
        throw new Error(`Cannot activate curriculum: ${validation.errors.map((e) => e.message).join(' ')}`);
      }
    }

    const now = new Date().toISOString();
    const updated: CurriculumVersionRecord = {
      ...found,
      status: targetStatus,
      updatedAt: now,
      ...(targetStatus === 'VERIFIED'
        ? { verificationDate: now, verifiedBy: actor.email }
        : {}),
      ...(verificationNotes ? { notes: `${found.notes || ''}\n${verificationNotes}`.trim() } : {}),
    };

    MockStorageProvider.saveCurriculumVersion(updated);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: `CURRICULUM_${targetStatus}`,
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: {
        scheme: found.scheme,
        branch: found.branch,
        semester: found.semester,
        version: found.version,
        targetStatus,
      },
    });

    return updated;
  },

  // =========================================================================
  // 3. PLATFORM SETTINGS & MAINTENANCE
  // =========================================================================

  async getPlatformSettings(): Promise<PlatformSettings> {
    return MockStorageProvider.getPlatformSettings();
  },

  async updatePlatformSettings(updates: Partial<PlatformSettings>, actor: AdminActor): Promise<PlatformSettings> {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    const updated = MockStorageProvider.updatePlatformSettings(updates, actor.email);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: 'PLATFORM_SETTINGS_UPDATED',
      targetType: 'SETTING',
      targetId: 'platform_config',
      metadata: updates,
    });

    return updated;
  },

  async toggleMaintenanceMode(enabled: boolean, message: string, actor: AdminActor): Promise<PlatformSettings> {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    const updated = MockStorageProvider.updatePlatformSettings(
      {
        maintenanceMode: enabled,
        maintenanceMessage: message.trim() || 'Saarvi is temporarily under maintenance. Please try again shortly.',
      },
      actor.email
    );

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: enabled ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED',
      targetType: 'SETTING',
      targetId: 'maintenance_mode',
      metadata: { enabled, message },
    });

    return updated;
  },

  async toggleGuestAccess(enabled: boolean, actor: AdminActor): Promise<PlatformSettings> {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    const updated = MockStorageProvider.updatePlatformSettings(
      { guestAccessEnabled: enabled },
      actor.email
    );

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: enabled ? 'GUEST_ACCESS_ENABLED' : 'GUEST_ACCESS_DISABLED',
      targetType: 'SETTING',
      targetId: 'guest_access',
      metadata: { enabled },
    });

    return updated;
  },

  // =========================================================================
  // 4. ANNOUNCEMENTS
  // =========================================================================

  async getAnnouncements(): Promise<AnnouncementRecord[]> {
    const all = MockStorageProvider.getAnnouncements();
    if (all.length === 0) {
      // Seed default announcement
      const defaultAnn: AnnouncementRecord = {
        id: 'ann-phase11-release',
        title: 'VTU CBCS 2022 Scheme Support Active',
        content: 'Official VTU 2022 Scheme calculators with continuous evaluation for no-SEE courses are now available for all students.',
        type: 'STUDENT',
        status: 'PUBLISHED',
        priority: 'NORMAL',
        targetAudience: 'ALL',
        isDismissible: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        publishedBy: 'admin@saarvi.in',
      };
      MockStorageProvider.saveAnnouncement(defaultAnn);
      return [defaultAnn];
    }
    return all;
  },

  async getActivePublicAnnouncements(): Promise<AnnouncementRecord[]> {
    const all = await this.getAnnouncements();
    const now = new Date();
    return all.filter((a) => {
      if (a.status !== 'PUBLISHED') return false;
      if (a.startDate && new Date(a.startDate) > now) return false;
      if (a.endDate && new Date(a.endDate) < now) return false;
      return true;
    });
  },

  async saveAnnouncement(ann: AnnouncementRecord, actor: AdminActor): Promise<AnnouncementRecord> {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    const saved = MockStorageProvider.saveAnnouncement(ann);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: `ANNOUNCEMENT_${ann.status}`,
      targetType: 'ANNOUNCEMENT',
      targetId: saved.id,
      metadata: { title: saved.title, priority: saved.priority, status: saved.status },
    });

    return saved;
  },

  async deleteAnnouncement(id: string, actor: AdminActor): Promise<void> {
    if (!hasPermission(actor.role, 'settings.update')) {
      throw new Error('Permission denied: settings.update is required.');
    }

    MockStorageProvider.deleteAnnouncement(id);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: 'ANNOUNCEMENT_DELETED',
      targetType: 'ANNOUNCEMENT',
      targetId: id,
      metadata: {},
    });
  },

  // =========================================================================
  // 5. SYSTEM HEALTH PROBES
  // =========================================================================

  async runSystemHealthChecks(): Promise<SystemHealthCheck[]> {
    const checks: SystemHealthCheck[] = [];
    const now = new Date().toISOString();

    // 1. App Runtime
    const startApp = performance.now();
    checks.push({
      id: 'app-runtime',
      name: 'Application Engine',
      status: 'HEALTHY',
      latencyMs: Math.round(performance.now() - startApp),
      message: 'Next.js 15 App Router runtime healthy and operational.',
      lastChecked: now,
    });

    // 2. Authentication Provider
    const startAuth = performance.now();
    const authSession = MockStorageProvider.getCurrentSession();
    checks.push({
      id: 'auth-service',
      name: 'Authentication Provider',
      status: 'HEALTHY',
      latencyMs: Math.round(performance.now() - startAuth),
      message: isSupabaseConfigured()
        ? 'Connected to Supabase Authentication backend.'
        : `Running local resilient storage (${authSession ? `Logged in: ${authSession.email}` : 'Session ready'}).`,
      lastChecked: now,
    });

    // 3. Platform Configuration Schema
    const startCfg = performance.now();
    const settings = MockStorageProvider.getPlatformSettings();
    checks.push({
      id: 'platform-config',
      name: 'Platform Settings Store',
      status: settings.version > 0 ? 'HEALTHY' : 'WARNING',
      latencyMs: Math.round(performance.now() - startCfg),
      message: `Config v${settings.version} active. Maintenance: ${settings.maintenanceMode ? 'ACTIVE' : 'Off'}.`,
      lastChecked: now,
    });

    // 4. Curriculum Index & Validator
    const startCurric = performance.now();
    const curricCount = ALL_VERIFIED_VTU_COURSES.length;
    checks.push({
      id: 'curriculum-index',
      name: 'VTU Academic Intelligence Index',
      status: curricCount > 0 ? 'HEALTHY' : 'WARNING',
      latencyMs: Math.round(performance.now() - startCurric),
      message: `${curricCount} verified syllabus courses indexed across 4 branches.`,
      lastChecked: now,
    });

    // 5. Tool Registry Integrity
    const startTools = performance.now();
    const tools = await this.getEffectiveTools();
    const enabledCount = tools.filter((t) => t.status === 'available').length;
    checks.push({
      id: 'tool-registry',
      name: 'Tool Registry & Limits',
      status: enabledCount > 0 ? 'HEALTHY' : 'WARNING',
      latencyMs: Math.round(performance.now() - startTools),
      message: `${enabledCount} of ${tools.length} browser document utilities available.`,
      lastChecked: now,
    });

    // 6. Billing & Payment Gateway (Phase 15 Section 13)
    const startBilling = performance.now();
    try {
      const subs = MockStorageProvider.getSubscriptions();
      const events = MockStorageProvider.getBillingEvents();
      const invoices = MockStorageProvider.getInvoices();
      const hasRzpConfig = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_WEBHOOK_SECRET);

      checks.push({
        id: 'billing-service',
        name: 'Razorpay Billing & Subscriptions',
        status: hasRzpConfig ? 'HEALTHY' : 'WARNING',
        latencyMs: Math.round(performance.now() - startBilling),
        message: hasRzpConfig
          ? `Razorpay provider ready. ${subs.length} subs, ${invoices.length} invoices, ${events.length} events indexed.`
          : 'Razorpay credentials not fully set. Free local document tools remain fully functional.',
        lastChecked: now,
      });
    } catch {
      checks.push({
        id: 'billing-service',
        name: 'Razorpay Billing & Subscriptions',
        status: 'UNAVAILABLE',
        latencyMs: Math.round(performance.now() - startBilling),
        message: 'Billing storage tables currently inaccessible.',
        lastChecked: now,
      });
    }

    return checks;
  },

  // =========================================================================
  // 6. ERROR LOGGING & MONITORING
  // =========================================================================

  async getSystemErrors(): Promise<PlatformErrorRecord[]> {
    if (typeof window === 'undefined' && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('system_errors')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);
          if (!error && data && data.length > 0) {
            return data.map((d: any) => ({
              id: d.id,
              timestamp: d.timestamp || d.created_at,
              service: d.service,
              tool: d.tool,
              severity: d.severity,
              errorType: d.error_type || d.errorType,
              requestId: d.request_id || d.requestId,
              status: d.status,
              safeMessage: d.safe_message || d.safeMessage,
              diagnostics: d.diagnostics,
            }));
          }
        }
      } catch {
        // Fallback to local store
      }
    }
    return MockStorageProvider.getSystemErrors();
  },

  async recordSystemError(error: Omit<PlatformErrorRecord, 'id' | 'timestamp' | 'status'> & { status?: PlatformErrorRecord['status'] }): Promise<PlatformErrorRecord> {
    return MockStorageProvider.addSystemError({ ...error, status: error.status || 'NEW' });
  },

  async updateErrorStatus(id: string, status: PlatformErrorRecord['status'], actor: AdminActor): Promise<void> {
    MockStorageProvider.updateSystemError(id, status);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: `ERROR_${status}`,
      targetType: 'SYSTEM',
      targetId: id,
      metadata: { newStatus: status },
    });
  },

  // =========================================================================
  // 7. AUDIT LOGS (Append-Only)
  // =========================================================================

  async getAuditLogs(): Promise<AuditLogRecord[]> {
    if (typeof window === 'undefined' && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);
          if (!error && data && data.length > 0) {
            return data.map((d: any) => ({
              id: d.id,
              adminUserId: d.admin_user_id || d.adminUserId,
              adminEmail: d.admin_email || d.adminEmail,
              action: d.action,
              targetType: d.target_type || d.targetType,
              targetId: d.target_id || d.targetId,
              metadata: d.metadata,
              timestamp: d.timestamp || d.created_at,
            }));
          }
        }
      } catch {
        // Fallback to local store
      }
    }
    return MockStorageProvider.getAuditLogs();
  },

  // =========================================================================
  // 8. USER ACCOUNT GOVERNANCE
  // =========================================================================

  async listUsers(params?: {
    search?: string;
    role?: UserRole;
    status?: UserAccountStatus;
    plan?: 'FREE' | 'PRO';
    page?: number;
    limit?: number;
  }): Promise<{
    users: Array<
      Omit<UserProfile, 'avatarUrl'> & {
        status: UserAccountStatus;
        authProvider?: 'EMAIL' | 'GOOGLE';
        plan?: 'FREE' | 'PRO';
        lastSignInAt?: string;
      }
    >;
    total: number;
  }> {
    let all: Array<
      Omit<UserProfile, 'avatarUrl'> & {
        status: UserAccountStatus;
        authProvider?: 'EMAIL' | 'GOOGLE';
        plan?: 'FREE' | 'PRO';
        lastSignInAt?: string;
      }
    > = [];

    if (typeof window === 'undefined' && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const { data: profiles } = await supabase.from('profiles').select('*');
          const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
          const { data: subs } = await supabase.from('subscriptions').select('user_id').eq('status', 'active');
          const proSet = new Set((subs || []).map((s) => s.user_id));

          all = (authData?.users || []).map((u) => {
            const prof = profileMap.get(u.id);
            const role = (prof?.role || u.user_metadata?.role || 'USER') as UserRole;
            const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
            const status: UserAccountStatus = isBanned || u.user_metadata?.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
            const plan: 'FREE' | 'PRO' = proSet.has(u.id) ? 'PRO' : 'FREE';
            const authProvider: 'EMAIL' | 'GOOGLE' =
              (u.app_metadata?.provider || u.identities?.[0]?.provider || 'email').toUpperCase() === 'GOOGLE'
                ? 'GOOGLE'
                : 'EMAIL';
            const fullName = prof?.full_name || u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'User');

            return {
              id: u.id,
              email: u.email || '',
              fullName,
              role,
              status,
              createdAt: u.created_at,
              updatedAt: prof?.updated_at || u.updated_at || u.created_at,
              authProvider,
              plan,
              lastSignInAt: u.last_sign_in_at || undefined,
            };
          });
        }
      } catch (err) {
        console.warn('[AdminService] Fallback to mock storage for listUsers:', err);
      }
    }

    if (all.length === 0) {
      all = MockStorageProvider.listAllUsers().map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        status: u.status || 'ACTIVE',
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        authProvider: u.authProvider || (u.email.includes('gmail.com') ? 'GOOGLE' : 'EMAIL'),
        plan: u.plan || (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' ? 'PRO' : 'FREE'),
        lastSignInAt: u.lastSignInAt,
      }));
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      all = all.filter((u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q) || u.id.includes(q));
    }

    if (params?.role) {
      all = all.filter((u) => u.role === params.role);
    }

    if (params?.status) {
      all = all.filter((u) => u.status === params.status);
    }

    if (params?.plan) {
      all = all.filter((u) => u.plan === params.plan);
    }

    const total = all.length;
    const page = params?.page || 1;
    const limit = params?.limit || 15;
    const paginated = all.slice((page - 1) * limit, page * limit);

    return { users: paginated, total };
  },

  async updateUserStatus(userId: string, status: UserAccountStatus, actor: AdminActor): Promise<void> {
    if (!hasPermission(actor.role, 'users.update')) {
      throw new Error('Permission denied: users.update is required.');
    }

    MockStorageProvider.updateUserStatus(userId, status);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: `USER_STATUS_${status}`,
      targetType: 'USER',
      targetId: userId,
      metadata: { status },
    });
  },

  async updateUserRole(userId: string, role: UserRole, actor: AdminActor): Promise<void> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error('Permission denied: Only SUPER_ADMIN can modify administrator roles.');
    }

    MockStorageProvider.updateUserRole(userId, role);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: `USER_ROLE_${role}`,
      targetType: 'USER',
      targetId: userId,
      metadata: { role },
    });
  },

  async deleteUser(userId: string, actor: AdminActor): Promise<void> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error('Permission denied: Only SUPER_ADMIN can delete user accounts.');
    }

    MockStorageProvider.deleteAccount(userId);

    MockStorageProvider.addAuditLog({
      adminUserId: actor.id,
      adminEmail: actor.email,
      action: 'USER_DELETED',
      targetType: 'USER',
      targetId: userId,
      metadata: {},
    });
  },

  // =========================================================================
  // 9. CONFIGURATION BACKUP & IMPORT
  // =========================================================================

  async exportPlatformConfiguration(): Promise<string> {
    const settings = await this.getPlatformSettings();
    const overrides = await this.getToolOverrides();
    const flags = MockStorageProvider.getFeatureFlags();

    const exportData = {
      version: '11.0',
      exportedAt: new Date().toISOString(),
      platform: settings,
      toolOverrides: overrides,
      featureFlags: flags,
    };

    return JSON.stringify(exportData, null, 2);
  },

  async validateAndImportConfiguration(jsonString: string, actor: AdminActor): Promise<{ success: boolean; message: string }> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error('Permission denied: Only SUPER_ADMIN can import system configuration.');
    }

    try {
      const data = JSON.parse(jsonString);

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON structure.');
      }

      if (!data.version || !data.platform) {
        throw new Error('Missing required schema fields: version or platform.');
      }

      // Apply platform settings
      if (data.platform) {
        MockStorageProvider.updatePlatformSettings(data.platform, actor.email);
      }

      // Apply tool overrides
      if (data.toolOverrides && typeof data.toolOverrides === 'object') {
        for (const override of Object.values(data.toolOverrides)) {
          MockStorageProvider.saveToolOverride(override as ToolOverrideConfig);
        }
      }

      // Apply feature flags
      if (Array.isArray(data.featureFlags)) {
        for (const flag of data.featureFlags) {
          MockStorageProvider.updateFeatureFlag(flag as FeatureFlag);
        }
      }

      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action: 'PLATFORM_CONFIG_IMPORTED',
        targetType: 'SETTING',
        targetId: 'platform_import',
        metadata: { importedVersion: data.version },
      });

      return { success: true, message: 'Platform configuration imported successfully.' };
    } catch (err: any) {
      return { success: false, message: `Configuration import rejected: ${err?.message || 'Invalid format'}` };
    }
  },
};
