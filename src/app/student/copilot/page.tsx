"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CopilotAction,
  CopilotContextCategory,
  CopilotResponse,
} from "@/types/copilot";
import { copilotService } from "@/lib/ai/copilot/copilot-service";
import { conversationService } from "@/lib/services/conversationService";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  CheckSquare,
  Bell,
  ArrowRight,
  Send,
  Loader2,
  RotateCcw,
  BookOpen,
  Briefcase,
  FileText,
  Clock,
  ExternalLink,
  MessageSquare,
  Layers,
  ChevronRight,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "copilot";
  content: string;
  responseMeta?: CopilotResponse;
  timestamp: string;
}

const QUICK_PROMPTS = [
  { label: "What is my current SGPA?", category: "academic" as CopilotContextCategory },
  { label: "What is my current attendance?", category: "academic" as CopilotContextCategory },
  { label: "Plan my study sessions for today", category: "productivity" as CopilotContextCategory },
  { label: "Review upcoming exams", category: "academic" as CopilotContextCategory },
  { label: "Which skills am I missing for my target role?", category: "career" as CopilotContextCategory },
  { label: "Prepare for upcoming interviews", category: "career" as CopilotContextCategory },
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});

  // Context Toggles (Data Minimization controls)
  const [enabledCategories, setEnabledCategories] = useState<CopilotContextCategory[]>([
    "academic",
    "productivity",
    "career",
    "conversation",
  ]);

  // Optional Document Context
  const [showDocModal, setShowDocModal] = useState(false);
  const [docSnippet, setDocSnippet] = useState("");
  const [docFilename, setDocFilename] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize fresh local conversation session
  useEffect(() => {
    async function initConversation() {
      try {
        const conv = await conversationService.createConversation("guest", "Copilot Session", [
          "copilot",
        ]);
        setConversationId(conv.id);
      } catch {
        // Fallback with timestamp ID
        setConversationId(`conv_${Date.now()}`);
      }
    }
    initConversation();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleCategory = (cat: CopilotContextCategory) => {
    setEnabledCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSend = async (queryText?: string) => {
    const query = (queryText || inputQuery).trim();
    if (!query || loading) return;

    setInputQuery("");
    const userMsgId = `usr_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await copilotService.executeQuery({
        query,
        enabledCategories,
        profileId: "guest",
        documentText: docSnippet ? docSnippet : undefined,
        documentFilename: docFilename ? docFilename : undefined,
        conversationId,
      });

      const copilotMsg: ChatMessage = {
        id: `cpl_${Date.now()}`,
        role: "copilot",
        content: response.message,
        responseMeta: response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `cpl_${Date.now()}`,
        role: "copilot",
        content: `Error: ${err?.message || "Unable to reach Copilot."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();

  const handleConfirmAction = async (action: CopilotAction) => {
    try {
      const result = await copilotService.confirmAndExecuteAction(action, "guest");
      setActionFeedback((prev) => ({
        ...prev,
        [action.id]: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
      }));
      // Force re-render of action status
      action.status = result.success ? "executed" : "suggested";
      if (result.success && result.data?.route) {
        setTimeout(() => {
          router.push(result.data.route);
        }, 800);
      }
    } catch (err: any) {
      setActionFeedback((prev) => ({
        ...prev,
        [action.id]: `❌ ${err?.message || "Action execution failed."}`,
      }));
    }
  };

  const handleDismissAction = (action: CopilotAction) => {
    action.status = "cancelled";
    setActionFeedback((prev) => ({
      ...prev,
      [action.id]: "Dismissed by user.",
    }));
  };

  const handleStartNewChat = async () => {
    setMessages([]);
    setActionFeedback({});
    try {
      const conv = await conversationService.createConversation("guest", "Copilot Session", [
        "copilot",
      ]);
      setConversationId(conv.id);
    } catch {
      setConversationId(`conv_${Date.now()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Saarvi AI Student & Career Copilot
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Unified Student & Career Copilot
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Ground your study schedules, academic queries, and career preparation in your verified local workspace records.
              </p>
            </div>

            {/* Quick Link to Mock Interview */}
            <div className="flex items-center gap-3">
              <Link
                href="/student/copilot/interview"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition shadow-sm"
              >
                <Briefcase className="w-4 h-4" />
                Mock Interview Coach
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                onClick={handleStartNewChat}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
                title="Start a fresh chat thread"
              >
                <RotateCcw className="w-4 h-4" />
                New Chat
              </button>
            </div>
          </div>

          {/* Privacy & Context Selection Bar */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Active Context Slices:</span>
              <span className="text-slate-400 font-normal">
                (Copilot only accesses enabled local data)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCategory("academic")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  enabledCategories.includes("academic")
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Academic
              </button>

              <button
                type="button"
                onClick={() => toggleCategory("productivity")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  enabledCategories.includes("productivity")
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Productivity
              </button>

              <button
                type="button"
                onClick={() => toggleCategory("career")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  enabledCategories.includes("career")
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Career
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleCategory("documents");
                  if (!docSnippet) setShowDocModal(true);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  enabledCategories.includes("documents")
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Document {docSnippet ? `(${docFilename || "Attached"})` : ""}
              </button>

              <button
                type="button"
                onClick={() => toggleCategory("conversation")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  enabledCategories.includes("conversation")
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Memory
              </button>
            </div>
          </div>
        </div>

        {/* Document Attachment Modal / Drawer */}
        {showDocModal && (
          <div className="bg-white border border-blue-200 rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Attach Local Document Snippet
                </h3>
              </div>
              <button
                onClick={() => setShowDocModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Paste text from notes, syllabus, or job descriptions. This is processed ephemerally and never synced to cloud.
            </p>
            <input
              type="text"
              placeholder="Document name (e.g. DBMS_Syllabus.pdf)"
              value={docFilename}
              onChange={(e) => setDocFilename(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg mb-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            <textarea
              rows={3}
              placeholder="Paste document text or notes here..."
              value={docSnippet}
              onChange={(e) => setDocSnippet(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
            />
            <div className="flex justify-end gap-2 mt-2">
              {docSnippet && (
                <button
                  type="button"
                  onClick={() => {
                    setDocSnippet("");
                    setDocFilename("");
                  }}
                  className="px-3 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  Clear Snippet
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!enabledCategories.includes("documents")) {
                    setEnabledCategories((prev) => [...prev, "documents"]);
                  }
                  setShowDocModal(false);
                }}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
              >
                Use Context
              </button>
            </div>
          </div>
        )}

        {/* Chat Stream Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[580px]">
          {/* Scrollable Message List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">
                  How can Copilot assist you today?
                </h2>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-6">
                  Ask verified academic questions, generate conflict-free study plans, evaluate attendance recovery, or prepare for placements.
                </p>

                {/* Quick Prompts Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full text-left">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(prompt.label)}
                      className="p-3 text-xs bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-blue-50/50 hover:border-blue-200 transition text-slate-700 flex items-center justify-between group shadow-2xs"
                    >
                      <span>{prompt.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-xl bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 text-sm shadow-xs">
                    {msg.content}
                    <div className="text-[10px] text-blue-200 text-right mt-1">
                      {msg.timestamp}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl w-full bg-slate-50/80 border border-slate-200/80 rounded-2xl rounded-tl-xs p-5 shadow-xs">
                    {/* Copilot Source Badge Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/60 text-xs">
                      <div className="flex items-center gap-2">
                        {msg.responseMeta?.isDeterministic ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Calculated by Saarvi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
                            <Sparkles className="w-3.5 h-3.5" />
                            AI-generated suggestion
                          </span>
                        )}

                        {msg.responseMeta?.contextUsed && msg.responseMeta.contextUsed.length > 0 && (
                          <span className="text-slate-400 text-[11px]">
                            via {msg.responseMeta.contextUsed.join(", ")}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                    </div>

                    {/* Copilot Message Body */}
                    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </div>

                    {/* Citations if available */}
                    {msg.responseMeta?.citations && msg.responseMeta.citations.length > 0 && (
                      <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-500">Grounded in:</span>
                        {msg.responseMeta.citations.map((cite, i) => (
                          <span
                            key={i}
                            className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600"
                          >
                            {cite}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Suggested Actions Preview Cards */}
                    {msg.responseMeta?.suggestedActions &&
                      msg.responseMeta.suggestedActions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
                          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            Proposed Actions (Confirmation Required):
                          </div>

                          {msg.responseMeta.suggestedActions.map((action) => (
                            <div
                              key={action.id}
                              className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5">
                                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 mt-0.5">
                                    {action.type === "create_study_session" && (
                                      <BookOpen className="w-4 h-4" />
                                    )}
                                    {action.type === "create_task" && (
                                      <CheckSquare className="w-4 h-4" />
                                    )}
                                    {action.type === "schedule_reminder" && (
                                      <Bell className="w-4 h-4" />
                                    )}
                                    {(action.type === "navigate_to_feature" || action.type === "open_tool") && (
                                      <ExternalLink className="w-4 h-4" />
                                    )}
                                    {action.type === "open_resume" && (
                                      <FileText className="w-4 h-4" />
                                    )}
                                    {action.type === "run_ats_check" && (
                                      <ShieldCheck className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900">
                                      {action.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {action.description}
                                    </p>
                                    {action.payload && (
                                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded-md border border-slate-100">
                                        {Boolean(action.payload.subject) && (
                                          <span>Subject: {String(action.payload.subject)}</span>
                                        )}
                                        {Boolean(action.payload.date) && (
                                          <span>Date: {String(action.payload.date)}</span>
                                        )}
                                        {Boolean(action.payload.startTime) && (
                                          <span>Time: {String(action.payload.startTime)}</span>
                                        )}
                                        {Boolean(action.payload.durationMinutes) && (
                                          <span>Duration: {String(action.payload.durationMinutes)}m</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    action.status === "executed"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : action.status === "cancelled"
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {action.status.toUpperCase()}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-xs text-slate-600">
                                  {actionFeedback[action.id] && (
                                    <span className="font-medium text-xs">
                                      {actionFeedback[action.id]}
                                    </span>
                                  )}
                                </div>

                                {action.status === "suggested" && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDismissAction(action)}
                                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                    >
                                      Dismiss
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmAction(action)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition shadow-xs"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Confirm & Save
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 max-w-sm text-xs text-slate-600">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span>Saarvi Copilot is analyzing your workspace context...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-4 bg-white border-t border-slate-200 rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about your SGPA, study plan, attendance recovery, or career goals..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                disabled={loading}
                className="flex-1 text-sm px-4 py-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 bg-slate-50/50"
              />
              <button
                type="submit"
                disabled={loading || !inputQuery.trim()}
                className="inline-flex items-center justify-center p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                title="Send message"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
              <span>
                Safety Invariant: Actions mutate workspace data only after you click [Confirm & Save].
              </span>
              <span>VTU 2022/2025 verified</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
