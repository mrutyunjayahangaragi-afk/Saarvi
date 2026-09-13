"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signInWithGoogle, verifyEmailOtp, resendVerificationOtp, user } = useAuth();

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
      router.push("/dashboard");
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
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ redirectTo: "/dashboard" });
      if (!isSupabaseConfigured()) {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to connect to Google authentication. Please try again.";
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-sm space-y-6">

            {/* 6-Digit Email Verification Screen */}
            {verificationPending ? (
              <div className="space-y-5 py-2">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Mail className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Check your email
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    We sent a 6-digit verification code to{" "}
                    <strong className="text-slate-800 break-all">{email}</strong>.
                    Enter the code below to verify your account.
                  </p>
                </div>

                {otpError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
                  >
                    {otpError}
                  </div>
                )}

                {resendNotice && (
                  <div
                    role="status"
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium"
                  >
                    {resendNotice}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="otp-code"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-center"
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
                      className="w-full text-center tracking-[0.4em] font-mono text-2xl py-3 px-4 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all placeholder:text-slate-300 placeholder:tracking-normal"
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

                <div className="pt-2 flex flex-col gap-2.5 text-center text-xs text-slate-500">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || otpLoading}
                    onClick={handleResendOtp}
                    className="hover:text-blue-600 font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Didn't receive a code? Resend Code"}
                  </button>

                  <div className="flex items-center justify-center gap-4 text-xs pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationPending(false);
                        setOtpError(null);
                        setResendNotice(null);
                      }}
                      className="text-slate-600 hover:text-slate-900 underline underline-offset-2"
                    >
                      Change Email
                    </button>
                    <span>•</span>
                    <Link
                      href="/login"
                      className="text-slate-600 hover:text-slate-900 underline underline-offset-2"
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
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Create your free account
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Unlock conversion history, saved resumes, and preferences
                  </p>
                </div>

                {/* Explicit Reassurance: Basic tools do not require an account */}
                <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex items-start gap-2.5 text-xs text-blue-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Good to know:</strong> Basic document tools do not require an account. You can use them directly without registering.
                  </span>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
                  >
                    {error}
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                        className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 text-white font-semibold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-sm hover:shadow hover-3d-lift cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider: OR */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
                      Or
                    </span>
                  </div>
                </div>

                {/* Continue with Google */}
                <GoogleSignInButton
                  onClick={handleGoogleSignIn}
                  loading={googleLoading}
                  disabled={loading}
                />

                {/* Footer Link */}
                <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
                  <div>
                    Already have an account?{" "}
                    <Link href="/login" className="text-blue-600 font-bold hover:underline">
                      Login
                    </Link>
                  </div>
                  <div>
                    <Link href="/tools" className="text-slate-400 hover:text-slate-700 font-medium hover:underline">
                      ← Continue as guest to tools
                    </Link>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
