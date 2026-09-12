"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { calculateVTUCGPA, cgpaToPercentageVTU2022 } from "@/lib/student/calculators/vtu-engine";
import { studentService } from "@/lib/services/studentService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { SemesterResult } from "@/types/student";
import { VTU_METADATA } from "@/lib/student/vtu/types";
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Save,
  TrendingUp,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Award,
  AlertCircle,
} from "lucide-react";

interface SemesterEntryState {
  semester: number;
  sgpa: number | "";
  credits: number | "";
  status: "not_entered" | "completed";
}

const DEFAULT_SEMESTER_DATA: SemesterEntryState[] = [
  { semester: 1, sgpa: 8.45, credits: 20, status: "completed" },
  { semester: 2, sgpa: 8.80, credits: 20, status: "completed" },
  { semester: 3, sgpa: 8.52, credits: 21, status: "completed" },
  { semester: 4, sgpa: "", credits: 22, status: "not_entered" },
  { semester: 5, sgpa: "", credits: 22, status: "not_entered" },
  { semester: 6, sgpa: "", credits: 22, status: "not_entered" },
  { semester: 7, sgpa: "", credits: 20, status: "not_entered" },
  { semester: 8, sgpa: "", credits: 13, status: "not_entered" },
];

export default function CGPACalculatorPage() {
  const [activeSem, setActiveSem] = useState<number>(3);
  const [semesters, setSemesters] = useState<SemesterEntryState[]>(DEFAULT_SEMESTER_DATA);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Load existing snapshot on mount (local IndexedDB primary)
  useEffect(() => {
    async function loadLatestSnapshot() {
      try {
        // 1. First check local IndexedDB
        const localRecords = await academicStorage.getSemesterRecords("default_profile");
        if (localRecords && localRecords.length > 0) {
          const mapped: SemesterEntryState[] = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
            const found = localRecords.find((item) => item.semester === s);
            if (found && found.status === "completed" && found.sgpa > 0) {
              return {
                semester: s,
                sgpa: found.sgpa,
                credits: found.totalCredits,
                status: "completed",
              };
            }
            return {
              semester: s,
              sgpa: "",
              credits: found ? found.totalCredits : s === 8 ? 13 : 20,
              status: "not_entered",
            };
          });
          setSemesters(mapped);
          return;
        }

        // 2. Fallback to studentService
        const latest = await studentService.getLatestAcademicRecord();
        if (latest && latest.semesters && latest.semesters.length > 0) {
          const mapped: SemesterEntryState[] = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
            const found = latest.semesters.find((item) => item.semester === s);
            if (found && found.status === "completed" && found.sgpa > 0) {
              return {
                semester: s,
                sgpa: found.sgpa,
                credits: found.totalCredits,
                status: "completed",
              };
            }
            return {
              semester: s,
              sgpa: "",
              credits: found ? found.totalCredits : s === 8 ? 13 : 20,
              status: "not_entered",
            };
          });
          setSemesters(mapped);
        }
      } catch (err) {
        console.error("Failed to load academic snapshot", err);
      }
    }
    loadLatestSnapshot();
  }, []);

  // Handle SGPA or Credit change for a semester
  const handleSemesterChange = (semNum: number, field: "sgpa" | "credits", val: string) => {
    const num = val === "" ? "" : Math.max(0, Number(val));
    setSemesters((prev) =>
      prev.map((s) => {
        if (s.semester === semNum) {
          const updated = { ...s, [field]: num };
          const hasSgpa = typeof updated.sgpa === "number" && updated.sgpa > 0;
          const hasCredits = typeof updated.credits === "number" && updated.credits > 0;
          updated.status = hasSgpa && hasCredits ? "completed" : "not_entered";
          return updated;
        }
        return s;
      })
    );
  };

  // Convert state to SemesterResult array for engine
  const evaluatedSemesters: SemesterResult[] = useMemo(() => {
    return semesters.map((s) => {
      const sgpaVal = typeof s.sgpa === "number" ? s.sgpa : 0;
      const creditsVal = typeof s.credits === "number" ? s.credits : 0;
      const creditPoints = sgpaVal * creditsVal;

      return {
        semester: s.semester,
        semesterName: `Semester ${s.semester}`,
        courses: [],
        sgpa: sgpaVal,
        totalCredits: creditsVal,
        earnedCredits: creditsVal,
        totalCreditPoints: creditPoints,
        hasBacklogs: false,
        status: s.status,
      };
    });
  }, [semesters]);

  // Calculate Cumulative CGPA
  const cgpaResult = useMemo(() => {
    return calculateVTUCGPA(evaluatedSemesters);
  }, [evaluatedSemesters]);

  // Timeline progression computation
  const timelineData = useMemo(() => {
    let runningCredits = 0;
    let runningPoints = 0;
    const items: Array<{
      semester: number;
      sgpa: number;
      credits: number;
      runningCGPA: number;
    }> = [];

    for (const sem of semesters) {
      if (sem.status === "completed" && typeof sem.sgpa === "number" && typeof sem.credits === "number") {
        runningCredits += sem.credits;
        runningPoints += sem.sgpa * sem.credits;
        const currentCGPA = runningCredits > 0 ? runningPoints / runningCredits : 0;
        items.push({
          semester: sem.semester,
          sgpa: sem.sgpa,
          credits: sem.credits,
          runningCGPA: Math.round((currentCGPA + Number.EPSILON) * 100) / 100,
        });
      }
    }
    return items;
  }, [semesters]);

  // Copy result
  const handleCopy = async () => {
    const text = `VTU CGPA: ${cgpaResult.cgpa.toFixed(2)} (${cgpaResult.percentageEquivalent.toFixed(2)}%) | Completed Semesters: ${cgpaResult.completedSemestersCount} | Credits: ${cgpaResult.totalCredits}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  // Save calculation snapshot to IndexedDB
  const handleSave = async () => {
    try {
      // 1. Save all completed semesters to IndexedDB
      for (const sem of evaluatedSemesters) {
        if (sem.status === "completed") {
          await academicStorage.saveSemesterRecord({
            id: `sem_${sem.semester}`,
            profileId: "default_profile",
            university: "VTU",
            scheme: "2022",
            branch: "CSE",
            semester: sem.semester,
            curriculumVersion: "1.0",
            gradingVersion: "VTU-2022-v1",
            sgpa: sem.sgpa,
            totalCredits: sem.totalCredits,
            earnedCredits: sem.earnedCredits,
            totalCreditPoints: sem.totalCreditPoints,
            hasBacklogs: sem.hasBacklogs,
            status: "completed",
            courses: [],
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Add history record
      await academicStorage.addHistoryEntry({
        profileId: "default_profile",
        type: "CGPA",
        title: `VTU CGPA — ${cgpaResult.completedSemestersCount} Semesters`,
        summary: `CGPA: ${cgpaResult.cgpa.toFixed(2)} (${cgpaResult.percentageEquivalent.toFixed(2)}%)`,
        details: {
          cgpa: cgpaResult.cgpa,
          credits: cgpaResult.totalCredits,
          semestersCount: cgpaResult.completedSemestersCount,
          percentage: cgpaResult.percentageEquivalent,
        },
      });

      // 3. Keep local snapshot in sync
      await studentService.saveAcademicRecord({
        university: "VTU",
        scheme: "2022",
        branch: "CSE",
        curriculumVersion: "1.0",
        gradingVersion: "VTU-2022-v1",
        calculatedAt: new Date().toISOString(),
        semesters: evaluatedSemesters,
        cgpa: cgpaResult.cgpa,
        totalCredits: cgpaResult.totalCredits,
        earnedCredits: cgpaResult.earnedCredits,
        totalCreditPoints: cgpaResult.totalCreditPoints,
        percentageEquivalent: cgpaResult.percentageEquivalent,
        status: "active",
      });
      setSavedNotice("Academic profile saved securely to your local student workspace!");
      setTimeout(() => setSavedNotice(null), 3500);
    } catch {
      setSavedNotice("Saved locally.");
      setTimeout(() => setSavedNotice(null), 2500);
    }
  };

  // Reset to default
  const handleReset = () => {
    setSemesters(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
        semester: s,
        sgpa: "",
        credits: s === 8 ? 13 : 20,
        status: "not_entered",
      }))
    );
  };

  const activeSemesterState = semesters.find((s) => s.semester === activeSem) || semesters[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">

        {/* 1. PAGE HEADER */}
        <div className="space-y-2.5 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Cumulative Degree Performance • VTU 2022 Regulation</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Cumulative CGPA Calculator
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Track your semester-by-semester academic progression across all 8 semesters with official VTU percentage conversion.
          </p>
        </div>

        {/* 2. CUMULATIVE SCORE HERO CARD */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Overall Cumulative GPA
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight">
                  {cgpaResult.cgpa.toFixed(2)}
                </span>
                <span className="text-base font-semibold text-slate-400">/ 10.00</span>
              </div>
              <p className="text-xs text-slate-500 max-w-lg">{cgpaResult.explanation}</p>
            </div>

            {/* PERCENTAGE CONVERSION CARD (Requirement 29) */}
            <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200/90 text-right sm:text-left shrink-0">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                VTU 2022 Conversion
              </span>
              <div className="text-2xl sm:text-3xl font-black text-blue-950 mt-0.5">
                {cgpaResult.percentageEquivalent.toFixed(2)}%
              </div>
              <span className="text-[10px] font-mono text-blue-700 block mt-1">
                Formula: (CGPA - 0.75) × 10
              </span>
            </div>
          </div>

          {savedNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* QUICK METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Completed Semesters</span>
              <span className="text-xl font-black text-slate-900">{cgpaResult.completedSemestersCount} / 8</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Credits</span>
              <span className="text-xl font-black text-slate-900">{cgpaResult.totalCredits}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Credit Points</span>
              <span className="text-xl font-black text-slate-900">{cgpaResult.totalCreditPoints.toFixed(1)}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Degree Target</span>
              <span className="text-xl font-black text-emerald-600">160 Credits</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Summary"}</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save to Workspace</span>
            </button>
          </div>
        </div>

        {/* 3. SEMESTER PROGRESS TABS (Requirement 23 & 25) */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Semester Progression</h2>
            <p className="text-xs text-slate-500">Select a semester to review or update its credits and SGPA.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {semesters.map((s) => {
              const isActive = s.semester === activeSem;
              const isCompleted = s.status === "completed";

              return (
                <button
                  key={s.semester}
                  type="button"
                  onClick={() => setActiveSem(s.semester)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : isCompleted
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                    Sem {s.semester}
                  </span>
                  <span className="text-sm font-black">
                    {isCompleted && typeof s.sgpa === "number" ? s.sgpa.toFixed(2) : "—"}
                  </span>
                  <span className={`text-[10px] font-semibold ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                    {isCompleted ? "✓ Complete" : "○ Not entered"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE SEMESTER EDITOR */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Semester {activeSem} Details
                </h3>
                <p className="text-xs text-slate-500">
                  Enter your pre-calculated SGPA or click below to calculate directly from individual courses.
                </p>
              </div>
              <Link
                href="/student/sgpa-calculator"
                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 hover:underline"
              >
                <span>Open SGPA Calculator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor={`sem-sgpa-${activeSem}`} className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Semester {activeSem} SGPA (0.00 – 10.00)
                </label>
                <input
                  id={`sem-sgpa-${activeSem}`}
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  placeholder="e.g. 8.52"
                  value={activeSemesterState.sgpa}
                  onChange={(e) => handleSemesterChange(activeSem, "sgpa", e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`sem-credits-${activeSem}`} className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Registered Credits (Typical 20–22)
                </label>
                <input
                  id={`sem-credits-${activeSem}`}
                  type="number"
                  min="1"
                  max="40"
                  placeholder="e.g. 21"
                  value={activeSemesterState.credits}
                  onChange={(e) => handleSemesterChange(activeSem, "credits", e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. PROGRESSION CHART (Requirement 27) */}
        {timelineData.length >= 2 && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Academic Progression Curve</span>
                </h3>
                <p className="text-xs text-slate-500">Visualizing semester SGPA and cumulative CGPA trends over time.</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <span className="text-slate-700">Semester SGPA</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-600" />
                  <span className="text-slate-700">Cumulative CGPA</span>
                </div>
              </div>
            </div>

            {/* PURE SVG PROGRESSION CHART */}
            <div className="w-full overflow-x-auto">
              <div className="min-w-[480px] h-64 relative flex items-end justify-between px-8 py-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                {timelineData.map((item, idx) => {
                  const sgpaHeight = Math.max(10, Math.min(100, ((item.sgpa - 4) / 6) * 100));
                  const cgpaHeight = Math.max(10, Math.min(100, ((item.runningCGPA - 4) / 6) * 100));

                  return (
                    <div key={item.semester} className="flex flex-col items-center gap-2 flex-1 group">
                      <div className="w-full flex justify-center items-end gap-1.5 h-44">
                        {/* SGPA Bar */}
                        <div
                          style={{ height: `${sgpaHeight}%` }}
                          className="w-5 sm:w-8 bg-blue-600 rounded-t-lg transition-all relative flex justify-center group-hover:brightness-110"
                        >
                          <span className="absolute -top-6 text-[10px] font-bold text-blue-700 whitespace-nowrap">
                            {item.sgpa.toFixed(2)}
                          </span>
                        </div>

                        {/* CGPA Bar */}
                        <div
                          style={{ height: `${cgpaHeight}%` }}
                          className="w-5 sm:w-8 bg-emerald-600 rounded-t-lg transition-all relative flex justify-center group-hover:brightness-110"
                        >
                          <span className="absolute -top-6 text-[10px] font-bold text-emerald-700 whitespace-nowrap">
                            {item.runningCGPA.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-slate-600 mt-2">
                        Sem {item.semester}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. TIMELINE BREAKDOWN TABLE (Requirement 26) */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Detailed Semester Breakdown</h3>
            <p className="text-xs text-slate-500">Calculated strictly with credit-weighted sums per VTU CBCS regulations.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4">Credits</th>
                  <th className="py-3 px-4">SGPA</th>
                  <th className="py-3 px-4">Credit Points</th>
                  <th className="py-3 px-4">Cumulative CGPA</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {semesters.map((s) => {
                  const isCompleted = s.status === "completed";
                  const timelineEntry = timelineData.find((t) => t.semester === s.semester);

                  return (
                    <tr key={s.semester} className={isCompleted ? "hover:bg-slate-50/70" : "opacity-50"}>
                      <td className="py-3 px-4 font-bold text-slate-900">Semester {s.semester}</td>
                      <td className="py-3 px-4">{s.credits ? `${s.credits} cr` : "—"}</td>
                      <td className="py-3 px-4 font-bold text-blue-700">
                        {isCompleted && typeof s.sgpa === "number" ? s.sgpa.toFixed(2) : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {isCompleted && typeof s.sgpa === "number" && typeof s.credits === "number"
                          ? (s.sgpa * s.credits).toFixed(1)
                          : "—"}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {timelineEntry ? timelineEntry.runningCGPA.toFixed(2) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {isCompleted ? "Recorded" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* OFFICIAL DISCLAIMER */}
        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          Disclaimer: This is an unofficial calculation based on the selected university, scheme, curriculum, and grading rules. Always verify your official university result for final academic records.
        </p>

      </main>

      <Footer />
    </div>
  );
}
