"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { TaskItem, TaskItemStatus, TaskPriority } from "@/types/student";
import { formatCountdownText, calculateDaysRemaining } from "@/lib/student/algorithms/deadline-engine";
import { formatStudentDate } from "@/lib/student/date-utils";
import ReminderConfigFields from "@/components/student/ReminderConfigFields";
import { notificationService } from "@/lib/services/notificationService";
import { ReminderTiming } from "@/types/notifications";
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  X,
  Filter,
  Layers,
} from "lucide-react";

const CATEGORIES = ["General", "Lab Prep", "Homework", "Project", "Reading", "Revision", "Administrative", "Personal"];

export default function TaskManagerPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskItemStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | TaskPriority>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("");
  const [status, setStatus] = useState<TaskItemStatus>("TODO");
  const [errorMsg, setErrorMsg] = useState("");

  // Notification Reminders
  const [emailReminder, setEmailReminder] = useState(true);
  const [whatsappReminder, setWhatsappReminder] = useState(false);
  const [reminderTiming, setReminderTiming] = useState<ReminderTiming>("same_day");
  const [phoneOverride, setPhoneOverride] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await studentService.getTasks();
      setTasks(data || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
        const matchesPrio = priorityFilter === "ALL" || t.priority === priorityFilter;
        return matchesStatus && matchesPrio;
      })
      .sort((a, b) => {
        // Incomplete first
        const isCompA = a.status === "COMPLETED" || a.status === "CANCELLED";
        const isCompB = b.status === "COMPLETED" || b.status === "CANCELLED";
        if (isCompA !== isCompB) return isCompA ? 1 : -1;

        // Overdue first if due date present
        if (a.dueDate && b.dueDate) {
          const diffA = calculateDaysRemaining(a.dueDate, todayStr);
          const diffB = calculateDaysRemaining(b.dueDate, todayStr);
          const isOverdueA = diffA < 0;
          const isOverdueB = diffB < 0;
          if (isOverdueA !== isOverdueB) return isOverdueA ? -1 : 1;
          const dCmp = a.dueDate.localeCompare(b.dueDate);
          if (dCmp !== 0) return dCmp;
        }

        // Priority descending
        const pWeight: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const pwA = pWeight[a.priority] || 1;
        const pwB = pWeight[b.priority] || 1;
        if (pwA !== pwB) return pwB - pwA;

        return a.title.localeCompare(b.title);
      });
  }, [tasks, statusFilter, priorityFilter, todayStr]);

  const handleOpenAdd = () => {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setCategory("General");
    setPriority("MEDIUM");
    setDueDate(todayStr);
    setDueTime("");
    setStatus("TODO");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleOpenEdit = (t: TaskItem) => {
    setEditingTask(t);
    setTitle(t.title);
    setDescription(t.description || "");
    setCategory(t.category || "General");
    setPriority(t.priority || "MEDIUM");
    setDueDate(t.dueDate || todayStr);
    setDueTime(t.dueTime || "");
    setStatus(t.status || "TODO");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleToggleStatus = async (t: TaskItem) => {
    const nextStatus: TaskItemStatus = t.status === "COMPLETED" ? "TODO" : "COMPLETED";
    const updated: TaskItem = { ...t, status: nextStatus, updatedAt: new Date().toISOString() };
    await studentService.saveTask(updated);
    loadTasks();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please enter task title.");
      return;
    }

    const item: TaskItem = {
      id: editingTask ? editingTask.id : `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime.trim() || undefined,
      status,
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await studentService.saveTask(item);

    if ((emailReminder || whatsappReminder) && item.dueDate) {
      await notificationService.scheduleReminder({
        eventId: item.id,
        eventType: "task",
        eventTitle: item.title,
        scheduledDate: item.dueDate,
        scheduledTime: item.dueTime,
        reminderTiming,
        channels: {
          email: emailReminder,
          whatsapp: whatsappReminder,
        },
        phoneOverride,
      });
    }

    setShowModal(false);
    loadTasks();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this task?")) {
      await studentService.deleteTask(id);
      await notificationService.cancelReminder(id);
      loadTasks();
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
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Student Task Manager</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
              Tasks & To-Dos
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Organize daily coursework, lab preparation, reading assignments, and academic to-dos.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {(["ALL", "TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No tasks found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {tasks.length === 0
                ? "You haven't created any tasks yet. Keep your coursework and daily study goals organized."
                : "No tasks match the selected filters."}
            </p>
            {tasks.length === 0 && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-blue-700"
              >
                + Create your first task
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.map((t) => {
              const isDone = t.status === "COMPLETED";
              const isCancelled = t.status === "CANCELLED";
              const daysRemaining = t.dueDate ? calculateDaysRemaining(t.dueDate, todayStr) : null;
              const isOverdue = daysRemaining !== null && daysRemaining < 0 && !isDone && !isCancelled;

              return (
                <div
                  key={t.id}
                  className={`p-4 bg-white border rounded-2xl shadow-xs transition-all flex items-start justify-between gap-3 ${
                    isDone
                      ? "opacity-60 border-slate-200"
                      : isOverdue
                      ? "border-rose-200 bg-rose-50/20"
                      : "border-slate-200/90 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(t)}
                      className="mt-0.5 text-slate-400 hover:text-blue-600 cursor-pointer shrink-0"
                      aria-label="Toggle task status"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500" />
                      )}
                    </button>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isDone ? "line-through text-slate-400" : "text-slate-900"
                          }`}
                        >
                          {t.title}
                        </span>

                        {t.category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {t.category}
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            t.priority === "HIGH"
                              ? "bg-rose-50 text-rose-700"
                              : t.priority === "MEDIUM"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>

                      {t.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                        {t.dueDate && (
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              isOverdue ? "text-rose-600 font-bold" : "text-slate-500"
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {formatStudentDate(t.dueDate)}
                            <span className="ml-1 text-[11px]">
                              ({formatCountdownText(t.dueDate, todayStr)})
                            </span>
                          </span>
                        )}
                        {t.dueTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {t.dueTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                      aria-label="Edit task"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                      aria-label="Delete task"
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

      {/* Add / Edit Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingTask ? "Edit Task" : "Create New Task"}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Complete Lab 4 observation sheet"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskItemStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional context or checklist items..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                  {editingTask ? "Update Task" : "Create Task"}
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
