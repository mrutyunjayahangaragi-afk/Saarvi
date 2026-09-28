"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Briefcase, CheckCircle2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { SaarviMark } from "@/components/brand/SaarviLogo";

interface JobsAuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnUrl?: string;
  searchSummary?: {
    role?: string;
    location?: string;
    experience?: string;
  };
}

export default function JobsAuthGateModal({
  isOpen,
  onClose,
  returnUrl = "/jobs",
  searchSummary,
}: JobsAuthGateModalProps) {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLAnchorElement>(null);

  // Close on Escape & trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Autofocus primary CTA
    setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 50);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const signupUrl = `/signup?next=${encodeURIComponent(returnUrl)}`;
  const loginUrl = `/login?next=${encodeURIComponent(returnUrl)}`;

  const handleGoogleAuth = async () => {
    if (googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ redirectTo: returnUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to complete Google authentication. Please try again.";
      setError(msg);
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jobs-auth-gate-title"
      aria-describedby="jobs-auth-gate-desc"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication dialog"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand & Icon Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
            <SaarviMark size={28} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Saarvi Career Intelligence</span>
            </div>
            <h2 id="jobs-auth-gate-title" className="text-xl font-extrabold text-slate-900 mt-1">
              Create a free Saarvi account to search jobs and internships
            </h2>
          </div>
        </div>

        {/* Explanatory Copy */}
        <p id="jobs-auth-gate-desc" className="text-sm text-slate-600 leading-relaxed">
          Sign up to search verified opportunities, save jobs, and track your applications. Your search query is saved and will resume automatically.
        </p>

        {/* Search Context Pill (if guest typed search criteria) */}
        {searchSummary && (searchSummary.role || searchSummary.location) && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-900">
                {searchSummary.role || "All Opportunities"}
              </span>
              {searchSummary.location && (
                <span className="text-slate-500">in {searchSummary.location}</span>
              )}
            </div>
            <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-semibold">
              Search Intent Saved
            </span>
          </div>
        )}

        {/* Value Proposition Workspace Highlights */}
        <div className="bg-blue-50/50 border border-blue-100/80 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Your Saarvi Opportunity Workspace
          </p>
          <ul className="text-xs text-slate-600 space-y-1.5">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Search real opportunities from verified companies</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Save opportunities &amp; track application stages</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Match opportunities with your resume &amp; skills</span>
            </li>
          </ul>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl" role="alert">
            {error}
          </div>
        )}

        {/* Action CTAs */}
        <div className="space-y-3 pt-1">
          {/* Option 1: Continue with Google */}
          <GoogleSignInButton
            onClick={handleGoogleAuth}
            loading={googleLoading}
            disabled={googleLoading}
            text="Continue with Google"
          />

          {/* Option 2: Continue with Email */}
          <Link
            ref={primaryButtonRef}
            href={signupUrl}
            onClick={onClose}
            aria-label="Continue with Email / Create account"
            className="w-full min-h-[44px] py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-800 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            <span>Continue with Email</span>
            <span className="sr-only">Create account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Secondary CTA: Log in */}
          <div className="text-center pt-2">
            <span className="text-xs text-slate-500">Already have an account? </span>
            <Link
              href={loginUrl}
              onClick={onClose}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
