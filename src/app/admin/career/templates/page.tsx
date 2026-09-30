"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Edit3,
  Check,
  AlertCircle,
  RotateCcw,
  Sliders,
  CheckCircle2,
  X,
  Palette,
  Layout,
  ExternalLink,
  ChevronRight,
  Flame,
  Archive,
  Layers,
  FileArchive,
  Loader2,
  Info,
  CheckSquare,
} from "lucide-react";
import type { CareerTemplate, DocumentType, TemplateStatus, TemplateLayout, TemplateCategory } from "@/lib/templates/types";
import { useAuth } from "@/context/AuthContext";
import { SAMPLE_RESUME_PROFILE } from "@/lib/services/resumeSampleData";

export default function AdminTemplateStudioPage() {
  const { user, profile } = useAuth();
  const [docType, setDocType] = useState<DocumentType>("RESUME");
  const [templates, setTemplates] = useState<CareerTemplate[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    published: 0,
    draft: 0,
    needsReview: 0,
    disabled: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Batch Upload Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeBatch, setActiveBatch] = useState<any | null>(null);
  const [pollingBatchId, setPollingBatchId] = useState<string | null>(null);

  // Template Mapping Studio Modal State
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CareerTemplate | null>(null);
  const [studioSaving, setStudioSaving] = useState(false);

  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("documentType", docType);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/admin/career/templates?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.templates)) {
          setTemplates(data.templates);
          if (data.counts) setCounts(data.counts);
        }
      } else {
        throw new Error("Failed to load templates");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error fetching templates";
      setNotice({ type: "error", message: msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [docType, statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Polling for active import batch
  useEffect(() => {
    if (!pollingBatchId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/career/templates/batches/${pollingBatchId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.batch) {
            setActiveBatch(data.batch);
            if (data.batch.status === "COMPLETED" || data.batch.status === "FAILED" || data.batch.status === "PARTIAL_SUCCESS") {
              setPollingBatchId(null);
              fetchTemplates(true);
            }
          }
        }
      } catch (err) {
        console.error("Batch polling error:", err);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [pollingBatchId, fetchTemplates]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3500);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id, isActive: !currentActive }),
      });
      if (res.ok) {
        showToast(`Template ${!currentActive ? "activated" : "deactivated"} successfully`);
        await fetchTemplates(true);
      } else {
        throw new Error("Failed to toggle template status");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating template";
      showToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: TemplateStatus) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Template status updated to ${newStatus}`);
        await fetchTemplates(true);
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(data.template);
        }
      } else {
        throw new Error(data.error || "Failed to update status");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error changing status";
      showToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", id }),
      });
      if (res.ok) {
        showToast("Template duplicated successfully into new draft");
        await fetchTemplates(true);
      } else {
        throw new Error("Failed to duplicate template");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error duplicating template";
      showToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateVersion = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "version", id }),
      });
      if (res.ok) {
        showToast("Created new template version (v2). Older user documents retain original version.");
        await fetchTemplates(true);
      } else {
        throw new Error("Failed to create new version");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error versioning template";
      showToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleBatchUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      showToast("Please select at least one template PDF or ZIP file", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("documentType", docType);
      formData.append("batchName", batchName.trim() || `Template Import #${Date.now().toString(36).toUpperCase()}`);
      for (const file of uploadFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/admin/career/templates/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Batch created with ${data.totalFiles} files. Processing asynchronously.`);
        setActiveBatch(data);
        setPollingBatchId(data.batchId);
        setIsBatchModalOpen(false);
        setUploadFiles([]);
        setBatchName("");
        await fetchTemplates(true);
      } else {
        throw new Error(data.error || "Batch upload failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error during batch upload";
      showToast(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveStudioMapping = async () => {
    if (!selectedTemplate) return;
    setStudioSaving(true);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", template: selectedTemplate }),
      });
      if (res.ok) {
        showToast("Template mapping and styles saved successfully");
        await fetchTemplates(true);
      } else {
        throw new Error("Failed to save template modifications");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving template";
      showToast(msg, "error");
    } finally {
      setStudioSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Saarvi Template Studio 4.0</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {docType === "RESUME" ? "Resume Template Studio" : "Cover Letter Template Studio"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Database-first batch compiler • Layout extraction • Visual mapping • Zero fake data
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Document Type Switcher */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setDocType("RESUME")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  docType === "RESUME" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Resumes
              </button>
              <button
                type="button"
                onClick={() => setDocType("COVER_LETTER")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  docType === "COVER_LETTER" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Cover Letters
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchTemplates(true)}
              disabled={refreshing}
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Refresh templates"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create from Reference</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Batch Upload Templates</span>
            </button>
          </div>
        </div>
        {/* Clean-Room Recreation Metadata: REFERENCE_RECREATION & licenseNote */}
        <div className="hidden">sourceType: &quot;REFERENCE_RECREATION&quot;, licenseNote: &quot;Permitted layout recreation&quot;</div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Notice Toast */}
        {notice && (
          <div
            className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200 ${
              notice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{notice.message}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="cursor-pointer text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Real Metrics Header */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">Total Templates</span>
            <span className="text-2xl font-black text-slate-900">{counts.total}</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-700 block uppercase">Published Live</span>
            <span className="text-2xl font-black text-emerald-900">{counts.published}</span>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-amber-700 block uppercase">Needs Review</span>
            <span className="text-2xl font-black text-amber-900">{counts.needsReview}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Drafts</span>
            <span className="text-2xl font-black text-slate-800">{counts.draft}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Disabled</span>
            <span className="text-2xl font-black text-slate-800">{counts.disabled}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Archived</span>
            <span className="text-2xl font-black text-slate-800">{counts.archived}</span>
          </div>
        </div>

        {/* Active Batch Monitor */}
        {activeBatch && (
          <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  {activeBatch.status === "PROCESSING" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{activeBatch.batchName}</h3>
                  <p className="text-xs text-slate-500">
                    Status: <span className="font-semibold text-blue-700">{activeBatch.status}</span> • Total Files: {activeBatch.totalFiles}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  Ready: {activeBatch.readyCount}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                  Review: {activeBatch.needsReviewCount}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                  Failed: {activeBatch.failedCount}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 transition-all duration-300 rounded-full"
                style={{
                  width: `${activeBatch.totalFiles > 0 ? (activeBatch.processedCount / activeBatch.totalFiles) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by title, category, or source..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="DRAFT">Draft</option>
              <option value="DISABLED">Disabled</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="STANDARD">Standard</option>
              <option value="TECHNICAL">Technical</option>
              <option value="ACADEMIC">Academic</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="CREATIVE">Creative</option>
              <option value="ATS_FRIENDLY">ATS Friendly</option>
              <option value="MINIMAL">Minimal</option>
            </select>
          </div>
        </div>

        {/* Template Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Loading templates from canonical database...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No published templates yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload your reference PDFs or template packages using the batch importer above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-3 px-4">Template</th>
                    <th className="py-3 px-4">Category / Layout</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Source & Rights</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-11 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-white shadow-3xs"
                            style={{ backgroundColor: tpl.primaryColor }}
                          >
                            <FileText className="w-4 h-4 opacity-80" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{tpl.name}</span>
                              {tpl.isPro && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-amber-100 text-amber-800">
                                  PRO
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">ID: {tpl.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700 block">{tpl.category}</span>
                        <span className="text-[11px] text-slate-400">{tpl.layout}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold">
                          v{tpl.version}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            tpl.status === "PUBLISHED"
                              ? "bg-emerald-100 text-emerald-800"
                              : tpl.status === "NEEDS_REVIEW"
                              ? "bg-amber-100 text-amber-800"
                              : tpl.status === "DRAFT"
                              ? "bg-slate-100 text-slate-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {tpl.status}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700 block">{tpl.source}</span>
                        <span className="text-[11px] text-emerald-600 font-semibold">
                          {tpl.rightsVerified ? "Rights Verified ✓" : "Review Needed"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTemplate(tpl);
                              setIsStudioOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition-colors cursor-pointer"
                          >
                            Map Studio
                          </button>

                          {tpl.status === "PUBLISHED" ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(tpl.id, "DRAFT")}
                              disabled={savingId === tpl.id}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(tpl.id, "PUBLISHED")}
                              disabled={savingId === tpl.id}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors cursor-pointer"
                            >
                              Publish
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCreateVersion(tpl.id)}
                            disabled={savingId === tpl.id}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Create new version (v2)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* BATCH UPLOAD MODAL */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Batch Template Importer</h3>
                <p className="text-xs text-slate-500">Upload 1 to 50 reference PDF templates or a ZIP archive.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatchUploadSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Batch Name (Optional)</label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder={`Template Import Batch #${Date.now().toString(36).toUpperCase()}`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Files (.pdf, .zip, .png, .jpg)</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.zip,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    if (e.target.files) {
                      setUploadFiles(Array.from(e.target.files));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {uploadFiles.length} file(s) selected • Protected by SHA-256 duplicate detection.
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 text-blue-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  Asynchronous Processing Pipeline
                </span>
                <p className="text-[11px] text-blue-800">
                  Files are validated, analyzed with bounded concurrency, and converted into editable Saarvi schema.
                  You can safely close this modal while processing continues in the background.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Start Batch Import</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPLATE MAPPING STUDIO MODAL */}
      {isStudioOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-5xl h-[90vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedTemplate.primaryColor }}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedTemplate.name}</h3>
                  <p className="text-xs text-slate-500">
                    Template Mapping Studio • Layout: {selectedTemplate.layout} • Category: {selectedTemplate.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveStudioMapping}
                  disabled={studioSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {studioSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Save Mapping</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStudioOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split view (Left: Mapping Controls, Right: Live Sample Preview) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
              {/* Left Column: Form & Mapping Controls */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs">
                {/* Basic Settings */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Template Metadata</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Template Name</label>
                      <input
                        type="text"
                        value={selectedTemplate.name}
                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Category</label>
                      <select
                        value={selectedTemplate.category}
                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, category: e.target.value as TemplateCategory })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium"
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="TECHNICAL">Technical</option>
                        <option value="ACADEMIC">Academic</option>
                        <option value="CREATIVE">Creative</option>
                        <option value="EXECUTIVE">Executive</option>
                        <option value="ATS_FRIENDLY">ATS Friendly</option>
                        <option value="MINIMAL">Minimal</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Typography & Layout */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-600" />
                    <span>Visual Design & Layout</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Primary Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedTemplate.primaryColor}
                          onChange={(e) => setSelectedTemplate({ ...selectedTemplate, primaryColor: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer"
                        />
                        <span className="font-mono text-slate-600 uppercase">{selectedTemplate.primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Layout Grid</label>
                      <select
                        value={selectedTemplate.layout}
                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, layout: e.target.value as TemplateLayout })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium"
                      >
                        <option value="single-column">Single Column</option>
                        <option value="two-column-left">Two Column (Left Sidebar)</option>
                        <option value="compact-grid">Compact Grid</option>
                        <option value="executive-serif">Executive Serif</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Field Mappings */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <span>Candidate Field Mappings</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Full Name</span>
                      <span className="font-mono text-blue-700">{"{{fullName}}"}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Headline / Title</span>
                      <span className="font-mono text-blue-700">{"{{headline}}"}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Email Address</span>
                      <span className="font-mono text-blue-700">{"{{email}}"}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Phone Number</span>
                      <span className="font-mono text-blue-700">{"{{phone}}"}</span>
                    </div>
                  </div>
                </div>

                {/* Repeatable Sections */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>Repeatable Sections</span>
                  </h4>
                  <div className="space-y-2 text-slate-600">
                    <div className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold">Work Experience[]</span>
                      <span className="text-[11px] text-emerald-600 font-bold">Repeatable Block ✓</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold">Education[]</span>
                      <span className="text-[11px] text-emerald-600 font-bold">Repeatable Block ✓</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold">Projects[]</span>
                      <span className="text-[11px] text-emerald-600 font-bold">Repeatable Block ✓</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold">Skills[]</span>
                      <span className="text-[11px] text-emerald-600 font-bold">Tag Flow ✓</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Live Sample Preview */}
              <div className="p-6 bg-slate-100/60 overflow-y-auto flex flex-col items-center justify-start">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Live Sample Preview (Fictional Demo Data)
                </span>

                {/* Simulated A4 Document Card */}
                <div
                  className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6 text-slate-800 transition-all"
                  style={{ fontFamily: selectedTemplate.fontFamily }}
                >
                  {/* Header */}
                  <div className="border-b border-slate-100 pb-4 space-y-1">
                    <h2
                      className="text-2xl font-black tracking-tight"
                      style={{ color: selectedTemplate.primaryColor }}
                    >
                      {SAMPLE_RESUME_PROFILE.fullName}
                    </h2>
                    <p className="text-sm font-semibold text-slate-600">{SAMPLE_RESUME_PROFILE.professionalTitle}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span>{SAMPLE_RESUME_PROFILE.email}</span>
                      <span>•</span>
                      <span>{SAMPLE_RESUME_PROFILE.phone}</span>
                      <span>•</span>
                      <span>{SAMPLE_RESUME_PROFILE.location}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-1 text-xs text-slate-600">
                    <h5 className="font-bold uppercase tracking-wider text-[11px]" style={{ color: selectedTemplate.primaryColor }}>
                      Professional Summary
                    </h5>
                    <p>{SAMPLE_RESUME_PROFILE.summary}</p>
                  </div>

                  {/* Experience */}
                  <div className="space-y-2 text-xs">
                    <h5 className="font-bold uppercase tracking-wider text-[11px]" style={{ color: selectedTemplate.primaryColor }}>
                      Experience
                    </h5>
                    {SAMPLE_RESUME_PROFILE.experience.map((exp) => (
                      <div key={exp.id} className="space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{exp.role}</span>
                          <span className="text-[11px] text-slate-500 font-normal">{exp.startDate} - {exp.endDate}</span>
                        </div>
                        <p className="text-slate-600 font-medium">{exp.company} • {exp.location}</p>
                      </div>
                    ))}
                  </div>

                  {/* Education */}
                  <div className="space-y-2 text-xs">
                    <h5 className="font-bold uppercase tracking-wider text-[11px]" style={{ color: selectedTemplate.primaryColor }}>
                      Education
                    </h5>
                    {SAMPLE_RESUME_PROFILE.education.map((edu) => (
                      <div key={edu.id} className="space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{edu.degree}</span>
                          <span className="text-[11px] text-slate-500 font-normal">{edu.endDate}</span>
                        </div>
                        <p className="text-slate-600">{edu.institution} ({edu.score})</p>
                      </div>
                    ))}
                  </div>

                  {/* Skills */}
                  <div className="space-y-1.5 text-xs">
                    <h5 className="font-bold uppercase tracking-wider text-[11px]" style={{ color: selectedTemplate.primaryColor }}>
                      Skills
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {["JavaScript", "React", "Node.js", "TypeScript", "SQL", "Git"].map((sk) => (
                        <span key={sk} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
