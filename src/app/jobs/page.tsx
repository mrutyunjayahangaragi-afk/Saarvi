"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import type { JobItem, JobSortOption, JobReportReason } from "@/lib/jobs/types";
import { calculateJobMatch, extractCandidateContext } from "@/lib/jobs/matching";
import { careerService } from "@/lib/services/careerService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { useAuth } from "@/context/AuthContext";
import { analytics } from "@/lib/analytics/tracker";
import {
  saveSearchIntent,
  getSearchIntent,
  clearSearchIntent,
  buildReturnUrlWithSearch,
} from "@/lib/jobs/search-intent";
import JobsAuthGateModal from "@/components/career/JobsAuthGateModal";
import {
  Briefcase,
  Search,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Bookmark,
  CheckCircle2,
  X,
  ChevronRight,
  TrendingUp,
  Layers,
  ArrowRight,
  Flag,
  Bell,
  RefreshCw,
  Lock,
} from "lucide-react";

type SearchState = "idle" | "auth_required" | "authenticating" | "searching" | "ready" | "empty" | "error";

const SUGGESTED_SEARCHES = [
  "React developer fresher Bengaluru",
  "Java internship 2026 students",
  "Software engineer fresher India",
  "AI ML internship remote",
  "Full stack developer entry level",
  "Python developer remote",
];

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // Search Query & Filters
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const initialEmploymentType =
    searchParams.get("employmentType") ||
    (searchParams.get("category") === "internship"
      ? "internship"
      : searchParams.get("category") === "job"
      ? "full-time"
      : "all");
  const [employmentType, setEmploymentType] = useState(initialEmploymentType);
  const [remote, setRemote] = useState(searchParams.get("remote") || "all");
  const [experience, setExperience] = useState(searchParams.get("experience") || "all");
  const [selectedTier, setSelectedTier] = useState<"all" | "verified" | "source">("all");
  const [sortBy, setSortBy] = useState<JobSortOption>((searchParams.get("sortBy") as JobSortOption) || "relevant");

  // State Machine
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [verifiedJobs, setVerifiedJobs] = useState<JobItem[]>([]);
  const [sourceJobs, setSourceJobs] = useState<JobItem[]>([]);
  const [verifiedCount, setVerifiedCount] = useState<number>(0);
  const [sourceDiscoveryCount, setSourceDiscoveryCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [staleFallback, setStaleFallback] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [candidateProfile, setCandidateProfile] = useState<any | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * liveCount: total live jobs BEFORE user filters are applied.
   * Used to distinguish:
   *   liveCount = 0 → "No live opportunities are currently available."
   *   liveCount > 0 but jobs.length = 0 → "No opportunities match your current filters."
   */
  const [liveCount, setLiveCount] = useState<number | null>(null);

  // Auth Gate Modal State
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Modals
  const [reportingJob, setReportingJob] = useState<JobItem | null>(null);
  const [reportReason, setReportReason] = useState<JobReportReason>("MISLEADING_INFO");
  const [reportNotes, setReportNotes] = useState("");
  const [reportingSubmitting, setReportingSubmitting] = useState(false);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertFrequency, setAlertFrequency] = useState<"daily" | "weekly">("daily");

  const [selectedMatchJob, setSelectedMatchJob] = useState<{
    job: JobItem;
    match: ReturnType<typeof calculateJobMatch>;
  } | null>(null);

  // Feature Gate State
  const [featureGated, setFeatureGated] = useState<{
    status: 'DISABLED' | 'BETA' | 'PRO_REQUIRED';
    reason: string;
    maintenanceMessage?: string;
  } | null>(null);

  // Check initial Jobs feature control settings
  useEffect(() => {
    async function checkFeatureStatus() {
      try {
        const res = await fetch('/api/jobs/feature-control');
        if (res.ok) {
          const data = await res.json();
          if (data.mode === 'DISABLED' || data.enabled === false) {
            setFeatureGated({
              status: 'DISABLED',
              reason: 'Jobs & Internships is currently unavailable.',
              maintenanceMessage: data.maintenance_message,
            });
          }
        }
      } catch {}
    }
    checkFeatureStatus();
  }, []);

  // Emit page view
  useEffect(() => {
    try {
      analytics.trackEvent({
        name: "jobs_page_view" as any,
        category: "public",
      });
    } catch {}
  }, []);

  // Load candidate profile locally for authenticated users
  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      try {
        const prof = await careerService.getOrCreateProfile();
        if (prof && prof.skills && prof.skills.length > 0) {
          setCandidateProfile(prof);
        }
      } catch {}
    }
    loadProfile();

    // Load saved job IDs from local tracker
    async function loadSaved() {
      try {
        const apps = await academicStorage.getAllJobApplications();
        const ids = new Set(apps.map((a) => a.id));
        setSavedJobIds(ids);
      } catch {}
    }
    loadSaved();
  }, [user]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saarvi_recent_job_searches");
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5));
    } catch {}
  }, []);

  // Fetch Jobs from Server API (Strictly Authenticated)
  const fetchJobs = useCallback(
    async (
      isRefresh = false,
      overrides: Partial<{
        q: string;
        location: string;
        employmentType: string;
        remote: string;
        experience: string;
        tier: "all" | "verified" | "source";
        sortBy: JobSortOption;
      }> = {}
    ) => {
      if (!user) {
        setLoading(false);
        setSearchState("idle");
        return;
      }

      setLoading(true);
      setSearchState("searching");
      setError(null);

      const activeQ = overrides.q !== undefined ? overrides.q : q;
      const activeLoc = overrides.location !== undefined ? overrides.location : location;
      const activeEmp = overrides.employmentType !== undefined ? overrides.employmentType : employmentType;
      const activeRem = overrides.remote !== undefined ? overrides.remote : remote;
      const activeExp = overrides.experience !== undefined ? overrides.experience : experience;
      const activeTier = overrides.tier !== undefined ? overrides.tier : selectedTier;
      const activeSort = overrides.sortBy !== undefined ? overrides.sortBy : sortBy;

      try {
        analytics.trackEvent({
          name: "jobs_search_started" as any,
          category: "public",
        });
      } catch {}

      const params = new URLSearchParams();
      if (activeQ.trim()) params.set("q", activeQ.trim());
      if (activeLoc.trim()) params.set("location", activeLoc.trim());
      if (activeEmp !== "all") params.set("employmentType", activeEmp);
      if (activeRem !== "all") params.set("remote", activeRem);
      if (activeExp !== "all") params.set("experience", activeExp);
      if (activeTier !== "all") params.set("tier", activeTier);
      if (activeSort !== "relevant") params.set("sortBy", activeSort);
      if (isRefresh) params.set("t", String(Date.now()));

      try {
        const res = await fetch(`/api/jobs/search?${params.toString()}`);
        if (!res.ok) {
          if (res.status === 401) {
            setSearchState("auth_required");
            setAuthGateOpen(true);
            setJobs([]);
            setVerifiedJobs([]);
            setSourceJobs([]);
            return;
          }
          if (res.status === 403) {
            const errData = await res.json().catch(() => ({}));
            setFeatureGated({
              status: errData.status || (errData.error?.includes('beta') ? 'BETA' : errData.error?.includes('Pro') ? 'PRO_REQUIRED' : 'DISABLED'),
              reason: errData.error || 'Jobs & Internships is currently unavailable.',
              maintenanceMessage: errData.maintenanceMessage,
            });
            setJobs([]);
            setVerifiedJobs([]);
            setSourceJobs([]);
            setSearchState("error");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const items: JobItem[] = data.items || [];
        setJobs(items);

        // Populate verified and source jobs
        const verified = data.verifiedItems || items.filter((j: any) => j.verificationTier === "SAARVI_VERIFIED");
        const source = data.sourceItems || items.filter((j: any) => j.verificationTier === "SOURCE_DISCOVERY");
        setVerifiedJobs(verified);
        setSourceJobs(source);
        setVerifiedCount(typeof data.verifiedCount === "number" ? data.verifiedCount : verified.length);
        setSourceDiscoveryCount(typeof data.sourceDiscoveryCount === "number" ? data.sourceDiscoveryCount : source.length);

        setIsCached(Boolean(data.cached));
        setStaleFallback(Boolean(data.staleFallback));
        // Track liveCount to power correct empty-state messaging
        if (typeof data.liveCount === "number") {
          setLiveCount(data.liveCount);
        } else if (typeof data.filteredCount === "number") {
          setLiveCount(data.filteredCount);
        }
        setSearchState(items.length > 0 ? "ready" : "empty");

        try {
          analytics.trackEvent({
            name: "jobs_search_completed" as any,
            category: "public",
          });
        } catch {}

        // Record recent search
        if (activeQ.trim()) {
          setRecentSearches((prev) => {
            const updated = Array.from(new Set([activeQ.trim(), ...prev])).slice(0, 5);
            try {
              localStorage.setItem("saarvi_recent_job_searches", JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      } catch {
        setError("Unable to load opportunities right now. Please retry or adjust your search.");
        setSearchState("error");
        try {
          analytics.trackEvent({
            name: "jobs_search_failed" as any,
            category: "public",
          });
        } catch {}
      } finally {
        setLoading(false);
      }
    },
    [user, q, location, employmentType, remote, experience, selectedTier, sortBy]
  );

  // Restore search criteria on mount (e.g. returning after auth or via autoSearch)
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      setSearchState("idle");
      return;
    }

    // Authenticated user arriving: check for stored intent or autoSearch URL params
    const autoSearch = searchParams.get("autoSearch") === "true";
    const savedIntent = getSearchIntent();

    if (savedIntent) {
      if (savedIntent.q !== undefined) setQ(savedIntent.q);
      if (savedIntent.location !== undefined) setLocation(savedIntent.location);
      if (savedIntent.experience !== undefined) setExperience(savedIntent.experience);
      if (savedIntent.remote !== undefined) setRemote(savedIntent.remote);
      if (savedIntent.employmentType !== undefined) setEmploymentType(savedIntent.employmentType);
      if (savedIntent.sortBy !== undefined) setSortBy(savedIntent.sortBy as JobSortOption);

      clearSearchIntent();
      fetchJobs(true, {
        q: savedIntent.q,
        location: savedIntent.location,
        experience: savedIntent.experience,
        remote: savedIntent.remote,
        employmentType: savedIntent.employmentType,
        sortBy: savedIntent.sortBy as JobSortOption,
      });
    } else if (autoSearch || q || location || initialEmploymentType !== "all" || remote !== "all") {
      fetchJobs(false, { employmentType: initialEmploymentType });
    } else {
      // Authenticated initial view - immediately fetch all published verified opportunities
      fetchJobs(false, { employmentType: initialEmploymentType });
    }
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Search Button Click
  const handleSearchClick = () => {
    if (!user) {
      saveSearchIntent({ q, location, experience, remote, employmentType, sortBy });
      setSearchState("auth_required");
      setAuthGateOpen(true);
      try {
        analytics.trackEvent({
          name: "jobs_auth_required" as any,
          category: "auth",
        });
      } catch {}
      return;
    }

    fetchJobs(true);
  };

  // Clear filters
  const handleClearFilters = () => {
    setQ("");
    setLocation("");
    setEmploymentType("all");
    setRemote("all");
    setExperience("all");
    setSortBy("relevant");
    fetchJobs(true, {
      q: "",
      location: "",
      employmentType: "all",
      remote: "all",
      experience: "all",
      sortBy: "relevant",
    });
  };

  // Compute matches
  const candidateContext = useMemo(() => {
    if (!candidateProfile) return null;
    return extractCandidateContext(candidateProfile);
  }, [candidateProfile]);

  const matchScoresMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateJobMatch>>();
    if (!candidateContext) return map;

    for (const job of jobs) {
      map.set(job.id, calculateJobMatch(candidateContext, job));
    }
    return map;
  }, [jobs, candidateContext]);

  // Save Job to Local Application Tracker
  const handleSaveJob = async (job: JobItem) => {
    if (!user) {
      saveSearchIntent({ q, location, experience, remote, employmentType, sortBy });
      setAuthGateOpen(true);
      return;
    }

    const isAlreadySaved = savedJobIds.has(job.id);
    const action = isAlreadySaved ? "UNSAVE" : "SAVE";

    try {
      // Sync with server API
      fetch("/api/jobs/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action }),
      }).catch(() => {});

      if (isAlreadySaved) {
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
        setNotice(`Removed "${job.title}" from saved jobs.`);
      } else {
        await academicStorage.saveJobApplication({
          id: job.id,
          company: job.companyName,
          role: job.title,
          location: job.location,
          jobUrl: job.applyUrl,
          applicationDate: new Date().toISOString().split("T")[0],
          deadline: job.applicationDeadline !== "Deadline not provided" ? job.applicationDeadline : undefined,
          status: "SAVED",
          priority: "medium",
          notes: `Saved from ${job.sourceName}. Salary: ${job.salary}`,
          events: [
            {
              id: `evt_${Date.now()}`,
              status: "SAVED",
              date: new Date().toISOString().split("T")[0],
              notes: "Bookmarked opportunity via Saarvi Jobs",
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        setSavedJobIds((prev) => new Set([...prev, job.id]));
        setNotice(`Saved "${job.title}" to your private Application Tracker.`);
        try {
          analytics.trackEvent({
            name: "job_saved" as any,
            category: "student",
          });
        } catch {}
      }
      setTimeout(() => setNotice(null), 3000);
    } catch {
      setNotice("Could not update saved job state.");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  // Submit Report
  const handleSubmitReport = async () => {
    if (!reportingJob) return;
    if (!user) {
      setAuthGateOpen(true);
      return;
    }

    setReportingSubmitting(true);
    try {
      const res = await fetch("/api/jobs/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: reportingJob.id,
          jobTitle: reportingJob.title,
          companyName: reportingJob.companyName,
          sourceUrl: reportingJob.sourceUrl,
          reason: reportReason,
          notes: reportNotes,
        }),
      });

      if (res.ok) {
        setNotice("Thank you. Listing reported for administrative review.");
        setReportingJob(null);
        setReportNotes("");
      } else {
        setNotice("Failed to submit report. Please retry.");
      }
    } catch {
      setNotice("Network error reporting listing.");
    } finally {
      setReportingSubmitting(false);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  // Create Job Alert
  const handleCreateAlert = async () => {
    if (!user) {
      setAuthGateOpen(true);
      setShowAlertModal(false);
      return;
    }

    try {
      const res = await fetch("/api/jobs/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: q || "Opportunities Alert",
          keywords: q ? [q] : ["Software Engineer"],
          location: location || undefined,
          employmentType: employmentType !== "all" ? employmentType : undefined,
          frequency: alertFrequency,
        }),
      });

      if (res.ok) {
        setNotice(`Job alert created for "${q || "Opportunities"}". You will receive updates.`);
        setShowAlertModal(false);
      }
    } catch {
      setNotice("Could not create alert.");
    } finally {
      setTimeout(() => setNotice(null), 3500);
    }
  };

  // Construct return URL for auth redirection
  const returnUrl = useMemo(() => {
    return buildReturnUrlWithSearch({
      q,
      location,
      experience,
      remote,
      employmentType,
      sortBy,
    });
  }, [q, location, experience, remote, employmentType, sortBy]);

  if (featureGated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16 flex items-center justify-center">
          <div className="w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-4">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
              featureGated.status === "PRO_REQUIRED"
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}>
              {featureGated.status === "PRO_REQUIRED" ? (
                <Sparkles className="w-7 h-7" />
              ) : (
                <Lock className="w-7 h-7" />
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {featureGated.status === "DISABLED"
                ? "Jobs & Internships"
                : featureGated.status === "BETA"
                ? "Jobs & Internships (Beta)"
                : "Saarvi Pro Required"}
            </h1>

            <div className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed space-y-1">
              {featureGated.status === "DISABLED" ? (
                <>
                  <p className="font-semibold text-slate-800">This feature is currently unavailable.</p>
                  <p className="text-slate-500">{featureGated.maintenanceMessage || "Please check back later."}</p>
                </>
              ) : (
                <p>{featureGated.maintenanceMessage || featureGated.reason}</p>
              )}
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              {featureGated.status === "PRO_REQUIRED" && (
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  Upgrade to Pro
                </Link>
              )}
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const renderJobCard = (job: JobItem) => {
    const match = matchScoresMap.get(job.id);
    const isSaved = savedJobIds.has(job.id);
    const isVerified = job.verificationTier === "SAARVI_VERIFIED";

    return (
      <div
        key={job.id}
        className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group ${
          isVerified ? "border-slate-200 hover:border-emerald-300" : "border-amber-200/80 bg-amber-50/15 hover:border-amber-400"
        }`}
      >
        <div>
          {/* Top Row: Logo, Badges, Title, Match Pill, Save */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {/* Company Logo or Initials Fallback */}
              <div className="shrink-0 mt-0.5">
                {job.companyLogoUrl ? (
                  <img
                    src={job.companyLogoUrl}
                    alt={job.companyName}
                    className="w-10 h-10 rounded-xl object-contain border border-slate-100 bg-white p-1"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                    {job.companyName ? job.companyName.slice(0, 2).toUpperCase() : "JB"}
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {/* Verification Tier Badge */}
                  {isVerified ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs"
                      title="Reviewed and published by Saarvi Admin"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Saarvi Verified</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs"
                      title="Discovered from external source. Saarvi has not individually verified this opportunity."
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Source Listing • Not Saarvi Verified</span>
                    </span>
                  )}

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      job.isInternship
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {job.isInternship ? "Internship" : "Job"}
                  </span>

                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                    {job.remoteType}
                  </span>

                  {job.experienceLevel === "fresher" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Fresher Friendly
                    </span>
                  )}
                </div>

                <Link
                  href={`/jobs/${job.id}`}
                  className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1"
                >
                  {job.title}
                </Link>

                <div className="text-xs text-slate-600 font-medium mt-0.5">
                  {job.companyName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {match && (
                <button
                  type="button"
                  onClick={() => setSelectedMatchJob({ job, match })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                  title="Click to view explainable match breakdown"
                >
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>{match.matchScore}% Match</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSaveJob(job)}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isSaved
                    ? "text-blue-600 bg-blue-50"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title={isSaved ? "Saved in Tracker" : "Save Job"}
                aria-label={isSaved ? "Saved" : "Save Job"}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>

          {/* Metadata Row: Location, Salary, Deadline */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 mt-2.5">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[160px]">{job.location}</span>
            </div>
            {job.salary && (
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-700">{job.salary}</span>
              </div>
            )}
            {job.applicationDeadline && job.applicationDeadline !== "Deadline not provided" && (
              <div className="flex items-center gap-1 text-amber-700 font-medium">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Deadline: {job.applicationDeadline}</span>
              </div>
            )}
          </div>

          {/* Description Excerpt */}
          <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
            {job.description}
          </p>

          {/* Skills Pills */}
          {job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {job.skills.slice(0, 5).map((sk) => (
                <span
                  key={sk}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700"
                >
                  {sk}
                </span>
              ))}
              {job.skills.length > 5 && (
                <span className="text-[10px] text-slate-400 font-medium self-center">
                  +{job.skills.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              Source: <strong className="text-slate-600">{job.sourceName || "Direct"}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReportingJob(job)}
              className="p-1 text-slate-300 hover:text-rose-600 rounded transition"
              title="Report listing"
              aria-label="Report listing"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>

            <Link
              href={`/jobs/${job.id}`}
              className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              View
            </Link>

            <a
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition flex items-center gap-1 shadow-2xs"
            >
              <span>Apply</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <Navbar />

      {notice && (
        <div className="bg-blue-600 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-semibold shadow-md transition-all sticky top-16 z-40">
          {notice}
        </div>
      )}

      {/* Hero Search Header */}
      <header className="bg-linear-to-b from-blue-900 via-slate-900 to-slate-900 text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-2">
                <Briefcase className="w-3.5 h-3.5" />
                Real Career Discovery
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Jobs &amp; Internships
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                {user
                  ? "Discover opportunities that match your skills and career goals."
                  : "Find opportunities that match your skills, experience, location, and career goals."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setAuthGateOpen(true);
                  } else {
                    setShowAlertModal(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-colors cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Create Job Alert</span>
              </button>
              <Link
                href={user ? "/student/applications" : `/login?next=${encodeURIComponent("/student/applications")}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
              >
                <span>My Tracker</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Search Inputs Bar */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-2 text-slate-800">
            {/* Keyword / Role */}
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/80 w-full">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
                placeholder="Keyword / Role (e.g. Software Developer)"
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 focus:outline-hidden"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Clear query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Location */}
            <div className="w-full md:w-60 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/80">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
                placeholder="Location (e.g. Bengaluru)"
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 focus:outline-hidden"
              />
            </div>

            {/* Experience Dropdown */}
            <div className="w-full md:w-48 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/80">
              <select
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 focus:outline-hidden cursor-pointer"
                aria-label="Experience level"
              >
                <option value="fresher">Fresher</option>
                <option value="entry-level">Entry-Level (0-2 yrs)</option>
                <option value="mid-level">Mid-Level (2-5 yrs)</option>
                <option value="senior">Senior (5+ yrs)</option>
                <option value="all">All Experience</option>
              </select>
            </div>

            {/* Primary Search Button */}
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={loading}
              className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search opportunities</span>
                </>
              )}
            </button>
          </div>

          {/* Suggested / Recent Searches */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="text-slate-400 font-medium">Suggestions:</span>
            {SUGGESTED_SEARCHES.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => {
                  setQ(sug);
                  if (user) {
                    setTimeout(() => fetchJobs(), 50);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] transition-colors cursor-pointer"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Anti-Scam / Trust Guarantee Banner */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <strong className="font-bold">Saarvi Trust &amp; Anti-Scam Policy:</strong>{" "}
              Saarvi surfaces real job sources. Always apply directly on official employer portals. Never pay money for job offers or application forms.
            </div>
          </div>
          <Link
            href="/privacy"
            className="text-emerald-700 font-semibold hover:underline shrink-0"
          >
            Learn about safety
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* UNREGISTERED / GUEST VISITOR EXPERIENCE                                   */}
        {/* ========================================================================= */}
        {!user && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Opportunity Workspace Showcase Banner */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xs space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Member-Exclusive Intelligence
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Your Saarvi Opportunity Workspace
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Find opportunities that match your skills, experience, location, and career goals.
                  Create your free account to run live searches, save roles, track applications, and view transparent ATS scores.
                </p>
              </div>

              {/* 6 Core Value Propositions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center font-bold shadow-2xs">
                    <Search className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Search real opportunities</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Access genuine, verified jobs and internships vetted by Saarvi administrators. No fake listings or outdated deadlines.
                  </p>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-600 flex items-center justify-center font-bold shadow-2xs">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Save opportunities</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bookmark interesting roles with one click and organize your personal shortlist in your private workspace.
                  </p>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center font-bold shadow-2xs">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Track applications</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Follow your journey through Applied, Assessment, Interview, and Offer stages in your local-first tracker.
                  </p>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center font-bold shadow-2xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Match opportunities with your resume</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Transparent 6-factor ATS scoring directly compares requirements with your resume skills and identifies missing gaps.
                  </p>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-600 flex items-center justify-center font-bold shadow-2xs">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Track deadlines</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Automated urgency countdowns and calendar synchronizations ensure you never miss application cutoff dates.
                  </p>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Manage your career journey</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Integrated cover letters, mock interviews, and academic schedule conflict resolution all in one unified platform.
                  </p>
                </div>
              </div>

              {/* Guest CTAs */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    saveSearchIntent({ q, location, experience, remote, employmentType, sortBy });
                    setAuthGateOpen(true);
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Create account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveSearchIntent({ q, location, experience, remote, employmentType, sortBy });
                    setAuthGateOpen(true);
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-xl transition border border-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <span>Log in</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* AUTHENTICATED USER EXPERIENCE                                             */}
        {/* ========================================================================= */}
        {user && (
          <div className="space-y-6">
            {/* Tabs & Filter Header */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                {/* Tabs: Category & Verification Tiers */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Category: All / Jobs / Internships */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        setEmploymentType("all");
                        fetchJobs(false, { employmentType: "all" });
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        employmentType === "all"
                          ? "bg-white text-blue-600 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmploymentType("full-time");
                        fetchJobs(false, { employmentType: "full-time" });
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        employmentType === "full-time"
                          ? "bg-white text-blue-600 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Jobs
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmploymentType("internship");
                        fetchJobs(false, { employmentType: "internship" });
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        employmentType === "internship"
                          ? "bg-white text-purple-600 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Internships
                    </button>
                  </div>

                  {/* Verification Tier: All / Saarvi Verified / Source Discoveries */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTier("all");
                        fetchJobs(false, { tier: "all" });
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        selectedTier === "all"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All ({jobs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTier("verified");
                        fetchJobs(false, { tier: "verified" });
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        selectedTier === "verified"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Saarvi Verified ({verifiedCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTier("source");
                        fetchJobs(false, { tier: "source" });
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        selectedTier === "source"
                          ? "bg-white text-blue-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>Source Discoveries ({sourceDiscoveryCount})</span>
                    </button>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  >
                    Clear filters
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchJobs(true)}
                    disabled={loading}
                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3.5 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>Search</span>
                  </button>
                </div>
              </div>

              {/* Secondary Filter Dropdowns */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Work Mode */}
                  <select
                    value={remote}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRemote(val);
                      fetchJobs(false, { remote: val });
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">All Work Modes</option>
                    <option value="remote">Remote Only</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>

                  {/* Experience */}
                  <select
                    value={experience}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExperience(val);
                      fetchJobs(false, { experience: val });
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">All Experience Levels</option>
                    <option value="fresher">Fresher Roles</option>
                    <option value="entry-level">Entry-Level (0-2 yrs)</option>
                    <option value="mid-level">Mid-Level (2-5 yrs)</option>
                    <option value="senior">Senior (5+ yrs)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      const val = e.target.value as JobSortOption;
                      setSortBy(val);
                      fetchJobs(false, { sortBy: val });
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden cursor-pointer"
                  >
                    <option value="relevant">Most Relevant</option>
                    <option value="newest">Newest</option>
                    <option value="deadline_soon">Deadline Soon</option>
                    {candidateProfile && <option value="match_score">Best Profile Match</option>}
                  </select>
                </div>
              </div>
            </div>

            {/* Profile Match Banner when profile is absent */}
            {!candidateProfile && (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <strong>Want personalized match scores?</strong> Create your Saarvi Career Profile or upload your resume to see transparent skill-gap analysis for every role.
                  </div>
                </div>
                <Link
                  href="/student/resume"
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shrink-0 text-center"
                >
                  Create Profile
                </Link>
              </div>
            )}

            {/* Stale Cache Notice */}
            {staleFallback && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                <span>Listing provider temporarily unavailable. Showing verified cached results.</span>
                <button onClick={() => fetchJobs(true)} className="font-semibold underline cursor-pointer">
                  Retry
                </button>
              </div>
            )}

            {/* Job Listings Grid / Feed */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 animate-pulse">
                    <div className="h-5 w-3/4 bg-slate-200 rounded" />
                    <div className="h-4 w-1/2 bg-slate-200 rounded" />
                    <div className="h-16 w-full bg-slate-100 rounded" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-slate-200 rounded" />
                      <div className="h-6 w-20 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center p-12 bg-white border border-slate-200 rounded-3xl space-y-3">
                <Briefcase className="w-10 h-10 text-slate-400 mx-auto" />
                {/* CORRECT EMPTY STATE: distinguish filter-mismatch from truly-empty */}
                {(() => {
                  const hasActiveFilters = q || location || employmentType !== "all" || remote !== "all" || experience !== "all";
                  const hasLiveJobs = liveCount !== null && liveCount > 0;

                  if (hasActiveFilters) {
                    // Filters are set but returned no results
                    return (
                      <>
                        <h3 className="text-base font-bold text-slate-900">
                          No opportunities match your current filters
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {hasLiveJobs
                            ? `There are ${liveCount} live opportunities available. Try broadening your search or clearing filters.`
                            : "Try a broader search query or remove some filters to see all live opportunities."}
                        </p>
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                        >
                          Clear Filters & Show All Live Opportunities
                        </button>
                      </>
                    );
                  }

                  if (hasLiveJobs) {
                    // Live jobs exist but none match (shouldn’t happen without filters, but defensive)
                    return (
                      <>
                        <h3 className="text-base font-bold text-slate-900">
                          No opportunities available for this search
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Try a different keyword or adjust your filters.
                        </p>
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </>
                    );
                  }

                  // Truly no live opportunities — liveCount = 0 or unknown
                  return (
                    <>
                      <h3 className="text-base font-bold text-slate-900">
                        No live opportunities are currently available
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Our team actively discovers, verifies, and publishes campus and fresher opportunities continuously. Check back soon!
                      </p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Selected Tier: ALL -> Show Tier A Verified first, then Tier B Source Discoveries */}
                {selectedTier === "all" ? (
                  <>
                    {/* Tier A: Saarvi Verified Opportunities */}
                    {verifiedJobs.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-base sm:text-lg font-bold text-slate-900">
                              Saarvi Verified Opportunities
                            </h2>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              {verifiedJobs.length} {verifiedJobs.length === 1 ? "Role" : "Roles"}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 hidden sm:inline">
                            Admin-reviewed & published • Canonical database records
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {verifiedJobs.map((job) => renderJobCard(job))}
                        </div>
                      </div>
                    )}

                    {/* Tier B: Live Source Discoveries */}
                    {sourceJobs.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-slate-200/80">
                        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-amber-900">
                              <Layers className="w-4 h-4 text-amber-600" />
                              <span>Live Source Discoveries ({sourceJobs.length})</span>
                            </div>
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
                              External Sources
                            </span>
                          </div>
                          <p className="text-amber-800 leading-relaxed pt-0.5">
                            These opportunities were discovered from configured external job sources (e.g. LinkedIn, Indeed, Google Jobs) in response to your search query. Saarvi has not individually verified these listings. Always apply directly through the employer&apos;s official portal.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {sourceJobs.map((job) => renderJobCard(job))}
                        </div>
                      </div>
                    )}
                  </>
                ) : selectedTier === "verified" ? (
                  /* Selected Tier: Verified only */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          Saarvi Verified Opportunities ({verifiedJobs.length})
                        </h2>
                      </div>
                    </div>
                    {verifiedJobs.length === 0 ? (
                      <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No Saarvi Verified roles match your search.</p>
                        <button
                          type="button"
                          onClick={() => setSelectedTier("all")}
                          className="text-xs text-blue-600 font-bold hover:underline"
                        >
                          View all opportunities
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {verifiedJobs.map((job) => renderJobCard(job))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected Tier: Source Discoveries only */
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <Layers className="w-4 h-4 text-amber-600" />
                        <span>External Source Discoveries ({sourceJobs.length})</span>
                      </div>
                      <p className="text-amber-800 leading-relaxed pt-0.5">
                        These opportunities were discovered from configured external job sources. Saarvi has not individually verified these listings.
                      </p>
                    </div>
                    {sourceJobs.length === 0 ? (
                      <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No external source discoveries found.</p>
                        <button
                          type="button"
                          onClick={() => setSelectedTier("all")}
                          className="text-xs text-blue-600 font-bold hover:underline"
                        >
                          View all opportunities
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sourceJobs.map((job) => renderJobCard(job))}
                      </div>
                    )}
                  </div>
                )}

                {/* Compact Safety Notice (Prompt Requirement 30) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Saarvi Trust & Safety:</strong> Apply through the official employer/source whenever possible. Saarvi does not charge applicants for access to job listings.
                    </span>
                  </div>
                  <Link href="/contact" className="text-blue-600 font-bold hover:underline shrink-0 text-right">
                    Report Concerns
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* AUTHENTICATION GATE MODAL                                                 */}
      {/* ========================================================================= */}
      <JobsAuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        returnUrl={returnUrl}
        searchSummary={{
          role: q,
          location,
          experience: experience !== "all" ? experience : undefined,
        }}
      />

      {/* ========================================================================= */}
      {/* MATCH EXPLAINABILITY MODAL                                                */}
      {/* ========================================================================= */}
      {selectedMatchJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900">Explainable Match Breakdown</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatchJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-slate-800">{selectedMatchJob.job.title}</p>
                <p className="text-slate-500">{selectedMatchJob.job.companyName}</p>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
                <span className="font-bold text-blue-900">Overall ATS Match Score</span>
                <span className="text-base font-extrabold text-blue-600">
                  {selectedMatchJob.match.matchScore}%
                </span>
              </div>

              {/* Matched Skills */}
              <div>
                <span className="font-bold text-slate-700 block mb-1">Matched Skills:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedMatchJob.match.matchedSkills.length > 0 ? (
                    selectedMatchJob.match.matchedSkills.map((sk) => (
                      <span key={sk} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">None matched</span>
                  )}
                </div>
              </div>

              {/* Missing Skills */}
              <div>
                <span className="font-bold text-slate-700 block mb-1">Missing Skills (Gap Analysis):</span>
                <div className="flex flex-wrap gap-1">
                  {selectedMatchJob.match.missingSkills.length > 0 ? (
                    selectedMatchJob.match.missingSkills.map((sk) => (
                      <span key={sk} className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                        {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-emerald-600 font-medium">You have all listed technical skills!</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMatchJob(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-xs rounded-xl text-slate-700 transition cursor-pointer"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT LISTING MODAL                                                      */}
      {/* ========================================================================= */}
      {reportingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-600" />
                Report Suspicious Listing
              </h3>
              <button
                type="button"
                onClick={() => setReportingJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <p className="text-slate-600">
                Reporting: <strong className="text-slate-900">{reportingJob.title}</strong> at {reportingJob.companyName}
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for report</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as JobReportReason)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-hidden"
                >
                  <option value="EXPIRED">Expired or Closed Listing</option>
                  <option value="MISLEADING_INFO">Incorrect or Misleading Information</option>
                  <option value="BROKEN_LINK">Broken Apply Link</option>
                  <option value="DUPLICATE">Duplicate Listing</option>
                  <option value="SUSPICIOUS">Suspicious Listing or Fraud/Fee</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Additional notes (optional)</label>
                <textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Provide any details to help our safety team investigate..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportingJob(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={reportingSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
              >
                {reportingSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* JOB ALERT MODAL                                                           */}
      {/* ========================================================================= */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                Create Real-Time Job Alert
              </h3>
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <p className="text-slate-600">
                Receive notifications when new verified roles matching your criteria are published.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keywords</label>
                <input
                  type="text"
                  value={q || "Software Engineer"}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlertFrequency("daily")}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      alertFrequency === "daily"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Daily Digest
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertFrequency("weekly")}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      alertFrequency === "weekly"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Weekly Summary
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAlert}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-sm text-slate-500">Loading...</div>}>
      <JobsContent />
    </Suspense>
  );
}
