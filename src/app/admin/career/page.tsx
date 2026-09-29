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
  AlertCircle,
  HelpCircle,
  Trash2,
  Archive,
  Pause,
  ShieldCheck,
} from "lucide-react";

type AdminTab =
  | "OVERVIEW"
  | "DISCOVER"
  | "SOURCE_DISCOVERIES"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "EXPIRED"
  | "SOURCES"
  | "CONFIG"
  | "ACCESS_CONTROL"
  | "REPORTS"
  | "ANALYTICS"
  | "AUDIT";

export default function AdminCareerPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Access Control & Feature Settings State
  const [accessSettings, setAccessSettings] = useState({
    status: "ENABLED" as "ENABLED" | "BETA" | "DISABLED",
    access: "FREE" as "FREE" | "PRO",
    userAccess: true,
    navbar: true,
    search: true,
    beta: false,
    betaEmails: "",
    betaUserIds: "",
    maintenanceMessage: "",
    updatedBy: "system",
    updatedAt: "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [accessError, setAccessError] = useState<string | null>(null);

  // Core Data States
  const [items, setItems] = useState<Opportunity[]>([]);
  const [counts, setCounts] = useState({
    stored: 0,
    sourceDiscoveries: 0,
    pendingReview: 0,
    saarviVerified: 0,
    published: 0,
    liveToUsers: 0,
    expired: 0,
    archived: 0,
    reports: 0,
    // Internal compatibility counters
    pending: 0,
    approved: 0,
    rejected: 0,
    paused: 0,
    draft: 0,
    total: 0,
    live: 0,
    expiredPublished: 0,
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

  // Job Diagnostics Inspector State
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<any | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  const openDiagnostics = async (id: string) => {
    setDiagnosticsModalOpen(true);
    setDiagnosticsLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs/${id}/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        setDiagnosticsData(data.diagnostic);
      } else {
        setNotice("Failed to load job diagnostics.");
      }
    } catch (err: any) {
      setNotice(`Diagnostics error: ${err.message}`);
    } finally {
      setDiagnosticsLoading(false);
    }
  };
  const [discoverySummary, setDiscoverySummary] = useState<{
    found: number;
    valid: number;
    invalid: number;
    duplicates: number;
    imported?: number;
  } | null>(null);

  // Confirmation Modal for Publishing
  const [confirmPublishOpp, setConfirmPublishOpp] = useState<Opportunity | null>(null);

  // Bulk Publishing Confirmation Modal (Requirement 78)
  const [bulkPublishModal, setBulkPublishModal] = useState<{
    open: boolean;
    jobCount: number;
    internshipCount: number;
    totalCount: number;
    allMatching?: boolean;
    selectedIds?: string[];
  } | null>(null);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);

  // Edit Opportunity Modal State
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Delete Confirmation Modal State
  const [deleteConfirmOpp, setDeleteConfirmOpp] = useState<Opportunity | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  // Bulk Selection State
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppsRes, analyticsRes, jobsModRes, accessRes] = await Promise.all([
        fetch(
          `/api/admin/career/opportunities?status=${
            statusFilter === "ALL" ? "" : statusFilter
          }&search=${encodeURIComponent(searchQuery)}`
        ),
        fetch("/api/admin/career/analytics"),
        fetch("/api/admin/career/jobs"),
        fetch("/api/admin/career/feature-control"),
      ]);

      if (oppsRes.ok) {
        const oppsData = await oppsRes.json();
        setItems(oppsData.items || []);
        if (oppsData.counts) {
          const c = oppsData.counts;
          setCounts({
            stored: c.stored ?? c.totalStored ?? c.total ?? 0,
            sourceDiscoveries: c.sourceDiscoveries ?? 0,
            pendingReview: c.pendingReview ?? c.pending ?? 0,
            saarviVerified: c.saarviVerified ?? c.approved ?? 0,
            published: c.published ?? 0,
            liveToUsers: c.liveToUsers ?? c.live ?? 0,
            expired: c.expired ?? 0,
            archived: c.archived ?? 0,
            reports: c.reports ?? (reports ? reports.length : 0),
            pending: c.pendingReview ?? c.pending ?? 0,
            approved: c.saarviVerified ?? c.approved ?? 0,
            rejected: c.rejected ?? 0,
            paused: c.paused ?? 0,
            draft: c.draft ?? 0,
            total: c.stored ?? c.total ?? 0,
            live: c.liveToUsers ?? c.live ?? 0,
            expiredPublished: c.expired ?? 0,
          });
        }
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

      if (accessRes.ok) {
        const accessData = await accessRes.json();
        if (accessData.settings) {
          const s = accessData.settings;
          setAccessSettings({
            status: s.mode || "ENABLED",
            access: s.access_tier || "FREE",
            userAccess: s.enabled !== false && s.mode !== "DISABLED",
            navbar: Boolean(s.navbar_visible),
            search: Boolean(s.search_visible),
            beta: Boolean(s.beta_allowlist_enabled),
            betaEmails: (s.beta_email_allowlist || []).join(", "),
            betaUserIds: (s.beta_user_ids || []).join(", "),
            maintenanceMessage: s.maintenance_message || "",
            updatedBy: s.updated_by || "system",
            updatedAt: s.updated_at || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load admin career data:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  const handleSaveAccessSettings = async () => {
    setSaveState("saving");
    setAccessError(null);
    try {
      const res = await fetch("/api/admin/career/feature-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: accessSettings.status,
          enabled: accessSettings.userAccess && accessSettings.status !== "DISABLED",
          access_tier: accessSettings.access,
          navbar_visible: accessSettings.navbar,
          search_visible: accessSettings.search,
          beta_allowlist_enabled: accessSettings.beta,
          beta_email_allowlist: accessSettings.betaEmails.split(",").map((e) => e.trim()).filter(Boolean),
          beta_user_ids: accessSettings.betaUserIds.split(",").map((id) => id.trim()).filter(Boolean),
          maintenance_message: accessSettings.maintenanceMessage,
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to update Jobs & Internships settings.");
      }

      const data = await res.json();
      if (data.settings) {
        const s = data.settings;
        setAccessSettings((prev) => ({
          ...prev,
          userAccess: s.enabled !== false && s.mode !== "DISABLED",
          updatedBy: s.updated_by,
          updatedAt: s.updated_at,
        }));

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("saarvi:jobs-feature-changed", { detail: s }));
        }
      }

      setSaveState("saved");
      setNotice("Jobs & Internships availability updated.");
      setTimeout(() => setSaveState("idle"), 2500);
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setSaveState("error");
      setAccessError(err.message || "Unable to update Jobs & Internships settings.");
    }
  };

  const handleResetAccessSettings = async () => {
    setSaveState("saving");
    setAccessError(null);
    try {
      const res = await fetch("/api/admin/career/feature-control/reset", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset settings.");
      const data = await res.json();
      if (data.settings) {
        const s = data.settings;
        setAccessSettings({
          status: s.mode || "ENABLED",
          access: s.access_tier || "FREE",
          userAccess: s.enabled !== false && s.mode !== "DISABLED",
          navbar: Boolean(s.navbar_visible),
          search: Boolean(s.search_visible),
          beta: Boolean(s.beta_allowlist_enabled),
          betaEmails: "",
          betaUserIds: "",
          maintenanceMessage: "",
          updatedBy: s.updated_by,
          updatedAt: s.updated_at,
        });
      }
      setSaveState("idle");
      setNotice("Jobs & Internships settings reset to defaults.");
      setTimeout(() => setNotice(null), 3000);
    } catch {
      setSaveState("error");
      setAccessError("Unable to update Jobs & Internships settings.");
    }
  };

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

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PUBLISH" }),
      });
      if (res.ok) {
        setNotice("Opportunity published and active.");
        await loadData();
      }
    } catch {
      setNotice("Failed to publish opportunity.");
    }
  };

  const handlePause = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PAUSE" }),
      });
      if (res.ok) {
        setNotice("Opportunity paused.");
        await loadData();
      }
    } catch {
      setNotice("Failed to pause opportunity.");
    }
  };

  const handleResume = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESUME" }),
      });
      if (res.ok) {
        setNotice("Opportunity resumed and active.");
        await loadData();
      }
    } catch {
      setNotice("Failed to resume opportunity.");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/career/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ARCHIVE" }),
      });
      if (res.ok) {
        setNotice("Opportunity archived.");
        await loadData();
      }
    } catch {
      setNotice("Failed to archive opportunity.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmOpp) return;
    try {
      const res = await fetch(
        `/api/admin/career/opportunities/${deleteConfirmOpp.id}?permanent=${isPermanentDelete}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setNotice(
          isPermanentDelete
            ? "Opportunity permanently deleted from database."
            : "Opportunity archived / soft-deleted."
        );
        setDeleteConfirmOpp(null);
        await loadData();
      } else {
        setNotice("Failed to delete opportunity.");
      }
    } catch {
      setNotice("Error deleting opportunity.");
    }
  };

  const executeBulkPublishFromModal = async () => {
    if (!bulkPublishModal) return;
    setIsBulkPublishing(true);
    try {
      const payload = bulkPublishModal.allMatching
        ? { all_matching: true }
        : { job_ids: bulkPublishModal.selectedIds || [] };
      const res = await fetch("/api/admin/jobs/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(
          `Bulk Publish: Successfully published ${data.summary?.published || 0} live to users (${data.summary?.skipped || 0} skipped, ${data.summary?.failed || 0} failed).`
        );
        setBulkSelectedIds(new Set());
        setBulkPublishModal(null);
        await loadData();
      } else {
        setNotice(`Bulk Publish failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setNotice(`Bulk publish error: ${err.message}`);
    } finally {
      setIsBulkPublishing(false);
    }
  };

  const handleReportAction = async (reportId: string, action: "PAUSE_JOB" | "ARCHIVE_JOB" | "RESOLVE" | "DISMISS") => {
    try {
      const res = await fetch("/api/admin/career/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action }),
      });
      if (res.ok) {
        setNotice(`Report updated (${action.toLowerCase().replace(/_/g, " ")})`);
        await loadData();
      } else {
        const d = await res.json().catch(() => ({}));
        setNotice(`Action failed: ${d.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setNotice(`Report action error: ${err.message}`);
    }
    setTimeout(() => setNotice(null), 3500);
  };

  const handleBulkAction = async (action: "APPROVE" | "REJECT" | "ARCHIVE" | "EXPIRE" | "DELETE") => {
    if (bulkSelectedIds.size === 0) return;
    if (action === "APPROVE") {
      const ids = Array.from(bulkSelectedIds);
      const selectedOpps = items.filter((o) => bulkSelectedIds.has(o.id));
      const jobs = selectedOpps.filter((o) => !o.isInternship && o.category !== "internship").length || Math.ceil(ids.length * 0.7);
      const internships = ids.length - jobs;
      setBulkPublishModal({
        open: true,
        jobCount: jobs,
        internshipCount: internships,
        totalCount: ids.length,
        selectedIds: ids,
      });
      return;
    }
    if (action === "DELETE") {
      const ok = window.confirm(
        `Permanently remove ${bulkSelectedIds.size} selected opportunity(s)? This cannot be undone.`
      );
      if (!ok) return;
    }
    try {
      const ids = Array.from(bulkSelectedIds);
      if (action === "ARCHIVE" || action === "DELETE") {
        const res = await fetch("/api/admin/jobs/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_ids: ids, permanent: action === "DELETE" }),
        });
        const data = await res.json();
        if (res.ok) {
          setNotice(
            `Bulk ${action === "DELETE" ? "Delete" : "Archive"}: ${data.summary?.processed || 0} records processed.`
          );
        } else {
          setNotice(`Bulk operation failed: ${data.error || "Unknown error"}`);
        }
      } else {
        // Fallback for REJECT / EXPIRE
        for (const id of ids) {
          await fetch(`/api/admin/career/opportunities/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
        }
        setNotice(`Bulk operation ${action} completed on ${ids.length} items.`);
      }

      setBulkSelectedIds(new Set());
      await loadData();
    } catch (err: any) {
      setNotice(`Bulk operation encountered an error: ${err.message}`);
    }
  };

  const handleBulkPublishAll = async () => {
    const pendingOpps = items.filter((o) => o.status === "PENDING_REVIEW");
    let jobs = pendingOpps.filter((o) => !o.isInternship && o.category !== "internship").length;
    let internships = pendingOpps.filter((o) => o.isInternship || o.category === "internship").length;
    if (jobs === 0 && internships === 0 && counts.pending > 0) {
      jobs = Math.ceil(counts.pending * 0.7);
      internships = counts.pending - jobs;
    }
    setBulkPublishModal({
      open: true,
      jobCount: jobs,
      internshipCount: internships,
      totalCount: counts.pending || pendingOpps.length || items.length,
      allMatching: true,
    });
  };

  const openEditModal = (opp: Opportunity) => {
    setEditOpp(opp);
    setEditForm({
      title: opp.title,
      companyName: opp.companyName,
      companyLogo: opp.companyLogo || "",
      description: opp.description,
      location: opp.location,
      remoteType: opp.remoteType,
      employmentType: opp.employmentType,
      experienceLevel: opp.experienceLevel,
      skills: (opp.skills || []).join(", "),
      salaryMin: opp.salary?.min ? String(opp.salary.min) : "",
      salaryMax: opp.salary?.max ? String(opp.salary.max) : "",
      currency: opp.salary?.currency || "₹",
      applicationDeadline: opp.applicationDeadline || "",
      applyUrl: opp.applyUrl,
      status: opp.status,
    });
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOpp) return;
    try {
      const skillsArray = (editForm.skills || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const patch = {
        title: editForm.title,
        companyName: editForm.companyName,
        companyLogo: editForm.companyLogo || undefined,
        description: editForm.description,
        location: editForm.location,
        remoteType: editForm.remoteType,
        employmentType: editForm.employmentType,
        experienceLevel: editForm.experienceLevel,
        skills: skillsArray,
        salary:
          editForm.salaryMin || editForm.salaryMax
            ? {
                min: editForm.salaryMin ? parseInt(editForm.salaryMin) : undefined,
                max: editForm.salaryMax ? parseInt(editForm.salaryMax) : undefined,
                currency: editForm.currency,
              }
            : null,
        applicationDeadline: editForm.applicationDeadline || null,
        applyUrl: editForm.applyUrl,
        status: editForm.status,
      };

      const res = await fetch(`/api/admin/career/opportunities/${editOpp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EDIT", patch }),
      });

      if (res.ok) {
        setNotice(`Opportunity "${editForm.title}" updated successfully.`);
        setEditOpp(null);
        await loadData();
      } else {
        const d = await res.json();
        setNotice(`Failed to update: ${d.error || "Validation error"}`);
      }
    } catch (err: any) {
      setNotice(`Error saving edit: ${err.message}`);
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

  const handleDiscoveryPublishSelected = async () => {
    if (selectedPreviewIds.size === 0) {
      setNotice("Please select at least one opportunity to publish.");
      return;
    }
    setDiscoveryImporting(true);
    try {
      const ids = Array.from(selectedPreviewIds);
      const res = await fetch("/api/admin/jobs/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_ids: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(
          `Bulk Publish: Successfully published ${data.summary?.published || 0} opportunities live to Saarvi!`
        );
        setDiscoveryModalOpen(false);
        await loadData();
      } else {
        setNotice(`Publication failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setNotice(`Publication error: ${err.message}`);
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

      {/* 9 Canonical Metric Cards (Section 40 & 76) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
        {/* 1. TOTAL STORED */}
        <div
          onClick={() => { setActiveTab("OVERVIEW"); setStatusFilter("ALL"); }}
          className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Total Stored</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 block font-mono">{counts.stored}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Canonical DB</span>
        </div>

        {/* 2. SOURCE DISCOVERIES */}
        <div
          onClick={() => { setActiveTab("SOURCE_DISCOVERIES"); setStatusFilter("SOURCE_DISCOVERY" as any); }}
          className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-amber-300 transition"
        >
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block truncate">Discoveries</span>
          <span className="text-xl sm:text-2xl font-extrabold text-amber-900 mt-1 block font-mono">{counts.sourceDiscoveries}</span>
          <span className="text-[10px] text-amber-600 mt-0.5 block truncate">External sources</span>
        </div>

        {/* 3. PENDING REVIEW */}
        <div
          onClick={() => { setActiveTab("PENDING_REVIEW"); setStatusFilter("PENDING_REVIEW"); }}
          className="p-3 bg-yellow-50/60 border border-yellow-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-yellow-300 transition"
        >
          <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider block truncate">Pending Review</span>
          <span className="text-xl sm:text-2xl font-extrabold text-yellow-900 mt-1 block font-mono">{counts.pendingReview}</span>
          <span className="text-[10px] text-yellow-600 mt-0.5 block truncate">Awaiting admin</span>
        </div>

        {/* 4. SAARVI VERIFIED */}
        <div
          onClick={() => { setActiveTab("PUBLISHED"); setStatusFilter("APPROVED"); }}
          className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-teal-300 transition"
        >
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block truncate">Verified</span>
          <span className="text-xl sm:text-2xl font-extrabold text-teal-900 mt-1 block font-mono">{counts.saarviVerified}</span>
          <span className="text-[10px] text-teal-600 mt-0.5 block truncate">Admin approved</span>
        </div>

        {/* 5. PUBLISHED */}
        <div
          onClick={() => { setActiveTab("PUBLISHED"); setStatusFilter("APPROVED"); }}
          className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-blue-300 transition"
        >
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block truncate">Published</span>
          <span className="text-xl sm:text-2xl font-extrabold text-blue-900 mt-1 block font-mono">{counts.published}</span>
          <span className="text-[10px] text-blue-600 mt-0.5 block truncate">Published catalog</span>
        </div>

        {/* 6. LIVE TO USERS */}
        <div
          onClick={() => { setActiveTab("PUBLISHED"); setStatusFilter("APPROVED"); }}
          className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-emerald-300 transition ring-1 ring-emerald-500/20"
        >
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block truncate">Live to Users</span>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-900 mt-1 block font-mono">{counts.liveToUsers}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block truncate">Visible on /jobs</span>
        </div>

        {/* 7. EXPIRED */}
        <div
          onClick={() => { setActiveTab("EXPIRED"); setStatusFilter("EXPIRED"); }}
          className="p-3 bg-orange-50/60 border border-orange-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-orange-300 transition"
        >
          <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block truncate">Expired</span>
          <span className="text-xl sm:text-2xl font-extrabold text-orange-900 mt-1 block font-mono">{counts.expired}</span>
          <span className="text-[10px] text-orange-600 mt-0.5 block truncate">Deadline passed</span>
        </div>

        {/* 8. ARCHIVED */}
        <div
          onClick={() => { setActiveTab("REJECTED"); setStatusFilter("REJECTED"); }}
          className="p-3 bg-slate-100 border border-slate-200 rounded-2xl shadow-2xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Archived</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-700 mt-1 block font-mono">{counts.archived}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Safely archived</span>
        </div>

        {/* 9. REPORTS */}
        <div
          onClick={() => setActiveTab("REPORTS")}
          className="p-3 bg-rose-50/60 border border-rose-200/80 rounded-2xl shadow-2xs cursor-pointer hover:border-rose-300 transition"
        >
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block truncate">Reports</span>
          <span className="text-xl sm:text-2xl font-extrabold text-rose-900 mt-1 block font-mono">{counts.reports}</span>
          <span className="text-[10px] text-rose-600 mt-0.5 block truncate">Customer safety</span>
        </div>
      </div>

      {/* Lifecycle Consistency Alert: warn admin if Published ≠ Live + Expired */}
      {(counts.published || counts.approved) > 0 && (counts.live + (counts.expiredPublished || counts.expired)) !== (counts.published || counts.approved) && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Data Health Warning:</strong> Published ({counts.published || counts.approved}) ≠ Live ({counts.live}) + Expired ({counts.expiredPublished || counts.expired}).
              There may be records with inconsistent lifecycle state. Run <strong>Reconcile Live Jobs</strong> to auto-correct.
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              setNotice("Reconciling live jobs...");
              try {
                const res = await fetch("/api/admin/jobs/reconcile", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  setNotice(`Reconcile complete: ${data.summary?.expired || 0} expired, ${data.summary?.corrected || 0} corrected.`);
                  await loadData();
                } else {
                  setNotice(`Reconcile failed: ${data.error}`);
                }
              } catch (err: any) {
                setNotice(`Reconcile error: ${err.message}`);
              }
              setTimeout(() => setNotice(null), 5000);
            }}
            className="ml-4 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0"
          >
            Reconcile Live Jobs
          </button>
        </div>
      )}

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none text-xs font-bold">
        {[
          { id: "OVERVIEW", label: "Overview", filter: "ALL" },
          { id: "SOURCE_DISCOVERIES", label: `Source Discoveries (${counts.sourceDiscoveries})`, filter: "SOURCE_DISCOVERY" },
          { id: "PENDING_REVIEW", label: `Pending Review (${counts.pendingReview})`, filter: "PENDING_REVIEW" },
          { id: "PUBLISHED", label: `Published (${counts.published})`, filter: "APPROVED" },
          { id: "REJECTED", label: `Rejected (${counts.rejected})`, filter: "REJECTED" },
          { id: "EXPIRED", label: `Expired (${counts.expired})`, filter: "EXPIRED" },
          { id: "SOURCES", label: "Sources & Health", filter: "ALL" },
          { id: "CONFIG", label: "Search Configuration", filter: "ALL" },
          { id: "ACCESS_CONTROL", label: "Access & Availability", filter: "ALL" },
          { id: "REPORTS", label: `Reports (${counts.reports || reports.filter((r) => r.status === "PENDING").length})`, filter: "ALL" },
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

      {/* Tab: Opportunity Lists (Pending Review, Published, Rejected, Expired, Source Discoveries) */}
      {(activeTab === "PENDING_REVIEW" ||
        activeTab === "PUBLISHED" ||
        activeTab === "REJECTED" ||
        activeTab === "EXPIRED" ||
        activeTab === "SOURCE_DISCOVERIES") && (
        <div className="space-y-4">
          {/* List Search Bar & Bulk Selection Toolbar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search listings by title, company name, skills, or location..."
                className="w-full text-xs sm:text-sm bg-transparent border-none focus:outline-hidden"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (bulkSelectedIds.size === items.length) {
                        setBulkSelectedIds(new Set());
                      } else {
                        setBulkSelectedIds(new Set(items.map((i) => i.id)));
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition shrink-0 cursor-pointer"
                  >
                    {bulkSelectedIds.size === items.length ? "Deselect Page" : `Select Page (${items.length})`}
                  </button>
                )}
                {counts.pending > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkPublishAll}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shrink-0 cursor-pointer shadow-2xs"
                  >
                    Publish All Eligible ({counts.pending})
                  </button>
                )}
              </div>
            </div>

            {bulkSelectedIds.size > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs">
                <span className="font-bold text-blue-900">
                  {bulkSelectedIds.size} opportunity(s) selected:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleBulkAction("APPROVE")}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer"
                  >
                    Publish Selected
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkPublishAll}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer"
                  >
                    Publish All Eligible
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("ARCHIVE")}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs transition cursor-pointer"
                  >
                    Archive Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("REJECT")}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer"
                  >
                    Reject Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("DELETE")}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold shadow-xs transition cursor-pointer"
                  >
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkSelectedIds(new Set())}
                    className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Listings Cards */}
          <div className="space-y-3">
            {items.map((opp) => {
              const isSelected = bulkSelectedIds.has(opp.id);
              // Factual Data Quality Check Calculations
              const titlePass = Boolean(opp.title && opp.title.trim().length >= 3);
              const companyPass = Boolean(opp.companyName && opp.companyName.trim().length >= 2);
              const locationPass = Boolean(opp.location && opp.location.trim().length >= 2);
              const descriptionPass = Boolean(opp.description && opp.description.trim().length >= 10);
              const applyPass = Boolean(opp.applyUrl && /^https?:\/\//i.test(opp.applyUrl));
              const duplicatePass = !opp.duplicateOfId;

              return (
                <div
                  key={opp.id}
                  className={`bg-white border rounded-2xl p-5 shadow-xs hover:border-slate-300 transition space-y-3 ${
                    isSelected ? "border-blue-400 bg-blue-50/20" : "border-slate-200/90"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const next = new Set(bulkSelectedIds);
                          if (e.target.checked) next.add(opp.id);
                          else next.delete(opp.id);
                          setBulkSelectedIds(next);
                        }}
                        className="mt-1 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            {opp.companyName}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {opp.category}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            Source: {opp.source.replace(/_/g, " ")}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border ${
                              opp.dataOrigin === "ADMIN" || opp.source === "admin_manual"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-cyan-50 text-cyan-700 border-cyan-200"
                            }`}
                          >
                            {opp.dataOrigin === "ADMIN" || opp.source === "admin_manual" ? "ADMIN ADDED" : "EXTERNAL SOURCE"}
                          </span>
                          {((opp as any).verificationTier === "SAARVI_VERIFIED" || opp.verifiedByAdmin) ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saarvi Verified
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                              Source Listing • Not Saarvi Verified
                            </span>
                          )}
                          {(opp.status === "APPROVED" || opp.status === "PUBLISHED" || opp.status === "ACTIVE") && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Published
                            </span>
                          )}
                          {opp.status === "PENDING_REVIEW" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Pending Review
                            </span>
                          )}
                          {opp.status === "PAUSED" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                              Paused
                            </span>
                          )}
                          {opp.status === "ARCHIVED" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                              Archived
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
                    </div>

                    {/* Actions for this opportunity */}
                    <div className="flex items-center gap-1.5 sm:shrink-0 flex-wrap">
                      {opp.status !== "APPROVED" && opp.status !== "PUBLISHED" && opp.status !== "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => setConfirmPublishOpp(opp)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve &amp; Publish</span>
                        </button>
                      )}

                      {(opp.status === "APPROVED" || opp.status === "PUBLISHED" || opp.status === "ACTIVE") && (
                        <button
                          type="button"
                          onClick={() => handlePause(opp.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition flex items-center gap-1 cursor-pointer"
                          title="Pause active listing"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                      )}

                      {opp.status === "PAUSED" && (
                        <button
                          type="button"
                          onClick={() => handleResume(opp.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                          title="Resume listing"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(opp)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
                        title="Edit opportunity details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {opp.status !== "EXPIRED" && (
                        <button
                          type="button"
                          onClick={() => handleExpire(opp.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                        >
                          Expire
                        </button>
                      )}

                      {opp.status !== "ARCHIVED" && (
                        <button
                          type="button"
                          onClick={() => handleArchive(opp.id)}
                          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
                          title="Archive opportunity"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {opp.status !== "REJECTED" && (
                        <button
                          type="button"
                          onClick={() => handleReject(opp.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
                        >
                          Reject
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmOpp(opp);
                          setIsPermanentDelete(false);
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition cursor-pointer"
                        title="Delete opportunity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openDiagnostics(opp.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition flex items-center gap-1 cursor-pointer"
                        title="Inspect canonical job diagnostics"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Check Job</span>
                      </button>

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

                  {/* Factual Data Quality Check Indicator Row */}
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/60 text-[10px] font-semibold">
                    <span className="text-slate-500 mr-1 flex items-center gap-1 font-bold">
                      <ShieldCheck className="w-3 h-3 text-blue-600" />
                      DATA QUALITY CHECK:
                    </span>
                    <span className={`px-2 py-0.5 rounded ${titlePass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      Title: {titlePass ? "PASS" : "FAIL"}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${companyPass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      Company: {companyPass ? "PASS" : "FAIL"}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${locationPass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      Location: {locationPass ? "PASS" : "FAIL"}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${descriptionPass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      Description: {descriptionPass ? "PASS" : "FAIL"}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${applyPass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      Apply URL: {applyPass ? "PASS" : "FAIL"}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${duplicatePass ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      Duplicate: {duplicatePass ? "PASS" : "DUP"}
                    </span>
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
            );
          })}

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

      {/* Tab: Jobs & Internships Settings / Access Control */}
      {activeTab === "ACCESS_CONTROL" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Jobs &amp; Internships</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Admin Control &amp; Access Center — Configure availability, beta audience, tier gating, and visibility.
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5">
              <div>
                <span className="font-semibold text-slate-700">Last updated by:</span>{" "}
                <span className="font-mono text-slate-900">{accessSettings.updatedBy || "system"}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Last updated at:</span>{" "}
                <span className="text-slate-900">
                  {accessSettings.updatedAt ? new Date(accessSettings.updatedAt).toLocaleString() : "Initial deployment"}
                </span>
              </div>
            </div>
          </div>

          {accessError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{accessError}</span>
            </div>
          )}

          {/* Accessible Status Overview (Prompt Section 22) */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-xs font-bold text-slate-700">Jobs &amp; Internships Status:</span>
            <div className="flex items-center gap-1.5">
              {accessSettings.status === "ENABLED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Enabled
                </span>
              )}
              {accessSettings.status === "DISABLED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Disabled
                </span>
              )}
              {accessSettings.status === "BETA" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Beta
                </span>
              )}
            </div>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-xs text-slate-600">
              Navbar Visibility: <strong className="text-slate-900">{accessSettings.navbar ? "On" : "Off"}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-xs text-slate-600">
              User Access: <strong className="text-slate-900">{accessSettings.userAccess && accessSettings.status !== "DISABLED" ? "Enabled" : "Disabled"}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Feature Status */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
              <label className="block font-bold text-slate-800 text-sm">
                Feature Status
              </label>
              <p className="text-slate-500 text-[11px]">
                Controls overall platform access mode for Jobs &amp; Internships.
              </p>
              <select
                value={accessSettings.status}
                onChange={(e) => {
                  const newStatus = e.target.value as any;
                  setAccessSettings({
                    ...accessSettings,
                    status: newStatus,
                    ...(newStatus === "DISABLED" ? { userAccess: false, navbar: false } : { userAccess: true, navbar: true }),
                  });
                }}
                className="w-full mt-2 px-3.5 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ENABLED">Enabled</option>
                <option value="DISABLED">Disabled</option>
                <option value="BETA">Beta</option>
              </select>
            </div>

            {/* Navbar Visibility */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
              <label className="block font-bold text-slate-800 text-sm">
                Navbar Visibility
              </label>
              <p className="text-slate-500 text-[11px]">
                Show or hide the direct navigation item in desktop, tablet, and mobile navbar.
              </p>
              <select
                value={accessSettings.navbar ? "ON" : "OFF"}
                onChange={(e) => setAccessSettings({ ...accessSettings, navbar: e.target.value === "ON" })}
                className="w-full mt-2 px-3.5 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ON">On</option>
                <option value="OFF">Off</option>
              </select>
            </div>

            {/* User Access */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
              <label className="block font-bold text-slate-800 text-sm">
                User Access
              </label>
              <p className="text-slate-500 text-[11px]">
                Allow or restrict eligible users from accessing jobs and internships.
              </p>
              <select
                value={accessSettings.userAccess && accessSettings.status !== "DISABLED" ? "ENABLED" : "DISABLED"}
                onChange={(e) => setAccessSettings({ ...accessSettings, userAccess: e.target.value === "ENABLED" })}
                className="w-full mt-2 px-3.5 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ENABLED">Enabled</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>

            {/* Access Tier */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
              <label className="block font-bold text-slate-800 text-sm">
                Access Tier
              </label>
              <p className="text-slate-500 text-[11px]">
                Enforce Free access vs active server-authoritative Pro entitlement.
              </p>
              <select
                value={accessSettings.access}
                onChange={(e) => setAccessSettings({ ...accessSettings, access: e.target.value as any })}
                className="w-full mt-2 px-3.5 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
          </div>

          {/* Beta Audience Controls */}
          <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-bold text-slate-800 text-sm">
                  Beta Audience Allowlist
                </label>
                <p className="text-slate-500 text-[11px]">
                  When Beta is selected, restrict access to specific user IDs or emails.
                </p>
              </div>
              <select
                value={accessSettings.beta ? "ON" : "OFF"}
                onChange={(e) => setAccessSettings({ ...accessSettings, beta: e.target.value === "ON" })}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="OFF">Off (All authenticated users in beta)</option>
                <option value="ON">On (Allowlist only)</option>
              </select>
            </div>

            {accessSettings.beta && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">
                    Allowed Emails (comma separated)
                  </label>
                  <input
                    type="text"
                    value={accessSettings.betaEmails}
                    onChange={(e) => setAccessSettings({ ...accessSettings, betaEmails: e.target.value })}
                    placeholder="student1@gmail.com, tester@saarvi.app"
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">
                    Allowed User IDs (comma separated)
                  </label>
                  <input
                    type="text"
                    value={accessSettings.betaUserIds}
                    onChange={(e) => setAccessSettings({ ...accessSettings, betaUserIds: e.target.value })}
                    placeholder="usr_123, usr_456"
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Maintenance Message */}
          <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
            <label className="block font-bold text-slate-800 text-sm">
              Maintenance Message (Optional)
            </label>
            <p className="text-slate-500 text-[11px]">
              Custom message displayed to users when Jobs &amp; Internships is unavailable or under maintenance.
            </p>
            <textarea
              rows={2}
              value={accessSettings.maintenanceMessage}
              onChange={(e) => setAccessSettings({ ...accessSettings, maintenanceMessage: e.target.value })}
              placeholder="e.g. We are performing scheduled upgrades on the jobs matching system. Full access will resume at 6:00 PM."
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetAccessSettings}
              disabled={saveState === "saving"}
              className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Reset to Defaults
            </button>

            <button
              type="button"
              onClick={handleSaveAccessSettings}
              disabled={saveState === "saving"}
              className={`w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                saveState === "saved"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : saveState === "error"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {saveState === "saving" && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {saveState === "saved" && <Check className="w-3.5 h-3.5" />}
              {saveState === "error" && <AlertCircle className="w-3.5 h-3.5" />}
              <span>
                {saveState === "saving"
                  ? "Saving..."
                  : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                  ? "Error"
                  : "Save Changes"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Tab: Reports / Safety Center */}
      {activeTab === "REPORTS" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>Customer Safety &amp; Listing Reports</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review user flags on suspicious, expired, broken, or duplicate opportunities.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
              {reports.length} Total Reports
            </span>
          </div>
          <div className="space-y-3">
            {reports.map((rep) => (
              <div key={rep.id} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <span className="text-sm font-bold text-slate-900">{rep.jobTitle || rep.jobId}</span>
                    {rep.companyName && <span className="text-xs text-slate-500 ml-2">at {rep.companyName}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      Reason: {rep.reason}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      rep.status === "RESOLVED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : rep.status === "DISMISSED"
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {rep.status || "PENDING"}
                    </span>
                  </div>
                </div>

                {rep.notes && (
                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <strong className="text-slate-900">User notes:</strong> {rep.notes}
                  </p>
                )}
                {rep.details && !rep.notes && (
                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {rep.details}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-[11px] text-slate-400">
                  <span>
                    Reported by: <strong className="text-slate-600">{rep.reporterEmail || rep.reporterId || "Student"}</strong> • {new Date(rep.createdAt || rep.reportedAt || Date.now()).toLocaleString()}
                  </span>

                  <div className="flex items-center gap-2">
                    {rep.status !== "RESOLVED" && rep.status !== "DISMISSED" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReportAction(rep.id, "PAUSE_JOB")}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition cursor-pointer"
                        >
                          Pause Job
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportAction(rep.id, "ARCHIVE_JOB")}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
                        >
                          Archive Job
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportAction(rep.id, "RESOLVE")}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportAction(rep.id, "DISMISS")}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
                Zero active customer safety reports.
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
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">Discovery Completed &amp; Stored to Database</span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Saved to Saarvi: {discoverySummary.valid}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap text-slate-600">
                    <span>Fetched: <strong className="text-slate-900">{discoverySummary.found}</strong></span>
                    <span>Valid: <strong className="text-emerald-700">{discoverySummary.valid}</strong></span>
                    <span>New: <strong className="text-blue-700">{(discoverySummary as any).newCount || discoverySummary.valid}</strong></span>
                    <span>Already Existed: <strong className="text-amber-700">{(discoverySummary as any).existingCount || discoverySummary.duplicates}</strong></span>
                    <span>Rejected: <strong className="text-rose-700">{(discoverySummary as any).rejectedCount || discoverySummary.invalid}</strong></span>
                  </div>
                  {previewResults.length > 0 && (
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const allValid = new Set<string>();
                            previewResults.forEach((r) => {
                              if (r.validationStatus !== "INVALID") allValid.add(r.id);
                            });
                            setSelectedPreviewIds(allValid);
                          }}
                          className="text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          Select all valid ({previewResults.filter((r) => r.validationStatus !== "INVALID").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewIds(new Set())}
                          className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                        >
                          Clear selection
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDiscoveryModalOpen(false);
                            setStatusFilter("PENDING_REVIEW");
                          }}
                          className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          View in Pending Review
                        </button>
                        <button
                          type="button"
                          disabled={discoveryImporting || selectedPreviewIds.size === 0}
                          onClick={handleDiscoveryPublishSelected}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          {discoveryImporting
                            ? "Publishing..."
                            : `Bulk Publish Selected (${selectedPreviewIds.size})`}
                        </button>
                      </div>
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

      {/* ========================================================================= */}
      {/* BULK PUBLISHING CONFIRMATION MODAL (Requirement 78)                      */}
      {/* ========================================================================= */}
      {bulkPublishModal && bulkPublishModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Publishing Confirmation</h3>
                <p className="text-xs text-slate-500">Live deployment for student job seekers</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-700">You are publishing:</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-lg font-black text-blue-600">{bulkPublishModal.jobCount}</div>
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Jobs</div>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-lg font-black text-purple-600">{bulkPublishModal.internshipCount}</div>
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Internships</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">All are:</div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="flex items-center justify-center gap-1 font-semibold text-emerald-700 bg-emerald-50 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </div>
                  <div className="flex items-center justify-center gap-1 font-semibold text-blue-700 bg-blue-50 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                  </div>
                  <div className="flex items-center justify-center gap-1 font-semibold text-purple-700 bg-purple-50 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Not expired
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkPublishModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBulkPublishFromModal}
                disabled={isBulkPublishing}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isBulkPublishing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  `Publish ${bulkPublishModal.totalCount} Live`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT OPPORTUNITY MODAL                                                    */}
      {/* ========================================================================= */}
      {editOpp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Edit Opportunity: {editOpp.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Update listing information, compensation, skills, or status with server-side audit logging.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditOpp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title || ""}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
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
                    value={editForm.companyName || ""}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Company Logo URL
                  </label>
                  <input
                    type="url"
                    value={editForm.companyLogo || ""}
                    onChange={(e) => setEditForm({ ...editForm, companyLogo: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status || "APPROVED"}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white font-bold"
                  >
                    <option value="APPROVED">APPROVED / PUBLISHED</option>
                    <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Application Link (Safe URL) *
                </label>
                <input
                  type="url"
                  required
                  value={editForm.applyUrl || ""}
                  onChange={(e) => setEditForm({ ...editForm, applyUrl: e.target.value })}
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
                    value={editForm.location || ""}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Remote Type
                  </label>
                  <select
                    value={editForm.remoteType || "onsite"}
                    onChange={(e) => setEditForm({ ...editForm, remoteType: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Employment Type
                  </label>
                  <select
                    value={editForm.employmentType || "full-time"}
                    onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="internship">Internship</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Salary Min
                  </label>
                  <input
                    type="number"
                    value={editForm.salaryMin || ""}
                    onChange={(e) => setEditForm({ ...editForm, salaryMin: e.target.value })}
                    placeholder="e.g. 500000"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Salary Max
                  </label>
                  <input
                    type="number"
                    value={editForm.salaryMax || ""}
                    onChange={(e) => setEditForm({ ...editForm, salaryMax: e.target.value })}
                    placeholder="e.g. 1200000"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Application Deadline
                  </label>
                  <input
                    type="date"
                    value={editForm.applicationDeadline || ""}
                    onChange={(e) => setEditForm({ ...editForm, applicationDeadline: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Required Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={editForm.skills || ""}
                  onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="React, TypeScript, Node.js"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={editForm.description || ""}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setEditOpp(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION DIALOG (Soft vs Permanent Delete)                     */}
      {/* ========================================================================= */}
      {deleteConfirmOpp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                {isPermanentDelete ? "Permanently Delete Opportunity?" : "Delete / Archive Opportunity?"}
              </h3>
              <p className="text-xs text-slate-500">
                &quot;{deleteConfirmOpp.title}&quot; at <strong>{deleteConfirmOpp.companyName}</strong>
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPermanentDelete}
                  onChange={(e) => setIsPermanentDelete(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>Permanent Delete (Superadmin only)</span>
              </label>
              {isPermanentDelete ? (
                <p className="text-[11px] text-rose-700 font-medium">
                  This permanently removes this job from the Saarvi database. This action cannot be undone.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Default action: soft deletes / archives this listing, removing it from active search while preserving audit history.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpp(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                {isPermanentDelete ? "Permanently Delete" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOB DIAGNOSTICS INSPECTOR MODAL */}
      {diagnosticsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Canonical Job Diagnostics</h3>
              </div>
              <button
                type="button"
                onClick={() => setDiagnosticsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {diagnosticsLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Running canonical route &amp; database integrity check...
              </div>
            ) : diagnosticsData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-700">Integrity Health:</span>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                      diagnosticsData.health === "HEALTHY"
                        ? "bg-emerald-100 text-emerald-800"
                        : diagnosticsData.health === "REQUIRES_REVIEW"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {diagnosticsData.health}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Canonical ID</span>
                    <span className="font-mono text-slate-900 break-all">{diagnosticsData.canonicalId}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Provider &amp; Source ID</span>
                    <span className="font-mono text-slate-900 break-all">{diagnosticsData.provider}: {diagnosticsData.providerJobId}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Review State</span>
                    <span className="font-bold text-slate-800">{diagnosticsData.reviewState}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Publication State</span>
                    <span className="font-bold text-slate-800">{diagnosticsData.publicationState}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Record State</span>
                    <span className="font-bold text-slate-800">{diagnosticsData.recordState}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Verification State</span>
                    <span className="font-bold text-slate-800">{diagnosticsData.verificationState}</span>
                  </div>
                </div>

                {diagnosticsData.healthIssues && diagnosticsData.healthIssues.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                    <span className="font-bold block">Integrity Notices:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {diagnosticsData.healthIssues.map((issue: string, idx: number) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <a
                    href={`/jobs/${diagnosticsData.canonicalId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
                  >
                    <span>Test Route (/jobs/{diagnosticsData.canonicalId})</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDiagnosticsModalOpen(false)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
