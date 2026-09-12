import React from "react";
import Image from "next/image";
import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";

interface SaarviLogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Whether to show the brand tagline beneath or beside */
  showTagline?: boolean;
  /** Custom class for the wrapper */
  className?: string;
  /** Whether to wrap in a Next.js Link to home */
  asLink?: boolean;
  /** Only render the icon mark without text */
  markOnly?: boolean;
}

const SIZE_MAP = {
  sm: { mark: 28, text: "text-base", sub: "text-[10px]" },
  md: { mark: 36, text: "text-lg", sub: "text-[11px]" },
  lg: { mark: 48, text: "text-2xl", sub: "text-xs" },
  xl: { mark: 64, text: "text-3xl", sub: "text-sm" },
};

export function SaarviMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 p-1 shadow-sm border border-slate-800/40 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/brand/saarvi-mark.png"
        alt="Saarvi Brand Mark"
        width={size * 2}
        height={size * 2}
        className="w-full h-full object-contain"
        priority
      />
    </div>
  );
}

export default function SaarviLogo({
  size = "md",
  showTagline = true,
  className = "",
  asLink = true,
  markOnly = false,
}: SaarviLogoProps) {
  const config = SIZE_MAP[size];

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <SaarviMark size={config.mark} />
      {!markOnly && (
        <div className="flex flex-col text-left">
          <span className={`font-extrabold tracking-tight text-slate-900 leading-tight ${config.text}`}>
            {SITE_CONFIG.name}
          </span>
          {showTagline && (
            <span className={`text-slate-500 font-medium tracking-tight ${config.sub}`}>
              {SITE_CONFIG.tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        className="group inline-flex items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl transition-transform duration-200 hover:scale-[1.02] active:scale-95"
        aria-label="Saarvi Home"
      >
        {content}
      </Link>
    );
  }

  return content;
}
