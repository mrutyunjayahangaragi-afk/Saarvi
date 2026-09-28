"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Briefcase,
  FileText,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  FileSpreadsheet,
  Cpu,
  Eye,
  Check,
  Calculator,
} from "lucide-react";

export default function PlatformInteractiveShowcase() {
  const [activePillar, setActivePillar] = useState<"study" | "work" | "grow">("study");

  // Interactive SGPA State for Study tab
  const [marks, setMarks] = useState<{ [key: string]: number }>({
    math: 92,
    cs: 86,
    ds: 88,
  });

  const calculateGradePoint = (score: number) => {
    if (score >= 90) return { grade: "O", points: 10 };
    if (score >= 80) return { grade: "A+", points: 9 };
    if (score >= 70) return { grade: "A", points: 8 };
    if (score >= 60) return { grade: "B+", points: 7 };
    if (score >= 50) return { grade: "B", points: 6 };
    if (score >= 40) return { grade: "C", points: 5 };
    return { grade: "F", points: 0 };
  };

  const currentSgpa = (
    (calculateGradePoint(marks.math).points * 4 +
      calculateGradePoint(marks.cs).points * 4 +
      calculateGradePoint(marks.ds).points * 3) /
    11
  ).toFixed(2);

  // Resume Template Preview State for Grow tab
  const [activeResumeTemplate, setActiveResumeTemplate] = useState<"classic-ats" | "modern-professional" | "student-clean">("classic-ats");

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Top Header & Pillar Switcher */}
      <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Interactive Platform Preview
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Study. Work. Grow. In Action.
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Explore how Saarvi pairs university academics, privacy-first document tools, and professional career engines into one unified suite.
          </p>
        </div>

        {/* Pillar Navigation Tabs */}
        <div className="flex items-center p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/70 self-start md:self-auto">
          <button
            onClick={() => setActivePillar("study")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activePillar === "study"
                ? "bg-white text-blue-700 shadow-xs scale-[1.02]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>Study</span>
          </button>
          <button
            onClick={() => setActivePillar("work")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activePillar === "work"
                ? "bg-white text-blue-700 shadow-xs scale-[1.02]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Work</span>
          </button>
          <button
            onClick={() => setActivePillar("grow")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activePillar === "grow"
                ? "bg-white text-blue-700 shadow-xs scale-[1.02]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <span>Grow</span>
          </button>
        </div>
      </div>

      {/* Pillar Showcase Content */}
      <div className="p-6 sm:p-10">
        {/* PILLAR 1: STUDY */}
        {activePillar === "study" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Pillar 1: University Academics
              </span>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                Deterministic SGPA &amp; Curriculum Intelligence
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tested against official VTU 2022 &amp; 2026 scheme regulations. Correctly retains F-grade credit denominators, calculates precise grade points, and synchronizes with your semester academic calendar.
              </p>
              <div className="space-y-2 pt-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Official VTU 2022/2026 credit weighting &amp; CIE/SEE thresholds</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Local-first storage: Your marks never leak to advertisers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>One-click VTU percentage conversion formula</span>
                </div>
              </div>
              <div className="pt-3">
                <Link
                  href="/student/sgpa-calculator"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  <span>Open Full SGPA Calculator</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Interactive Calculator Card */}
            <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Live VTU Scheme 2022 Simulator
                  </span>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-extrabold text-xs">
                  Estimated SGPA: {currentSgpa}
                </div>
              </div>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-slate-700">Mathematics IV</span>
                      <span className="text-slate-400 font-mono text-[10px]">4 Cr</span>
                    </div>
                    <input
                      type="range"
                      min="35"
                      max="100"
                      value={marks.math}
                      onChange={(e) => setMarks({ ...marks, math: Number(e.target.value) })}
                      className="w-full accent-blue-600 h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-500 font-mono">{marks.math} Marks</span>
                      <span className="font-bold text-emerald-700">
                        {calculateGradePoint(marks.math).grade} ({calculateGradePoint(marks.math).points} pts)
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-slate-700">Operating Systems</span>
                      <span className="text-slate-400 font-mono text-[10px]">4 Cr</span>
                    </div>
                    <input
                      type="range"
                      min="35"
                      max="100"
                      value={marks.cs}
                      onChange={(e) => setMarks({ ...marks, cs: Number(e.target.value) })}
                      className="w-full accent-blue-600 h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-500 font-mono">{marks.cs} Marks</span>
                      <span className="font-bold text-emerald-700">
                        {calculateGradePoint(marks.cs).grade} ({calculateGradePoint(marks.cs).points} pts)
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-slate-700">Data Structures</span>
                      <span className="text-slate-400 font-mono text-[10px]">3 Cr</span>
                    </div>
                    <input
                      type="range"
                      min="35"
                      max="100"
                      value={marks.ds}
                      onChange={(e) => setMarks({ ...marks, ds: Number(e.target.value) })}
                      className="w-full accent-blue-600 h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-500 font-mono">{marks.ds} Marks</span>
                      <span className="font-bold text-emerald-700">
                        {calculateGradePoint(marks.ds).grade} ({calculateGradePoint(marks.ds).points} pts)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  Calculated locally in real-time
                </span>
                <span className="font-medium text-slate-600">Total Credits: 11</span>
              </div>
            </div>
          </div>
        )}

        {/* PILLAR 2: WORK */}
        {activePillar === "work" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                Pillar 2: Private Document Engineering
              </span>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                Client-Side WebAssembly &amp; OpenXML Processing
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Traditional file converters upload your sensitive PDFs and spreadsheets to unknown remote servers. Saarvi runs the extraction engine directly in your browser.
              </p>
              <div className="space-y-2 pt-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>0 Bytes transmitted to cloud servers for supported conversions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Zero queue times: converts as fast as your device processor</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>High-fidelity OpenXML Excel table extraction &amp; PDF generation</span>
                </div>
              </div>
              <div className="pt-3">
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  <span>Explore Document Tools</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Privacy Architecture Comparison Card */}
            <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-200 flex items-center justify-between">
                <span>Architecture Comparison</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Zero Network Leak
                </span>
              </div>

              {/* Legacy cloud way */}
              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-1.5 opacity-80">
                <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                  <span>Traditional Cloud Converter</span>
                  <span className="text-[10px] uppercase font-semibold text-rose-700">High Exposure</span>
                </div>
                <p className="text-[11px] text-rose-800">
                  Your PDF is uploaded over HTTP → stored on 3rd-party servers → processed in a shared queue → downloaded back.
                </p>
              </div>

              {/* Saarvi client-side way */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5 ring-2 ring-emerald-500/20">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Saarvi Client-Side WebAssembly
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    100% Private
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Your file never leaves your browser tab. Executed locally in sandboxed client memory. Zero cloud storage, zero trace.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-600 font-medium">Supported Document Formats</span>
                <span className="font-mono text-slate-800 font-semibold">PDF, DOCX, XLSX, JPG, PNG</span>
              </div>
            </div>
          </div>
        )}

        {/* PILLAR 3: GROW */}
        {activePillar === "grow" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                Pillar 3: Career Growth
              </span>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                Resume Builder 2.0 with Live Sample Previews
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Never start from a blank screen. Select any professional template to immediately preview realistic completed demo data, verify ATS compliance score, and replace with your information in one click.
              </p>
              <div className="space-y-2 pt-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Realistic sample profile (Alex Johnson, Software Engineer) ready instantly</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Vector ISO-32000 PDF export with active clickable hyperlinks</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Real-time ATS keyword matching and single-column LaTeX fidelity</span>
                </div>
              </div>
              <div className="pt-3">
                <Link
                  href="/student/resume"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  <span>Launch Resume Builder 2.0</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Interactive Resume Card Preview */}
            <div className="lg:col-span-7 bg-slate-100/80 border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-800">
                    Live Template Demo: Alex Johnson
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ATS Score: 92/100
                  </span>
                </div>
              </div>

              {/* Template Style Selector */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveResumeTemplate("classic-ats")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                    activeResumeTemplate === "classic-ats"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  ATS Classic
                </button>
                <button
                  onClick={() => setActiveResumeTemplate("modern-professional")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                    activeResumeTemplate === "modern-professional"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Modern Professional
                </button>
                <button
                  onClick={() => setActiveResumeTemplate("student-clean")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                    activeResumeTemplate === "student-clean"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Student Clean
                </button>
              </div>

              {/* Mini A4 Sheet Preview */}
              <div className="bg-white rounded-xl border border-slate-300/80 p-5 shadow-xs space-y-3 font-sans text-xs">
                <div className={`pb-2 ${activeResumeTemplate === "modern-professional" ? "border-b-2 border-blue-600" : activeResumeTemplate === "student-clean" ? "border-b-2 border-teal-600" : "border-b border-slate-900"}`}>
                  <h5 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Alex Johnson
                  </h5>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-medium mt-1">
                    <span>Bengaluru, India</span>
                    <span>•</span>
                    <span className="text-blue-600">alex.johnson@example.com</span>
                    <span>•</span>
                    <span className="text-blue-600">linkedin.com/in/alexjohnson</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Experience
                  </div>
                  <div className="text-[11px] font-semibold text-slate-900 flex justify-between">
                    <span>Software Engineering Intern — Example Technologies</span>
                    <span className="text-slate-400 font-normal">Jan 2026 – Present</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    • Developed modular React web applications with structured client caching.<br />
                    • Reduced client bundle payload by 28% through code splitting and tree shaking.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Education
                  </div>
                  <div className="text-[11px] font-semibold text-slate-900 flex justify-between">
                    <span>B.Tech in Computer Science &amp; Engineering</span>
                    <span className="text-emerald-700 font-bold">8.7 CGPA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
