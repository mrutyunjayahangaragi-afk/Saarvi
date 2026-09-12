"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Loader2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import PlanBadge from '@/components/plan/PlanBadge';

type ConfirmationState =
  | 'confirming'      // Polling server for webhook delivery
  | 'active'          // Entitlement verified on server
  | 'still_processing'// Max polling time reached (30s)
  | 'failed';         // Explicitly failed or cancelled

function CheckoutConfirmationContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { refreshPlan } = usePlan();

  const statusParam = searchParams.get('status');
  const sessionId = searchParams.get('session_id');
  const paymentId = searchParams.get('payment_id');

  const [confirmationState, setConfirmationState] = useState<ConfirmationState>(() => {
    if (statusParam === 'failed' || statusParam === 'cancelled') return 'failed';
    return 'confirming';
  });
  const [checking, setChecking] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // Maximum 15 attempts * 2 seconds = 30 seconds bounded polling
  const MAX_POLLS = 15;

  // Server-authoritative status query. NEVER activate based solely on query params.
  const verifySubscriptionStatus = useCallback(async () => {
    if (!user) return;
    setChecking(true);

    try {
      const res = await fetch(`/api/billing/subscription?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        const sub = data.data?.subscription || data.subscription;
        if (sub && (sub.status === 'ACTIVE' || sub.status === 'TRIALING')) {
          setConfirmationState('active');
          refreshPlan();
          return;
        } else if (sub && sub.status === 'PAST_DUE') {
          setConfirmationState('failed');
          return;
        }
      }
    } catch (err) {
      console.warn('Subscription polling verification error:', err);
    } finally {
      setChecking(false);
    }
  }, [user, refreshPlan]);

  // Initial check and bounded interval polling
  useEffect(() => {
    if (statusParam === 'cancelled' || statusParam === 'failed') {
      setConfirmationState('failed');
      return;
    }

    verifySubscriptionStatus();

    if (confirmationState === 'confirming') {
      if (pollCount >= MAX_POLLS) {
        setConfirmationState('still_processing');
        return;
      }

      const timer = setTimeout(() => {
        setPollCount((prev) => prev + 1);
        verifySubscriptionStatus();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [verifySubscriptionStatus, confirmationState, pollCount, statusParam]);

  const handleManualRefresh = async () => {
    await verifySubscriptionStatus();
  };

  // State 4: Payment Failed or Cancelled
  if (confirmationState === 'failed' || statusParam === 'cancelled') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
          <XCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Payment Failed
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Your Pro subscription was not activated. If amount was debited, your bank or UPI provider will automatically reverse the transaction according to standard RBI refund timelines.
          </p>
        </div>
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            Try Again
          </Link>
          <Link
            href="/tools"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200"
          >
            Continue with Free Tools
          </Link>
        </div>
      </div>
    );
  }

  // State 2 & 3: Payment Verified & Subscription Active
  if (confirmationState === 'active') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
        <div className="bg-white rounded-3xl border border-emerald-200 p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Payment verified</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Your Pro subscription is active.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Your payment has been cryptographically confirmed. Your account is now entitled to 50-file batch processing, 100MB file capacities, 365-day history, and premium ATS resume templates.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2 text-xs text-slate-600">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Account:</span>
              <span>{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Current Status:</span>
              <PlanBadge plan="pro" size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span>Privacy Guarantee:</span>
              <span className="text-emerald-700 font-semibold">100% In-Browser</span>
            </div>
            {paymentId && (
              <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                <span>Payment Reference:</span>
                <span>{paymentId}</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/tools"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>Explore Pro Capabilities</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard/billing"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200"
            >
              View Billing Details
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State 5: Still Processing (Max 30s Polling reached)
  if (confirmationState === 'still_processing') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
        <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center space-y-6 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-900">
              Confirmation is taking longer than expected.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Payment received. We&apos;re still confirming your subscription with Razorpay.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-1">
            <p>Session ID: <span className="font-mono text-slate-700">{sessionId || 'active_session'}</span></p>
            {paymentId && <p>Payment ID: <span className="font-mono text-slate-700">{paymentId}</span></p>}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={checking}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>Refresh status</span>
            </button>
            <Link
              href="/dashboard/billing"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200"
            >
              Go to Billing Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State 1: Confirming Payment (Initial & Bounded Polling state)
  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-6 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200 animate-pulse">
          <Clock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Confirming your payment...
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Payment received. We&apos;re confirming your Pro subscription with Razorpay.
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin text-blue-600' : ''}`} />
            <span>
              {checking ? 'Checking subscription status...' : `Verifying server state (attempt ${pollCount + 1}/${MAX_POLLS})...`}
            </span>
          </div>
          {paymentId && (
            <p className="text-[11px] text-slate-400">
              Payment Reference: <span className="font-mono text-slate-600">{paymentId}</span>
            </p>
          )}
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={checking}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto px-4 py-16 text-center flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Verifying checkout session...</span>
        </div>
      }
    >
      <CheckoutConfirmationContent />
    </Suspense>
  );
}
