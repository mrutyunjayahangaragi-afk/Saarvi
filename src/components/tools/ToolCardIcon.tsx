import React from "react";

interface ToolCardIconProps {
  children?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
  size?: "md" | "sm" | "lg";
}

/**
 * ToolCardIcon
 * Standardized, mathematically centered 40x40px (or specified) icon container
 * for all Saarvi tool cards across the platform.
 * 
 * Ensures:
 * - Strict flex-centering (items-center, justify-center) along both axes
 * - Non-shrinking container (shrink-0)
 * - Block-level SVG rendering preventing baseline shifts
 * - Standardized hover animations and dark/light color surfaces
 * - Accessible aria-hidden="true" on decorative icons
 */
export default function ToolCardIcon({
  children,
  icon: IconComponent,
  className = "",
  size = "md",
}: ToolCardIconProps) {
  const sizeClasses =
    size === "sm"
      ? "w-8 h-8 rounded-lg"
      : size === "lg"
      ? "w-12 h-12 rounded-2xl"
      : "w-10 h-10 rounded-xl";

  const svgSizeClasses =
    size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${sizeClasses} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white group-hover:-translate-y-0.5 transition-all duration-200 shadow-2xs group-hover:shadow-xs ${className}`}
    >
      {IconComponent ? (
        <IconComponent
          className={`block shrink-0 ${svgSizeClasses} transition-transform duration-200 group-hover:scale-105`}
          aria-hidden="true"
        />
      ) : React.isValidElement(children) ? (
        React.cloneElement(children as React.ReactElement<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>, {
          className: `block shrink-0 ${svgSizeClasses} transition-transform duration-200 group-hover:scale-105 ${(children as React.ReactElement<{ className?: string }>).props.className || ""}`,
          "aria-hidden": "true",
        })
      ) : (
        children
      )}
    </div>
  );
}
