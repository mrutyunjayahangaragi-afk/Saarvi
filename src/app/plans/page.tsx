"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Clock,
  Loader2,
  Calendar,
  AlertCircle,
  CreditCard,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Lock,
} from 'lucide-react';
import PlanBadge from '@/components/plan/PlanBadge';
import ProcessingTypeBadge from '@/components/plan/ProcessingTypeBadge';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { PRO_PRICING, ACTIVE_PRO_BENEFITS, PRO_ROADMAP_DISCLAIMER } from '@/config/pricing';
import { BillingInterval } from '@/types/plan';

// Dynamically load Razorpay Standard Checkout JS (checkout.js)
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type PaymentButtonState = 'idle' | 'creating' | 'checkout' | 'verifying' | 'success' | 'error';

export default function PlansPage() {
  const { user } = useAuth();
  const { isPro, entitlement, refreshPlan } = usePlan();
  const router = useRouter();

  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [buttonState, setButtonState] = useState<PaymentButtonState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedPrice = PRO_PRICING[interval];

  // Upgraded server-authoritative checkout & verification flow
  const handleUpgrade = async () => {
    if (!user) {
      router.push('/login?next=/plans');
      return;
    }

    if (isPro) {
      router.push('/dashboard/billing');
      return;
    }

    // Double-click protection: prevent multiple requests while in progress
    if (buttonState === 'creating' || buttonState === 'verifying') {
      return;
    }

    setButtonState('creating');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Create server-authoritative Razorpay Order
      // Sends only plan and interval. Price and amount are calculated strictly server-side.
      const res = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          interval,
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        throw new Error(orderData.error?.message || orderData.error || 'Failed to create payment order');
      }

      const order = orderData.data || orderData.order;
      const keyId = order.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      // 2. Load Razorpay Checkout.js
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Could not load Razorpay payment gateway script. Please check your internet connection.');
      }

      const RazorpayGlobal = (window as unknown as {
        Razorpay?: new (opts: Record<string, unknown>) => {
          open: () => void;
          on: (evt: string, fn: (err: any) => void) => void;
        };
      }).Razorpay;

      if (!RazorpayGlobal) {
        throw new Error('Razorpay SDK failed to initialize.');
      }

      setButtonState('checkout');

      // 3. Open Razorpay Standard Web Checkout
      const rzp = new RazorpayGlobal({
        key: keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Saarvi',
        description: `Saarvi Pro (${interval === 'yearly' ? 'Annual Commitment' : 'Monthly Access'})`,
        prefill: {
          name: user.fullName || '',
          email: user.email || '',
        },
        notes: {
          userId: user.id,
          plan: 'pro',
          interval,
        },
        theme: {
          color: '#4F46E5',
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // 4. Server-Side Signature Verification & Authoritative Pro Entitlement Provisioning
          setButtonState('verifying');

          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id || order.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                userId: user.id,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error?.message || verifyData.error || 'Payment verification failed');
            }

            // 5. Verification successful: backend confirmed entitlement!
            setButtonState('success');
            setSuccessMessage('Payment successful! Your Saarvi Pro plan is active.');
            refreshPlan();
          } catch (verifyErr) {
            console.error('Verification error:', verifyErr);
            setButtonState('error');
            setErrorMessage(verifyErr instanceof Error ? verifyErr.message : 'Payment verification was not completed.');
          }
        },
        modal: {
          ondismiss: function () {
            if (buttonState !== 'success') {
              setButtonState('idle');
            }
          },
        },
      });

      rzp.on('payment.failed', function (failRes: { error?: { description?: string } }) {
        setButtonState('error');
        setErrorMessage(failRes.error?.description || 'Payment was not completed. Please try again.');
      });

      rzp.open();
    } catch (err) {
      console.error('Checkout error:', err);
      setButtonState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unable to initialize checkout. Please try again.');
    }
  };

  const formattedExpiry = entitlement?.expiresAt
    ? new Date(entitlement.expiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-12 max-w-6xl mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Saarvi Plans &amp; Billing Control</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          Simple, Transparent Plans for Every Learner
        </h1>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Unlock high-throughput document queues, priority processing, and executive templates — with 100% in-browser privacy guaranteed.
        </p>

        {/* Current User Entitlement Banner */}
        {user && (
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
            <span className="text-slate-500 font-medium">Your Current Plan:</span>
            <div className="flex items-center gap-1.5">
              <PlanBadge plan={isPro ? 'pro' : 'free'} size="sm" />
              <span className="font-bold text-slate-900">{isPro ? 'Saarvi Pro' : 'Free Account'}</span>
            </div>
            {isPro && formattedExpiry && (
              <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Active until {formattedExpiry}
              </span>
            )}
          </div>
        )}

        {/* Monthly / Yearly Toggle */}
        <div className="pt-2 flex justify-center">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                interval === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                interval === 'yearly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Yearly Commitment</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                Save ~25%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="max-w-2xl mx-auto p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1 font-semibold">{successMessage}</div>
          <Link
            href="/dashboard/billing"
            className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
          >
            <span>View Billing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="max-w-2xl mx-auto p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button
            type="button"
            onClick={() => setButtonState('idle')}
            className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* FREE PLAN CARD */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 flex flex-col justify-between shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Essential Productivity
              </span>
              {!isPro && user && (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                  Current Plan
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">Free Tier</h2>
              <p className="text-xs text-slate-500">
                Full core document tools and calculators for everyday academic needs.
              </p>
            </div>

            <div className="pt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">₹0</span>
                <span className="text-xs text-slate-500 font-semibold">/ forever</span>
              </div>
            </div>

            <ul className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Full access to Core Tools (JPG, PNG, PDF)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>VTU Academic Calculators (SGPA, CGPA)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Standard Student Resume Builder</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>10 files per batch queue</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>50 MB max file size</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Client-Side Privacy (0 bytes uploaded)</span>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            {!isPro && user ? (
              <button
                type="button"
                disabled
                className="w-full py-3 px-4 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold text-center cursor-default border border-slate-200"
              >
                Current Plan
              </button>
            ) : (
              <Link
                href="/signup"
                className="block w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold text-center transition-all shadow-2xs"
              >
                Get Started Free
              </Link>
            )}
          </div>
        </div>

        {/* PRO PLAN CARD */}
        <div className="relative bg-gradient-to-b from-white via-white to-purple-50/20 rounded-3xl border-2 border-purple-600/80 p-8 space-y-6 flex flex-col justify-between shadow-xl">
          <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recommended</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Professional &amp; High-Throughput
              </span>
              {isPro && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                  Pro Active
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">Saarvi Pro</h2>
              <p className="text-xs text-slate-500">
                {selectedPrice.description}
              </p>
            </div>

            <div className="pt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-slate-900">{selectedPrice.amountDisplay}</span>
                <span className="text-xs text-slate-500 font-semibold">{selectedPrice.periodLabel}</span>
                {interval === 'yearly' && (
                  <span className="ml-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Save ~25%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Fixed duration {interval === 'yearly' ? '365 days' : '30 days'} • One-time checkout
              </p>
            </div>

            <ul className="space-y-3 pt-4 border-t border-purple-100 text-xs text-slate-700 font-medium">
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span><strong>50 files</strong> per batch queue (vs 10 on Free)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span><strong>100 MB</strong> max file capacity per process</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span><strong>200 pages</strong> PDF extraction &amp; reordering</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span>Executive &amp; Multi-Column ATS Resume Templates</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span>365-day workspace history &amp; quick reaccess</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span>Zero client upload: 100% In-Browser Privacy</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 space-y-2">
            {isPro ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center flex items-center justify-center gap-2 shadow-xs cursor-default"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pro Active {formattedExpiry ? `(Expires ${formattedExpiry})` : ''}</span>
                </button>
                <Link
                  href="/dashboard/billing"
                  className="block text-center text-xs text-purple-700 hover:underline font-semibold"
                >
                  Manage Billing &amp; Payment History
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={buttonState === 'creating' || buttonState === 'verifying'}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {buttonState === 'creating' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating payment...</span>
                  </>
                )}
                {buttonState === 'checkout' && (
                  <>
                    <CreditCard className="w-4 h-4 animate-pulse" />
                    <span>Complete in Razorpay...</span>
                  </>
                )}
                {buttonState === 'verifying' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying payment...</span>
                  </>
                )}
                {buttonState === 'success' && (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Pro Active</span>
                  </>
                )}
                {buttonState === 'error' && (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Try Again</span>
                  </>
                )}
                {buttonState === 'idle' && (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Upgrade to Pro ({selectedPrice.amountDisplay})</span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Razorpay Secured</span>
              </span>
              <span>•</span>
              <Link href="/pricing#upi-payment" className="text-purple-600 hover:underline flex items-center gap-1 font-medium">
                <QrCode className="w-3.5 h-3.5" />
                <span>Manual UPI Option</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Comparison Matrix */}
      <div className="max-w-4xl mx-auto space-y-6 pt-8 border-t border-slate-200">
        <div className="text-center space-y-1">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
            Compare Plan Capabilities
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Detailed breakdown of what is included in Free vs Pro
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4 sm:px-6">Feature</th>
                  <th className="p-4 sm:px-6 text-center">Engine</th>
                  <th className="p-4 sm:px-6 text-center">Free Tier</th>
                  <th className="p-4 sm:px-6 text-center bg-purple-50/50 text-purple-900">
                    Saarvi Pro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>Core Document Processing (JPG, PNG, PDF)</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Document</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">Full Access</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-purple-900 bg-purple-50/30">
                    Full Access + Priority Queue
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>VTU SGPA / CGPA Calculators</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Student</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">Full Access</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-purple-900 bg-purple-50/30">Full Access</td>
                </tr>
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>Resume &amp; Cover Letter Builder</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Career</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">Standard Template</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-purple-900 bg-purple-50/30">
                    Executive &amp; Multi-Column ATS
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>Batch Queue Capacity</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">System</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center font-medium">10 files / run</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-purple-900 bg-purple-50/30">
                    50 files / run
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>Maximum File Capacity</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">System</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center font-medium">50 MB</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-purple-900 bg-purple-50/30">
                    100 MB
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>In-Browser Privacy Guarantee</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Privacy</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center font-semibold text-emerald-700">100% Client-Side</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-emerald-700 bg-purple-50/30">
                    100% Client-Side
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Privacy Guarantee Card */}
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 rounded-3xl border border-blue-200/80 p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              100% In-Browser Privacy Guarantee
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Unlike cloud-hosted tools that require uploading your private marksheets, PDFs, or photos to external cloud disks, Saarvi executes all core operations <strong>locally inside your browser</strong>. Your documents never touch our servers. Subscribing to Pro enhances your local quota and batch queues without ever compromising this privacy guarantee.
            </p>
            <div className="pt-2">
              <p className="text-[11px] text-slate-500 italic bg-white/80 p-2.5 rounded-xl border border-blue-100">
                {PRO_ROADMAP_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
