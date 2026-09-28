"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
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
} from "lucide-react";
import type { ResumeTemplateDefinition } from "@/types/career";
import { useAuth } from "@/context/AuthContext";

export default function AdminResumeTemplatesPage() {
  const { user, profile } = useAuth();
  const [templates, setTemplates] = useState<ResumeTemplateDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ResumeTemplateDefinition | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/admin/career/templates");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.templates)) {
          setTemplates(data.templates);
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
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3000);
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

  const handleDuplicate = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", id }),
      });
      if (res.ok) {
        showToast("Template duplicated successfully");
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

  const handleQuickUpdate = async (id: string, updates: Partial<ResumeTemplateDefinition>) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;

    setSavingId(id);
    try {
      const updated = { ...tpl, ...updates };
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", template: updated }),
      });
      if (res.ok) {
        showToast("Template updated");
        await fetchTemplates(true);
      } else {
        throw new Error("Failed to update template");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating template";
      showToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm("Are you sure you want to reset all templates to system defaults? Any custom modifications will be reverted.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        showToast("All templates successfully reset to factory defaults");
        await fetchTemplates(true);
      } else {
        throw new Error("Failed to reset templates");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error resetting templates";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (tpl: ResumeTemplateDefinition) => {
    setEditingTemplate({ ...tpl });
    setIsCreatingNew(false);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    const newTpl: ResumeTemplateDefinition = {
      id: `custom-template-${Date.now().toString(36)}`,
      name: "New Custom Template",
      description: "Custom designed resume layout for specialized job profiles.",
      category: "STANDARD",
      isActive: true,
      isPro: false,
      isFeatured: false,
      sortOrder: templates.length + 1,
      primaryColor: "#2563eb",
      fontFamily: "Inter, sans-serif",
      layout: "single-column",
      badges: ["Custom"],
    };
    setEditingTemplate(newTpl);
    setIsCreatingNew(true);
    setIsModalOpen(true);
  };

  const openCreateFromReferenceModal = () => {
    const newTpl: ResumeTemplateDefinition = {
      id: `recreation-${Date.now().toString(36)}`,
      name: "Clean-Room Recreated Template",
      description: "Original clean-room recreation capturing geometric balance, typography, and content density.",
      category: "STANDARD",
      isActive: true,
      isPro: false,
      isFeatured: false,
      sortOrder: templates.length + 1,
      primaryColor: "#0284c7",
      fontFamily: "Inter, Helvetica, Arial, sans-serif",
      layout: "single-column",
      badges: ["Recreated", "Geometric ATS"],
      sourceType: "REFERENCE_RECREATION",
      licenseNote: "Clean-room geometric recreation. Zero copyrighted commercial assets or SVGs used.",
      referenceSourceNotes: "Geometric reference: clean typography hierarchy, 24px margins, high ATS density.",
    };
    setEditingTemplate(newTpl);
    setIsCreatingNew(true);
    setIsModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!editingTemplate) return;
    setModalSaving(true);
    try {
      const res = await fetch("/api/admin/career/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", template: editingTemplate }),
      });
      if (res.ok) {
        showToast(isCreatingNew ? "New template created" : "Template changes saved");
        setIsModalOpen(false);
        setEditingTemplate(null);
        await fetchTemplates(true);
      } else {
        throw new Error("Failed to save template");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving template";
      showToast(msg, "error");
    } finally {
      setModalSaving(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === "ALL" || tpl.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [templates, searchQuery, categoryFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Resume Builder Templates</h1>
              <p className="text-xs text-slate-500">
                Authoritative catalog of ATS and visual resume templates available to students.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/student/resume"
            target="_blank"
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Live Student Builder</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>

          <button
            onClick={() => fetchTemplates(true)}
            disabled={refreshing}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            title="Refresh Templates"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleResetToDefaults}
            className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 hover:border-rose-200 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Factory Defaults</span>
          </button>

          <button
            onClick={openCreateFromReferenceModal}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 shadow-2xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            title="Clean-room geometric recreation of layouts without commercial copyright copying"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Create from Reference</span>
          </button>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Template</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by title, id, or description..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {["ALL", "STANDARD", "TECHNICAL", "ACADEMIC", "CREATIVE", "EXECUTIVE"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer capitalize text-xs ${
                categoryFilter === cat
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              {cat.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
          Loading templates catalog...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
          No resume templates found matching criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((tpl) => {
            const isSaving = savingId === tpl.id;
            return (
              <div
                key={tpl.id}
                className={`bg-white rounded-3xl border transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col justify-between overflow-hidden ${
                  tpl.isActive ? "border-slate-200/90" : "border-slate-200/50 opacity-60 bg-slate-50/50"
                }`}
              >
                {/* Visual Top Preview Frame */}
                <div className="p-5 pb-3 border-b border-slate-100 bg-linear-to-b from-slate-50/80 to-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: tpl.primaryColor }}
                        />
                        <h3 className="font-bold text-slate-900 text-sm leading-snug">{tpl.name}</h3>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{tpl.id}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {tpl.isFeatured && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                          <Flame className="w-2.5 h-2.5 fill-current" /> Featured
                        </span>
                      )}
                      {tpl.isPro ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 border border-purple-200">
                          PRO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                          FREE
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-2.5 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>

                  {/* Template Meta Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-3 text-[10px] font-semibold text-slate-600">
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200/60 uppercase font-mono">
                      {tpl.category}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200/60">
                      {tpl.layout}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200/60 truncate max-w-[130px]">
                      {tpl.fontFamily.split(",")[0]}
                    </span>
                  </div>
                </div>

                {/* Bottom Control Actions */}
                <div className="p-4 bg-white flex items-center justify-between gap-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {/* Active toggle */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleToggleActive(tpl.id, tpl.isActive)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1 ${
                        tpl.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {tpl.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{tpl.isActive ? "Active" : "Hidden"}</span>
                    </button>

                    {/* Pro tier toggle */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleQuickUpdate(tpl.id, { isPro: !tpl.isPro })}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                        tpl.isPro
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                      title="Toggle Pro required"
                    >
                      {tpl.isPro ? "Pro Only" : "Free Tier"}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Duplicate button */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleDuplicate(tpl.id)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Duplicate Template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Edit configuration button */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => openEditModal(tpl)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Modal */}
      {isModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {isCreatingNew ? "Create Resume Template" : "Edit Resume Template"}
                </h3>
                <span className="font-mono text-xs text-slate-400">{editingTemplate.id}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Template Display Name</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={editingTemplate.category}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="ACADEMIC">Academic</option>
                    <option value="CREATIVE">Creative</option>
                    <option value="EXECUTIVE">Executive</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Layout</label>
                  <select
                    value={editingTemplate.layout}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, layout: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="single-column">Single Column (ATS standard)</option>
                    <option value="two-column-left">Two Column (Left Sidebar)</option>
                    <option value="two-column-right">Two Column (Right Sidebar)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Primary Color Accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingTemplate.primaryColor}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })}
                      className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={editingTemplate.primaryColor}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Font Family</label>
                  <select
                    value={editingTemplate.fontFamily}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                  >
                    <option value="Inter, Helvetica, Arial, sans-serif">Inter (Modern Clean)</option>
                    <option value="Georgia, Cambria, 'Times New Roman', serif">Georgia (Executive Serif)</option>
                    <option value="system-ui, -apple-system, sans-serif">System UI (Ultra-fast)</option>
                    <option value="Inter, Outfit, sans-serif">Outfit & Inter (Modern Tech)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingTemplate.isActive}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Active & Visible to Students</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingTemplate.isPro}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, isPro: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Require Pro Plan</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingTemplate.isFeatured}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, isFeatured: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Featured</span>
                </label>
              </div>

              {/* Clean-Room Recreation & Intellectual Property Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    Clean-Room Recreation & Licensing
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Antigravity License Compliance
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Source Type</label>
                    <select
                      value={editingTemplate.sourceType || "ORIGINAL"}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          sourceType: e.target.value as "ORIGINAL" | "REFERENCE_RECREATION",
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="ORIGINAL">Original Saarvi Design</option>
                      <option value="REFERENCE_RECREATION">Reference Clean-Room Recreation</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">License Note</label>
                    <input
                      type="text"
                      value={editingTemplate.licenseNote || ""}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, licenseNote: e.target.value })}
                      placeholder="e.g. Clean-room geometric recreation"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Geometric Reference Notes</label>
                  <input
                    type="text"
                    value={editingTemplate.referenceSourceNotes || ""}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, referenceSourceNotes: e.target.value })
                    }
                    placeholder="e.g. Single column layout, 1.25 line height, 16px section margins. Zero commercial art copied."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSaving}
                onClick={handleSaveModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                {modalSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
