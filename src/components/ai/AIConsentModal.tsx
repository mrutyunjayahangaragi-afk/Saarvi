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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl text-slate-900">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute right-5 top-5 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 mb-1">
              EXTERNAL PROCESSING
            </div>
            <h2 id="consent-modal-title" className="text-lg font-bold text-slate-900">
              External Processing Notice
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed mb-6 font-normal">
          <p>
            To use <strong className="text-slate-900 font-semibold">{featureName}</strong>, the selected
            document or extracted text may be sent to an external processing provider.
          </p>
          <p className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
            <strong className="text-slate-900 font-bold">Data Minimization Guarantee:</strong> Only
            the specific text or image content required for this feature will be shared.
            Your full workspace, career profiles, grades, and payment details are never
            transmitted.
          </p>
          <p className="text-xs text-slate-500">
            OCR and AI results may contain errors. Please review extracted information before
            relying on it.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors border border-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2.5 text-xs font-bold text-white transition-colors shadow-xs cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
