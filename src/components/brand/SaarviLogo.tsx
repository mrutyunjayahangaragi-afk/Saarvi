import React from "react";
import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";
import { SaarviMark as BaseSaarviMark, SaarviMarkProps } from "./SaarviMark";
import { default as SaarviWordmark } from "./SaarviWordmark";

export { SaarviWordmark };

export function SaarviMark(props: SaarviMarkProps) {
  return <BaseSaarviMark {...props} />;
}

// Backward compatibility alias for any legacy consumers
export const EngineeredSingleSMark = SaarviMark;

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
  /** Next.js Image priority */
  priority?: boolean;
}

const SIZE_MAP = {
  sm: { mark: 28, text: "text-base", sub: "text-[10px]" },
  md: { mark: 36, text: "text-lg", sub: "text-[11px]" },
  lg: { mark: 48, text: "text-2xl", sub: "text-xs" },
  xl: { mark: 64, text: "text-3xl", sub: "text-sm" },
};

/**
 * Authoritative Central Saarvi Logo Component.
 * Powered by the official transparent Saarvi mark (/brand/saarvi-mark.png and /brand/saarvi-mark.webp).
 * Single source of truth for Saarvi branding across desktop, mobile, auth, admin, and email.
 */
export default function SaarviLogo({
  size = "md",
  variant = "default",
  showTagline = true,
  className = "",
  asLink = true,
  markOnly = false,
  priority = false,
}: SaarviLogoProps) {
  // Determine size config based on variant or size prop
  let effectiveSize = size;
  if (variant === "navbar") effectiveSize = "md";
  else if (variant === "compact") effectiveSize = "sm";
  else if (variant === "auth") effectiveSize = "lg";
  else if (variant === "footer") effectiveSize = "md";

  const config = SIZE_MAP[effectiveSize] || SIZE_MAP.md;
  const isMarkOnly = markOnly || variant === "compact";
  const shouldShowTagline = showTagline && variant !== "compact";

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <SaarviMark
        size={config.mark}
        priority={priority}
        alt="Saarvi — Study. Work. Grow."
        className="transition-transform duration-200"
      />
      {!isMarkOnly && (
        <div className="flex flex-col text-left">
          <span className={`font-extrabold tracking-tight text-slate-900 leading-tight ${config.text}`}>
            {SITE_CONFIG.name}
          </span>
          {shouldShowTagline && (
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
        aria-label="Saarvi — Study. Work. Grow."
      >
        {content}
      </Link>
    );
  }

  return content;
}
