"use client";

import React, { useEffect, useState } from "react";

export type LoadingLogoState = "idle" | "loading" | "working" | "success" | "error";
export type LoadingLogoSize = "sm" | "md" | "lg" | "xl" | "fullscreen";

export interface SaarviLoadingLogoProps {
  /** Lifecycle state of the loader */
  state?: LoadingLogoState;
  /** Size variant */
  size?: LoadingLogoSize | number;
  /** Optional message displayed beneath the logo */
  message?: string;
  /** Whether to render as a fixed centered fullscreen overlay */
  fullscreen?: boolean;
  /** Custom class name for wrapper */
  className?: string;
}

const SIZE_MAP: Record<LoadingLogoSize, number> = {
  sm: 36,
  md: 52,
  lg: 76,
  xl: 104,
  fullscreen: 92,
};

/**
 * Saarvi Signature S-Logo Loading Engine
 *
 * Implements a top-to-bottom vector path drawing animation representing
 * intelligence, engineering, and growth.
 *
 * Sequence:
 * 1. Top arrow & upper blueprint gear draw (0ms - 400ms)
 * 2. 3D ribbon spine curves downward (300ms - 800ms)
 * 3. Lower curve & technical circuit traces complete (700ms - 1200ms)
 * 4. Dual organic green sprout leaves bloom at base (1000ms - 1500ms)
 * 5. Settles into a calm breathing shimmer during extended processing
 */
export function SaarviLoadingLogo({
  state = "loading",
  size = "md",
  message,
  fullscreen = false,
  className = "",
}: SaarviLoadingLogoProps) {
  const pixelSize =
    typeof size === "number" ? size : SIZE_MAP[size] || SIZE_MAP.md;

  // Track if initial draw has completed to transition into calm 'working' state
  const [hasCompletedInitialDraw, setHasCompletedInitialDraw] = useState(false);

  useEffect(() => {
    if (state === "loading") {
      const timer = setTimeout(() => {
        setHasCompletedInitialDraw(true);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const isWorking = state === "working" || (state === "loading" && hasCompletedInitialDraw);
  const isSuccess = state === "success";
  const isError = state === "error";

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 select-none ${className}`}
    >
      <div
        className={`relative transition-all duration-300 ${
          isSuccess ? "scale-105" : ""
        }`}
        style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            {/* Ribbon Dynamic Blue-to-Cyan Gradient */}
            <linearGradient id="saarvi-s-grad" x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>

            {/* Cyan Arrow & Circuit Accent Gradient */}
            <linearGradient id="saarvi-cyan-grad" x1="40" y1="10" x2="90" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </linearGradient>

            {/* Organic Sprout Green Gradient */}
            <linearGradient id="saarvi-leaf-grad" x1="30" y1="65" x2="60" y2="95" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Shimmer Light Filter */}
            <filter id="saarvi-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ==============================================================
              LAYER 1: TOP ARROW & UPPER BLUEPRINT GEAR (TOP ENTRANCE)
             ============================================================== */}
          <g className="saarvi-layer-top">
            {/* Upper Gear blueprint indicator */}
            <path
              d="M 32 20 A 16 16 0 0 0 24 35 M 20 28 L 15 28 M 22 21 L 18 17 M 28 17 L 27 12 M 35 18 L 38 14"
              stroke="#60A5FA"
              strokeWidth="2"
              strokeLinecap="round"
              className="saarvi-draw-gear opacity-70"
            />
            {/* Dynamic Upward Forward Arrow Head */}
            <path
              d="M 64 24 L 78 12 L 74 30 Z"
              fill="url(#saarvi-cyan-grad)"
              className="saarvi-draw-arrow"
            />
          </g>

          {/* ==============================================================
              LAYER 2: MAIN RIBBON "S" BODY (TOP-TO-BOTTOM DRAW)
             ============================================================== */}
          {/* Upper arch curving down into the middle loop */}
          <path
            d="M 74 18 C 65 10, 42 12, 38 26 C 34 38, 58 44, 66 52 C 76 60, 74 76, 58 84 C 44 90, 32 82, 30 76"
            stroke="url(#saarvi-s-grad)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`saarvi-draw-s ${isWorking ? "saarvi-working-pulse" : ""}`}
          />

          {/* Inner 3D Highlight Stroke */}
          <path
            d="M 72 20 C 64 14, 46 16, 42 27 C 38 37, 60 43, 67 51 C 75 59, 73 73, 60 80"
            stroke="#93C5FD"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="saarvi-draw-s-highlight opacity-80"
          />

          {/* ==============================================================
              LAYER 3: LOWER CIRCUIT TRACES (ENGINEERING & TECH)
             ============================================================== */}
          <g className="saarvi-layer-circuits">
            <path
              d="M 52 70 L 62 70 L 68 76 L 76 76"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeLinecap="round"
              className="saarvi-draw-circuit"
            />
            <circle cx="76" cy="76" r="2.5" fill="#38BDF8" className="saarvi-node" />
            <path
              d="M 56 76 L 62 82 L 70 82"
              stroke="#60A5FA"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="saarvi-draw-circuit-2"
            />
            <circle cx="70" cy="82" r="2" fill="#60A5FA" className="saarvi-node" />
          </g>

          {/* ==============================================================
              LAYER 4: GREEN SPROUT LEAVES (GROWTH & EDUCATION)
             ============================================================== */}
          <g className="saarvi-layer-leaves">
            {/* Left Sprout Leaf */}
            <path
              d="M 46 88 C 42 78, 28 72, 24 76 C 22 84, 34 94, 46 88 Z"
              fill="url(#saarvi-leaf-grad)"
              className="saarvi-draw-leaf-left"
            />
            {/* Right Sprout Leaf */}
            <path
              d="M 46 88 C 48 76, 58 72, 62 78 C 62 86, 52 94, 46 88 Z"
              fill="url(#saarvi-leaf-grad)"
              className="saarvi-draw-leaf-right"
            />
          </g>
        </svg>

        {/* Success / Error Status Badges */}
        {isSuccess && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs animate-in zoom-in-50 duration-200">
            ✓
          </div>
        )}
        {isError && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs animate-in zoom-in-50 duration-200">
            !
          </div>
        )}
      </div>

      {/* Screen Reader Semantic Announcement */}
      <span className="sr-only">
        {isSuccess
          ? "Saarvi is ready."
          : isError
          ? "Saarvi could not complete the request."
          : "Saarvi is working."}
      </span>

      {/* Optional Contextual Status Message */}
      {message && (
        <p
          className={`text-xs font-medium tracking-tight text-center max-w-xs transition-opacity duration-200 ${
            isError ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {message}
        </p>
      )}

      {/* Embedded High-Performance CSS Animations */}
      <style jsx>{`
        /* 1. Gear outline draw */
        .saarvi-draw-gear {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: drawPath 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        /* 2. Arrow head draw */
        .saarvi-draw-arrow {
          opacity: 0;
          transform: translateY(-6px) scale(0.85);
          transform-origin: 70px 20px;
          animation: popArrow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
        }

        /* 3. Main ribbon S drawn progressively from top to bottom */
        .saarvi-draw-s {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: drawS 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.25s forwards;
        }

        .saarvi-draw-s-highlight {
          stroke-dasharray: 180;
          stroke-dashoffset: 180;
          animation: drawS 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.35s forwards;
        }

        /* 4. Lower circuits draw */
        .saarvi-draw-circuit,
        .saarvi-draw-circuit-2 {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: drawPath 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.8s forwards;
        }

        .saarvi-node {
          opacity: 0;
          animation: fadeIn 0.3s ease-out 1s forwards;
        }

        /* 5. Green Sprout Leaves bloom from bottom */
        .saarvi-draw-leaf-left {
          opacity: 0;
          transform: scale(0) rotate(-15deg);
          transform-origin: 46px 88px;
          animation: bloomLeaf 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) 1.05s forwards;
        }

        .saarvi-draw-leaf-right {
          opacity: 0;
          transform: scale(0) rotate(15deg);
          transform-origin: 46px 88px;
          animation: bloomLeaf 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) 1.15s forwards;
        }

        /* 6. Calm working breathing state once draw completes */
        .saarvi-working-pulse {
          animation: workingPulse 2.4s ease-in-out infinite alternate;
        }

        @keyframes drawPath {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes drawS {
          0% {
            stroke-dashoffset: 220;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes popArrow {
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bloomLeaf {
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }

        @keyframes workingPulse {
          0% {
            filter: drop-shadow(0 0 0px rgba(37, 99, 235, 0));
            opacity: 0.92;
          }
          50% {
            filter: drop-shadow(0 0 8px rgba(37, 99, 235, 0.35));
            opacity: 1;
          }
          100% {
            filter: drop-shadow(0 0 2px rgba(14, 165, 233, 0.2));
            opacity: 0.95;
          }
        }

        /* Accessibility: respect user prefers-reduced-motion setting */
        @media (prefers-reduced-motion: reduce) {
          .saarvi-draw-gear,
          .saarvi-draw-arrow,
          .saarvi-draw-s,
          .saarvi-draw-s-highlight,
          .saarvi-draw-circuit,
          .saarvi-draw-circuit-2,
          .saarvi-node,
          .saarvi-draw-leaf-left,
          .saarvi-draw-leaf-right,
          .saarvi-working-pulse {
            animation: none !important;
            stroke-dashoffset: 0 !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-[#0b1329]/90 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}

export default SaarviLoadingLogo;
