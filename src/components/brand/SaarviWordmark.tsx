import React from 'react';
import Link from 'next/link';

export type WordmarkVariant = 'navbar' | 'stacked' | 'icon-only' | 'footer' | 'compact';
export type WordmarkTheme = 'light' | 'dark' | 'auto';

interface SaarviWordmarkProps {
  variant?: WordmarkVariant;
  theme?: WordmarkTheme;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  asLink?: boolean;
  className?: string;
}

/**
 * Single Engineered "S" Brand Mark.
 * Architectural, geometric vector construction with precision strokes and balanced proportions.
 * Zero raster pixelation; crisp at any resolution. Pure vector SVG.
 */
export function EngineeredSingleSMark({
  size = 36,
  className = '',
  theme = 'auto',
}: {
  size?: number;
  className?: string;
  theme?: WordmarkTheme;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Saarvi Symbol"
    >
      <defs>
        {/* Architectural subtle gradient accent */}
        <linearGradient id="saarvi-blue-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="saarvi-accent-grad" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/* Transparent Container Plate */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="none"
      />

      {/* Single Engineered "S" Geometry */}
      {/* Upper Terminal & Arc */}
      <path
        d="M34 16.5C34 13.4624 31.5376 11 28.5 11H20C16.134 11 13 14.134 13 18C13 21.866 16.134 25 20 25H28C31.866 25 35 28.134 35 32C35 35.866 31.866 39 28 39H19.5C16.4624 39 14 36.5376 14 33.5"
        stroke="url(#saarvi-blue-grad)"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Architectural Precision Inner Track & Accent Core */}
      <path
        d="M20 18H28.5C29.8807 18 31 16.8807 31 15.5C31 14.1193 29.8807 13 28.5 13H20C17.2386 13 15 15.2386 15 18C15 20.7614 17.2386 23 20 23H28C30.7614 23 33 25.2386 33 28C33 30.7614 30.7614 33 28 33H19.5C18.1193 33 17 31.8807 17 30.5C17 29.1193 18.1193 28 19.5 28H28"
        stroke="url(#saarvi-accent-grad)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* Precision Anchor Indicators */}
      <circle cx="34" cy="16.5" r="1.5" fill="#38BDF8" />
      <circle cx="14" cy="33.5" r="1.5" fill="#38BDF8" />
    </svg>
  );
}

/**
 * Production Saarvi Wordmark Component.
 * Supports:
 * - Desktop, Tablet, Mobile responsive layouts
 * - Compact navbar mode
 * - Auth page stacked hero mode
 * - Accessible semantic labeling
 */
export default function SaarviWordmark({
  variant = 'navbar',
  theme = 'auto',
  size = 'md',
  showTagline = true,
  asLink = true,
  className = '',
}: SaarviWordmarkProps) {
  // Size metrics
  const markSize =
    size === 'sm' ? 28 : size === 'lg' ? 44 : size === 'xl' ? 56 : 36;
  const titleSize =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
      ? 'text-2xl'
      : size === 'xl'
      ? 'text-3xl'
      : 'text-lg';
  const taglineSize =
    size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : size === 'xl' ? 'text-sm' : 'text-[11px]';

  const titleColor =
    theme === 'dark'
      ? 'text-white'
      : theme === 'light'
      ? 'text-slate-900'
      : 'text-slate-900 dark:text-white';

  const taglineColor =
    theme === 'dark'
      ? 'text-slate-400'
      : theme === 'light'
      ? 'text-slate-500'
      : 'text-slate-500 dark:text-slate-400';

  // Variant Rendering
  if (variant === 'icon-only') {
    const icon = <EngineeredSingleSMark size={markSize} className={className} theme={theme} />;
    if (asLink) {
      return (
        <Link href="/" className="inline-flex focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl" aria-label="Saarvi — Study. Work. Grow.">
          {icon}
          <span className="sr-only">Saarvi — Study. Work. Grow.</span>
        </Link>
      );
    }
    return icon;
  }

  if (variant === 'stacked') {
    const stackedContent = (
      <div className={`flex flex-col items-center text-center space-y-2 select-none ${className}`}>
        <EngineeredSingleSMark size={markSize * 1.25} theme={theme} />
        <div>
          <span className={`font-extrabold tracking-tight ${titleColor} block leading-tight font-sans ${titleSize}`}>
            Saarvi
          </span>
          {showTagline && (
            <span className={`${taglineColor} font-medium tracking-wide block mt-0.5 ${taglineSize}`}>
              Study. Work. Grow.
            </span>
          )}
        </div>
      </div>
    );

  if (asLink) {
      return (
        <Link href="/" className="group inline-flex focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl p-1 transition-transform hover:scale-[1.01]" aria-label="Saarvi Home">
          {stackedContent}
        </Link>
      );
    }
    return stackedContent;
  }

  // Navbar / Compact / Standard
  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <EngineeredSingleSMark size={markSize} theme={theme} />
      <div className={`flex flex-col text-left ${variant === 'compact' ? 'hidden sm:flex' : 'flex'}`}>
        <span className={`font-extrabold tracking-tight ${titleColor} leading-tight font-sans ${titleSize}`}>
          Saarvi
        </span>
        {showTagline && (
          <span className={`${taglineColor} font-medium tracking-tight whitespace-nowrap ${taglineSize}`}>
            Study. Work. Grow.
          </span>
        )}
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        className="group inline-flex items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl transition-transform duration-200 hover:scale-[1.01] active:scale-95"
        aria-label="Saarvi — Study. Work. Grow."
      >
        {content}
      </Link>
    );
  }

  return content;
}
