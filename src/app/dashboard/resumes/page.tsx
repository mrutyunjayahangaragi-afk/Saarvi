"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  Shield,
  ExternalLink,
  Clock,
} from "lucide-react";
import { resumeService } from "@/lib/services/resumeService";
import { SavedResumeDraft } from "@/types/auth";
import { SAMPLE_STUDENT_RESUME } from "@/lib/tools/resume/starter-data";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import EmptyState from "@/components/dashboard/EmptyState";
import SkeletonCard from "@/components/dashboard/SkeletonCard";

const RESUME_TEMPLATES = [
  { id: "ats-classic", label: "ATS Classic", desc: "Single-column high-scoring ATS format" },
  { id: "ats-modern", label: "ATS Modern", desc: "Clean modern layout with section dividers" },
  { id: "student-clean", label: "Student Clean", desc: "Tailored for college & internship applications" },
];

function getTemplateName(id: string): string {
  return RESUME_TEMPLATES.find((t) => t.id === id)?.label ?? id.replace(/-/g, " ");
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type ToastType = "success" | "error";
interface Toast {
  message: string;
  type: ToastType;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<SavedResumeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState("ats-classic");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SavedResumeDraft | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function showToast(message: string, type: ToastType) {
    setToast({ message, type });
  }

  async function loadResumes() {
    try {
      const list = await resumeService.getResumes();
      setResumes(list);
    } catch {
      showToast("Couldn't load your saved resumes.", "error");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadResumes(); }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setActionLoading(true);
    try {
      await resumeService.createResume(
        newTitle,
        newTemplate,
        SAMPLE_STUDENT_RESUME as unknown as Record<string, unknown>
      );
      setNewTitle("");
      setIsCreating(false);
      showToast("Resume draft created.", "success");
      await loadResumes();
    } catch {
      showToast("Couldn't create resume draft.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      await resumeService.updateResume(id, { title: editTitle.trim() });
      setEditingId(null);
      showToast("Resume renamed.", "success");
      await loadResumes();
    } catch {
      showToast("Couldn't rename resume.", "error");
    }
  };

  const handleDuplicate = async (resume: SavedResumeDraft) => {
    try {
      await resumeService.duplicateResume(resume.id);
      showToast(`"${resume.title}" duplicated.`, "success");
      await loadResumes();
    } catch {
      showToast("Couldn't duplicate resume.", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await resumeService.deleteResume(deleteTarget.id);
      setDeleteTarget(null);
      showToast("Resume deleted.", "success");
      await loadResumes();
    } catch {
      showToast("Couldn't delete resume.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-blue-600" />
            <span>Saved Resumes</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Store, duplicate, and edit ATS-friendly structured resume drafts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="self-start sm:self-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 hover-3d-lift cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New Resume Draft</span>
        </button>
      </div>

      {/* PRIVACY NOTICE */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex items-start gap-3 text-xs text-blue-900">
        <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-bold">Structured Data Privacy</p>
          <p className="text-blue-800 leading-relaxed">
            Your resume data is protected by Row Level Security (RLS). Only your authenticated
            account can read, edit, or delete these records. No public URLs or remote file storage
            are used.
          </p>
        </div>
      </div>

      {/* CREATE NEW RESUME PANEL */}
      {isCreating && (
        <div className="p-6 bg-white border border-blue-200 rounded-3xl shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Create New Resume Draft</h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Close create resume panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="resume-title" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Resume Title
              </label>
              <input
                id="resume-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Software Engineering Resume 2026"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Template Format
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Resume template">
                {RESUME_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={newTemplate === tpl.id}
                    onClick={() => setNewTemplate(tpl.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newTemplate === tpl.id
                        ? "border-blue-600 bg-blue-50/70 text-blue-900"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <p className="text-xs font-bold">{tpl.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {actionLoading ? "Creating…" : "Save Draft"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESUMES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </>
        ) : resumes.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200/90 rounded-3xl">
            <EmptyState
              icon={FileText}
              title="Create your first resume"
              description="Build a professional resume and save it to your Saarvi account. Choose from ATS-optimized templates."
              ctaLabel="Create Resume"
              onCtaClick={() => setIsCreating(true)}
            />
          </div>
        ) : (
          resumes.map((resume) => (
            <div
              key={resume.id}
              className="p-5 bg-white border border-slate-200/90 rounded-3xl shadow-xs hover:shadow-md transition-all hover-3d-lift flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Template badge + actions */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {getTemplateName(resume.template)}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(resume)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      aria-label={`Duplicate "${resume.title}"`}
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(resume)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      aria-label={`Delete "${resume.title}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Title / Rename */}
                {editingId === resume.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(resume.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                      autoFocus
                      aria-label="Edit resume title"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(resume.id)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                      aria-label="Save new title"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                      aria-label="Cancel rename"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2 group/title">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">
                      {resume.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(resume.id);
                        setEditTitle(resume.title);
                      }}
                      className="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
                      aria-label={`Rename "${resume.title}"`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>Updated {formatRelativeDate(resume.updatedAt)}</span>
                </div>
              </div>

              {/* Bottom action: Edit in Resume Builder */}
              <div className="pt-3 border-t border-slate-100">
                <Link
                  href={`/student/resume`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
                  aria-label={`Edit "${resume.title}" in Resume Builder`}
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Edit in Resume Builder</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This saved resume will be permanently removed from your account. Your personal data is not affected."
        confirmLabel="Delete Resume"
        isDangerous
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  );
}
