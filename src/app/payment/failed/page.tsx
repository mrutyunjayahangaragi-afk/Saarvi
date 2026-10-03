"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { XCircle, ArrowLeft, RefreshCw, HelpCircle, Loader2 } from 'lucide-react';

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex items-center justify-center">
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50 dark:ring-rose-950/30">
            <XCircle className="w-9 h-9" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Was Not Completed</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Your transaction could not be processed by Cashfree or was cancelled. No charges were deducted from your account.
            </p>
          </div>

          {orderId && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              Reference: {orderId}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/plans"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </Link>
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

export default function PaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}
