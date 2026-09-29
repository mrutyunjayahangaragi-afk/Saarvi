"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  subscribeToOffscreenResults,
  OffscreenReadyDetail,
  revealDestination,
  resolveTargetElement,
  isElementInViewport,
} from "@/lib/ux/action-destination";
import { CheckCircle2, ArrowDown, X, Sparkles } from "lucide-react";

export default function SmartResultBanner() {
  const [activeNotice, setActiveNotice] = useState<OffscreenReadyDetail | null>(null);
  const [dismissedOpIds, setDismissedOpIds] = useState<Set<string>>(() => new Set());
  const bannerRef = useRef<HTMLDivElement>(null);

  // Subscribe to offscreen events
  useEffect(() => {
    const unsubscribe = subscribeToOffscreenResults((detail) => {
      if (dismissedOpIds.has(detail.operationId)) return;
      setActiveNotice(detail);
    });

    return () => {
      unsubscribe();
    };
  }, [dismissedOpIds]);

  // Auto-dismiss when the target element enters the viewport via user scrolling
  useEffect(() => {
    if (!activeNotice) return;

    const targetEl = resolveTargetElement(activeNotice.targetId);
    if (!targetEl) return;

    const checkVisibility = () => {
      if (isElementInViewport(targetEl)) {
        setActiveNotice(null);
      }
    };

    window.addEventListener("scroll", checkVisibility, { passive: true });
    return () => {
      window.removeEventListener("scroll", checkVisibility);
    };
  }, [activeNotice]);

  const handleViewResult = useCallback(() => {
    if (!activeNotice) return;

    revealDestination({
      target: activeNotice.targetId,
      mode: "result",
      focus: true,
      behavior: "smooth",
      force: true, // User intentionally requested reveal
    });

    setActiveNotice(null);
  }, [activeNotice]);

  const handleDismiss = useCallback(() => {
    if (!activeNotice) return;
    setDismissedOpIds((prev) => new Set(prev).add(activeNotice.operationId));
    setActiveNotice(null);
  }, [activeNotice]);

  if (!activeNotice) return null;

  return (
    <div
      ref={bannerRef}
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-2rem)] sm:w-auto animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/80 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="font-semibold text-white truncate">
              Your result is ready
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              {activeNotice.label || "Click to view output"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleViewResult}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <span>View Result</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss result notification"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
