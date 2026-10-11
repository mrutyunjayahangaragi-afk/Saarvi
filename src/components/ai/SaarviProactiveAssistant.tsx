"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, ArrowRight, Bot, ShieldCheck } from "lucide-react";

interface ContextualChip {
  label: string;
  query: string;
}

const INACTIVITY_DELAY_MS = 5000;
const WELCOMED_KEY = "saarvi_proactive_welcomed";
const DISMISSED_KEY = "saarvi_proactive_dismissed";

export default function SaarviProactiveAssistant() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check route eligibility: suppress on admin, auth flows
  const isExcludedRoute = useCallback((path: string): boolean => {
    if (!path) return false;
    if (path.startsWith("/admin")) return true;
    if (path === "/login" || path === "/signup" || path.startsWith("/auth")) return true;
    return false;
  }, []);

  // Determine contextual action chips based on route
  const getContextualChips = useCallback((path: string): ContextualChip[] => {
    if (path.startsWith("/student/resume")) {
      return [
        { label: "Score my resume for ATS", query: "Score my resume for ATS" },
        { label: "Draft a matching cover letter", query: "Draft a matching cover letter" },
        { label: "Find roles matching my resume", query: "Find software jobs for my resume" },
      ];
    }
    if (path.startsWith("/student")) {
      return [
        { label: "Calculate semester SGPA", query: "Calculate my semester SGPA" },
        { label: "Calculate cumulative CGPA", query: "Calculate my cumulative CGPA" },
        { label: "Estimate target exam marks", query: "Estimate target exam marks" },
        { label: "Convert percentage to CGPA", query: "Convert percentage to CGPA" },
      ];
    }
    if (path.startsWith("/jobs") || path.startsWith("/career")) {
      return [
        { label: "Search internships", query: "Search software internships" },
        { label: "Audit resume for ATS", query: "Audit my resume for ATS" },
        { label: "Interview coach", query: "Start AI mock interview practice" },
        { label: "Draft cold email", query: "Draft a cold outreach email" },
      ];
    }
    if (path.startsWith("/tools") || path.startsWith("/pdf") || path.startsWith("/image")) {
      return [
        { label: "Compress a PDF", query: "Compress a PDF" },
        { label: "Merge multiple PDFs", query: "Merge multiple PDFs" },
        { label: "OCR scanned document", query: "OCR scanned document" },
        { label: "Convert PDF to JPG", query: "Convert PDF to JPG" },
      ];
    }
    // Default homepage chips
    return [
      { label: "Compress or convert a PDF", query: "Compress a PDF" },
      { label: "Calculate SGPA / CGPA", query: "Calculate my SGPA" },
      { label: "Find internships & jobs", query: "Search developer internships" },
      { label: "Draft a medical leave letter", query: "Draft a medical leave letter" },
    ];
  }, []);

  // Set up 5-second inactivity timer and user interaction cancellations
  useEffect(() => {
    // Check if running on browser
    if (typeof window === "undefined") return;

    // Check session storage persistence
    try {
      const alreadyWelcomed = sessionStorage.getItem(WELCOMED_KEY) === "true";
      const alreadyDismissed = sessionStorage.getItem(DISMISSED_KEY) === "true";
      if (alreadyWelcomed || alreadyDismissed) {
        return;
      }
    } catch {
      // Storage unavailable fallback
    }

    // Excluded routes
    if (isExcludedRoute(pathname)) {
      return;
    }

    // Any meaningful user interaction cancels the proactive prompt immediately
    const handleMeaningfulInteraction = () => {
      setHasInteracted(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const interactionEvents: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "scroll",
      "wheel",
      "focusin",
      "dragenter",
    ];

    interactionEvents.forEach((evt) => {
      window.addEventListener(evt, handleMeaningfulInteraction, { passive: true, once: true });
    });

    // Start 5-second inactivity window
    timerRef.current = setTimeout(() => {
      // Re-verify modal dialog is not present
      const modalOpen = Boolean(document.querySelector('[role="dialog"]'));
      if (!modalOpen && !hasInteracted && !isExcludedRoute(pathname)) {
        setIsVisible(true);
        try {
          sessionStorage.setItem(WELCOMED_KEY, "true");
        } catch {}
      }
    }, INACTIVITY_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      interactionEvents.forEach((evt) => {
        window.removeEventListener(evt, handleMeaningfulInteraction);
      });
    };
  }, [pathname, isExcludedRoute, hasInteracted]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch {}
  };

  const handleTriggerAction = (queryText: string) => {
    handleDismiss();
    window.dispatchEvent(
      new CustomEvent("saarvi:open-assistant", {
        detail: {
          query: queryText,
          autoSend: true,
        },
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;
    handleTriggerAction(query);
  };

  if (!isVisible) return null;

  const chips = getContextualChips(pathname);

  return (
    <div
      role="region"
      aria-label="Saarvi AI Welcome Assistant"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 rounded-3xl border border-blue-200/90 dark:border-blue-900/80 bg-white/95 dark:bg-[#101b3b]/95 backdrop-blur-md shadow-2xl p-5 text-slate-900 dark:text-white transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Saarvi AI</span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/60 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                Action Assistant
              </span>
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>Private & Fast</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss welcome assistant"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Message Body */}
      <div className="py-3 space-y-2">
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          Hi! Looking for something specific? Describe your goal in natural language or pick a quick action below:
        </p>

        {/* Natural Language Prompt Input */}
        <form onSubmit={handleSubmit} className="relative mt-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g. Compress 10MB PDF, calculate SGPA..."
            aria-label="Ask Saarvi AI"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 pl-3.5 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            aria-label="Send query"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors cursor-pointer"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>

      {/* Contextual Chips */}
      <div className="pt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Suggested Actions
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
          {chips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleTriggerAction(chip.query)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:border-blue-300 dark:hover:border-blue-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-all cursor-pointer text-left"
            >
              <Bot className="h-3 w-3 text-blue-500 shrink-0" />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer / Dismiss Note */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer font-medium"
        >
          Maybe later
        </button>
        <button
          onClick={() => {
            handleDismiss();
            window.dispatchEvent(
              new CustomEvent("saarvi:open-assistant", {
                detail: {},
              })
            );
          }}
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
        >
          Open Assistant
        </button>
      </div>
    </div>
  );
}
