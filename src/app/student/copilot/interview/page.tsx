"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import {
  InterviewMode,
  InterviewCompany,
  InterviewSession,
  CandidatePrivacyMode,
  InterviewPermissionState,
  ProctoringViolationEvent,
} from "@/types/interview";
import InterviewPermissionGate from "@/components/interview/InterviewPermissionGate";
import { useAuth } from "@/context/AuthContext";
import {
  Briefcase,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  RotateCcw,
  Video,
  FileText,
  Clock,
  Mic,
  MicOff,
  CameraOff,
  Volume2,
  VolumeX,
  ShieldAlert,
  Check,
  AlertCircle,
  Bot,
} from "lucide-react";

const TARGET_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Engineer",
  "Full Stack Developer",
  "Data Scientist",
  "DevOps / Cloud Engineer",
];

const TARGET_COMPANIES: InterviewCompany[] = [
  "General",
  "Google",
  "Microsoft",
  "Amazon",
  "Infosys",
  "TCS",
  "Wipro",
  "Accenture",
];

type WorkflowStage = "CONFIGURE" | "PERMISSION_GATE" | "ACTIVE_ROOM" | "COMPLETED" | "TERMINATED";

export default function MockInterviewPage() {
  const { user } = useAuth();

  // Workflow stage
  const [stage, setStage] = useState<WorkflowStage>("CONFIGURE");

  // Configuration options
  const [selectedRole, setSelectedRole] = useState(TARGET_ROLES[0]);
  const [selectedCompany, setSelectedCompany] = useState<InterviewCompany>("General");
  const [selectedMode, setSelectedMode] = useState<InterviewMode>("text_mcq");

  // Eligibility & verification state
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [requiresLoginNotice, setRequiresLoginNotice] = useState(false);
  const [requiresVerificationNotice, setRequiresVerificationNotice] = useState(false);
  const [requiresProNotice, setRequiresProNotice] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);

  // Permission Gate results
  const [verifiedPrivacyMode, setVerifiedPrivacyMode] = useState<CandidatePrivacyMode>("FULL_VIDEO");
  const [verifiedPermissions, setVerifiedPermissions] = useState<InterviewPermissionState | null>(null);

  // Active session state
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timers
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [timeSpentOnCurrent, setTimeSpentOnCurrent] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Proctoring warnings
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastWarningReason, setLastWarningReason] = useState("");

  // Media & AI Voice
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 1. Check eligibility before entering permission gate
  const handleStartEligibilityCheck = async () => {
    setCheckingEligibility(true);
    setEligibilityError(null);
    setRequiresLoginNotice(false);
    setRequiresVerificationNotice(false);
    setRequiresProNotice(false);

    try {
      const res = await fetch("/api/interview/eligibility");
      const data = await res.json();

      if (!data.eligible) {
        if (data.requiresLogin) {
          setRequiresLoginNotice(true);
        } else if (data.requiresEmailVerification) {
          setRequiresVerificationNotice(true);
        } else if (data.requiresPro) {
          setRequiresProNotice(true);
        } else {
          setEligibilityError(data.reason || "Interview eligibility check failed.");
        }
        return;
      }

      setAttemptsRemaining(data.attemptsRemaining ?? 3);
      setStage("PERMISSION_GATE");
    } catch {
      // Local dev offline fallback
      setStage("PERMISSION_GATE");
    } finally {
      setCheckingEligibility(false);
    }
  };

  // 2. Callback from InterviewPermissionGate when all checks pass
  const handlePermissionsVerified = async (config: {
    privacyMode: CandidatePrivacyMode;
    permissionState: InterviewPermissionState;
    locationData?: { latitude: number; longitude: number; accuracy: number };
  }) => {
    setVerifiedPrivacyMode(config.privacyMode);
    setVerifiedPermissions(config.permissionState);
    setIsSubmitting(true);

    try {
      // Start session on server
      const res = await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          mode: selectedMode,
          role: selectedRole,
          company: selectedCompany,
          privacyMode: config.privacyMode,
        }),
      });
      const data = await res.json();

      if (!data.success || !data.session) {
        throw new Error(data.error || "Failed to initialize interview session.");
      }

      const activeSession: InterviewSession = data.session;
      setSession(activeSession);
      setCurrentQuestionIndex(0);
      setCurrentAnswer("");
      setSelectedOptionIndex(null);
      setWarningCount(0);

      // Record permissions audit
      fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_permission",
          sessionId: activeSession.id,
          permissions: config.permissionState,
        }),
      }).catch(() => {});

      // Record location if captured
      if (config.locationData) {
        fetch("/api/interview/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "capture_location",
            sessionId: activeSession.id,
            latitude: config.locationData.latitude,
            longitude: config.locationData.longitude,
            accuracy: config.locationData.accuracy,
          }),
        }).catch(() => {});
      }

      // Initialize media stream for room if video mode
      if (selectedMode === "live_video") {
        initLiveMedia();
      }

      setStage("ACTIVE_ROOM");
    } catch (err: unknown) {
      alert((err as Error)?.message || "Could not start interview.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialize live video stream
  const initLiveMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // ignore
    }
  };

  // 3. Question timer countdown
  const currentQuestion = session?.questions[currentQuestionIndex];

  useEffect(() => {
    if (stage !== "ACTIVE_ROOM" || !currentQuestion) return;

    const limit = currentQuestion.timeLimitSeconds || (selectedMode === "text_mcq" ? 60 : 120);
    setTimeRemaining(limit);
    setTimeSpentOnCurrent(0);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time expired! Server-authoritative auto lock
          handleAnswerTimeout();
          return 0;
        }
        return prev - 1;
      });
      setTimeSpentOnCurrent((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage, currentQuestionIndex, currentQuestion?.id]);

  // Voice speech synthesis for AI question delivery
  useEffect(() => {
    if (stage === "ACTIVE_ROOM" && currentQuestion && ttsEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }, [stage, currentQuestionIndex, currentQuestion?.id, ttsEnabled]);

  // 4. Anti-Tab Switch & Window Focus Proctoring Listener
  useEffect(() => {
    if (stage !== "ACTIVE_ROOM" || !session) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerTabSwitchWarning("tab_switch");
      }
    };

    const handleBlur = () => {
      triggerTabSwitchWarning("window_blur");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [stage, session?.id]);

  const triggerTabSwitchWarning = async (type: ProctoringViolationEvent["type"]) => {
    if (!session || stage !== "ACTIVE_ROOM") return;

    try {
      const res = await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "proctoring_violation",
          sessionId: session.id,
          type,
          pageVisibilityState: document.visibilityState,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const count = data.warningCount || warningCount + 1;
        setWarningCount(count);
        setLastWarningReason(
          type === "tab_switch"
            ? "Browser tab switch or backgrounding detected."
            : "Application window lost active user focus."
        );
        setShowWarningModal(true);

        if (data.terminated) {
          setStage("TERMINATED");
          setSession(data.session);
        }
      }
    } catch {
      // Local fallback
      const count = warningCount + 1;
      setWarningCount(count);
      setLastWarningReason("Tab switch or window focus lost.");
      setShowWarningModal(true);
      if (count >= 4) {
        setStage("TERMINATED");
      }
    }
  };

  // 5. Submit answer handler
  const handleSubmitAnswer = async (isTimeout = false) => {
    if (!session || !currentQuestion || isSubmitting) return;

    const answerValue =
      currentQuestion.type === "mcq"
        ? (selectedOptionIndex !== null ? selectedOptionIndex : -1)
        : currentAnswer;

    setIsSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_answer",
          sessionId: session.id,
          questionId: currentQuestion.id,
          userAnswer: answerValue,
          timeSpentSeconds: timeSpentOnCurrent,
          isTimeout,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit answer.");
      }

      setSession(data.session);

      if (data.session.status === "completed" || data.session.sessionState === "COMPLETED") {
        setStage("COMPLETED");
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      } else {
        // Move to next question
        setCurrentQuestionIndex((prev) => prev + 1);
        setCurrentAnswer("");
        setSelectedOptionIndex(null);
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerTimeout = () => {
    handleSubmitAnswer(true);
  };

  // Speech to text toggle for voice answer
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use the text area.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (e: any) => {
        let transcript = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        setCurrentAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/career/interview-prep" className="hover:text-blue-600 transition-colors">
              Interview Prep
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">Mock Interview 2.0</span>
          </div>

          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Live Assessment Engine
          </span>
        </div>

        {/* =======================================================
            STAGE 1: CONFIGURATION & ELIGIBILITY
           ======================================================= */}
        {stage === "CONFIGURE" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <Briefcase className="w-8 h-8 text-blue-600" />
                  Saarvi Mock Interview 2.0
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
                  Real-time interview simulation featuring company-attributed question banks, live WebRTC media channels, and deterministic proctoring standards.
                </p>
              </div>

              {/* Eligibility Notices */}
              {requiresLoginNotice && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-bold">Authentication Required</p>
                    <p>You must be registered and signed in to start a Mock Interview.</p>
                    <Link
                      href="/login?next=/student/copilot/interview"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 transition-colors"
                    >
                      <span>Sign In with Saarvi</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {requiresVerificationNotice && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-bold">Email Verification Required</p>
                    <p>Please verify your registered email address before entering the interview room.</p>
                    <Link
                      href="/auth/verify-email"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-colors"
                    >
                      <span>Verify Email Now</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {requiresProNotice && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-3">
                  <Award className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-bold">Pro Plan Required</p>
                    <p>Live video interviews with human evaluators are restricted to Saarvi Pro members.</p>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs hover:bg-purple-700 transition-colors"
                    >
                      <span>Upgrade to Pro</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {eligibilityError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {eligibilityError}
                </div>
              )}

              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Select Interview Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedMode("text_mcq")}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedMode === "text_mcq"
                        ? "bg-blue-50/60 border-blue-600 shadow-xs ring-1 ring-blue-600"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Mode B: Typed / MCQ Interview</span>
                      </div>
                      {selectedMode === "text_mcq" && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Timed 30s/60s multiple choice questions with deterministic scoring and optional typed technical answers.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMode("live_video")}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedMode === "live_video"
                        ? "bg-blue-50/60 border-blue-600 shadow-xs ring-1 ring-blue-600"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                        <Video className="w-4 h-4 text-purple-600" />
                        <span>Mode A: Live / Video Interview</span>
                      </div>
                      {selectedMode === "live_video" && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      WebRTC live session with human admin interviewer when available, with automatic AI Interviewer fallback.
                    </p>
                  </button>
                </div>
              </div>

              {/* Target Role & Target Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Target Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {TARGET_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Company Question Bank
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value as InterviewCompany)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {TARGET_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c === "General" ? "General Engineering Assessment" : `${c} Placement Questions`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Interview CTA */}
              <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Daily attempts remaining: <strong>{attemptsRemaining}</strong>
                </span>

                <button
                  type="button"
                  onClick={handleStartEligibilityCheck}
                  disabled={checkingEligibility}
                  className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {checkingEligibility ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking Eligibility...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Mock Interview</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            STAGE 2: PERMISSION GATE & HARDWARE VERIFICATION
           ======================================================= */}
        {stage === "PERMISSION_GATE" && (
          <InterviewPermissionGate
            requireCamera={selectedMode === "live_video"}
            requireMicrophone={true}
            requireLocation={false}
            requireScreenShare={false}
            userIsAuthenticated={Boolean(user)}
            userEmailVerified={true}
            onReadyToStart={handlePermissionsVerified}
            onCancel={() => setStage("CONFIGURE")}
          />
        )}

        {/* =======================================================
            STAGE 3: ACTIVE INTERVIEW ROOM
           ======================================================= */}
        {stage === "ACTIVE_ROOM" && session && currentQuestion && (
          <div className="space-y-6">
            {/* Top Bar: Progress, Timer, Proctoring Warnings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Question {currentQuestionIndex + 1} of {session.questions.length}
                </span>

                <span className="text-xs font-semibold text-slate-500">
                  {currentQuestion.company} • {currentQuestion.topic || currentQuestion.role}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Visual Authoritative Countdown Timer */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                    timeRemaining <= 10
                      ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                      : "bg-slate-50 text-slate-800 border-slate-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeRemaining}s remaining</span>
                </div>

                {/* Warning Counter */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                    warningCount > 0
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Warnings: {warningCount} / 4</span>
                </div>

                {/* AI Voice Toggle */}
                <button
                  type="button"
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  title={ttsEnabled ? "Mute AI Voice" : "Enable AI Voice"}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                >
                  {ttsEnabled ? (
                    <Volume2 className="w-4 h-4 text-blue-600" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Live Interviewer Status Banner */}
            {selectedMode === "live_video" && (
              <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    No human interviewer is currently available. <strong>Saarvi AI Interviewer is ready.</strong>
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                  AI Fallback Active
                </span>
              </div>
            )}

            {/* Video Feed (Mode A) */}
            {selectedMode === "live_video" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Candidate Feed with Privacy Mode */}
                <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      verifiedPrivacyMode === "BLURRED_CANDIDATE_VIDEO" ? "filter blur-md" : ""
                    }`}
                  />
                  {verifiedPrivacyMode === "NO_CANDIDATE_VIDEO" && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
                      <CameraOff className="w-8 h-8" />
                      <span>Audio Only (Privacy Mode)</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-xs font-semibold">
                    Candidate (You) • {verifiedPrivacyMode}
                  </div>
                </div>

                {/* AI / Evaluator Feed */}
                <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mb-2">
                    <Bot className="w-8 h-8 text-blue-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Saarvi AI Evaluator</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {isSpeaking ? "Speaking question prompt..." : "Listening for candidate response..."}
                  </p>
                </div>
              </div>
            )}

            {/* Active Question Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              {/* Question Source Attribution */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                    {currentQuestion.category || "Technical"}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    Difficulty: <strong>{currentQuestion.difficulty}</strong>
                  </span>
                </div>

                {/* Source attribution disclosure */}
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                  <span>Source:</span>
                  <span className="font-semibold text-slate-700">
                    {currentQuestion.sourceType || "Saarvi practice question"}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <h2 className="text-base sm:text-xl font-extrabold text-slate-900 leading-snug">
                {currentQuestion.question}
              </h2>

              {/* Mode B: Multiple Choice Options */}
              {currentQuestion.type === "mcq" && currentQuestion.options && (
                <div className="space-y-3 pt-2">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedOptionIndex === idx;
                    const letter = String.fromCharCode(65 + idx); // A, B, C, D

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOptionIndex(idx)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-600 shadow-xs ring-1 ring-blue-600"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-800 font-medium">
                            {option}
                          </span>
                        </div>

                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Mode A / Freeform / Behavioral Answer Textarea */}
              {currentQuestion.type !== "mcq" && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">
                      Your Technical Answer / Explanation:
                    </label>

                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      className={`text-xs px-3 py-1 rounded-lg border font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isListening
                          ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-red-600" />
                          <span>Stop Recording</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-blue-600" />
                          <span>Answer with Voice</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Type your response or use voice input. Structure with situation, architecture, trade-offs, and measurable results..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500">
                    Word count: {currentAnswer.trim() ? currentAnswer.trim().split(/\s+/).length : 0} words
                  </p>
                </div>
              )}

              {/* Submit Action */}
              <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Authoritative timer locked to session clock.
                </span>

                <button
                  type="button"
                  onClick={() => handleSubmitAnswer(false)}
                  disabled={
                    isSubmitting ||
                    (currentQuestion.type === "mcq" && selectedOptionIndex === null) ||
                    (currentQuestion.type !== "mcq" && !currentAnswer.trim())
                  }
                  className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording Answer...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Answer & Proceed</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Warning Modal */}
        {showWarningModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-red-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600">
                <ShieldAlert className="w-8 h-8" />
                <h3 className="text-lg font-black text-slate-900">
                  Proctoring Warning {warningCount} of 4
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {lastWarningReason}
              </p>

              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-900">
                <strong>Attention:</strong> If 4 warnings are reached, your session will be automatically terminated per platform proctoring policy.
              </div>

              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="w-full min-h-[44px] bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
              >
                I Understand & Return to Interview
              </button>
            </div>
          </div>
        )}

        {/* =======================================================
            STAGE 4: SESSION COMPLETED SUMMARY
           ======================================================= */}
        {stage === "COMPLETED" && session && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="text-center space-y-2 border-b border-slate-100 pb-6">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 mb-2">
                <Award className="w-10 h-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                Interview Completed Successfully!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Comprehensive performance metrics and concept breakdown across all submitted interview questions.
              </p>

              <div className="pt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800">
                <span>Overall Performance Score:</span>
                <span className="text-base text-blue-600">{session.overallScore} / 100</span>
              </div>
            </div>

            {/* Answer Transcripts & Evaluated Feedback */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Question Performance & Rubric Notes
              </h3>

              {session.responses.map((resp, i) => {
                const q = session.questions.find((item) => item.id === resp.questionId);

                return (
                  <div
                    key={resp.questionId}
                    className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          Question {i + 1} • {q?.type.toUpperCase()}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                          {q?.question}
                        </h4>
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                          resp.score && resp.score >= 75
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        Score: {resp.score} / 100
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                      <strong className="block text-slate-800 font-semibold">Your Answer:</strong>
                      <p className="leading-relaxed">
                        {q?.type === "mcq" && q.options
                          ? `${q.options[Number(resp.userAnswer)] || "None"} (${
                              resp.isCorrect ? "Correct" : "Incorrect"
                            })`
                          : String(resp.userAnswer)}
                      </p>
                    </div>

                    {resp.feedback && (
                      <div className="text-xs text-slate-600 bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-blue-900 font-semibold">Evaluation Notes:</strong>
                          {resp.isAiEvaluated && (
                            <span className="text-[10px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded border border-blue-200">
                              AI-assisted evaluation
                            </span>
                          )}
                        </div>
                        <p>{resp.feedback.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Return Action */}
            <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
              <Link
                href="/student/interviews"
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                View in My Interviews
              </Link>

              <button
                type="button"
                onClick={() => {
                  setStage("CONFIGURE");
                  setSession(null);
                }}
                className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Practice Another Interview</span>
              </button>
            </div>
          </div>
        )}

        {/* =======================================================
            STAGE 5: TERMINATED PROCTORING
           ======================================================= */}
        {stage === "TERMINATED" && (
          <div className="bg-white border border-red-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-red-50 text-red-600 mb-2">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Interview Session Terminated
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              This session was automatically terminated because the maximum allowed tab-switching or window focus violations (4 warnings) were exceeded.
            </p>

            <div className="border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={() => {
                  setStage("CONFIGURE");
                  setSession(null);
                }}
                className="min-h-[44px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Return to Interview Setup
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
