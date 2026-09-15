"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Loader2, ArrowRight, ShieldCheck, CheckCircle2, RotateCcw, Edit3 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SaarviMark } from "@/components/brand/SaarviLogo";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawEmail = searchParams.get("email") || "";
  const next = searchParams.get("next") || "/dashboard";

  const { verifyEmailOtp, resendVerificationOtp, user } = useAuth();

  const [email, setEmail] = useState(rawEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!rawEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // If already logged in & verified, forward to destination
  useEffect(() => {
    if (user && !verifiedSuccess) {
      router.push(next);
    }
  }, [user, next, router, verifiedSuccess]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const [expiresIn, setExpiresIn] = useState<number>(600); // 10 minutes

  // Expiry countdown timer
  useEffect(() => {
    if (expiresIn <= 0) return;
    const interval = setInterval(() => {
      setExpiresIn((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresIn]);

  // Format mm:ss
  const formatExpiryTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendNotice(null);

    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError("Please enter the verification code sent to your email.");
      return;
    }

    if (expiresIn <= 0) {
      setError("Your verification code has expired. Please click 'Resend Code' below.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await verifyEmailOtp({ email: email.trim(), code: cleanCode });
      setVerifiedSuccess(true);
      setTimeout(() => {
        router.push(next);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid or expired verification code. Please request a new code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending || loading) return;
    setError(null);
    setResendNotice(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address to resend the code.");
      return;
    }

    setResending(true);
    try {
      await resendVerificationOtp(email.trim());
      setResendNotice("A new verification code has been dispatched to your inbox.");
      setResendCooldown(60);
      setExpiresIn(600); // Reset 10-minute expiry
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to resend verification code. Please wait a moment and try again.";
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl space-y-6">
      {/* Header Icon & Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/60 text-blue-600 shadow-2xs mx-auto">
          <Mail className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Verify your email
        </h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          We sent a verification code to your email address to activate your Saarvi account.
        </p>
      </div>

      {/* Email Display / Change Email */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wider text-[10px]">Recipient Email</span>
          <button
            type="button"
            onClick={() => setIsEditingEmail(!isEditingEmail)}
            className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 cursor-pointer min-h-[32px] px-1"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isEditingEmail ? "Save" : "Change Email"}</span>
          </button>
        </div>

        {isEditingEmail ? (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        ) : (
          <div className="text-sm font-bold text-slate-800 break-all">
            {email || <span className="text-slate-400 italic">No email specified</span>}
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium leading-relaxed">
          {error}
        </div>
      )}

      {resendNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium leading-relaxed flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{resendNotice}</span>
        </div>
      )}

      {verifiedSuccess ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-emerald-900">Email Verified Successfully!</h3>
          <p className="text-xs text-emerald-700">Routing you to your private workspace...</p>
        </div>
      ) : (
        /* Verification Form */
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="otp-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Verification Code
              </label>
              <span className={`text-[11px] font-mono font-medium ${expiresIn <= 60 ? 'text-rose-600 font-bold animate-pulse' : 'text-slate-500'}`}>
                Code expires in: <strong>{formatExpiryTime(expiresIn)}</strong>
              </span>
            </div>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8))}
              placeholder="123456"
              className="w-full text-center tracking-[0.4em] font-mono text-xl sm:text-2xl font-bold bg-white border border-slate-300 rounded-2xl py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
              required
            />
            <p className="text-[11px] text-slate-400 text-center">
              Check your inbox and spam folder for the one-time code.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || code.trim().length < 6 || expiresIn <= 0}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Security Code...</span>
              </>
            ) : (
              <>
                <span>Verify Email &amp; Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Resend Code & Navigation */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending || loading}
              className="min-h-[36px] px-2 text-slate-600 hover:text-blue-600 font-medium inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
              <span>
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </span>
            </button>

            <Link
              href="/login"
              className="min-h-[36px] flex items-center px-2 text-slate-500 hover:text-slate-800 font-medium transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </form>
      )}

      {/* Security notice */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>One-time expiring token. Never shared with third parties.</span>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xl text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-xs text-slate-500">Loading security verification...</p>
            </div>
          }
        >
          <VerifyEmailForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
