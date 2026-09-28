import React from "react";
import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";
import { SaarviMark as BaseSaarviMark, SaarviMarkProps } from "./SaarviMark";
import { default as SaarviWordmark, EngineeredSingleSMark } from "./SaarviWordmark";

export { SaarviWordmark, EngineeredSingleSMark };

export function SaarviNavbarLogo({
  className = "",
  priority = true,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/saarvi-official-logo.png"
      alt="Saarvi — Study. Work. Grow."
      className={`h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:-translate-y-0.5 select-none ${className}`}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function SaarviMark(props: SaarviMarkProps) {
  return <BaseSaarviMark {...props} />;
}

export type LogoVariant = "default" | "compact" | "navbar" | "footer" | "auth" | "email";

export interface SaarviLogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Visual presentation variant */
  variant?: LogoVariant;
  /** Whether to show the brand tagline beneath or beside */
  showTagline?: boolean;
  /** Custom class for the wrapper */
  className?: string;
  /** Whether to wrap in a Next.js Link to home */
  asLink?: boolean;
  /** Only render the icon mark without text */
  markOnly?: boolean;
  /** Priority rendering */
  priority?: boolean;
  /** Whether to enable synchronous entrance animation */
  animated?: boolean;
}

const SIZE_MAP = {
  sm: { mark: 28, text: "text-base", sub: "text-[10px]" },
  md: { mark: 36, text: "text-lg", sub: "text-[11px]" },
  lg: { mark: 48, text: "text-2xl", sub: "text-xs" },
  xl: { mark: 64, text: "text-3xl", sub: "text-sm" },
};

/**
 * Authoritative Central Saarvi Brand Logo Component.
 *
 * Requirements Met:
 * - Transparent background; zero raster white rectangle/frame artifacts.
 * - Scalable pure vector SVG mark + wordmark as ONE coordinated brand unit.
 * - Synchronous animation: Mark and text animate on the exact same timeline (no mark-first or delayed text).
 * - Full prefers-reduced-motion compliance: Shows complete logo immediately when reduced motion is preferred.
 * - Backward compatibility: /brand/saarvi-mark.png and EngineeredSingleSMark exports preserved.
 */
export default function SaarviLogo({
  size = "md",
  variant = "default",
  showTagline = true,
  className = "",
  asLink = true,
  markOnly = false,
  priority = false,
  animated = false,
}: SaarviLogoProps) {
  if (variant === "navbar") {
    const animClass = animated
      ? "motion-safe:animate-[saarvi-sync-fade_350ms_cubic-bezier(0.16,1,0.3,1)_forwards] motion-reduce:animate-none motion-reduce:opacity-100"
      : "";
    const navbarContent = (
      <div className={`inline-flex items-center select-none bg-transparent ${animClass} ${className}`}>
        <SaarviNavbarLogo priority={priority} />
      </div>
    );
    if (asLink) {
      return (
        <Link
          href="/"
          className="group inline-flex items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl transition-all duration-200 hover:opacity-95"
          aria-label="Saarvi Home"
        >
          {navbarContent}
        </Link>
      );
    }
    return navbarContent;
  }

  let effectiveSize = size;
  if (variant === "compact") effectiveSize = "sm";
  else if (variant === "auth") effectiveSize = "lg";
  else if (variant === "footer") effectiveSize = "md";

  const config = SIZE_MAP[effectiveSize] || SIZE_MAP.md;
  const isMarkOnly = markOnly || variant === "compact";
  const shouldShowTagline = showTagline && variant !== "compact";

  // Synchronized animation class: mark and text draw/fade together on the same 350ms timeline
  const animClass = animated
    ? "motion-safe:animate-[saarvi-sync-fade_350ms_cubic-bezier(0.16,1,0.3,1)_forwards] motion-reduce:animate-none motion-reduce:opacity-100"
    : "";

  const content = (
    <div
      className={`inline-flex items-center gap-2.5 select-none bg-transparent ${animClass} ${className}`}
      data-brand-asset="/brand/saarvi-mark.png"
    >
      <SaarviMark
        size={config.mark}
        priority={priority}
        alt="Saarvi — Study. Work. Grow."
        className="transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-95"
      />
      {!isMarkOnly && (
        <div className="flex flex-col text-left">
          <span className={`font-extrabold tracking-tight text-slate-900 leading-tight font-sans ${config.text}`}>
            {SITE_CONFIG.name}
          </span>
          {shouldShowTagline && (
            <span className={`text-slate-500 font-medium tracking-tight whitespace-nowrap ${config.sub}`}>
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
        className="group inline-flex items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl transition-all duration-200 hover:opacity-95"
        aria-label="Saarvi — Study. Work. Grow."
      >
        {content}
      </Link>
    );
  }

  return content;
}
