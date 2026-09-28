"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { X, Sparkles, Shield, UserPlus, ArrowRight, Lock } from "lucide-react";

interface FriendlyAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolName: string;
  toolSlug?: string;
  benefitDescription?: string;
  returnUrl?: string;
  requiredTier?: "AUTH_REQUIRED" | "PRO";
}

/**
 * Friendly Guest Access Dialog
 *
 * Implements Section 5 of Saarvi UX requirements:
 * When a guest clicks an account-required or Pro tool, rather than
 * abruptly throwing them to an unexplained login page, explain the
 * concrete benefit, offer Google / Email auth options, allow dismissing
 * with "Not now", and preserve the destination return URL.
 */
export default function FriendlyAccessModal({
  isOpen,
  onClose,
  toolName,
  toolSlug,
  benefitDescription,
  returnUrl = "/tools",
  requiredTier = "AUTH_REQUIRED",
}: FriendlyAccessModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPro = requiredTier === "PRO";
  const defaultBenefit = isPro
    ? `Unlock full access to ${toolName}, bypass usage limits, and enable advanced AI intelligence with Saarvi Pro.`
    : `Create a free Saarvi account to save versions, access ${toolName}, and organize your progress across devices.`;

  const encodedReturn = encodeURIComponent(returnUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-7 relative overflow-hidden space-y-6 animate-in zoom-in-95 duration-200"
      >
        {/* Top Accent Gradient Bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            isPro
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600"
              : "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500"
          }`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-3 pt-2">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs ${
              isPro
                ? "bg-amber-50 border border-amber-200 text-amber-600"
                : "bg-blue-50 border border-blue-200 text-blue-600"
            }`}
          >
            {isPro ? <Sparkles className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>

          <div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isPro
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-blue-50 border border-blue-200 text-blue-700"
              }`}
            >
              {isPro ? "Saarvi Pro Required" : "Free Account Feature"}
            </span>

            <h3
              id="access-modal-title"
              className="text-xl font-extrabold text-slate-900 tracking-tight mt-2"
            >
              {isPro
                ? `Upgrade to use ${toolName}`
                : `Create a free account to use ${toolName}`}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5">
              {benefitDescription || defaultBenefit}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {isPro ? (
            <Link
              href={`/pricing?return=${encodedReturn}`}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer min-h-[44px]"
            >
              <span>Explore Pro Plans</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              {/* Continue with Email / Signup */}
              <Link
                href={`/signup?redirect=${encodedReturn}`}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer min-h-[44px]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Continue with Email (Free)</span>
              </Link>

              {/* Already have an account */}
              <Link
                href={`/login?redirect=${encodedReturn}`}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer min-h-[44px]"
              >
                <span>Already have an account? Sign In</span>
              </Link>
            </>
          )}

          {/* Dismiss button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer min-h-[36px]"
          >
            Not now
          </button>
        </div>

        {/* Privacy reassurance */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Your files and data remain strictly private by design.</span>
        </div>
      </div>
    </div>
  );
}
