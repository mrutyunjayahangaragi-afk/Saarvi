"use client";

import { useState, useRef, MouseEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FileImage,
  Layers,
  CheckCircle2,
  Sparkles,
  Lock,
  Zap,
  Download,
  UserCheck
} from "lucide-react";

export default function HeroSection() {
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const stackRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (typeof window === "undefined" || !stackRef.current) return;
    
    // Check coarse touch or reduced motion
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isCoarse || prefersReduced) return;

    const rect = stackRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Small, restrained tilt angles (-6deg to +6deg)
    const normX = (e.clientX - centerX) / (rect.width / 2);
    const normY = (e.clientY - centerY) / (rect.height / 2);

    const clampedX = Math.max(-1, Math.min(1, normX));
    const clampedY = Math.max(-1, Math.min(1, normY));

    setTilt({
      rotateX: -clampedY * 5, // tilting up/down
      rotateY: clampedX * 6   // tilting left/right
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden py-14 sm:py-20 lg:py-24 border-b border-slate-200/80 bg-slate-50/50"
    >
      {/* Background Subtle Radial Light & Mesh Grid */}
      <div
        className="absolute inset-0 bg-mesh-grid pointer-events-none opacity-50"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[360px] bg-blue-500/8 blur-[120px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-10 w-[300px] h-[250px] bg-indigo-500/5 blur-[90px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: Clean, authoritative headline & actions */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left">
            
            {/* Small Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold tracking-wide uppercase shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span>SMART DOCUMENT TOOLS</span>
            </div>

            {/* Large Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
              Your documents. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500">
                Simplified.
              </span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Convert, compress and manage your files with simple tools designed for students and everyday users.
            </p>

            {/* Action CTAs */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <Link
                href="/tools"
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2.5 group hover-3d-lift cursor-pointer"
              >
                <span>Explore Tools</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/student"
                className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-300 shadow-xs hover:shadow-sm transition-all duration-200 hover-3d-lift cursor-pointer"
              >
                Student Tools
              </Link>
            </div>

            {/* Micro Trust Indicators (Section 26) */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-5 sm:gap-6 text-xs text-slate-600">
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

          {/* RIGHT COLUMN: Pure CSS 3D Layered Document Visual */}
          <div className="lg:col-span-5 flex items-center justify-center pt-6 lg:pt-0">
            <div
              ref={stackRef}
              className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-[4/3.8] perspective-1000 flex items-center justify-center"
            >
              {/* Floating 3D Anchor */}
              <div
                className="relative w-64 sm:w-72 aspect-[3/4] transform-style-3d"
                style={{
                  transform: `rotateX(${14 + tilt.rotateX}deg) rotateY(${-18 + tilt.rotateY}deg) rotateZ(3deg)`,
                  transition: "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)"
                }}
              >
                {/* 1. Base Layer: Notes Card */}
                <div
                  className="absolute inset-0 rounded-2xl bg-white border border-amber-200 p-5 shadow-md transform-style-3d"
                  style={{
                    transform: "translate3d(-24px, 28px, -40px) rotate(-6deg)",
                    boxShadow: "0 20px 35px -10px rgba(245, 158, 11, 0.15), 0 4px 10px rgba(0, 0, 0, 0.04)"
                  }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600" /> Notes to PDF
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                  <div className="space-y-2.5 pt-3">
                    <div className="h-2 w-3/4 bg-amber-100/90 rounded" />
                    <div className="h-2 w-5/6 bg-amber-100/70 rounded" />
                    <div className="h-2 w-1/2 bg-amber-100/60 rounded" />
                  </div>
                </div>

                {/* 2. Middle Layer: Image Card */}
                <div
                  className="absolute inset-0 rounded-2xl bg-white border border-indigo-200 p-5 shadow-lg transform-style-3d"
                  style={{
                    transform: "translate3d(-10px, 12px, -10px) rotate(-2deg)",
                    boxShadow: "0 20px 35px -10px rgba(99, 102, 241, 0.15), 0 4px 10px rgba(0, 0, 0, 0.04)"
                  }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                    <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileImage className="w-3.5 h-3.5 text-indigo-600" /> Image Convert
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      JPG • PNG
                    </span>
                  </div>
                  <div className="pt-3 space-y-2">
                    <div className="h-16 w-full rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-center">
                      <FileImage className="w-6 h-6 text-indigo-500" />
                    </div>
                  </div>
                </div>

                {/* 3. Top Primary Layer: High-Res PDF Document */}
                <div
                  className="absolute inset-0 rounded-2xl bg-white border border-slate-200 p-5 shadow-xl transform-style-3d"
                  style={{
                    transform: "translate3d(6px, -6px, 25px) rotate(2deg)",
                    boxShadow: "0 25px 45px -12px rgba(15, 23, 42, 0.12), 0 8px 16px -4px rgba(37, 99, 235, 0.08)"
                  }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs border border-red-100">
                        PDF
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        document.pdf
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                    </span>
                  </div>

                  <div className="pt-4 space-y-2.5">
                    <div className="h-2.5 w-4/5 bg-slate-200/90 rounded-full" />
                    <div className="h-2.5 w-full bg-slate-100 rounded-full" />
                    <div className="h-2.5 w-3/5 bg-slate-100 rounded-full" />
                    <div className="h-2.5 w-2/3 bg-slate-100 rounded-full" />
                  </div>

                  {/* Micro pill badge on bottom */}
                  <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Layers className="w-3 h-3 text-blue-600" /> Client-side
                    </span>
                    <span className="font-mono font-medium">1.4 MB</span>
                  </div>
                </div>

                {/* 4. Floating 3D Badge (Depth Offset +65px) - Crisp Light Surface */}
                <div
                  className="absolute -top-4 -right-6 px-3.5 py-2 rounded-xl bg-white text-blue-700 text-xs font-semibold shadow-lg border border-blue-200 flex items-center gap-2 transform-style-3d"
                  style={{
                    transform: "translate3d(0, 0, 65px)",
                    boxShadow: "0 12px 25px -5px rgba(37, 99, 235, 0.15), 0 4px 8px rgba(0, 0, 0, 0.04)"
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>100% In-Browser</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
