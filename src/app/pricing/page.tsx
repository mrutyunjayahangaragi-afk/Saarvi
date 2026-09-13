"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  FileText,
  Layers,
  Lock,
  GraduationCap,
  Wrench,
  HelpCircle,
  Clock,
  Loader2,
  ExternalLink,
  CreditCard,
  Smartphone,
  QrCode,
} from 'lucide-react';
import PlanBadge from '@/components/plan/PlanBadge';
import ProcessingTypeBadge from '@/components/plan/ProcessingTypeBadge';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { PRO_PRICING, ACTIVE_PRO_BENEFITS, PRO_ROADMAP_DISCLAIMER } from '@/config/pricing';
import { BillingInterval } from '@/types/plan';
import { UpiPaymentSection } from '@/components/billing/UpiPaymentSection';

// Dynamically load Razorpay Standard Checkout JS
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

export default function PricingPage() {
  const { user } = useAuth();
  const { isPro, plan } = usePlan();
  const router = useRouter();

  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedPrice = PRO_PRICING[interval];

  const handleUpgrade = async () => {
    if (!user) {
      router.push('/login?next=/pricing');
      return;
    }

    if (isPro) {
      router.push('/dashboard/billing');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Call server-authoritative checkout creation (sends ONLY plan and interval)
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName,
          plan: 'pro',
          interval,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Failed to initialize checkout');
      }

      const session = data.data?.session || data.session;
      const keyId = session?.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      // 2. Launch Razorpay Standard Checkout Modal if Key ID is configured
      if (keyId) {
        const scriptLoaded = await loadRazorpayScript();
        const RazorpayGlobal = (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (evt: string, fn: (err: any) => void) => void } }).Razorpay;

        if (scriptLoaded && RazorpayGlobal) {
          const rzp = new RazorpayGlobal({
            key: keyId,
            subscription_id: session.providerSubscriptionId,
            order_id: session.providerOrderId,
            amount: session.amount,
            currency: session.currency || 'INR',
            name: 'Saarvi',
            description: `Saarvi Pro (${interval === 'yearly' ? 'Yearly' : 'Monthly'})`,
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
            handler: function (response: Record<string, string>) {
              // Redirect to server confirmation holding screen. Entitlement is determined exclusively server-side.
              const paymentId = response.razorpay_payment_id || '';
              const orderId = response.razorpay_order_id || session.providerOrderId || '';
              const signature = response.razorpay_signature || '';
              router.push(
                `/checkout/confirmation?session_id=${session.sessionId}&payment_id=${paymentId}&order_id=${orderId}&signature=${signature}&provider=razorpay`
              );
            },
            modal: {
              ondismiss: function () {
                setLoading(false);
              },
            },
          });

          rzp.on('payment.failed', function (failRes: { error?: { description?: string } }) {
            setErrorMsg(failRes.error?.description || 'Payment was not completed. Please try again.');
            setLoading(false);
          });

          rzp.open();
          return;
        }
      }

      // 3. Fallback to confirmation holding screen if in development or test environment
      if (session?.checkoutUrl) {
        window.location.href = session.checkoutUrl;
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const comparisonRows = [
    {
      feature: 'Core Document Tools (JPG, PNG, PDF)',
      category: 'Document',
      free: 'Full Access (100% Free)',
      pro: 'Full Access + Enhanced Queues',
      type: 'local' as const,
    },
    {
      feature: 'VTU Academic Calculators (SGPA, CGPA, Attendance)',
      category: 'Student',
      free: 'Full Access',
      pro: 'Full Access',
      type: 'local' as const,
    },
    {
      feature: 'Student Resume & Cover Letter Builder',
      category: 'Student',
      free: 'Standard Templates',
      pro: 'Executive & Multi-Column ATS Templates',
      type: 'local' as const,
    },
    {
      feature: 'Client-Side Private Processing (0 Byte Upload)',
      category: 'Privacy',
      free: 'Guaranteed (100% In-Browser)',
      pro: 'Guaranteed (100% In-Browser)',
      type: 'local' as const,
    },
    {
      feature: 'Max File Size for Browser Processing',
      category: 'Limits',
      free: '50 MB',
      pro: 'Up to 100 MB',
      type: 'local' as const,
    },
    {
      feature: 'Batch File Processing Queue',
      category: 'Limits',
      free: 'Up to 10 files',
      pro: 'Up to 50 files simultaneous',
      type: 'local' as const,
    },
    {
      feature: 'Persistent Local Workspace & History',
      category: 'Account',
      free: '30-Day History',
      pro: '365-Day Academic Year Retention',
      type: 'local' as const,
    },
    {
      feature: 'Multi-Profile Student Management',
      category: 'Student',
      free: 'Single Profile',
      pro: 'Multiple Scheme / Student Profiles',
      type: 'local' as const,
    },
    {
      feature: 'Optical Character Recognition (OCR)',
      category: 'OCR',
      free: '—',
      pro: 'Coming Soon (In Development)',
      type: 'mixed' as const,
    },
    {
      feature: 'AI Resume & Document Assistants',
      category: 'AI',
      free: '—',
      pro: 'Coming Soon (In Development)',
      type: 'server' as const,
    },
  ];

  const faqs = [
    {
      q: 'Will Saarvi core tools remain free forever?',
      a: 'Yes, absolutely. All 24+ core document transformers, image converters, and VTU student engines will always remain 100% free and client-side in-browser. We never lock basic single-file conversions behind paywalls.',
    },
    {
      q: 'Does Saarvi Pro upload my private documents to a server?',
      a: 'No. Our local-first architecture is permanent. Even with a Pro subscription, your document conversions execute directly inside your browser using WebAssembly. Upgrading to Pro never forces cloud document storage.',
    },
    {
      q: 'What payment methods are supported for Indian students?',
      a: 'Through our secure integration, we support UPI AutoPay (Google Pay, PhonePe, Paytm, BHIM), Indian Debit & Credit cards with RBI e-mandate compliance, and NetBanking.',
    },
    {
      q: 'Can I cancel my subscription at any time?',
      a: 'Yes. You can cancel your subscription renewal anytime from your Billing Dashboard with a single click. Your Pro access remains fully active until the end of your prepaid period, with zero cancellation fees.',
    },
    {
      q: 'Are AI and OCR features included in this Pro plan?',
      a: 'Not yet. We do not engage in misleading pricing. AI and OCR capabilities are in active development and are not advertised as active benefits. Pro currently unlocks higher batch limits, 100MB file capacities, 365-day history, and premium resume templates.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
      {/* ========================================================================= */}
      {/* 1. HERO HEADER                                                            */}
      {/* ========================================================================= */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Simple, Honest Pricing</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Simple, Transparent &amp; Private by Design
        </h1>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Saarvi is built on a private-first foundation. All core single-file document transformations and VTU student utilities are free forever. Upgrade to Pro for high-throughput batch queues, 100MB file capacities, and extended workspace history.
        </p>

        {/* Monthly vs Yearly Toggle */}
        <div className="pt-2 flex items-center justify-center gap-3">
          <div className="bg-slate-100/90 p-1 rounded-2xl border border-slate-200 inline-flex items-center gap-1 shadow-2xs">
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
              <span>Yearly Billing</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                Save ~25%
              </span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl max-w-md mx-auto">
            {errorMsg}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. PLAN CARDS (FREE VS PRO)                                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
        {/* FREE PLAN CARD */}
        <div className={`bg-white rounded-3xl border p-6 sm:p-8 shadow-xs flex flex-col justify-between relative ${
          !isPro ? 'border-blue-300 ring-2 ring-blue-500/20' : 'border-slate-200'
        }`}>
          {!isPro && (
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-2xs">
              Your Current Plan
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Forever Free
              </span>
              <PlanBadge plan="free" size="sm" />
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">₹0</span>
                <span className="text-xs text-slate-500 font-medium">/forever</span>
              </div>
              <p className="text-xs text-slate-500">
                Ideal for students and everyday users who need instant, private conversions.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                What&apos;s Included:
              </p>
              {[
                'All 24+ core image and PDF conversion tools',
                'All VTU SGPA & CGPA academic engines',
                'Standard ATS Student Resume Builder',
                'Up to 50 MB per file browser processing',
                'Up to 10 files in standard batch queue',
                '100% In-Browser client-side privacy (0 byte upload)',
                'Persistent local browser workspace',
              ].map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                  <div className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100">
            <Link
              href="/tools"
              className="w-full block py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs text-center transition-colors shadow-2xs"
            >
              Browse Free Tools
            </Link>
          </div>
        </div>

        {/* PRO PLAN CARD */}
        <div className={`bg-white rounded-3xl border-2 p-6 sm:p-8 shadow-sm flex flex-col justify-between relative overflow-hidden ${
          isPro
            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
            : 'border-purple-500 shadow-purple-500/5'
        }`}>
          {isPro ? (
            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-2xs">
              Active Pro Member
            </div>
          ) : (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-bl-xl shadow-2xs">
              Recommended
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Saarvi Pro
              </span>
              <PlanBadge plan="pro" size="sm" />
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  {selectedPrice.amountDisplay}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {selectedPrice.periodLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {selectedPrice.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <p className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Active Pro Benefits:
              </p>
              {ACTIVE_PRO_BENEFITS.map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-4 h-4 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{benefit.title}: </span>
                    <span className="text-slate-600">{benefit.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
            {isPro ? (
              <Link
                href="/dashboard/billing"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs text-center transition-all shadow-sm"
              >
                <span>Manage Pro Subscription</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <a
                  href="#upi-payment"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs text-center transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Pay with UPI / QR ({selectedPrice.amountDisplay}{selectedPrice.periodLabel})</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                {/* Razorpay Gateway Disabled - Coming Soon */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                      Razorpay Gateway
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Payment Methods Breakdown */}
            <div className="pt-2 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Instant UPI App &amp; QR Payments
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-slate-600">
                <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 font-medium flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-purple-600" />
                  PhonePe
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 font-medium flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-blue-600" />
                  Google Pay
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 font-medium flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-sky-600" />
                  Paytm
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 font-medium flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-emerald-600" />
                  Any UPI QR
                </span>
              </div>
              <p className="text-[10px] text-center text-slate-400">
                Direct UPI app payment with 2-hour review SLA and authoritative verification.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2.5. DIRECT UPI PAYMENT SECTION                                           */}
      {/* ========================================================================= */}
      <div id="upi-payment" className="scroll-mt-10">
        <UpiPaymentSection defaultPlan={interval} />
      </div>

      {/* ========================================================================= */}
      {/* 3. TRANSPARENCY & PRIVACY GUARANTEE BANNER                                */}
      {/* ========================================================================= */}
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
              Unlike cloud services that require uploading your private marksheets, PDFs, or photos to remote cloud disks, Saarvi executes all core conversions <strong>locally inside your browser</strong>. Your documents never touch our servers. Subscribing to Pro enhances your local quota and batch queues without ever compromising this privacy guarantee.
            </p>
            <div className="pt-2">
              <p className="text-[11px] text-slate-500 italic bg-white/80 p-2.5 rounded-xl border border-blue-100">
                {PRO_ROADMAP_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DETAILED FEATURE COMPARISON TABLE                                      */}
      {/* ========================================================================= */}
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Feature Comparison Matrix
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Compare capabilities across Free and Pro tiers
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4 sm:px-6">Feature</th>
                  <th className="p-4 sm:px-6 text-center">Processing</th>
                  <th className="p-4 sm:px-6 text-center">Free Forever</th>
                  <th className="p-4 sm:px-6 text-center bg-purple-50/50 text-purple-900">
                    Saarvi Pro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 sm:px-6 font-medium text-slate-800">
                      <div>{row.feature}</div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-4 sm:px-6 text-center">
                      <ProcessingTypeBadge type={row.type} size="sm" />
                    </td>
                    <td className="p-4 sm:px-6 text-center font-medium">
                      {row.free}
                    </td>
                    <td className="p-4 sm:px-6 text-center font-bold text-purple-900 bg-purple-50/30">
                      {row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. FREQUENTLY ASKED QUESTIONS                                             */}
      {/* ========================================================================= */}
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Transparent answers about our pricing and privacy
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1.5 shadow-2xs"
            >
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {faq.q}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
