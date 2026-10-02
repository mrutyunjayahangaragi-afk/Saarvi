"use client";

import React, { useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  X,
  Loader2,
  Copy,
  Check,
  ShieldAlert,
  ArrowRight,
  Tag,
} from "lucide-react";
import { JobAnalysisResult } from "@/types/ai";
import { hasGivenConsent, recordConsent } from "@/lib/ai/consent/consent-manager";

interface AIJobDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateSkills: string[];
}

export function AIJobDescriptionModal({
  isOpen,
  onClose,
  candidateSkills,
}: AIJobDescriptionModalProps) {
  const [jobText, setJobText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState<boolean>(!hasGivenConsent());

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!jobText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/job-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobText,
          candidateSkills,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Analysis failed." }));
        throw new Error(err.error || "Failed to analyze job description.");
      }

      const data = await res.json();
      setResult(data.result);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "AI job analysis is temporarily unavailable. Deterministic matching remains active."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConsentAndStart = () => {
    recordConsent();
    setNeedsConsent(false);
    handleAnalyze();
  };

  // Deterministic matching of candidate skills against required skills
  const candidateSkillSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  if (result) {
    const allRequired = [...result.requiredSkills, ...result.preferredSkills];
    for (const skill of allRequired) {
      if (candidateSkillSet.has(skill.toLowerCase().trim())) {
        matchedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111c38] p-6 shadow-2xl text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Job Description Skill Matcher
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deterministic Set-matching + AI requirement extraction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-5 space-y-5 text-sm">
          {/* Privacy Consent Step */}
          {needsConsent && !result && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                EXTERNAL PROCESSING CONSENT
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                To extract skills and keywords, only the pasted job description text will be
                processed by an external AI service. Your personal profile data, academic grades,
                and payment details are never shared.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConsentAndStart}
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                >
                  Consent & Continue
                </button>
              </div>
            </div>
          )}

          {/* Job Description Text Input */}
          {!result && !loading && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Paste Job Description / Vacancy Notice:
              </label>
              <textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                placeholder="Paste the complete job post, responsibilities, or requirements section here..."
                rows={8}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/70 p-4 font-mono text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-[#0d162e] focus:outline-none transition-colors"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!jobText.trim()}
                  onClick={needsConsent ? () => setNeedsConsent(true) : handleAnalyze}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  Analyze Job Requirements
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Extracting job requirements...</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Parsing skills, qualifications, and core keywords
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 p-4 space-y-3 text-center">
              <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 mx-auto" />
              <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{error}</p>
              <button
                type="button"
                onClick={handleAnalyze}
                className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Result View */}
          {result && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 p-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Identified Target Role</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{result.role}</h3>
              </div>

              {/* Section 1: Deterministic Skill Matching */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0e172e] p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Deterministic Skill Matching (Authoritative)
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
                    {matchedSkills.length}/{matchedSkills.length + missingSkills.length} matches
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                      Matched Skills ({matchedSkills.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.map((s, i) => (
                        <span
                          key={i}
                          className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                        >
                          {s}
                        </span>
                      ))}
                      {matchedSkills.length === 0 && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 italic">No direct matches.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block mb-1">
                      Missing Target Skills ({missingSkills.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {missingSkills.map((s, i) => (
                        <span
                          key={i}
                          className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: AI Explanatory Suggestions */}
              <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/30 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Key Responsibilities & Keywords (AI Suggestion)
                </h4>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Core Responsibilities:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {result.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {result.keywords.length > 0 && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-900/50">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      High-Frequency Resume Keywords:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 shadow-2xs"
                        >
                          <Tag className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setResult(null)}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Analyze Another Job
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
