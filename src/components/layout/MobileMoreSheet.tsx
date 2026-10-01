"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  X,
  GraduationCap,
  Sparkles,
  Briefcase,
  Layers,
  Bell,
  Settings,
  Shield,
  HelpCircle,
  MessageSquare,
  FileText,
  ChevronRight,
  Calculator,
  Compass,
} from "lucide-react";
import { useFeedback } from "@/context/FeedbackContext";

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMoreSheet({ isOpen, onClose }: MobileMoreSheetProps) {
  const { openFeedback } = useFeedback();

  // Escape key and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="More Navigation"
      className="fixed inset-0 z-50 md:hidden flex flex-col justify-end animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        className="relative w-full max-h-[85vh] bg-white dark:bg-[#0c1322] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 z-10"
        style={{
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
        }}
      >
        {/* Sheet Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Explore More Saarvi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close more navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Groups */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* GROUP 1: EXPLORE & STUDENT PRODUCTIVITY */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Explore &amp; Utilities
            </span>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 overflow-hidden">
              <Link
                href="/student"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Student Utilities
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Calculators, syllabus, assignments &amp; notes
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                    Popular
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>

              <Link
                href="/pricing"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Plans &amp; Upgrades
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Saarvi Pro for ₹99/mo or ₹899/yr
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                    Pro
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>

              <Link
                href="/career"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Career Resources
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Resume builder, skill gap analysis &amp; interview prep
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                    Updated
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>

              <Link
                href="/student/sgpa-calculator"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Academic Calculators
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      VTU SGPA, CGPA &amp; Marks converter
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* GROUP 2: ACCOUNT & NOTIFICATIONS */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Account &amp; Activity
            </span>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 overflow-hidden">
              <Link
                href="/notifications"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold">Notification Center</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href="/dashboard/settings"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-semibold">Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href="/privacy"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold">Privacy Policy</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* GROUP 3: SUPPORT & FEEDBACK */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Help &amp; Support
            </span>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 overflow-hidden">
              <Link
                href="/contact"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold">Help &amp; Documentation</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  openFeedback();
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px] text-left"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-semibold">Share Feedback</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <Link
                href="/terms"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-semibold">Terms of Service</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
