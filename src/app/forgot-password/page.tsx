"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSubmitted(true);
    } catch {
      // Safe generic message to avoid email enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b1329] text-slate-900 dark:text-slate-100">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-9 shadow-sm space-y-6">

            {submitted ? (
              <div className="text-center space-y-4 py-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Check your inbox
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  If an account exists for <strong className="text-slate-800 dark:text-slate-200">{email}</strong>, we have sent instructions to reset your password.
                </p>
                <div className="pt-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to login</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center mb-1">
                    <SaarviMark size={48} />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Reset password
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Enter your email to receive a password recovery link
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-[#0d162e] transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 text-white font-semibold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-sm hover:shadow hover-3d-lift cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send reset link</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to login</span>
                  </Link>
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
