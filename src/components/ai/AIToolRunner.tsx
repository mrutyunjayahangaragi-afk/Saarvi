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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs text-slate-700 shadow-xs">
        <div className="flex items-center gap-2">
          {isExternal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800 border border-amber-200">
              EXTERNAL PROCESSING
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800 border border-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              100% LOCAL IN-BROWSER
            </span>
          )}
          <span className="text-slate-600">
            {isExternal
              ? "Explicit user consent required. Only selected document text is transmitted."
              : "Zero network transmission. Runs securely inside your web browser."}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs text-slate-900">
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
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shadow-xs">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">{statusMessage}</h3>
              <p className="text-xs text-slate-500">
                Data minimization: transmitting only required document contents.
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              Cancel Operation
            </button>
          </div>
        )}

        {/* Error / Cancelled Phase */}
        {(state === "ERROR" || state === "CANCELLED") && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {state === "CANCELLED" ? "Operation Cancelled" : "Processing Failed"}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
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

        {/* Result Ready Phase */}
        {state === "RESULT_READY" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Disclaimer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{resultTitle}</h3>
                {citedPages && citedPages.length > 0 && (
                  <p className="text-xs text-blue-600 font-medium mt-0.5">
                    Cited Sources: Page {citedPages.join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveToConversation}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                >
                  <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                  {savedToConv ? "Saved Locally!" : "Save Session"}
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Clear temporary session data"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Disclaimer Alert */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed font-medium">
              <strong className="font-bold text-amber-900">Notice:</strong>{" "}
              {tool.supportsOCR
                ? "OCR results may contain recognition errors. Review and edit the text below as needed before downloading."
                : "AI-generated results may contain mistakes. Verify important information against your original source document."}
            </div>

            {/* Editable Text Area for User Review */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Extracted Text (Editable for Review):
              </label>
              <textarea
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                rows={12}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y transition-colors"
              />
            </div>

            {/* Download System (Single Download Preservation) */}
            {downloadResult && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Export Output:
                  </span>
                  {allowSearchablePdf && (
                    <button
                      onClick={handleExportSearchablePdf}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700 hover:underline cursor-pointer"
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
