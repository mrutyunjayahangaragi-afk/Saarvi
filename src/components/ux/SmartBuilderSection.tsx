"use client";

import React, { useEffect, useRef } from "react";
import { globalActionController } from "@/lib/ux/action-destination";

export type BuilderStep = "templates" | "editor" | "preview" | "export";

export interface SmartBuilderSectionProps {
  id: string;
  step: BuilderStep;
  activeStep: BuilderStep;
  targetName?: string;
  children: React.ReactNode;
  className?: string;
  autoRevealOnActive?: boolean;
}

/**
 * Saarvi SmartBuilderSection Component (Section 43)
 * Standardizes multi-step builders (Resume Builder, Cover Letter, Template Studio):
 * 1. Template selection -> reveals editor (#resume-editor)
 * 2. Generate -> reveals preview (#preview)
 * 3. Export -> reveals export status
 */
export default function SmartBuilderSection({
  id,
  step,
  activeStep,
  targetName,
  children,
  className = "",
  autoRevealOnActive = true,
}: SmartBuilderSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevActiveRef = useRef<boolean>(false);
  const isActive = step === activeStep;

  useEffect(() => {
    if (isActive && !prevActiveRef.current && autoRevealOnActive) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          globalActionController.reveal(`#${id}`, {
            fallbackTarget: targetName ? `[data-saarvi-target='${targetName}']` : undefined,
            mode: step === "preview" ? "result" : "section",
            focus: true,
            reason: `builder_step_${step}`,
          });
        }, 50);
      });
    }
    prevActiveRef.current = isActive;
  }, [isActive, id, step, targetName, autoRevealOnActive]);

  return (
    <section
      ref={containerRef}
      id={id}
      data-saarvi-target={targetName || `builder-${step}`}
      tabIndex={-1}
      className={`scroll-mt-24 saarvi-destination-target outline-hidden ${className} ${
        !isActive ? "hidden" : ""
      }`}
    >
      {children}
    </section>
  );
}
