"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Sparkles,
  X,
  Send,
  ExternalLink,
  ArrowRight,
  Bot,
  Lock,
  AlertCircle,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { ToolDiscoveryResult, DiscoveredToolItem } from '@/lib/ai/tool-discovery-engine';
import { isValidCanonicalRoute } from '@/lib/ai/ai-assistant-router';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  result?: ToolDiscoveryResult;
  timestamp: string;
}

const QUICK_PROMPTS = [
  'Where is SGPA Calculator?',
  'Where can I create a resume?',
  'Where is PDF to JPG?',
  'Show me Student Tools',
];

export default function GlobalAIAssistant() {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [hiddenByAdGate, setHiddenByAdGate] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am Saarvi AI. Ask me where to find any academic, PDF, image, or career tool.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputFieldRef = useRef<HTMLInputElement | null>(null);

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

  // Send message
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputValue).trim();
    if (!textToSend || isSearching) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInputValue('');
    setIsSearching(true);

    try {
      const res = await fetch('/api/ai/tool-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to search tools');
      }

      const result: ToolDiscoveryResult = data.result;

      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: result.reply,
        result,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: "I couldn't complete that search right now. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigate = (route: string) => {
    if (!isValidCanonicalRoute(route)) {
      console.warn('[GlobalAIAssistant] Blocked unverified route:', route);
      return;
    }
    setIsOpen(false);
    router.push(route);
  };

  // Do not render if suppressed by advertisement gate
  if (hiddenByAdGate) {
    return null;
  }

  return (
    <div
      className="fixed z-40"
      style={{
        right: 'max(20px, env(safe-area-inset-right))',
        bottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          ref={triggerButtonRef}
          onClick={() => setIsOpen(true)}
          aria-label="Saarvi AI Assistant"
          aria-expanded={isOpen}
          title="Saarvi AI Assistant — Ask where to find any tool"
          className="min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl hover:shadow-2xl flex items-center gap-2 font-bold text-xs transition-all duration-200 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 select-none group"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="tracking-tight hidden sm:inline">Saarvi AI</span>
        </button>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Saarvi AI Tool Finder"
          className="w-[360px] sm:w-[400px] max-w-[calc(100vw-32px)] h-[560px] max-h-[min(580px,calc(100vh-100px))] flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
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
                    Tools
                  </span>
                </div>
                <div className="text-[11px] text-blue-100">Ask me where to find any tool</div>
              </div>
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                triggerButtonRef.current?.focus();
              }}
              aria-label="Close Saarvi AI panel"
              className="p-1.5 rounded-lg hover:bg-white/20 text-blue-100 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
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
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-sm'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Tool Discovery Cards */}
                  {msg.result && msg.result.tools && msg.result.tools.length > 0 && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                      {msg.result.tools.map((tool) => (
                        <div
                          key={tool.key}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-200 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate">
                                {tool.name}
                              </div>
                              <div className="text-[10px] text-blue-600 font-medium">
                                {tool.categoryName}
                              </div>
                            </div>

                            {tool.requiresPro && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 shrink-0">
                                PRO
                              </span>
                            )}
                            {tool.isDisabled && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700 shrink-0">
                                UNAVAILABLE
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
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
                                onClick={() => handleNavigate('/pricing')}
                                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-xs transition-transform active:scale-95"
                              >
                                View Pro / Open Tool
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleNavigate(tool.route)}
                                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition-transform active:scale-95"
                              >
                                Open {tool.name}
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Category Route Button */}
                  {msg.result && msg.result.categoryRoute && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleNavigate(msg.result!.categoryRoute!)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                      >
                        Open {msg.result.categoryName || 'Category'}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isSearching && (
              <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Searching canonical tool registry...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[11px] font-medium transition-colors shrink-0"
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
            className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputFieldRef}
              type="text"
              placeholder="Ask: Where is SGPA Calculator?..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSearching}
              aria-label="Send query"
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
