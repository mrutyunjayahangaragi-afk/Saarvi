"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Clock,
  Calendar,
  AlertCircle,
  CreditCard,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Lock,
  Zap,
  ChevronDown,
} from 'lucide-react';
import PlanBadge from '@/components/plan/PlanBadge';
import ProcessingTypeBadge from '@/components/plan/ProcessingTypeBadge';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { PRO_PRICING, ACTIVE_PRO_BENEFITS, PRO_ROADMAP_DISCLAIMER } from '@/config/pricing';
import { BillingInterval } from '@/types/plan';
import { PaymentMethodModal } from '@/components/billing/PaymentMethodModal';

function PlansContent() {
  const { user } = useAuth();
  const { isPro, entitlement, refreshPlan } = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Authoritative prices
  const monthlyConfig = PRO_PRICING.monthly;
  const yearlyConfig = PRO_PRICING.yearly;
  const selectedPrice = PRO_PRICING[interval];

  // Dynamic discount percentage calculated strictly from authoritative pricing
  const discountPercent = Math.round(
    (1 - yearlyConfig.amountCents / (monthlyConfig.amountCents * 12)) * 100
  );

  // Restore preselected interval or auto-open modal if user returned from login
  useEffect(() => {
    const qInterval = searchParams.get('interval');
    if (qInterval === 'yearly' || qInterval === 'monthly') {
      setInterval(qInterval);
    }
    const qPlan = searchParams.get('plan');
    if (qPlan === 'pro' && user && !isPro) {
      setIsModalOpen(true);
    }
  }, [searchParams, user, isPro]);

  // Handle Upgrade click
  const handleUpgradeClick = () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/plans?plan=pro&interval=${interval}`)}`);
      return;
    }

    if (isPro) {
      router.push('/dashboard/billing');
      return;
    }

    setIsModalOpen(true);
  };

  const formattedExpiry = entitlement?.expiresAt
    ? new Date(entitlement.expiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const isExpired = !isPro && entitlement?.expiresAt && new Date(entitlement.expiresAt).getTime() < Date.now();

  const faqs = [
    {
      q: "Does Saarvi automatically renew or debit my credit card?",
      a: "No. Saarvi Pro runs on fixed, transparent time allocations (30 days for Monthly, 365 days for Yearly). We do not silently store your credit cards or auto-debit accounts. When your duration nears its end, you can easily renew with one click.",
    },
    {
      q: "What happens to my documents when my Pro plan expires?",
      a: "All your saved preferences, resume drafts, and academic calculators remain safely stored in your browser. Your account gracefully transitions back to the Free plan with standard limits. No files or work will ever be deleted.",
    },
    {
      q: "Are my PDF marksheets or images uploaded to remote cloud servers?",
      a: "Never. Saarvi is engineered private-by-design. All core file conversions, image compression, and VTU CGPA engines run 100% locally in your device's browser memory (WebAssembly/Canvas). 0 bytes are uploaded to our servers.",
    },
    {
      q: "What payment methods are supported?",
      a: "We support instant online checkout via Razorpay (UPI, Credit/Debit Cards, Netbanking, Cred) as well as direct UPI QR payments (PhonePe, Google Pay, Paytm) with a 2-hour verification SLA.",
    },
  ];

  return (
    <div className="space-y-14 max-w-5xl mx-auto px-4 py-8">
      {/* ===================================================================== */}
      {/* 1. HERO SECTION                                                      */}
      {/* ===================================================================== */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Simple, Honest Pricing</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          Simple, Transparent &amp; Private by Design
        </h1>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Saarvi is built on a private-first foundation. All core single-file document transformations and VTU student utilities are free forever. Upgrade to Pro for higher processing limits, larger files, and extended workspace features.
        </p>

        {/* Current User Plan Banner */}
        {user && (
          <div className="pt-2">
            <div className="inline-flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
              <span className="text-slate-500 font-medium">Your Current Plan:</span>
              <div className="flex items-center gap-1.5">
                <PlanBadge plan={isPro ? 'pro' : 'free'} size="sm" />
                <span className="font-bold text-slate-900">
                  {isPro ? 'PRO — Active' : 'FREE — Forever'}
                </span>
              </div>
              {isPro && formattedExpiry && (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Expires: {formattedExpiry}
                </span>
              )}
              {isPro && (
                <Link
                  href="/dashboard/billing"
                  className="text-blue-600 hover:text-blue-800 font-bold ml-1 hover:underline inline-flex items-center gap-0.5"
                >
                  Manage Billing
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Monthly / Yearly Billing Toggle */}
        <div className="pt-3 flex justify-center">
          <div className="inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                interval === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                interval === 'yearly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Yearly</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                Save ~{discountPercent}%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. PRICING CARDS                                                      */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
        {/* FREE PLAN CARD */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 flex flex-col justify-between shadow-xs">
          <div className="space-y-5">
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
              <h2 className="text-2xl font-black text-slate-900">FREE</h2>
              <p className="text-xs text-slate-500">
                Great for students and everyday users who need instant, private browser-based tools.
              </p>
            </div>

            <div className="pt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">₹0</span>
                <span className="text-xs text-slate-500 font-semibold">/ forever</span>
              </div>
            </div>

            <ul className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Core image and PDF conversion tools</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>VTU SGPA &amp; CGPA academic engines</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Standard ATS student resume builder</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>10 files per standard batch queue</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>50 MB max single file size</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% In-Browser client-side privacy (0 byte upload)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Persistent local browser workspace</span>
              </li>
            </ul>
          </div>

          <div className="pt-8">
            {!isPro && user ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-4 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold text-center cursor-default border border-slate-200"
              >
                Current Plan
              </button>
            ) : user && isPro ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-4 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold text-center cursor-default border border-slate-200"
              >
                Included in Free
              </button>
            ) : (
              <Link
                href="/signup?redirect=/plans"
                className="block w-full py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold text-center transition-all shadow-2xs"
              >
                Create account
              </Link>
            )}
          </div>
        </div>

        {/* PRO PLAN CARD */}
        <div className="relative bg-white rounded-3xl border-2 border-blue-600 p-8 flex flex-col justify-between shadow-xl">
          <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recommended</span>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Higher Limits &amp; Power Tools
              </span>
              {isPro && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                  PRO Active
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">PRO</h2>
              <p className="text-xs text-slate-500">
                {selectedPrice.description}
              </p>
            </div>

            <div className="pt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-slate-900">{selectedPrice.amountDisplay}</span>
                <span className="text-xs text-slate-500 font-semibold">{selectedPrice.periodLabel}</span>
                {interval === 'yearly' && (
                  <span className="ml-2 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Save ~{discountPercent}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Fixed duration {interval === 'yearly' ? '365 days' : '30 days'} • One-time checkout
              </p>
            </div>

            <ul className="space-y-3 pt-4 border-t border-blue-50 text-xs text-slate-700 font-medium">
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span><strong>50 files</strong> per batch queue (vs 10 on Free)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span><strong>100 MB</strong> max file capacity per process</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span><strong>200 pages</strong> PDF extraction &amp; reordering</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span>Executive &amp; Multi-Column ATS Resume Templates</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span>365-day workspace history &amp; quick reaccess</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span>Multi-profile student management</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 font-bold" />
                </div>
                <span>Zero server upload: 100% In-Browser Privacy</span>
              </li>
            </ul>
          </div>

          <div className="pt-8 space-y-2">
            {!user ? (
              <Link
                href={`/signup?redirect=${encodeURIComponent(`/plans?plan=pro&interval=${interval}`)}`}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <span>Create free account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : isPro ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2 shadow-xs cursor-default"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pro Active</span>
                </button>
                <Link
                  href="/dashboard/billing"
                  className="block text-center text-xs text-blue-600 hover:underline font-semibold"
                >
                  Manage Billing &amp; Payment History
                </Link>
              </div>
            ) : isExpired ? (
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Renew Pro ({selectedPrice.amountDisplay})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upgrade to Pro ({selectedPrice.amountDisplay})</span>
              </button>
            )}

            <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Razorpay Online</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-slate-400" />
                <span>UPI / QR Code</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. PRIVACY & SECURITY REASSURANCE                                    */}
      {/* ===================================================================== */}
      <div className="max-w-4xl mx-auto bg-slate-50 rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-3">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Privacy &amp; Security Guaranteed
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Your documents remain local for supported browser-processing tools. Subscribing to Pro enhances your local quota, queue limits, and unlocks executive tools without ever compromising this privacy guarantee.
            </p>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. PLAN COMPARISON MATRIX                                            */}
      {/* ===================================================================== */}
      <div className="max-w-4xl mx-auto space-y-6 pt-4 border-t border-slate-100">
        <div className="text-center space-y-1">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
            Compare Plan Capabilities
          </h3>
          <p className="text-xs text-slate-500">
            Transparent breakdown of features included in Free vs Pro
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4 sm:px-6">Feature</th>
                  <th className="p-4 sm:px-6 text-center">Processing</th>
                  <th className="p-4 sm:px-6 text-center">Free Tier</th>
                  <th className="p-4 sm:px-6 text-center bg-blue-50/50 text-blue-900 font-black">
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
                  <td className="p-4 sm:px-6 text-center font-bold text-blue-900 bg-blue-50/30">
                    Full Access + Priority Queue
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>VTU SGPA / CGPA Calculators</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Academic</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">Full Access</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-blue-900 bg-blue-50/30">
                    Full Access
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>Batch Processing Queue Size</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Throughput</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">10 files / batch</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-blue-900 bg-blue-50/30">
                    50 files / batch
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>Maximum Single File Limit</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Capacity</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">50 MB</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-blue-900 bg-blue-50/30">
                    100 MB
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>PDF Page Extraction Limit</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">PDF Tools</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">50 pages</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-blue-900 bg-blue-50/30">
                    200 pages
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>ATS Resume Builder Templates</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Career</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">Standard Template</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-blue-900 bg-blue-50/30">
                    All Executive &amp; Modern Designs
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 sm:px-6 font-medium text-slate-800">
                    <div>Workspace History Duration</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Storage</span>
                  </td>
                  <td className="p-4 sm:px-6 text-center">
                    <ProcessingTypeBadge type="local" size="sm" />
                  </td>
                  <td className="p-4 sm:px-6 text-center">30 days local</td>
                  <td className="p-4 sm:px-6 text-center font-bold text-blue-900 bg-blue-50/30">
                    365 days local &amp; fast reaccess
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. FREQUENTLY ASKED QUESTIONS                                         */}
      {/* ===================================================================== */}
      <div className="max-w-3xl mx-auto space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-xl font-bold text-slate-900 text-center">
          Frequently Asked Questions
        </h3>

        <div className="space-y-3 pt-2">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 cursor-pointer hover:bg-slate-50/80"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openFaq === idx ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 6. DEDICATED PAYMENT METHOD MODAL                                     */}
      {/* ===================================================================== */}
      <PaymentMethodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        interval={interval}
        onSuccess={() => {
          refreshPlan();
        }}
      />
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto p-12 text-center text-slate-400 text-xs">
          Loading plans...
        </div>
      }
    >
      <PlansContent />
    </Suspense>
  );
}
