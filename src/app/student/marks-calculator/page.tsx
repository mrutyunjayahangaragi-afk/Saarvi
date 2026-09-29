"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  calculateMarks,
  COMMON_MARKS_WEIGHTAGES,
  MarksWeightageConfig,
} from "@/lib/student/calculators/marks";
import { calculateRequiredMarks } from "@/lib/academic/engine/calculations";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { SubjectMarksBreakdown } from "@/types/student";
import {
  GraduationCap,
  Plus,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  HelpCircle,
  Award,
  Sliders,
  Target,
  AlertCircle,
  CheckCircle2,
  Save,
  Calculator,
} from "lucide-react";
import { revealDestination } from "@/lib/ux/action-destination";


export default function MarksCalculatorPage() {
  const [activeTab, setActiveTab] = useState<"composite" | "required">("composite");

  // Composite Marks State
  const [internalWeight, setInternalWeight] = useState<number>(40);
  const [externalWeight, setExternalWeight] = useState<number>(60);
  const [copied, setCopied] = useState(false);

  // Required Marks State ("What marks do I need?")
  const [currentMarks, setCurrentMarks] = useState<number>(32);
  const [currentMax, setCurrentMax] = useState<number>(50);
  const [targetPercentage, setTargetPercentage] = useState<number>(75);
  const [remainingMax, setRemainingMax] = useState<number>(50);
  const [reqCopied, setReqCopied] = useState(false);
  const [reqSavedNotice, setReqSavedNotice] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<SubjectMarksBreakdown[]>([
    {
      id: "1",
      name: "Computer Architecture",
      internalObtained: 22,
      internalMax: 25,
      externalObtained: 58,
      externalMax: 75,
    },
    {
      id: "2",
      name: "Database Systems",
      internalObtained: 20,
      internalMax: 25,
      externalObtained: 62,
      externalMax: 75,
    },
    {
      id: "3",
      name: "Discrete Mathematics",
      internalObtained: 18,
      internalMax: 25,
      externalObtained: 54,
      externalMax: 75,
    },
  ]);

  const weightageConfig: MarksWeightageConfig = useMemo(() => {
    return { internalWeight, externalWeight };
  }, [internalWeight, externalWeight]);

  const result = useMemo(() => {
    return calculateMarks(subjects, weightageConfig);
  }, [subjects, weightageConfig]);

  const handleAddSubject = () => {
    const nextId = String(Date.now());
    setSubjects((prev) => [
      ...prev,
      {
        id: nextId,
        name: `Course ${prev.length + 1}`,
        internalObtained: 20,
        internalMax: 25,
        externalObtained: 60,
        externalMax: 75,
      },
    ]);
  };

  const handleRemoveSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubjectChange = (
    id: string,
    field: keyof SubjectMarksBreakdown,
    value: string | number
  ) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleReset = () => {
    setInternalWeight(40);
    setExternalWeight(60);
    setSubjects([
      {
        id: "1",
        name: "Course 1",
        internalObtained: 20,
        internalMax: 25,
        externalObtained: 60,
        externalMax: 75,
      },
    ]);
  };

  const handlePresetSelect = (preset: { internal: number; external: number }) => {
    setInternalWeight(preset.internal);
    setExternalWeight(preset.external);
    setTimeout(() => {
      revealDestination("#marks-composite-result", { alignment: "center" });
    }, 50);
  };

  const handleCopy = async () => {
    const textToCopy = `Marks Aggregate: ${result.overallPercentage}% (Total score: ${result.totalScore}/${result.maxPossibleScore}) with ${internalWeight}:${externalWeight} weightage`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const requiredResult = useMemo(() => {
    return calculateRequiredMarks(currentMarks, currentMax, targetPercentage, remainingMax);
  }, [currentMarks, currentMax, targetPercentage, remainingMax]);

  const handleCopyRequired = async () => {
    const text = `Required Marks: ${requiredResult.explanation}`;
    try {
      await navigator.clipboard.writeText(text);
      setReqCopied(true);
      setTimeout(() => setReqCopied(false), 2500);
    } catch {
      setReqCopied(false);
    }
  };

  const handleSaveRequired = async () => {
    try {
      await academicStorage.addHistoryEntry({
        profileId: "default_profile",
        type: "REQUIRED_MARKS",
        title: `Required Marks for ${targetPercentage}%`,
        summary: requiredResult.explanation,
        details: {
          currentMarks,
          currentMax,
          targetPercentage,
          remainingMax,
          requiredMarks: requiredResult.requiredMarks,
          isAchievable: requiredResult.isAchievable,
        },
      });
      setReqSavedNotice("Saved to calculation history!");
      setTimeout(() => setReqSavedNotice(null), 3000);
    } catch {
      setReqSavedNotice("Saved locally.");
      setTimeout(() => setReqSavedNotice(null), 2500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
        {/* Page Header */}
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Academic Performance Engine</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Marks & Target Calculator
          </h1>
          <p className="text-sm text-slate-600">
            Calculate composite internal/external scores or determine the exact marks you need to score in remaining exams.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center">
          <div className="p-1 bg-slate-100 rounded-2xl inline-flex gap-1 border border-slate-200/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("composite");
                setTimeout(() => revealDestination("#marks-composite-result", { alignment: "center" }), 50);
              }}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === "composite"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Composite Marks Calculator
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("required");
                setTimeout(() => revealDestination("#marks-required-result", { alignment: "center" }), 50);
              }}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === "required"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              What Marks Do I Need?
            </button>
          </div>
        </div>

        {activeTab === "required" ? (
          /* REQUIRED MARKS CALCULATOR TAB (SECTION 17) */
          <div className="space-y-8">
            {/* Results Banner */}
            <div
              id="marks-required-result"
              data-saarvi-target="calculation-result"
              tabIndex={-1}
              className={`p-6 sm:p-8 rounded-3xl shadow-md space-y-4 text-white transition-colors saarvi-destination-target outline-hidden ${
                !requiredResult.isAchievable
                  ? "bg-gradient-to-br from-rose-600 to-pink-700"
                  : requiredResult.isAlreadyAchieved
                  ? "bg-gradient-to-br from-emerald-600 to-teal-700"
                  : "bg-gradient-to-br from-blue-600 to-indigo-700"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
                  {requiredResult.isAlreadyAchieved ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : !requiredResult.isAchievable ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Target className="w-4 h-4" />
                  )}
                  {requiredResult.isAlreadyAchieved
                    ? "Target Already Secured"
                    : !requiredResult.isAchievable
                    ? "Target Unachievable"
                    : "Target Projection"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyRequired}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer"
                  >
                    {reqCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{reqCopied ? "Copied!" : "Copy"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveRequired}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              {reqSavedNotice && (
                <div className="text-xs font-semibold text-white/90 bg-white/20 px-3 py-1.5 rounded-lg">
                  {reqSavedNotice}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
                  <div className="text-xs text-white/80 font-medium">Marks Needed</div>
                  <div className="text-3xl sm:text-5xl font-black tracking-tight mt-1">
                    {requiredResult.isAlreadyAchieved ? "0" : requiredResult.isAchievable ? requiredResult.requiredMarks : "—"}
                  </div>
                  <div className="text-[11px] text-white/80 mt-0.5">
                    out of {remainingMax} remaining marks
                  </div>
                </div>

                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
                  <div className="text-xs text-white/80 font-medium">Target Percentage</div>
                  <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                    {targetPercentage}%
                  </div>
                  <div className="text-[11px] text-white/80 mt-0.5">overall desired score</div>
                </div>

                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
                  <div className="text-xs text-white/80 font-medium">Exam Difficulty</div>
                  <div className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                    {requiredResult.isAlreadyAchieved
                      ? "None (Secured)"
                      : !requiredResult.isAchievable
                      ? "Mathematically Out of Reach"
                      : `${Math.round((requiredResult.requiredMarks / remainingMax) * 100)}% required`}
                  </div>
                  <div className="text-[11px] text-white/80 mt-0.5">needed on remaining exam</div>
                </div>
              </div>

              <div className="p-3 bg-white/15 rounded-2xl text-xs text-white/95 leading-relaxed font-medium">
                {requiredResult.explanation}
              </div>
            </div>

            {/* Required Marks Inputs Form */}
            <div className="p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span>Your Current Marks & Goals</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Enter the marks you currently have, what remains, and your goal percentage.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="curr-marks" className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Current Marks
                  </label>
                  <input
                    id="curr-marks"
                    type="number"
                    min="0"
                    max={currentMax}
                    value={currentMarks}
                    onChange={(e) => setCurrentMarks(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-400">Marks already obtained</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="curr-max" className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Current Max Marks
                  </label>
                  <input
                    id="curr-max"
                    type="number"
                    min="1"
                    value={currentMax}
                    onChange={(e) => setCurrentMax(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-400">Total marks evaluated so far</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="rem-max" className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Remaining Max Marks
                  </label>
                  <input
                    id="rem-max"
                    type="number"
                    min="1"
                    value={remainingMax}
                    onChange={(e) => setRemainingMax(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-400">Marks remaining to be tested</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="target-pct" className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Target Percentage (%)
                  </label>
                  <input
                    id="target-pct"
                    type="number"
                    min="1"
                    max="100"
                    value={targetPercentage}
                    onChange={(e) => setTargetPercentage(Math.max(1, Math.min(100, Number(e.target.value) || 75)))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                  <div className="flex items-center gap-1 pt-1">
                    {[60, 75, 80, 90].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTargetPercentage(t)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md border cursor-pointer ${
                          targetPercentage === t
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {t}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>How is required marks calculated?</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The formula calculates the total marks needed across the combined assessment components:
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 text-center">
                Required Marks = ⌈(Total Possible Marks × Target%) ÷ 100⌉ - Current Marks
              </div>
              <p className="text-xs text-slate-500">
                If the required score exceeds the remaining maximum marks, the target is mathematically unachievable with the current score.
              </p>
            </div>
          </div>
        ) : (
          /* COMPOSITE MARKS CALCULATOR TAB */
          <>
            {/* Weightage Selector */}
        <div className="p-5 sm:p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Evaluation Weightage System</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {COMMON_MARKS_WEIGHTAGES.map((preset) => {
              const isSelected =
                internalWeight === preset.internal && externalWeight === preset.external;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label htmlFor="int-weight-input" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Internal Weightage (%)
              </label>
              <input
                id="int-weight-input"
                type="number"
                min="0"
                max="100"
                value={internalWeight}
                onChange={(e) => setInternalWeight(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-bold text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="ext-weight-input" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                External Weightage (%)
              </label>
              <input
                id="ext-weight-input"
                type="number"
                min="0"
                max="100"
                value={externalWeight}
                onChange={(e) => setExternalWeight(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-bold text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Results Banner */}
        <div
          id="marks-composite-result"
          data-saarvi-target="calculation-result"
          tabIndex={-1}
          className="p-6 sm:p-8 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-3xl shadow-md space-y-4 saarvi-destination-target outline-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Composite Aggregate
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer"
              aria-label="Copy composite marks result"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy result"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-indigo-100 font-medium">Weighted Percentage</div>
              <div className="text-3xl sm:text-5xl font-black tracking-tight mt-1">
                {result.overallPercentage}%
              </div>
              <div className="text-[11px] text-indigo-200 mt-0.5">composite score</div>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-indigo-100 font-medium">Internal Contrib</div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                {result.totalInternalScaled}
              </div>
              <div className="text-[11px] text-indigo-200 mt-0.5">scaled internal marks</div>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-indigo-100 font-medium">External Contrib</div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                {result.totalExternalScaled}
              </div>
              <div className="text-[11px] text-indigo-200 mt-0.5">scaled exam marks</div>
            </div>
          </div>

          <div className="text-xs text-indigo-100/90 pt-1 border-t border-white/15">
            {result.explanation}
          </div>
        </div>

        {/* Subjects Input List */}
        <div className="p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-slate-900">
                Course Marks Breakdown
              </h2>
              <p className="text-xs text-slate-500">
                Enter internal and semester-end external marks for each course.
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

          {/* Subject Rows */}
          <div className="space-y-4">
            {subjects.map((sub, idx) => (
              <div
                key={sub.id}
                className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={sub.name}
                    onChange={(e) => handleSubjectChange(sub.id, "name", e.target.value)}
                    placeholder={`e.g. Course ${idx + 1}`}
                    className="flex-1 px-3.5 py-1.5 text-sm font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSubject(sub.id)}
                    disabled={subjects.length <= 1}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label={`Remove ${sub.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label htmlFor={`int-obt-${sub.id}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Internal Obtained
                    </label>
                    <input
                      id={`int-obt-${sub.id}`}
                      type="number"
                      min="0"
                      value={sub.internalObtained}
                      onChange={(e) => handleSubjectChange(sub.id, "internalObtained", Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={`int-max-${sub.id}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Internal Max
                    </label>
                    <input
                      id={`int-max-${sub.id}`}
                      type="number"
                      min="1"
                      value={sub.internalMax}
                      onChange={(e) => handleSubjectChange(sub.id, "internalMax", Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={`ext-obt-${sub.id}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      External Obtained
                    </label>
                    <input
                      id={`ext-obt-${sub.id}`}
                      type="number"
                      min="0"
                      value={sub.externalObtained}
                      onChange={(e) => handleSubjectChange(sub.id, "externalObtained", Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={`ext-max-${sub.id}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      External Max
                    </label>
                    <input
                      id={`ext-max-${sub.id}`}
                      type="number"
                      min="1"
                      value={sub.externalMax}
                      onChange={(e) => handleSubjectChange(sub.id, "externalMax", Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddSubject}
            className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-blue-600 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Course</span>
          </button>
        </div>

        {/* Calculation Explanation */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>How does composite marks weightage work?</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Many universities evaluate semester performance using a composite split where internal assessments contribute a specific percentage (e.g. 40%) and the final term examination contributes the remainder (e.g. 60%).
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 text-center">
            Subject Score = (Internal Obt ÷ Internal Max) × Internal% + (External Obt ÷ External Max) × External%
          </div>
          <p className="text-xs text-slate-500">
            Evaluation formulas vary by institution and regulation. Please verify with your academic syllabus.
          </p>
        </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
