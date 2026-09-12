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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          {isExternal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-400 border border-amber-500/20">
              EXTERNAL PROCESSING
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% LOCAL IN-BROWSER
            </span>
          )}
          <span>
            {isExternal
              ? "Explicit user consent required. Only selected document text is transmitted."
              : "Zero network transmission. Runs securely inside your web browser."}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
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
              <div className="absolute h-full w-full animate-ping rounded-full bg-indigo-500/20" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">{statusMessage}</h3>
              <p className="text-xs text-slate-400">
                Data minimization: transmitting only required document contents.
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Cancel Operation
            </button>
          </div>
        )}

        {/* Error / Cancelled Phase */}
        {(state === "ERROR" || state === "CANCELLED") && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-semibold text-white">
                {state === "CANCELLED" ? "Operation Cancelled" : "Processing Failed"}
              </h3>
              <p className="text-xs text-slate-400">
                {errorMessage || "The operation was interrupted. Your local document remains safe."}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {/* Result Ready Phase */}
        {state === "RESULT_READY" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Disclaimer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{resultTitle}</h3>
                {citedPages && citedPages.length > 0 && (
                  <p className="text-xs text-indigo-400 mt-0.5">
                    Cited Sources: Page {citedPages.join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveToConversation}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                  {savedToConv ? "Saved Locally!" : "Save Session"}
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-red-400 transition-colors"
                  title="Clear temporary session data"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Disclaimer Alert */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90 leading-relaxed">
              <strong className="font-semibold text-amber-300">Notice:</strong>{" "}
              {tool.supportsOCR
                ? "OCR results may contain recognition errors. Review and edit the text below as needed before downloading."
                : "AI-generated results may contain mistakes. Verify important information against your original source document."}
            </div>

            {/* Editable Text Area for User Review */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">
                Extracted Text (Editable for Review):
              </label>
              <textarea
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                rows={12}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
              />
            </div>

            {/* Download System (Single Download Preservation) */}
            {downloadResult && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Export Output:
                  </span>
                  {allowSearchablePdf && (
                    <button
                      onClick={handleExportSearchablePdf}
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
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
