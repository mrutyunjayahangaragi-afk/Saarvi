"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { Assignment, AssignmentStatus, PriorityLevel } from "@/types/student";
import { sortAssignmentsMultiCriteria } from "@/lib/student/algorithms/assignment-sorter";
import { getDaysDifferenceFromToday, formatStudentDate } from "@/lib/student/date-utils";
import ReminderConfigFields from "@/components/student/ReminderConfigFields";
import { notificationService } from "@/lib/services/notificationService";
import { ReminderTiming } from "@/types/notifications";
import {
  FileText,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  X,
  AlertCircle,
} from "lucide-react";

export default function AssignmentPlannerPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("pending");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsgn, setEditingAsgn] = useState<Assignment | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("not_started");
  const [errorMsg, setErrorMsg] = useState("");

  // Reminder State
  const [emailReminder, setEmailReminder] = useState(true);
  const [whatsappReminder, setWhatsappReminder] = useState(false);
  const [reminderTiming, setReminderTiming] = useState<ReminderTiming>("same_day");
  const [phoneOverride, setPhoneOverride] = useState("");

  const loadAssignments = useCallback(async () => {
    try {
      const data = await studentService.getAssignments();
      setAssignments(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Multi-Criteria Deterministic Sort (O(N log N))
  const filteredAssignments = useMemo(() => {
    const subset = assignments.filter((a) => {
      if (filterStatus === "completed") return a.status === "completed";
      if (filterStatus === "pending") return a.status !== "completed";
      return true;
    });
    return sortAssignmentsMultiCriteria(subset);
  }, [assignments, filterStatus]);

  // Group upcoming by Day for calendar/day visualization
  const timelineGroup = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments.filter((x) => x.status !== "completed")) {
      const existing = map.get(a.dueDate) || [];
      existing.push(a);
      map.set(a.dueDate, existing);
    }
    const sortedDates = Array.from(map.keys()).sort();
    return sortedDates.slice(0, 5).map((d) => ({
      dateStr: d,
      displayDay: new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      items: map.get(d) || [],
    }));
  }, [assignments]);

  const handleOpenAdd = () => {
    setEditingAsgn(null);
    setTitle("");
    setSubject("");
    setDueDate(todayStr);
    setPriority("medium");
    setDescription("");
    setStatus("not_started");
    setErrorMsg("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (a: Assignment) => {
    setEditingAsgn(a);
    setTitle(a.title);
    setSubject(a.subject);
    setDueDate(a.dueDate);
    setPriority(a.priority);
    setDescription(a.description || "");
    setStatus(a.status);
    setErrorMsg("");
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim()) {
      setErrorMsg("Please enter both assignment title and subject.");
      return;
    }
    try {
      const saved = await studentService.saveAssignment({
        id: editingAsgn?.id,
        title: title.trim(),
        subject: subject.trim(),
        dueDate,
        priority,
        description: description.trim(),
        status,
      });

      if ((emailReminder || whatsappReminder) && saved.dueDate) {
        await notificationService.scheduleReminder({
          eventId: saved.id,
          eventType: "assignment",
          eventTitle: saved.title,
          scheduledDate: saved.dueDate,
          reminderTiming,
          channels: {
            email: emailReminder,
            whatsapp: whatsappReminder,
          },
          phoneOverride,
        });
      }

      setShowAddModal(false);
      loadAssignments();
    } catch {
      setErrorMsg("Couldn't save assignment. Local changes preserved.");
    }
  };

  const handleStatusToggle = async (a: Assignment) => {
    const nextStatus: AssignmentStatus =
      a.status === "completed"
        ? "not_started"
        : a.status === "not_started"
        ? "in_progress"
        : "completed";
    try {
      await studentService.saveAssignment({
        ...a,
        status: nextStatus,
      });
      loadAssignments();
    } catch {
      // Error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await studentService.deleteAssignment(id);
      await notificationService.cancelReminder(id);
      loadAssignments();
    } catch {
      // Error
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
              <FileText className="w-3.5 h-3.5" />
              <span>Deadlines & Submissions</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Assignment Planner
            </h1>
            <p className="text-sm text-slate-600">
              Track project milestones, problem sheets, and coursework deadlines with overdue alerts.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Assignment</span>
          </button>
        </div>

        {/* Quick Deadline Timeline Strip */}
        {timelineGroup.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Upcoming Deadlines Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {timelineGroup.map((g) => {
                const isOverdue = g.dateStr < todayStr;
                const isToday = g.dateStr === todayStr;
                return (
                  <div
                    key={g.dateStr}
                    className={`p-3.5 rounded-2xl border transition-colors ${
                      isOverdue
                        ? "bg-rose-50/70 border-rose-200 text-rose-900"
                        : isToday
                        ? "bg-blue-50/80 border-blue-200 text-blue-900"
                        : "bg-white border-slate-200/80 text-slate-800"
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider">
                      {isToday ? "Today" : isOverdue ? "Overdue" : g.displayDay}
                    </div>
                    <div className="text-xs font-semibold mt-1 truncate">
                      {g.items[0]?.title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {g.items[0]?.subject} {g.items.length > 1 && `+${g.items.length - 1} more`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            {[
              { id: "pending", label: "Active Deadlines" },
              { id: "completed", label: "Completed" },
              { id: "all", label: "All Items" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id as typeof filterStatus)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filterStatus === tab.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs font-semibold text-slate-500">
            {filteredAssignments.length} assignment{filteredAssignments.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Assignments List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-3xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No assignments in this view</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add upcoming homework, lab submissions, term papers, or presentation deadlines.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Assignment</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAssignments.map((a) => {
              const isOverdue = a.status !== "completed" && a.dueDate < todayStr;
              const isDueToday = a.status !== "completed" && a.dueDate === todayStr;

              return (
                <div
                  key={a.id}
                  className={`p-4 sm:p-5 bg-white border rounded-3xl shadow-xs transition-all space-y-2 hover:shadow-md ${
                    isOverdue
                      ? "border-rose-300 bg-rose-50/20"
                      : a.status === "completed"
                      ? "border-slate-200 bg-slate-50/50 opacity-80"
                      : "border-slate-200/90 hover:border-blue-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          {a.subject}
                        </span>
                        <h3
                          className={`text-sm font-bold text-slate-900 ${
                            a.status === "completed" ? "line-through text-slate-400" : ""
                          }`}
                        >
                          {a.title}
                        </h3>

                        {a.status !== "completed" && (() => {
                          const diff = getDaysDifferenceFromToday(a.dueDate);
                          if (diff < 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertTriangle className="w-3 h-3" /> Overdue by {Math.abs(diff)}d
                              </span>
                            );
                          }
                          if (diff === 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                <Clock className="w-3 h-3" /> Due Today
                              </span>
                            );
                          }
                          if (diff === 1) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                                <Clock className="w-3 h-3" /> Due Tomorrow
                              </span>
                            );
                          }
                          if (diff <= 3) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                                Due in {diff} days
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {a.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {a.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(a)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                          a.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : a.status === "in_progress"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {a.status === "completed"
                          ? "✓ Completed"
                          : a.status === "in_progress"
                          ? "In Progress"
                          : "Not Started"}
                      </button>

                      <div className="flex items-center gap-1 text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(a)}
                          className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          aria-label="Edit assignment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          aria-label="Delete assignment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Due: {a.dueDate}
                    </span>
                    <span className="capitalize font-semibold text-slate-600">
                      Priority: {a.priority}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal for Add / Edit */}
        {showAddModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-asgn-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 id="modal-asgn-title" className="text-base font-bold text-slate-900">
                  {editingAsgn ? "Edit Assignment" : "Add Assignment"}
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
                  <label htmlFor="modal-asgn-title" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Assignment Title
                  </label>
                  <input
                    id="modal-asgn-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Problem Set 3 — Normalization"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-asgn-subject" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Subject / Course
                    </label>
                    <input
                      id="modal-asgn-subject"
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. DBMS"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-asgn-duedate" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Due Date
                    </label>
                    <input
                      id="modal-asgn-duedate"
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-asgn-priority" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Priority
                    </label>
                    <select
                      id="modal-asgn-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-asgn-status" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Status
                    </label>
                    <select
                      id="modal-asgn-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as AssignmentStatus)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-asgn-desc" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Description / Instructions
                  </label>
                  <textarea
                    id="modal-asgn-desc"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Solve questions 1 to 8 on BCNF and 3NF decomposition"
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
                    {editingAsgn ? "Save Changes" : "Create Assignment"}
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
