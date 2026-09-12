"use client";

import { useState } from "react";
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
  const { signUp, signInWithGoogle } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

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
      // If user session is immediate (e.g. mock or auto-confirm), navigate to dashboard
      // Otherwise show email verification screen
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "We couldn't create your account. Please try again.";
      if (msg.toLowerCase().includes("check your email") || msg.toLowerCase().includes("confirmation")) {
        setVerificationPending(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
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

            {/* If waiting for email verification */}
            {verificationPending ? (
              <div className="text-center space-y-5 py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 border border-blue-200">
                  <Mail className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Check your email
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                    We&apos;ve sent a verification link to <strong className="text-slate-800">{email}</strong>. Please click the link to activate your account.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href="/login"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all text-center"
                  >
                    Back to login
                  </Link>
                  <button
                    type="button"
                    onClick={() => alert("Verification link resent.")}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    Resend email
                  </button>
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
