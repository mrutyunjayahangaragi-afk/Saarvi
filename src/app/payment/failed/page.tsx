"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { XCircle, RefreshCw, HelpCircle, Loader2, ArrowRight } from 'lucide-react';

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');

  const [verifying, setVerifying] = useState(Boolean(orderId));
  const [errorMessage, setErrorMessage] = useState(
    'Your payment could not be completed or was cancelled. No charges were deducted.'
  );

  useEffect(() => {
    if (!orderId) {
      setVerifying(false);
      return;
    }

    let isMounted = true;
    // Check authoritative server status before asserting failure
    fetch(`/api/payments/status/${encodeURIComponent(orderId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.status === 'CAPTURED') {
          router.replace(`/payment/success?order_id=${encodeURIComponent(orderId)}`);
        } else if (data.status === 'PENDING') {
          router.replace(`/payment/pending?order_id=${encodeURIComponent(orderId)}`);
        } else {
          setVerifying(false);
        }
      })
      .catch(() => {
        if (isMounted) setVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orderId, router]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#060b18] flex flex-col justify-between text-slate-900 dark:text-slate-100">
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex items-center justify-center">
          <div className="w-full bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-xl text-center space-y-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Checking payment status...
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verifying your payment state with Saarvi servers.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b18] flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex items-center justify-center">
        <div className="w-full bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-rose-50 dark:ring-rose-950/30">
            <XCircle className="w-9 h-9" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Payment Not Completed
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2">
              {errorMessage}
            </p>
          </div>

          {orderId && (
            <div className="bg-slate-50 dark:bg-[#0b1329] rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              Reference: {orderId}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/plans"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </Link>
            <Link
              href="/contact"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
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

export default function PaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#060b18]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}
