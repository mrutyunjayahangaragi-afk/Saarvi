"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import {
  SemesterRecord,
  AttendanceRecord,
  CalculationHistoryEntry,
  StudentAcademicProfile,
} from "@/lib/academic/types";
import {
  TaskItem,
  Assignment,
  ExamRecord,
  TimetableEntry,
  StudySession,
  StudentGoal,
  CertificateRecord,
  InternshipApplication,
  HackathonRecord,
  UnifiedDeadline,
} from "@/types/student";
import { calculateCGPA, calculateAttendance } from "@/lib/academic/engine/calculations";
import { VTU_ACADEMIC_CONFIG } from "@/lib/academic/universities/vtu";
import {
  aggregateDeadlines,
  groupDeadlinesByUrgency,
  calculateDaysRemaining,
  formatCountdownText,
} from "@/lib/student/algorithms/deadline-engine";
import {
  calculateStudyHours,
  generateWorkspaceInsights,
  WorkspaceInsight,
} from "@/lib/student/algorithms/productivity-analytics";
import { detectIntervalConflicts } from "@/lib/student/algorithms/conflict-detector";
import { getTodayDateString, formatStudentDate, timeStringToMinutes, minutesToTimeString } from "@/lib/student/date-utils";
import {
  recommendationEngine,
  dismissRecommendationKey,
} from "@/lib/student/personalization/recommendation-engine";
import {
  StudentRecommendation,
  SmartDailyPlan,
  PersonalizationContextInput,
} from "@/types/personalization";
import {
  CareerProfile,
  JobApplication,
  InterviewRecord,
  ResumeVersion,
} from "@/types/career";
import {
  GraduationCap,
  Award,
  Clock,
  TrendingUp,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  CalendarDays,
  Sparkles,
  Plus,
  BookOpen,
  Target,
  Briefcase,
  Trophy,
  CheckSquare,
  AlertTriangle,
  Search,
  Bell,
  X,
  MapPin,
  Circle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Filter,
} from "lucide-react";

type WorkspaceTab =
  | "overview"
  | "today"
  | "deadlines"
  | "timetable"
  | "attendance"
  | "calendar"
  | "goals"
  | "career"
  | "semesters";

export default function StudentDashboardPage() {
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [internships, setInternships] = useState<InternshipApplication[]>([]);
  const [hackathons, setHackathons] = useState<HackathonRecord[]>([]);
  const [careerProfile, setCareerProfile] = useState<CareerProfile | null>(null);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [dismissedRecIds, setDismissedRecIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");

  // Notifications / Feedback
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Search Modal
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; type: string; title: string; subtitle: string; route: string }>
  >([]);

  // Quick Action Modal
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<"task" | "assignment" | "exam" | "study" | "goal">("task");

  // File Input for Restore
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Today Date
  const todayStr = useMemo(() => getTodayDateString(), []);
  const todayWeekday = useMemo(() => {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        allProfiles,
        allSemesters,
        allAttendance,
        allTasks,
        allAsgns,
        allExams,
        allTT,
        allSessions,
        allGoals,
        allCerts,
        allInterns,
        allHacks,
        cProf,
        allApps,
        allIntvs,
        allResumes,
      ] = await Promise.all([
        academicStorage.getAllProfiles(),
        academicStorage.getSemesterRecords(),
        academicStorage.getAttendanceRecords(),
        academicStorage.getTasks(),
        academicStorage.getAssignments(),
        academicStorage.getExams(),
        academicStorage.getTimetable(),
        academicStorage.getStudySessions(),
        academicStorage.getStudentGoals(),
        academicStorage.getCertificates(),
        academicStorage.getInternships(),
        academicStorage.getHackathons(),
        academicStorage.getCareerProfile(),
        academicStorage.getAllJobApplications(),
        academicStorage.getAllInterviews(),
        academicStorage.getAllResumeVersions(),
      ]);

      setProfile(allProfiles[0] || null);
      setSemesters(allSemesters);
      setAttendance(allAttendance);
      setTasks(allTasks);
      setAssignments(allAsgns);
      setExams(allExams);
      setTimetable(allTT);
      setStudySessions(allSessions);
      setGoals(allGoals);
      setCertificates(allCerts);
      setInternships(allInterns);
      setHackathons(allHacks);
      setCareerProfile(cProf);
      setJobApplications(allApps);
      setInterviews(allIntvs);
      setResumeVersions(allResumes);
    } catch (err) {
      console.error("Failed to load student workspace data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Personalization Engine Integration
  const personalizationInput = useMemo<PersonalizationContextInput>(() => ({
    profile,
    attendanceRecords: attendance,
    exams,
    assignments,
    tasks,
    timetableEntries: timetable,
    studySessions,
    hackathons,
    careerProfile,
    jobApplications,
    interviews,
    resumeVersions,
  }), [profile, attendance, exams, assignments, tasks, timetable, studySessions, hackathons, careerProfile, jobApplications, interviews, resumeVersions]);

  const recommendations = useMemo(() => {
    const raw = recommendationEngine.generateRecommendations(personalizationInput, { limit: 6 });
    return raw.filter((r) => !dismissedRecIds.includes(r.id));
  }, [personalizationInput, dismissedRecIds]);

  const smartDailyPlan = useMemo(() => {
    return recommendationEngine.generateSmartDailyPlan(personalizationInput);
  }, [personalizationInput]);

  const handleDismissRec = (id: string) => {
    dismissRecommendationKey(id);
    setDismissedRecIds((prev) => [...prev, id]);
  };

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const showFeedback = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    academicStorage.searchWorkspace(searchQuery).then(setSearchResults);
  }, [searchQuery]);

  // Academic CGPA
  const cgpaResult = useMemo(() => {
    return calculateCGPA(semesters, VTU_ACADEMIC_CONFIG.calculationRules);
  }, [semesters]);

  const latestSemester = useMemo(() => {
    if (semesters.length === 0) return null;
    return semesters[semesters.length - 1];
  }, [semesters]);

  // Unified Deadlines
  const allDeadlines = useMemo(() => {
    return aggregateDeadlines({
      assignments,
      exams,
      tasks,
      goals,
      internships,
      hackathons,
      baseDateStr: todayStr,
    });
  }, [assignments, exams, tasks, goals, internships, hackathons, todayStr]);

  const deadlinesByUrgency = useMemo(() => {
    return groupDeadlinesByUrgency(allDeadlines);
  }, [allDeadlines]);

  // Study Hours Analytics
  const studyHours = useMemo(() => {
    return calculateStudyHours(studySessions, todayStr);
  }, [studySessions, todayStr]);

  // Deterministic Insights
  const insights = useMemo(() => {
    return generateWorkspaceInsights({
      assignments,
      exams,
      tasks,
      timetable,
      studySessions,
      attendance,
      internships,
      baseDateStr: todayStr,
    });
  }, [assignments, exams, tasks, timetable, studySessions, attendance, internships, todayStr]);

  // Timetable Conflict Check
  const timetableConflicts = useMemo(() => {
    const items = timetable.map((c) => ({
      id: c.id,
      title: c.subject,
      groupKey: c.day,
      startTime: c.startTime,
      endTime: c.endTime,
    }));
    return detectIntervalConflicts(items);
  }, [timetable]);

  // Today's Timetable Status (Current class, Next class, Remaining classes)
  const todayClasses = useMemo(() => {
    return timetable
      .filter((c) => c.day.toLowerCase() === todayWeekday.toLowerCase())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timetable, todayWeekday]);

  const currentClassStatus = useMemo(() => {
    if (todayClasses.length === 0) return null;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let current: TimetableEntry | null = null;
    let next: TimetableEntry | null = null;
    const remaining: TimetableEntry[] = [];

    for (const c of todayClasses) {
      const start = timeStringToMinutes(c.startTime);
      const end = c.endTime ? timeStringToMinutes(c.endTime) : start + 60;

      if (currentMins >= start && currentMins < end) {
        current = c;
      } else if (start > currentMins) {
        if (!next) next = c;
        remaining.push(c);
      }
    }

    return { current, next, remaining, totalToday: todayClasses.length };
  }, [todayClasses]);

  // Today's Study Sessions
  const todaySessions = useMemo(() => {
    return studySessions
      .filter((s) => s.date === todayStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [studySessions, todayStr]);

  // Today's Assignments & Tasks
  const todayAssignments = useMemo(() => {
    return assignments.filter((a) => a.dueDate === todayStr && a.status !== "completed");
  }, [assignments, todayStr]);

  const todayTasks = useMemo(() => {
    return tasks.filter((t) => t.dueDate === todayStr && t.status !== "COMPLETED");
  }, [tasks, todayStr]);

  // Next Upcoming Exam
  const nextExam = useMemo(() => {
    const upcoming = exams
      .filter((e) => calculateDaysRemaining(e.date, todayStr) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [exams, todayStr]);

  // Overall Attendance Summary
  const attendanceSummary = useMemo(() => {
    if (attendance.length === 0) return null;
    const totalHeld = attendance.reduce((s, a) => s + a.totalClasses, 0);
    const totalAtt = attendance.reduce((s, a) => s + a.attendedClasses, 0);
    const overallPct = totalHeld > 0 ? Math.round((totalAtt / totalHeld) * 100) : 0;
    const critical = attendance.filter((a) => a.totalClasses > 0 && a.currentPercentage < 75);
    const warning = attendance.filter(
      (a) => a.totalClasses > 0 && a.currentPercentage >= 75 && a.currentPercentage < 85
    );
    return { overallPct, totalHeld, totalAtt, criticalCount: critical.length, warningCount: warning.length };
  }, [attendance]);

  // Export Workspace Backup
  const handleExportWorkspace = async () => {
    try {
      const jsonStr = await academicStorage.exportFullWorkspace();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saarvi-student-workspace-${todayStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback("Workspace exported successfully! Kept 100% local.");
    } catch {
      showFeedback("Failed to export workspace.", "error");
    }
  };

  // Import Workspace Backup
  const handleImportWorkspace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const res = await academicStorage.importFullWorkspace(text);
          await loadAllData();
          const totalImported = Object.values(res.importedCounts).reduce((s, n) => s + n, 0);
          showFeedback(`Restored ${totalImported} items successfully!`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Invalid workspace JSON format";
          showFeedback(msg, "error");
        }
      };
      reader.readAsText(file);
    } catch {
      showFeedback("Failed to read file.", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Reset Local Workspace
  const handleResetWorkspace = async () => {
    if (
      confirm(
        "Are you sure you want to reset your local student workspace? All tasks, timetable classes, study plans, exams, and attendance stored in this browser will be deleted."
      )
    ) {
      await academicStorage.clearAllData();
      await loadAllData();
      showFeedback("Local student workspace reset.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. WORKSPACE HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 sm:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-2xs">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Student Productivity Workspace</span>
              </span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                Local-First • Zero Cloud Leakage
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {profile ? `${profile.displayName || "Student"}'s Academic Hub` : "Student Productivity Hub"}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Unified semester tracking, daily class timetable, assignments, exams, conflict-aware study sessions,
              and career goals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
              title="Search workspace (Cmd+K)"
            >
              <Search className="w-4 h-4 text-slate-500" />
              <span>Search</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-white border border-slate-300 rounded-md font-mono text-slate-500">
                ⌘K
              </kbd>
            </button>

            <Link
              href="/student/settings/notifications"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Configure smart planning reminders (Email / WhatsApp)"
            >
              <Bell className="w-4 h-4 text-blue-600" />
              <span>Reminders</span>
            </Link>

            <button
              type="button"
              onClick={handleExportWorkspace}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Backup entire workspace to JSON"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Backup</span>
            </button>

            <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Restore</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportWorkspace}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleResetWorkspace}
              className="p-2 text-slate-400 hover:text-red-600 rounded-2xl hover:bg-red-50 transition-all cursor-pointer"
              title="Reset local workspace"
              aria-label="Reset local workspace"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. ACADEMIC & PRODUCTIVITY KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Cumulative CGPA */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">CGPA</span>
              <GraduationCap className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {cgpaResult.cgpa > 0 ? cgpaResult.cgpa.toFixed(2) : "—"}
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {cgpaResult.percentageEquivalent > 0
                ? `${cgpaResult.percentageEquivalent}% Equiv.`
                : "No sem records"}
            </div>
          </div>

          {/* Latest SGPA */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Latest SGPA</span>
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600">
              {latestSemester ? latestSemester.sgpa.toFixed(2) : "—"}
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {latestSemester ? `Sem ${latestSemester.semester}` : "Enter marks"}
            </div>
          </div>

          {/* Attendance % */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Attendance</span>
              <CheckCircle2
                className={`w-4 h-4 ${
                  !attendanceSummary
                    ? "text-slate-400"
                    : attendanceSummary.overallPct >= 75
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-black ${
                !attendanceSummary
                  ? "text-slate-900"
                  : attendanceSummary.overallPct >= 75
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {attendanceSummary ? `${attendanceSummary.overallPct}%` : "—"}
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {attendanceSummary
                ? `${attendanceSummary.totalAtt}/${attendanceSummary.totalHeld} classes`
                : "Log subjects"}
            </div>
          </div>

          {/* Study Hours this Week */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Study Time</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {studyHours.thisWeekHours} <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {studyHours.todayHours > 0 ? `${studyHours.todayHours}h today` : "This week"}
            </div>
          </div>

          {/* Pending Tasks & Assignments */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Deadlines</span>
              <CheckSquare className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-700">
              {deadlinesByUrgency.today.length + deadlinesByUrgency.this_week.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {deadlinesByUrgency.overdue.length > 0
                ? `${deadlinesByUrgency.overdue.length} overdue!`
                : "Due this week"}
            </div>
          </div>

          {/* Active Goals */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Goals</span>
              <Target className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-700">
              {goals.filter((g) => g.status === "ACTIVE").length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {goals.filter((g) => g.status === "COMPLETED").length} achieved
            </div>
          </div>
        </div>

        {/* 3. DETERMINISTIC INSIGHTS BANNER (No AI) */}
        {insights.length > 0 && (
          <div className="space-y-2.5">
            {insights.slice(0, 3).map((ins) => (
              <div
                key={ins.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs ${
                  ins.level === "critical"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : ins.level === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : ins.level === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}
              >
                <div className="flex items-center gap-2.5 font-semibold">
                  {ins.level === "critical" ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : ins.level === "warning" ? (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : ins.level === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                  <span>{ins.message}</span>
                </div>

                {ins.actionRoute && ins.actionText && (
                  <Link
                    href={ins.actionRoute}
                    className="font-bold underline hover:opacity-80 shrink-0 self-start sm:self-auto"
                  >
                    {ins.actionText} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 4. WORKSPACE NAVIGATION TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none">
          {[
            { id: "overview", label: "Workspace Overview", icon: Sparkles },
            { id: "today", label: "Today View", icon: Clock },
            { id: "deadlines", label: "Upcoming & Deadlines", icon: Calendar },
            { id: "timetable", label: "Weekly Timetable", icon: CalendarDays },
            { id: "attendance", label: "Attendance Health", icon: CheckCircle2 },
            { id: "calendar", label: "Calendar", icon: Calendar },
            { id: "goals", label: "Goals & Tasks", icon: Target },
            { id: "career", label: "Career & Trackers", icon: Briefcase },
            { id: "semesters", label: "VTU Semesters", icon: GraduationCap },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as WorkspaceTab)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ========================================== */}
        {/* TAB 1: WORKSPACE OVERVIEW */}
        {/* ========================================== */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in">
            {/* Smart Daily Plan Banner */}
            <div className="p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/10 backdrop-blur-xs rounded-xl">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-200">
                      Smart Daily Plan • {todayWeekday}
                    </span>
                    <h2 className="text-base sm:text-lg font-bold">
                      {smartDailyPlan.summaryText}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0 font-semibold bg-white/10 px-3 py-1.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-blue-200" />
                  <span>{smartDailyPlan.totalCommitmentHours}h planned</span>
                </div>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="px-2.5 py-1 bg-white/15 rounded-lg font-medium">
                  📚 {smartDailyPlan.todayClasses.length} Classes
                </span>
                <span className="px-2.5 py-1 bg-white/15 rounded-lg font-medium">
                  ⏱️ {smartDailyPlan.todayStudySessions.length} Study Sessions
                </span>
                <span className="px-2.5 py-1 bg-white/15 rounded-lg font-medium">
                  🎯 {smartDailyPlan.todayTasks.length} Tasks
                </span>
                <span className="px-2.5 py-1 bg-white/15 rounded-lg font-medium">
                  ⏳ {smartDailyPlan.todayDeadlines.length} Deadlines
                </span>
              </div>
            </div>

            {/* Recommended For You Section */}
            {recommendations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Recommended For You
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      Deterministic
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Based on your local marks, timetable & career goals
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3 relative group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              rec.category === "academic"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                : rec.category === "productivity"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : rec.category === "career"
                                ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                : "bg-purple-50 text-purple-700 border border-purple-200/60"
                            }`}
                          >
                            {rec.category}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                rec.priority === "critical"
                                  ? "bg-red-100 text-red-700"
                                  : rec.priority === "high"
                                  ? "bg-orange-100 text-orange-700"
                                  : rec.priority === "medium"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              Score {rec.score}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDismissRec(rec.id)}
                              className="text-slate-300 hover:text-slate-500 p-1 rounded-md cursor-pointer"
                              title="Dismiss suggestion"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">
                          {rec.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                          {rec.description || rec.reason}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {rec.reason}
                        </span>
                        <Link
                          href={rec.actionRoute}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 shrink-0"
                        >
                          <span>{rec.actionLabel}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Split Row: Today's Class & Next Exam */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today's Classes Card */}
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Today&apos;s Classes ({todayWeekday})
                    </h2>
                  </div>
                  <Link
                    href="/student/timetable"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Manage Timetable →
                  </Link>
                </div>

                {todayClasses.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      No classes scheduled for {todayWeekday}.
                    </p>
                    <Link
                      href="/student/timetable"
                      className="inline-block text-xs font-bold text-blue-600 hover:underline"
                    >
                      + Add class to {todayWeekday}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {currentClassStatus?.current && (
                      <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                            Happening Right Now
                          </span>
                          <div className="font-bold text-slate-900 text-sm">
                            {currentClassStatus.current.subject}
                          </div>
                          <div className="text-slate-500 flex items-center gap-2">
                            <span>
                              {currentClassStatus.current.startTime} - {currentClassStatus.current.endTime}
                            </span>
                            {currentClassStatus.current.room && (
                              <span>• Room: {currentClassStatus.current.room}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {todayClasses.map((cls) => (
                        <div
                          key={cls.id}
                          className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{cls.subject}</span>
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              {cls.startTime} - {cls.endTime} {cls.room ? `• ${cls.room}` : ""}
                            </div>
                          </div>
                          {cls.type && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                              {cls.type}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Next Exam Card */}
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Upcoming Assessment
                    </h2>
                  </div>
                  <Link
                    href="/student/exams"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    Exam Planner →
                  </Link>
                </div>

                {!nextExam ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl space-y-2">
                    <p className="text-xs text-slate-500 font-medium">No upcoming exams scheduled.</p>
                    <Link
                      href="/student/exams"
                      className="inline-block text-xs font-bold text-indigo-600 hover:underline"
                    >
                      + Schedule your first exam
                    </Link>
                  </div>
                ) : (
                  <div className="p-5 bg-linear-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-600 text-white">
                        {nextExam.examType}
                      </span>
                      <span className="text-xs font-black text-indigo-700">
                        {formatCountdownText(nextExam.date, todayStr)}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-slate-900">{nextExam.subject}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatStudentDate(nextExam.date)}
                        </span>
                        {nextExam.time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {nextExam.time}
                          </span>
                        )}
                        {nextExam.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            Room: {nextExam.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {nextExam.notes && (
                      <p className="text-xs text-slate-500 italic bg-white/70 p-2.5 rounded-xl border border-indigo-100">
                        {nextExam.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Split Row: Assignments & Tasks Quick Checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Urgent Assignments */}
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Pending Coursework & Assignments
                    </h2>
                  </div>
                  <Link
                    href="/student/assignment-planner"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    View All →
                  </Link>
                </div>

                {assignments.filter((a) => a.status !== "completed").length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl space-y-2">
                    <p className="text-xs text-slate-500">All assignments submitted or completed! 🎉</p>
                    <Link
                      href="/student/assignment-planner"
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      + Add new assignment
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {assignments
                      .filter((a) => a.status !== "completed")
                      .slice(0, 5)
                      .map((a) => {
                        const days = calculateDaysRemaining(a.dueDate, todayStr);
                        const isOverdue = days < 0;
                        return (
                          <div
                            key={a.id}
                            className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900">{a.title}</span>
                              <div className="text-slate-500 text-[11px]">
                                {a.subject} • Due {formatStudentDate(a.dueDate)}
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isOverdue
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {formatCountdownText(a.dueDate, todayStr)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Tasks Quick Check */}
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Study Tasks & To-Dos
                    </h2>
                  </div>
                  <Link href="/student/tasks" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                    Open Tasks →
                  </Link>
                </div>

                {tasks.filter((t) => t.status !== "COMPLETED").length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl space-y-2">
                    <p className="text-xs text-slate-500">No pending study tasks.</p>
                    <Link
                      href="/student/tasks"
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      + Add study task
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {tasks
                      .filter((t) => t.status !== "COMPLETED")
                      .slice(0, 5)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900">{t.title}</span>
                            <div className="text-slate-500 text-[11px]">
                              {t.category || "Task"} {t.dueDate ? `• Due ${formatStudentDate(t.dueDate)}` : ""}
                            </div>
                          </div>

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
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: TODAY VIEW */}
        {/* ========================================== */}
        {activeTab === "today" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Today&apos;s Schedule & Actions
                </h2>
                <p className="text-xs text-slate-500">
                  {todayWeekday}, {formatStudentDate(todayStr)}
                </p>
              </div>
            </div>

            {/* Check if anything is scheduled today */}
            {todayClasses.length === 0 &&
            todaySessions.length === 0 &&
            todayAssignments.length === 0 &&
            todayTasks.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Nothing scheduled for today!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  You have no classes, study sessions, or tasks due today. Enjoy your break or plan ahead.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <Link
                    href="/student/study-planner"
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                  >
                    Plan Study Session
                  </Link>
                  <Link
                    href="/student/tasks"
                    className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
                  >
                    Add Task
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Classes Today */}
                {todayClasses.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                      <span>Classes ({todayClasses.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {todayClasses.map((c) => (
                        <div
                          key={c.id}
                          className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-1 text-xs"
                        >
                          <div className="font-bold text-slate-900 text-sm">{c.subject}</div>
                          <div className="text-slate-600 font-medium">
                            {c.startTime} – {c.endTime}
                          </div>
                          {c.room && <div className="text-blue-600 font-semibold">Room: {c.room}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Study Sessions Today */}
                {todaySessions.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>Planned Study Sessions ({todaySessions.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {todaySessions.map((s) => (
                        <div
                          key={s.id}
                          className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-1 text-xs"
                        >
                          <div className="font-bold text-slate-900 text-sm">{s.subject}</div>
                          <div className="text-slate-600">
                            {s.startTime} • {s.durationMinutes} minutes
                          </div>
                          {s.topic && <div className="text-slate-500 italic">{s.topic}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Assignments Due Today */}
                {todayAssignments.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Assignments Due Today ({todayAssignments.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {todayAssignments.map((a) => (
                        <div
                          key={a.id}
                          className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-900">{a.title}</span>
                          <span className="text-rose-700 font-bold">Due Today!</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Tasks Due Today */}
                {todayTasks.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      <span>Tasks Due Today ({todayTasks.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {todayTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-900">{t.title}</span>
                          <span className="text-slate-500">{t.dueTime || "Today"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: UPCOMING & DEADLINE CENTER */}
        {/* ========================================== */}
        {activeTab === "deadlines" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Unified Deadline Center
                </h2>
                <p className="text-xs text-slate-500">
                  Chronological deadlines across assignments, exams, tasks, and career milestones.
                </p>
              </div>
            </div>

            {allDeadlines.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-2">
                <p className="text-xs text-slate-500 font-medium">No deadlines recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overdue */}
                {deadlinesByUrgency.overdue.length > 0 && (
                  <div className="p-6 bg-rose-50/50 border border-rose-200 rounded-3xl space-y-3">
                    <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Overdue Items ({deadlinesByUrgency.overdue.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {deadlinesByUrgency.overdue.map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-white border border-rose-200 rounded-xl flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{d.title}</span>
                            <div className="text-slate-500 text-[11px]">
                              {d.sourceType} • {formatStudentDate(d.targetDate)}
                            </div>
                          </div>
                          <span className="text-rose-700 font-extrabold text-xs">{d.countdownText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due Today */}
                {deadlinesByUrgency.today.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Due Today ({deadlinesByUrgency.today.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {deadlinesByUrgency.today.map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{d.title}</span>
                            <div className="text-slate-500 text-[11px]">{d.subtitle || d.sourceType}</div>
                          </div>
                          <span className="text-blue-700 font-bold">Due Today</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due Tomorrow */}
                {deadlinesByUrgency.tomorrow.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>Due Tomorrow ({deadlinesByUrgency.tomorrow.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {deadlinesByUrgency.tomorrow.map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{d.title}</span>
                            <div className="text-slate-500 text-[11px]">{d.subtitle || d.sourceType}</div>
                          </div>
                          <span className="text-indigo-600 font-bold">Tomorrow</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* This Week (next 7 days) */}
                {deadlinesByUrgency.this_week.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-slate-500" />
                      <span>Due This Week ({deadlinesByUrgency.this_week.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {deadlinesByUrgency.this_week.map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{d.title}</span>
                            <div className="text-slate-500 text-[11px]">
                              {d.sourceType} • {formatStudentDate(d.targetDate)}
                            </div>
                          </div>
                          <span className="text-slate-600 font-bold">{d.countdownText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Later */}
                {deadlinesByUrgency.later.length > 0 && (
                  <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Later ({deadlinesByUrgency.later.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {deadlinesByUrgency.later.slice(0, 10).map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-slate-50/60 border border-slate-200/70 rounded-xl flex items-center justify-between text-xs text-slate-600"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{d.title}</span>
                            <div className="text-slate-400 text-[11px]">
                              {d.sourceType} • {formatStudentDate(d.targetDate)}
                            </div>
                          </div>
                          <span className="text-slate-500 font-medium">{d.countdownText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: WEEKLY TIMETABLE */}
        {/* ========================================== */}
        {activeTab === "timetable" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Weekly Class Timetable
                </h2>
                <p className="text-xs text-slate-500">
                  Interval-overlap conflict detection enabled. Zero overlapping class collisions.
                </p>
              </div>
              <Link
                href="/student/timetable"
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
              >
                + Manage Timetable
              </Link>
            </div>

            {timetableConflicts.hasAnyConflict && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Schedule conflicts detected: Some of your classes overlap in time.</span>
              </div>
            )}

            {timetable.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No classes entered yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Build your weekly college schedule with classroom numbers and professors.
                </p>
                <Link
                  href="/student/timetable"
                  className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                >
                  + Add your first class
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => {
                  const dayList = timetable
                    .filter((c) => c.day.toLowerCase() === day.toLowerCase())
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div
                      key={day}
                      className="p-5 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-900 text-sm">{day}</span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {dayList.length} class{dayList.length === 1 ? "" : "es"}
                        </span>
                      </div>

                      {dayList.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center">No classes</p>
                      ) : (
                        <div className="space-y-2">
                          {dayList.map((c) => {
                            const hasClash = timetableConflicts.conflictingIds.has(c.id);
                            return (
                              <div
                                key={c.id}
                                className={`p-3 rounded-2xl border text-xs space-y-1 ${
                                  hasClash
                                    ? "bg-amber-50 border-amber-300 text-amber-900"
                                    : "bg-slate-50 border-slate-200/80 text-slate-800"
                                }`}
                              >
                                <div className="font-bold text-slate-900">{c.subject}</div>
                                <div className="text-slate-500 text-[11px]">
                                  {c.startTime} - {c.endTime} {c.room ? `• ${c.room}` : ""}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 5: ATTENDANCE HEALTH */}
        {/* ========================================== */}
        {activeTab === "attendance" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Subject-Level Attendance Health
                </h2>
                <p className="text-xs text-slate-500">
                  Safe classes calculator and needed classes to maintain 75% or 85% attendance.
                </p>
              </div>
              <Link
                href="/student/attendance"
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
              >
                + Log Attendance
              </Link>
            </div>

            {attendance.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No attendance records logged</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Track attended vs total classes per subject to calculate your bunk margin.
                </p>
                <Link
                  href="/student/attendance"
                  className="inline-block px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700"
                >
                  + Add your subjects
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attendance.map((att) => {
                  const res = calculateAttendance(att.attendedClasses, att.totalClasses, 75);
                  const isSafe = res.isSafe;
                  const isWarning = att.currentPercentage >= 75 && att.currentPercentage < 80;

                  return (
                    <div
                      key={att.id}
                      className="p-5 bg-white border border-slate-200/90 rounded-3xl shadow-2xs space-y-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{att.subjectName}</h3>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {att.attendedClasses} / {att.totalClasses} classes attended
                          </div>
                        </div>

                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-xl ${
                            !isSafe
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isWarning
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {att.currentPercentage}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            !isSafe ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, att.currentPercentage)}%` }}
                        />
                      </div>

                      {/* Bunk / Needed Classes Metric */}
                      <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                        <div className="font-semibold text-slate-700">{res.message}</div>
                        {res.maxBunkableClasses !== undefined && res.maxBunkableClasses > 0 && (
                          <div className="text-emerald-700 font-bold text-[11px]">
                            Safe to miss: {res.maxBunkableClasses} class{res.maxBunkableClasses === 1 ? "" : "es"}
                          </div>
                        )}
                        {res.classesNeededForTarget !== undefined && res.classesNeededForTarget > 0 && (
                          <div className="text-rose-700 font-bold text-[11px]">
                            Must attend next: {res.classesNeededForTarget} class
                            {res.classesNeededForTarget === 1 ? "" : "es"} consecutively
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 6: GOALS & TASKS */}
        {/* ========================================== */}
        {activeTab === "goals" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Goals & Milestones
                </h2>
                <p className="text-xs text-slate-500">Track progress across academics, coding, and fitness.</p>
              </div>
              <Link
                href="/student/goals"
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
              >
                + Goal Manager
              </Link>
            </div>

            {goals.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                  <Target className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No active goals</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Set academic and personal development goals to stay motivated.
                </p>
                <Link
                  href="/student/goals"
                  className="inline-block px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700"
                >
                  + Set a goal
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.map((g) => (
                  <div
                    key={g.id}
                    className="p-5 bg-white border border-slate-200/90 rounded-3xl shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700">
                        {g.category}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{g.progress}%</span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm line-clamp-2">{g.title}</h4>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 transition-all duration-300"
                        style={{ width: `${g.progress}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Target: {formatStudentDate(g.targetDate)} ({formatCountdownText(g.targetDate, todayStr)})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 7: CAREER & TRACKERS */}
        {/* ========================================== */}
        {activeTab === "career" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Career Pipeline & Achievements
                </h2>
                <p className="text-xs text-slate-500">
                  Internships, hackathons, and zero-upload verified credentials.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Internships */}
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Internships</h3>
                  </div>
                  <Link
                    href="/student/internships"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View ({internships.length}) →
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Applied</span>
                    <span className="font-bold text-slate-900">
                      {internships.filter((i) => i.status === "applied").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Interviews</span>
                    <span className="font-bold text-amber-700">
                      {internships.filter((i) => i.status === "interview").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-slate-500">Offers</span>
                    <span className="font-bold text-emerald-700">
                      {internships.filter((i) => i.status === "offer").length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hackathons */}
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Hackathons</h3>
                  </div>
                  <Link
                    href="/student/hackathons"
                    className="text-xs font-bold text-amber-600 hover:underline"
                  >
                    View ({hackathons.length}) →
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Registered</span>
                    <span className="font-bold text-slate-900">
                      {hackathons.filter((h) => h.status === "registered" || h.status === "REGISTERED").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Finalists</span>
                    <span className="font-bold text-indigo-700">
                      {hackathons.filter((h) => h.status === "finalist" || h.status === "FINALIST").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-slate-500">Winners 🏆</span>
                    <span className="font-bold text-emerald-700">
                      {hackathons.filter((h) => h.status === "winner" || h.status === "WINNER").length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Certificates */}
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Certificates</h3>
                  </div>
                  <Link
                    href="/student/certificates"
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Vault ({certificates.length}) →
                  </Link>
                </div>

                <div className="text-xs text-slate-500 space-y-2">
                  <p>
                    All certificate metadata is stored locally without uploading documents to the cloud.
                  </p>
                  <div className="text-xl font-extrabold text-slate-900">
                    {certificates.length} credentials
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 8: VTU SEMESTER RECORDS */}
        {/* ========================================== */}
        {activeTab === "semesters" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Semester Progression & SGPA History
                </h2>
                <p className="text-xs text-slate-500">Official VTU 2022 Scheme credit-weighted records.</p>
              </div>
              <Link
                href="/student/sgpa-calculator"
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
              >
                + Calculate SGPA
              </Link>
            </div>

            {semesters.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/90 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No semester records saved</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Calculate and save your semester marksheets to track cumulative CGPA progression.
                </p>
                <Link
                  href="/student/sgpa-calculator"
                  className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                >
                  + Calculate Semester 1 SGPA
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white border border-slate-200/90 rounded-3xl shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Semester</th>
                      <th className="px-5 py-3.5">Total Credits</th>
                      <th className="px-5 py-3.5">Earned Credits</th>
                      <th className="px-5 py-3.5">SGPA</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {semesters.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-900">Semester {s.semester}</td>
                        <td className="px-5 py-4">{s.totalCredits}</td>
                        <td className="px-5 py-4">{s.earnedCredits}</td>
                        <td className="px-5 py-4 font-bold text-blue-600 text-sm">
                          {s.sgpa.toFixed(2)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              s.hasBacklogs
                                ? "bg-rose-50 text-rose-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {s.hasBacklogs ? "Backlog" : "Cleared"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Delete Semester ${s.semester} record?`)) {
                                await academicStorage.deleteSemesterRecord(s.id);
                                loadAllData();
                              }
                            }}
                            className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                            aria-label={`Delete semester ${s.semester}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* SEARCH MODAL (Cmd+K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center p-4 pt-20">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assignments, tasks, exams, timetable, goals, certificates..."
                className="w-full text-sm font-medium focus:outline-hidden"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {!searchQuery ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Type to search your local student records...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No matching items found.</div>
              ) : (
                searchResults.map((r) => (
                  <Link
                    key={`${r.type}_${r.id}`}
                    href={r.route}
                    onClick={() => setSearchOpen(false)}
                    className="p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-xs transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-blue-600">{r.title}</div>
                      <div className="text-slate-400 text-[11px]">{r.subtitle}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {r.type}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
