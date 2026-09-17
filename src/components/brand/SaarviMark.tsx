import React from "react";
import Image from "next/image";

export interface SaarviMarkProps {
  /** Size variant or explicit pixel size (e.g. 28, 36, 48, 64) */
  size?: number | "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
  alt?: string;
}

const PRESET_SIZES: Record<string, number> = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

/**
 * Official Saarvi Brand Mark Component.
 * Uses the authoritative Saarvi 3D ribbon mark with upward arrow, technical gear,
 * green sprout leaves, and circuit lines.
 * Single source of truth for Saarvi icon branding.
 */
export function SaarviMark({
  size = 36,
  className = "",
  priority = false,
  alt = "Saarvi — Study. Work. Grow.",
}: SaarviMarkProps) {
  const pixelSize = typeof size === "number" ? size : PRESET_SIZES[size] || 36;

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

export default SaarviMark;
