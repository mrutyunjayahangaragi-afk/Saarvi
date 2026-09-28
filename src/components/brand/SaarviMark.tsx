import React from "react";
import Image from "next/image";

export interface SaarviMarkProps {
  /** Size variant or explicit pixel size (e.g. 28, 36, 48, 64) */
  size?: number | "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
  alt?: string;
  /** Whether to render vector SVG (default true for zero raster artifact) */
  useVector?: boolean;
}

const PRESET_SIZES: Record<string, number> = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

/**
 * Official Saarvi Brand Mark Component.
 * Pure vector SVG representation with transparent background, calibrated gradients,
 * and zero raster pixelation/bounding box artifacts.
 * Scalable to any DPR or viewport size with GPU-accelerated rendering.
 *
 * Backward-compatible asset reference preserved: /brand/saarvi-mark.webp
 */
export function SaarviMark({
  size = 36,
  className = "",
  priority = false,
  alt = "Saarvi — Study. Work. Grow.",
  useVector = true,
}: SaarviMarkProps) {
  const pixelSize = typeof size === "number" ? size : PRESET_SIZES[size] || 36;

  if (!useVector) {
    return (
      <Image
        src="/brand/saarvi-mark.webp"
        alt={alt}
        width={pixelSize}
        height={pixelSize}
        priority={priority}
        className={`object-contain shrink-0 select-none ${className}`}
        style={{
          width: `${pixelSize}px`,
          height: `${pixelSize}px`,
          maxWidth: "100%",
        }}
      />
    );
  }

  // Pure Vector SVG Mark (No white box, 100% transparent, precision S-geometry with book & growth accents)
  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none overflow-visible ${className}`}
      role="img"
      aria-label={alt}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
      }}
    >
      <defs>
        {/* Dynamic Blue-to-Emerald S-Ribbon Gradient */}
        <linearGradient id="saarvi-mark-ribbon" x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="30%" stopColor="#2563eb" />
          <stop offset="70%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Golden Inspiration Star Accent */}
        <linearGradient id="saarvi-mark-star" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        {/* Blueprint Precision Core Track */}
        <linearGradient id="saarvi-mark-core" x1="20%" y1="20%" x2="80%" y2="80%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* Top Star Accent (Growth / Aspiration) */}
      <path
        d="M78 12 Q80 18 86 20 Q80 22 78 28 Q76 22 70 20 Q76 18 78 12 Z"
        fill="url(#saarvi-mark-star)"
      />

      {/* S-Ribbon Main Vector Body */}
      <path
        d="M42 20 C58 18 76 26 74 38 C72 48 56 50 48 54 C36 60 34 72 44 80 C52 86 64 84 74 76 C78 72 82 78 76 84 C62 94 44 94 34 84 C22 72 26 54 40 46 C50 40 64 38 64 32 C64 26 50 24 38 28 C34 29 32 21 42 20 Z"
        fill="url(#saarvi-mark-ribbon)"
      />

      {/* Internal Precision Core Line */}
      <path
        d="M48 26 C58 25 66 30 65 37 C64 43 53 46 45 49 C38 52 36 60 41 66"
        stroke="url(#saarvi-mark-core)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Open Book Base Accent (Study Foundation) */}
      <path
        d="M30 68 C38 64 46 66 50 72 C54 66 62 64 70 68 C71 70 70 74 68 74 C60 70 54 73 50 78 C46 73 40 70 32 74 C30 74 29 70 30 68 Z"
        fill="#ffffff"
        opacity="0.95"
      />
    </svg>
  );
}

export default SaarviMark;
