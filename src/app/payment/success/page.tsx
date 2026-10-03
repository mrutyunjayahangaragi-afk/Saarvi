"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { usePlan } from '@/hooks/usePlan';
import { CheckCircle2, Loader2, Sparkles, ArrowRight, ShieldCheck, Download, AlertCircle } from 'lucide-react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshPlan } = usePlan();
  const orderId = searchParams.get('order_id');

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<{
    amount?: number;
    planId?: string;
    expiresAt?: string;
  } | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('No order reference found.');
      setLoading(false);
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
          setOrderDetails({
            amount: data.amount,
            planId: data.planId,
            expiresAt: data.expiresAt,
          });
          refreshPlan();
        } else if (data.status === 'PENDING') {
          // Redirect to pending page
          router.replace(`/payment/pending?order_id=${encodeURIComponent(orderId!)}`);
          return;
        } else if (data.status === 'FAILED') {
          router.replace(`/payment/failed?order_id=${encodeURIComponent(orderId!)}`);
          return;
        } else {
          setError('Payment verification incomplete. Please contact support.');
        }
      } catch (err) {
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
  }, [orderId, router, refreshPlan]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-16 flex items-center justify-center">
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl text-center">
          {loading ? (
            <div className="py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
              <h1 className="text-xl font-bold tracking-tight">Verifying Payment with Cashfree</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Please do not refresh or close this window while we verify your transaction...
              </p>
            </div>
          ) : verified ? (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50 dark:ring-emerald-950/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Saarvi Pro Activated
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Payment Successful</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Welcome to Saarvi Pro! Your account now has full access to 50-file queues, 100MB file limits, and premium tools.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 text-left border border-slate-200/80 dark:border-slate-700/60 text-xs sm:text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Order Reference</span>
                  <span className="font-mono font-medium">{orderId}</span>
                </div>
                {orderDetails?.amount && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Amount Paid</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹{orderDetails.amount}</span>
                  </div>
                )}
                {orderDetails?.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Valid Until</span>
                    <span className="font-medium">
                      {new Date(orderDetails.expiresAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Payment Gateway</span>
                  <span className="font-medium">Cashfree Payments</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/dashboard/billing"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  View Billing
                </Link>
                <Link
                  href="/tools"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition"
                >
                  <span>Start Using Pro</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-9 h-9" />
              </div>
              <h1 className="text-2xl font-bold">Verification Notice</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
              <div className="pt-2 flex gap-3">
                <Link
                  href="/plans"
                  className="flex-1 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm"
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
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
