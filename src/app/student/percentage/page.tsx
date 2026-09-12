"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { calculatePercentage } from "@/lib/student/calculators/percentage";
import { SubjectMarks } from "@/types/student";
import {
  Percent,
  Plus,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  HelpCircle,
  Award,
  Calculator,
} from "lucide-react";

export default function PercentageCalculatorPage() {
  const [decimals, setDecimals] = useState<number>(2);
  const [copied, setCopied] = useState(false);

  const [subjects, setSubjects] = useState<SubjectMarks[]>([
    { id: "1", name: "Mathematics", obtained: 82, maximum: 100 },
    { id: "2", name: "Physics", obtained: 77, maximum: 100 },
    { id: "3", name: "Programming", obtained: 91, maximum: 100 },
    { id: "4", name: "English Communication", obtained: 85, maximum: 100 },
  ]);

  const result = useMemo(() => {
    return calculatePercentage(subjects, decimals);
  }, [subjects, decimals]);

  const handleAddSubject = () => {
    const nextId = String(Date.now());
    setSubjects((prev) => [
      ...prev,
      { id: nextId, name: `Subject ${prev.length + 1}`, obtained: 80, maximum: 100 },
    ]);
  };

  const handleRemoveSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubjectChange = (
    id: string,
    field: keyof SubjectMarks,
    value: string | number
  ) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleReset = () => {
    setSubjects([
      { id: "1", name: "Subject 1", obtained: 75, maximum: 100 },
      { id: "2", name: "Subject 2", obtained: 85, maximum: 100 },
    ]);
  };

  const handleCopy = async () => {
    const textToCopy = `Overall Score: ${result.percentage.toFixed(decimals)}% (${result.totalObtained}/${result.totalMaximum} marks)`;
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
            <Percent className="w-3.5 h-3.5" />
            <span>Academic Score Calculator</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Percentage Calculator
          </h1>
          <p className="text-sm text-slate-600">
            Calculate your total percentage and marks aggregate across multiple school or college subjects.
          </p>
        </div>

        {/* Results Card */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-3xl shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-200 flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Overall Percentage
            </span>
            <div className="flex items-center gap-3">
              <select
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value))}
                className="bg-white/15 text-white text-xs font-medium px-2.5 py-1.5 rounded-xl border border-white/20 focus:outline-none"
                aria-label="Decimal places"
              >
                <option value={2} className="text-slate-800">2 decimals</option>
                <option value={1} className="text-slate-800">1 decimal</option>
                <option value={0} className="text-slate-800">Round to integer</option>
              </select>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer"
                aria-label="Copy percentage score"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy result"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-violet-100 font-medium">Aggregate Percentage</div>
              <div className="text-3xl sm:text-5xl font-black tracking-tight mt-1">
                {result.percentage > 0 ? result.percentage.toFixed(decimals) : "0.00"}%
              </div>
              <div className="text-[11px] text-violet-200 mt-0.5">{result.gradeEstimate}</div>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-violet-100 font-medium">Marks Obtained</div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                {result.totalObtained}
              </div>
              <div className="text-[11px] text-violet-200 mt-0.5">out of {result.totalMaximum} maximum</div>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xs">
              <div className="text-xs text-violet-100 font-medium">Evaluated Subjects</div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                {result.subjectCount}
              </div>
              <div className="text-[11px] text-violet-200 mt-0.5">courses entered</div>
            </div>
          </div>

          <div className="text-xs text-violet-100/90 pt-1 border-t border-white/15">
            {result.explanation}
          </div>
        </div>

        {/* Subjects Input List */}
        <div className="p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-violet-600" />
                <span>Enter Marks by Subject</span>
              </h2>
              <p className="text-xs text-slate-500">
                Enter the marks you scored alongside the maximum possible marks.
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
          <div className="space-y-3">
            {subjects.map((sub, idx) => {
              const obt = Number(sub.obtained) || 0;
              const max = Number(sub.maximum) || 100;
              const hasError = obt > max;
              const subPct = max > 0 ? Math.round((obt / max) * 1000) / 10 : 0;

              return (
                <div
                  key={sub.id}
                  className={`p-3 sm:p-4 bg-slate-50/70 border rounded-2xl grid grid-cols-12 gap-2.5 items-center transition-colors ${
                    hasError ? "border-red-300 bg-red-50/30" : "border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <label htmlFor={`pct-sub-name-${sub.id}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block sm:hidden">
                      Subject
                    </label>
                    <input
                      id={`pct-sub-name-${sub.id}`}
                      type="text"
                      value={sub.name}
                      onChange={(e) => handleSubjectChange(sub.id, "name", e.target.value)}
                      placeholder={`e.g. Subject ${idx + 1}`}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-800"
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-3 space-y-1">
                    <label htmlFor={`pct-sub-obt-${sub.id}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Obtained Marks
                    </label>
                    <input
                      id={`pct-sub-obt-${sub.id}`}
                      type="number"
                      min="0"
                      step="any"
                      value={sub.obtained}
                      onChange={(e) => handleSubjectChange(sub.id, "obtained", Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-800 font-semibold text-center"
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`pct-sub-max-${sub.id}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Max Marks
                      </label>
                      <span className="text-[10px] font-bold text-slate-400">
                        ({subPct}%)
                      </span>
                    </div>
                    <input
                      id={`pct-sub-max-${sub.id}`}
                      type="number"
                      min="1"
                      step="any"
                      value={sub.maximum}
                      onChange={(e) => handleSubjectChange(sub.id, "maximum", Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-800 font-semibold text-center"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex justify-end pt-5 sm:pt-0">
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

                  {hasError && (
                    <div className="col-span-12 text-[11px] font-medium text-red-600">
                      Obtained marks ({obt}) cannot exceed maximum marks ({max}).
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddSubject}
            className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 text-violet-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Subject</span>
          </button>
        </div>

        {/* Calculation Explanation */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <HelpCircle className="w-4 h-4 text-violet-600" />
            <span>How is percentage calculated?</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The overall percentage is calculated by summing the marks obtained in all subjects and dividing by the sum of maximum marks across all subjects, multiplied by 100:
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 text-center">
            Percentage = (Total Marks Obtained ÷ Total Maximum Marks) × 100
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
