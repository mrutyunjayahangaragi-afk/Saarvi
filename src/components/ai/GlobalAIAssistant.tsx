"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  X,
  Send,
  ArrowRight,
  Bot,
  RotateCcw,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Download,
  FileText,
  AlertTriangle,
  ChevronLeft,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { ToolDiscoveryResult, DiscoveredToolItem } from '@/lib/ai/tool-discovery-engine';
import { isValidCanonicalRoute } from '@/lib/ai/ai-assistant-router';
import type { ActionIntentResult } from '@/lib/ai/orchestrator/types';
import { HealthLetterWorkflow } from '@/lib/ai/workflows/health-letter-workflow';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  result?: ToolDiscoveryResult;
  actionResult?: ActionIntentResult;
  suggestedChips?: string[];
  workflowType?: string;
  draftContent?: Record<string, unknown>;
  timestamp: string;
  isError?: boolean;
}

const QUICK_PROMPTS = [
  'Convert PDF to JPG',
  'Calculate SGPA',
  'Build a resume',
  'Compress a PDF',
];

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'assistant',
  text: "Hi! I'm Saarvi AI. I can help you find tools, understand Saarvi features, plan your studies, prepare for your career, and answer general questions. What would you like to work on?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

const STORAGE_KEY = 'saarvi_ai_chat_history';

export default function GlobalAIAssistant() {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [hiddenByAdGate, setHiddenByAdGate] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lastUserPrompt, setLastUserPrompt] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeWorkflowType, setActiveWorkflowType] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputFieldRef = useRef<HTMLInputElement | null>(null);

  // Load chat history from local browser storage on mount (zero cloud telemetry)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // Fallback to default
    }
  }, []);

  // Save chat history to local browser storage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
      } catch {
        // Storage limit protection
      }
    }
  }, [messages]);

  // Listen to advertisement gate state changes
  useEffect(() => {
    const handleAdState = (e: any) => {
      if (e.detail?.active) {
        setHiddenByAdGate(true);
        setIsOpen(false);
      } else {
        setHiddenByAdGate(false);
      }
    };

    window.addEventListener('saarvi:ad-state-changed', handleAdState);
    return () => window.removeEventListener('saarvi:ad-state-changed', handleAdState);
  }, []);

  const handleSendMessageRef = useRef<((queryText?: string) => Promise<void>) | null>(null);

  // Listen to open assistant custom event
  useEffect(() => {
    const handleOpenAssistant = (e: any) => {
      setIsOpen(true);
      if (e.detail?.query) {
        if (e.detail.autoSend && handleSendMessageRef.current) {
          handleSendMessageRef.current(e.detail.query);
        } else {
          setInputValue(e.detail.query);
        }
      }
    };

    window.addEventListener('saarvi:open-assistant', handleOpenAssistant);
    return () => window.removeEventListener('saarvi:open-assistant', handleOpenAssistant);
  }, []);

  // Keyboard support: Escape closes panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputFieldRef.current?.focus(), 100);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen]);

  // Scroll messages to bottom on update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clear chat history
  const handleClearChat = () => {
    setActiveWorkflowType(null);
    setMessages([
      {
        ...INITIAL_MESSAGE,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Send message or workflow step
  const handleSendMessage = async (
    queryText?: string,
    workflowOpts?: {
      workflowAction?: 'start' | 'advance' | 'step_back' | 'cancel' | 'edit';
      workflowType?: string;
      stepAnswer?: unknown;
      fieldKey?: string;
    }
  ) => {
    const textToSend = (queryText !== undefined ? queryText : inputValue).trim();
    if (!textToSend && !workflowOpts && !isSearching) return;
    if (isSearching) return;

    if (textToSend) {
      setLastUserPrompt(textToSend);
      const userMessage: ChatMessage = {
        id: `usr_${Date.now()}`,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    if (!queryText && queryText === undefined) setInputValue('');
    setIsSearching(true);

    try {
      const payload: Record<string, unknown> = {
        message: textToSend || (workflowOpts?.workflowAction ? 'Workflow action' : ''),
      };

      if (workflowOpts) {
        payload.workflowAction = workflowOpts.workflowAction;
        payload.workflowType = workflowOpts.workflowType || activeWorkflowType;
        payload.stepAnswer = workflowOpts.stepAnswer !== undefined ? workflowOpts.stepAnswer : textToSend;
        payload.fieldKey = workflowOpts.fieldKey;
      } else if (activeWorkflowType) {
        payload.workflowAction = 'advance';
        payload.workflowType = activeWorkflowType;
        payload.stepAnswer = textToSend;
      }

      const res = await fetch('/api/ai/tool-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process request');
      }

      const actionResult: ActionIntentResult | undefined = data.actionResult;
      const result: ToolDiscoveryResult = data.result || {
        type: 'NO_MATCH',
        reply: data.reply || 'Here is what I found.',
      };

      if (actionResult?.intent === 'HEALTH_LEAVE_LETTER' && actionResult.workflowStatus === 'needs_clarification') {
        setActiveWorkflowType('health_leave_letter');
      } else if (actionResult?.intent === 'CAREER_SEARCH' && actionResult.workflowStatus === 'needs_clarification') {
        setActiveWorkflowType('career_search');
      } else if (actionResult?.workflowStatus === 'completed' || actionResult?.workflowStatus === 'cancelled') {
        setActiveWorkflowType(null);
      }

      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: data.reply || result.reply,
        result,
        actionResult,
        suggestedChips: data.suggestedChips || actionResult?.suggestedChips,
        draftContent: data.draftContent || actionResult?.draftContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text:
          "Saarvi AI is temporarily unavailable, but I can still help you find Saarvi tools. Please try again or ask for PDF, Image, Student, or Career utilities.",
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };
  handleSendMessageRef.current = handleSendMessage;

  const handleDownloadPdf = async (draftText: string) => {
    if (!draftText || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const bytes = await HealthLetterWorkflow.createDraftPdf(draftText);
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saarvi_leave_letter_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleStepBack = () => {
    if (activeWorkflowType) {
      handleSendMessage('', { workflowAction: 'step_back', workflowType: activeWorkflowType });
    }
  };

  const handleCancelWorkflow = () => {
    if (activeWorkflowType) {
      handleSendMessage('', { workflowAction: 'cancel', workflowType: activeWorkflowType });
      setActiveWorkflowType(null);
    }
  };


  // Retry last query
  const handleRetry = () => {
    if (lastUserPrompt) {
      handleSendMessage(lastUserPrompt);
    }
  };

  // Navigate to verified route with safe analytics tracking
  const handleNavigate = (route: string, toolId?: string) => {
    if (!isValidCanonicalRoute(route)) {
      console.warn('[GlobalAIAssistant] Blocked unverified route:', route);
      return;
    }

    // Telemetry dispatch: AI_TOOL_OPEN (strictly safe metadata; zero private user content)
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'AI_TOOL_OPEN',
          toolId: toolId || route.replace(/^\/(tools|student|career)\//, ''),
          metadata: { source: 'ai_assistant', route },
        }),
      }).catch(() => {});
    } catch {}

    setIsOpen(false);
    router.push(route);
  };

  // Do not render if suppressed by advertisement gate
  if (hiddenByAdGate) {
    return null;
  }

  return (
    <div
      className="fixed z-40 right-4 md:right-6 bottom-[calc(env(safe-area-inset-bottom,0px)+68px)] md:bottom-[max(20px,env(safe-area-inset-bottom))]"
    >
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="saarvi-ai-ring-wrapper group">
          <button
            ref={triggerButtonRef}
            onClick={() => setIsOpen(true)}
            aria-label="Open Saarvi AI"
            aria-expanded={isOpen}
            title="Saarvi AI Assistant — Study. Work. Grow."
            className="relative z-1 min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2 font-bold text-xs transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white select-none cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="tracking-tight hidden sm:inline">Saarvi AI</span>
          </button>
        </div>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Saarvi AI Assistant"
          className="w-[360px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[580px] max-h-[min(600px,calc(100vh-100px))] flex flex-col bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 select-none"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                  <span>Saarvi AI</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-white/20 text-white">
                    2.0
                  </span>
                </div>
                <div className="text-[11px] text-blue-100">
                  Study. Work. Grow.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                aria-label="Clear chat history"
                title="Clear chat history"
                className="p-1.5 rounded-lg hover:bg-white/20 text-blue-100 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  triggerButtonRef.current?.focus();
                }}
                aria-label="Close Saarvi AI panel"
                className="p-1.5 rounded-lg hover:bg-white/20 text-blue-100 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-[#0b1329]/70">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs shadow-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : msg.isError
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-bl-sm'
                      : 'bg-white dark:bg-[#162244] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Copy button for assistant responses */}
                  {msg.sender === 'assistant' && !msg.isError && (
                    <div className="mt-2 pt-1.5 flex justify-end border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          setCopiedMessageId(msg.id);
                          setTimeout(() => setCopiedMessageId(null), 2000);
                        }}
                        aria-label="Copy response"
                        title="Copy response"
                        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Retry action for error state */}
                  {msg.isError && lastUserPrompt && (
                    <div className="mt-2.5 pt-2 border-t border-red-200/60 dark:border-red-900/60 flex justify-end">
                      <button
                        onClick={handleRetry}
                        disabled={isSearching}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {/* Tool Discovery Cards */}
                  {msg.result?.tools && msg.result.tools.length > 0 ? (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {msg.result.tools.map((tool) => (
                        <div
                          key={tool.key}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                {tool.name}
                              </div>
                              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                {tool.categoryName}
                              </div>
                            </div>

                            {tool.requiresPro && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0">
                                PRO
                              </span>
                            )}
                            {tool.isDisabled && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                                UNAVAILABLE
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {tool.description}
                          </p>

                          {/* Navigation Action Button */}
                          <div className="mt-2.5 flex items-center justify-end">
                            {tool.isDisabled ? (
                              <span className="text-[11px] text-slate-400 italic">
                                Currently unavailable
                              </span>
                            ) : tool.requiresPro ? (
                              <button
                                onClick={() => handleNavigate('/pricing', tool.key)}
                                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
                              >
                                View Pro / Open Tool
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleNavigate(tool.route, tool.key)}
                                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
                              >
                                Open {tool.name}
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Category Route Button */}
                  {msg.result?.categoryRoute ? (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => handleNavigate(msg.result!.categoryRoute!)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Open {msg.result.categoryName || 'Category'}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}

                  {/* Leave Letter Draft Preview Card */}
                  {typeof msg.draftContent?.draftText === 'string' ? (
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span>Truthful Leave Request Draft</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          Local Draft
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#162244] border border-slate-200/80 dark:border-slate-800 text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed text-slate-700 dark:text-slate-200">
                        {String(msg.draftContent.draftText)}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400">Zero cloud storage • 100% private</span>
                        <button
                          onClick={() => handleDownloadPdf(String(msg.draftContent!.draftText))}
                          disabled={isDownloadingPdf}
                          className="min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Recommended Opportunities Cards */}
                  {Array.isArray((msg.draftContent as any)?.opportunities) && ((msg.draftContent as any).opportunities as any[]).length > 0 ? (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                        <span>Recommended Opportunities:</span>
                      </div>
                      {((msg.draftContent as any).opportunities as any[]).map((opp: any) => (
                        <div
                          key={opp.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs truncate">{opp.title}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">{opp.company} • {opp.location}</div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 shrink-0">
                              {opp.opportunityType}
                            </span>
                          </div>
                          <div className="mt-1.5 text-[10px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/40 p-1.5 rounded-md border border-slate-200/50 dark:border-slate-800">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">Match Factor: </span>
                            {opp.explanation?.explanationSummary}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Source: {opp.source}</span>
                            <button
                              onClick={() => handleNavigate('/jobs', 'job-tracker')}
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                            >
                              <span>View in Jobs Hub</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Academic Calculation Result Card */}
                  {typeof msg.draftContent?.breakdown === 'string' ? (
                    <div className="mt-3 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                        <span>Verified Academic Result</span>
                      </div>
                      <div className="text-[11px] whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
                        {String(msg.draftContent.breakdown)}
                      </div>
                    </div>
                  ) : null}

                  {/* Suggested Answer Chips */}
                  {msg.suggestedChips && msg.suggestedChips.length > 0 ? (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                      {msg.suggestedChips.map((chip, chipIdx) => (
                        <button
                          key={chipIdx}
                          onClick={() => handleSendMessage(chip)}
                          className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 text-[11px] font-medium transition active:scale-95 cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Active Workflow Controls */}
                  {activeWorkflowType && msg === messages[messages.length - 1] ? (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <button
                        onClick={handleStepBack}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous Step</span>
                      </button>
                      <button
                        onClick={handleCancelWorkflow}
                        className="text-red-500 hover:text-red-700 font-medium cursor-pointer"
                      >
                        Cancel Workflow
                      </button>
                    </div>
                  ) : null}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isSearching && (
              <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts Chips */}
          <div className="px-3 py-2 bg-white dark:bg-[#111c38] border-t border-slate-100 dark:border-slate-800 overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white dark:bg-[#111c38] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputFieldRef}
              type="text"
              placeholder="Ask Saarvi AI..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSearching}
              aria-label="Send query"
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
