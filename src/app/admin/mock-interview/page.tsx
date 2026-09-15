"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import {
  InterviewQuestion,
  InterviewCompany,
  InterviewSettings,
} from "@/types/interview";
import { SEEDED_QUESTIONS } from "@/lib/services/interviewService";
import {
  ShieldCheck,
  Building2,
  Filter,
  Plus,
  Edit2,
  Clock,
  Eye,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Save,
  Layers,
} from "lucide-react";

export default function AdminMockInterviewPage() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>(SEEDED_QUESTIONS);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("All");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("All");
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null);

  // Settings state
  const [settings, setSettings] = useState<InterviewSettings>({
    defaultMcqTimeLimitSeconds: 60,
    defaultVideoTimeLimitSeconds: 120,
    maxProctoringWarnings: 4,
    enableCameraDeviceCheck: true,
    enableAiTtsFallback: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/interview");
        const data = await res.json();
        if (data.success && data.questions) {
          setQuestions(data.questions);
          if (data.settings) setSettings(data.settings);
        }
      } catch {
        // use seeded questions
      }
    }
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSaveSuccessNotice(false);
    try {
      await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          settings,
        }),
      });
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch {
      alert("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (selectedCompanyFilter !== "All" && q.company !== selectedCompanyFilter) return false;
    if (selectedRoleFilter !== "All" && q.role !== selectedRoleFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Header Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Admin Portal
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Mock Interview 2.0 Moderation
            </span>
          </div>

          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Live System Verified
          </span>
        </div>

        <div className="space-y-6">
          {/* Top Overview Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h1 className="text-xl font-black text-slate-900">
              Mock Interview 2.0 Question Bank & Proctoring Controls
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Curated company-attributed questions (Google, Microsoft, Amazon, Infosys, TCS, Wipro, Accenture) with rotation exposure telemetry and authoritative timer enforcement.
            </p>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xl font-bold text-slate-900">{questions.length}</div>
                <div className="text-[11px] font-semibold text-slate-500">Active Questions</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xl font-bold text-slate-900">7</div>
                <div className="text-[11px] font-semibold text-slate-500">Top Companies</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xl font-bold text-slate-900">{settings.defaultMcqTimeLimitSeconds}s</div>
                <div className="text-[11px] font-semibold text-slate-500">MCQ Timer</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xl font-bold text-slate-900">{settings.maxProctoringWarnings}</div>
                <div className="text-[11px] font-semibold text-slate-500">Max Warnings</div>
              </div>
            </div>
          </div>

          {/* Engine Settings Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Proctoring & Timer Configuration
              </h2>
              {saveSuccessNotice && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Settings saved successfully
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Default MCQ Timer (Seconds)
                </label>
                <input
                  type="number"
                  value={settings.defaultMcqTimeLimitSeconds}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      defaultMcqTimeLimitSeconds: Number(e.target.value) || 60,
                    }))
                  }
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Default Video/Behavioral Timer (Seconds)
                </label>
                <input
                  type="number"
                  value={settings.defaultVideoTimeLimitSeconds}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      defaultVideoTimeLimitSeconds: Number(e.target.value) || 120,
                    }))
                  }
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Max Warnings Before Auto-Termination
                </label>
                <input
                  type="number"
                  value={settings.maxProctoringWarnings}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maxProctoringWarnings: Number(e.target.value) || 4,
                    }))
                  }
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingSettings ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>

          {/* Question Bank Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Question Bank Inventory ({filteredQuestions.length})
              </h2>

              <div className="flex items-center gap-3">
                <select
                  value={selectedCompanyFilter}
                  onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg p-1.5 bg-white font-medium"
                >
                  <option value="All">All Companies</option>
                  <option value="Google">Google</option>
                  <option value="Microsoft">Microsoft</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Infosys">Infosys</option>
                  <option value="TCS">TCS</option>
                  <option value="Wipro">Wipro</option>
                  <option value="Accenture">Accenture</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuestion(q)}
                  className="py-3 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {q.company}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 uppercase">
                        {q.type}
                      </span>
                      <span className="text-[10px] text-slate-400">&bull;</span>
                      <span className="text-[10px] text-slate-500">{q.role}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                      {q.question}
                    </p>
                  </div>

                  <div className="shrink-0 text-right text-[11px] text-slate-400">
                    <div>Limit: {q.timeLimitSeconds}s</div>
                    <div>Exposures: {q.exposureCount}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Question Detail Drawer */}
        {selectedQuestion && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                  {selectedQuestion.company} &bull; {selectedQuestion.type.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedQuestion(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                >
                  Close &times;
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Question Prompt</label>
                <p className="text-xs font-semibold text-slate-900">{selectedQuestion.question}</p>
              </div>

              {selectedQuestion.options && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Options</label>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {selectedQuestion.options.map((opt, i) => (
                      <li
                        key={i}
                        className={`p-2 rounded border ${
                          selectedQuestion.correctAnswer === i
                            ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-900"
                            : "border-slate-200"
                        }`}
                      >
                        {String.fromCharCode(65 + i)}: {opt}{" "}
                        {selectedQuestion.correctAnswer === i && "✓ (Correct Answer)"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedQuestion.explanation && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Explanation</label>
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                    {selectedQuestion.explanation}
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedQuestion(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
