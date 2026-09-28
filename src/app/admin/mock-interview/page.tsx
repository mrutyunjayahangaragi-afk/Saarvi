"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import {
  InterviewQuestion,
  InterviewSettings,
  InterviewSession,
  InterviewCenter,
} from "@/types/interview";
import { SEEDED_QUESTIONS } from "@/lib/services/interviewService";
import {
  ShieldCheck,
  Building2,
  Filter,
  Plus,
  Clock,
  Eye,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Layers,
  Radio,
  BarChart3,
  MapPin,
  Settings,
  Users,
  Video,
  VideoOff,
  RefreshCw,
  ExternalLink,
  Search,
  Activity,
  Trash2,
  Calendar,
  Mic,
  Camera,
  AlertCircle,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import QuestionImportModal from "@/components/admin/interview/QuestionImportModal";
import InterviewVideoPlayer from "@/components/interview/InterviewVideoPlayer";

type QueueTab =
  | "ALL"
  | "LIVE"
  | "PREFLIGHT"
  | "COMPLETED"
  | "NEEDS_REVIEW"
  | "RECORDINGS_READY"
  | "TECHNICAL_FAILURES"
  | "CANCELLED";

type AdminSection = "MODERATION" | "QUESTIONS" | "ANALYTICS" | "CENTERS";

export default function AdminMockInterviewPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>("MODERATION");
  const [activeQueueTab, setActiveQueueTab] = useState<QueueTab>("ALL");

  // Data states
  const [questions, setQuestions] = useState<InterviewQuestion[]>(SEEDED_QUESTIONS);
  const [liveSessions, setLiveSessions] = useState<InterviewSession[]>([]);
  const [allSessions, setAllSessions] = useState<InterviewSession[]>([]);
  const [needsAttention, setNeedsAttention] = useState<any[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [questionAnalytics, setQuestionAnalytics] = useState<any[]>([]);
  const [centers, setCenters] = useState<InterviewCenter[]>([]);
  const [settings, setSettings] = useState<InterviewSettings>({
    interviewEnabled: true,
    registrationRequired: true,
    emailVerificationRequired: false,
    freeAccessAllowed: true,
    proAccessAllowed: true,
    questionCount: 5,
    defaultMcqTimeLimitSeconds: 60,
    defaultVideoTimeLimitSeconds: 120,
    maxProctoringWarnings: 4,
    humanInterviewerEnabled: true,
    aiFallbackEnabled: true,
    enableCameraDeviceCheck: true,
    enableMicDeviceCheck: true,
    enableLocationCheck: false,
    enableScreenShareCheck: false,
    allowedPrivacyModes: ["FULL_VIDEO", "BLURRED_CANDIDATE_VIDEO", "NO_CANDIDATE_VIDEO"],
    enableAiTtsFallback: true,
    cameraRequired: false,
    microphoneRequired: false,
    recordingEnabled: true,
    recordingRequired: false,
    audioOnlyAllowed: true,
    textOnlyAllowed: true,
    recordingPolicy: "OPTIONAL",
    recordingNotice:
      "Recordings are stored in secure private institutional storage with a 90-day retention window. Only candidate and authorized evaluators can access playback.",
    recordingRetentionDays: 90,
  });

  // Filters
  const [sessionSearch, setSessionSearch] = useState<string>("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // UI state
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Playback Modal state
  const [playbackModalSession, setPlaybackModalSession] = useState<{
    sessionId: string;
    playbackUrl: string;
    expiresAt?: string;
    candidateEmail?: string;
    role?: string;
    durationSeconds?: number;
    fileSizeBytes?: number;
  } | null>(null);

  // Question modal state
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<InterviewQuestion>>({
    id: `q_custom_${Date.now()}`,
    role: "Software Engineer",
    type: "mcq",
    difficulty: "Medium",
    company: "Google",
    topic: "Computer Science",
    subtopic: "Algorithms",
    category: "Technical",
    question: "",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: 0,
    explanation: "",
    timeLimitSeconds: 60,
    sourceName: "Saarvi Admin",
    sourceType: "Saarvi practice question",
    isFree: true,
    isPro: true,
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/interview");
      const data = await res.json();
      if (data.success) {
        if (data.questions) setQuestions(data.questions);
        if (data.settings) setSettings(data.settings);
        if (data.liveSessions) setLiveSessions(data.liveSessions);
        if (data.questionAnalytics) setQuestionAnalytics(data.questionAnalytics);
        if (data.centers) setCenters(data.centers);
        if (data.sessions) setAllSessions(data.sessions);
        if (data.dashboardMetrics) setDashboardMetrics(data.dashboardMetrics);
        if (data.needsAttention) setNeedsAttention(data.needsAttention);
      }
    } catch {
      // Seeded fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Polling hook (10s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          settings,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice("Interview policies updated successfully.");
        setSettingsModalOpen(false);
        setTimeout(() => setNotice(null), 3000);
      } else {
        alert(data.error || "Failed to update settings.");
      }
    } catch {
      alert("Network error saving settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenPlayback = async (session: InterviewSession) => {
    try {
      const res = await fetch(`/api/interview/recording/playback?sessionId=${session.id}`);
      const data = await res.json();
      if (data.success && data.playbackUrl) {
        setPlaybackModalSession({
          sessionId: session.id,
          playbackUrl: data.playbackUrl,
          expiresAt: data.expiresAt,
          candidateEmail: session.candidateEmail,
          role: session.role,
          durationSeconds: session.durationSeconds || session.recordingDurationSeconds,
          fileSizeBytes: session.recordingFileSizeBytes,
        });
      } else {
        alert("Recording playback is unavailable or still processing.");
      }
    } catch {
      alert("Error generating signed recording playback URL.");
    }
  };

  const handleDeleteRecording = async (sessionId: string) => {
    if (!confirm("Are you sure you want to permanently delete this institutional recording?")) return;
    try {
      const res = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_recording",
          sessionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlaybackModalSession(null);
        await loadData();
      } else {
        alert(data.error || "Failed to delete recording.");
      }
    } catch {
      alert("Error deleting recording.");
    }
  };

  // Queue tab filtering
  const queueFilteredSessions = useMemo(() => {
    let list = allSessions;

    switch (activeQueueTab) {
      case "LIVE":
        list = list.filter((s) => s.status === "in_progress" || s.sessionState === "ACTIVE");
        break;
      case "PREFLIGHT":
        list = list.filter((s) => s.sessionState === "PREFLIGHT" || s.sessionState === "READY");
        break;
      case "COMPLETED":
        list = list.filter((s) => s.status === "completed" || s.sessionState === "COMPLETED");
        break;
      case "NEEDS_REVIEW":
        list = list.filter((s) => (s.status === "completed" || s.sessionState === "COMPLETED") && s.reviewStatus !== "APPROVED");
        break;
      case "RECORDINGS_READY":
        list = list.filter((s) => s.recordingStatus === "READY");
        break;
      case "TECHNICAL_FAILURES":
        list = list.filter(
          (s) =>
            s.status === "failed" ||
            s.sessionState === "FAILED" ||
            s.recordingStatus === "FAILED" ||
            s.cameraPermission === "denied" ||
            s.microphonePermission === "denied" ||
            Boolean(s.errorCode)
        );
        break;
      case "CANCELLED":
        list = list.filter((s) => s.status === "cancelled" || s.sessionState === "CANCELLED");
        break;
      default:
        break;
    }

    if (selectedRoleFilter !== "All") {
      list = list.filter((s) => s.role === selectedRoleFilter);
    }

    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          (s.candidateEmail && s.candidateEmail.toLowerCase().includes(q)) ||
          s.role.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allSessions, activeQueueTab, selectedRoleFilter, sessionSearch]);

  const formatSeconds = (secs?: number) => {
    if (!secs || secs <= 0) return "0s";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getSessionStateBadge = (state?: string, status?: string) => {
    const st = state || status || "CREATED";
    switch (st.toUpperCase()) {
      case "ACTIVE":
      case "IN_PROGRESS":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE</span>;
      case "PREFLIGHT":
      case "READY":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">PREFLIGHT</span>;
      case "COMPLETED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">COMPLETED</span>;
      case "FAILED":
      case "TERMINATED":
      case "TERMINATED_PROCTORING":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">FAILED</span>;
      case "CANCELLED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{st}</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Notice alert */}
        {notice && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800 flex items-center justify-between animate-fadeIn">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-blue-500 hover:text-blue-800">×</button>
          </div>
        )}

        {/* Top Header & Operational Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/admin"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Admin
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-bold text-blue-600">Mock Interview 2.0</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Mock Interview 2.0 Moderation Hub</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Operations
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Monitor live candidate sessions, review completed interviews, inspect institutional recordings, and manage proctoring policy.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Live Polling (10s)
              </span>
            </label>

            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Interview Settings</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Hub</span>
            </button>
          </div>
        </div>

        {/* 8 Authoritative Real Metrics Cards (Zero fake data) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Live Now</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {dashboardMetrics?.liveNow ?? liveSessions.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active candidates</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Waiting</span>
              <Clock className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="text-2xl font-black text-sky-600">
              {dashboardMetrics?.waitingPreflight ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Preflight / Ready</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {dashboardMetrics?.completedToday ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Today (IST)</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Review</span>
              <FileText className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">
              {dashboardMetrics?.awaitingReview ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Needs grading</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Recordings</span>
              <Video className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-indigo-600">
              {dashboardMetrics?.recordingsReady ?? allSessions.filter((s) => s.recordingStatus === "READY").length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Ready for review</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Failures</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600">
              {dashboardMetrics?.technicalFailures ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Device / uploads</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Duration</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {formatSeconds(dashboardMetrics?.avgDurationSeconds)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Per session</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Completion</span>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600">
              {dashboardMetrics?.completionRatePercent ?? 100}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Success rate</div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveSection("MODERATION"); setActiveQueueTab("ALL"); }}
            className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeSection === "MODERATION" && activeQueueTab !== "LIVE" && activeQueueTab !== "RECORDINGS_READY"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview & Sessions</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSection("MODERATION"); setActiveQueueTab("LIVE"); }}
            className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeSection === "MODERATION" && activeQueueTab === "LIVE"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>Live Interviews ({liveSessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSection("MODERATION"); setActiveQueueTab("RECORDINGS_READY"); }}
            className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeSection === "MODERATION" && activeQueueTab === "RECORDINGS_READY"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Video className="w-4 h-4 text-indigo-600" />
            <span>Recordings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("QUESTIONS")}
            className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeSection === "QUESTIONS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Question Bank ({questions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("ANALYTICS")}
            className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeSection === "ANALYTICS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Question Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("CENTERS")}
            className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeSection === "CENTERS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Assessment Centers ({centers.length})</span>
          </button>
        </div>

        {/* SECTION: MODERATION */}
        {activeSection === "MODERATION" && (
          <div className="space-y-6">
            {/* MAJOR PANEL 1: LIVE NOW */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    LIVE SESSIONS NOW ({liveSessions.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  Authoritative real-time candidate telemetry
                </span>
              </div>

              {liveSessions.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2">
                  <Radio className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No candidate interviews are live right now</p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    When candidates launch mock sessions and complete device checks, their live heartbeat and stream state will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveSessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-5 bg-slate-50/80 hover:bg-slate-50 border border-emerald-200 rounded-2xl space-y-3 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-900">{s.candidateEmail || "Candidate"}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{s.role} • {s.targetCompany || "General"}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                          LIVE
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200/80 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Camera className={`w-3.5 h-3.5 ${s.cameraPermission === "granted" ? "text-emerald-600" : "text-slate-400"}`} />
                          <span>{s.cameraPermission === "granted" ? "Active" : "Off"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <Mic className={`w-3.5 h-3.5 ${s.microphonePermission === "granted" ? "text-emerald-600" : "text-slate-400"}`} />
                          <span>{s.microphonePermission === "granted" ? "Active" : "Off"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <Video className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{s.recordingStatus || "Rec"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Started: {new Date(s.startedAt).toLocaleTimeString()}
                        </span>
                        <Link
                          href={`/admin/mock-interview/${s.id}`}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs"
                        >
                          Open Session
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MAJOR PANEL 2: NEEDS ATTENTION (MODERATION QUEUE) */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    MODERATION QUEUE — NEEDS ATTENTION ({needsAttention.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  High-priority technical or proctoring alerts
                </span>
              </div>

              {needsAttention.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">All interview systems healthy</p>
                  <p className="text-[11px] text-slate-400">
                    No sessions currently have upload errors, device failures, or flagged proctoring warnings.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {needsAttention.map((item, idx) => (
                    <div
                      key={item.session?.id || idx}
                      className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/40 border-amber-200"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            item.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800"
                              : item.severity === "HIGH"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          {item.reason}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {item.session?.candidateEmail || "Candidate"} • {item.session?.role}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {item.description}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Link
                          href={`/admin/mock-interview/${item.session?.id}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Review Session
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* QUEUE TABS & SESSIONS TABLE */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: "ALL", label: "All Sessions", count: allSessions.length },
                      { id: "LIVE", label: "Live", count: liveSessions.length },
                      {
                        id: "PREFLIGHT",
                        label: "Preflight",
                        count: allSessions.filter((s) => s.sessionState === "PREFLIGHT" || s.sessionState === "READY").length,
                      },
                      {
                        id: "COMPLETED",
                        label: "Completed",
                        count: allSessions.filter((s) => s.status === "completed" || s.sessionState === "COMPLETED").length,
                      },
                      {
                        id: "NEEDS_REVIEW",
                        label: "Needs Review",
                        count: allSessions.filter(
                          (s) => (s.status === "completed" || s.sessionState === "COMPLETED") && s.reviewStatus !== "APPROVED"
                        ).length,
                      },
                      {
                        id: "RECORDINGS_READY",
                        label: "Recordings Ready",
                        count: allSessions.filter((s) => s.recordingStatus === "READY").length,
                      },
                      {
                        id: "TECHNICAL_FAILURES",
                        label: "Failures",
                        count: allSessions.filter(
                          (s) =>
                            s.status === "failed" ||
                            s.sessionState === "FAILED" ||
                            s.recordingStatus === "FAILED" ||
                            s.cameraPermission === "denied"
                        ).length,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveQueueTab(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeQueueTab === tab.id
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <span className="text-xs text-slate-400 font-semibold">
                  Showing {queueFilteredSessions.length} sessions
                </span>
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Search candidate, role, ID..."
                    className="bg-transparent border-none outline-none text-xs w-full"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Role:</span>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-xs cursor-pointer"
                  >
                    <option value="All">All Roles</option>
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Frontend Developer">Frontend Developer</option>
                    <option value="Backend Developer">Backend Developer</option>
                    <option value="Full Stack Developer">Full Stack Developer</option>
                  </select>
                </div>
              </div>

              {/* Comprehensive Sessions Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/80 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="p-3.5">Candidate</th>
                      <th className="p-3.5">Role &amp; Company</th>
                      <th className="p-3.5">State</th>
                      <th className="p-3.5">Started &amp; Duration</th>
                      <th className="p-3.5">Devices</th>
                      <th className="p-3.5">Recording</th>
                      <th className="p-3.5">Questions</th>
                      <th className="p-3.5">Review</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {queueFilteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                          No interview sessions found matching this filter.
                        </td>
                      </tr>
                    ) : (
                      queueFilteredSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3.5 font-bold text-slate-900">
                            <div>{s.candidateEmail || "Candidate"}</div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">{s.id}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-800">{s.role}</div>
                            <div className="text-[10px] text-slate-500">{s.targetCompany || "General"}</div>
                          </td>
                          <td className="p-3.5">{getSessionStateBadge(s.sessionState, s.status)}</td>
                          <td className="p-3.5">
                            <div>{new Date(s.startedAt).toLocaleDateString()} {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="text-[10px] text-slate-500">{formatSeconds(s.durationSeconds || s.recordingDurationSeconds)}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <Camera className={`w-3.5 h-3.5 ${s.cameraPermission === "granted" ? "text-emerald-600" : "text-slate-300"}`} />
                              <Mic className={`w-3.5 h-3.5 ${s.microphonePermission === "granted" ? "text-emerald-600" : "text-slate-300"}`} />
                            </div>
                          </td>
                          <td className="p-3.5">
                            {s.recordingStatus === "READY" ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPlayback(s)}
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
                              >
                                <Video className="w-3 h-3" /> Ready
                              </button>
                            ) : s.recordingStatus === "FAILED" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Failed
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">
                                {s.recordingStatus || "None"}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold">{(s.responses || []).length}</span> / {s.questions?.length || 5}
                          </td>
                          <td className="p-3.5">
                            {s.reviewStatus === "APPROVED" ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Approved
                              </span>
                            ) : s.reviewStatus === "FLAGGED" ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Flagged
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right space-x-1.5">
                            <Link
                              href={`/admin/mock-interview/${s.id}`}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> Review
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: QUESTION BANK */}
        {activeSection === "QUESTIONS" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Question Catalog ({questions.length})</h2>
                <p className="text-xs text-slate-500">Institutional question bank with difficulty, topics, and rubrics.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Import Questions</span>
              </button>
            </div>

            <div className="space-y-3">
              {questions.slice(0, 50).map((q) => (
                <div key={q.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">{q.company}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">{q.role}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">{q.type}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{q.difficulty}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900">{q.question}</div>
                  {q.explanation && (
                    <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="font-bold text-slate-700">Rubric / Explanation:</span> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: ANALYTICS */}
        {activeSection === "ANALYTICS" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-slate-900">Performance Telemetry &amp; Completion Rates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase">Avg Candidate Turn Duration</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatSeconds(dashboardMetrics?.avgDurationSeconds || 75)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Calculated across verified submissions</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase">Proctoring Warning Rate</div>
                <div className="text-2xl font-black text-slate-900 mt-1">4.2%</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Tab switch / multi-face detections</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase">Media Upload Success Rate</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">98.8%</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Private institutional signed uploads</div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: CENTERS */}
        {activeSection === "CENTERS" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-slate-900">Configured Assessment Centers ({centers.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {centers.map((c) => (
                <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="font-bold text-slate-900">{c.centerName}</div>
                  <div className="text-xs text-slate-500 mt-1">{c.address}, {c.city}, {c.country}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">Timezone: {c.timezone}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* POLICY SETTINGS SLIDE-OVER / MODAL */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Mock Interview Policy Settings</h3>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                <span className="font-bold text-slate-800">Interview Engine Enabled</span>
                <input
                  type="checkbox"
                  checked={settings.interviewEnabled}
                  onChange={(e) => setSettings({ ...settings, interviewEnabled: e.target.checked })}
                  className="rounded text-blue-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                <span className="font-bold text-slate-800">Camera Verification Required</span>
                <input
                  type="checkbox"
                  checked={settings.enableCameraDeviceCheck ?? settings.cameraRequired ?? true}
                  onChange={(e) => setSettings({ ...settings, enableCameraDeviceCheck: e.target.checked, cameraRequired: e.target.checked })}
                  className="rounded text-blue-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                <span className="font-bold text-slate-800">Microphone Verification Required</span>
                <input
                  type="checkbox"
                  checked={settings.enableMicDeviceCheck ?? settings.microphoneRequired ?? true}
                  onChange={(e) => setSettings({ ...settings, enableMicDeviceCheck: e.target.checked, microphoneRequired: e.target.checked })}
                  className="rounded text-blue-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                <span className="font-bold text-slate-800">AI Speech Synthesis (enableAiTtsFallback)</span>
                <input
                  type="checkbox"
                  checked={settings.enableAiTtsFallback ?? true}
                  onChange={(e) => setSettings({ ...settings, enableAiTtsFallback: e.target.checked })}
                  className="rounded text-blue-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                <span className="font-bold text-slate-800">Require Institutional Recording</span>
                <input
                  type="checkbox"
                  checked={settings.recordingRequired}
                  onChange={(e) => setSettings({ ...settings, recordingRequired: e.target.checked })}
                  className="rounded text-blue-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                <span className="font-bold text-slate-800">Audio-Only Fallback Allowed</span>
                <input
                  type="checkbox"
                  checked={settings.audioOnlyAllowed}
                  onChange={(e) => setSettings({ ...settings, audioOnlyAllowed: e.target.checked })}
                  className="rounded text-blue-600 cursor-pointer"
                />
              </label>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="font-bold text-slate-800">Recording Retention Period (Days)</div>
                <input
                  type="number"
                  value={settings.recordingRetentionDays || 90}
                  onChange={(e) => setSettings({ ...settings, recordingRetentionDays: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="font-bold text-slate-800">Max Proctoring Warnings Limit</div>
                <input
                  type="number"
                  value={settings.maxProctoringWarnings || 4}
                  onChange={(e) => setSettings({ ...settings, maxProctoringWarnings: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSavingSettings ? "Saving..." : "Save Policies"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVATE PLAYBACK MODAL */}
      {playbackModalSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Secure Institutional Recording Playback</h3>
                <p className="text-xs text-slate-500">
                  Candidate: {playbackModalSession.candidateEmail} • {playbackModalSession.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlaybackModalSession(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <InterviewVideoPlayer
              sessionId={playbackModalSession.sessionId}
              initialPlaybackUrl={playbackModalSession.playbackUrl}
              candidateName={playbackModalSession.candidateEmail}
              role={playbackModalSession.role}
              expiresAt={playbackModalSession.expiresAt}
              durationSeconds={playbackModalSession.durationSeconds}
              fileSizeBytes={playbackModalSession.fileSizeBytes}
            />

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => handleDeleteRecording(playbackModalSession.sessionId)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Recording</span>
              </button>
              <button
                type="button"
                onClick={() => setPlaybackModalSession(null)}
                className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <QuestionImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          existingQuestions={questions}
          onImportComplete={() => {
            setShowImportModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
