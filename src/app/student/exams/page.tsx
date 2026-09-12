"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { ExamRecord, ExamType } from "@/types/student";
import { formatCountdownText, calculateDaysRemaining } from "@/lib/student/algorithms/deadline-engine";
import { formatStudentDate } from "@/lib/student/date-utils";
import ReminderConfigFields from "@/components/student/ReminderConfigFields";
import { notificationService } from "@/lib/services/notificationService";
import { ReminderTiming } from "@/types/notifications";
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
} from "lucide-react";

const EXAM_TYPES: ExamType[] = ["Internal", "SEE", "Lab", "Practical", "Quiz", "Other"];

export default function ExamPlannerPage() {
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRecord | null>(null);

  // Form State
  const [subject, setSubject] = useState("");
  const [examType, setExamType] = useState<ExamType>("Internal");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("09:30");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Reminder State
  const [emailReminder, setEmailReminder] = useState(true);
  const [whatsappReminder, setWhatsappReminder] = useState(false);
  const [reminderTiming, setReminderTiming] = useState<ReminderTiming>("1_day_before");
  const [phoneOverride, setPhoneOverride] = useState("");

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      const data = await studentService.getExams();
      setExams(data || []);
    } catch {
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Split into Upcoming and Past
  const { upcomingExams, pastExams } = useMemo(() => {
    const upcoming: ExamRecord[] = [];
    const past: ExamRecord[] = [];

    for (const e of exams) {
      const diff = calculateDaysRemaining(e.date, todayStr);
      if (diff >= 0) {
        upcoming.push(e);
      } else {
        past.push(e);
      }
    }

    upcoming.sort((a, b) => {
      const dCmp = a.date.localeCompare(b.date);
      if (dCmp !== 0) return dCmp;
      return (a.time || "").localeCompare(b.time || "");
    });

    past.sort((a, b) => b.date.localeCompare(a.date));

    return { upcomingExams: upcoming, pastExams: past };
  }, [exams, todayStr]);

  const nextExam = upcomingExams.length > 0 ? upcomingExams[0] : null;

  const handleOpenAdd = () => {
    setEditingExam(null);
    setSubject("");
    setExamType("Internal");
    setDate(todayStr);
    setTime("09:30");
    setLocation("");
    setNotes("");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleOpenEdit = (e: ExamRecord) => {
    setEditingExam(e);
    setSubject(e.subject);
    setExamType((e.examType as ExamType) || "Internal");
    setDate(e.date);
    setTime(e.time || "09:30");
    setLocation(e.location || "");
    setNotes(e.notes || "");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMsg("Please enter subject name.");
      return;
    }
    if (!date) {
      setErrorMsg("Please choose exam date.");
      return;
    }

    const record: ExamRecord = {
      id: editingExam ? editingExam.id : `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subject: subject.trim(),
      examType,
      date,
      time: time.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: editingExam ? editingExam.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await studentService.saveExam(record);

    if ((emailReminder || whatsappReminder) && record.date) {
      await notificationService.scheduleReminder({
        eventId: record.id,
        eventType: "exam",
        eventTitle: `${record.subject} (${record.examType} Exam)`,
        scheduledDate: record.date,
        scheduledTime: record.time,
        reminderTiming,
        channels: {
          email: emailReminder,
          whatsapp: whatsappReminder,
        },
        phoneOverride,
      });
    }

    setShowModal(false);
    loadExams();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this exam?")) {
      await studentService.deleteExam(id);
      await notificationService.cancelReminder(id);
      loadExams();
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
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Exam & Assessment Planner</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
              Exam Schedule & Countdown
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Track Continuous Internal Evaluation (CIE), Semester End Exams (SEE), and Lab practicals with dynamic countdowns.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Exam</span>
          </button>
        </div>

        {/* Next Exam Hero Card */}
        {nextExam && (
          <div className="p-6 bg-linear-to-r from-blue-600 to-indigo-700 text-white rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
                Next Upcoming Exam
              </span>
              <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
                {formatCountdownText(nextExam.date, todayStr)}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black">{nextExam.subject}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-blue-100 font-medium">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-200" />
                  {formatStudentDate(nextExam.date)}
                </span>
                {nextExam.time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-200" />
                    {nextExam.time}
                  </span>
                )}
                {nextExam.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-200" />
                    {nextExam.location}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-white font-bold">
                  {nextExam.examType}
                </span>
              </div>
            </div>

            {nextExam.notes && (
              <p className="text-xs text-blue-100 bg-white/10 p-3 rounded-xl">
                {nextExam.notes}
              </p>
            )}
          </div>
        )}

        {/* Upcoming Exams Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Upcoming Exams ({upcomingExams.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading exams...</div>
          ) : upcomingExams.length === 0 ? (
            <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No exams scheduled</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You haven&apos;t scheduled any upcoming internal assessments, semester end exams, or practicals.
              </p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-blue-700"
              >
                + Schedule your first exam
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingExams.map((e) => {
                const days = calculateDaysRemaining(e.date, todayStr);
                const isUrgent = days <= 3;
                return (
                  <div
                    key={e.id}
                    className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-blue-300 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {e.examType}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            isUrgent
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {formatCountdownText(e.date, todayStr)}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                        {e.subject}
                      </h3>

                      <div className="space-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatStudentDate(e.date)}</span>
                        </div>
                        {e.time && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{e.time}</span>
                          </div>
                        )}
                        {e.location && (
                          <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Room: {e.location}</span>
                          </div>
                        )}
                      </div>

                      {e.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg italic">
                          {e.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(e)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                        aria-label="Edit exam"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                        aria-label="Delete exam"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past Exams Section */}
        {pastExams.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Past Exams ({pastExams.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pastExams.map((e) => (
                <div
                  key={e.id}
                  className="p-4 bg-slate-100/70 border border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-600"
                >
                  <div>
                    <span className="font-bold text-slate-800">{e.subject}</span>
                    <span className="ml-2 text-slate-500">({e.examType})</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">{formatStudentDate(e.date)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    aria-label="Remove past exam"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Exam Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingExam ? "Edit Scheduled Exam" : "Schedule New Exam"}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject / Course Name *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Mathematics for CS (BCS301)"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Exam Type</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as ExamType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Exam Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Room / Hall</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. LH-204"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Syllabus / Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Modules 1 to 3, bring scientific calculator"
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
                  {editingExam ? "Update Exam" : "Save Exam"}
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
