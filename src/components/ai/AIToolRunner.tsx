"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Bookmark,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Download,
  Search,
} from "lucide-react";
import { ToolDefinition } from "@/types/tool";
import { AIOperationState } from "@/types/ai";
import { AIConsentModal } from "./AIConsentModal";
import { hasGivenConsent, recordConsent } from "@/lib/ai/consent/consent-manager";
import { determineProcessingMode } from "@/lib/ai/consent/decision-engine";
import ResultDownload from "@/components/common/ResultDownload";
import { SingleFileResult } from "@/lib/tools/types";
import { conversationService } from "@/lib/services/conversationService";
import { createPdfFromExtractedText } from "@/lib/ocr/pdf-searchable";
import { revealDestination } from "@/lib/ux/action-destination";

interface AIToolRunnerProps {
  tool: ToolDefinition;
  onExecute: (signal: AbortSignal) => Promise<{
    text: string;
    details?: Record<string, unknown>;
    citedPages?: number[];
  }>;
  inputRender: (props: {
    disabled: boolean;
    onStart: () => void;
  }) => React.ReactNode;
  resultTitle?: string;
  defaultOutputFilename?: string;
  allowSearchablePdf?: boolean;
}

export function AIToolRunner({
  tool,
  onExecute,
  inputRender,
  resultTitle = "Extracted / Generated Output",
  defaultOutputFilename = "saarvi-output.txt",
  allowSearchablePdf = false,
}: AIToolRunnerProps) {
  const [state, setState] = useState<AIOperationState>("IDLE");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [outputText, setOutputText] = useState<string>("");
  const [citedPages, setCitedPages] = useState<number[] | undefined>();
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToConv, setSavedToConv] = useState<boolean>(false);
  const [downloadResult, setDownloadResult] = useState<SingleFileResult | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Trigger processing pipeline
  const handleInitiate = useCallback(() => {
    const mode = determineProcessingMode(tool);

    if (mode === "EXTERNAL_CONSENT_REQUIRED" && !hasGivenConsent()) {
      setState("CONSENT_REQUIRED");
      setShowConsentModal(true);
      return;
    }

    startExecution();
  }, [tool]);

  const handleConsentConfirm = () => {
    recordConsent();
    setShowConsentModal(false);
    startExecution();
  };

  const handleConsentCancel = () => {
    setShowConsentModal(false);
    setState("IDLE");
  };

  const startExecution = async () => {
    setState("PROCESSING");
    setStatusMessage(
      tool.supportsOCR ? "Extracting text with OCR..." : "Processing document with AI..."
    );
    setErrorMessage("");
    setDownloadResult(null);
    setSavedToConv(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { text, citedPages: pages } = await onExecute(controller.signal);
      setOutputText(text);
      setCitedPages(pages);
      setState("RESULT_READY");

      setTimeout(() => {
        revealDestination({
          target: "#ai-tool-result",
          fallbackTarget: "[data-saarvi-target='tool-result']",
          mode: "result",
          focus: true,
          reason: "ai_tool_completed",
        });
      }, 100);

      // Prepare text download blob
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      setDownloadResult({
        type: "single",
        blob,
        filename: defaultOutputFilename,
        originalSize: text.length,
        newSize: blob.size,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setState("CANCELLED");
        setStatusMessage("Operation was cancelled.");
      } else {
        setState("ERROR");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during processing."
        );
        setTimeout(() => {
          revealDestination({
            target: "#tool-error",
            fallbackTarget: "[data-saarvi-target='tool-error']",
            mode: "error",
            focus: true,
            reason: "ai_tool_error",
          });
        }, 100);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState("CANCELLED");
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleSaveToConversation = async () => {
    if (!outputText) return;
    try {
      const conv = await conversationService.createConversation(
        "guest",
        `${tool.name} Session`
      );
      await conversationService.sendMessage(
        conv.id,
        "USER",
        `Ran ${tool.name} on document.`
      );
      await conversationService.sendMessage(conv.id, "ASSISTANT", outputText);
      setSavedToConv(true);
      setTimeout(() => setSavedToConv(false), 3000);
    } catch {}
  };

  const handleExportSearchablePdf = async () => {
    if (!outputText) return;
    try {
      setStatusMessage("Generating PDF document...");
      const pdfBytes = await createPdfFromExtractedText(tool.name, [
        { pageNumber: 1, text: outputText },
      ]);
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      setDownloadResult({
        type: "single",
        blob,
        filename: defaultOutputFilename.replace(/\.txt$/, ".pdf"),
        originalSize: outputText.length,
        newSize: blob.size,
      });
    } catch (err: unknown) {
      setErrorMessage("Failed to build PDF export.");
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState("IDLE");
    setOutputText("");
    setErrorMessage("");
    setStatusMessage("");
    setDownloadResult(null);
  };

  const isExternal = determineProcessingMode(tool) === "EXTERNAL_CONSENT_REQUIRED";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Privacy Notice Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111c38] px-4 py-3 text-xs text-slate-700 dark:text-slate-300 shadow-xs">
        <div className="flex items-center gap-2">
          {isExternal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              EXTERNAL PROCESSING
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              100% LOCAL IN-BROWSER
            </span>
          )}
          <span className="text-slate-600 dark:text-slate-400">
            {isExternal
              ? "Explicit user consent required. Only selected document text is transmitted."
              : "Zero network transmission. Runs securely inside your web browser."}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111c38] p-6 sm:p-8 shadow-xs text-slate-900 dark:text-white">
        {/* Input Phase */}
        {state === "IDLE" && (
          <div className="space-y-6">
            {inputRender({
              disabled: false,
              onStart: handleInitiate,
            })}
          </div>
        )}

        {/* Processing Phase */}
        {(state === "PROCESSING" || state === "PREPARING") && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{statusMessage}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data minimization: transmitting only required document contents.
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
            >
              Cancel Operation
            </button>
          </div>
        )}

        {/* Cancelled Phase */}
        {state === "CANCELLED" && (
          <div
            id="tool-error"
            data-saarvi-target="tool-error"
            tabIndex={-1}
            className="flex flex-col items-center justify-center py-12 text-center space-y-4 saarvi-destination-target outline-hidden"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Operation Cancelled
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {errorMessage || "The operation was interrupted. Your local document remains safe."}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {/* Error Phase with accessible input recovery */}
        {state === "ERROR" && (
          <div className="space-y-6">
            <div
              id="tool-error"
              data-saarvi-target="tool-error"
              tabIndex={-1}
              className="flex items-start gap-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 saarvi-destination-target outline-hidden"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Processing Issue
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  {errorMessage || "The operation could not be completed. Please adjust your file and try again."}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="shrink-0 text-xs font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100 underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>

            {inputRender({
              disabled: false,
              onStart: handleInitiate,
            })}
          </div>
        )}

        {/* Result Ready Phase */}
        {state === "RESULT_READY" && (
          <div
            id="ai-tool-result"
            data-saarvi-target="tool-result"
            tabIndex={-1}
            className="space-y-6 animate-in fade-in duration-300 saarvi-destination-target outline-hidden"
          >
            {/* Header & Disclaimer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{resultTitle}</h3>
                {citedPages && citedPages.length > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                    Cited Sources: Page {citedPages.join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveToConversation}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
                >
                  <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                  {savedToConv ? "Saved Locally!" : "Save Session"}
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                  title="Clear temporary session data"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Disclaimer Alert */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
              <strong className="font-bold text-amber-900 dark:text-amber-200">Notice:</strong>{" "}
              {tool.supportsOCR
                ? "OCR results may contain recognition errors. Review and edit the text below as needed before downloading."
                : "AI-generated results may contain mistakes. Verify important information against your original source document."}
            </div>

            {/* Editable Text Area for User Review */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Extracted Text (Editable for Review):
              </label>
              <textarea
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                rows={12}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-4 font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y transition-colors"
              />
            </div>

            {/* Download System (Single Download Preservation) */}
            {downloadResult && (
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Export Output:
                  </span>
                  {allowSearchablePdf && (
                    <button
                      onClick={handleExportSearchablePdf}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      Export as Formatted PDF
                    </button>
                  )}
                </div>
                <ResultDownload result={downloadResult} onReset={handleReset} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* External Processing Consent Modal */}
      <AIConsentModal
        isOpen={showConsentModal}
        featureName={tool.name}
        onConfirm={handleConsentConfirm}
        onCancel={handleConsentCancel}
      />
    </div>
  );
}
