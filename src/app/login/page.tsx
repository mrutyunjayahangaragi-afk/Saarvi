"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const verified = searchParams.get("verified");

  const { signIn, signInWithGoogle, verifyEmailOtp, resendVerificationOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Unverified account verification state
  const [unverifiedPending, setUnverifiedPending] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendNotice(null);

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await signIn({ email, password });
      router.push(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "We couldn't sign you in. Please check your email and password.";
      if (msg.includes("EMAIL_NOT_CONFIRMED")) {
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
    setError(null);
    const cleanToken = otpCode.trim();

    if (!cleanToken || cleanToken.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setOtpLoading(true);
    try {
      await verifyEmailOtp({ email, code: cleanToken });
      router.push(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code. Please try again.";
      setError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpLoading) return;
    setError(null);
    setResendNotice(null);
    try {
      await resendVerificationOtp(email);
      setResendNotice("A new 6-digit verification code has been dispatched to your inbox.");
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to resend verification code. Please try again.";
      setError(msg);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ redirectTo: next });
      if (!isSupabaseConfigured()) {
        router.push(next);
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
      {/* Centered White Authentication Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-sm space-y-6">
        
        {/* Brand & Headline */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <SaarviMark size={48} className="shadow-xs" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Continue with your Saarvi account
          </p>
        </div>

        {/* Reassurance Banner: Basic tools do not require login */}
        <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex items-start gap-2.5 text-xs text-blue-900">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong>Reminder:</strong> Basic document tools work immediately without an account.
          </span>
        </div>

        {verified && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Email verified successfully! You can now sign in.</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
          >
            {error}
          </div>
        )}

        {unverifiedPending ? (
          <div className="space-y-5 py-2">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Verification Required
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Please enter the 6-digit verification code sent to{" "}
                <strong className="text-slate-800 break-all">{email}</strong>.
              </p>
            </div>

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
                  htmlFor="login-otp-code"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-center"
                >
                  6-Digit Verification Code
                </label>
                <input
                  id="login-otp-code"
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
                    <span>Verify & Sign In</span>
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
                  : "Resend Code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setUnverifiedPending(false);
                  setError(null);
                  setResendNotice(null);
                }}
                className="text-slate-600 hover:text-slate-900 underline underline-offset-2 pt-1 border-t border-slate-100"
              >
                ← Back to standard login
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 text-white font-semibold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-sm hover:shadow hover-3d-lift cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
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
                Don&apos;t have an account?{" "}
                <Link
                  href={next !== "/dashboard" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Create account
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
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Suspense fallback={<div className="text-center text-sm text-slate-400">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
