import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  RefreshCw,
  FileArchive,
  File as FileIcon,
  Loader2,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { SingleFileResult, MultiFileResult } from "@/lib/tools/types";
import { useAutoDownload } from "@/hooks/useAutoDownload";
import { useAuth } from "@/context/AuthContext";

interface ResultDownloadProps {
  result: SingleFileResult | MultiFileResult;
  onReset: () => void;
}

export default function ResultDownload({ result, onReset }: ResultDownloadProps) {
  const { user } = useAuth();
  const [dismissPrompt, setDismissPrompt] = useState(false);
  const isSingle = result.type === "single";

  // Determine primary blob & filename for auto-download
  const targetBlob = isSingle ? result.blob : result.zipBlob;
  const targetFilename = isSingle ? result.filename : result.zipFilename;
  const isZip = !isSingle;
  const resultId = `${targetFilename}_${targetBlob?.size || 0}_${isZip ? "zip" : "single"}`;

  // Auto-download controller hook (real client blob)
  const {
    status: autoStatus,
    secondsRemaining,
    autoDownloadEnabled,
    toggleAutoDownload,
    downloadNow,
    cancelAutoDownload,
    downloadAgain
  } = useAutoDownload({
    blob: targetBlob,
    filename: targetFilename,
    isZip,
    delaySeconds: 3,
    resultId,
  });

  // Size calculations
  const originalBytes = result.originalSize;
  const newBytes = result.newSize;
  const byteDiff = originalBytes - newBytes;
  const percentSaved = originalBytes > 0 ? Math.round((byteDiff / originalBytes) * 100) : 0;

  // Derive thumbnail image preview safely
  const imagePreviewUrl = useMemo(() => {
    if (!isSingle || !result.blob) return null;
    const isImg =
      result.filename.toLowerCase().endsWith(".jpg") ||
      result.filename.toLowerCase().endsWith(".jpeg") ||
      result.filename.toLowerCase().endsWith(".png") ||
      result.filename.toLowerCase().endsWith(".webp");

    return isImg ? URL.createObjectURL(result.blob) : null;
  }, [isSingle, result]);

  // Clean up object URL when unmounted
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        try {
          URL.revokeObjectURL(imagePreviewUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [imagePreviewUrl]);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs transition-all">
      
      {/* SUCCESS HEADER: Checkmark drawing animation + headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs animate-check-pop shrink-0">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Your file is ready
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              100% processed in your browser • Ready for secure download
            </p>
          </div>
        </div>

        {/* Auto-download preference switch */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <label className="text-xs text-slate-600 flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoDownloadEnabled}
              onChange={toggleAutoDownload}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-[11px]">Auto-download</span>
          </label>
        </div>
      </div>

      {/* AUTO-DOWNLOAD COUNTDOWN BANNER */}
      {autoDownloadEnabled && autoStatus === "COUNTDOWN" && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {secondsRemaining}
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-950">
                Download starts in {secondsRemaining} second{secondsRemaining !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-blue-700">
                Click Download Now to save instantly, or Cancel to pause.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadNow}
              className="px-4 py-2 sm:py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl transition-all duration-150 shadow-xs cursor-pointer min-h-[38px] sm:min-h-0 inline-flex items-center justify-center"
            >
              Download Now
            </button>
            <button
              type="button"
              onClick={cancelAutoDownload}
              className="px-3.5 py-2 sm:py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[38px] sm:min-h-0 inline-flex items-center justify-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status when downloading */}
      {autoStatus === "DOWNLOADING" && (
        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-3 text-blue-900 text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Starting browser download...</span>
        </div>
      )}

      {/* Status when completed */}
      {autoStatus === "COMPLETED" && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-emerald-900 text-xs">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            File downloaded successfully to your device.
          </span>
          <button
            type="button"
            onClick={downloadAgain}
            className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
          >
            Download again
          </button>
        </div>
      )}

      {/* 3D LAYERED RESULT DOCUMENT CARD */}
      <div className="relative group">
        {/* Layered paper background shadows */}
        <div
          className="absolute inset-0 rounded-2xl bg-slate-100 border border-slate-200 translate-y-1.5 scale-[0.98] -z-10 transition-transform group-hover:translate-y-2"
          aria-hidden="true"
        />

        <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* File info with thumbnail/icon */}
            <div className="flex items-center gap-4 min-w-0">
              {imagePreviewUrl ? (
                <div className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shrink-0 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Processed output preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                  {isZip ? <FileArchive className="w-7 h-7" /> : <FileIcon className="w-7 h-7" />}
                </div>
              )}

              <div className="min-w-0 space-y-1">
                <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {targetFilename}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono">{formatBytes(newBytes)}</span>
                  {byteDiff > 0 && originalBytes > 0 && (
                    <span className="text-emerald-600 font-medium">
                      ({percentSaved}% smaller)
                    </span>
                  )}
                  {byteDiff < 0 && originalBytes > 0 && (
                    <span className="text-slate-400">
                      (Original: {formatBytes(originalBytes)})
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
                    {isZip ? "ZIP Archive" : targetFilename.split(".").pop()}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Action Button */}
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <button
                type="button"
                onClick={downloadNow}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl transition-all duration-150 flex items-center gap-2 shadow-xs hover:shadow hover-3d-lift min-h-[44px] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Now</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* GUEST POST-DOWNLOAD ACCOUNT PROMOTION BANNER (NON-INTRUSIVE) */}
      {!user && !dismissPrompt && (
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Want to keep track of your work?</p>
              <p className="text-slate-500">Create a free account to save conversion history and resume drafts.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Link
              href="/signup"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-xs text-xs"
            >
              Create free account
            </Link>
            <button
              type="button"
              onClick={() => setDismissPrompt(true)}
              className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 font-medium rounded-xl text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* RESULT FOOTER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadAgain}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Again</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 transition-colors flex items-center gap-1.5 font-semibold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Convert another</span>
        </button>
      </div>

    </div>
  );
}
