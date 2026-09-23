/**
 * Search Intent Preservation Engine.
 *
 * Guarantees:
 * - Safely serializes temporary search criteria before authentication.
 * - Stores ONLY non-sensitive query filters (never passwords, tokens, or credentials).
 * - Restores search criteria after login, registration, or OAuth callback.
 * - Automatic expiration (2 hours) to avoid stale query persistence.
 */

export interface JobSearchIntent {
  q?: string;
  location?: string;
  experience?: string;
  remote?: string;
  employmentType?: string;
  sortBy?: string;
  skills?: string[];
  timestamp: number;
}

const INTENT_STORAGE_KEY = "saarvi_pending_job_search";
const MAX_INTENT_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Persists pending job search criteria into sessionStorage.
 */
export function saveSearchIntent(criteria: Omit<JobSearchIntent, "timestamp">): void {
  if (typeof window === "undefined") return;

  try {
    const payload: JobSearchIntent = {
      q: criteria.q ? criteria.q.trim() : undefined,
      location: criteria.location ? criteria.location.trim() : undefined,
      experience: criteria.experience && criteria.experience !== "all" ? criteria.experience : undefined,
      remote: criteria.remote && criteria.remote !== "all" ? criteria.remote : undefined,
      employmentType: criteria.employmentType && criteria.employmentType !== "all" ? criteria.employmentType : undefined,
      sortBy: criteria.sortBy && criteria.sortBy !== "relevant" ? criteria.sortBy : undefined,
      skills: Array.isArray(criteria.skills) && criteria.skills.length > 0 ? criteria.skills : undefined,
      timestamp: Date.now(),
    };

    window.sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[SearchIntent] Failed to persist search intent to sessionStorage:", err);
  }
}

/**
 * Retrieves pending search intent from sessionStorage if valid and not expired.
 */
export function getSearchIntent(): JobSearchIntent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(INTENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed: JobSearchIntent = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== "number") {
      clearSearchIntent();
      return null;
    }

    if (Date.now() - parsed.timestamp > MAX_INTENT_AGE_MS) {
      clearSearchIntent();
      return null;
    }

    return parsed;
  } catch {
    clearSearchIntent();
    return null;
  }
}

/**
 * Clears pending search intent once successfully consumed.
 */
export function clearSearchIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
  } catch {}
}

/**
 * Constructs a safe redirect URL with search parameters and autoSearch flag.
 */
export function buildReturnUrlWithSearch(intent: Partial<JobSearchIntent>): string {
  const params = new URLSearchParams();

  if (intent.q && intent.q.trim()) params.set("q", intent.q.trim());
  if (intent.location && intent.location.trim()) params.set("location", intent.location.trim());
  if (intent.experience && intent.experience !== "all") params.set("experience", intent.experience);
  if (intent.remote && intent.remote !== "all") params.set("remote", intent.remote);
  if (intent.employmentType && intent.employmentType !== "all") params.set("employmentType", intent.employmentType);
  if (intent.sortBy && intent.sortBy !== "relevant") params.set("sortBy", intent.sortBy);
  if (intent.skills && intent.skills.length > 0) params.set("skills", intent.skills.join(","));

  params.set("autoSearch", "true");

  const queryString = params.toString();
  return `/jobs${queryString ? `?${queryString}` : ""}`;
}
