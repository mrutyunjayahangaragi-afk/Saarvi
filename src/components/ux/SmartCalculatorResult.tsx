"use client";

import React, { useEffect, useRef } from "react";
import { globalActionController } from "@/lib/ux/action-destination";

export interface SmartCalculatorResultProps {
  children: React.ReactNode;
  isCalculated: boolean;
  targetId?: string;
  className?: string;
  title?: string;
  operationId?: string;
  autoReveal?: boolean;
}

/**
 * Saarvi SmartCalculatorResult Component (Section 42)
 * Standardized container for calculator results across SGPA, CGPA, Marks, Percentage, and Attendance:
 * 1. Registers data-saarvi-target="calculation-result"
 * 2. On calculation completion, auto-reveals the result comfortably in the viewport
 * 3. Sets accessible focus on the result without outline jank
 * 4. Checks visibility: skips scroll if result is already in view
 */
export default function SmartCalculatorResult({
  children,
  isCalculated,
  targetId = "calculation-result",
  className = "",
  title,
  operationId,
  autoReveal = true,
}: SmartCalculatorResultProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCalculatedRef = useRef<boolean>(false);

  useEffect(() => {
    // Only trigger reveal when state transitions from uncalculated to calculated
    if (isCalculated && !prevCalculatedRef.current && autoReveal) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          globalActionController.revealResult(`#${targetId}`, {
            fallbackTarget: "[data-saarvi-target='calculation-result']",
            mode: "result",
            focus: true,
            operationId: operationId || `calc_${Date.now()}`,
            reason: "calculator_result_ready",
          });
        }, 50);
      });
    }
    prevCalculatedRef.current = isCalculated;
  }, [isCalculated, targetId, operationId, autoReveal]);

  if (!isCalculated) return null;

  return (
    <div
      ref={containerRef}
      id={targetId}
      data-saarvi-target="calculation-result"
      tabIndex={-1}
      role="region"
      aria-label={title || "Calculation Result"}
      className={`scroll-mt-24 saarvi-destination-target outline-hidden transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
}
