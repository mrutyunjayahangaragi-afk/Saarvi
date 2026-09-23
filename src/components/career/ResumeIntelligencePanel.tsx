"use client";

import { useState } from "react";
import {
  parseResumeFile,
  ParsedResumeDocument,
} from "@/lib/resume/parser/document-parser";
import {
  evaluateResumeAts,
  ComprehensiveAtsReport,
} from "@/lib/resume/ats-engine";
import {
  matchResumeAgainstJobDescription,
  JobSpecificMatchResult,
} from "@/lib/resume/job-matcher";
import { CareerProfile, ResumeVersion } from "@/types/career";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Briefcase,
  Search,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  X,
  Layers,
  Award,
  BookOpen,
} from "lucide-react";

interface ResumeIntelligencePanelProps {
  profile: CareerProfile | null;
  activeVersion?: ResumeVersion | null;
  onApplyParsedProfile?: (extracted: Partial<CareerProfile>) => void;
}

export function ResumeIntelligencePanel({
  profile,
  activeVersion,
  onApplyParsedProfile,
}: ResumeIntelligencePanelProps) {
  const [parsing, setParsing] = useState(false);
  const [parsedDoc, setParsedDoc] = useState<ParsedResumeDocument | null>(null);
  const [atsReport, setAtsReport] = useState<ComprehensiveAtsReport | null>(() => {
    return profile ? evaluateResumeAts(profile, activeVersion) : null;
  });

  // Explicit AI Consent Modal State
  const [showAiConsentModal, setShowAiConsentModal] = useState(false);
  const [pendingOcrResolve, setPendingOcrResolve] = useState<((granted: boolean) => void) | null>(null);

  // Job Description Matching State
  const [targetJd, setTargetJd] = useState("");
  const [jdMatchResult, setJdMatchResult] = useState<JobSpecificMatchResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Handle File Upload & Local Parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setNotice(null);

    try {
      const parsed = await parseResumeFile(file, () => {
        // Trigger explicit consent modal if OCR remote service is required
        return new Promise<boolean>((resolve) => {
          setPendingOcrResolve(() => resolve);
          setShowAiConsentModal(true);
        });
      });

      setParsedDoc(parsed);

      // Create temporary profile from extracted data to evaluate ATS score
      if (profile) {
        const mergedProfile: CareerProfile = {
          ...profile,
          ...parsed.extractedProfile,
          skills: [
            ...profile.skills,
            ...(parsed.extractedProfile.skills || []).filter(
              (newS) => !profile.skills.some((s) => s.name.toLowerCase() === newS.name.toLowerCase())
            ),
          ],
        };
        const report = evaluateResumeAts(mergedProfile, activeVersion);
        setAtsReport(report);
      }

      setNotice(`Resume successfully parsed locally from ${file.name}.`);
    } catch (err: any) {
      setNotice(`Failed to parse file: ${err.message || "Unknown error"}`);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const handleConsentChoice = (granted: boolean) => {
    setShowAiConsentModal(false);
    if (pendingOcrResolve) {
      pendingOcrResolve(granted);
      setPendingOcrResolve(null);
    }
  };

  const handleRunJdMatch = () => {
    if (!profile) return;
    const result = matchResumeAgainstJobDescription(profile, targetJd, activeVersion);
    setJdMatchResult(result);
  };

  const handleApplyToProfile = () => {
    if (!parsedDoc?.extractedProfile || !onApplyParsedProfile) return;
    onApplyParsedProfile(parsedDoc.extractedProfile);
    setNotice("Imported contact info and extracted skills into your Saarvi Profile.");
  };

  return (
    <div className="space-y-6">
      {/* Privacy Notice Banner */}
      <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <span className="font-bold">Local-First Privacy Architecture:</span> Your resume file, contact details, and career text are parsed client-side inside your browser and stored in local IndexedDB. Saarvi never silently uploads private resumes or personal information.
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      <div className="bg-white border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 sm:p-8 text-center transition group cursor-pointer relative">
        <input
          type="file"
          accept=".pdf,.docx,.txt,image/png,image/jpeg"
          onChange={handleFileUpload}
          disabled={parsing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 transition">
          {parsing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
        </div>
        <h3 className="text-sm font-bold text-slate-800">
          {parsing ? "Parsing Resume Locally..." : "Upload Existing Resume to Analyze"}
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Drag & drop your <strong>PDF, DOCX, TXT, or Image</strong>. We detect contact info, skills, headings, and compute deterministic ATS compatibility.
        </p>
      </div>

      {/* Parsed Summary Card if available */}
      {parsedDoc && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Parsed Document
              </span>
              <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                {parsedDoc.extractedProfile.fullName || "Candidate Resume"}
              </h4>
            </div>
            {onApplyParsedProfile && (
              <button
                onClick={handleApplyToProfile}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                Apply to My Profile
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Format</span>
              <p className="font-bold text-slate-700 uppercase mt-0.5">{parsedDoc.sourceType}</p>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Text Layer</span>
              <p className="font-bold text-slate-700 mt-0.5">
                {parsedDoc.hasTextLayer ? "Direct Selectable" : "OCR Scanned"}
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Skills Detected</span>
              <p className="font-bold text-slate-700 mt-0.5">
                {parsedDoc.extractedProfile.skills?.length || 0}
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Confidence</span>
              <p className="font-bold text-emerald-600 mt-0.5">{parsedDoc.confidenceScore}%</p>
            </div>
          </div>

          {parsedDoc.lowConfidenceWarning && (
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{parsedDoc.lowConfidenceWarning}</span>
            </div>
          )}
        </div>
      )}

      {/* ATS Score & Category Breakdown */}
      {atsReport && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                ATS Compatibility Report
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                Deterministic ATS Score: {atsReport.overallScore}/100
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculated purely from standard ATS criteria without subjective AI estimation.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
                  atsReport.overallScore >= 85
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : atsReport.overallScore >= 70
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                <span>{atsReport.scoreTier}</span>
              </div>
            </div>
          </div>

          {/* 6 Explainable Category Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {atsReport.categories.map((cat) => (
              <div key={cat.id} className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span>{cat.name}</span>
                  <span className="text-blue-600 font-bold">{cat.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5">
                  {cat.score} / {cat.maxScore} points earned
                </div>
              </div>
            ))}
          </div>

          {/* Actionable Recommendations */}
          {atsReport.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Actionable Resume Improvements
              </h4>
              <div className="space-y-1.5">
                {atsReport.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-start justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{rec.text}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{rec.category}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${
                        rec.impact === "high"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {rec.impact} impact
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job Description Specific Match Drawer */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Job-Specific Match Engine
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Match Your Resume Against Any Job Description
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Paste a target role description to detect matching keywords and exact skill gaps via Set intersection.
          </p>
        </div>

        <div>
          <textarea
            rows={4}
            value={targetJd}
            onChange={(e) => setTargetJd(e.target.value)}
            placeholder="Paste job description or requirements section here (e.g. 'Looking for a Software Engineer proficient in React, TypeScript, Node.js, and SQL...')..."
            className="w-full p-3 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleRunJdMatch}
          disabled={!targetJd.trim()}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
        >
          Calculate Job Match
        </button>

        {/* Job Match Result */}
        {jdMatchResult && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700">Skill & Keyword Overlap</span>
              <span className="text-sm font-extrabold text-blue-600">
                {jdMatchResult.matchPercentage}% Resume Match
              </span>
            </div>

            {/* Matched Skills */}
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                ✓ Matched Skills ({jdMatchResult.matchedSkills.length})
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {jdMatchResult.matchedSkills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-md"
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Skills */}
            {jdMatchResult.missingSkills.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  • Skills in Job Description Not Detected on Resume ({jdMatchResult.missingSkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {jdMatchResult.missingSkills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-md"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {jdMatchResult.suggestions.length > 0 && (
              <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800">Recommendation: </span>
                {jdMatchResult.suggestions.join(" ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explicit AI Consent Modal */}
      {showAiConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI / Optical Character Recognition Consent
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This document appears to be an image or scanned document without a selectable text layer. To extract text, it will be securely processed by Saarvi OCR.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Do you consent to sending this document for OCR text extraction?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleConsentChoice(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConsentChoice(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
              >
                Continue with OCR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
