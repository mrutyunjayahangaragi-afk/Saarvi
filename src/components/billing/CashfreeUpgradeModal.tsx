"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CANONICAL_PRO_PLAN } from '@/config/plans';
import { initiateCashfreeCheckout } from '@/lib/payments/cashfree-checkout';

interface CashfreeUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CashfreeUpgradeModal({
  isOpen,
  onClose,
  onSuccess,
}: CashfreeUpgradeModalProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleContinuePayment = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/plans')}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Create server-authoritative order (sends only planId)
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: CANONICAL_PRO_PLAN.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.paymentSessionId) {
        throw new Error(data?.error?.message || 'Could not initiate checkout session.');
      }

      // 2. Open Cashfree Web Checkout using the Payment Session ID
      const mode =
        process.env.NEXT_PUBLIC_CASHFREE_MODE === 'PRODUCTION'
          ? 'production'
          : 'sandbox';

      await initiateCashfreeCheckout({
        paymentSessionId: data.paymentSessionId,
        mode,
      });
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('[Cashfree Checkout Error]:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to initiate secure checkout. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 dark:text-amber-400">
              <Sparkles className="w-5 h-5 fill-amber-500 dark:fill-amber-400" />
            </span>
            <h2
              id="upgrade-modal-title"
              className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase"
            >
              Upgrade to Saarvi Pro
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Selected Plan Summary Card */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Selected Plan
            </span>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800">
              <div>
                <div className="font-extrabold text-base text-slate-900 dark:text-white">
                  {CANONICAL_PRO_PLAN.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {CANONICAL_PRO_PLAN.durationLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {CANONICAL_PRO_PLAN.formattedPrice}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  One-time payment
                </div>
              </div>
            </div>
          </div>

          {/* Secure Checkout Section */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">
              Secure Checkout
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Complete your payment securely through Cashfree.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Action Button */}
          <div>
            <button
              type="button"
              onClick={handleContinuePayment}
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Secure Payment...</span>
                </>
              ) : (
                <>
                  <span>Continue to Secure Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 font-medium">
            <span>🔒</span>
            <span>Secure server-verified payment</span>
          </p>
        </div>
      </div>
    </div>
  );
}
