"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Opportunity,
  OpportunityStatus,
  SourceHealth,
  DiscoveryConfig,
  PreviewOpportunity,
} from "@/lib/opportunities/types";
import {
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Edit2,
  Settings,
  Check,
  X,
  Play,
  ArrowRight,
  Filter,
  Flag,
  Bell,
  ShieldAlert,
  Plus,
  Compass,
  GraduationCap,
  Layers,
  ChevronRight,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

type AdminTab =
  | "OVERVIEW"
  | "DISCOVER"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "EXPIRED"
  | "SOURCES"
  | "CONFIG"
  | "REPORTS"
  | "ANALYTICS"
  | "AUDIT";

export default function AdminCareerPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Core Data States
  const [items, setItems] = useState<Opportunity[]>([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    paused: 0,
    draft: 0,
    total: 0,
  });
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Search & Filter in lists
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "ALL">("ALL");

  // Manual Add Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualCategory, setManualCategory] = useState<"job" | "internship">("job");
  const [manualForm, setManualForm] = useState({
    title: "",
    companyName: "",
    companyLogo: "",
    description: "",
    location: "Bengaluru, India",
    remoteType: "onsite" as "remote" | "hybrid" | "onsite",
    employmentType: "full-time" as "full-time" | "part-time" | "internship" | "contract",
    experienceLevel: "fresher" as "fresher" | "entry-level" | "mid-level" | "senior",
    skills: "React, TypeScript, Node.js",
    salaryMin: "",
    salaryMax: "",
    currency: "₹",
    applicationDeadline: "",
    sourceUrl: "",
    applyUrl: "",
    contactEmail: "",
    tags: "engineering, web",
    status: "APPROVED" as OpportunityStatus,
  });

  // Discovery Search & Preview State
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [discoveryIsInternship, setDiscoveryIsInternship] = useState(false);
  const [discoverySearching, setDiscoverySearching] = useState(false);
  const [discoveryImporting, setDiscoveryImporting] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState({
    keyword: "React developer",
    location: "Bengaluru",
    country: "India",
    jobType: "full-time",
    experience: "fresher",
    remote: false,
    source: "google_jobs",
    limit: 20,
  });
  const [previewResults, setPreviewResults] = useState<PreviewOpportunity[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());
  const [discoverySummary, setDiscoverySummary] = useState<{
    found: number;
    valid: number;
    invalid: number;
    duplicates: number;
    imported?: number;
  } | null>(null);

  // Confirmation Modal for Publishing
  const [confirmPublishOpp, setConfirmPublishOpp] = useState<Opportunity | null>(null);

  // Edit Opportunity Modal State
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppsRes, analyticsRes, jobsModRes] = await Promise.all([
        fetch(
          `/api/admin/career/opportunities?status=${
            statusFilter === "ALL" ? "" : statusFilter
          }&search=${encodeURIComponent(searchQuery)}`
        ),
        fetch("/api/admin/career/analytics"),
        fetch("/api/admin/career/jobs"),
      ]);

      if (oppsRes.ok) {
        const oppsData = await oppsRes.json();
        setItems(oppsData.items || []);
        if (oppsData.counts) setCounts(oppsData.counts);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        if (analyticsData.analytics) {
          setSources(analyticsData.analytics.sources || []);
          setConfig(analyticsData.analytics.config || null);
          setRecentLogs(analyticsData.analytics.recentAuditLogs || []);
        }
      }

      if (jobsModRes.ok) {
        const jobsModData = await jobsModRes.json();
        if (jobsModData.reports) setReports(jobsModData.reports);
        if (jobsModData.alerts) setAlerts(jobsModData.alerts);
      }
    } catch (err) {
      console.error("Failed to load admin career data:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", notes: "Approved & Published by Saarvi Admin" }),
      });
      if (res.ok) {
        setNotice("Opportunity approved and published to public /jobs board.");
        setConfirmPublishOpp(null);
        await loadData();
      }
    } catch {
      setNotice("Failed to approve opportunity.");
    }
  };

  const handleReject = async (id: string, reason = "Listing rejected during admin review") => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", reason }),
      });
      if (res.ok) {
        setNotice("Opportunity marked as REJECTED.");
        await loadData();
      }
    } catch {
      setNotice("Failed to reject opportunity.");
    }
  };

  const handleExpire = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXPIRE" }),
      });
      if (res.ok) {
        setNotice("Opportunity marked as EXPIRED.");
        await loadData();
      }
    } catch {
      setNotice("Failed to expire opportunity.");
    }
  };

  // Run Discovery Search (Preview only — does NOT auto-publish!)
  const handleExecuteDiscovery = async () => {
    setDiscoverySearching(true);
    setPreviewResults([]);
    setSelectedPreviewIds(new Set());
    setDiscoverySummary(null);

    try {
      const res = await fetch("/api/admin/career/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...discoveryQuery,
          isInternship: discoveryIsInternship,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewResults(data.results || []);
        setDiscoverySummary(data.summary || null);
        // Pre-select all valid items
        const validIds = new Set<string>();
        data.results.forEach((r: PreviewOpportunity) => {
          if (r.validationStatus !== "INVALID" && r.duplicateStatus === "NEW") {
            validIds.add(r.id);
          }
        });
        setSelectedPreviewIds(validIds);
      } else {
        setNotice(`Discovery search error: ${data.error || "Failed to search"}`);
      }
    } catch (err: any) {
      setNotice(`Discovery search failed: ${err.message}`);
    } finally {
      setDiscoverySearching(false);
    }
  };

  // Bulk Import Selected Preview Items to PENDING_REVIEW
  const handleBulkImport = async () => {
    if (selectedPreviewIds.size === 0) {
      setNotice("Please select at least one opportunity to import.");
      return;
    }

    setDiscoveryImporting(true);
    try {
      const itemsToImport = previewResults.filter((r) => selectedPreviewIds.has(r.id));
      const res = await fetch("/api/admin/career/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BULK_IMPORT",
          items: itemsToImport,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice(
          `Successfully imported ${data.summary?.imported || 0} opportunities into Pending Review!`
        );
        setDiscoverySummary((prev) => (prev ? { ...prev, imported: data.summary?.imported } : null));
        await loadData();
      } else {
        setNotice(`Import failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setNotice(`Import error: ${err.message}`);
    } finally {
      setDiscoveryImporting(false);
    }
  };

  // Manual Creation Submit
  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const skillsArray = manualForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const tagsArray = manualForm.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: manualForm.title,
        companyName: manualForm.companyName,
        companyLogo: manualForm.companyLogo || undefined,
        description: manualForm.description,
        location: manualForm.location,
        remoteType: manualForm.remoteType,
        employmentType: manualForm.employmentType,
        experienceLevel: manualForm.experienceLevel,
        skills: skillsArray,
        salary:
          manualForm.salaryMin || manualForm.salaryMax
            ? {
                min: manualForm.salaryMin ? parseInt(manualForm.salaryMin) : undefined,
                max: manualForm.salaryMax ? parseInt(manualForm.salaryMax) : undefined,
                currency: manualForm.currency,
              }
            : null,
        applicationDeadline: manualForm.applicationDeadline || null,
        sourceUrl: manualForm.sourceUrl || manualForm.applyUrl,
        applyUrl: manualForm.applyUrl,
        contactEmail: manualForm.contactEmail || undefined,
        category: manualCategory,
        tags: tagsArray,
        status: manualForm.status,
      };

      const res = await fetch("/api/admin/career/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MANUAL_ADD",
          input: payload,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice(`Opportunity "${manualForm.title}" created successfully (${manualForm.status})!`);
        setManualModalOpen(false);
        // Reset form
        setManualForm({
          title: "",
          companyName: "",
          companyLogo: "",
          description: "",
          location: "Bengaluru, India",
          remoteType: "onsite",
          employmentType: "full-time",
          experienceLevel: "fresher",
          skills: "React, TypeScript, Node.js",
          salaryMin: "",
          salaryMax: "",
          currency: "₹",
          applicationDeadline: "",
          sourceUrl: "",
          applyUrl: "",
          contactEmail: "",
          tags: "engineering, web",
          status: "APPROVED",
        });
        await loadData();
      } else {
        setNotice(`Manual creation failed: ${data.error || "Validation error"}`);
      }
    } catch (err: any) {
      setNotice(`Error adding opportunity: ${err.message}`);
    }
  };

  const openDiscoverModal = (isInternship = false) => {
    setDiscoveryIsInternship(isInternship);
    if (isInternship) {
      setDiscoveryQuery({
        keyword: "software engineering internship",
        location: "Bengaluru",
        country: "India",
        jobType: "internship",
        experience: "fresher",
        remote: false,
        source: "google_jobs",
        limit: 20,
      });
    } else {
      setDiscoveryQuery({
        keyword: "React developer",
        location: "Bengaluru",
        country: "India",
        jobType: "full-time",
        experience: "fresher",
        remote: false,
        source: "google_jobs",
        limit: 20,
      });
    }
    setPreviewResults([]);
    setSelectedPreviewIds(new Set());
    setDiscoverySummary(null);
    setDiscoveryModalOpen(true);
  };

  const openManualModal = (category: "job" | "internship") => {
    setManualCategory(category);
    setManualForm((prev) => ({
      ...prev,
      employmentType: category === "internship" ? "internship" : "full-time",
    }));
    setManualModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Platform Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <Link href="/admin" className="hover:text-blue-600">
              Admin Control Center
            </Link>
            <span>/</span>
            <span className="text-blue-600">Jobs & Internships Engine</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Jobs & Internships Command Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Admin-controlled discovery, preview verification, approval pipeline, and published catalog.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openDiscoverModal(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Jobs</span>
          </button>

          <button
            type="button"
            onClick={() => openDiscoverModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Discover Internships</span>
          </button>

          <button
            type="button"
            onClick={() => openManualModal("job")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Add Job Directly</span>
          </button>

          <button
            type="button"
            onClick={() => openManualModal("internship")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <Plus className="w-4 h-4 text-purple-600" />
            <span>Add Internship Directly</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-blue-500 hover:text-blue-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => {
            setActiveTab("OVERVIEW");
            setStatusFilter("ALL");
          }}
          className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Catalog
          </span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block font-mono">
            {counts.total}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">All records</span>
        </div>

        <div
          onClick={() => {
            setActiveTab("PENDING_REVIEW");
            setStatusFilter("PENDING_REVIEW");
          }}
          className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl shadow-xs cursor-pointer hover:border-amber-300 transition"
        >
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Pending Review
          </span>
          <span className="text-2xl font-extrabold text-amber-900 mt-1 block font-mono">
            {counts.pending}
          </span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Awaiting approval</span>
        </div>

        <div
          onClick={() => {
            setActiveTab("PUBLISHED");
            setStatusFilter("APPROVED");
          }}
          className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl shadow-xs cursor-pointer hover:border-emerald-300 transition"
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Published Live
          </span>
          <span className="text-2xl font-extrabold text-emerald-900 mt-1 block font-mono">
            {counts.approved}
          </span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Live on /jobs</span>
        </div>

        <div
          onClick={() => {
            setActiveTab("REJECTED");
            setStatusFilter("REJECTED");
          }}
          className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl shadow-xs cursor-pointer hover:border-rose-300 transition"
        >
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Rejected
          </span>
          <span className="text-2xl font-extrabold text-rose-900 mt-1 block font-mono">
            {counts.rejected}
          </span>
          <span className="text-[10px] text-rose-600 mt-0.5 block">Spam / discarded</span>
        </div>

        <div
          onClick={() => {
            setActiveTab("EXPIRED");
            setStatusFilter("EXPIRED");
          }}
          className="p-4 bg-slate-100 border border-slate-200 rounded-2xl shadow-xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Expired
          </span>
          <span className="text-2xl font-extrabold text-slate-700 mt-1 block font-mono">
            {counts.expired}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Deadlines passed</span>
        </div>

        <div
          onClick={() => setActiveTab("REPORTS")}
          className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl shadow-xs cursor-pointer hover:border-blue-300 transition"
        >
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
            Scam Reports
          </span>
          <span className="text-2xl font-extrabold text-blue-900 mt-1 block font-mono">
            {reports.filter((r) => r.status === "PENDING").length}
          </span>
          <span className="text-[10px] text-blue-600 mt-0.5 block">Student alerts</span>
        </div>
      </div>

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none text-xs font-bold">
        {[
          { id: "OVERVIEW", label: "Overview", filter: "ALL" },
          { id: "PENDING_REVIEW", label: `Pending Review (${counts.pending})`, filter: "PENDING_REVIEW" },
          { id: "PUBLISHED", label: `Published (${counts.approved})`, filter: "APPROVED" },
          { id: "REJECTED", label: `Rejected (${counts.rejected})`, filter: "REJECTED" },
          { id: "EXPIRED", label: `Expired (${counts.expired})`, filter: "EXPIRED" },
          { id: "SOURCES", label: "Sources & Health", filter: "ALL" },
          { id: "CONFIG", label: "Search Configuration", filter: "ALL" },
          { id: "REPORTS", label: `Reports (${reports.filter((r) => r.status === "PENDING").length})`, filter: "ALL" },
          { id: "AUDIT", label: "Audit Log", filter: "ALL" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id as AdminTab);
              setStatusFilter(tab.filter as any);
            }}
            className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview & Quick Actions */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Quick Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-gradient-to-br from-blue-50 to-white border border-blue-200/80 rounded-2xl shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">External SerpApi Discovery</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Search Google Jobs and Google Search via server-side SerpApi. Review preview results, validate URLs, and import to Pending Review.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => openDiscoverModal(false)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Start Discovery Search
                </button>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-amber-50 to-white border border-amber-200/80 rounded-2xl shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Review Approval Pipeline</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {counts.pending} opportunities awaiting review. Only approved listings are published to the public /jobs board.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("PENDING_REVIEW");
                    setStatusFilter("PENDING_REVIEW");
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Open Pending Queue
                </button>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-purple-50 to-white border border-purple-200/80 rounded-2xl shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Manual Admin Listing</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Add official company listings, campus placement announcements, or verified internship notices directly into Saarvi.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => openManualModal("job")}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  + Add Direct Listing
                </button>
              </div>
            </div>
          </div>

          {/* Source Status & Telemetry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Configured Search Discovery Providers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sources.map((src) => (
                <div key={src.sourceId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{src.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        src.status === "HEALTHY"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {src.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px]">Discovered</span>
                      <p className="font-bold text-slate-800">{src.recordsDiscoveredTotal}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Rate Limits</span>
                      <p className="font-bold text-slate-800">{src.rateLimit429Count}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Latency</span>
                      <p className="font-bold text-slate-800">{src.responseTimeMs || 0}ms</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Opportunity Lists (Pending Review, Published, Rejected, Expired) */}
      {(activeTab === "PENDING_REVIEW" ||
        activeTab === "PUBLISHED" ||
        activeTab === "REJECTED" ||
        activeTab === "EXPIRED") && (
        <div className="space-y-4">
          {/* List Search Bar */}
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <Search className="w-4 h-4 text-slate-400 ml-1" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search listings by title, company name, skills, or location..."
              className="w-full text-xs sm:text-sm bg-transparent border-none focus:outline-hidden"
            />
          </div>

          {/* Listings Cards */}
          <div className="space-y-3">
            {items.map((opp) => (
              <div
                key={opp.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {opp.companyName}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {opp.category}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {opp.source.replace(/_/g, " ")}
                      </span>
                      {opp.status === "APPROVED" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Admin Verified
                        </span>
                      )}
                      {opp.status === "PENDING_REVIEW" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Pending Review
                        </span>
                      )}
                      {opp.status === "REJECTED" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Rejected
                        </span>
                      )}
                      {opp.status === "EXPIRED" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          Expired
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1">{opp.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {opp.location} • {opp.employmentType} • {opp.remoteType} •{" "}
                      {opp.salary ? `${opp.salary.currency || "₹"} ${opp.salary.min} - ${opp.salary.max}` : "Salary undisclosed"}
                    </p>
                  </div>

                  {/* Actions for this opportunity */}
                  <div className="flex items-center gap-2 sm:shrink-0 flex-wrap">
                    {opp.status !== "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => setConfirmPublishOpp(opp)}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Publish</span>
                      </button>
                    )}

                    {opp.status !== "REJECTED" && (
                      <button
                        type="button"
                        onClick={() => handleReject(opp.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition"
                      >
                        Reject
                      </button>
                    )}

                    {opp.status !== "EXPIRED" && (
                      <button
                        type="button"
                        onClick={() => handleExpire(opp.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                      >
                        Expire
                      </button>
                    )}

                    <a
                      href={opp.applyUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                      title="Open external application link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {opp.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <div className="flex flex-wrap gap-1.5">
                    {opp.skills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600 font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <span>Deadline: {opp.applicationDeadline || "Not provided"}</span>
                    <span>Discovered: {new Date(opp.discoveredAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-700">No opportunities in this section</p>
                <p className="text-xs text-slate-400 mt-1">Use Discover Jobs or Add Job above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Sources & Health */}
      {activeTab === "SOURCES" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">External Provider Adapters</h2>
          <div className="divide-y divide-slate-100 text-xs">
            {sources.map((src) => (
              <div key={src.sourceId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{src.name}</h3>
                  <p className="text-slate-500 mt-0.5">
                    Adapter ID: {src.sourceId} • Status: {src.status} • Circuit: {src.circuitState}
                  </p>
                  {src.lastError && <p className="text-rose-600 text-[11px] mt-1">Last Error: {src.lastError}</p>}
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800">{src.recordsDiscoveredTotal} total found</span>
                  <div className="text-[11px] text-slate-400 mt-0.5">{src.responseTimeMs || 0}ms latency</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Search Strategy Config */}
      {activeTab === "CONFIG" && config && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">Search Strategy & Auto-Discovery Profiles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="font-bold text-slate-700">Target Engineering Roles</span>
              <p className="text-slate-600">{config.roles.join(", ")}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="font-bold text-slate-700">Target Locations</span>
              <p className="text-slate-600">{config.locations.join(", ")}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="font-bold text-slate-700">Key Skills</span>
              <p className="text-slate-600">{config.skills.join(", ")}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="font-bold text-slate-700">Auto-Approve External Policy</span>
              <p className="font-semibold text-rose-600">DISABLED (Strict Admin Review Mandatory)</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Reports */}
      {activeTab === "REPORTS" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Student Scam & Integrity Reports</span>
            </h2>
          </div>
          <div className="space-y-3">
            {reports.map((rep) => (
              <div key={rep.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{rep.jobTitle || rep.jobId}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    {rep.reason}
                  </span>
                </div>
                {rep.details && <p className="text-xs text-slate-600">{rep.details}</p>}
                <div className="text-[10px] text-slate-400">Reported at: {new Date(rep.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
                Zero active scam reports.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Audit Log */}
      {activeTab === "AUDIT" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Career Engine Audit History
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {recentLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold mr-2 uppercase text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    {log.action}
                  </span>
                  <span className="text-slate-700">{log.details || log.opportunityId}</span>
                </div>
                <span className="text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DISCOVERY SEARCH & PREVIEW MODAL                                          */}
      {/* ========================================================================= */}
      {discoveryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${
                  discoveryIsInternship ? "bg-purple-600" : "bg-blue-600"
                }`}>
                  {discoveryIsInternship ? <GraduationCap className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {discoveryIsInternship ? "Discover Internships" : "Discover Jobs"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Search external sources via SerpApi. Validate & preview before importing to Pending Review.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscoveryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Form */}
            <div className="p-5 border-b border-slate-100 bg-white space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Keyword / Role
                  </label>
                  <input
                    type="text"
                    value={discoveryQuery.keyword}
                    onChange={(e) => setDiscoveryQuery({ ...discoveryQuery, keyword: e.target.value })}
                    placeholder="e.g. React developer, AI ML intern"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={discoveryQuery.location}
                    onChange={(e) => setDiscoveryQuery({ ...discoveryQuery, location: e.target.value })}
                    placeholder="e.g. Bengaluru, Hyderabad, Remote"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Source Engine
                  </label>
                  <select
                    value={discoveryQuery.source}
                    onChange={(e) => setDiscoveryQuery({ ...discoveryQuery, source: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500 bg-white"
                  >
                    <option value="google_jobs">SerpApi Google Jobs (Structured)</option>
                    <option value="google_search">SerpApi Google Search (Web)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-400">
                  External results undergo quality validation & duplicate checks before review.
                </div>
                <button
                  type="button"
                  disabled={discoverySearching}
                  onClick={handleExecuteDiscovery}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Search className={`w-3.5 h-3.5 ${discoverySearching ? "animate-spin" : ""}`} />
                  <span>{discoverySearching ? "Searching External Sources..." : "Search External Sources"}</span>
                </button>
              </div>
            </div>

            {/* Results Preview Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {discoverySummary && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-4">
                    <span>Found: <strong className="text-slate-900">{discoverySummary.found}</strong></span>
                    <span>Valid: <strong className="text-emerald-700">{discoverySummary.valid}</strong></span>
                    <span>Invalid: <strong className="text-rose-700">{discoverySummary.invalid}</strong></span>
                    <span>Duplicates: <strong className="text-amber-700">{discoverySummary.duplicates}</strong></span>
                  </div>
                  {previewResults.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allValid = new Set<string>();
                          previewResults.forEach((r) => {
                            if (r.validationStatus !== "INVALID") allValid.add(r.id);
                          });
                          setSelectedPreviewIds(allValid);
                        }}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Select all valid
                      </button>
                      <button
                        type="button"
                        disabled={discoveryImporting || selectedPreviewIds.size === 0}
                        onClick={handleBulkImport}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      >
                        {discoveryImporting
                          ? "Importing..."
                          : `Import Selected (${selectedPreviewIds.size}) to Pending Review`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {previewResults.map((item) => {
                const isSelected = selectedPreviewIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition space-y-2 ${
                      isSelected ? "bg-blue-50/50 border-blue-300" : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={item.validationStatus === "INVALID"}
                          onChange={(e) => {
                            const next = new Set(selectedPreviewIds);
                            if (e.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setSelectedPreviewIds(next);
                          }}
                          className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">{item.companyName}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.validationStatus === "VALID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.validationStatus === "WARNING"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {item.validationStatus}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.duplicateStatus === "NEW"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {item.duplicateStatus.replace("_", " ")}
                            </span>
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-1">{item.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.location} • {item.employmentType}
                          </p>
                        </div>
                      </div>

                      <a
                        href={item.applyUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="Inspect external link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    {item.validationWarnings && item.validationWarnings.length > 0 && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-200/60">
                        {item.validationWarnings.join(" • ")}
                      </div>
                    )}
                  </div>
                );
              })}

              {!discoverySearching && previewResults.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-700">No external preview results</p>
                  <p className="text-[11px] mt-1">Configure search parameters above and click Search.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANUAL ADD JOB / INTERNSHIP MODAL                                         */}
      {/* ========================================================================= */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  +
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Add {manualCategory === "internship" ? "Internship" : "Job"} Directly
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Direct administrative creation with immediate validation and audit logging.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualForm.title}
                    onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                    placeholder="e.g. Software Engineer Intern"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualForm.companyName}
                    onChange={(e) => setManualForm({ ...manualForm, companyName: e.target.value })}
                    placeholder="e.g. Infosys, TCS, Google"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Application Link (Safe URL) *
                </label>
                <input
                  type="url"
                  required
                  value={manualForm.applyUrl}
                  onChange={(e) => setManualForm({ ...manualForm, applyUrl: e.target.value })}
                  placeholder="https://company.com/careers/apply"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={manualForm.location}
                    onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })}
                    placeholder="e.g. Bengaluru, India"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Remote Type
                  </label>
                  <select
                    value={manualForm.remoteType}
                    onChange={(e) => setManualForm({ ...manualForm, remoteType: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Initial Status
                  </label>
                  <select
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white font-bold"
                  >
                    <option value="APPROVED">Publish Immediately</option>
                    <option value="PENDING_REVIEW">Pending Review</option>
                    <option value="DRAFT">Save as Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Required Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={manualForm.skills}
                  onChange={(e) => setManualForm({ ...manualForm, skills: e.target.value })}
                  placeholder="e.g. Python, SQL, Machine Learning"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Job Description
                </label>
                <textarea
                  rows={4}
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  placeholder="Enter detailed role requirements and responsibilities..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM PUBLISH DIALOG (Guarantees Admin Approval Intent)                 */}
      {/* ========================================================================= */}
      {confirmPublishOpp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Publish this opportunity to Saarvi users?</h3>
              <p className="text-xs text-slate-500">
                &quot;{confirmPublishOpp.title}&quot; at <strong>{confirmPublishOpp.companyName}</strong> will immediately appear live on the public /jobs board with the &quot;Verified by Saarvi&quot; badge.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPublishOpp(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApprove(confirmPublishOpp.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirm &amp; Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
