"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { StudentGoal, GoalCategory, GoalStatus } from "@/types/student";
import { formatCountdownText, calculateDaysRemaining } from "@/lib/student/algorithms/deadline-engine";
import { formatStudentDate } from "@/lib/student/date-utils";
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  TrendingUp,
  Sparkles,
} from "lucide-react";

const CATEGORIES: GoalCategory[] = ["Academic", "Coding", "Projects", "Career", "Fitness", "Personal"];

export default function StudentGoalsPage() {
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | GoalCategory>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<StudentGoal | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("Academic");
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GoalStatus>("ACTIVE");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await studentService.getGoals();
      setGoals(data || []);
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const filteredGoals = useMemo(() => {
    return goals
      .filter((g) => categoryFilter === "ALL" || g.category === categoryFilter)
      .sort((a, b) => {
        // Active before Completed/Cancelled
        const isClosedA = a.status === "COMPLETED" || a.status === "CANCELLED";
        const isClosedB = b.status === "COMPLETED" || b.status === "CANCELLED";
        if (isClosedA !== isClosedB) return isClosedA ? 1 : -1;
        return a.targetDate.localeCompare(b.targetDate);
      });
  }, [goals, categoryFilter]);

  const handleOpenAdd = () => {
    setEditingGoal(null);
    setTitle("");
    setCategory("Academic");
    setTargetDate(todayStr);
    setProgress(0);
    setStatus("ACTIVE");
    setNotes("");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleOpenEdit = (g: StudentGoal) => {
    setEditingGoal(g);
    setTitle(g.title);
    setCategory(g.category);
    setTargetDate(g.targetDate);
    setProgress(g.progress);
    setStatus(g.status);
    setNotes(g.notes || "");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleUpdateProgress = async (g: StudentGoal, nextProgress: number) => {
    const clamped = Math.max(0, Math.min(100, nextProgress));
    const nextStatus: GoalStatus = clamped === 100 ? "COMPLETED" : g.status === "COMPLETED" ? "ACTIVE" : g.status;
    const updated: StudentGoal = {
      ...g,
      progress: clamped,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    await studentService.saveGoal(updated);
    loadGoals();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please enter goal title.");
      return;
    }

    const item: StudentGoal = {
      id: editingGoal ? editingGoal.id : `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      category,
      targetDate,
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      status,
      notes: notes.trim() || undefined,
      createdAt: editingGoal ? editingGoal.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await studentService.saveGoal(item);
    setShowModal(false);
    loadGoals();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this goal?")) {
      await studentService.deleteGoal(id);
      loadGoals();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              <Target className="w-3.5 h-3.5" />
              <span>Student Goal Tracker</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
              Semester & Growth Goals
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Set milestones for CGPA targets, coding challenges, hackathon projects, and career preparation.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Set New Goal</span>
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
              categoryFilter === "ALL"
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-white text-slate-600 border-slate-200/80 hover:border-slate-300"
            }`}
          >
            All Goals ({goals.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = goals.filter((g) => g.category === cat).length;
            const isSelected = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Goals Grid */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading goals...</div>
        ) : filteredGoals.length === 0 ? (
          <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No goals set yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Setting specific milestones keeps you accountable throughout the semester.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-blue-700"
            >
              + Create your first goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGoals.map((g) => {
              const isCompleted = g.status === "COMPLETED";
              const isPaused = g.status === "PAUSED";
              const days = calculateDaysRemaining(g.targetDate, todayStr);

              return (
                <div
                  key={g.id}
                  className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-blue-300 transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                        {g.category}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700"
                            : isPaused
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-2">{g.title}</h3>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Progress</span>
                        <span className="font-bold text-slate-900">{g.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${g.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick progress increment buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {[25, 50, 75, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleUpdateProgress(g, pct)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                            g.progress === pct
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Target: {formatStudentDate(g.targetDate)}</span>
                      <span className="ml-1 text-[11px] font-medium text-slate-500">
                        ({formatCountdownText(g.targetDate, todayStr)})
                      </span>
                    </div>

                    {g.notes && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg italic line-clamp-2">
                        {g.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(g)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                      aria-label="Edit goal"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(g.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                      aria-label="Delete goal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingGoal ? "Edit Goal" : "Set New Goal"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Goal Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Score SGPA >= 9.0 in 4th Semester"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GoalCategory)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Progress: {progress}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GoalStatus)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PAUSED">Paused</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Action Plan / Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key milestones or study resources..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {editingGoal ? "Update Goal" : "Set Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
