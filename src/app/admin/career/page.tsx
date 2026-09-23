"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Opportunity,
  OpportunityStatus,
  SourceHealth,
  DiscoveryConfig,
} from "@/lib/opportunities/types";
import {
  ShieldCheck,
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Settings,
  Activity,
  Layers,
  Check,
  X,
  Play,
  ArrowRight,
  Filter,
  Flag,
  Bell,
  ShieldAlert,
} from "lucide-react";

type AdminTab = "OVERVIEW" | "PENDING_REVIEW" | "APPROVED" | "REPORTED" | "ALERTS" | "CONFIG" | "SOURCES";

export default function AdminCareerPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Data states
  const [items, setItems] = useState<Opportunity[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, expired: 0, total: 0 });
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "ALL">("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppsRes, analyticsRes, jobsModRes] = await Promise.all([
        fetch(`/api/admin/career/opportunities?status=${statusFilter === "ALL" ? "" : statusFilter}&search=${encodeURIComponent(searchQuery)}`),
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

  // Action: Approve
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", notes: "Approved by Admin" }),
      });
      if (res.ok) {
        setNotice("Opportunity approved and marked 'Verified by Saarvi'.");
        await loadData();
      }
    } catch {
      setNotice("Failed to approve opportunity.");
    }
  };

  // Action: Reject
  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", reason: "Listing not relevant or low quality" }),
      });
      if (res.ok) {
        setNotice("Opportunity rejected.");
        await loadData();
      }
    } catch {
      setNotice("Failed to reject opportunity.");
    }
  };

  // Action: Expire
  const handleExpire = async (id: string) => {
    try {
      const res = await fetch("/api/admin/career/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXPIRE", id }),
      });
      if (res.ok) {
        setNotice("Opportunity marked as EXPIRED.");
        await loadData();
      }
    } catch {
      setNotice("Failed to expire opportunity.");
    }
  };

  // Action: Moderate Report
  const handleResolveReport = async (reportId: string, action: "RESOLVE" | "DISMISS") => {
    try {
      const res = await fetch("/api/admin/career/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          action,
          resolutionNotes: action === "RESOLVE" ? "Listing reviewed and scam resolved" : "Dismissed: listing confirmed authentic",
        }),
      });
      if (res.ok) {
        setNotice(`Report ${action === "RESOLVE" ? "resolved" : "dismissed"}.`);
        await loadData();
      }
    } catch {
      setNotice("Failed to update report.");
    }
  };

  // Action: Trigger Discovery Run
  const handleTriggerDiscovery = async () => {
    setRunningDiscovery(true);
    setNotice("Triggering live SerpApi discovery across enabled sources...");
    try {
      const res = await fetch("/api/admin/career/discovery", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setNotice(
          `Discovery completed! Found ${data.summary.totalDiscovered} records (${data.summary.totalAddedToPendingReview} added to review, ${data.summary.totalDuplicatesMerged} duplicates merged).`
        );
        await loadData();
      } else {
        setNotice(`Discovery failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setNotice(`Discovery request failed: ${err.message}`);
    } finally {
      setRunningDiscovery(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <Link href="/admin" className="hover:text-blue-600">Admin Control Center</Link>
              <span>/</span>
              <span className="text-blue-600">Career Intelligence 2.0</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Career Control Center
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Opportunity ingestion, SerpApi discovery engine, review approval queue & data quality gate.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerDiscovery}
              disabled={runningDiscovery}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {runningDiscovery ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {runningDiscovery ? "Running Discovery..." : "Run Discovery Now"}
            </button>
            <button
              onClick={loadData}
              className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {notice && (
          <div className="my-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-blue-500 hover:text-blue-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Aggregate Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 my-6">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Discovered</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{counts.total}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Total ingested</span>
          </div>
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending Review</span>
            <span className="text-2xl font-black text-amber-900 mt-1 block">{counts.pending}</span>
            <span className="text-[10px] text-amber-600 mt-0.5 block">Awaiting approval</span>
          </div>
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Approved</span>
            <span className="text-2xl font-black text-emerald-900 mt-1 block">{counts.approved}</span>
            <span className="text-[10px] text-emerald-600 mt-0.5 block">Live in student feed</span>
          </div>
          <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Reported</span>
            <span className="text-2xl font-black text-rose-900 mt-1 block">
              {reports.filter((r) => r.status === "PENDING").length}
            </span>
            <span className="text-[10px] text-rose-600 mt-0.5 block">Pending reviews</span>
          </div>
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Alerts</span>
            <span className="text-2xl font-black text-blue-900 mt-1 block">{alerts.length}</span>
            <span className="text-[10px] text-blue-600 mt-0.5 block">Subscriptions</span>
          </div>
          <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Expired</span>
            <span className="text-2xl font-black text-slate-700 mt-1 block">{counts.expired}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Deadlines passed</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto scrollbar-none text-xs font-bold">
          <button
            onClick={() => { setActiveTab("OVERVIEW"); setStatusFilter("ALL"); }}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "OVERVIEW" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            Overview & Telemetry
          </button>
          <button
            onClick={() => { setActiveTab("PENDING_REVIEW"); setStatusFilter("PENDING_REVIEW"); }}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "PENDING_REVIEW" ? "bg-amber-600 text-white shadow-xs" : "bg-white text-amber-800 hover:bg-amber-50 border border-amber-200"
            }`}
          >
            <span>Review Queue</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px]">{counts.pending}</span>
          </button>
          <button
            onClick={() => { setActiveTab("APPROVED"); setStatusFilter("APPROVED"); }}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "APPROVED" ? "bg-emerald-600 text-white shadow-xs" : "bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200"
            }`}
          >
            <span>Approved Catalog</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 text-[10px]">{counts.approved}</span>
          </button>
          <button
            onClick={() => setActiveTab("REPORTED")}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "REPORTED" ? "bg-rose-600 text-white shadow-xs" : "bg-white text-rose-800 hover:bg-rose-50 border border-rose-200"
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Reported Listings</span>
            {reports.filter((r) => r.status === "PENDING").length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-900 text-[10px]">
                {reports.filter((r) => r.status === "PENDING").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("ALERTS")}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "ALERTS" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-blue-800 hover:bg-blue-50 border border-blue-200"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Job Alerts</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 text-[10px]">{alerts.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("CONFIG")}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "CONFIG" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            Search Strategy Config
          </button>
          <button
            onClick={() => setActiveTab("SOURCES")}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "SOURCES" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            Sources & Health
          </button>
        </div>

        {/* Tab Content: Review Queue or Approved Catalog */}
        {(activeTab === "PENDING_REVIEW" || activeTab === "APPROVED") && (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, company name, or location..."
                className="w-full text-xs sm:text-sm bg-transparent border-none focus:outline-hidden"
              />
            </div>

            {/* Opportunities List */}
            <div className="space-y-3">
              {items.map((opp) => (
                <div
                  key={opp.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {opp.companyName}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {opp.category}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          {opp.source.replace(/_/g, " ")}
                        </span>
                        {opp.status === "APPROVED" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified by Saarvi
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{opp.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {opp.location} • {opp.employmentType} • {opp.remoteType}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      {opp.status !== "APPROVED" && (
                        <button
                          onClick={() => handleApprove(opp.id)}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve & Verify
                        </button>
                      )}
                      {opp.status !== "REJECTED" && (
                        <button
                          onClick={() => handleReject(opp.id)}
                          className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition"
                        >
                          Reject
                        </button>
                      )}
                      {opp.status !== "EXPIRED" && (
                        <button
                          onClick={() => handleExpire(opp.id)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                          title="Mark as expired"
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

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{opp.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div className="flex flex-wrap gap-1.5">
                      {opp.skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600 font-medium">
                          {s}
                        </span>
                      ))}
                    </div>

                    <div>
                      Discovered: {new Date(opp.discoveredAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">No opportunities found in this tab.</p>
                  <p className="text-xs mt-1">Run discovery or update search filters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Reported Listings (Anti-Scam Gate) */}
        {activeTab === "REPORTED" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                    Student Scam & Integrity Reports
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    User-submitted fraud, expired listing, broken link, or deceptive salary reports requiring administrative review.
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {reports.length} Total Reports
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          rep.reason === "SCAM"
                            ? "bg-rose-100 text-rose-800"
                            : rep.reason === "EXPIRED"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {rep.reason}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          rep.status === "PENDING"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : rep.status === "RESOLVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-50 text-slate-600 border border-slate-200"
                        }`}>
                          {rep.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1.5">
                        {rep.jobTitle || `Job ID: ${rep.jobId}`}
                      </h3>
                      {rep.companyName && (
                        <p className="text-xs font-semibold text-slate-600">{rep.companyName}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      <Link
                        href={`/jobs/${rep.jobId}`}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                        title="View Job Details"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      {rep.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleResolveReport(rep.id, "RESOLVE")}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs"
                          >
                            Resolve (Confirm Scam)
                          </button>
                          <button
                            onClick={() => handleResolveReport(rep.id, "DISMISS")}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
                          >
                            Dismiss Report
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {rep.details && (
                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                      <span className="font-semibold text-slate-800">Reporter Notes:</span> {rep.details}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                    <span>Reported: {new Date(rep.createdAt).toLocaleString()}</span>
                    {rep.reporterEmail && <span>By: {rep.reporterEmail}</span>}
                  </div>
                </div>
              ))}

              {reports.length === 0 && (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                  <p className="text-sm font-semibold text-slate-700">Zero Pending Scam Reports</p>
                  <p className="text-xs text-slate-400 mt-1">All opportunity listings meet platform trust guidelines.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Job Alerts Subscriptions */}
        {activeTab === "ALERTS" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-600" />
                    Student Job Alert Subscriptions
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Proactive keyword alerts configured by students to receive job & internship notifications.
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {alerts.length} Active Subscriptions
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                          {al.title}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          al.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"
                        }`}>
                          {al.active ? "Active" : "Paused"}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {al.frequency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Location: {al.location || "Anywhere"} • Type: {al.employmentType || "All"}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Created: {new Date(al.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {al.keywords?.map((kw: string) => (
                      <span key={kw} className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-blue-700 text-xs font-medium">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">No job alert subscriptions registered yet.</p>
                  <p className="text-xs mt-1">Students can subscribe from the Jobs & Internships search page.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Overview & Telemetry */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            {/* Source Health Grid */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                Live Source Health & Adapters
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sources.map((src) => (
                  <div key={src.sourceId} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">{src.name}</h3>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          src.status === "HEALTHY"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {src.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-slate-400 text-[10px] uppercase font-semibold">Circuit</span>
                        <p className="font-bold text-slate-800 mt-0.5">{src.circuitState}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-slate-400 text-[10px] uppercase font-semibold">Discovered</span>
                        <p className="font-bold text-blue-600 mt-0.5">{src.recordsDiscoveredTotal}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-slate-400 text-[10px] uppercase font-semibold">429 Blocks</span>
                        <p className="font-bold text-rose-600 mt-0.5">{src.rateLimit429Count}</p>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Last Check: {new Date(src.lastCheckTimestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Recent Career Audit Logs
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {recentLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div>
                      <span
                        className={`font-bold mr-2 uppercase text-[10px] px-2 py-0.5 rounded ${
                          log.action === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : log.action === "REJECTED"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-slate-700">{log.details || log.opportunityId}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
                {recentLogs.length === 0 && (
                  <div className="py-4 text-center text-slate-400">No audit events recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Search Strategy Configuration */}
        {activeTab === "CONFIG" && config && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Scheduled Search Strategy Configuration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Controls query templates, target engineering roles, fresher locations, and search frequency.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-700">Target Roles</span>
                <p className="text-slate-600">{config.roles.join(", ")}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-700">Target Locations</span>
                <p className="text-slate-600">{config.locations.join(", ")}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-700">Core Skills</span>
                <p className="text-slate-600">{config.skills.join(", ")}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-700">Search Frequency</span>
                <p className="text-slate-600">Every {config.searchFrequencyHours} hours</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
              <strong>Data Quality Safeguard:</strong> Newly discovered opportunities will enter <span className="font-bold text-blue-700">PENDING_REVIEW</span> to guarantee that no unverified or spam search results reach student feeds.
            </div>
          </div>
        )}

        {/* Tab Content: Sources */}
        {activeTab === "SOURCES" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Configured External Sources</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {sources.map((src) => (
                  <div key={src.sourceId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{src.name}</h3>
                      <p className="text-slate-500 mt-0.5">
                        Adapter ID: {src.sourceId} • Status: {src.status} • Circuit: {src.circuitState}
                      </p>
                      {src.lastError && (
                        <p className="text-rose-600 text-[11px] mt-1">Last Error: {src.lastError}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-800">{src.recordsDiscoveredTotal} total found</span>
                      <div className="text-[11px] text-slate-400 mt-0.5">{src.responseTimeMs || 0}ms latency</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
