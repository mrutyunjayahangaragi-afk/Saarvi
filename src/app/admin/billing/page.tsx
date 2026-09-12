"use client";

import React, { useEffect, useState, useMemo } from 'react';
import {
  CreditCard,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Users,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Receipt,
  FileText,
  Lock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import PlanBadge from '@/components/plan/PlanBadge';
import { SubscriptionRecord, BillingInvoiceRecord } from '@/types/plan';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export default function AdminBillingPage() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoiceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');

  const loadData = () => {
    setLoading(true);
    try {
      const allSubs = MockStorageProvider.getSubscriptions();
      const allInvoices = MockStorageProvider.getInvoices();
      setSubscriptions(allSubs);
      setInvoices(allInvoices);
    } catch (err) {
      console.warn('Failed to load admin billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute real metrics (zero fabrication rule per Section 12 & Section 26)
  const metrics = useMemo(() => {
    let totalPro = 0;
    let active = 0;
    let cancelled = 0;
    let pastDue = 0;
    let mrrCents = 0;

    for (const sub of subscriptions) {
      totalPro++;
      if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') {
        active++;
        if (sub.billingInterval === 'monthly') {
          mrrCents += sub.amountCents;
        } else if (sub.billingInterval === 'yearly') {
          mrrCents += Math.round(sub.amountCents / 12);
        }
      } else if (sub.status === 'CANCELLED' || sub.cancelAtPeriodEnd) {
        cancelled++;
      } else if (sub.status === 'PAST_DUE') {
        pastDue++;
      }
    }

    const arrCents = mrrCents * 12;
    const confirmedPayments = invoices.filter((i) => i.status === 'paid').length;

    return {
      totalPro,
      active,
      cancelled,
      pastDue,
      confirmedPayments,
      mrrCents,
      arrCents,
      mrrDisplay: `₹${(mrrCents / 100).toFixed(0)}`,
      arrDisplay: `₹${(arrCents / 100).toFixed(0)}`,
      hasRevenue: mrrCents > 0,
    };
  }, [subscriptions, invoices]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch =
        sub.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.providerSubscriptionId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;
      const matchesProvider = providerFilter === 'ALL' || sub.provider.toUpperCase() === providerFilter;

      return matchesSearch && matchesStatus && matchesProvider;
    });
  }, [subscriptions, searchTerm, statusFilter, providerFilter]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-purple-600" />
            <span>Billing &amp; Subscription Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time subscription counts, MRR, Razorpay transaction records, and entitlement oversight.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Security Rule Banner */}
      <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-purple-900">
        <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">Strict Server-Authoritative Entitlement Principle</p>
          <p className="text-purple-700 leading-relaxed">
            Saarvi Pro entitlements are derived directly from verified Razorpay billing records. Administrators cannot arbitrarily click &quot;Make Pro&quot; to fabricate subscription states or modify payment amounts.
          </p>
        </div>
      </div>

      {/* Section 12 KPIs: Real Counts Only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pro Subscribers */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Pro Subscribers</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{metrics.totalPro}</span>
            <span className="text-xs text-slate-400 font-medium">all-time</span>
          </div>
          <p className="text-[11px] text-slate-500">Total registered subscriber records</p>
        </div>

        {/* Active Subscribers */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Subscribers</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{metrics.active}</span>
            <span className="text-xs text-slate-400 font-medium">current</span>
          </div>
          <p className="text-[11px] text-slate-500">Currently entitled Pro accounts</p>
        </div>

        {/* Real MRR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Monthly Recurring (MRR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {metrics.hasRevenue ? metrics.mrrDisplay : '₹0'}
            </span>
            <span className="text-xs text-slate-400 font-medium">/mo</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {metrics.hasRevenue ? 'Calculated from active subscriptions' : 'No confirmed revenue data yet.'}
          </p>
        </div>

        {/* Real ARR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Annual Run Rate (ARR)</span>
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {metrics.hasRevenue ? metrics.arrDisplay : '₹0'}
            </span>
            <span className="text-xs text-slate-400 font-medium">/yr</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {metrics.hasRevenue ? 'Projected annualized run rate' : 'No confirmed revenue data yet.'}
          </p>
        </div>
      </div>

      {/* Secondary Status Row: Past Due, Cancelled, Confirmed Payments */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Past Due Subscriptions</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{metrics.pastDue}</span>
            <span className="text-xs text-slate-400 font-medium">accounts</span>
          </div>
          <p className="text-[11px] text-slate-500">Failed recurring payment attempts</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Cancelled Subscriptions</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{metrics.cancelled}</span>
            <span className="text-xs text-slate-400 font-medium">accounts</span>
          </div>
          <p className="text-[11px] text-slate-500">Cancelled by customer at period end</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmed Payments</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{metrics.confirmedPayments}</span>
            <span className="text-xs text-slate-400 font-medium">transactions</span>
          </div>
          <p className="text-[11px] text-slate-500">Verified Razorpay receipts</p>
        </div>
      </div>

      {/* Subscriptions Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Active &amp; Historical Subscriptions</h2>
            <p className="text-xs text-slate-500">All registered subscription records across payment providers.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user or sub ID..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none w-48 transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAST_DUE">Past Due</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none text-slate-700 uppercase"
            >
              <option value="ALL">All Providers</option>
              <option value="RAZORPAY">Razorpay</option>
              <option value="SANDBOX">Sandbox</option>
            </select>
          </div>
        </div>

        {filteredSubscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">User ID</th>
                  <th className="p-3">Subscription ID</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Interval</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Current Period</th>
                  <th className="p-3">Auto-Renew</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono text-slate-800 font-medium">
                      {sub.userId.substring(0, 16)}...
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {sub.providerSubscriptionId}
                    </td>
                    <td className="p-3 uppercase font-bold text-slate-700">
                      {sub.provider}
                    </td>
                    <td className="p-3 capitalize">
                      {sub.billingInterval}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      ₹{(sub.amountCents / 100).toFixed(0)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.status === 'PAST_DUE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {new Date(sub.currentPeriodStart).toLocaleDateString()} &rarr;{' '}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {sub.cancelAtPeriodEnd ? (
                        <span className="text-[11px] text-amber-600 font-semibold">
                          Cancels at end
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-semibold">
                          Active Renewal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-slate-400 space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600 text-sm">No subscription records found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Real subscription entries will appear here as users complete checkout through Razorpay.
            </p>
          </div>
        )}
      </div>

      {/* Section 11: Confirmed Invoice Transactions & Receipts */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <span>Confirmed Payment Transactions &amp; Receipts</span>
          </h2>
          <p className="text-xs text-slate-500">Provider-verified payments recorded by the webhook receiver.</p>
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Payment ID / Invoice</th>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-medium text-slate-800">
                      {new Date(inv.paidAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {inv.providerInvoiceId}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {inv.userId.substring(0, 16)}...
                    </td>
                    <td className="p-3 font-bold text-purple-700">
                      Pro
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      ₹{(inv.amountPaid / 100).toFixed(2)} {inv.currency}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 uppercase font-semibold text-slate-600">
                      Razorpay
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Receipt className="w-6 h-6 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">No confirmed revenue data yet.</p>
            <p className="text-[11px]">Webhook-verified payment receipts from Razorpay will be indexed here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
