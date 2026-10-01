"use client";

import { useState } from "react";
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
  CheckCircle2,
  Search,
  Layers,
  ChevronRight,
} from "lucide-react";

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<"tools" | "study" | "career" | "resume">("tools");

  return (
    <section className="relative overflow-hidden py-14 sm:py-20 border-b border-slate-200/80 bg-white bg-mesh-grid">
      {/* Background Subtle Radial Gradients */}
      <div
        className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] bg-gradient-to-tr from-blue-500/10 to-indigo-500/5 blur-[120px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-1/4 w-[420px] h-[320px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left Column: Product Value Proposition & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Eyebrow / Philosophy */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-semibold tracking-wide uppercase shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              <span>PRIVATE BY DESIGN • FAST BY DESIGN</span>
            </div>

            {/* Restrained, Professional Headline */}
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                One workspace to <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent uppercase">
                  study, work, and grow.
                </span>
              </h1>
              <p className="text-base sm:text-lg font-bold text-slate-700">
                Your everyday tools. One simple workspace.
              </p>
            </div>

            {/* Grounded, Realistic Supporting Copy */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-xl">
              Saarvi brings everyday academic tools, document utilities, and career workflows into one focused workspace. Built around privacy, speed, and simplicity.
            </p>

            {/* Action CTAs */}
            <div className="pt-1 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                href="/tools"
                id="hero-explore-tools"
                className="group saarvi-btn-primary px-6 py-3 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer min-h-[46px]"
              >
                <span>Explore Tools</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>

              <a
                href="#how-it-works"
                id="hero-see-how-works"
                className="saarvi-btn-secondary px-5 py-3 text-slate-700 hover:text-blue-600 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer min-h-[46px] flex items-center gap-2"
              >
                <Info className="w-4 h-4 text-slate-400" />
                <span>See how it works</span>
              </a>
            </div>

            {/* Feature Highlights: 4 Mini Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200 flex items-start gap-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-700 transition-colors">Local processing</span>
                  <span className="text-[11px] text-slate-500 leading-tight block">Your files stay in your browser when supported.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200 flex items-start gap-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-700 transition-colors">Fast execution</span>
                  <span className="text-[11px] text-slate-500 leading-tight block">Process supported tools quickly in your browser.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200 flex items-start gap-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-700 transition-colors">Automatic download</span>
                  <span className="text-[11px] text-slate-500 leading-tight block">Get your output immediately upon completion.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200 flex items-start gap-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-700 transition-colors">No account required</span>
                  <span className="text-[11px] text-slate-500 leading-tight block">Use supported tools without signing up.</span>
                </div>
              </div>
            </div>

            {/* Honest Privacy Architecture Statement */}
            <div className="pt-1">
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-lg">
                Many Saarvi tools process files locally in your browser. Tools that require server-side functionality clearly indicate when data is sent to our servers.
              </p>
            </div>
          </div>

          {/* Right Column: Realistic Saarvi Workspace Composition (Zero Fake Latencies) */}
          <div className="lg:col-span-6 relative hidden lg:block animate-float-subtle">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">

              {/* Window Title Bar */}
              <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  Saarvi Interactive Workspace
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active Workspace</span>
                </div>
              </div>

              {/* Workspace Layout: Compact Sidebar + Main Work Area */}
              <div className="grid grid-cols-12 min-h-[340px]">

                {/* Sidebar Navigation */}
                <div className="col-span-4 bg-slate-50/70 border-r border-slate-100 p-3 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-2">
                    Workspaces
                  </span>

                  <button
                    type="button"
                    onClick={() => setActiveTab("tools")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "tools"
                        ? "bg-white text-blue-600 shadow-2xs border border-blue-200/80 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tools</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("study")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "study"
                        ? "bg-white text-purple-700 shadow-2xs border border-purple-200/80 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                    <span>Study</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("career")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "career"
                        ? "bg-white text-emerald-700 shadow-2xs border border-emerald-200/80 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Career</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("resume")}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeTab === "resume"
                        ? "bg-white text-blue-700 shadow-2xs border border-blue-200/80 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>Resume</span>
                  </button>
                </div>

                {/* Main View Area */}
                <div className="col-span-8 p-4 flex flex-col justify-between">
                  {activeTab === "tools" && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Recent Tools</span>
                        <Link href="/tools" className="text-[10px] text-blue-600 font-semibold hover:underline">
                          View all
                        </Link>
                      </div>

                      <div className="space-y-2">
                        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileImage className="w-4 h-4 text-blue-600" />
                            <div>
                              <span className="font-semibold text-slate-800 block">PDF to JPG</span>
                              <span className="text-[10px] text-slate-400">Client-side extraction</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Local
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-teal-600" />
                            <div>
                              <span className="font-semibold text-slate-800 block">Merge PDF</span>
                              <span className="text-[10px] text-slate-400">Combine multiple files</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Local
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
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
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Academic Utilities</span>
                        <span className="text-[10px] text-purple-700 font-semibold">VTU Scheme 2022</span>
                      </div>

                      <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl space-y-1 text-xs">
                        <span className="font-semibold text-slate-800 block">SGPA Calculator</span>
                        <p className="text-[11px] text-slate-500">
                          Verified university credits, F-grade credit preservation, and deterministic percentage calculation.
                        </p>
                      </div>

                      <div className="pt-2">
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
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Unified Career Search</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">Live verified</span>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">Frontend Intern</span>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Internship
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">Bengaluru · Hybrid · 0–1 yrs</span>
                      </div>

                      <div className="pt-2">
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
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">ATS Resume Builder</span>
                        <span className="text-[10px] text-blue-700 font-semibold">A4 Live Preview</span>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                        <span className="font-bold text-slate-900 block">Modern ATS Template</span>
                        <p className="text-[11px] text-slate-500">
                          Structured typography, single-column parsing fidelity, and instant PDF vector export.
                        </p>
                      </div>

                      <div className="pt-2">
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
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Clean client environment</span>
                    <span>Saarvi Workspace</span>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
