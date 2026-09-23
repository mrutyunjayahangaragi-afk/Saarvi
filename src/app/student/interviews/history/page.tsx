"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { InterviewSession } from "@/types/interview";
import InterviewVideoPlayer from "@/components/interview/InterviewVideoPlayer";
import {
  Briefcase,
  Calendar,
  Clock,
  Award,
  Video,
  Play,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  X,
  Plus,
} from "lucide-react";

export default function StudentInterviewHistoryPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlayback, setActivePlayback] = useState<{
    sessionId: string;
    playbackUrl: string;
    expiresAt?: string;
    role?: string;
    durationSeconds?: number;
    fileSizeBytes?: number;
  } | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/interview/session?id=recent");
      const data = await res.json();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch {
      // Memory fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleWatch = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/interview/recording/playback?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success && data.playbackUrl) {
        setActivePlayback({
          sessionId,
          playbackUrl: data.playbackUrl,
          expiresAt: data.expiresAt,
          role: data.role,
          durationSeconds: data.durationSeconds,
          fileSizeBytes: data.fileSizeBytes,
        });
      } else {
        alert(data.error || "Unable to load playback link.");
      }
    } catch {
      alert("Failed to load recording.");
    }
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/student/copilot/interview"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Interview Room</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-800">My Mock Interviews</span>
          </div>

          <Link
            href="/mock-interview"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Start Practice Session</span>
          </Link>
        </div>

        {/* Header Title Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                My Mock Interview History
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Review past evaluation scores, question rubrics, and video recordings.
              </p>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
              Loading past interviews...
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4">
              <Briefcase className="w-12 h-12 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">No mock interviews recorded yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Take your first timed mock interview session with automated proctoring and real-time feedback.
                </p>
              </div>
              <Link
                href="/mock-interview"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
              >
                <span>Launch Mock Interview 2.0</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      {s.mode}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-slate-900">{s.role}</span>
                    {s.targetCompany && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs font-medium text-slate-500">{s.targetCompany}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(s.startedAt).toLocaleDateString()}
                    </span>
                    <span>Status: {s.status}</span>
                    {s.warningCount > 0 && (
                      <span className="text-amber-600 font-semibold">
                        {s.warningCount} warnings
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  {s.totalScore !== undefined && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">Score</span>
                      <span className="text-base font-black text-blue-600">
                        {Math.round(s.totalScore)}%
                      </span>
                    </div>
                  )}

                  {s.recordingStatus === "READY" && (
                    <button
                      type="button"
                      onClick={() => handleWatch(s.id)}
                      className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-indigo-200 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-indigo-600" />
                      <span>Watch Recording</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Video Player Modal */}
        {activePlayback && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 max-w-4xl w-full border border-slate-800 shadow-2xl space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-100">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm">
                    Interview Playback — {activePlayback.role || activePlayback.sessionId}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePlayback(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <InterviewVideoPlayer
                sessionId={activePlayback.sessionId}
                initialPlaybackUrl={activePlayback.playbackUrl}
                expiresAt={activePlayback.expiresAt}
                durationSeconds={activePlayback.durationSeconds}
                fileSizeBytes={activePlayback.fileSizeBytes}
                role={activePlayback.role}
              />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
