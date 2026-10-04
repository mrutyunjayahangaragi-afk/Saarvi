"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

function PaymentReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get('order_id') || searchParams.get('orderId');

  const [attempts, setAttempts] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Verifying your payment with Saarvi...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('No order identifier received.');
      return;
    }

    let isMounted = true;
    let timerId: NodeJS.Timeout;

    const verifyPayment = async (attemptCount: number) => {
      try {
        const res = await fetch(`/api/payments/status/${encodeURIComponent(orderId)}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.status === 'CAPTURED' || data.isPro) {
          setStatusMessage('Payment verified successfully! Redirecting...');
          router.replace(`/payment/success?order_id=${encodeURIComponent(orderId)}`);
          return;
        }

        if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          router.replace(`/payment/failed?order_id=${encodeURIComponent(orderId)}`);
          return;
        }

        if (attemptCount < 5) {
          setStatusMessage(`Awaiting confirmation from bank (attempt ${attemptCount + 1} of 5)...`);
          timerId = setTimeout(() => {
            if (isMounted) {
              setAttempts(attemptCount + 1);
              verifyPayment(attemptCount + 1);
            }
          }, 2500);
        } else {
          router.replace(`/payment/pending?order_id=${encodeURIComponent(orderId)}`);
        }
      } catch (err) {
        console.error('[Payment Verification Fetch Error]:', err);
        if (isMounted) {
          if (attemptCount < 3) {
            timerId = setTimeout(() => verifyPayment(attemptCount + 1), 3000);
          } else {
            router.replace(`/payment/pending?order_id=${encodeURIComponent(orderId)}`);
          }
        }
      }
    };

    verifyPayment(0);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [orderId, router]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 bg-slate-50 dark:bg-[#060b18]">
      <div className="w-full max-w-md bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Verifying your payment...
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {statusMessage}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Server-side cryptographic verification via Razorpay</span>
        </div>

        {orderId && (
          <button
            type="button"
            onClick={() => router.push(`/payment/status?order_id=${encodeURIComponent(orderId)}`)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1 min-h-[44px]"
          >
            <span>Check Status Manually</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[75vh] flex items-center justify-center bg-slate-50 dark:bg-[#060b18]">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
