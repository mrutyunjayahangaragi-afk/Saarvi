"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { usePlan } from '@/hooks/usePlan';
import { CheckCircle2, Loader2, Sparkles, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshPlan } = usePlan();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const paymentIdParam = searchParams.get('payment_id') || searchParams.get('paymentId');

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<{
    amount?: number;
    planId?: string;
    expiresAt?: string;
    paymentId?: string;
    durationDays?: number;
  } | null>(null);

  useEffect(() => {
    if (!orderId) {
      // Fallback: If arrived here after verified checkout without query params
      setVerified(true);
      setOrderDetails({
        amount: 99,
        planId: 'pro_30_days',
        durationDays: 30,
      });
      setLoading(false);
      refreshPlan();
      return;
    }

    let isMounted = true;

    async function verifyPayment() {
      try {
        const res = await fetch(`/api/payments/status/${encodeURIComponent(orderId!)}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.success && data.status === 'CAPTURED') {
          setVerified(true);
          const isYearly = data.planId?.includes('year');
          setOrderDetails({
            amount: data.amount || (isYearly ? 899 : 99),
            planId: data.planId || (isYearly ? 'pro_yearly' : 'pro_30_days'),
            expiresAt: data.expiresAt,
            paymentId: data.paymentId || paymentIdParam || `rzp_${orderId!.slice(0, 10)}`,
            durationDays: isYearly ? 365 : 30,
          });
          refreshPlan();
        } else if (data.status === 'PENDING') {
          router.replace(`/payment/pending?order_id=${encodeURIComponent(orderId!)}`);
          return;
        } else if (data.status === 'FAILED') {
          router.replace(`/payment/failed?order_id=${encodeURIComponent(orderId!)}`);
          return;
        } else {
          setError('Payment verification is being confirmed. Please refresh in a moment.');
        }
      } catch {
        if (isMounted) {
          setError('Unable to confirm payment status at this moment.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyPayment();

    return () => {
      isMounted = false;
    };
  }, [orderId, paymentIdParam, router, refreshPlan]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b18] flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-16 flex items-center justify-center">
        <div className="w-full bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-xl text-center">
          {loading ? (
            <div className="py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Verifying Payment with Razorpay
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Please wait a moment while Saarvi confirms your verified transaction...
              </p>
            </div>
          ) : verified ? (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-emerald-50 dark:ring-emerald-950/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Saarvi Pro is now active</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  Payment Successful 🎉
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Welcome to Saarvi Pro! Your account now has full access to 50-file queues, 100MB capacity, and executive tools.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-[#0b1329] rounded-2xl p-5 text-left border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Plan</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {orderDetails?.planId?.includes('year') ? 'Saarvi Pro (Yearly)' : 'Saarvi Pro'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Amount</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    ₹{orderDetails?.amount ?? 99}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Duration</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {orderDetails?.durationDays ?? 30} days
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Transaction Reference</span>
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {orderDetails?.paymentId || orderId || 'Verified'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Provider</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    Razorpay Secure
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/dashboard/billing"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
                >
                  View Billing
                </Link>
                <Link
                  href="/tools"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition min-h-[44px]"
                >
                  <span>Start using Saarvi Pro</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-9 h-9" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Verification Notice</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{error}</p>
              <div className="pt-2 flex gap-3">
                <Link
                  href="/plans"
                  className="flex-1 inline-flex items-center justify-center px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs min-h-[44px]"
                >
                  Return to Plans
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#060b18]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
