"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Download,
  Sun,
  Shield,
  CheckCircle2,
  Database,
  FileJson,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { preferencesService } from "@/lib/services/preferencesService";
import { conversionHistoryService } from "@/lib/services/conversionHistoryService";
import { resumeService } from "@/lib/services/resumeService";
import { useAuth } from "@/context/AuthContext";

type ToastType = "success" | "error";
interface Toast { message: string; type: ToastType }

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [autoDownload, setAutoDownload] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const prefs = await preferencesService.getPreferences();
        setAutoDownload(prefs.autoDownload);
      } catch {
        console.error("Failed to load preferences.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  const handleToggleAutoDownload = async (val: boolean) => {
    setAutoDownload(val);
    try {
      await preferencesService.updatePreferences({ autoDownload: val });
      showToast("Settings saved.", "success");
    } catch {
      showToast("Couldn't save settings. Please try again.", "error");
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const [history, resumes] = await Promise.all([
        conversionHistoryService.getHistory(),
        resumeService.getResumes(),
      ]);

      // Explicitly construct export — no document contents, only safe metadata
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        exportedBy: "Saarvi",
        notice: "This export contains only metadata and structured data. No document file contents are stored or exported.",
        profile: {
          id: user.id,
          email: user.email,
          fullName: profile?.fullName || user.fullName || "",
          accountCreated: user.createdAt,
        },
        preferences: {
          autoDownload,
          theme: "light",
        },
        conversionHistory: history.map((h) => ({
          id: h.id,
          toolId: h.toolId,
          toolName: h.toolName,
          inputFilename: h.inputFilename,
          outputFilename: h.outputFilename,
          inputSize: h.inputSize,
          outputSize: h.outputSize,
          status: h.status,
          processingTimeMs: h.processingTimeMs,
          createdAt: h.createdAt,
        })),
        resumes: resumes.map((r) => ({
          id: r.id,
          title: r.title,
          template: r.template,
          content: r.content,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saarvi-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast("Your data has been exported.", "success");
    } catch {
      showToast("Couldn't export your data. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-blue-600" />
          <span>Workspace Settings</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your preferences, privacy, and account data
        </p>
      </div>

      {/* 1. AUTO-DOWNLOAD */}
      <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">Automatic Download</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
              When enabled, a 3-second countdown automatically triggers download once
              client-side conversion finishes. You can always click &quot;Download Now&quot; to
              save immediately.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1" aria-label="Toggle automatic download">
            <input
              type="checkbox"
              id="auto-download-toggle"
              checked={autoDownload}
              disabled={loading}
              onChange={(e) => handleToggleAutoDownload(e.target.checked)}
              className="sr-only peer"
              role="switch"
              aria-checked={autoDownload}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>
      </div>

      {/* 2. INTERFACE THEME */}
      <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-500" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">Interface Theme</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
          Saarvi is optimized with a clean, high-contrast white aesthetic for readable document
          previews and distraction-free work.
        </p>
        <div className="pt-2 flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-xl border-2 border-blue-600 bg-blue-50/50 flex items-center gap-2 text-xs font-bold text-blue-900">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Pure Light Theme (Default)</span>
          </div>
        </div>
      </div>

      {/* 3. PRIVACY EXPLANATION */}
      <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">Privacy & Data</h3>
        </div>

        <div className="space-y-4 text-xs text-slate-600">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <p className="font-bold text-slate-800">Your files</p>
            <p className="leading-relaxed">
              Supported conversions (JPG ↔ PDF, Compress, Image Resize, etc.) happen entirely
              inside your browser. Your document bytes <strong>never leave your device</strong> for
              these operations.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <p className="font-bold text-slate-800">Your history</p>
            <p className="leading-relaxed">
              After a conversion completes, Saarvi records only{" "}
              <strong>operational metadata</strong>: tool name, file sizes, processing duration, and
              timestamp. No file content, no text, no image data is transmitted or stored.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <p className="font-bold text-slate-800">Your resumes</p>
            <p className="leading-relaxed">
              Resume drafts are stored as{" "}
              <strong>structured JSON data</strong> (contact info, sections, experience entries).
              This data is protected by Row Level Security — only your account can access it.
            </p>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" aria-hidden="true" />
            <span>
              Saarvi does not claim 100% security. Like all cloud services, residual risks exist.
              Never store sensitive credentials or financial data in resume drafts.
            </span>
          </div>
        </div>
      </div>

      {/* 4. DATA EXPORT */}
      <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">Download My Data</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Export a complete copy of your account data as a JSON file. This includes your profile,
          conversion history metadata, resume drafts, and preferences. No document files are
          included — only the metadata and structured data Saarvi stores.
        </p>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting || !user}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            aria-label="Export account data as JSON"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Preparing export…</span>
              </>
            ) : (
              <>
                <FileJson className="w-4 h-4" aria-hidden="true" />
                <span>Export Account Data</span>
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          The exported file does not contain any document contents. Only metadata, resume JSON
          drafts, and preferences are included.
        </p>
      </div>

      {/* 5. DANGER ZONE SHORTCUT */}
      <div className="p-6 bg-red-50/50 border border-red-200 rounded-3xl space-y-3">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden="true" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Danger Zone</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
          To permanently delete your account and all associated workspace data, go to your Profile
          page.
        </p>
        <a
          href="/dashboard/profile"
          className="inline-flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700 underline"
        >
          Go to Profile → Delete Account
        </a>
      </div>

    </div>
  );
}
