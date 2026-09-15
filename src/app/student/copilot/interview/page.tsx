"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import {
  InterviewMode,
  InterviewCompany,
  InterviewQuestion,
  InterviewSession,
  InterviewTurnResponse,
  ProctoringViolationEvent,
} from "@/types/interview";
import { interviewService } from "@/lib/services/interviewService";
import { careerService } from "@/lib/services/careerService";
import {
  Briefcase,
  ArrowLeft,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  RotateCcw,
  Target,
  FileCheck,
  Video,
  FileText,
  Clock,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Volume2,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Play,
  Check,
  HelpCircle,
  AlertCircle,
  Eye,
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

export default function MockInterviewPage() {
  // Session Configuration State
  const [selectedRole, setSelectedRole] = useState(TARGET_ROLES[0]);
  const [selectedCompany, setSelectedCompany] = useState<InterviewCompany>("General");
  const [selectedMode, setSelectedMode] = useState<InterviewMode>("text_mcq");

  // Device Check State (for Live Video mode)
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [deviceCheckCompleted, setDeviceCheckCompleted] = useState(false);

  // Active Session State
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Timer State
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [timeSpentOnCurrent, setTimeSpentOnCurrent] = useState<number>(0);

  // Proctoring State
  const [proctoringWarnings, setProctoringWarnings] = useState<ProctoringViolationEvent[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastWarningType, setLastWarningType] = useState<string>("");
  const [isTerminated, setIsTerminated] = useState(false);

  // AI Interviewer Speech & STT State (Mode 2)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-detect role from profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await careerService.getOrCreateProfile("guest");
        if (profile?.professionalTitle) {
          const match = TARGET_ROLES.find((r) =>
            profile.professionalTitle?.toLowerCase().includes(r.toLowerCase())
          );
          if (match) setSelectedRole(match);
        }
      } catch {
        // Fallback to default role
      }
    }
    loadProfile();
  }, []);

  // Cleanup video streams and speech on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Proctoring Listener: Page Visibility & Window Blur
  useEffect(() => {
    if (!session || sessionCompleted || isTerminated) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerProctoringViolation("tab_switch");
      }
    };

    const handleBlur = () => {
      triggerProctoringViolation("window_blur");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [session, sessionCompleted, isTerminated]);

  const triggerProctoringViolation = async (type: ProctoringViolationEvent["type"]) => {
    if (!session || sessionCompleted || isTerminated) return;

    try {
      const res = await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "proctoring_violation",
          sessionId: session.id,
          type,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProctoringWarnings(data.session.proctoringViolations);
        setLastWarningType(
          type === "tab_switch"
            ? "Tab Switching / Application Switch Detected"
            : "Window Focus Lost"
        );
        setShowWarningModal(true);

        if (data.terminated) {
          setIsTerminated(true);
          setSessionCompleted(true);
          setSession(data.session);
        }
      }
    } catch {
      // Offline / local fallback
      const warningCount = proctoringWarnings.length + 1;
      const newViol: ProctoringViolationEvent = {
        id: `v_${Date.now()}`,
        type,
        timestamp: new Date().toISOString(),
        warningNumber: warningCount,
      };
      const updated = [...proctoringWarnings, newViol];
      setProctoringWarnings(updated);
      setLastWarningType(type === "tab_switch" ? "Tab Switch" : "Focus Lost");
      setShowWarningModal(true);

      if (warningCount >= 4) {
        setIsTerminated(true);
        setSessionCompleted(true);
      }
    }
  };

  // Device Check Request (Camera + Microphone)
  const runDeviceCheck = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
      setHasMicPermission(true);

      // Setup audio meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          if (!streamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
          requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch {
        setMicVolumeLevel(50);
      }

      setDeviceCheckCompleted(true);
    } catch (err) {
      console.warn("Device check failed:", err);
      setHasCameraPermission(false);
      setHasMicPermission(false);
      alert(
        "Camera and Microphone permissions are required for Live Video mode. Please allow access in your browser or switch to Text / MCQ mode."
      );
    }
  };

  // Web Speech API: Text to Speech
  const speakQuestion = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  // Web Speech API: Speech Recognition
  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return;

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      alert("Speech recognition is not supported in this browser. Please use the typed input box.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentAnswer((prev) => `${prev} ${transcript}`.trim());
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Start Session
  const handleStartSession = async () => {
    if (selectedMode === "live_video" && !deviceCheckCompleted) {
      await runDeviceCheck();
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          mode: selectedMode,
          role: selectedRole,
          company: selectedCompany,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start session.");
      }

      const newSession: InterviewSession = data.session;
      setSession(newSession);
      setCurrentQuestionIndex(0);
      setSessionCompleted(false);
      setIsTerminated(false);
      setProctoringWarnings([]);
      setCurrentAnswer("");
      setSelectedOptionIndex(null);

      // Start authoritative countdown for question 0
      const initialLimit = newSession.questions[0]?.timeLimitSeconds || 60;
      setTimeRemaining(initialLimit);
      setTimeSpentOnCurrent(0);

      // If mode 2, speak question
      if (selectedMode === "live_video" && newSession.questions[0]) {
        setTimeout(() => {
          speakQuestion(newSession.questions[0].question);
        }, 500);
      }
    } catch (err: any) {
      console.warn("Session creation API failed, falling back to local service:", err);
      const fallbackSession = await interviewService.createSession({
        userId: "guest",
        mode: selectedMode,
        role: selectedRole,
        company: selectedCompany,
      });
      setSession(fallbackSession);
      setCurrentQuestionIndex(0);
      setSessionCompleted(false);
      setIsTerminated(false);
      setProctoringWarnings([]);
      setTimeRemaining(fallbackSession.questions[0]?.timeLimitSeconds || 60);
      setTimeSpentOnCurrent(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timer Tick & Auto-Submit
  useEffect(() => {
    if (!session || sessionCompleted || isTerminated) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time expired -> auto-submit current answer
          handleAutoSubmitOnTimeout();
          return 0;
        }
        return prev - 1;
      });
      setTimeSpentOnCurrent((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, currentQuestionIndex, sessionCompleted, isTerminated, selectedOptionIndex, currentAnswer]);

  const handleAutoSubmitOnTimeout = () => {
    if (!session) return;
    const currentQ = session.questions[currentQuestionIndex];
    if (!currentQ) return;

    const answerToSubmit =
      currentQ.type === "mcq"
        ? selectedOptionIndex !== null
          ? selectedOptionIndex
          : -1 // Unanswered / timed out
        : currentAnswer.trim() || "[No response entered before time expired]";

    handleSubmitAnswer(answerToSubmit, true);
  };

  // Submit Answer Action
  const handleSubmitAnswer = async (explicitAnswer?: string | number, isAutoTimeout = false) => {
    if (!session || isSubmitting) return;

    const currentQ = session.questions[currentQuestionIndex];
    if (!currentQ) return;

    let answerVal = explicitAnswer;
    if (answerVal === undefined) {
      if (currentQ.type === "mcq") {
        if (selectedOptionIndex === null) {
          alert("Please select one of the options before submitting.");
          return;
        }
        answerVal = selectedOptionIndex;
      } else {
        if (!currentAnswer.trim()) {
          alert("Please speak or type your answer before submitting.");
          return;
        }
        answerVal = currentAnswer.trim();
      }
    }

    setIsSubmitting(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    try {
      const res = await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_answer",
          sessionId: session.id,
          questionId: currentQ.id,
          userAnswer: answerVal,
          timeSpentSeconds: timeSpentOnCurrent,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit answer.");
      }

      setSession(data.session);

      if (data.session.status === "completed") {
        setSessionCompleted(true);
      } else {
        // Advance to next question
        const nextIdx = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIdx);
        setCurrentAnswer("");
        setSelectedOptionIndex(null);
        setTimeSpentOnCurrent(0);
        const nextLimit = data.session.questions[nextIdx]?.timeLimitSeconds || 60;
        setTimeRemaining(nextLimit);

        if (selectedMode === "live_video" && data.session.questions[nextIdx]) {
          setTimeout(() => {
            speakQuestion(data.session.questions[nextIdx].question);
          }, 600);
        }
      }
    } catch (err) {
      console.warn("Submit API failed, running local submission:", err);
      const result = await interviewService.submitResponse({
        sessionId: session.id,
        questionId: currentQ.id,
        userAnswer: answerVal,
        timeSpentSeconds: timeSpentOnCurrent,
      });
      setSession(result.session);
      if (result.session.status === "completed") {
        setSessionCompleted(true);
      } else {
        const nextIdx = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIdx);
        setCurrentAnswer("");
        setSelectedOptionIndex(null);
        setTimeSpentOnCurrent(0);
        setTimeRemaining(result.session.questions[nextIdx]?.timeLimitSeconds || 60);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = session?.questions[currentQuestionIndex];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Header Breadcrumbs & Status */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Mock Interview 2.0
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              Private by Design
            </span>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Zero cloud recording &bull; Local streams
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW 1: SESSION SETUP / PRE-FLIGHT                           */}
        {/* ============================================================ */}
        {!session && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="max-w-3xl">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
                  Campus Placement & Enterprise Simulation
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Mock Interview 2.0 & Proctoring Engine
                </h1>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Practice high-frequency interview questions with authentic company attribution (Google, Microsoft, Amazon, Infosys, TCS, Wipro, Accenture). Test in authoritative timed MCQ mode or live WebRTC video simulation.
                </p>
              </div>

              {/* Mode Selection */}
              <div className="mt-8">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3">
                  Select Interview Mode:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Mode 1: Text / MCQ */}
                  <div
                    onClick={() => setSelectedMode("text_mcq")}
                    className={`cursor-pointer rounded-xl border-2 p-5 transition-all ${
                      selectedMode === "text_mcq"
                        ? "border-blue-600 bg-blue-50/50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Mode 1: Text / MCQ Exam</h3>
                          <span className="text-[11px] font-semibold text-blue-700">Authoritative Timed Questions</span>
                        </div>
                      </div>
                      {selectedMode === "text_mcq" && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Sequential timed questions with automatic submission on expiry.
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Page Visibility proctoring (tab switch & focus tracking).
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Instant evaluation & explanations post-session.
                      </li>
                    </ul>
                  </div>

                  {/* Mode 2: Live Video WebRTC */}
                  <div
                    onClick={() => setSelectedMode("live_video")}
                    className={`cursor-pointer rounded-xl border-2 p-5 transition-all ${
                      selectedMode === "live_video"
                        ? "border-blue-600 bg-blue-50/50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700">
                          <Video className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Mode 2: Live Video Simulation</h3>
                          <span className="text-[11px] font-semibold text-indigo-700">WebRTC + AI Voice Fallback</span>
                        </div>
                      </div>
                      {selectedMode === "live_video" && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Camera & microphone device pre-flight check.
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        SpeechSynthesis TTS voice prompts & real-time STT.
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        100% Local Browser processing & zero cloud recording.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Target Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Target Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {TARGET_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Target Company Question Bank
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value as InterviewCompany)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {TARGET_COMPANIES.map((company) => (
                      <option key={company} value={company}>
                        {company === "General" ? "General / Mixed Technical" : company}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Video Pre-flight Device Check Drawer */}
              {selectedMode === "live_video" && (
                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      Camera & Microphone Device Check
                    </span>
                    {!deviceCheckCompleted && (
                      <button
                        type="button"
                        onClick={runDeviceCheck}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        Run Device Check
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!hasCameraPermission && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                          <CameraOff className="w-8 h-8 mb-2" />
                          <span className="text-xs">Camera preview will appear here</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Camera Status:</span>
                        <span
                          className={`font-semibold ${
                            hasCameraPermission ? "text-emerald-600" : "text-slate-500"
                          }`}
                        >
                          {hasCameraPermission === null
                            ? "Not tested"
                            : hasCameraPermission
                            ? "✓ Operational"
                            : "✗ Blocked"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Microphone Status:</span>
                        <span
                          className={`font-semibold ${
                            hasMicPermission ? "text-emerald-600" : "text-slate-500"
                          }`}
                        >
                          {hasMicPermission === null
                            ? "Not tested"
                            : hasMicPermission
                            ? "✓ Operational"
                            : "✗ Blocked"}
                        </span>
                      </div>

                      {/* Mic Volume Meter */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>Audio Input Level</span>
                          <span>{micVolumeLevel}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-75"
                            style={{ width: `${micVolumeLevel}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Streams are bound locally. No raw audio or video is stored on any server.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Start Session CTA */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Authoritative timers enforced &bull; 4 proctoring warnings max
                </div>
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing Session...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Begin Interview Session
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: ACTIVE SESSION (QUESTION RUNNER)                     */}
        {/* ============================================================ */}
        {session && !sessionCompleted && currentQ && (
          <div className="space-y-6">
            {/* Top Session Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Question {currentQuestionIndex + 1} of {session.questions.length}
                </span>
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {currentQ.company}
                </span>
                <span className="text-xs text-slate-400">&bull;</span>
                <span className="text-xs font-medium text-slate-500 capitalize">
                  {currentQ.difficulty} Difficulty
                </span>
              </div>

              {/* Countdown Timer */}
              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono border ${
                    timeRemaining <= 15
                      ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {Math.floor(timeRemaining / 60)}:
                    {timeRemaining % 60 < 10 ? "0" : ""}
                    {timeRemaining % 60}
                  </span>
                </div>

                {/* Proctoring Warning Counter */}
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    proctoringWarnings.length > 0
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Warnings: {proctoringWarnings.length}/4</span>
                </div>
              </div>
            </div>

            {/* Main Question Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
              {/* Mode 2 Video Grid if active */}
              {session.mode === "live_video" && (
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Interviewer Stream (Simulated AI Avatar) */}
                  <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-300 overflow-hidden flex flex-col items-center justify-center text-white">
                    <div className="w-16 h-16 rounded-full bg-blue-600/30 border-2 border-blue-400 flex items-center justify-center mb-2">
                      <Sparkles className="w-8 h-8 text-blue-400" />
                    </div>
                    <span className="text-xs font-bold">Saarvi AI Technical Interviewer</span>
                    <span className="text-[10px] text-blue-300 mt-0.5">
                      {isSpeaking ? "Speaking Question..." : "Listening to Candidate..."}
                    </span>
                    <button
                      type="button"
                      onClick={() => speakQuestion(currentQ.question)}
                      className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs inline-flex items-center gap-1 transition"
                      title="Replay Voice Prompt"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Replay
                    </button>
                  </div>

                  {/* Candidate Local Video Feed */}
                  <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-300 overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                      Candidate Feed (Local)
                    </div>
                  </div>
                </div>
              )}

              {/* Question Text */}
              <div className="mb-6">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">
                  Question Prompt
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {currentQ.question}
                </h2>
              </div>

              {/* Question Body: Mode 1 MCQ */}
              {currentQ.type === "mcq" && currentQ.options && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Select the single best answer:
                  </label>
                  {currentQ.options.map((opt, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedOptionIndex(idx)}
                      className={`cursor-pointer rounded-xl border p-4 flex items-center justify-between transition-all ${
                        selectedOptionIndex === idx
                          ? "border-blue-600 bg-blue-50/60 font-semibold text-blue-950 shadow-2xs"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                            selectedOptionIndex === idx
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-sm">{opt}</span>
                      </div>
                      {selectedOptionIndex === idx && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Question Body: Freeform / Behavioral / Live Voice */}
              {currentQ.type !== "mcq" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600">
                      Your Technical or Behavioral Answer:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSpeechRecognition}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          isListening
                            ? "bg-red-50 text-red-700 border border-red-200 animate-pulse"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-3.5 h-3.5 text-red-600" />
                            Stop Mic
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-slate-600" />
                            Voice Dictation (STT)
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Speak into your microphone or type your response clearly using the STAR framework (Situation, Task, Action, Result)..."
                    className="w-full text-sm border border-slate-300 rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Target length: 50–200 words for comprehensive evaluation</span>
                    <span>{currentAnswer.trim().split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Question will auto-submit when timer expires
                </div>
                <button
                  type="button"
                  onClick={() => handleSubmitAnswer()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording Answer...
                    </>
                  ) : (
                    <>
                      Submit & Next Question
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: SESSION SCORECARD & RESULTS                          */}
        {/* ============================================================ */}
        {session && sessionCompleted && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                      isTerminated
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {isTerminated ? "Session Terminated by Proctor" : "Interview Completed"}
                  </span>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    Interview Evaluation & Performance Scorecard
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Role: <span className="font-semibold text-slate-700">{session.role}</span> &bull;
                    Company Bank: <span className="font-semibold text-slate-700">{session.targetCompany || "General"}</span> &bull;
                    Mode: <span className="font-semibold text-slate-700">{session.mode.replace("_", " ").toUpperCase()}</span>
                  </p>
                </div>

                {/* Overall Score Dial */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                  <Award className="w-8 h-8 text-blue-600" />
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {session.overallScore}
                      <span className="text-xs text-slate-400 font-normal"> / 100</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">Overall Score</div>
                  </div>
                </div>
              </div>

              {/* Proctoring Integrity Summary */}
              <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-lg ${
                      session.proctoringViolations.length === 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Proctoring Integrity: {session.proctoringViolations.length === 0 ? "Clean (100%)" : `${session.proctoringViolations.length} Warning(s) Logged`}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {session.proctoringViolations.length === 0
                        ? "No tab switches or fullscreen exits detected throughout this session."
                        : `Violations tracked: ${session.proctoringViolations.map((v) => v.type).join(", ")}.`}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-700">
                  Total Questions: {session.questions.length}
                </span>
              </div>

              {/* Breakdown by Question */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Detailed Turn Breakdown & Answers:
                </h3>

                {session.questions.map((q, idx) => {
                  const resp = session.responses[idx];
                  return (
                    <div
                      key={q.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">Q{idx + 1}.</span>
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {q.company} &bull; {q.type.toUpperCase()}
                          </span>
                        </div>
                        {resp && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              resp.score && resp.score >= 75
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            Score: {resp.score ?? 0}%
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 mb-2">{q.question}</h4>

                      {/* Your Answer */}
                      <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs space-y-1 my-2">
                        <span className="text-[11px] font-bold text-slate-500 block">Your Answer:</span>
                        <p className="text-slate-800 font-medium">
                          {q.type === "mcq" && q.options && typeof resp?.userAnswer === "number"
                            ? `${String.fromCharCode(65 + resp.userAnswer)}: ${q.options[resp.userAnswer] || "No selection"}`
                            : String(resp?.userAnswer || "No answer submitted.")}
                        </p>
                      </div>

                      {/* Correct / Ideal Answer */}
                      {q.explanation && (
                        <div className="text-xs text-slate-600 bg-blue-50/50 p-3 rounded-lg border border-blue-100 my-2">
                          <span className="font-bold text-blue-900 block mb-0.5">Explanation / Key Insight:</span>
                          <p>{q.explanation}</p>
                        </div>
                      )}

                      {/* Feedback & Tips */}
                      {resp?.feedback && (
                        <div className="mt-2 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">Evaluator Note: </span>
                          <span>{resp.feedback.notes}</span>
                          {resp.feedback.tips && resp.feedback.tips.length > 0 && (
                            <ul className="list-disc list-inside mt-1 text-[11px] text-slate-500">
                              {resp.feedback.tips.map((t, tidx) => (
                                <li key={tidx}>{t}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <Link
                  href="/student/dashboard"
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Return to Dashboard
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSession(null);
                    setSessionCompleted(false);
                    setIsTerminated(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Take Another Mock Interview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PROCTORING WARNING MODAL                                     */}
        {/* ============================================================ */}
        {showWarningModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-amber-200 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">Proctoring Warning Logged</h3>
                <p className="text-xs text-amber-800 font-medium mt-1">{lastWarningType}</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Navigating away from the interview tab or switching windows violates session integrity rules. You have accrued warning{" "}
                  <strong className="text-slate-900">{proctoringWarnings.length} of 4</strong>. Reaching 4 warnings will immediately terminate your session.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowWarningModal(false)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                >
                  Acknowledge & Return to Exam
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
