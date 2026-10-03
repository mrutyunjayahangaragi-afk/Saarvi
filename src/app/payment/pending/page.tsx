"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Loader2, Clock, RefreshCw, HelpCircle, ArrowRight } from 'lucide-react';

function PaymentPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('order_id');

  const [pollCount, setPollCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const maxPolls = 5;

  const checkStatus = async () => {
    if (!orderId || isChecking) return;
    setIsChecking(true);
    try {
      const res = await fetch(`/api/payments/status/${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.success && data.status === 'CAPTURED') {
        router.replace(`/payment/success?order_id=${encodeURIComponent(orderId)}`);
        return;
      }
      if (data.status === 'FAILED') {
        router.replace(`/payment/failed?order_id=${encodeURIComponent(orderId)}`);
        return;
      }
    } catch {
      // Continue polling
    } finally {
      setIsChecking(false);
      setPollCount((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (pollCount < maxPolls) {
      const timer = setTimeout(() => {
        checkStatus();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pollCount, orderId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex items-center justify-center">
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50 dark:ring-amber-950/30">
            {pollCount < maxPolls ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : (
              <Clock className="w-9 h-9" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Payment is Being Confirmed</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {pollCount < maxPolls
                ? 'We are waiting for Cashfree to confirm your transaction details...'
                : 'Payment confirmation is taking slightly longer than expected. Your payment status will update automatically once confirmed.'}
            </p>
          </div>

          {orderId && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              Order Ref: {orderId}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={checkStatus}
              disabled={isChecking}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>Check Status Again</span>
            </button>
            <Link
              href="/contact"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Need Help?</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PaymentPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <PaymentPendingContent />
    </Suspense>
  );
}
