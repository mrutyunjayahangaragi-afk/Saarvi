"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { USNInput } from '@/components/academic/USNInput';
import { ResultImportReviewModal } from '@/components/academic/ResultImportReviewModal';
import {
  AcademicSchemeRegistry,
  AcademicScheme,
} from '@/lib/academic/scheme-registry';
import {
  SemesterResultDiscoveryEngine,
  DiscoveredExamSession,
  CanonicalExtractedResult,
} from '@/lib/academic/providers/vtu-result-provider';
import {
  validatePdfBytes,
  extractPdfTextItems,
  parseVTUMarksheetText,
} from '@/lib/academic/pdf-parser';
import {
  calculateWhatIfSimulation,
  calculateAcademicGoal,
  analyzeBacklogs,
  calculateCreditBreakdown,
  roundTo,
} from '@/lib/academic/engine/calculations';
import { downloadAcademicReportPdf } from '@/lib/academic/pdf-report-generator';
import { academicStorage } from '@/lib/academic/storage/academic-db';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  TrendingUp,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Award,
  Calculator,
  Upload,
  Clock,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileDown,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';

export default function AcademicCenterPage() {
  const [usn, setUsn] = useState('');
  const [activeScheme, setActiveScheme] = useState<AcademicScheme>(() =>
    AcademicSchemeRegistry.getScheme('vtu-2022')
  );
  const [discoveredSessions, setDiscoveredSessions] = useState<DiscoveredExamSession[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Review modal state
  const [reviewResult, setReviewResult] = useState<CanonicalExtractedResult | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // PDF Upload loading/error
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved semester records in local workspace
  const [savedSemesters, setSavedSemesters] = useState<CanonicalExtractedResult[]>([]);
  const [expandedSemester, setExpandedSemester] = useState<number | null>(null);

  // Target CGPA simulator states
  const [targetCgpa, setTargetCgpa] = useState<number>(8.5);
  const [remainingCredits, setRemainingCredits] = useState<number>(44);

  // What-if simulator states
  const [whatIfCredits, setWhatIfCredits] = useState<number>(22);
  const [whatIfGradePoint, setWhatIfGradePoint] = useState<number>(9);

  // Active view tab: "dashboard" | "what-if" | "target"
  const [activeTab, setActiveTab] = useState<'dashboard' | 'what-if' | 'target'>('dashboard');

  // Load saved results from local IndexedDB on mount
  useEffect(() => {
    async function loadWorkspace() {
      try {
        const local = await academicStorage.getSemesterRecords('default_profile');
        if (local && local.length > 0) {
          const mapped: CanonicalExtractedResult[] = local
            .filter((s) => s.status === 'completed' && s.sgpa > 0)
            .map((s) => ({
              usn: s.id.split('_')[0] || '1RV23CS001',
              semester: s.semester,
              schemeId: s.scheme || 'vtu-2022',
              branchCode: s.branch || 'CSE',
              examSession: `Semester ${s.semester} Exam`,
              resultType: 'REGULAR',
              source: 'MANUAL_ENTRY',
              fetchedAt: s.updatedAt,
              subjects: (s.courses || []).map((c) => ({
                courseCode: c.courseCode,
                courseTitle: c.courseTitle,
                credits: c.credits,
                totalMarks: c.totalMarks,
                grade: c.grade,
                gradePoint: c.gradePoint,
                resultStatus: c.isPassed ? 'P' : 'F',
              })),
              sgpa: s.sgpa,
              totalCredits: s.totalCredits,
              earnedCredits: s.earnedCredits,
              hasBacklogs: s.hasBacklogs,
            }));
          setSavedSemesters(mapped);
        }
      } catch (err) {
        console.warn('Could not load local academic records:', err);
      }
    }
    loadWorkspace();
  }, []);

  // Handle USN search
  const handleUsnSubmit = () => {
    if (!usn.trim()) return;
    const discovery = SemesterResultDiscoveryEngine.discoverSessionsForUSN(usn);
    setActiveScheme(discovery.scheme);
    setDiscoveredSessions(discovery.sessions);
    setHasSearched(true);
    setPdfError(null);
  };

  // Handle PDF marks card upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);
    setPdfError(null);

    try {
      const buffer = await file.arrayBuffer();
      const validation = validatePdfBytes(buffer);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid PDF file.');
      }

      const text = await extractPdfTextItems(buffer);
      const parsed = parseVTUMarksheetText(text);

      if (!parsed.success || !parsed.result) {
        throw new Error(parsed.error || 'Unable to parse marks from PDF. Please check the document.');
      }

      setReviewResult(parsed.result);
      setIsReviewOpen(true);
    } catch (err) {
      console.error('[PDF Parsing Error]:', err);
      setPdfError(err instanceof Error ? err.message : 'Failed to extract marks card from PDF.');
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm and save semester result locally
  const handleConfirmResult = (confirmed: CanonicalExtractedResult) => {
    // Upsert semester (replace existing attempt of same semester)
    setSavedSemesters((prev) => {
      const filtered = prev.filter((s) => s.semester !== confirmed.semester);
      const updated = [...filtered, confirmed];
      updated.sort((a, b) => a.semester - b.semester);
      return updated;
    });

    setIsReviewOpen(false);
    setReviewResult(null);
  };

  // Remove semester from local workspace
  const handleRemoveSemester = (semesterNum: number) => {
    setSavedSemesters((prev) => prev.filter((s) => s.semester !== semesterNum));
  };

  // Clear entire workspace (Local-First Privacy)
  const handleClearWorkspace = () => {
    if (confirm('Clear all saved academic results from your local browser?')) {
      setSavedSemesters([]);
    }
  };

  // Cumulative Metrics Computation
  const cumulativeMetrics = useMemo(() => {
    let totCredits = 0;
    let totEarned = 0;
    let totPoints = 0;

    for (const sem of savedSemesters) {
      if (sem.totalCredits > 0 && sem.sgpa > 0) {
        totCredits += sem.totalCredits;
        totEarned += sem.earnedCredits;
        totPoints += sem.sgpa * sem.totalCredits;
      }
    }

    const cgpa = totCredits > 0 ? roundTo(totPoints / totCredits, 2) : 0;
    const percentageEquivalent = activeScheme.percentageFormula(cgpa);

    return {
      cgpa,
      totalCredits: totCredits,
      earnedCredits: totEarned,
      percentageEquivalent,
      completedSemestersCount: savedSemesters.length,
      latestSgpa: savedSemesters.length > 0 ? savedSemesters[savedSemesters.length - 1].sgpa : 0,
      bestSgpa: savedSemesters.length > 0 ? Math.max(...savedSemesters.map((s) => s.sgpa)) : 0,
    };
  }, [savedSemesters, activeScheme]);

  // Backlogs computation
  const backlogMetrics = useMemo(() => {
    return analyzeBacklogs(savedSemesters);
  }, [savedSemesters]);

  // Target Goal Calculation
  const goalResult = useMemo(() => {
    return calculateAcademicGoal(
      cumulativeMetrics.cgpa,
      targetCgpa,
      cumulativeMetrics.totalCredits,
      remainingCredits
    );
  }, [cumulativeMetrics, targetCgpa, remainingCredits]);

  // What-If Simulation Calculation
  const whatIfResult = useMemo(() => {
    return calculateWhatIfSimulation(savedSemesters, [
      {
        courseCode: 'NEXT_SEM',
        courseTitle: 'Projected Semester',
        credits: whatIfCredits,
        gradePoint: whatIfGradePoint,
      },
    ]);
  }, [savedSemesters, whatIfCredits, whatIfGradePoint]);

  // Download PDF Report
  const handleDownloadPdf = () => {
    downloadAcademicReportPdf({
      usn: usn || savedSemesters[0]?.usn || '1RV23CS001',
      schemeId: activeScheme.schemeId,
      branchName: 'Computer Science & Engineering',
      cgpa: cumulativeMetrics.cgpa,
      percentageEquivalent: cumulativeMetrics.percentageEquivalent,
      totalCreditsEarned: cumulativeMetrics.earnedCredits,
      activeBacklogs: backlogMetrics.activeCount,
      semesters: savedSemesters,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
            <Sparkles className="w-3.5 h-3.5" />
            <span>VTU Academic Performance Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            VTU Academic Result &amp; Performance Center
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Enter your USN to discover examination results, track multi-semester SGPA &amp; CGPA, model what-if scenarios, and download professional academic reports.
          </p>
        </div>

        {/* USN Input & PDF Upload Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2">
              <USNInput
                value={usn}
                onChange={(val, scheme) => {
                  setUsn(val);
                  setActiveScheme(scheme);
                }}
                onSubmit={handleUsnSubmit}
              />
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
                id="marksheet-pdf-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPdf}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800 hover:border-blue-500 dark:hover:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Upload className={`w-4 h-4 ${isUploadingPdf ? 'animate-bounce' : ''}`} />
                <span>{isUploadingPdf ? 'Extracting Marks...' : 'Upload Official Result PDF'}</span>
              </button>
            </div>
          </div>

          {pdfError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pdfError}</span>
            </div>
          )}

          {/* How It Works Pills */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold flex items-center justify-center text-[10px]">1</span>
              <span>Enter USN</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold flex items-center justify-center text-[10px]">2</span>
              <span>Select Examination</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold flex items-center justify-center text-[10px]">3</span>
              <span>Review Marks</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold flex items-center justify-center text-[10px]">4</span>
              <span>Save Semester</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold flex items-center justify-center text-[10px]">5</span>
              <span>View Dashboard</span>
            </span>
          </div>
        </div>

        {/* Discovered Examination Sessions (Prompt Section 7 & 8) */}
        {hasSearched && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Available VTU Examinations ({discoveredSessions.length})</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Discovered based on {activeScheme.name} for USN {usn.toUpperCase()}
                </p>
              </div>

              <a
                href="https://results.vtu.ac.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Open VTU Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {discoveredSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-blue-300 dark:hover:border-blue-700 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                      Semester {session.semester}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{session.examName}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{session.monthYear}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Import PDF</span>
                    </button>
                    <a
                      href={session.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Portal Link
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cumulative Academic Overview Dashboard (Prompt Section 20) */}
        {savedSemesters.length > 0 && (
          <div className="space-y-6">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 shadow-xs bg-blue-50/30 dark:bg-blue-950/10">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Overall CGPA</span>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{cumulativeMetrics.cgpa.toFixed(2)}</p>
                <span className="text-[10px] text-slate-500 font-medium block">Credit-Weighted</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Percentage</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{cumulativeMetrics.percentageEquivalent.toFixed(1)}%</p>
                <span className="text-[10px] text-slate-500 font-medium block">(CGPA - 0.75) × 10</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Credits Earned</span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{cumulativeMetrics.earnedCredits}</p>
                <span className="text-[10px] text-slate-500 font-medium block">of {cumulativeMetrics.totalCredits} reg.</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Backlogs</span>
                <p className={`text-2xl font-black mt-1 ${backlogMetrics.activeCount > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                  {backlogMetrics.activeCount}
                </p>
                <span className="text-[10px] text-slate-500 font-medium block">{backlogMetrics.clearedCount} Cleared</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latest SGPA</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{cumulativeMetrics.latestSgpa.toFixed(2)}</p>
                <span className="text-[10px] text-slate-500 font-medium block">Sem {savedSemesters[savedSemesters.length - 1].semester}</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Best SGPA</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{cumulativeMetrics.bestSgpa.toFixed(2)}</p>
                <span className="text-[10px] text-slate-500 font-medium block">Peak Term</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Semesters</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{cumulativeMetrics.completedSemestersCount}</p>
                <span className="text-[10px] text-slate-500 font-medium block">Completed</span>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Semester Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('what-if')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === 'what-if'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  What-If Simulator
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('target')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === 'target'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Target CGPA Planner
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download Report PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearWorkspace}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  title="Clear Local Academic Workspace"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: Dashboard & Semester Cards */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4">
                {savedSemesters.map((sem) => {
                  const isExpanded = expandedSemester === sem.semester;

                  return (
                    <div
                      key={sem.semester}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition"
                    >
                      {/* Semester Header Card */}
                      <div
                        onClick={() => setExpandedSemester(isExpanded ? null : sem.semester)}
                        className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg shrink-0">
                            S{sem.semester}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Semester {sem.semester}
                              </h3>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {sem.examSession}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {sem.subjects.length} Subjects • {sem.totalCredits} Credits Registered
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Semester SGPA</span>
                            <p className="text-xl font-black text-blue-600 dark:text-blue-400">{sem.sgpa.toFixed(2)}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSemester(sem.semester);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                              title="Delete Semester"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Course Table */}
                      {isExpanded && (
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                  <th className="p-3">Course Code</th>
                                  <th className="p-3">Course Title</th>
                                  <th className="p-3 text-center">Credits</th>
                                  <th className="p-3 text-center">Total Marks</th>
                                  <th className="p-3 text-center">Grade</th>
                                  <th className="p-3 text-center">Grade Point</th>
                                  <th className="p-3 text-center">Result</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                                {sem.subjects.map((c) => (
                                  <tr key={c.courseCode} className="hover:bg-white dark:hover:bg-slate-900 transition-colors">
                                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{c.courseCode}</td>
                                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{c.courseTitle}</td>
                                    <td className="p-3 text-center font-semibold">{c.credits}</td>
                                    <td className="p-3 text-center font-medium">{c.totalMarks ?? '—'}</td>
                                    <td className="p-3 text-center font-bold">{c.grade}</td>
                                    <td className="p-3 text-center font-bold text-slate-900 dark:text-white">{c.gradePoint}</td>
                                    <td className="p-3 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          c.resultStatus === 'P'
                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                        }`}
                                      >
                                        {c.resultStatus === 'P' ? 'Pass' : 'Fail'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: What-If Simulator (Prompt Section 28) */}
            {activeTab === 'what-if' && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Projection / What-If Analysis</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Future Semester SGPA &amp; CGPA Simulator</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Model next semester performance without altering your official historical results.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Hypothetical Semester Credits: {whatIfCredits}
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={26}
                      value={whatIfCredits}
                      onChange={(e) => setWhatIfCredits(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Target Grade Point Average (SGPA): {whatIfGradePoint}
                    </label>
                    <input
                      type="range"
                      min={4}
                      max={10}
                      step={0.5}
                      value={whatIfGradePoint}
                      onChange={(e) => setWhatIfGradePoint(parseFloat(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Current CGPA</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{whatIfResult.currentCgpa.toFixed(2)}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Projected New CGPA</span>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{whatIfResult.projectedNewCgpa.toFixed(2)}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Net Impact</span>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {whatIfResult.cgpaDelta >= 0 ? `+${whatIfResult.cgpaDelta.toFixed(2)}` : whatIfResult.cgpaDelta.toFixed(2)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  {whatIfResult.explanation}
                </p>
              </div>
            )}

            {/* TAB 3: Target CGPA Planner (Prompt Section 29) */}
            {activeTab === 'target' && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    <Award className="w-3 h-3" />
                    <span>Graduation Target Planner</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Required Future SGPA Calculator</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Calculate what average SGPA is required across remaining credits to secure your target degree class.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Target Graduation CGPA: {targetCgpa.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={6.0}
                      max={10.0}
                      step={0.1}
                      value={targetCgpa}
                      onChange={(e) => setTargetCgpa(parseFloat(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Remaining Credits: {remainingCredits}
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={remainingCredits}
                      onChange={(e) => setRemainingCredits(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Required Future Average SGPA</span>
                  <p className={`text-3xl font-black ${goalResult.isAchievable ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {goalResult.requiredAverageSgpa.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {goalResult.explanation}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verification Modal */}
        <ResultImportReviewModal
          isOpen={isReviewOpen}
          result={reviewResult}
          onConfirm={handleConfirmResult}
          onClose={() => {
            setIsReviewOpen(false);
            setReviewResult(null);
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
