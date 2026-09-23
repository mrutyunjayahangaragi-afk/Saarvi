"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import {
  InterviewQuestion,
  InterviewCompany,
  InterviewSettings,
  InterviewSession,
  InterviewCenter,
  InterviewQuestionType,
  QuestionSourceType,
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
  Radio,
  BarChart3,
  MapPin,
  Settings,
  Users,
  Video,
  VideoOff,
  Bot,
  RefreshCw,
  ExternalLink,
  Check,
  X,
  Upload,
  Play,
  Search,
  Activity,
  HardDrive,
  Trash2,
} from "lucide-react";
import QuestionImportModal from "@/components/admin/interview/QuestionImportModal";
import InterviewVideoPlayer from "@/components/interview/InterviewVideoPlayer";

type AdminTab =
  | "OVERVIEW"
  | "QUESTIONS"
  | "LIVE_SESSIONS"
  | "RECORDINGS"
  | "ANALYTICS"
  | "CENTERS"
  | "SETTINGS";

export default function AdminMockInterviewPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("OVERVIEW");

  // Data states
  const [questions, setQuestions] = useState<InterviewQuestion[]>(SEEDED_QUESTIONS);
  const [liveSessions, setLiveSessions] = useState<InterviewSession[]>([]);
  const [allSessions, setAllSessions] = useState<InterviewSession[]>([]);
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
    audioOnlyAllowed: true,
    textOnlyAllowed: true,
    recordingPolicy: "OPTIONAL",
    recordingNotice:
      "Recordings are stored in secure private institutional storage with a 90-day retention window. Only candidate and authorized evaluators can access playback.",
    recordingRetentionDays: 90,
  });

  // Filter & Search states
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("All");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("All");
  const [sessionSearch, setSessionSearch] = useState<string>("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>("All");
  const [recordingStatusFilter, setRecordingStatusFilter] = useState<string>("All");

  // UI state
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);

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

  // Center modal state
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Partial<InterviewCenter>>({
    id: `center_${Date.now()}`,
    centerName: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    timezone: "Asia/Kolkata",
    status: "ACTIVE",
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

  // Polling hook
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSaveNotice(false);
    try {
      await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          settings,
        }),
      });
      setSaveNotice(true);
      setTimeout(() => setSaveNotice(false), 3000);
    } catch {
      alert("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion.question || !editingQuestion.role) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      const res = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_question",
          question: editingQuestion,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowQuestionModal(false);
        loadData();
      }
    } catch {
      alert("Failed to save question.");
    }
  };

  const handleSaveCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCenter.centerName || !editingCenter.address || !editingCenter.city) {
      alert("Please fill in center name and address details.");
      return;
    }

    try {
      const res = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_center",
          center: editingCenter,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCenterModal(false);
        loadData();
      }
    } catch {
      alert("Failed to save center.");
    }
  };

  const handleWatchRecording = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/interview/recording/playback?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success && data.playbackUrl) {
        setPlaybackModalSession({
          sessionId,
          playbackUrl: data.playbackUrl,
          expiresAt: data.expiresAt,
          candidateEmail: data.candidateEmail,
          role: data.role,
          durationSeconds: data.durationSeconds,
          fileSizeBytes: data.fileSizeBytes,
        });
      } else {
        alert(data.error || "Unable to retrieve signed recording link.");
      }
    } catch {
      alert("Failed to load recording.");
    }
  };

  const handleDeleteRecording = async (sessionId: string) => {
    if (!confirm("Are you sure you want to permanently delete this interview recording?")) return;
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
        loadData();
      } else {
        alert(data.error || "Failed to delete recording.");
      }
    } catch {
      alert("Error deleting recording.");
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to cancel this active candidate session?")) return;
    try {
      const res = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_session",
          sessionId,
          reason: "Cancelled by administrator.",
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch {
      alert("Error cancelling session.");
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (selectedCompanyFilter !== "All" && q.company !== selectedCompanyFilter) return false;
    if (selectedRoleFilter !== "All" && q.role !== selectedRoleFilter) return false;
    return true;
  });

  const filteredSessions = allSessions.filter((s) => {
    if (sessionStatusFilter !== "All" && s.status !== sessionStatusFilter) return false;
    if (sessionSearch) {
      const query = sessionSearch.toLowerCase();
      const matchEmail = s.candidateEmail?.toLowerCase().includes(query);
      const matchId = s.id?.toLowerCase().includes(query);
      const matchRole = s.role?.toLowerCase().includes(query);
      if (!matchEmail && !matchId && !matchRole) return false;
    }
    return true;
  });

  const filteredRecordings = allSessions.filter((s) => {
    if (!s.recordingStatus || s.recordingStatus === "NOT_STARTED") return false;
    if (recordingStatusFilter !== "All" && s.recordingStatus !== recordingStatusFilter) return false;
    return true;
  });

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "N/A";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSeconds = (secs?: number) => {
    if (!secs || secs <= 0) return "0s";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

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
              Mock Interview 2.0 Moderation Hub
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Live Polling (10s)
              </span>
            </label>

            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Live System Verified
            </span>
          </div>
        </div>

        {/* Top Overview Cards */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">
                Mock Interview 2.0 Management Hub
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Manage company-attributed question bank, monitor live candidate sessions, inspect real answer analytics, configure assessment centers, and enforce proctoring limits.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors self-start cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Data</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-xl font-bold text-slate-900">{questions.length}</div>
              <div className="text-[11px] font-semibold text-slate-500">Bank Questions</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-xl font-bold text-blue-600 flex items-center gap-1.5">
                <span>{dashboardMetrics?.activeSessions ?? liveSessions.length}</span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
              <div className="text-[11px] font-semibold text-slate-500">Active Now</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-xl font-bold text-emerald-600">
                {dashboardMetrics?.completedToday ?? 0}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">Completed Today</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-xl font-bold text-indigo-600">
                {dashboardMetrics?.recordingsCount ??
                  allSessions.filter((s) => s.recordingStatus === "READY").length}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">Recordings Ready</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-xl font-bold text-slate-900">{settings.maxProctoringWarnings}</div>
              <div className="text-[11px] font-semibold text-slate-500">Warning Limit</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2 mb-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("OVERVIEW")}
            className={`pb-3 px-4 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "OVERVIEW"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview & Sessions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("LIVE_SESSIONS")}
            className={`pb-3 px-4 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "LIVE_SESSIONS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Live Interviews ({liveSessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("RECORDINGS")}
            className={`pb-3 px-4 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "RECORDINGS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Video className="w-4 h-4 text-indigo-600" />
            <span>Recordings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("QUESTIONS")}
            className={`pb-3 px-4 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "QUESTIONS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Question Bank</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ANALYTICS")}
            className={`pb-3 px-4 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "ANALYTICS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Question Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CENTERS")}
            className={`pb-3 px-4 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "CENTERS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Assessment Centers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SETTINGS")}
            className={`pb-3 px-4 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "SETTINGS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Policy Settings</span>
          </button>
        </div>

        {/* =========================================================
            TAB 0: OVERVIEW & SESSIONS
           ========================================================= */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Search candidate, role, ID..."
                    className="bg-transparent border-none outline-none text-xs w-48"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Status:</span>
                  <select
                    value={sessionStatusFilter}
                    onChange={(e) => setSessionStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-xs cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="TERMINATED">TERMINATED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <span className="text-xs font-semibold text-slate-500">
                Showing {filteredSessions.length} sessions
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-4">Candidate / ID</th>
                    <th className="p-4">Role & Mode</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Started</th>
                    <th className="p-4">Warnings</th>
                    <th className="p-4">Score</th>
                    <th className="p-4">Recording</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No interview sessions match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{s.candidateEmail || "Guest User"}</p>
                          <span className="font-mono text-[10px] text-slate-400">{s.id}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-slate-800 block">{s.role}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">
                            {s.mode} {s.targetCompany ? `• ${s.targetCompany}` : ""}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              s.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : s.status === "ACTIVE" || s.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800"
                                : s.status === "TERMINATED"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="p-4 text-[11px] text-slate-600">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              s.warningCount > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {s.warningCount} / 4
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          {s.totalScore !== undefined ? `${Math.round(s.totalScore)}%` : "—"}
                        </td>
                        <td className="p-4">
                          {s.recordingStatus === "READY" ? (
                            <button
                              type="button"
                              onClick={() => handleWatchRecording(s.id)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[10px] flex items-center gap-1 border border-indigo-200 transition-colors cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-indigo-600" />
                              <span>Ready</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {s.recordingStatus || "None"}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/mock-interview/${s.id}`}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
                            >
                              Audit Review
                            </Link>
                            {(s.status === "ACTIVE" || s.status === "IN_PROGRESS") && (
                              <button
                                type="button"
                                onClick={() => handleCancelSession(s.id)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 1: QUESTION BANK
           ========================================================= */}
        {activeTab === "QUESTIONS" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Company:</span>
                  <select
                    value={selectedCompanyFilter}
                    onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-xs cursor-pointer"
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

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Role:</span>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-xs cursor-pointer"
                  >
                    <option value="All">All Roles</option>
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Backend Engineer">Backend Engineer</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion({
                      id: `q_custom_${Date.now()}`,
                      role: "Software Engineer",
                      type: "mcq",
                      difficulty: "Medium",
                      company: "Google",
                      topic: "Data Structures",
                      subtopic: "General",
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
                    setShowQuestionModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Question</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>Import Dataset (CSV/JSON)</span>
                </button>
              </div>
            </div>

            {/* Questions Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-4">Question</th>
                    <th className="p-4">Role & Domain</th>
                    <th className="p-4">Company</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Difficulty</th>
                    <th className="p-4">Attribution</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuestions.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70">
                      <td className="p-4 max-w-sm">
                        <p className="font-bold text-slate-900 line-clamp-1">{q.question}</p>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {q.id}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-800">{q.role}</span>
                        <div className="text-[10px] text-slate-400">{q.topic}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                          {q.company}
                        </span>
                      </td>
                      <td className="p-4 font-mono uppercase text-[10px] text-slate-600">{q.type}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            q.difficulty === "Easy"
                              ? "bg-emerald-100 text-emerald-800"
                              : q.difficulty === "Medium"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="p-4 text-[10px] text-slate-500">
                        {q.sourceName} • {q.sourceType}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(q);
                            setShowQuestionModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: LIVE INTERVIEWS
           ========================================================= */}
        {activeTab === "LIVE_SESSIONS" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                    <span>Real-time Active Candidate Sessions ({liveSessions.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proctoring telemetry updates in real-time. Warnings trigger automated alerts.
                  </p>
                </div>
              </div>

              {liveSessions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No active candidate sessions at this moment.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-4">Session ID</th>
                      <th className="p-4">Candidate</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Company</th>
                      <th className="p-4">Warnings</th>
                      <th className="p-4">State</th>
                      <th className="p-4">Privacy</th>
                      <th className="p-4">Interviewer</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liveSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="p-4 font-mono font-bold text-blue-600">{s.id}</td>
                        <td className="p-4 font-semibold text-slate-900">
                          {s.candidateEmail || s.userId}
                        </td>
                        <td className="p-4 font-medium text-slate-800">{s.role}</td>
                        <td className="p-4 font-medium text-slate-700">{s.targetCompany || "General"}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              s.warningCount > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.warningCount} / 4
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {s.sessionState || s.status}
                          </span>
                        </td>
                        <td className="p-4 text-[10px] font-semibold text-slate-600">
                          {s.privacyMode}
                        </td>
                        <td className="p-4 text-xs font-semibold text-blue-600">
                          {s.interviewerRole === "ai" ? "Saarvi AI" : "Human Admin"}
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/admin/mock-interview/${s.id}`}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded text-xs transition-colors"
                          >
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB: RECORDINGS
           ========================================================= */}
        {activeTab === "RECORDINGS" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Interview Video Recordings ({filteredRecordings.length})
                </h3>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5" />
                <span>Recording Status:</span>
                <select
                  value={recordingStatusFilter}
                  onChange={(e) => setRecordingStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-xs cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="READY">READY</option>
                  <option value="RECORDING">RECORDING</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="FAILED">FAILED</option>
                  <option value="DELETED">DELETED</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-4">Candidate / Session</th>
                    <th className="p-4">Role & Mode</th>
                    <th className="p-4">Recorded At</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">File Size</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecordings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No recordings found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRecordings.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{s.candidateEmail || s.userId}</p>
                          <span className="font-mono text-[10px] text-slate-400">{s.id}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-slate-800">{s.role}</span>
                          <span className="text-[10px] text-slate-400 block">{s.mode}</span>
                        </td>
                        <td className="p-4 text-[11px] text-slate-600">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-mono text-[11px] text-slate-700">
                          {formatSeconds(s.recordingDurationSeconds)}
                        </td>
                        <td className="p-4 font-mono text-[11px] text-slate-700">
                          {formatBytes(s.recordingFileSizeBytes)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              s.recordingStatus === "READY"
                                ? "bg-emerald-100 text-emerald-800"
                                : s.recordingStatus === "RECORDING"
                                ? "bg-blue-100 text-blue-800"
                                : s.recordingStatus === "DELETED"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {s.recordingStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {s.recordingStatus === "READY" && (
                              <button
                                type="button"
                                onClick={() => handleWatchRecording(s.id)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Watch</span>
                              </button>
                            )}
                            <Link
                              href={`/admin/mock-interview/${s.id}`}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
                            >
                              Details
                            </Link>
                            {s.recordingStatus === "READY" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecording(s.id)}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                title="Delete Recording"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: QUESTION ANALYTICS
           ========================================================= */}
        {activeTab === "ANALYTICS" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-4">Question Prompt</th>
                    <th className="p-4">Company</th>
                    <th className="p-4">Times Shown</th>
                    <th className="p-4">Times Answered</th>
                    <th className="p-4">Correct Count</th>
                    <th className="p-4">Timeouts</th>
                    <th className="p-4">Avg Time</th>
                    <th className="p-4">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {questionAnalytics.map((stat) => (
                    <tr key={stat.questionId} className="hover:bg-slate-50/70">
                      <td className="p-4 max-w-sm">
                        <p className="font-bold text-slate-900 line-clamp-1">{stat.questionText}</p>
                        <span className="text-[10px] text-slate-400">
                          {stat.company} • {stat.topic}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{stat.company}</td>
                      <td className="p-4 font-bold text-slate-900">{stat.timesShown}</td>
                      <td className="p-4 font-medium text-slate-700">{stat.timesAnswered}</td>
                      <td className="p-4 font-semibold text-emerald-600">{stat.timesCorrect}</td>
                      <td className="p-4 font-semibold text-amber-600">{stat.timesTimeout}</td>
                      <td className="p-4 font-mono text-slate-700">{stat.avgTimeSeconds}s</td>
                      <td className="p-4 font-bold text-blue-600">{stat.avgScore}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: CENTERS & LOCATIONS
           ========================================================= */}
        {activeTab === "CENTERS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Assessment Centers</h3>
                <p className="text-xs text-slate-500">
                  Configure verified physical locations for supervised or campus interview drives.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingCenter({
                    id: `center_${Date.now()}`,
                    centerName: "",
                    address: "",
                    city: "",
                    state: "",
                    country: "India",
                    timezone: "Asia/Kolkata",
                    status: "ACTIVE",
                  });
                  setShowCenterModal(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Center</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {centers.map((center) => (
                <div
                  key={center.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-slate-900 text-sm">{center.centerName}</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {center.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {center.address}, {center.city}, {center.country}
                  </p>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Coords: {center.latitude ?? "N/A"}°, {center.longitude ?? "N/A"}° • Timezone:{" "}
                    {center.timezone}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 5: POLICY SETTINGS
           ========================================================= */}
        {activeTab === "SETTINGS" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Authoritative Interview Policies
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enforce timers, proctoring warning limits, and hardware requirements across all sessions.
                </p>
              </div>

              {saveNotice && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved Successfully
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Feature Toggles */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Access & Identity Rules
                </h4>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Interview System Enabled</span>
                    <span className="text-slate-500 text-[11px]">System-wide toggle</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.interviewEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, interviewEnabled: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Registration Required</span>
                    <span className="text-slate-500 text-[11px]">Require authenticated user</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.registrationRequired}
                    onChange={(e) =>
                      setSettings({ ...settings, registrationRequired: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Email Verification Required</span>
                    <span className="text-slate-500 text-[11px]">Confirm email before room entry</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emailVerificationRequired}
                    onChange={(e) =>
                      setSettings({ ...settings, emailVerificationRequired: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Free Access Allowed</span>
                    <span className="text-slate-500 text-[11px]">Allow free registered users</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.freeAccessAllowed}
                    onChange={(e) =>
                      setSettings({ ...settings, freeAccessAllowed: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                {/* Recording Policies */}
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
                  Recording & Storage Policy
                </h4>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-900 block">Recording Requirement</span>
                  <select
                    value={settings.recordingPolicy || "OPTIONAL"}
                    onChange={(e) =>
                      setSettings({ ...settings, recordingPolicy: e.target.value as any })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="OPTIONAL">Optional (Candidate Consents at Preflight)</option>
                    <option value="MANDATORY">Mandatory (Required for Evaluation)</option>
                    <option value="DISABLED">Disabled (No Recording)</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-900 block">Retention Window (Days)</span>
                  <input
                    type="number"
                    value={settings.recordingRetentionDays || 90}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        recordingRetentionDays: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Hardware & Proctoring Rules */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Timers & Proctoring Limits
                </h4>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-900 block">MCQ Authoritative Timer (seconds)</span>
                  <input
                    type="number"
                    value={settings.defaultMcqTimeLimitSeconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultMcqTimeLimitSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-900 block">Max Proctoring Warnings</span>
                  <input
                    type="number"
                    value={settings.maxProctoringWarnings}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxProctoringWarnings: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Camera Verification Required</span>
                    <span className="text-slate-500 text-[11px]">Require video webcam readiness</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableCameraDeviceCheck}
                    onChange={(e) =>
                      setSettings({ ...settings, enableCameraDeviceCheck: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Microphone Verification Required</span>
                    <span className="text-slate-500 text-[11px]">Require audio microphone readiness</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableMicDeviceCheck}
                    onChange={(e) =>
                      setSettings({ ...settings, enableMicDeviceCheck: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">AI Speech Synthesis (TTS)</span>
                    <span className="text-slate-500 text-[11px]">Spoken audio delivery of interview questions</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableAiTtsFallback}
                    onChange={(e) =>
                      setSettings({ ...settings, enableAiTtsFallback: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Audio-Only Mode Allowed</span>
                    <span className="text-slate-500 text-[11px]">Permit interview without camera video</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.audioOnlyAllowed ?? true}
                    onChange={(e) =>
                      setSettings({ ...settings, audioOnlyAllowed: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Text-Only Fallback Allowed</span>
                    <span className="text-slate-500 text-[11px]">Permit text response if microphone unavailable</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.textOnlyAllowed ?? true}
                    onChange={(e) =>
                      setSettings({ ...settings, textOnlyAllowed: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? "Saving..." : "Save Policy Changes"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Watch Recording Player */}
        {playbackModalSession && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 max-w-4xl w-full border border-slate-800 shadow-2xl space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-100">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm">
                    Recording Playback — {playbackModalSession.candidateEmail || playbackModalSession.sessionId}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPlaybackModalSession(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <InterviewVideoPlayer
                sessionId={playbackModalSession.sessionId}
                initialPlaybackUrl={playbackModalSession.playbackUrl}
                expiresAt={playbackModalSession.expiresAt}
                durationSeconds={playbackModalSession.durationSeconds}
                fileSizeBytes={playbackModalSession.fileSizeBytes}
                candidateName={playbackModalSession.candidateEmail}
                role={playbackModalSession.role}
              />
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Question */}
        {showQuestionModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-slate-900 text-base">
                  {editingQuestion.id?.startsWith("q_custom_") ? "Add New Question" : "Edit Question"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Question Prompt</label>
                  <textarea
                    rows={3}
                    value={editingQuestion.question || ""}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                    required
                    placeholder="Enter the authoritative interview question text..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Role</label>
                    <select
                      value={editingQuestion.role}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, role: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Software Engineer">Software Engineer</option>
                      <option value="Backend Engineer">Backend Engineer</option>
                      <option value="Frontend Engineer">Frontend Engineer</option>
                      <option value="Data Scientist">Data Scientist</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Company</label>
                    <select
                      value={editingQuestion.company}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, company: e.target.value as any })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Difficulty</label>
                    <select
                      value={editingQuestion.difficulty}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Type</label>
                    <select
                      value={editingQuestion.type}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value as any })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="mcq">MCQ</option>
                      <option value="technical_coding">Technical Coding</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="communication">Communication</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Options (For MCQ)</label>
                  <div className="space-y-1.5">
                    {editingQuestion.options?.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={editingQuestion.correctAnswer === idx}
                          onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswer: idx })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...(editingQuestion.options || [])];
                            newOpts[idx] = e.target.value;
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Source Type</label>
                    <select
                      value={editingQuestion.sourceType}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, sourceType: e.target.value as any })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Saarvi practice question">Saarvi practice question</option>
                      <option value="Community-reported question">Community-reported question</option>
                      <option value="Reported interview question">Reported interview question</option>
                      <option value="Source-derived practice question">Source-derived practice question</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Timer (seconds)</label>
                    <input
                      type="number"
                      value={editingQuestion.timeLimitSeconds || 60}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, timeLimitSeconds: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuestionModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
                  >
                    Save Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Center */}
        {showCenterModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-slate-900 text-base">Add Assessment Center</h3>
                <button
                  type="button"
                  onClick={() => setShowCenterModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCenter} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Center Name</label>
                  <input
                    type="text"
                    required
                    value={editingCenter.centerName || ""}
                    onChange={(e) => setEditingCenter({ ...editingCenter, centerName: e.target.value })}
                    placeholder="e.g. Saarvi Assessment Center — North Campus"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Address</label>
                  <input
                    type="text"
                    required
                    value={editingCenter.address || ""}
                    onChange={(e) => setEditingCenter({ ...editingCenter, address: e.target.value })}
                    placeholder="Campus building or road"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={editingCenter.city || ""}
                      onChange={(e) => setEditingCenter({ ...editingCenter, city: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Country</label>
                    <input
                      type="text"
                      required
                      value={editingCenter.country || "India"}
                      onChange={(e) => setEditingCenter({ ...editingCenter, country: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCenterModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
                  >
                    Create Center
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Question Import Modal */}
        <QuestionImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          existingQuestions={questions}
          onImportComplete={(count) => {
            alert(`Successfully imported ${count} questions!`);
            loadData();
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
