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
  Check,
  CheckCircle2,
} from "lucide-react";

export default function HeroSection() {
  const [activePreviewTab, setActivePreviewTab] = useState<"pdf" | "academic" | "resume">("pdf");

  return (
    <section className="relative overflow-hidden py-14 sm:py-20 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40">
      {/* Background Subtle Radial Light & Mesh Grid */}
      <div
        className="absolute inset-0 bg-mesh-grid pointer-events-none opacity-40"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[400px] bg-blue-500/8 blur-[130px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-10 w-[320px] h-[260px] bg-indigo-500/5 blur-[90px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Product Value Proposition & CTAs */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-7 text-left">
            {/* Eyebrow / Philosophy */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold tracking-wide uppercase shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>PRIVATE BY DESIGN • FAST BY DESIGN</span>
            </div>

            {/* Large Authoritative Headline */}
            <div className="space-y-2.5">
              <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
                Everything you need to <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500">
                  study, work and grow.
                </span>
              </h1>
              <p className="text-lg sm:text-xl font-bold text-slate-700">
                Your everyday tools. One simple workspace.
              </p>
            </div>

            {/* Self-Explanatory Subheadline */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-xl">
              Saarvi brings together client-side document tools, university-grade student utilities, and career builders into one privacy-focused platform. Convert files, calculate semester grades, and build professional resumes without complexity.
            </p>

            {/* Action CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5 sm:gap-4">
              <Link
                href="/tools"
                id="hero-explore-tools"
                className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2.5 group cursor-pointer min-h-[44px]"
              >
                <span>Explore Tools</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#how-it-works"
                id="hero-see-how-works"
                className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold rounded-2xl border border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer min-h-[44px] flex items-center gap-2"
              >
                <Info className="w-4 h-4 text-slate-500" />
                <span>See How Saarvi Works</span>
              </a>
            </div>

            {/* Micro Trust Indicators */}
            <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Lock className="w-4 h-4 text-emerald-600" />
                Local processing
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="w-4 h-4 text-amber-500" />
                Fast browser processing
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Download className="w-4 h-4 text-blue-600" />
                Automatic download
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <UserCheck className="w-4 h-4 text-purple-600" />
                No account required
              </span>
            </div>

            {/* Honest Privacy Value Statement */}
            <div className="pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Your supported documents can stay on your device with our local-first tools.</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Simulated Saarvi Workspace Preview */}
          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
              {/* Window Title Bar */}
              <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                </div>
                <span className="text-[11px] font-bold text-slate-500 font-mono">
                  Saarvi Interactive Workspace
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Local Engine Active
                </span>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50/40 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab("pdf")}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePreviewTab === "pdf"
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>PDF to JPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab("academic")}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePreviewTab === "academic"
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>VTU SGPA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab("resume")}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePreviewTab === "resume"
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Resume 2.0</span>
                </button>
              </div>

              {/* Preview Body */}
              <div className="p-5 space-y-4">
                {activePreviewTab === "pdf" && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <div className="p-4 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 text-center space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 block">
                        lecture_notes_module_3.pdf (2.4 MB)
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Ready for instant extraction • 12 Pages Detected
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold">Converted in 0.38s</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono">0 bytes sent to server</span>
                    </div>

                    <Link
                      href="/tools/pdf-to-jpg"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center block transition shadow-xs cursor-pointer"
                    >
                      Try PDF to JPG Free
                    </Link>
                  </div>
                )}

                {activePreviewTab === "academic" && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">VTU 2022 Scheme • 6th Sem</span>
                        <span className="text-blue-600 font-mono">CS &amp; Engineering</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-200/60">
                        <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">Total Credits</span>
                          <span className="text-xs font-black text-slate-800">22.0</span>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">Calculated SGPA</span>
                          <span className="text-xs font-black text-emerald-600">8.82</span>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">Equivalent %</span>
                          <span className="text-xs font-black text-slate-800">80.7%</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href="/student/sgpa-calculator"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center block transition shadow-xs cursor-pointer"
                    >
                      Calculate Your SGPA
                    </Link>
                  </div>
                )}

                {activePreviewTab === "resume" && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">Modern Professional Template</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
                          Sample Preview
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                        <span className="font-bold text-slate-800 block">Alex Johnson • Software Engineer</span>
                        <p className="line-clamp-2 text-slate-500 text-[10px]">
                          Pre-loaded with sample projects, education, and skills. Live A4 typography updates instantly.
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/student/resume"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center block transition shadow-xs cursor-pointer"
                    >
                      Build Resume Free
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
