"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { StudyTask, PriorityLevel } from "@/types/student";
import { detectIntervalConflicts } from "@/lib/student/algorithms/conflict-detector";
import { sortStudyTasksByPriority, calculateTaskPriorityScore } from "@/lib/student/algorithms/prioritization";
import { calculateStudyHours } from "@/lib/student/algorithms/productivity-analytics";
import ReminderConfigFields from "@/components/student/ReminderConfigFields";
import { notificationService } from "@/lib/services/notificationService";
import { ReminderTiming } from "@/types/notifications";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Circle,
  AlertCircle,
  BookOpen,
  Filter,
  X,
  Zap,
  TrendingUp,
} from "lucide-react";

export default function StudyPlannerPage() {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "today" | "upcoming" | "completed">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);

  // Form State
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("19:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Reminder State
  const [emailReminder, setEmailReminder] = useState(true);
  const [whatsappReminder, setWhatsappReminder] = useState(false);
  const [reminderTiming, setReminderTiming] = useState<ReminderTiming>("same_day");
  const [phoneOverride, setPhoneOverride] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      const data = await studentService.getStudyPlans();
      setTasks(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Interval-Overlap Conflict Detection (O(N log N))
  const conflictResult = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.completed).map((t) => ({
      id: t.id,
      title: t.subject,
      groupKey: t.date,
      startTime: t.startTime,
      durationMinutes: t.durationMinutes,
    }));
    return detectIntervalConflicts(activeTasks);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const list = tasks.filter((t) => {
      if (filter === "completed") return t.completed;
      if (filter === "today") return !t.completed && t.date === todayStr;
      if (filter === "upcoming") return !t.completed && t.date >= todayStr;
      return true;
    });
    return sortStudyTasksByPriority(list);
  }, [tasks, filter, todayStr]);

  const hoursSummary = useMemo(() => {
    const sessions = tasks.map((t) => ({
      id: t.id,
      subject: t.subject,
      topic: t.notes || t.subject,
      date: t.date,
      startTime: t.startTime,
      durationMinutes: t.durationMinutes,
      priority: t.priority,
      status: (t.completed ? "COMPLETED" : "PLANNED") as any,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    return calculateStudyHours(sessions, todayStr);
  }, [tasks, todayStr]);

  const handleOpenAdd = () => {
    setEditingTask(null);
    setSubject("");
    setDate(todayStr);
    setStartTime("19:00");
    setDurationMinutes(60);
    setPriority("medium");
    setNotes("");
    setErrorMsg("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (t: StudyTask) => {
    setEditingTask(t);
    setSubject(t.subject);
    setDate(t.date);
    setStartTime(t.startTime);
    setDurationMinutes(t.durationMinutes);
    setPriority(t.priority);
    setNotes(t.notes || "");
    setErrorMsg("");
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMsg("Please enter a subject name.");
      return;
    }
    try {
      const savedTask = await studentService.saveStudyPlan({
        id: editingTask?.id,
        subject: subject.trim(),
        date,
        startTime,
        durationMinutes,
        priority,
        notes: notes.trim(),
        completed: editingTask?.completed ?? false,
      });

      if (emailReminder || whatsappReminder) {
        await notificationService.scheduleReminder({
          eventId: savedTask.id,
          eventType: "study_session",
          eventTitle: savedTask.subject,
          scheduledDate: savedTask.date,
          scheduledTime: savedTask.startTime,
          reminderTiming,
          channels: {
            email: emailReminder,
            whatsapp: whatsappReminder,
          },
          phoneOverride,
        });
      }

      setShowAddModal(false);
      loadTasks();
    } catch {
      setErrorMsg("Couldn't save your task. Your local data is preserved.");
    }
  };

  const handleToggleComplete = async (t: StudyTask) => {
    try {
      await studentService.saveStudyPlan({
        ...t,
        completed: !t.completed,
      });
      loadTasks();
    } catch {
      // Error handling
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await studentService.deleteStudyPlan(id);
      await notificationService.cancelReminder(id);
      loadTasks();
    } catch {
      // Error handling
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Academic Planning</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Study Planner
            </h1>
            <p className="text-sm text-slate-600">
              Plan and prioritize your daily revision sessions and study blocks.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Session</span>
          </button>
        </div>

        {/* Study Hours Completed Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today&apos;s Focus</div>
            <div className="text-xl font-extrabold text-blue-600 mt-1">{hoursSummary.todayHours} hrs</div>
            <div className="text-[11px] text-slate-400 mt-0.5">completed today</div>
          </div>
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Week</div>
            <div className="text-xl font-extrabold text-indigo-600 mt-1">{hoursSummary.thisWeekHours} hrs</div>
            <div className="text-[11px] text-slate-400 mt-0.5">logged since Monday</div>
          </div>
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Month</div>
            <div className="text-xl font-extrabold text-emerald-600 mt-1">{hoursSummary.thisMonthHours} hrs</div>
            <div className="text-[11px] text-slate-400 mt-0.5">monthly cumulative</div>
          </div>
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sessions</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{hoursSummary.totalCompletedSessions}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">completed sessions</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            {[
              { id: "all", label: "All Sessions" },
              { id: "today", label: "Today" },
              { id: "upcoming", label: "Upcoming" },
              { id: "completed", label: "Completed" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filter === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs font-semibold text-slate-500">
            {filteredTasks.length} session{filteredTasks.length === 1 ? "" : "s"} listed
          </div>
        </div>

        {/* Task Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-white rounded-3xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No study sessions found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Schedule your upcoming revisions, reading sessions, or mock exam prep blocks.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Session</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                className={`p-5 bg-white border rounded-3xl shadow-xs transition-all space-y-3 ${
                  t.completed
                    ? "border-slate-200 bg-slate-50/50 opacity-75"
                    : "border-slate-200/90 hover:border-blue-300 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(t)}
                      className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      aria-label={t.completed ? "Mark as incomplete" : "Mark as completed"}
                    >
                      {t.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <h3
                        className={`text-sm font-bold text-slate-900 ${
                          t.completed ? "line-through text-slate-400" : ""
                        }`}
                      >
                        {t.subject}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {t.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {t.startTime} ({t.durationMinutes}m)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!t.completed && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-0.5" title={calculateTaskPriorityScore(t).explanation}>
                        <Zap className="w-2.5 h-2.5" />
                        <span>Score {calculateTaskPriorityScore(t).totalScore}</span>
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        t.priority === "high"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : t.priority === "medium"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {t.priority}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                      aria-label="Edit session"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Interval Overlap Conflict Alert */}
                {conflictResult.conflictingIds.has(t.id) && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Schedule Conflict:</span> Overlaps with session(s):
                      <div className="text-amber-800 mt-0.5">
                        {conflictResult.conflictMap.get(t.id)?.map((c, idx) => (
                          <div key={idx}>• {c.conflictingTitle} ({c.timeRange}, {c.overlapMinutes}m overlap)</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {t.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {t.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal for Add / Edit */}
        {showAddModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-study-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 id="modal-study-title" className="text-base font-bold text-slate-900">
                  {editingTask ? "Edit Study Session" : "Schedule Study Session"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close modal"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="modal-subject-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Subject / Topic
                  </label>
                  <input
                    id="modal-subject-input"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. DBMS Normalization & SQL"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-date-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Date
                    </label>
                    <input
                      id="modal-date-input"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-time-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Start Time
                    </label>
                    <input
                      id="modal-time-input"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-duration-select" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Duration
                    </label>
                    <select
                      id="modal-duration-select"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>60 mins (1 hr)</option>
                      <option value={90}>90 mins (1.5 hrs)</option>
                      <option value={120}>120 mins (2 hrs)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-priority-select" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Priority
                    </label>
                    <select
                      id="modal-priority-select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-notes-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Notes / Goals
                  </label>
                  <textarea
                    id="modal-notes-input"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Solve 5 previous year question papers"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <ReminderConfigFields
                  emailReminder={emailReminder}
                  setEmailReminder={setEmailReminder}
                  whatsappReminder={whatsappReminder}
                  setWhatsappReminder={setWhatsappReminder}
                  reminderTiming={reminderTiming}
                  setReminderTiming={setReminderTiming}
                  phoneOverride={phoneOverride}
                  setPhoneOverride={setPhoneOverride}
                />

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    {editingTask ? "Update Session" : "Schedule Session"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
