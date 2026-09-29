"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  revealDestination,
  isElementInViewport,
  ActionState,
} from "@/lib/ux/action-destination";
import { ArrowDown, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ToolResultPanelProps {
  state: ActionState | "IDLE" | "PROCESSING" | "SUCCESS" | "ERROR" | "RESULT_READY";
  targetId?: string;
  error?: string | null;
  children: React.ReactNode;
  onRetry?: () => void;
  title?: string;
}

export default function ToolResultPanel({
  state,
  targetId = "tool-result",
  error,
  children,
  onRetry,
  title,
}: ToolResultPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [showJumpShortcut, setShowJumpShortcut] = useState(false);

  // Monitor off-screen visibility for the Innovation 82 shortcut ("Jump to result ↓")
  useEffect(() => {
    if (state !== "SUCCESS" && state !== "RESULT_READY") {
      setShowJumpShortcut(false);
      return;
    }

    const checkVisibility = () => {
      if (panelRef.current) {
        const visible = isElementInViewport(panelRef.current);
        setShowJumpShortcut(!visible);
      }
    };

    // Check after brief delay to allow layout to settle
    const timer = setTimeout(checkVisibility, 200);
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
    };
  }, [state]);

  const handleJumpToResult = () => {
    revealDestination({
      target: panelRef.current || `#${targetId}`,
      mode: "result",
      focus: true,
      behavior: "smooth",
      force: true,
    });
    setShowJumpShortcut(false);
  };

  if (state === "IDLE" || state === "PROCESSING") {
    return null;
  }

  if (state === "ERROR") {
    return (
      <div
        id="tool-error"
        data-saarvi-target="tool-error"
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        className="p-6 bg-rose-50 border border-rose-200 rounded-3xl space-y-4 animate-in fade-in duration-200 saarvi-destination-target outline-hidden"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-950">
              {title || "Processing Error"}
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed">
              {error || "An unexpected error occurred during processing. Please try again with a valid file."}
            </p>
          </div>
        </div>

        {onRetry && (
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Innovation 82: Floating "Jump to result ↓" button when offscreen */}
      {showJumpShortcut && (
        <div className="fixed top-20 right-6 z-30 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={handleJumpToResult}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg backdrop-blur-xs border border-blue-400/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Jump to generated result"
          >
            <span>Jump to result</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Target Result Container */}
      <div
        ref={panelRef}
        id={targetId}
        data-saarvi-target="tool-result"
        tabIndex={-1}
        className="saarvi-destination-target outline-hidden space-y-6"
      >
        {children}
      </div>
    </div>
  );
}
