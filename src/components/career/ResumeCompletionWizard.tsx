"use client";

import React, { useState } from "react";
import type { CareerProfile, ResumeSectionId, ResumeVersion } from "@/types/career";
import {
  resumeCompletionService,
  type WizardStepId,
  type WizardStep,
  type ResumeCompletionReport,
} from "@/lib/services/resumeCompletionService";
import {
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Eye,
  Download,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Check,
  Ban,
  FastForward,
  Info,
} from "lucide-react";
import { revealDestination } from "@/lib/ux/action-destination";

interface ResumeCompletionWizardProps {
  profile: CareerProfile;
  version: ResumeVersion;
  activeTab: ResumeSectionId;
  onNavigateToSection: (sectionId: ResumeSectionId) => void;
  onUpdateVersion: (updater: (v: ResumeVersion) => ResumeVersion) => void;
  onExportPdf: () => void;
  onPreview: () => void;
}

export const ResumeCompletionWizard: React.FC<ResumeCompletionWizardProps> = ({
  profile,
  version,
  activeTab,
  onNavigateToSection,
  onUpdateVersion,
  onExportPdf,
  onPreview,
}) => {
  const [filterLevel, setFilterLevel] = useState<"ALL" | "RECOMMENDED" | "OPTIONAL">("ALL");
  const [showReviewDetails, setShowReviewDetails] = useState(false);

  const skippedSet = new Set<string>(version.wizardSkippedSections || []);
  const notApplicableSet = new Set<string>(version.wizardNotApplicableSections || []);

  // Map activeTab to WizardStepId (activeTab is a ResumeSectionId)
  const currentStepId: WizardStepId = (activeTab as WizardStepId) || "contact";

  // Generate real-time deterministic completion report
  const report: ResumeCompletionReport = resumeCompletionService.generateReport(
    profile,
    version,
    currentStepId,
    skippedSet,
    notApplicableSet
  );

  // Handlers for skip and not-applicable states
  const handleSkip = (stepId: WizardStepId) => {
    onUpdateVersion((v) => {
      const currentSkipped = new Set(v.wizardSkippedSections || []);
      const currentNA = new Set(v.wizardNotApplicableSections || []);
      currentSkipped.add(stepId);
      currentNA.delete(stepId);
      return {
        ...v,
        wizardSkippedSections: Array.from(currentSkipped),
        wizardNotApplicableSections: Array.from(currentNA),
      };
    });

    // Auto-advance to next logical step
    const nextStep = resumeCompletionService.getNextStepAfter(
      stepId,
      profile,
      version,
      new Set([...skippedSet, stepId]),
      notApplicableSet
    );

    if (nextStep && nextStep !== "review") {
      onNavigateToSection(nextStep as ResumeSectionId);
    }
  };

  const handleMarkNotApplicable = (stepId: WizardStepId) => {
    onUpdateVersion((v) => {
      const currentSkipped = new Set(v.wizardSkippedSections || []);
      const currentNA = new Set(v.wizardNotApplicableSections || []);
      currentNA.add(stepId);
      currentSkipped.delete(stepId);
      return {
        ...v,
        wizardSkippedSections: Array.from(currentSkipped),
        wizardNotApplicableSections: Array.from(currentNA),
      };
    });

    const nextStep = resumeCompletionService.getNextStepAfter(
      stepId,
      profile,
      version,
      skippedSet,
      new Set([...notApplicableSet, stepId])
    );

    if (nextStep && nextStep !== "review") {
      onNavigateToSection(nextStep as ResumeSectionId);
    }
  };

  const handleRestore = (stepId: WizardStepId) => {
    onUpdateVersion((v) => {
      const currentSkipped = new Set(v.wizardSkippedSections || []);
      const currentNA = new Set(v.wizardNotApplicableSections || []);
      currentSkipped.delete(stepId);
      currentNA.delete(stepId);
      return {
        ...v,
        wizardSkippedSections: Array.from(currentSkipped),
        wizardNotApplicableSections: Array.from(currentNA),
      };
    });

    if (stepId !== "review") {
      handleOpenSection(stepId as ResumeSectionId);
    }
  };

  const handleSkipAllOptional = () => {
    const optionalStepIds = report.steps
      .filter((s) => s.level === "OPTIONAL" && !s.isComplete)
      .map((s) => s.id);

    onUpdateVersion((v) => {
      const currentSkipped = new Set(v.wizardSkippedSections || []);
      optionalStepIds.forEach((id) => currentSkipped.add(id));
      return {
        ...v,
        wizardSkippedSections: Array.from(currentSkipped),
      };
    });
  };

  const handleOpenSection = (sectionId: ResumeSectionId) => {
    onNavigateToSection(sectionId);
    setTimeout(() => {
      revealDestination({
        target: "#resume-editor",
        fallbackTarget: "[data-saarvi-target='resume-editor']",
        mode: "result",
        focus: true,
        reason: `wizard_nav_${sectionId}`,
      });
    }, 50);
  };

  const handleFresherSkipExperience = () => {
    // 1. Mark experience as skipped/not applicable
    onUpdateVersion((v) => {
      const currentSkipped = new Set(v.wizardSkippedSections || []);
      currentSkipped.add("experience");
      return {
        ...v,
        wizardSkippedSections: Array.from(currentSkipped),
      };
    });

    // 2. Intelligently route immediately to Projects
    handleOpenSection("projects");
  };

  // Filtered steps for display
  const displayedSteps = report.steps.filter((step) => {
    if (filterLevel === "RECOMMENDED") return step.level === "CORE" || step.level === "RECOMMENDED";
    if (filterLevel === "OPTIONAL") return step.level === "OPTIONAL";
    return true;
  });

  return (
    <div
      id="resume-wizard"
      data-saarvi-target="resume-wizard"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6"
    >
      {/* 1. Header & Real Progress Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200">
                Resume Wizard 6.0
              </span>
              <span className="text-xs text-slate-500 font-medium">Adaptive Step-by-Step</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-1">Complete Your Resume</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Build your resume step by step. Complete the sections that matter to you and skip anything you don't need.
            </p>
          </div>

          <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Resume Completion</span>
              <span className="text-2xl font-black text-slate-900 tracking-tight">{report.percentage}%</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {report.completedCore + report.completedRecommended} of{" "}
              {report.totalCore + report.totalRecommended} recommended completed
            </span>
          </div>
        </div>

        {/* Deterministic Progress Bar */}
        <div className="space-y-1.5">
          <div
            className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/70"
            role="progressbar"
            aria-valuenow={report.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Resume Completion Progress"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                report.percentage >= 80
                  ? "bg-emerald-500"
                  : report.percentage >= 50
                  ? "bg-blue-600"
                  : "bg-amber-500"
              }`}
              style={{ width: `${report.percentage}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-medium gap-2 pt-0.5">
            <div className="flex items-center gap-3">
              <span>
                Core: <strong className="text-slate-800">{report.completedCore}/{report.totalCore}</strong>
              </span>
              <span>•</span>
              <span>
                Recommended: <strong className="text-slate-800">{report.completedRecommended}/{report.totalRecommended}</strong>
              </span>
              {report.optionalAdded > 0 && (
                <>
                  <span>•</span>
                  <span>
                    Optional Added: <strong className="text-emerald-700">{report.optionalAdded}</strong>
                  </span>
                </>
              )}
              {report.skippedCount > 0 && (
                <>
                  <span>•</span>
                  <span>
                    Skipped: <strong className="text-amber-700">{report.skippedCount}</strong>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {report.readinessState === "READY_TO_EXPORT" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ready to Export
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Clock className="w-3.5 h-3.5" /> In Progress
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Adaptive Next Step Hero Card */}
      {report.nextRecommendedStep && (
        <div className="p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Next Recommended Step
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100/80 text-blue-800 rounded-full">
                  Step {report.nextRecommendedStep.stepNumber} of {report.totalSteps}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                {report.nextRecommendedStep.label}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {report.nextRecommendedStep.shortDesc}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              {report.nextRecommendedStep.sectionId && (
                <button
                  onClick={() => handleOpenSection(report.nextRecommendedStep!.sectionId!)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Special Fresher Advice if Next Recommended is Experience */}
          {report.nextRecommendedStep.id === "experience" && (
            <div className="pt-2 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600">
                Student or Fresher without full-time work experience?
              </span>
              <button
                onClick={handleFresherSkipExperience}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white border border-blue-300 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors text-left sm:text-center shrink-0 cursor-pointer"
              >
                No professional experience yet &rarr; Add Projects instead
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. "What's Left?" Compact Panel & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Missing Recommended */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" /> Recommended Pathway
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {report.completedRecommended}/{report.totalRecommended} Completed
            </span>
          </div>

          <div className="space-y-1.5">
            {report.steps
              .filter((s) => s.level === "RECOMMENDED" && s.id !== "review")
              .map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-slate-200/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {step.isComplete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : step.isSkipped || step.isNotApplicable ? (
                      <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={`font-medium ${
                        step.isComplete
                          ? "text-slate-900 font-semibold"
                          : step.isSkipped
                          ? "text-slate-500 line-through"
                          : "text-slate-700"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {step.isComplete ? (
                      <button
                        onClick={() => step.sectionId && handleOpenSection(step.sectionId)}
                        className="text-[11px] font-medium text-slate-500 hover:text-blue-600 px-1.5 py-0.5"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => step.sectionId && handleOpenSection(step.sectionId)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Right Column: Optional Sections & Skip All Action */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FastForward className="w-3.5 h-3.5 text-slate-500" /> Optional Sections
            </span>
            {report.missingOptionalSteps.length > 0 && (
              <button
                onClick={handleSkipAllOptional}
                className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                title="Skip all remaining optional sections for now"
              >
                Skip All Optional
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {report.steps
              .filter((s) => s.level === "OPTIONAL")
              .map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-slate-200/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {step.isComplete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : step.isSkipped ? (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Skipped
                      </span>
                    ) : step.isNotApplicable ? (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        N/A
                      </span>
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={`font-medium ${
                        step.isComplete
                          ? "text-slate-900 font-semibold"
                          : step.isSkipped || step.isNotApplicable
                          ? "text-slate-400"
                          : "text-slate-600"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {step.isComplete ? (
                      <button
                        onClick={() => step.sectionId && handleOpenSection(step.sectionId)}
                        className="text-[11px] font-medium text-slate-500 hover:text-blue-600 px-1.5 py-0.5"
                      >
                        Edit
                      </button>
                    ) : step.isSkipped || step.isNotApplicable ? (
                      <button
                        onClick={() => handleRestore(step.id)}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800 px-1.5 py-0.5"
                      >
                        Add
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => step.sectionId && handleOpenSection(step.sectionId)}
                          className="text-[11px] font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => handleSkip(step.id)}
                          className="text-[11px] font-medium text-slate-400 hover:text-amber-600 px-1 py-0.5"
                          title="Skip for now"
                        >
                          Skip
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 4. Complete Stepper Navigation List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            All Resume Steps ({report.totalSteps})
          </h4>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterLevel("ALL")}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                filterLevel === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterLevel("RECOMMENDED")}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                filterLevel === "RECOMMENDED"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Essential & Recommended
            </button>
            <button
              onClick={() => setFilterLevel("OPTIONAL")}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                filterLevel === "OPTIONAL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Optional
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayedSteps.map((step) => {
            const isCurrent = currentStepId === step.id;

            return (
              <div
                key={step.id}
                id={step.targetId}
                data-saarvi-target={step.targetId}
                aria-current={isCurrent ? "step" : undefined}
                className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between space-y-3 ${
                  isCurrent
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                    : step.isComplete
                    ? "bg-white border-slate-200 hover:border-slate-300"
                    : step.isSkipped || step.isNotApplicable
                    ? "bg-slate-50/80 border-slate-200/80 opacity-80"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">
                      {String(step.stepNumber).padStart(2, "0")}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          step.level === "CORE"
                            ? "bg-purple-100 text-purple-700"
                            : step.level === "RECOMMENDED"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {step.level}
                      </span>

                      {/* Status indicator */}
                      {step.isComplete ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <Check className="w-2.5 h-2.5" /> Completed
                        </span>
                      ) : step.isSkipped ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <RotateCcw className="w-2.5 h-2.5" /> Skipped
                        </span>
                      ) : step.isNotApplicable ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          <Ban className="w-2.5 h-2.5" /> N/A
                        </span>
                      ) : isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                          Current
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          Not started
                        </span>
                      )}
                    </div>
                  </div>

                  <h5 className="text-sm font-bold text-slate-900">{step.label}</h5>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {step.shortDesc}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {step.sectionId ? (
                    <button
                      onClick={() => handleOpenSection(step.sectionId!)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        isCurrent
                          ? "bg-blue-600 text-white"
                          : step.isComplete
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      <span>{step.isComplete ? "Edit" : "Open Section"}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowReviewDetails(true)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
                    >
                      <span>Review</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}

                  {/* Skip and N/A Actions */}
                  {!step.isComplete && step.canSkip && (
                    <div className="flex items-center gap-1">
                      {step.isSkipped || step.isNotApplicable ? (
                        <button
                          onClick={() => handleRestore(step.id)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline px-1.5 py-1"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSkip(step.id)}
                            className="text-[11px] text-slate-400 hover:text-amber-600 font-medium px-1.5 py-1"
                            title="Skip for now"
                          >
                            Skip
                          </button>
                          {step.canMarkNotApplicable && (
                            <button
                              onClick={() => handleMarkNotApplicable(step.id)}
                              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium px-1.5 py-1"
                              title="Mark Not Applicable"
                            >
                              N/A
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Review Step & Export Readiness Banner */}
      <div
        id="resume-review"
        data-saarvi-target="resume-review"
        className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Review & Readiness
              </span>
              <span className="text-xs text-slate-300">• Saarvi 6.0</span>
            </div>
            <h4 className="text-base font-bold text-white">Review Your Resume</h4>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              {report.readinessMessage}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onPreview}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Resume</span>
            </button>
            <button
              onClick={onExportPdf}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Compact Review Checklist */}
        <div className="pt-3 border-t border-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
            {report.steps
              .filter((s) => s.id !== "review")
              .map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
                >
                  <span className="truncate pr-1 text-slate-200">{step.label}</span>
                  {step.isComplete ? (
                    <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  ) : step.isSkipped ? (
                    <span className="text-amber-400 text-[10px] shrink-0">↷ Skip</span>
                  ) : step.isNotApplicable ? (
                    <span className="text-slate-400 text-[10px] shrink-0">⊘ N/A</span>
                  ) : step.level === "CORE" ? (
                    <span className="text-red-400 font-bold shrink-0">! Missing</span>
                  ) : (
                    <span className="text-slate-400 text-[10px] shrink-0">○ Empty</span>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Blocking warnings if any core is missing */}
        {!report.canExport && report.exportBlockingReasons.length > 0 && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Required to Export:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {report.exportBlockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              <button
                onClick={() => handleOpenSection("contact")}
                className="mt-1 text-xs font-semibold text-white underline hover:text-red-100 block"
              >
                Open Personal Information &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
