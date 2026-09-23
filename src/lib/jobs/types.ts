/**
 * Saarvi Jobs & Internships Discovery Engine 2.0 — Domain Types
 *
 * Provides single source of truth for:
 * 1. Normalized Job Structure (No synthetic values, honest defaults)
 * 2. Pluggable JobSearchProvider interface
 * 3. Search query filters & sorting parameters
 * 4. Deterministic resume / profile match result
 * 5. Anti-scam report and alert domain entities
 */

export type RemoteType = "remote" | "hybrid" | "onsite";

export type EmploymentType = "full-time" | "part-time" | "internship" | "contract" | "temporary";

export type ExperienceLevel = "fresher" | "entry-level" | "mid-level" | "senior";

export type VerifiedStatus = "verified" | "source_checked" | "unverified" | "reported" | "expired";

export type JobSortOption = "relevant" | "newest" | "deadline_soon" | "match_score";

export interface JobItem {
  id: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  location: string;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  salary: string; // "₹6,00,000 - ₹9,00,000 / yr" or "Salary not disclosed"
  description: string;
  qualifications?: string[];
  responsibilities?: string[];
  skills: string[];
  datePosted: string; // ISO 8601
  applicationDeadline: string; // ISO 8601 or "Deadline not provided"
  sourceName: string;
  sourceUrl: string;
  applyUrl: string;
  sourceJobId: string;
  fetchedAt: string; // ISO 8601
  expiresAt?: string;
  verifiedStatus: VerifiedStatus;
  isInternship: boolean;
  confidenceScore?: number;
  rawDetails?: Record<string, unknown>;
}

export interface JobSearchParams {
  q?: string;
  location?: string;
  employmentType?: string;
  remote?: string; // "remote" | "hybrid" | "onsite" | "all"
  experience?: string; // "fresher" | "entry-level" | "all"
  datePosted?: string; // "today" | "3days" | "week" | "month" | "all"
  skills?: string[];
  page?: number;
  limit?: number;
  sortBy?: JobSortOption;
}

export interface JobSearchResponse {
  items: JobItem[];
  total: number;
  page: number;
  pageSize: number;
  cached: boolean;
  cacheTimestamp?: string;
  staleFallback?: boolean;
  querySummary: {
    q: string;
    location: string;
    filtersApplied: number;
  };
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
  | "SUSPICIOUS"
  | "OTHER";

export interface JobReportRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  sourceUrl?: string;
  reason: JobReportReason;
  notes?: string;
  reporterId?: string;
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
