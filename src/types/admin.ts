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
  | 'security.manage'
  | 'advertising.read'
  | 'advertising.manage';

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
    'advertising.read',
    'advertising.manage',
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
    'advertising.read',
    'advertising.manage',
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
  accessMode?: FeatureAccessMode;
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

// =============================================================================
// Multi-University Academic Control Center Entities
// =============================================================================

export type UniversityStatus = 'ENABLED' | 'DISABLED';

export interface UniversityRecord {
  id: string;
  name: string;
  code: string;
  status: UniversityStatus;
  createdAt: string;
  updatedAt: string;
}

export type SchemeStatus = 'ENABLED' | 'DISABLED';

export interface SchemeRecord {
  id: string;
  universityId: string;
  name: string;
  year: string;
  version: string;
  status: SchemeStatus;
  createdAt: string;
  updatedAt: string;
}

export type BranchStatus = 'ENABLED' | 'DISABLED';

export interface BranchRecord {
  id: string;
  universityId: string;
  schemeId: string;
  name: string;
  code: string;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSemesterRecord {
  id: string;
  universityId: string;
  schemeId: string;
  branchId: string;
  semesterNumber: number;
  status: 'ENABLED' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export type AcademicCourseType = 'Theory' | 'Lab' | 'Practical' | 'Project' | 'Activity' | 'Other';
export type CurriculumPublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface AcademicSubjectRecord {
  id: string;
  universityId: string;
  schemeId: string;
  branchId: string;
  semester: number;
  subjectCode: string;
  subjectName: string;
  credits: number;
  courseType: AcademicCourseType;
  seeApplicable: boolean;
  status: CurriculumPublishStatus;
  includedInSGPA: boolean;
  includedInCGPA: boolean;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export type FeatureAccessMode = 'FREE' | 'SUBSCRIPTION';

export type FeatureFlagStatus = 'ENABLED' | 'DISABLED' | 'BETA' | 'MAINTENANCE';

export interface FeatureFlag {
  id: string;
  key?: string;
  name: string;
  description: string;
  category: 'core' | 'tools' | 'student' | 'future' | 'billing' | 'advertising' | 'ai';
  status: FeatureFlagStatus;
  enabled?: boolean;
  visibility?: 'visible' | 'hidden';
  accessMode?: FeatureAccessMode;
  route?: string;
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
  startAt?: string;
  endAt?: string;
  targetAudience: 'ALL' | 'STUDENTS' | 'LOGGED_IN' | 'PRO_ONLY' | 'GUESTS';
  isDismissible?: boolean;
  dismissible?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  updatedAt: string;
  publishedBy?: string;
  createdBy?: string;
}

export type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
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
  action: string; // e.g. "TOOL_DISABLED", "CURRICULUM_ACTIVATED", "MAINTENANCE_ENABLED", "AD_CREATED"
  targetType: 'TOOL' | 'CURRICULUM' | 'USER' | 'ANNOUNCEMENT' | 'SETTING' | 'FEATURE' | 'SYSTEM' | 'ADVERTISEMENT';
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
  freeUsers?: number;
  proUsers?: number;
  suspendedUsers?: number;
  totalTools: number;
  enabledTools: number;
  disabledTools: number;
  betaTools: number;
  comingSoonTools: number;
  maintenanceTools: number;
  activeFeatures?: number;
  disabledFeatures?: number;
  freeFeatures?: number;
  subscriptionFeatures?: number;
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

// =============================================================================
// Advertisement & Promotional Gate Types
// =============================================================================

export type AdvertisementStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type AdMediaType = 'IMAGE' | 'VIDEO';

export type AdDisplayMode = 'FULLSCREEN_GATE' | 'CENTER_MODAL' | 'BANNER';

export type AdAudience =
  | 'FREE_ONLY'
  | 'PRO_EXCLUDED'
  | 'ALL_AUTHENTICATED_FREE'
  | 'PUBLIC_VISITORS'
  | 'CUSTOM';

export type AdFrequencyMode =
  | 'ONCE_PER_SESSION'
  | 'EVERY_VISIT'
  | 'ONCE_PER_DAY'
  | 'ONCE_PER_TIME_WINDOW';

export interface AdvertisementRecord {
  id: string;
  name: string;
  description?: string;
  mediaType: AdMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  headline?: string;
  bodyText?: string;
  ctaText?: string;
  ctaUrl?: string;
  advertiserName?: string;
  status: AdvertisementStatus;
  priority: number;
  audience: AdAudience;
  startAt?: string;
  endAt?: string;
  timezone: string;
  durationSeconds: number;
  skipEnabled: boolean;
  skipAfterSeconds: number;
  displayMode: AdDisplayMode;
  frequencyMode: AdFrequencyMode;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AdDisplaySettings {
  adsEnabled: boolean;
  defaultDisplayMode: AdDisplayMode;
  defaultDurationSeconds: number;
  defaultSkipEnabled: boolean;
  defaultSkipAfterSeconds: number;
  defaultFrequencyMode: AdFrequencyMode;
  updatedAt: string;
  updatedBy: string;
}

export type AdAnalyticsEventType =
  | 'AD_IMPRESSION'
  | 'AD_STARTED'
  | 'AD_SKIPPED'
  | 'AD_COMPLETED'
  | 'AD_CTA_CLICKED'
  | 'AD_MEDIA_ERROR';

export interface AdAnalyticsEvent {
  id: string;
  adId: string;
  eventType: AdAnalyticsEventType;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AdAnalyticsSummary {
  adId?: string;
  impressions: number;
  completed: number;
  skipped: number;
  ctaClicks: number;
  mediaErrors: number;
  completionRate: number; // 0 - 100%
  skipRate: number;       // 0 - 100%
  ctr: number;            // 0 - 100%
}

export interface ActiveAdResponse {
  showAd: boolean;
  isPro?: boolean;
  reason?: 'PRO_EXEMPT' | 'ADS_DISABLED' | 'NO_ACTIVE_AD' | 'FREQUENCY_CAPPED' | 'OK';
  ad?: AdvertisementRecord;
  settings?: AdDisplaySettings;
}
