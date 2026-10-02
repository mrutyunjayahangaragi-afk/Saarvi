"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePlatform } from "@/context/PlatformContext";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeInternalRedirectUrl } from "@/lib/security/url-security";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || "/dashboard";
  const safeNext = sanitizeInternalRedirectUrl(rawNext, "/dashboard");

  const { signUp, signInWithGoogle, verifyEmailOtp, resendVerificationOtp, user } = useAuth();
  const { isRegistrationEnabled } = usePlatform();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

  // OTP Verification state
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isRegistrationEnabled) {
      setError("New user registrations are currently paused by platform administrators.");
      return;
    }

    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signUp({ email, password, fullName });
      // If immediate session exists (e.g. auto-confirm/mock), route to dashboard
      if (user) {
        router.push("/dashboard");
      } else {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "We couldn't create your account. Please try again.";
      if (msg.toLowerCase().includes("check your email") || msg.toLowerCase().includes("confirmation")) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    const cleanToken = otpCode.trim();

    if (!cleanToken || cleanToken.length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    setOtpLoading(true);
    try {
      await verifyEmailOtp({ email, code: cleanToken });
      router.push(safeNext);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code. Please try again.";
      setOtpError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpLoading) return;
    setOtpError(null);
    setResendNotice(null);
    try {
      await resendVerificationOtp(email);
      setResendNotice("A new 6-digit verification code has been dispatched to your inbox.");
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to resend verification code. Please try again.";
      setOtpError(msg);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;
    setError(null);
    if (!isRegistrationEnabled) {
      setError("New user registrations are currently paused by platform administrators.");
      return;
    }
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ redirectTo: safeNext });
      if (!isSupabaseConfigured()) {
        router.push(safeNext);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to connect to Google authentication. Please try again.";
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-9 shadow-sm space-y-6">

            {/* 6-Digit Email Verification Screen */}
            {verificationPending ? (
              <div className="space-y-5 py-2">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    <Mail className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Check your email
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    We sent a 6-digit verification code to{" "}
                    <strong className="text-slate-800 dark:text-slate-200 break-all">{email}</strong>.
                    Enter the code below to verify your account.
                  </p>
                </div>

                {otpError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium"
                  >
                    {otpError}
                  </div>
                )}

                {resendNotice && (
                  <div
                    role="status"
                    className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-medium"
                  >
                    {resendNotice}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="otp-code"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center"
                    >
                      Verification Code
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                        setOtpCode(val);
                      }}
                      placeholder="123456"
                      className="w-full text-center tracking-[0.4em] font-mono text-2xl py-3 px-4 bg-slate-50 dark:bg-[#0b1329] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0b1329] focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:tracking-normal"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.trim().length !== 6}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Email</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-2 flex flex-col gap-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || otpLoading}
                    onClick={handleResendOtp}
                    className="hover:text-blue-600 dark:hover:text-blue-400 font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Didn't receive a code? Resend Code"}
                  </button>

                  <div className="flex items-center justify-center gap-4 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationPending(false);
                        setOtpError(null);
                        setResendNotice(null);
                      }}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-2"
                    >
                      Change Email
                    </button>
                    <span>•</span>
                    <Link
                      href="/login"
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-2"
                    >
                      Back to Login
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Brand & Headline */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center mb-1">
                    <SaarviMark size={48} className="shadow-xs" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Create your free account
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Unlock conversion history, saved resumes, and preferences
                  </p>
                </div>

                {/* Explicit Reassurance: Basic tools do not require an account */}
                <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Good to know:</strong> Basic document tools do not require an account. You can use them directly without registering.
                  </span>
                </div>

                {!isRegistrationEnabled && (
                  <div
                    role="alert"
                    className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1.5"
                  >
                    <div className="font-bold flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Registration Paused</span>
                    </div>
                    <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
                      New user registration has been temporarily paused by platform administrators. Existing members can continue to log in.
                    </p>
                    <div className="pt-1">
                      <Link href="/login" className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline">
                        Sign in to existing account →
                      </Link>
                    </div>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium"
                  >
                    {error}
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-[#0b1329] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-[#0b1329] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-[#0b1329] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-[#0b1329] transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !isRegistrationEnabled}
                    className={`w-full py-3 min-h-[44px] font-semibold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-sm ${
                      !isRegistrationEnabled
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                        : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 text-white hover:shadow hover-3d-lift cursor-pointer"
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span>{isRegistrationEnabled ? "Create account" : "Registration Paused"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider: OR */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-[#111c38] px-3 text-slate-400 font-semibold tracking-wider">
                      Or
                    </span>
                  </div>
                </div>

                {/* Continue with Google */}
                <GoogleSignInButton
                  onClick={handleGoogleSignIn}
                  loading={googleLoading}
                  disabled={loading || !isRegistrationEnabled}
                />

                {/* Footer Link */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                  <div>
                    Already have an account?{" "}
                    <Link
                      href={safeNext !== "/dashboard" ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Login
                    </Link>
                  </div>
                  <div>
                    <Link href="/tools" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium hover:underline">
                      ← Continue as guest to tools
                    </Link>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b1329]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Suspense fallback={<div className="text-center text-sm text-slate-400">Loading...</div>}>
          <SignupForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
