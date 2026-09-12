"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  FileCheck,
  X,
  Loader2,
  Copy,
  Check,
  ShieldAlert,
} from "lucide-react";
import { ResumeVersion } from "@/types/career";
import { ResumeFeedbackResult } from "@/types/ai";
import { hasGivenConsent, recordConsent } from "@/lib/ai/consent/consent-manager";

interface AIResumeFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  resume: ResumeVersion;
}

export function AIResumeFeedbackModal({
  isOpen,
  onClose,
  resume,
}: AIResumeFeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<ResumeFeedbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState<boolean>(!hasGivenConsent());
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  if (!isOpen) return null;

  const buildResumeText = () => {
    let text = `Resume: ${resume.name}\nTarget Role: ${resume.targetRole || "Software Engineer"}\n\n`;
    if (resume.summaryOverride) text += `PROFESSIONAL SUMMARY:\n${resume.summaryOverride}\n\n`;
    return text;
  };

  const handleRequestFeedback = async () => {
    setLoading(true);
    setError(null);

    try {
      const resumeText = buildResumeText();
      const res = await fetch("/api/ai/resume-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          targetRole: resume.targetRole,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Feedback failed." }));
        throw new Error(err.error || "Failed to generate AI feedback.");
      }

      const data = await res.json();
      setFeedback(data.result);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "AI feedback is temporarily unavailable. Local resume editing remains unaffected."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConsentAndStart = () => {
    recordConsent();
    setNeedsConsent(false);
    handleRequestFeedback();
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(id);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Resume Review & Feedback</h2>
              <p className="text-xs text-slate-400">
                AI suggestion layer • Deterministic ATS layout checks remain authoritative
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-5 space-y-5 text-sm">
          {/* Privacy Consent Step */}
          {needsConsent && !feedback && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <ShieldAlert className="h-4 w-4" />
                EXTERNAL PROCESSING CONSENT
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                To evaluate your resume text, only your summary, role, and skills text will be sent
                to an external AI provider. Your personal contact details, grades, and payment
                records are never transmitted.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConsentAndStart}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Consent & Analyze
                </button>
              </div>
            </div>
          )}

          {/* Initial Trigger button if already consented */}
          {!needsConsent && !feedback && !loading && !error && (
            <div className="text-center py-8 space-y-4">
              <div className="p-3 w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-semibold text-white">Review &ldquo;{resume.name}&rdquo;</h3>
                <p className="text-xs text-slate-400">
                  Target Role: <strong className="text-slate-200">{resume.targetRole || "Software Engineer"}</strong>
                </p>
                <p className="text-xs text-slate-400">
                  Analyze strengths, missing keyword areas, and bullet-point clarity without altering your stored resume records.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRequestFeedback}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
              >
                <Sparkles className="w-4 h-4" />
                Generate AI Feedback
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-300">Analyzing resume content...</p>
              <p className="text-[11px] text-slate-500">
                Evaluating clarity, impact verbs, and keyword alignment
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3 text-center">
              <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
              <p className="text-xs text-red-300">{error}</p>
              <button
                type="button"
                onClick={handleRequestFeedback}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* Results Display */}
          {feedback && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Disclaimer */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs text-slate-300 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">AI suggestions are advisory:</strong> Review and choose
                  which recommendations to apply. Deterministic formatting checks remain authoritative.
                </span>
              </div>

              {/* Strengths */}
              {feedback.strengths.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Key Strengths
                  </h4>
                  <div className="space-y-1.5">
                    {feedback.strengths.map((str, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2.5 text-xs text-slate-200"
                      >
                        {str}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {feedback.suggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Recommended Improvements (AI Suggestion)
                  </h4>
                  <div className="space-y-1.5">
                    {feedback.suggestions.map((sug, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-2 rounded-lg border border-indigo-500/20 bg-slate-800/60 p-2.5 text-xs text-slate-200"
                      >
                        <span>{sug}</span>
                        <button
                          onClick={() => handleCopyText(sug, `sug_${i}`)}
                          className="shrink-0 p-1 text-slate-400 hover:text-white"
                          title="Copy suggestion"
                        >
                          {copiedItem === `sug_${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Areas */}
              {feedback.missingAreas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Potential Gaps for {resume.targetRole || "Target Role"}
                  </h4>
                  <div className="space-y-1.5">
                    {feedback.missingAreas.map((gap, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2.5 text-xs text-slate-200"
                      >
                        {gap}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clarity Suggestions */}
              {feedback.claritySuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Clarity & Phrasing
                  </h4>
                  <div className="space-y-1.5">
                    {feedback.claritySuggestions.map((cls, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-cyan-500/20 bg-slate-800/60 p-2.5 text-xs text-slate-200"
                      >
                        {cls}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
          <span className="text-slate-500">Saarvi Career Privacy Engine</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
