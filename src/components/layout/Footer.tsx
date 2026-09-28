"use client";

import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  Zap,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Mail,
  FileText,
  Lock,
  MessageSquare
} from "lucide-react";
import { SITE_CONFIG } from "@/config/site";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import { usePlatform } from "@/context/PlatformContext";
import { useFeedback } from "@/context/FeedbackContext";

export default function Footer() {
  const { appName, tagline, supportEmail } = usePlatform();
  const { openFeedback } = useFeedback();

  return (
    <footer className="w-full no-print bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      
      {/* ============================================================== */}
      {/* 1. TRUST / VALUE AREA (Above Main Footer)                      */}
      {/* ============================================================== */}
      <section className="border-b border-slate-800/80 bg-slate-900/60 py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Privacy First */}
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Private by Design</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Supported documents process locally in your browser with no unnecessary cloud storage.
                </p>
              </div>
            </div>

            {/* Card 2: Fast Workflows */}
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Fast by Design</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Zero queues, instant conversions, and deterministic client-side execution.
                </p>
              </div>
            </div>

            {/* Card 3: Student Focused */}
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Student Utilities</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Official syllabus SGPA/CGPA credits, deterministic grading, and ATS student resumes.
                </p>
              </div>
            </div>

            {/* Card 4: Simple Experience */}
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Simple by Design</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  No forced registration for guest-enabled tools. Pick a tool and get right to work.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. MAIN FOOTER (5 Structured Columns)                          */}
      {/* ============================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10 pb-12 border-b border-slate-800">

          {/* Column 1: SAARVI PLATFORM */}
          <div className="col-span-2 sm:col-span-1 space-y-3.5">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Saarvi
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/tools" className="hover:text-blue-400 transition-colors">
                  All Tools
                </Link>
              </li>
              <li>
                <Link href="/pdf" className="hover:text-blue-400 transition-colors">
                  PDF Tools
                </Link>
              </li>
              <li>
                <Link href="/images" className="hover:text-blue-400 transition-colors">
                  Image Tools
                </Link>
              </li>
              <li>
                <Link href="/student-tools" className="hover:text-blue-400 transition-colors">
                  Student Tools
                </Link>
              </li>
              <li>
                <Link href="/jobs" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors inline-flex items-center gap-1.5">
                  <span>Jobs &amp; Internships</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">New</span>
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-blue-400 transition-colors">
                  Plans &amp; Pro
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: TOOLS DIRECTORY */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Tools
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/tools/pdf-to-jpg" className="hover:text-blue-400 transition-colors">
                  PDF to JPG
                </Link>
              </li>
              <li>
                <Link href="/tools/compress-pdf" className="hover:text-blue-400 transition-colors">
                  Compress PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/merge-pdf" className="hover:text-blue-400 transition-colors">
                  Merge PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/pdf-to-excel" className="hover:text-blue-400 transition-colors">
                  PDF to Excel
                </Link>
              </li>
              <li>
                <Link href="/tools/excel-to-pdf" className="hover:text-blue-400 transition-colors">
                  Excel to PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/jpg-to-pdf" className="hover:text-blue-400 transition-colors">
                  Image to PDF
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-slate-200 font-medium hover:text-blue-400 transition-colors">
                  Explore all tools →
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: STUDENTS & CAREER */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Students
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/student/sgpa-calculator" className="hover:text-blue-400 transition-colors">
                  SGPA Calculator
                </Link>
              </li>
              <li>
                <Link href="/student/resume" className="hover:text-blue-400 transition-colors">
                  Resume Builder
                </Link>
              </li>
              <li>
                <Link href="/student" className="hover:text-blue-400 transition-colors">
                  Study Tools
                </Link>
              </li>
              <li>
                <Link href="/career" className="hover:text-blue-400 transition-colors">
                  Career Suite
                </Link>
              </li>
              <li>
                <Link href="/student/attendance" className="hover:text-blue-400 transition-colors">
                  Attendance Planner
                </Link>
              </li>
              <li>
                <Link href="/jobs" className="hover:text-blue-400 transition-colors">
                  Internship Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: RESOURCES & TRUST */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Resources
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/blog" className="hover:text-blue-400 transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openFeedback()}
                  className="hover:text-blue-400 transition-colors text-left cursor-pointer flex items-center gap-1.5"
                >
                  <span>Share Feedback</span>
                </button>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-blue-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-blue-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy#security" className="hover:text-blue-400 transition-colors">
                  Security Overview
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: COMPANY / CONNECT */}
          <div className="col-span-2 sm:col-span-1 space-y-3.5">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Company &amp; Connect
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/about" className="hover:text-blue-400 transition-colors">
                  About the Project
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-blue-400 transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${supportEmail || "saarvinotifications@gmail.com"}`}
                  className="text-slate-300 hover:text-blue-400 transition-colors text-[11px] block break-all font-mono"
                  title="Official Contact Email"
                >
                  {supportEmail || "saarvinotifications@gmail.com"}
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="https://mrutyunjaya-portfolio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-blue-400 font-semibold transition-colors"
                >
                  <span>Creator Portfolio</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mrutyunjayahangaragi-afk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-blue-400 font-semibold transition-colors"
                >
                  <span>GitHub Profile</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* ============================================================== */}
        {/* 3. BOTTOM FOOTER (Brand + Legal + Trust Invariants)            */}
        {/* ============================================================== */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          
          {/* Brand Mark + Copyright */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white font-extrabold tracking-tight hover:opacity-90"
              aria-label="Saarvi Home"
            >
              <SaarviMark size={24} />
              <span>{appName || SITE_CONFIG.name}</span>
            </Link>

            <span className="text-slate-700">•</span>
            <span>{SITE_CONFIG.copyright}</span>
            <span className="text-slate-700">•</span>

            <span className="text-slate-400 font-medium">
              Study. Work. Grow.
            </span>
          </div>

          {/* Privacy Trust / Processing Invariant */}
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Private browser processing • No login required for guest tools</span>
          </div>

        </div>

      </div>
    </footer>
  );
}