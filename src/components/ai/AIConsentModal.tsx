"use client";

import React from "react";
import { ShieldAlert, ExternalLink, X, Check } from "lucide-react";

interface AIConsentModalProps {
  isOpen: boolean;
  featureName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AIConsentModal({
  isOpen,
  featureName,
  onConfirm,
  onCancel,
}: AIConsentModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl text-slate-100">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20 mb-1">
              EXTERNAL PROCESSING
            </div>
            <h2 id="consent-modal-title" className="text-lg font-semibold text-white">
              External Processing Notice
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6">
          <p>
            To use <strong className="text-white">{featureName}</strong>, the selected
            document or extracted text may be sent to an external processing provider.
          </p>
          <p className="rounded-lg bg-slate-800/60 p-3 border border-slate-700/60 text-xs text-slate-300">
            <strong className="text-slate-200">Data Minimization Guarantee:</strong> Only
            the specific text or image content required for this feature will be shared.
            Your full workspace, career profiles, grades, and payment details are never
            transmitted.
          </p>
          <p className="text-xs text-slate-400">
            OCR and AI results may contain errors. Please review extracted information before
            relying on it.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 active:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30"
          >
            <Check className="h-4 w-4" />
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
