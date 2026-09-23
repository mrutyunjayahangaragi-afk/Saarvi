"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Lock, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/context/AuthContext";

interface JobDetailAuthCardProps {
  returnUrl: string;
  companyName: string;
  title: string;
  location: string;
  employmentType: string;
  isInternship?: boolean;
}

export default function JobDetailAuthCard({
  returnUrl,
  companyName,
  title,
  location,
  employmentType,
  isInternship = false,
}: JobDetailAuthCardProps) {
  const { signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signupUrl = `/signup?next=${encodeURIComponent(returnUrl)}`;
  const loginUrl = `/login?next=${encodeURIComponent(returnUrl)}`;

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      await signInWithGoogle({ redirectTo: returnUrl });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to continue with Google. Please try email sign in.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
      {/* Lock Icon */}
      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-2xs">
        <Lock className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          {isInternship ? "Verified Internship" : "Verified Opportunity"}
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Create an account to view this opportunity
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Sign up to view full job specifications, company insights, and direct application links.
        </p>
      </div>

      {/* Teaser pill (no secrets/applyUrl leaked) */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{companyName}</p>
          <p className="text-base font-extrabold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{location} • {employmentType}</p>
        </div>
        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
          Member Access
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        <Link
          href={signupUrl}
          className="w-full min-h-[44px] py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <span>Create account</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Continue with Google */}
        <GoogleSignInButton
          onClick={handleGoogleSignIn}
          loading={googleLoading}
        />

        <div className="text-center pt-2">
          <span className="text-xs text-slate-500">Already have an account? </span>
          <Link
            href={loginUrl}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
