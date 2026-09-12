"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Receipt,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import PlanBadge from '@/components/plan/PlanBadge';
import { SubscriptionRecord, BillingInvoiceRecord } from '@/types/plan';
import { ACTIVE_PRO_BENEFITS } from '@/config/pricing';

export default function BillingDashboardPage() {
  const { user } = useAuth();
  const { isPro, plan, refreshPlan } = usePlan();

  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBillingData = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/billing/subscription?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription || null);
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.warn('Failed to fetch billing data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBillingData();
    refreshPlan();
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    setCancelling(true);
    setCancelSuccessMsg(null);

    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCancelSuccessMsg(data.message);
        setShowCancelModal(false);
        await fetchBillingData();
        refreshPlan();
      } else {
        alert(data.error || 'Failed to cancel subscription renewal.');
      }
    } catch {
      alert('Network error while cancelling subscription.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <span>Plans &amp; Billing</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your subscription, renewal cycle, and view provider-backed transaction receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {cancelSuccessMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{cancelSuccessMsg}</span>
        </div>
      )}

      {/* Plan Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Current Subscription Tier
              </span>
              <div className="flex items-center gap-2.5 pt-1">
                <h2 className="text-2xl font-extrabold text-slate-900">
                  {isPro ? 'Saarvi Pro' : 'Free Account'}
                </h2>
                <PlanBadge plan={isPro ? 'pro' : 'free'} size="md" />
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-slate-500">
                {isPro && subscription
                  ? `₹${(subscription.amountCents / 100).toFixed(0)} / ${subscription.billingInterval}`
                  : '₹0 / forever'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Subscription Status</span>
              <p className="font-bold text-slate-800">
                {subscription ? subscription.status : 'Active (Free Tier)'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-medium">
                {subscription?.cancelAtPeriodEnd ? 'Expires On' : 'Next Renewal'}
              </span>
              <p className="font-bold text-slate-800">
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'No expiration'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Billing Provider</span>
              <p className="font-bold text-slate-800 uppercase">
                {subscription?.provider || 'Native In-Browser'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Privacy Model</span>
              <p className="font-bold text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% In-Browser Execution</span>
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            {isPro ? (
              <>
                {subscription?.cancelAtPeriodEnd ? (
                  <span className="text-xs text-amber-700 font-medium">
                    Auto-renewal is turned off. Your Pro access remains active until the end of your billing cycle.
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
                  >
                    Cancel Auto-Renewal
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs text-slate-500">
                  Ready for 50-file batch processing and 100MB file limits?
                </span>
                <Link
                  href="/pricing"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upgrade to Pro</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Benefits Summary Widget */}
        <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Pro Quotas &amp; Limits</span>
            </h3>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                <span>Batch File Queue:</span>
                <span className="font-bold text-slate-800">{isPro ? '50 files' : '10 files'}</span>
              </div>
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                <span>Max File Capacity:</span>
                <span className="font-bold text-slate-800">{isPro ? '100 MB' : '50 MB'}</span>
              </div>
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                <span>Resume Templates:</span>
                <span className="font-bold text-slate-800">{isPro ? 'Executive ATS' : 'Standard'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Workspace History:</span>
                <span className="font-bold text-slate-800">{isPro ? '365 Days' : '30 Days'}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/80">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All tools run inside your client browser. Subscriptions support platform development and maintenance.
            </p>
          </div>
        </div>
      </div>

      {/* Payment & Invoice History */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              <span>Payment &amp; Invoice History</span>
            </h3>
            <p className="text-xs text-slate-500">
              Provider-backed records of subscription charges.
            </p>
          </div>
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Date</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-medium text-slate-800">
                      {new Date(inv.paidAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {inv.providerInvoiceId}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      ₹{(inv.amountPaid / 100).toFixed(2)} {inv.currency}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <FileText className="w-6 h-6 mx-auto text-slate-300" />
            <p className="font-medium text-slate-600">No payment invoices yet</p>
            <p className="text-[11px]">Invoices will appear here once recurring subscription payments are confirmed.</p>
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Cancel Subscription Renewal?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your Pro access will remain active until the end of your current period on{' '}
                <strong className="text-slate-800">
                  {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'the billing period'}
                </strong>
                . After that, your account will revert to the Free tier. You will not be charged again.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
