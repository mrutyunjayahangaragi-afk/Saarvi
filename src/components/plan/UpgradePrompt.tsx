"use client";

import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, ShieldCheck, Lock, Clock, LogIn } from 'lucide-react';
import { FeatureDefinition } from '@/types/plan';

interface UpgradePromptProps {
  feature?: FeatureDefinition | null;
  reason?: 'pro_required' | 'login_required' | 'coming_soon';
  customMessage?: string;
  variant?: 'card' | 'banner' | 'modal';
  onClose?: () => void;
  className?: string;
}

export default function UpgradePrompt({
  feature,
  reason = 'pro_required',
  customMessage,
  variant = 'card',
  onClose,
  className = '',
}: UpgradePromptProps) {
  if (reason === 'login_required') {
    return (
      <div
        className={`p-6 sm:p-8 rounded-3xl border border-blue-200 bg-gradient-to-b from-blue-50/60 to-white text-center space-y-4 shadow-xs ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto border border-blue-200">
          <LogIn className="w-6 h-6" />
        </div>

        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Sign In to Continue
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {customMessage || (feature ? `An account is required to access ${feature.name}.` : 'Create a free account or sign in to save your personal preferences and workspace.')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <span>Sign In</span>
          </Link>
        </div>

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Free forever. Zero file tracking.</span>
        </div>
      </div>
    );
  }

  // Reason is 'pro_required' or 'coming_soon'
  return (
    <div
      className={`p-6 sm:p-8 rounded-3xl border border-purple-200 bg-gradient-to-b from-purple-50/40 via-indigo-50/20 to-white text-center space-y-4 shadow-xs ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-xs">
        <Sparkles className="w-6 h-6" />
      </div>

      <div className="space-y-1.5 max-w-md mx-auto">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold tracking-wide uppercase">
          <Clock className="w-3 h-3 text-purple-600" />
          <span>Planned Pro Feature</span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-900">
          {feature?.name ? `${feature.name} is Coming Soon` : 'This feature will be available with Saarvi Pro'}
        </h3>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          {customMessage ||
            feature?.proNotice ||
            'Saarvi Pro is in active architectural development. It will introduce advanced batch queues, higher file limits, and optical document enhancements.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
        <Link
          href="/pricing"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-xs"
        >
          <span>View Pro Roadmap</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/tools"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
        >
          <span>Back to Free Tools</span>
        </Link>
      </div>

      <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>No subscriptions active at this stage. 100% free basic tools.</span>
      </div>
    </div>
  );
}
