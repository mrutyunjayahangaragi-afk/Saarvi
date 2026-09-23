"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import type { JobItem, JobSearchParams, JobSortOption, JobReportReason } from "@/lib/jobs/types";
import { calculateJobMatch, extractCandidateContext } from "@/lib/jobs/matching";
import { careerService } from "@/lib/services/careerService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import {
  Briefcase,
  Search,
  MapPin,
  Calendar,
  Clock,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Bookmark,
  Share2,
  AlertTriangle,
  Filter,
  CheckCircle2,
  X,
  Plus,
  ChevronRight,
  TrendingUp,
  Layers,
  ArrowRight,
  Flag,
  Bell,
  RefreshCw,
} from "lucide-react";

const SUGGESTED_SEARCHES = [
  "React developer fresher Bengaluru",
  "Java internship 2026 students",
  "Software engineer fresher India",
  "AI ML internship remote",
  "Full stack developer entry level",
  "Python developer remote",
];

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search Query & Filters
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [employmentType, setEmploymentType] = useState(searchParams.get("employmentType") || "all");
  const [remote, setRemote] = useState(searchParams.get("remote") || "all");
  const [experience, setExperience] = useState(searchParams.get("experience") || "all");
  const [sortBy, setSortBy] = useState<JobSortOption>((searchParams.get("sortBy") as JobSortOption) || "relevant");

  // State
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [staleFallback, setStaleFallback] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [candidateProfile, setCandidateProfile] = useState<any | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Load candidate profile locally
  useEffect(() => {
    async function loadProfile() {
      try {
        const prof = await careerService.getOrCreateProfile();
        if (prof && prof.skills && prof.skills.length > 0) {
          setCandidateProfile(prof);
        }
      } catch {}
    }
    loadProfile();

    // Load recent searches
    try {
      const saved = localStorage.getItem("saarvi_recent_job_searches");
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5));
    } catch {}

    // Load saved job IDs from local tracker
    async function loadSaved() {
      try {
        const apps = await academicStorage.getAllJobApplications();
        const ids = new Set(apps.map((a) => a.id));
        setSavedJobIds(ids);
      } catch {}
    }
    loadSaved();
  }, []);

  // Fetch Jobs from Server API
  const fetchJobs = useCallback(async (isRefresh = false) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (location.trim()) params.set("location", location.trim());
    if (employmentType !== "all") params.set("employmentType", employmentType);
    if (remote !== "all") params.set("remote", remote);
    if (experience !== "all") params.set("experience", experience);
    if (sortBy !== "relevant") params.set("sortBy", sortBy);
    if (isRefresh) params.set("t", String(Date.now()));

    try {
      const res = await fetch(`/api/jobs/search?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setJobs(data.items || []);
      setIsCached(Boolean(data.cached));
      setStaleFallback(Boolean(data.staleFallback));

      // Record recent search
      if (q.trim()) {
        setRecentSearches((prev) => {
          const updated = Array.from(new Set([q.trim(), ...prev])).slice(0, 5);
          try {
            localStorage.setItem("saarvi_recent_job_searches", JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } catch (err: any) {
      setError("Job search is temporarily unavailable. Please retry or adjust your search.");
    } finally {
      setLoading(false);
    }
  }, [q, location, employmentType, remote, experience, sortBy]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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
    try {
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
      setTimeout(() => setNotice(null), 3000);
    } catch {
      setNotice("Could not save job locally.");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  // Submit Report
  const handleSubmitReport = async () => {
    if (!reportingJob) return;
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
    try {
      const res = await fetch("/api/jobs/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "local_student",
          title: q || "Software Engineer Opportunities",
          keywords: q ? [q] : ["Software Engineer"],
          location: location || undefined,
          employmentType: employmentType !== "all" ? employmentType : undefined,
          frequency: alertFrequency,
        }),
      });

      if (res.ok) {
        setNotice(`Job alert created for "${q || "Software Engineer"}". You will receive updates.`);
        setShowAlertModal(false);
      }
    } catch {
      setNotice("Could not create alert.");
    } finally {
      setTimeout(() => setNotice(null), 3500);
    }
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
                Jobs &amp; Internships Engine
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Discover verified jobs, fresher positions, and campus internships. Compare with your skills, apply directly on official employer websites, and track your applications.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAlertModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-colors cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Create Job Alert</span>
              </button>
              <Link
                href="/student/applications"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
              >
                <span>My Tracker</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Search Inputs Bar */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-2 text-slate-800">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/80 w-full">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchJobs()}
                placeholder="What job or internship are you looking for? (e.g. React developer fresher)"
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 focus:outline-hidden"
              />
              {q && (
                <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="w-full md:w-64 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/80">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchJobs()}
                placeholder="Location (e.g. Bengaluru, Remote)"
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 focus:outline-hidden"
              />
            </div>

            <button
              onClick={() => fetchJobs(true)}
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
                  <span>Search Jobs</span>
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
                onClick={() => {
                  setQ(sug);
                  setTimeout(() => fetchJobs(), 50);
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

        {/* Filter Pills & Sorting Header */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category / Type */}
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Opportunities</option>
              <option value="full-time">Full-Time Jobs</option>
              <option value="internship">Internships Only</option>
              <option value="contract">Contract / Temporary</option>
            </select>

            {/* Work Mode */}
            <select
              value={remote}
              onChange={(e) => setRemote(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Work Modes</option>
              <option value="remote">Remote Only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>

            {/* Experience */}
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Experience Levels</option>
              <option value="fresher">Fresher Roles</option>
              <option value="entry-level">Entry-Level (0-2 yrs)</option>
              <option value="mid-level">Mid-Level</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as JobSortOption)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden"
            >
              <option value="relevant">Most Relevant</option>
              <option value="newest">Newest</option>
              <option value="deadline_soon">Deadline Soon</option>
              {candidateProfile && <option value="match_score">Best Profile Match</option>}
            </select>
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

        {/* Stale Cache Notice if external provider is degraded */}
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
            <h3 className="text-base font-bold text-slate-900">No matching jobs found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try a broader search query, remove some filters, or search for fresher roles in another location.
            </p>
            <button
              onClick={() => {
                setQ("");
                setLocation("");
                setEmploymentType("all");
                setRemote("all");
                setExperience("all");
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => {
              const match = matchScoresMap.get(job.id);
              const isSaved = savedJobIds.has(job.id);

              return (
                <div
                  key={job.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
                >
                  <div>
                    {/* Top Row: Title, Match Pill, Save */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
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

                      <div className="flex items-center gap-1 shrink-0">
                        {match && (
                          <button
                            onClick={() => setSelectedMatchJob({ job, match })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                            title="Click to view explainable match breakdown"
                          >
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>{match.matchScore}% Match</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleSaveJob(job)}
                          className={`p-2 rounded-xl transition ${
                            isSaved
                              ? "text-blue-600 bg-blue-50"
                              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                          }`}
                          title={isSaved ? "Saved in Tracker" : "Save Job"}
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
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-700">{job.salary}</span>
                      </div>
                      {job.applicationDeadline !== "Deadline not provided" && (
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
                          <span className="text-[10px] text-slate-400 self-center">
                            +{job.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400 truncate">
                      Source: {job.sourceName}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReportingJob(job)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        title="Report this listing"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>

                      <Link
                        href={`/jobs/${job.id}`}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      >
                        Details
                      </Link>

                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition"
                      >
                        <span>Apply</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Match Breakdown Modal */}
      {selectedMatchJob && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase text-blue-600">Explainable Match Breakdown</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedMatchJob.job.title}</h3>
                <p className="text-xs text-slate-500">{selectedMatchJob.job.companyName}</p>
              </div>
              <button onClick={() => setSelectedMatchJob(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-2xl space-y-1">
              <span className="text-xs text-blue-600 font-medium">Composite Compatibility Score</span>
              <div className="text-3xl font-extrabold text-blue-700">
                {selectedMatchJob.match.matchScore}%
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <strong className="font-bold text-slate-800">Why this matches your profile:</strong>
              <ul className="space-y-1">
                {selectedMatchJob.match.matchingReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {selectedMatchJob.match.missingSkills.length > 0 && (
              <div className="space-y-2 text-xs">
                <strong className="font-bold text-slate-800">Identified Skill Gaps:</strong>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMatchJob.match.missingSkills.map((sk) => (
                    <span key={sk} className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      • {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedMatchJob(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Report Listing Modal */}
      {reportingJob && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Report Listing</h3>
                <p className="text-xs text-slate-500">{reportingJob.title} at {reportingJob.companyName}</p>
              </div>
              <button onClick={() => setReportingJob(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-slate-700">Reason for reporting</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as JobReportReason)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:outline-hidden"
              >
                <option value="FAKE_JOB">Fake or fraudulent job</option>
                <option value="PAYMENT_REQUIRED">Employer asked for payment/money to apply</option>
                <option value="BROKEN_LINK">Application link is broken</option>
                <option value="EXPIRED">Listing is already closed/expired</option>
                <option value="MISLEADING_INFO">Misleading role or salary details</option>
                <option value="WRONG_COMPANY">Incorrect company attribution</option>
                <option value="SUSPICIOUS">Suspicious phishing behavior</option>
                <option value="OTHER">Other issue</option>
              </select>

              <label className="block font-semibold text-slate-700">Additional Details (Optional)</label>
              <textarea
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Describe the issue with this listing..."
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setReportingJob(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={reportingSubmitting}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                {reportingSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Job Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Job Alert</h3>
                <p className="text-xs text-slate-500">Get notified when new matching opportunities are discovered.</p>
              </div>
              <button onClick={() => setShowAlertModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
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
                <select
                  value={alertFrequency}
                  onChange={(e) => setAlertFrequency(e.target.value as "daily" | "weekly")}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:outline-hidden"
                >
                  <option value="daily">Daily digest</option>
                  <option value="weekly">Weekly digest</option>
                </select>
              </div>

              <p className="text-[11px] text-slate-500">
                Alerts are delivered to your Saarvi Notification Center and registered email. You can manage subscriptions anytime.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowAlertModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAlert}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
              >
                Activate Alert
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
