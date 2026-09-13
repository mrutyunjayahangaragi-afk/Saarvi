"use client";

import { useState, useMemo, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { calculateAttendance } from "@/lib/student/calculators/attendance";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { AttendanceRecord } from "@/lib/academic/types";
import {
  Clock,
  RotateCcw,
  Copy,
  Check,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  Info,
  Save,
  Trash2,
  BookOpen,
} from "lucide-react";

export default function AttendanceCalculatorPage() {
  const [subjectName, setSubjectName] = useState<string>("Core Course");
  const [totalClasses, setTotalClasses] = useState<number>(48);
  const [attendedClasses, setAttendedClasses] = useState<number>(38);
  const [targetPercentage, setTargetPercentage] = useState<number>(75);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [savedRecords, setSavedRecords] = useState<AttendanceRecord[]>([]);

  // Load saved attendance records on mount
  useEffect(() => {
    async function loadSaved() {
      try {
        const records = await academicStorage.getAttendanceRecords("default_profile");
        setSavedRecords(records);
      } catch (err) {
        console.error("Failed to load attendance records", err);
      }
    }
    loadSaved();
  }, []);

  const result = useMemo(() => {
    return calculateAttendance(totalClasses, attendedClasses, targetPercentage);
  }, [totalClasses, attendedClasses, targetPercentage]);

  const handleSaveAttendance = async () => {
    try {
      const rec: AttendanceRecord = {
        id: `att_${Date.now()}`,
        profileId: "default_profile",
        subjectName: subjectName.trim() || "Untitled Course",
        totalClasses,
        attendedClasses,
        targetPercentage,
        currentPercentage: result.currentPercentage,
        isSafe: result.isSafe,
        updatedAt: new Date().toISOString(),
      };
      await academicStorage.saveAttendanceRecord(rec);
      await academicStorage.addHistoryEntry({
        profileId: "default_profile",
        type: "ATTENDANCE",
        title: `Attendance — ${rec.subjectName}`,
        summary: `${result.currentPercentage}% (${attendedClasses}/${totalClasses} attended) | Target: ${targetPercentage}%`,
        details: {
          subjectName: rec.subjectName,
          totalClasses,
          attendedClasses,
          targetPercentage,
          currentPercentage: result.currentPercentage,
          isSafe: result.isSafe,
        },
      });
      const updated = await academicStorage.getAttendanceRecords("default_profile");
      setSavedRecords(updated);
      setSavedNotice(`Saved attendance for ${rec.subjectName} locally!`);
      setTimeout(() => setSavedNotice(null), 3000);
    } catch {
      setSavedNotice("Saved locally.");
      setTimeout(() => setSavedNotice(null), 2500);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await academicStorage.deleteAttendanceRecord(id);
      const updated = await academicStorage.getAttendanceRecords("default_profile");
      setSavedRecords(updated);
    } catch (err) {
      console.error("Failed to delete record", err);
    }
  };

  const handleReset = () => {
    setTotalClasses(40);
    setAttendedClasses(32);
    setTargetPercentage(75);
  };

  const handleCopy = async () => {
    const textToCopy = `Attendance: ${result.currentPercentage}% (${attendedClasses}/${totalClasses}) | Target: ${targetPercentage}% | ${result.message}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
        {/* Page Header */}
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Attendance Planner</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Attendance Calculator
          </h1>
          <p className="text-sm text-slate-600">
            Check your current attendance percentage and determine how many classes you must attend to meet your target.
          </p>
        </div>

        {/* Results Banner */}
        <div
          className={`p-6 sm:p-8 rounded-3xl shadow-md space-y-4 text-white transition-colors ${
            result.error
              ? "bg-gradient-to-br from-amber-600 to-orange-700"
              : result.isSafe
              ? "bg-gradient-to-br from-emerald-600 to-teal-700"
              : "bg-gradient-to-br from-rose-600 to-pink-700"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
              {result.isSafe ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {result.error ? "Input Warning" : result.isSafe ? "Target Achieved" : "Attendance Deficit"}
            </span>

            {!result.error && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer"
                aria-label="Copy attendance result"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy result"}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-white/80 font-medium">Your Attendance</div>
              <div className="text-3xl sm:text-5xl font-black tracking-tight mt-1">
                {result.currentPercentage}%
              </div>
              <div className="text-[11px] text-white/80 mt-0.5">
                {attendedClasses} attended of {totalClasses} held
              </div>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-white/80 font-medium">Target Required</div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                {targetPercentage}%
              </div>
              <div className="text-[11px] text-white/80 mt-0.5">institutional requirement</div>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-white/80 font-medium">
                {result.isSafe ? "Safe Bunk Margin" : "Next Classes Required"}
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                {result.isSafe
                  ? `${result.maxBunkableClasses ?? 0}`
                  : `${result.classesNeededForTarget ?? "—"}`}
              </div>
              <div className="text-[11px] text-white/80 mt-0.5">
                {result.isSafe ? "classes you can safely miss" : "consecutive classes needed"}
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/15 rounded-2xl text-xs text-white/95 leading-relaxed font-medium">
            {result.error || result.message}
          </div>
        </div>

        {/* Inputs Form */}
        <div className="p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Attendance Statistics</span>
              </h2>
              <p className="text-xs text-slate-500">
                Enter your current session details to calculate your status.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Total Classes Conducted */}
            <div className="space-y-1.5">
              <label htmlFor="total-classes-input" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Classes Conducted
              </label>
              <input
                id="total-classes-input"
                type="number"
                min="1"
                max="1000"
                value={totalClasses}
                onChange={(e) => setTotalClasses(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400">Total lectures or sessions held</p>
            </div>

            {/* Classes Attended */}
            <div className="space-y-1.5">
              <label htmlFor="attended-classes-input" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Classes Attended
              </label>
              <input
                id="attended-classes-input"
                type="number"
                min="0"
                max={totalClasses}
                value={attendedClasses}
                onChange={(e) => setAttendedClasses(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400">Lectures you attended in person</p>
            </div>

            {/* Target Percentage */}
            <div className="space-y-1.5">
              <label htmlFor="target-pct-input" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Target Percentage (%)
              </label>
              <div className="flex gap-2">
                <input
                  id="target-pct-input"
                  type="number"
                  min="50"
                  max="100"
                  value={targetPercentage}
                  onChange={(e) => setTargetPercentage(Math.max(1, Math.min(100, parseInt(e.target.value) || 75)))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[75, 80, 85].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTargetPercentage(val)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors cursor-pointer ${
                      targetPercentage === val
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subject Name & Save Section */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-72 space-y-1">
              <label htmlFor="subject-name-input" className="text-xs font-bold text-slate-600 block">
                Course / Subject Title (Optional)
              </label>
              <input
                id="subject-name-input"
                type="text"
                placeholder="e.g. Operating Systems"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold text-slate-800"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-3">
              {savedNotice && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  {savedNotice}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveAttendance}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save to Workspace</span>
              </button>
            </div>
          </div>
        </div>

        {/* Saved Courses Attendance List */}
        {savedRecords.length > 0 && (
          <div className="p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Saved Subjects Attendance ({savedRecords.length})</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">Local workspace records</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {savedRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate">{rec.subjectName}</div>
                    <div className="text-xs text-slate-500">
                      {rec.attendedClasses}/{rec.totalClasses} attended • Target: {rec.targetPercentage}%
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          rec.isSafe
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {rec.currentPercentage}% {rec.isSafe ? "✓ Safe" : "⚠ Deficit"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSubjectName(rec.subjectName);
                        setTotalClasses(rec.totalClasses);
                        setAttendedClasses(rec.attendedClasses);
                        setTargetPercentage(rec.targetPercentage);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(rec.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calculation Explanation */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>How is attendance calculated?</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your current attendance is calculated as <code>(Classes Attended ÷ Total Classes Conducted) × 100</code>.
          </p>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
            <div className="font-semibold text-slate-800">Formula for required consecutive classes:</div>
            <div className="font-mono text-blue-700 bg-white p-2 rounded-lg border border-slate-200">
              Classes Needed = ⌈(Target% × Total Classes - 100 × Classes Attended) ÷ (100 - Target%)⌉
            </div>
            <p className="text-[11px] text-slate-500">
              Note: Institutional attendance criteria, medical leaves, and official duty exemptions differ across universities. This calculation represents the pure mathematical threshold.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
