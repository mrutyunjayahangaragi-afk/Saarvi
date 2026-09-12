// DocEase Phase 11: Admin Control Center Types
// Single Operational Control Center for DocEase Platform

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export type AdminPermission =
  | 'users.read'
  | 'users.update'
  | 'tools.read'
  | 'tools.update'
  | 'curriculum.read'
  | 'curriculum.update'
  | 'settings.update'
  | 'analytics.read'
  | 'audit.read'
  | 'security.manage';

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    'users.read',
    'users.update',
    'tools.read',
    'tools.update',
    'curriculum.read',
    'curriculum.update',
    'settings.update',
    'analytics.read',
    'audit.read',
    'security.manage',
  ],
  ADMIN: [
    'users.read',
    'tools.read',
    'tools.update',
    'curriculum.read',
    'curriculum.update',
    'settings.update',
    'analytics.read',
    'audit.read',
  ],
  USER: [],
};

export function hasPermission(role: AdminRole | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export type ToolStatusUpper = 'AVAILABLE' | 'BETA' | 'COMING_SOON' | 'DISABLED' | 'MAINTENANCE';

export interface ToolOverrideConfig {
  id: string; // matches tool slug/id
  name?: string;
  category?: 'image' | 'pdf' | 'student';
  status: ToolStatusUpper;
  requiresAuth?: boolean;
  requiresPro?: boolean;
  maxSizeMB?: number;
  maxFiles?: number;
  maxPages?: number;
  orderIndex?: number;
  hidden?: boolean;
  description?: string;
  keywords?: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface PlatformSettings {
  appName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  brandAccent: string;
  supportEmail: string;
  contactEmail: string;
  defaultLanguage: string;
  defaultTimezone: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationEnabled: boolean;
  guestAccessEnabled: boolean;
  defaultAutoDownload: boolean;
  publicToolAvailability: boolean;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export type CurriculumWorkflowStatus =
  | 'DRAFT'
  | 'VALIDATE'
  | 'REVIEW'
  | 'VERIFIED'
  | 'ACTIVE'
  | 'DEPRECATED';

export interface CurriculumVersionRecord {
  id: string;
  scheme: string; // e.g. "2022"
  branch: string; // e.g. "CSE"
  semester: number; // 1-8
  version: string; // e.g. "1.0.0"
  status: CurriculumWorkflowStatus;
  sourceUrl: string;
  sourceTitle: string;
  retrievedDate: string;
  verificationDate?: string;
  verifiedBy?: string;
  coursesCount: number;
  coursesJson: string; // serialized CurriculumCourse[]
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumValidationIssue {
  type: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  courseCode?: string;
}

export interface CurriculumValidationResult {
  isValid: boolean;
  errors: CurriculumValidationIssue[];
  warnings: CurriculumValidationIssue[];
  timestamp: string;
}

export interface GradingRuleRecord {
  id: string;
  scheme: string;
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  description: string;
  status: 'ACTIVE' | 'DRAFT' | 'DEPRECATED';
  source: string;
  version: string;
}

export type FeatureFlagStatus = 'ENABLED' | 'DISABLED' | 'BETA' | 'MAINTENANCE';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'tools' | 'student' | 'future';
  status: FeatureFlagStatus;
  updatedAt: string;
  updatedBy: string;
}

export type AnnouncementType = 'MAINTENANCE' | 'FEATURE' | 'UPDATE' | 'STUDENT';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'EXPIRED';
export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  priority: AnnouncementPriority;
  startDate?: string;
  endDate?: string;
  targetAudience: 'ALL' | 'STUDENTS' | 'LOGGED_IN';
  isDismissible: boolean;
  createdAt: string;
  updatedAt: string;
  publishedBy: string;
}

export type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type ErrorStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface PlatformErrorRecord {
  id: string;
  timestamp: string;
  service: string;
  tool?: string;
  severity: ErrorSeverity;
  errorType: string;
  requestId: string;
  status: ErrorStatus;
  safeMessage: string;
  diagnostics?: string;
}

export interface AuditLogRecord {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string; // e.g. "TOOL_DISABLED", "CURRICULUM_ACTIVATED", "MAINTENANCE_ENABLED"
  targetType: 'TOOL' | 'CURRICULUM' | 'USER' | 'ANNOUNCEMENT' | 'SETTING' | 'FEATURE' | 'SYSTEM';
  targetId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export type SystemHealthStatus = 'HEALTHY' | 'WARNING' | 'UNAVAILABLE' | 'UNKNOWN';

export interface SystemHealthCheck {
  id: string;
  name: string;
  status: SystemHealthStatus;
  latencyMs: number;
  message: string;
  lastChecked: string;
}

export interface NavigationMenuItem {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  orderIndex: number;
  badge?: string;
  category: 'main' | 'tools' | 'student' | 'footer';
}

export interface StudentToolConfig {
  id: string;
  name: string;
  category: 'academic' | 'planning' | 'career' | 'documents' | 'opportunities' | 'organization';
  description: string;
  route: string;
  status: 'available' | 'beta' | 'maintenance' | 'disabled';
  featured: boolean;
  orderIndex: number;
}

// =============================================================================
// Dashboard Analytics & Privacy-Safe Event Types
// =============================================================================

export type DateRangePeriod = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';

export type PlatformEventType =
  | 'tool_opened'
  | 'student_tool_opened'
  | 'signup_completed'
  | 'login_completed'
  | 'feature_used';

export interface PlatformEventRecord {
  id: string;
  eventType: PlatformEventType;
  targetId?: string;
  category: 'tool' | 'student' | 'account' | 'system';
  timestamp: string;
}

export interface DashboardKPIs {
  totalUsers: number;
  newUsers: number;
  previousPeriodNewUsers: number;
  newUsersChangePct: number | null;
  newUsersDiff: number;
  activeUsers: number;
  activeUsersLabel: string;
  totalTools: number;
  enabledTools: number;
  disabledTools: number;
  betaTools: number;
  comingSoonTools: number;
  maintenanceTools: number;
  studentToolsCount: number;
  curriculumCount: number;
  verifiedCurriculumCount: number;
  openErrorsCount: number;
  systemStatus: 'Healthy' | 'Warning' | 'Critical';
  maintenanceMode: boolean;
  version: string;
  lastUpdated: string;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  value: number;
}

export interface CategoryDistribution {
  label: string;
  count: number;
  color: string;
  percentage?: number;
}

export interface TrendComparison {
  current: number;
  previous: number;
  diff: number;
  percentage: number | null;
  isPositive: boolean;
}
