"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import InterviewVideoPlayer from "@/components/interview/InterviewVideoPlayer";
import { InterviewSession } from "@/types/interview";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Clock,
  User,
  Building2,
  Video,
  Award,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Camera,
  Mic,
  Activity,
  Bot,
  FileText,
  Flag,
  Check,
  Sparkles,
  Wifi,
} from "lucide-react";

export default function AdminInterviewSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string>("");
  const [playbackExpiresAt, setPlaybackExpiresAt] = useState<string>("");
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);
  const [isDeletingRecording, setIsDeletingRecording] = useState(false);

  // Review Controls State
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "FLAGGED" | "RETAKE_REQUESTED">("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [adjustedScore, setAdjustedScore] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

  const fetchSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/session?id=${sessionId}`);
      const data = await res.json();
      if (!data.success || !data.session) {
        throw new Error(data.error || "Failed to load session details.");
      }
      setSession(data.session);
      setReviewStatus(data.session.reviewStatus === "FLAGGED" ? "FLAGGED" : data.session.reviewStatus === "RETAKE_REQUESTED" ? "RETAKE_REQUESTED" : "APPROVED");
      setReviewNotes(data.session.reviewNotes || "");
      if (data.session.overallScore !== undefined) {
        setAdjustedScore(String(data.session.overallScore));
      }

      // If recording exists, fetch signed playback URL
      if (data.session.recordingStatus === "READY") {
        fetchPlaybackUrl();
      }

      // Fetch timeline events
      fetchEvents();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load interview session.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_events", sessionId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } catch {
      // Timeline events optional fallback
    }
  };

  const fetchPlaybackUrl = async (): Promise<string> => {
    try {
      const res = await fetch(`/api/interview/recording/playback?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success && data.playbackUrl) {
        setPlaybackUrl(data.playbackUrl);
        setPlaybackExpiresAt(data.expiresAt);
        return data.playbackUrl;
      }
      return "";
    } catch (err) {
      console.warn("[Playback Link Error]:", err);
      return "";
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const handleSaveReview = async (decisionOverride?: "APPROVED" | "FLAGGED" | "RETAKE_REQUESTED") => {
    setIsSubmittingReview(true);
    const targetDecision = decisionOverride || reviewStatus;
    try {
      const res = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_review",
          sessionId,
          review: {
            status: targetDecision,
            notes: reviewNotes,
            score: adjustedScore ? Number(adjustedScore) : undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewStatus(targetDecision);
        setReviewNotice(`Session marked as ${targetDecision} successfully.`);
        if (session) {
          setSession({
            ...session,
            reviewStatus: targetDecision,
            reviewNotes,
            overallScore: adjustedScore ? Number(adjustedScore) : session.overallScore,
          });
        }
        setTimeout(() => setReviewNotice(null), 3000);
      } else {
        alert(data.error || "Failed to submit review.");
      }
    } catch {
      alert("Network error submitting review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteRecording = async () => {
    if (!confirm("Are you sure you want to permanently delete this interview recording? This cannot be undone.")) {
      return;
    }
    setIsDeletingRecording(true);
    try {
      const res = await fetch("/api/interview/recording/playback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        setPlaybackUrl("");
        if (session) {
          setSession({ ...session, recordingStatus: "DELETED", recordingStoragePath: undefined });
        }
      } else {
        alert(data.error || "Failed to delete recording.");
      }
    } catch {
      alert("Error deleting recording.");
    } finally {
      setIsDeletingRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-16 text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading interview moderation workspace...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Session Not Found</h1>
          <p className="text-xs text-slate-600">{error || "The requested interview session ID does not exist."}</p>
          <Link
            href="/admin/mock-interview"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Moderation Hub</span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const responses = session.responses || [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link
              href="/admin/mock-interview"
              className="hover:text-slate-900 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Moderation Hub</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-mono font-bold">{session.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {session.role}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              session.sessionState === "COMPLETED" || session.status === "completed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {session.sessionState || session.status}
            </span>
          </div>
        </div>

        {/* Review Notice */}
        {reviewNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between animate-fadeIn">
            <span>{reviewNotice}</span>
            <button type="button" onClick={() => setReviewNotice(null)} className="text-emerald-600 hover:text-emerald-900">×</button>
          </div>
        )}

        {/* 3-COLUMN MODERATION WORKSPACE LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* =========================================================
              LEFT COLUMN (col-span-3): Candidate Profile & Event Timeline
             ========================================================= */}
          <div className="lg:col-span-3 space-y-4">
            {/* Candidate Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
                  {(session.candidateEmail || "C").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[170px]">
                    {session.candidateEmail || "Candidate"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[170px]">
                    ID: {session.userId}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Target Role:</span>
                  <span className="font-bold text-slate-800">{session.role}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Target Company:</span>
                  <span className="font-bold text-slate-800">{session.targetCompany || "General"}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Session Mode:</span>
                  <span className="font-bold text-slate-800 capitalize">{session.mode}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Started:</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>

            {/* Event Timeline */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Session Timeline
              </h3>

              <div className="space-y-3 relative before:absolute before:inset-0 before:left-2.5 before:w-0.5 before:bg-slate-100">
                {events.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No telemetry events logged.</p>
                ) : (
                  events.map((ev, i) => (
                    <div key={ev.id || i} className="relative flex items-start gap-3 text-xs pl-1">
                      <div
                        className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 z-10 ${
                          ev.status === "error"
                            ? "bg-rose-500"
                            : ev.status === "warning"
                            ? "bg-amber-500"
                            : ev.status === "success"
                            ? "bg-emerald-500"
                            : "bg-blue-500"
                        }`}
                      />
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">{ev.label}</div>
                        {ev.details && <div className="text-[10px] text-slate-500 mt-0.5">{ev.details}</div>}
                        <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* =========================================================
              CENTER COLUMN (col-span-6): Recording & Q&A Assessment
             ========================================================= */}
          <div className="lg:col-span-6 space-y-4">
            {/* Private Recording Player */}
            {session.recordingStatus === "READY" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-slate-900">Institutional Recording Playback</h3>
                  </div>
                  {playbackExpiresAt && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      Signed Link Valid Until: {new Date(playbackExpiresAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {playbackUrl ? (
                  <InterviewVideoPlayer
                    sessionId={sessionId}
                    initialPlaybackUrl={playbackUrl}
                    candidateName={session.candidateEmail}
                    role={session.role}
                    expiresAt={playbackExpiresAt}
                  />
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-xl text-xs text-slate-400">
                    Generating signed playback URL...
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Storage: Private Institutional Bucket
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteRecording}
                    disabled={isDeletingRecording}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{isDeletingRecording ? "Deleting..." : "Delete Recording"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Questions & Candidate Turns */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Assessment Questions &amp; Answers</h3>
                  <p className="text-xs text-slate-500">Candidate answers, time spent, and evaluations</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {responses.length} / {session.questions?.length || 5} Answered
                </span>
              </div>

              {responses.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl text-xs text-slate-400">
                  No questions answered yet in this session.
                </div>
              ) : (
                <div className="space-y-3">
                  {responses.map((resp, idx) => {
                    const isExpanded = expandedQuestion === idx;
                    const question = (session.questions || []).find((q) => q.id === resp.questionId);

                    return (
                      <div
                        key={resp.questionId || idx}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900 line-clamp-1">
                              {question?.question || `Question ${idx + 1}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {resp.score !== undefined && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {resp.score}%
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 pt-1 border-t border-slate-200/80 bg-white space-y-3 text-xs">
                            {question && (
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                                  Full Prompt ({question.difficulty})
                                </span>
                                <p className="font-semibold text-slate-800">{question.question}</p>
                              </div>
                            )}

                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                                Candidate Response (Duration: {resp.timeSpentSeconds || 0}s)
                              </span>
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-slate-800">
                                {typeof resp.userAnswer === "number" && question?.options
                                  ? `${resp.userAnswer + 1}. ${question.options[resp.userAnswer]}`
                                  : String(resp.userAnswer || "No answer recorded.")}
                              </div>
                            </div>

                            {/* Transparent AI Evaluation Banner */}
                            {resp.feedback && (
                              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                                <div className="flex items-center justify-between text-indigo-900">
                                  <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-600" />
                                    AI-Generated Assessment (Evaluator Reference)
                                  </span>
                                  <span className="text-[10px] font-bold bg-indigo-100 px-2 py-0.5 rounded-full">
                                    Rating: {resp.feedback.rating}
                                  </span>
                                </div>
                                <p className="text-[11px] text-indigo-800">{resp.feedback.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* =========================================================
              RIGHT COLUMN (col-span-3): Review Controls & Telemetry
             ========================================================= */}
          <div className="lg:col-span-3 space-y-4">
            {/* Review Decision Controls */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Evaluator Decision
              </h3>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 block">Overall Score (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={adjustedScore}
                  onChange={(e) => setAdjustedScore(e.target.value)}
                  placeholder="e.g. 85"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 block">Review Decision:</label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReviewStatus("APPROVED")}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      reviewStatus === "APPROVED"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <span>Approve Session</span>
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus("FLAGGED")}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      reviewStatus === "FLAGGED"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <span>Flag for Review</span>
                    <Flag className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus("RETAKE_REQUESTED")}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      reviewStatus === "RETAKE_REQUESTED"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <span>Request Retake</span>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 block">Internal Notes:</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add evaluation feedback or flag reasoning..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <button
                type="button"
                onClick={() => handleSaveReview()}
                disabled={isSubmittingReview}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReview ? "Saving Decision..." : "Submit Review"}
              </button>
            </div>

            {/* Technical Health Telemetry */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Technical Telemetry
              </h3>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Camera Device:</span>
                  <span className={`font-bold flex items-center gap-1 ${session.cameraPermission === "granted" ? "text-emerald-700" : "text-rose-600"}`}>
                    <Camera className="w-3 h-3" />
                    {session.cameraPermission || "Not detected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Microphone:</span>
                  <span className={`font-bold flex items-center gap-1 ${session.microphonePermission === "granted" ? "text-emerald-700" : "text-rose-600"}`}>
                    <Mic className="w-3 h-3" />
                    {session.microphonePermission || "Not detected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Proctoring Alerts:</span>
                  <span className={`font-bold ${session.warningCount > 0 ? "text-amber-600" : "text-slate-700"}`}>
                    {session.warningCount} violations
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Institutional Media:</span>
                  <span className="font-bold text-slate-700">{session.recordingStatus || "None"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Connection Stream:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Verified
                  </span>
                </div>
              </div>

              {/* Proctoring Audit Log */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-[11px] font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Proctoring Audit Log
                </h4>
                {session.proctoringViolations && session.proctoringViolations.length > 0 ? (
                  <div className="space-y-1.5">
                    {session.proctoringViolations.map((v, i) => (
                      <div key={v.id || i} className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px]">
                        <div className="font-bold text-amber-900 capitalize">{v.type.replace(/_/g, " ")}</div>
                        <div className="text-slate-500 text-[10px]">
                          Warning #{v.warningNumber} • {new Date(v.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-500 text-center">
                    Clean proctoring session — 0 warnings triggered
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
