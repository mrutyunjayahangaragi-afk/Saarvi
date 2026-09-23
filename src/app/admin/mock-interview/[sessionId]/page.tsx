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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Camera,
  Mic,
  Activity,
} from "lucide-react";

export default function AdminInterviewSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string>("");
  const [playbackExpiresAt, setPlaybackExpiresAt] = useState<string>("");
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);
  const [isDeletingRecording, setIsDeletingRecording] = useState(false);

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

      // If recording exists, fetch signed playback URL
      if (data.session.recordingStatus === "READY") {
        fetchPlaybackUrl();
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load interview session.");
    } finally {
      setLoading(false);
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
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-16 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-600">Loading interview audit review...</p>
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Control Center</span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const responses = session.responses || [];
  const proctoringEvents = session.proctoringEvents || [];
  const statusColor =
    session.status === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : session.status === "IN_PROGRESS" || session.status === "ACTIVE"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : session.status === "TERMINATED"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/mock-interview"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Mock Interview Hub</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-700 font-mono">{session.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusColor}`}>
              {session.status}
            </span>
          </div>
        </div>

        {/* Top Summary Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  {session.mode} Interview
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-600">{session.role}</span>
                {session.company && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-semibold text-slate-600">{session.company}</span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Candidate Evaluation Audit
              </h1>
            </div>

            {session.totalScore !== undefined && (
              <div className="text-right bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2 self-start">
                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Overall Score
                </div>
                <div className="text-2xl font-black text-blue-900">
                  {Math.round(session.totalScore)}%
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Candidate</span>
              <span className="font-bold text-slate-800 truncate block mt-0.5">
                {session.candidateEmail || session.userId}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Session Started</span>
              <span className="font-bold text-slate-800 block mt-0.5">
                {new Date(session.startedAt).toLocaleString([], {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Proctoring Warnings</span>
              <span className={`font-bold block mt-0.5 ${session.warningCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {session.warningCount} / 4
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Recording Status</span>
              <span className="font-bold text-slate-800 block mt-0.5">
                {session.recordingStatus || "NOT_STARTED"}
              </span>
            </div>
          </div>

          {/* Preflight & Hardware Info */}
          {(session.cameraLabel || session.micLabel || session.privacyMode) && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
              {session.cameraLabel && (
                <div className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Camera: {session.cameraLabel}</span>
                </div>
              )}
              {session.micLabel && (
                <div className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mic: {session.micLabel}</span>
                </div>
              )}
              {session.privacyMode && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Privacy Mode: {session.privacyMode}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video Player Section (if recording exists) */}
        {session.recordingStatus === "READY" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Session Recording Playback
                </h2>
              </div>

              <button
                type="button"
                onClick={handleDeleteRecording}
                disabled={isDeletingRecording}
                className="px-3 py-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Recording</span>
              </button>
            </div>

            <InterviewVideoPlayer
              sessionId={session.id}
              initialPlaybackUrl={playbackUrl}
              expiresAt={playbackExpiresAt}
              durationSeconds={session.recordingDurationSeconds}
              fileSizeBytes={session.recordingFileSizeBytes}
              candidateName={session.candidateEmail}
              role={session.role}
              recordedAt={session.startedAt}
              onRefreshPlaybackUrl={fetchPlaybackUrl}
            />
          </div>
        )}

        {/* Question Responses Breakdown */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-600" />
            <span>Interview Questions & Responses ({session.questions.length})</span>
          </h2>

          <div className="space-y-3">
            {session.questions.map((q, idx) => {
              const resp = responses.find((r) => r.questionId === q.id);
              const isExpanded = expandedQuestion === idx;

              return (
                <div
                  key={q.id}
                  className="border border-slate-200 rounded-2xl overflow-hidden transition-all bg-slate-50/50"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                    className="w-full p-4 flex items-start justify-between text-left hover:bg-slate-100/60 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Q{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          {q.type} • {q.difficulty}
                        </span>
                        {resp?.isCorrect !== undefined && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              resp.isCorrect
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {resp.isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        )}
                        {resp?.score !== undefined && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            Score: {resp.score}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900">{q.question}</p>
                    </div>

                    <div className="text-slate-400 mt-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-white border-t border-slate-200 space-y-3 text-xs">
                      {q.options && q.options.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-500 block">Options:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => {
                              const isSelected = resp?.userAnswer === opt;
                              const isCorrectOpt = q.correctAnswer === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${
                                    isCorrectOpt
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                                      : isSelected
                                      ? "bg-red-50 border-red-300 text-red-900"
                                      : "bg-slate-50 border-slate-200 text-slate-700"
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isCorrectOpt && (
                                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
                                      Correct
                                    </span>
                                  )}
                                  {isSelected && !isCorrectOpt && (
                                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                                      Chosen
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {resp && (
                        <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200/80">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Candidate Response:</span>
                            <span>Time Spent: {resp.timeSpentSeconds}s</span>
                          </div>
                          <p className="font-semibold text-slate-800">{resp.userAnswer || "(No answer submitted)"}</p>
                          {resp.feedback && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <span className="text-[10px] font-bold text-indigo-700 block uppercase">
                                AI-assisted Evaluation Feedback:
                              </span>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {typeof resp.feedback === "string"
                                  ? resp.feedback
                                  : `${resp.feedback.rating}: ${resp.feedback.notes}`}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-900 text-[11px]">
                          <span className="font-bold block">Rubric / Explanation:</span>
                          <p className="mt-0.5">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Proctoring Event Timeline */}
        {proctoringEvents.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Proctoring Audit Log ({proctoringEvents.length})</span>
            </h2>

            <div className="divide-y divide-slate-100 text-xs">
              {proctoringEvents.map((event: any) => (
                <div key={event.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-bold text-slate-800">{event.type}</span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      ({event.pageVisibilityState})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
