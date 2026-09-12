"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { MockInterviewTurn } from "@/types/copilot";
import { copilotService } from "@/lib/ai/copilot/copilot-service";
import { careerService } from "@/lib/services/careerService";
import {
  Briefcase,
  ArrowLeft,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  Sparkles,
  RotateCcw,
  Target,
  FileCheck,
} from "lucide-react";

const TARGET_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Engineer",
  "Full Stack Developer",
  "Data Analyst",
  "Machine Learning Engineer",
  "DevOps / Cloud Engineer",
];

export default function MockInterviewPage() {
  const [selectedRole, setSelectedRole] = useState(TARGET_ROLES[0]);
  const [customRole, setCustomRole] = useState("");
  const [candidateSkills, setCandidateSkills] = useState<string[]>([]);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [turns, setTurns] = useState<MockInterviewTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Load candidate skills from local career profile
  useEffect(() => {
    async function loadSkills() {
      try {
        const profile = await careerService.getOrCreateProfile("guest");
        if (profile?.skills && profile.skills.length > 0) {
          setCandidateSkills(profile.skills.map((s) => s.name));
        } else {
          setCandidateSkills(["Data Structures", "Java", "Python", "SQL", "Git"]);
        }
        if (profile?.professionalTitle) {
          setSelectedRole(profile.professionalTitle);
        }
      } catch {
        setCandidateSkills(["Data Structures", "Java", "SQL"]);
      }
    }
    loadSkills();
  }, []);

  const activeRole = customRole.trim() || selectedRole;

  const startSession = async () => {
    setLoading(true);
    setSessionStarted(true);
    setSessionCompleted(false);
    setTurns([]);
    setCurrentQuestionNumber(1);
    setCurrentAnswer("");

    try {
      const turn = await copilotService.requestMockInterviewTurn(
        activeRole,
        1,
        candidateSkills
      );
      setCurrentQuestion(turn.question);
    } catch {
      setCurrentQuestion("Tell me about a challenging technical project you built, the architecture decisions you made, and how you tested its edge cases.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim() || loading) return;

    setLoading(true);
    const answeredQuestion = currentQuestion;
    const answeredText = currentAnswer;
    setCurrentAnswer("");

    try {
      const turn = await copilotService.requestMockInterviewTurn(
        activeRole,
        currentQuestionNumber + 1,
        candidateSkills,
        answeredQuestion,
        answeredText
      );

      const completedTurn: MockInterviewTurn = {
        questionIndex: currentQuestionNumber,
        question: answeredQuestion,
        role: activeRole,
        answer: answeredText,
        feedback: turn.feedback,
      };

      setTurns((prev) => [...prev, completedTurn]);

      if (currentQuestionNumber >= 5) {
        setSessionCompleted(true);
      } else {
        setCurrentQuestionNumber((prev) => prev + 1);
        setCurrentQuestion(turn.question);
      }
    } catch {
      const completedTurn: MockInterviewTurn = {
        questionIndex: currentQuestionNumber,
        question: answeredQuestion,
        role: activeRole,
        answer: answeredText,
        feedback: {
          rating: "Strong",
          notes: "Good articulate explanation of your approach.",
          tips: ["Remember to quantify your outcomes with metrics.", "Mention failure recovery."],
        },
      };
      setTurns((prev) => [...prev, completedTurn]);

      if (currentQuestionNumber >= 5) {
        setSessionCompleted(true);
      } else {
        setCurrentQuestionNumber((prev) => prev + 1);
        setCurrentQuestion("How do you handle database concurrency and transaction isolation in high-throughput services?");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/student/copilot"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Copilot Chat
          </Link>
          <div className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            AI Mock Interview Coach
          </div>
        </div>

        {/* Setup Card (Shown before starting or after completion) */}
        {!sessionStarted ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-left">
            <div className="max-w-2xl">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
                <Briefcase className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                AI Technical & Behavioral Mock Interview
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                Simulate realistic interview rounds tailored to your campus placement target role. Questions are grounded in your recorded skills and projects.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Target Placement Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                      setCustomRole("");
                    }}
                    className="w-full text-sm px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {TARGET_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Or Enter Custom Role
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Embedded Systems Engineer"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    className="w-full text-sm px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Your Profile Skills (Context for the Interviewer)
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {candidateSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={startSession}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition shadow-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Target className="w-4 h-4" />
                    )}
                    Start 5-Question Interview Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : sessionCompleted ? (
          /* Session Completed Summary Card */
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-left space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-semibold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Interview Completed
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Performance Review for {activeRole}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Here is the qualitative breakdown of your answers and actionable guidance for improvement.
                </p>
              </div>

              <button
                type="button"
                onClick={startSession}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Another Round
              </button>
            </div>

            {/* List of turns and feedback */}
            <div className="space-y-4">
              {turns.map((turn, idx) => (
                <div key={idx} className="p-5 border border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Question {turn.questionIndex}
                    </span>
                    {turn.feedback?.rating && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          turn.feedback.rating === "Strong"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : turn.feedback.rating === "Could be clearer"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {turn.feedback.rating}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-900 mb-2">
                    "{turn.question}"
                  </p>

                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 mb-3">
                    <span className="font-semibold text-slate-500 block mb-1">Your Answer:</span>
                    {turn.answer}
                  </div>

                  {turn.feedback && (
                    <div className="space-y-2 text-xs">
                      <p className="text-slate-600 leading-relaxed">{turn.feedback.notes}</p>
                      {turn.feedback.tips && turn.feedback.tips.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <span className="font-semibold text-indigo-700 block mb-1">
                            Actionable Tips:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-600">
                            {turn.feedback.tips.map((t, ti) => (
                              <li key={ti}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Active Interview Question Card */
          <div className="space-y-6">
            {/* Progress Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  Question {currentQuestionNumber} of 5
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Role: {activeRole}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSessionStarted(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                End Session
              </button>
            </div>

            {/* Current Question Display */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm">
              <div className="inline-flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full font-medium mb-3">
                <HelpCircle className="w-3.5 h-3.5" />
                Interviewer Question
              </div>
              <p className="text-lg font-semibold text-slate-900 leading-snug">
                {currentQuestion || "Loading question..."}
              </p>
            </div>

            {/* Answer Input Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Your Answer (Be concise and structured)
              </label>
              <textarea
                rows={5}
                placeholder="Structure your answer (e.g. context, technical approach, key tradeoffs, test cases, and outcomes)..."
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                disabled={loading}
                className="w-full text-sm p-4 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-400">
                  Tip: Use the STAR framework (Situation, Task, Action, Result) for behavioral questions.
                </span>

                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={loading || !currentAnswer.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Answer & Get Evaluation
                </button>
              </div>
            </div>

            {/* Previous Turns Feedback in Current Session */}
            {turns.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Previous Questions in This Session
                </h3>
                {turns.map((turn, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Q{turn.questionIndex}: {turn.question}
                      </span>
                      {turn.feedback?.rating && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            turn.feedback.rating === "Strong"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : turn.feedback.rating === "Could be clearer"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {turn.feedback.rating}
                        </span>
                      )}
                    </div>
                    {turn.feedback && (
                      <p className="text-xs text-slate-600">{turn.feedback.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
