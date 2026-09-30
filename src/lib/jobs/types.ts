/**
 * Saarvi Jobs & Internships Discovery Engine 6.0 — Domain Types
 *
 * Provides single source of truth for:
 * 1. Two-Tier Verification System: Tier A (Saarvi Verified) vs Tier B (Source Discovery)
 * 2. Canonical Job Item structure with full provenance & apply options
 * 3. Search query filters & sorting parameters
 * 4. Admin 9-metric lifecycle counts
 * 5. Customer safety reports and subscriptions
 */

export type RemoteType = "remote" | "hybrid" | "onsite";

export type EmploymentType = "full-time" | "part-time" | "internship" | "contract" | "temporary" | "training";

export type ExperienceLevel = "fresher" | "entry-level" | "mid-level" | "senior";

export type VerifiedStatus = "verified" | "source_checked" | "unverified" | "reported" | "expired";

export type VerificationTier = "SAARVI_VERIFIED" | "SOURCE_DISCOVERY";

export type JobSortOption = "relevant" | "newest" | "deadline_soon" | "match_score";

export interface JobApplyOption {
  title?: string;
  link: string;
  source?: string;
}

export interface JobItem {
  id: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  companyLogoUrl?: string;
  location: string;
  country?: string;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  salary: string; // "₹6,00,000 - ₹9,00,000 / yr" or "Salary not disclosed"
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  description: string;
  qualifications?: string[];
  responsibilities?: string[];
  benefits?: string[];
  skills: string[];
  datePosted: string; // ISO 8601
  applicationDeadline: string; // ISO 8601 or "Deadline not provided"
  sourceName: string;
  sourceUrl: string;
  applyUrl: string;
  applyOptions?: JobApplyOption[];
  provider?: string;
  sourceJobId: string;
  providerJobId?: string;
  fetchedAt: string; // ISO 8601
  discoveredAt?: string;
  lastVerifiedAt?: string;
  expiresAt?: string;
  verifiedStatus: VerifiedStatus;
  verificationTier: VerificationTier;
  isInternship: boolean;
  confidenceScore?: number;
  rawDetails?: Record<string, unknown>;
  recordState?: "ACTIVE" | "ARCHIVED" | "DELETED";
  reviewState?: "DISCOVERED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  publicationState?: "NOT_PUBLISHED" | "PUBLISHED" | "PAUSED";
}

export interface JobSearchParams {
  q?: string;
  role?: string;
  branch?: string;
  domain?: string;
  location?: string;
  employmentType?: string;
  remote?: string; // "remote" | "hybrid" | "onsite" | "all"
  experience?: string; // "fresher" | "entry-level" | "all"
  datePosted?: string; // "today" | "3days" | "week" | "month" | "all"
  skills?: string[];
  tier?: "all" | "verified" | "source"; // Filter by verification tier
  page?: number;
  limit?: number;
  sortBy?: JobSortOption;
  enableLiveDiscovery?: boolean;
}

export interface JobSearchResponse {
  items: JobItem[];
  verifiedItems?: JobItem[];
  sourceItems?: JobItem[];
  total: number;
  page: number;
  pageSize: number;
  cached: boolean;
  cacheTimestamp?: string;
  staleFallback?: boolean;
  partialFailureMessage?: string;
  relaxationExplanation?: string;
  isRelaxed?: boolean;
  matchReasonsMap?: Record<string, string[]>;
  /**
   * Total number of LIVE jobs before any user filters are applied.
   * Used to distinguish "no jobs exist" from "filters eliminated all results".
   * If liveCount > 0 and items.length = 0, show "No opportunities match your filters."
   * If liveCount = 0, show "No live opportunities are currently available."
   */
  liveCount?: number;
  filteredCount?: number;
  verifiedCount?: number;
  sourceDiscoveryCount?: number;
  providerStatus?: {
    searched: boolean;
    provider?: string;
    newDiscovered?: number;
    error?: string;
  };
  querySummary: {
    q: string;
    location: string;
    filtersApplied: number;
  };
}

export interface AdminJobLifecycleCounts {
  stored: number;
  sourceDiscoveries: number;
  pendingReview: number;
  saarviVerified: number;
  published: number;
  liveToUsers: number;
  expired: number;
  archived: number;
  reports: number;
  totalCatalog: number;
  // Compatibility fields for existing store & reconciliation controllers
  pending?: number;
  approved?: number;
  rejected?: number;
  paused?: number;
  total?: number;
  expiredPublished?: number;
}

export interface JobMatchingResult {
  matchScore: number; // 0 - 100
  matchedSkills: string[];
  missingSkills: string[];
  matchingReasons: string[];
  potentialGaps: string[];
  breakdown: {
    skillsScore: number; // 0 - 40
    roleScore: number; // 0 - 20
    locationScore: number; // 0 - 15
    experienceScore: number; // 0 - 10
    educationScore: number; // 0 - 10
    freshnessScore: number; // 0 - 5
  };
}

export type JobReportReason =
  | "FAKE_JOB"
  | "EXPIRED"
  | "WRONG_COMPANY"
  | "BROKEN_LINK"
  | "MISLEADING_INFO"
  | "PAYMENT_REQUIRED"
  | "DUPLICATE"
  | "SUSPICIOUS"
  | "OTHER";

export interface JobReportRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  sourceUrl?: string;
  verificationTier?: VerificationTier;
  reason: JobReportReason;
  notes?: string;
  reporterId?: string;
  reporterEmail?: string;
  reportedAt: string;
  status: "PENDING" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  resolutionNotes?: string;
}

export interface JobAlertSubscription {
  id: string;
  userId: string;
  title: string;
  keywords: string[];
  location?: string;
  employmentType?: string;
  frequency: "daily" | "weekly";
  active: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  createdAt: string;
  lastDeliveredAt?: string;
}

export interface JobSearchProvider {
  readonly id: string;
  readonly name: string;
  search(params: JobSearchParams): Promise<{ items: JobItem[]; total?: number; nextPageToken?: string }>;
  isAvailable(): boolean;
}
