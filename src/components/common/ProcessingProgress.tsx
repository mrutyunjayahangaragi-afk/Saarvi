"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { SaarviLoadingLogo } from "@/components/brand/SaarviLoadingLogo";

export type ProcessingState =
  | "IDLE"
  | "FILE_SELECTED"
  | "VALIDATING"
  | "PROCESSING"
  | "RESULT_READY"
  | "COUNTDOWN"
  | "DOWNLOADING"
  | "COMPLETED"
  | "ERROR"
  | "CANCELLED";

interface ProcessingProgressProps {
  state: ProcessingState;
  percent: number; // 0 to 100
  statusMessage?: string;
  errorMessage?: string;
  onCancel?: () => void;
}

export default function ProcessingProgress({
  state,
  percent,
  statusMessage,
  errorMessage,
  onCancel,
}: ProcessingProgressProps) {
  if (
    state === "IDLE" ||
    state === "FILE_SELECTED" ||
    state === "RESULT_READY" ||
    state === "COUNTDOWN" ||
    state === "DOWNLOADING"
  ) {
    return null;
  }

  const isProcessing = state === "PROCESSING" || state === "VALIDATING";

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {isProcessing ? (
            /* Official Saarvi S-Logo Loading Animation */
            <div className="relative w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-900 flex items-center justify-center shrink-0">
              <SaarviLoadingLogo size={36} state="loading" />
            </div>
          ) : state === "COMPLETED" ? (
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-check-pop shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
          )}

          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {state === "VALIDATING" && "Validating document..."}
              {state === "PROCESSING" && (statusMessage || "Processing in browser...")}
              {state === "COMPLETED" && "Processing Complete"}
              {state === "ERROR" && "Processing Failed"}
              {state === "CANCELLED" && "Processing Cancelled"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isProcessing && "Processing locally on your device • No server upload"}
              {state === "COMPLETED" && "Your processed document is ready."}
              {state === "ERROR" && (errorMessage || "An unexpected error occurred.")}
            </p>
          </div>
        </div>

        {isProcessing && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors self-start sm:self-center cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {isProcessing && (
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>{percent > 0 ? `${percent}%` : "Executing engine..."}</span>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              {percent === 100 ? "Finalizing Blob" : "In-Memory"}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Document processing progress"
            className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5"
          >
            {percent > 0 ? (
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            ) : (
              <div className="h-full w-2/5 bg-blue-600 rounded-full animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
