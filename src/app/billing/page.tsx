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
  Receipt,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import PlanBadge from '@/components/plan/PlanBadge';

export default function BillingPage() {
  const { user } = useAuth();
  const { isPro, plan, refreshPlan } = usePlan();

  const [paymentOrders, setPaymentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBillingData = useCallback(async () => {
    if (!user) return;
    try {
      const ordersRes = await fetch('/api/payments/my-orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        if (ordersData.success && Array.isArray(ordersData.orders)) {
          setPaymentOrders(ordersData.orders);
        }
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

  const handleManualRefresh = () => {
    setRefreshing(true);
    refreshPlan();
    fetchBillingData();
  };

  const getOrderStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    if (s === 'CAPTURED' || s === 'PAID' || s === 'SUCCESS') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Paid</span>
        </span>
      );
    }
    if (s === 'REFUNDED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 w-fit">
          Refunded
        </span>
      );
    }
    if (s === 'FAILED' || s === 'CANCELLED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 w-fit">
          Failed
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 w-fit">
        <Clock className="w-3.5 h-3.5" />
        <span>Pending</span>
      </span>
    );
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#0b1329] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Sign In Required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to view your Saarvi Pro plan, subscription status, and Cashfree payment receipts.
          </p>
          <Link
            href="/login?redirect=/billing"
            className="block w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-md"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-[#060b18] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Billing &amp; Payments
              </h1>
              <PlanBadge plan={plan} size="sm" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage your Saarvi Pro access duration and view payment receipts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            {!isPro && (
              <Link
                href="/plans"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade to Pro</span>
              </Link>
            )}
          </div>
        </div>

        {/* Current Plan Overview Card */}
        <div className="bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Current Active Plan
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                <span>{isPro ? 'Saarvi Pro' : 'Saarvi Free Tier'}</span>
                {isPro && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    Active
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
                {isPro ? '₹99' : '₹0'}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {isPro ? 'One-time (30 days)' : 'Forever'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111c38] border border-slate-200/70 dark:border-slate-800 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <div className="text-slate-400 dark:text-slate-500 text-[11px] font-semibold">Access Type</div>
                <div className="text-slate-900 dark:text-white font-bold mt-0.5">
                  {isPro ? 'Full Pro Access (30 Days)' : 'Free Standard Student Tools'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111c38] border border-slate-200/70 dark:border-slate-800 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="text-slate-400 dark:text-slate-500 text-[11px] font-semibold">Payment Gateway</div>
                <div className="text-slate-900 dark:text-white font-bold mt-0.5">
                  Cashfree Payments (Server-Verified)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Payment History</h2>
            </div>
            <span className="text-xs text-slate-400">Cashfree</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Loading payment orders...</p>
            </div>
          ) : paymentOrders.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No payment orders recorded yet</p>
              <p className="text-[11px] text-slate-400">When you upgrade to Saarvi Pro via Cashfree, orders appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paymentOrders.map((ord: any) => {
                    const dateStr = new Date(ord.createdAt || ord.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                    const amt = Number(ord.amount_paise || ord.amountCents || 0) / 100;
                    return (
                      <tr key={ord.id || ord.orderReference} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 font-medium text-slate-600 dark:text-slate-300">{dateStr}</td>
                        <td className="py-4 font-bold text-slate-900 dark:text-white">Saarvi Pro</td>
                        <td className="py-4 font-black text-slate-900 dark:text-white">₹{amt}</td>
                        <td className="py-4">{getOrderStatusBadge(ord.status)}</td>
                        <td className="py-4 font-semibold text-slate-500 dark:text-slate-400">Cashfree</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
