/**
 * Saarvi Career Intelligence Engine 2.0 — Opportunity Domain Types
 *
 * Implements clean, deterministic types for:
 * 1. Unified Opportunity Model
 * 2. Pluggable OpportunitySource Interface
 * 3. Discovery Query Templates & Search Strategy
 * 4. Normalization & Deduplication Schema
 * 5. Multi-Stage Status Lifecycle & Admin Approval
 * 6. Source Health Telemetry
 */

export type OpportunityCategory = "job" | "internship" | "scholarship" | "hackathon";

export type OpportunityStatus =
  | "DISCOVERED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "ACTIVE"
  | "DRAFT"
  | "PAUSED"
  | "REJECTED"
  | "EXPIRED"
  | "STALE"
  | "MERGED"
  | "ARCHIVED"
  | "DELETED";

export type RemoteType = "remote" | "hybrid" | "onsite";

export type EmploymentType = "full-time" | "part-time" | "internship" | "contract" | "temporary";

export type ExperienceLevel = "fresher" | "entry-level" | "mid-level" | "senior";

export interface OpportunitySalary {
  min?: number;
  max?: number;
  currency?: string;
  period?: "yearly" | "monthly" | "hourly";
}

export interface Opportunity {
  id: string;
  source: "serpapi_google_jobs" | "serpapi_google_search" | "curated" | "rss" | "custom_adapter" | "admin_manual";
  sourceId: string;
  sourceUrl: string;
  applyUrl: string;
  originalSourceUrl: string;
  directApplyUrl?: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  description: string;
  location: string;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  skills: string[];
  salary?: OpportunitySalary | null;
  postedAt: string; // ISO 8601
  applicationDeadline?: string | null; // ISO 8601 or YYYY-MM-DD
  sourceLastUpdatedAt: string;
  discoveredAt: string;
  verifiedAt?: string | null;
  verifiedByAdmin?: boolean;
  approvedBy?: string;
  status: OpportunityStatus;
  category: OpportunityCategory;
  isInternship: boolean;
  isJob: boolean;
  isScholarship: boolean;
  isHackathon: boolean;
  contactEmail?: string;
  tags?: string[];
  contentHash: string; // SHA-256 / deterministic string hash for change detection
  confidenceScore: number; // 0 - 100
  duplicateOfId?: string;
  duplicateSources?: string[];
  adminNotes?: string;
  publishedAt?: string;
  expiresAt?: string;
  canonicalJobKey?: string;
  viewsCount?: number;
  savesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewOpportunity extends Opportunity {
  validationStatus: "VALID" | "WARNING" | "INVALID";
  validationWarnings?: string[];
  duplicateStatus: "NEW" | "POSSIBLE_DUPLICATE" | "EXACT_DUPLICATE";
  duplicateTargetId?: string;
}

export interface ManualOpportunityInput {
  title: string;
  companyName: string;
  companyLogo?: string;
  description: string;
  location: string;
  remoteType?: RemoteType;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  skills?: string[];
  salary?: OpportunitySalary | null;
  postedAt?: string;
  applicationDeadline?: string | null;
  sourceUrl?: string;
  applyUrl: string;
  contactEmail?: string;
  category?: OpportunityCategory;
  tags?: string[];
  status?: OpportunityStatus;
}

export interface BulkImportSummary {
  found: number;
  valid: number;
  invalid: number;
  duplicates: number;
  imported: number;
}

export interface SearchQuery {
  role?: string;
  skills?: string[];
  location?: string;
  category?: OpportunityCategory;
  isInternship?: boolean;
  experienceLevel?: ExperienceLevel;
  nextPageToken?: string;
  limit?: number;
}

export interface SourceHealth {
  sourceId: string;
  name: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  lastSuccessfulFetch?: string;
  lastError?: string;
  responseTimeMs?: number;
  recordsDiscoveredTotal: number;
  recordsApprovedTotal: number;
  rateLimit429Count: number;
  lastCheckTimestamp: string;
}

export interface OpportunitySourceAdapter {
  readonly id: string;
  readonly name: string;
  search(query: SearchQuery): Promise<{
    results: Opportunity[];
    nextPageToken?: string;
  }>;
  getDetails?(sourceId: string): Promise<Opportunity | null>;
  healthCheck(): Promise<SourceHealth>;
}

export interface DiscoveryConfig {
  roles: string[];
  locations: string[];
  skills: string[];
  experienceLevels: ExperienceLevel[];
  searchFrequencyHours: number;
  autoApproveHighConfidence: boolean; // default false for strict admin review
  enabledSources: string[];
  lastRunTimestamp?: string;
}

export interface OpportunityFilterParams {
  category?: OpportunityCategory;
  location?: string;
  remoteOnly?: boolean;
  experienceLevel?: ExperienceLevel;
  skills?: string[];
  search?: string;
  status?: OpportunityStatus;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "deadline" | "match";
}
