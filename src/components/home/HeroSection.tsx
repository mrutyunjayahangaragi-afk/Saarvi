"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  GraduationCap,
  Sparkles,
  Info,
  Lock,
  Download,
  UserCheck,
  FileText,
  FileImage,
  Briefcase,
  Search,
  CheckCircle2,
} from "lucide-react";
import CommandSearch from "@/components/tools/CommandSearch";

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<"tools" | "study" | "career" | "resume">("tools");
  const [isFocused, setIsFocused] = useState(false);

  // Listen for Saarvi Focus Mode event from hero search input
  useEffect(() => {
    const handleFocusMode = (e: any) => {
      setIsFocused(Boolean(e?.detail?.focused));
    };
    window.addEventListener("saarvi:hero-focus-mode", handleFocusMode);
    return () => window.removeEventListener("saarvi:hero-focus-mode", handleFocusMode);
  }, []);

  return (
    <section
      data-focus-mode={isFocused ? "true" : "false"}
      className="hero-section relative overflow-hidden pt-12 sm:pt-16 pb-16 sm:pb-20 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0b1329] transition-colors duration-200"
    >
      {/* ========================================================================= */}
      {/* 1. BOUNDED HERO AMBIENT LAYER (Sections 8, 9, 10)                        */}
      {/* Gradients and glows strictly bounded in absolute layer; never crosses UI */}
      {/* ========================================================================= */}
      <div className="hero-ambient-layer" aria-hidden="true">
        {/* Soft radial blue glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[380px] bg-gradient-to-tr from-blue-500/10 via-indigo-500/8 to-cyan-500/5 blur-[120px] rounded-full animate-ambient-drift" />
        
        {/* Subtle purple/cyan ambient gradient */}
        <div
          className="absolute bottom-8 right-1/4 w-[460px] h-[300px] bg-gradient-to-bl from-purple-500/8 via-cyan-500/6 to-transparent blur-[110px] rounded-full animate-ambient-drift"
          style={{ animationDelay: "-7s" }}
        />

        {/* Very faint background SaaS grid pattern */}
        <div className="absolute inset-0 bg-mesh-grid opacity-60 dark:opacity-20 pointer-events-none" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8 sm:space-y-10 text-center">

        {/* 2. HERO HEADER HIERARCHY */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Eyebrow / Philosophy */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold tracking-wide uppercase shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span>PRIVATE BY DESIGN • FAST BY DESIGN</span>
          </div>

          {/* Restrained, Professional Headline */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.12]">
              One workspace to <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent uppercase">
                study, work, and grow.
              </span>
            </h1>
            <p className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300">
              Your everyday tools. One simple workspace.
            </p>
          </div>

          {/* Grounded, Realistic Supporting Copy */}
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-2xl mx-auto">
            Saarvi brings everyday academic tools, document utilities, and career workflows into one focused workspace. Built around privacy, speed, and simplicity.
          </p>
        </div>

        {/* 3. ONE PRIMARY SEARCH EXPERIENCE (Section 1, 5, 20) */}
        {/* Dominant focal point of the viewport; zero competing search boxes */}
        <div className="w-full pt-1">
          <CommandSearch />
        </div>

        {/* 4. ACTION CTAs */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 sm:gap-4 transition-opacity duration-300 ${
            isFocused ? "opacity-60" : "opacity-100"
          }`}
        >
          <Link
            href="/tools"
            id="hero-explore-tools"
            className="group saarvi-btn-primary px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            <span>Explore Tools</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>

          <a
            href="#how-it-works"
            id="hero-see-how-works"
            className="saarvi-btn-secondary px-5 py-2.5 text-slate-700 dark:text-slate-300 hover:text-blue-600 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs transition-all cursor-pointer min-h-[44px] flex items-center gap-2"
          >
            <Info className="w-4 h-4 text-slate-400" />
            <span>See how it works</span>
          </a>
        </div>

        {/* 5. FEATURE HIGHLIGHTS (4 Product Principles Mini-Cards) */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left max-w-4xl mx-auto transition-opacity duration-300 ${
            isFocused ? "opacity-40" : "opacity-100"
          }`}
        >
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 flex items-start gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 transition-colors">Local processing</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block">Your files stay in your browser when supported.</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 flex items-start gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-800">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 transition-colors">Fast execution</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block">Process supported tools quickly in your browser.</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 flex items-start gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 transition-colors">Automatic download</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block">Get your output immediately upon completion.</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 flex items-start gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 transition-colors">No account required</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block">Use supported tools without signing up.</span>
            </div>
          </div>
        </div>

        {/* 6. REALISTIC SAARVI WORKSPACE COMPOSITION (Calm, Interactive, Zero Overlap) */}
        <div
          className={`max-w-4xl mx-auto pt-2 text-left transition-opacity duration-300 ${
            isFocused ? "opacity-35 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
            {/* Window Title Bar */}
            <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Saarvi Interactive Workspace
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Workspace</span>
              </div>
            </div>

            {/* Workspace Layout: Tabs + Work Area */}
            <div className="grid grid-cols-12 min-h-[260px] sm:min-h-[290px]">
              {/* Sidebar Navigation */}
              <div className="col-span-12 sm:col-span-4 bg-slate-50/70 dark:bg-slate-800/40 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800 p-3 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-2">
                  Workspaces
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("tools")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "tools"
                        ? "bg-white dark:bg-[#162244] text-blue-600 dark:text-blue-400 shadow-2xs border border-blue-200/80 dark:border-blue-700 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Tools</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("study")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "study"
                        ? "bg-white dark:bg-[#162244] text-purple-700 dark:text-purple-300 shadow-2xs border border-purple-200/80 dark:border-purple-700 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Study</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("career")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "career"
                        ? "bg-white dark:bg-[#162244] text-emerald-700 dark:text-emerald-300 shadow-2xs border border-emerald-200/80 dark:border-emerald-700 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Career</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("resume")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "resume"
                        ? "bg-white dark:bg-[#162244] text-blue-700 dark:text-blue-300 shadow-2xs border border-blue-200/80 dark:border-blue-700 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Resume</span>
                  </button>
                </div>
              </div>

              {/* Main View Area */}
              <div className="col-span-12 sm:col-span-8 p-4 flex flex-col justify-between">
                {activeTab === "tools" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Recent Tools</span>
                      <Link href="/tools" className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                        View all
                      </Link>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <FileImage className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">PDF to JPG</span>
                            <span className="text-[10px] text-slate-400">Client-side extraction</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Local
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">Merge PDF</span>
                            <span className="text-[10px] text-slate-400">Combine multiple files</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Local
                        </span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <Link
                        href="/tools"
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center block transition shadow-2xs"
                      >
                        Launch Document Utility
                      </Link>
                    </div>
                  </div>
                )}

                {activeTab === "study" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Academic Utilities</span>
                      <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">VTU Scheme 2022</span>
                    </div>

                    <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800 rounded-xl space-y-1 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">SGPA Calculator</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Verified university credits, F-grade credit preservation, and deterministic percentage calculation.
                      </p>
                    </div>

                    <div className="pt-1">
                      <Link
                        href="/student/sgpa-calculator"
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center block transition shadow-2xs"
                      >
                        Calculate SGPA
                      </Link>
                    </div>
                  </div>
                )}

                {activeTab === "career" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Unified Career Search</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">Live verified</span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100">Frontend Intern</span>
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                          Internship
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Bengaluru · Hybrid · 0–1 yrs</span>
                    </div>

                    <div className="pt-1">
                      <Link
                        href="/jobs"
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center block transition shadow-2xs"
                      >
                        Search Career Opportunities
                      </Link>
                    </div>
                  </div>
                )}

                {activeTab === "resume" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">ATS Resume Builder</span>
                      <span className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold">A4 Live Preview</span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">Modern ATS Template</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Structured typography, single-column parsing fidelity, and instant PDF vector export.
                      </p>
                    </div>

                    <div className="pt-1">
                      <Link
                        href="/student/resume"
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center block transition shadow-2xs"
                      >
                        Open Resume Builder
                      </Link>
                    </div>
                  </div>
                )}

                {/* Footer status bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Clean client environment</span>
                  <span>Saarvi Workspace</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
