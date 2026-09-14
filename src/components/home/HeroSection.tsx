"use client";

import Link from "next/link";
import {
  ArrowRight,
  Lock,
  Zap,
  Download,
  UserCheck,
} from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40">
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          
          {/* Small Badge / Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/90 border border-blue-200/80 text-blue-700 text-xs font-semibold tracking-wide uppercase shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>PRIVATE BY DESIGN • FAST BY DESIGN</span>
          </div>

          {/* Large Authoritative Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
            Your everyday tools. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500">
              One simple workspace.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Convert documents, manage study work, build your career, and get things done with Saarvi. Fast, private in-browser tools designed for students and everyday users.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tools"
              className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2.5 group hover-3d-lift cursor-pointer min-h-[44px]"
            >
              <span>Explore Tools</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/student"
              className="px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-300 shadow-xs hover:shadow-sm transition-all duration-200 hover-3d-lift cursor-pointer min-h-[44px] flex items-center"
            >
              Student Tools
            </Link>
          </div>

          {/* Micro Trust Indicators */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-600">
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

        </div>
      </div>
    </section>
  );
}
