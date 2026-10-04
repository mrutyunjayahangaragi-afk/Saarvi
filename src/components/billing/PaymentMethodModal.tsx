'use client';

/**
 * Modern Saarvi Pro Upgrade & Checkout Launcher (Razorpay Powered)
 *
 * Implements:
 * - Server-authoritative order creation via POST /api/payments/create-order
 * - Direct launch of official Razorpay Checkout modal
 * - Exposes supported methods: UPI (PhonePe, GPay, Paytm, BHIM), Cards, Net Banking, Wallets
 * - Server signature verification via POST /api/payments/verify
 * - Double-click protection & accessible >=44px touch targets
 * - Pristine light and dark mode support
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles, ArrowRight, RefreshCw, AlertCircle, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CANONICAL_PRO_PLAN, CANONICAL_PRO_YEARLY_PLAN } from '@/config/plans';
import { initiateRazorpayCheckout } from '@/lib/payments/razorpay-checkout';
import { BillingInterval } from '@/types/plan';

export interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  interval?: BillingInterval;
  onSuccess?: () => void;
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  interval = 'monthly',
  onSuccess,
}: PaymentMethodModalProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isYearly = interval === 'yearly';
  const plan = isYearly ? CANONICAL_PRO_YEARLY_PLAN : CANONICAL_PRO_PLAN;

  const handleContinuePayment = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/plans')}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Create server-authoritative Razorpay Order
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          interval,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success || !orderData.orderId) {
        throw new Error(orderData?.error?.message || 'Could not initiate secure payment session.');
      }

      // 2. Launch Razorpay Checkout Modal
      await initiateRazorpayCheckout({
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        keyId: orderData.keyId,
        name: 'Saarvi',
        description: `Saarvi Pro (${isYearly ? '365 Days' : '30 Days'})`,
        prefill: {
          name: user.fullName || user.email?.split('@')[0] || '',
          email: user.email || '',
        },
        themeColor: '#2563eb', // Saarvi Blue
        onSuccess: async (rzpResp) => {
          try {
            setIsLoading(true);
            // 3. Complete server-side cryptographic signature verification
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: rzpResp.razorpay_order_id,
                paymentId: rzpResp.razorpay_payment_id,
                signature: rzpResp.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData?.error?.message || 'Payment signature verification failed.');
            }

            onClose();
            if (onSuccess) onSuccess();
            router.push(`/payment/success?order_id=${encodeURIComponent(rzpResp.razorpay_order_id)}`);
          } catch (verifyErr: any) {
            console.error('[Payment Verification Notice]:', verifyErr);
            setError(verifyErr.message || 'Verification could not be completed.');
          } finally {
            setIsLoading(false);
          }
        },
        onDismiss: () => {
          setIsLoading(false);
        },
        onError: (errMessage) => {
          setIsLoading(false);
          if (typeof errMessage === 'string') {
            setError(errMessage);
          }
        },
      });
    } catch (err: any) {
      console.error('[Razorpay Checkout Error]:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to initiate secure checkout. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2
              id="upgrade-modal-title"
              className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase"
            >
              UPGRADE TO SAARVI PRO
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Selected Plan Summary Card */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Selected Plan
            </span>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800">
              <div>
                <div className="font-extrabold text-base text-slate-900 dark:text-white">
                  {plan.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {plan.durationLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {plan.formattedPrice}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  One-time checkout
                </div>
              </div>
            </div>
          </div>

          {/* Included Features Snapshot */}
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Premium Saarvi document &amp; student tools</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Enhanced career features &amp; executive ATS templates</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Advanced Saarvi capabilities (50-file queue, 100MB capacity)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Future premium features &amp; priority processing</span>
            </div>
          </div>

          {/* Payment Methods Supported Reassurance */}
          <div className="space-y-1.5 p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Supported Payment Methods via Razorpay</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              UPI (PhonePe, Google Pay, Paytm, BHIM), Debit &amp; Credit Cards (Visa, Mastercard, RuPay), Net Banking &amp; Wallets.
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
              className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing secure checkout...</span>
                </>
              ) : (
                <>
                  <span>Continue to Secure Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-2">
              Secure payment powered by Razorpay
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 font-medium">
            <span>🔒</span>
            <span>256-bit encrypted • Server-verified entitlement</span>
          </p>
        </div>
      </div>
    </div>
  );
}
