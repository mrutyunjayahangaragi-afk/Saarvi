"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  ChevronRight,
  FileText,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface PaymentOrderRow {
  id: string;
  order_reference: string;
  user_id: string;
  user_email?: string;
  plan_id: string;
  amount_paise: number;
  currency: string;
  status: 'CREATED' | 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  environment?: string;
  provider?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PaymentOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/billing/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || data.data?.orders || []);
      }
    } catch (err) {
      console.error('[Admin Payments Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefund = async (orderRef: string) => {
    if (!confirm(`Are you sure you want to refund order ${orderRef}? This will trigger Razorpay's refund API and revoke active Pro access.`)) {
      return;
    }

    setRefundingId(orderRef);
    setActionNotice(null);

    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderRef,
          reason: refundReason || 'Admin issued refund',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({ type: 'success', message: `Order ${orderRef} refunded successfully via Razorpay API.` });
        fetchOrders();
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to process refund.' });
      }
    } catch (err) {
      setActionNotice({ type: 'error', message: 'Network error processing refund.' });
    } finally {
      setRefundingId(null);
      setRefundReason('');
    }
  };

  // Metrics calculation
  const totalOrders = orders.length;
  const capturedOrders = orders.filter((o) => o.status === 'CAPTURED');
  const pendingOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'CREATED');
  const failedOrders = orders.filter((o) => o.status === 'FAILED' || o.status === 'CANCELLED');
  const refundedOrders = orders.filter((o) => o.status === 'REFUNDED');
  const totalVolumePaise = capturedOrders.reduce((sum, o) => sum + (o.amount_paise || 0), 0);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      const matchesSearch =
        o.order_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.user_email && o.user_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        o.user_id?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchesPlan =
        planFilter === 'ALL' ||
        (planFilter === 'MONTHLY' && (o.plan_id?.includes('monthly') || !o.plan_id?.includes('yearly'))) ||
        (planFilter === 'YEARLY' && o.plan_id?.includes('yearly'));

      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const orderTime = new Date(o.created_at).getTime();
        if (dateFilter === '24H') matchesDate = now - orderTime <= 24 * 60 * 60 * 1000;
        else if (dateFilter === '7D') matchesDate = now - orderTime <= 7 * 24 * 60 * 60 * 1000;
        else if (dateFilter === '30D') matchesDate = now - orderTime <= 30 * 24 * 60 * 60 * 1000;
      }

      return matchesSearch && matchesStatus && matchesPlan && matchesDate;
    });
  }, [orders, searchQuery, statusFilter, planFilter, dateFilter]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] text-slate-900 dark:text-white p-6 sm:p-8 space-y-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            <span>ADMIN PORTAL</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
            <span className="text-slate-600 dark:text-slate-400">FINANCIAL OPERATIONS</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Razorpay Payments &amp; Revenue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Server-authoritative Razorpay transactions, live verification signatures, and operational refunds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/payments/webhooks"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Webhook Logs</span>
          </Link>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {actionNotice.message}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-[#111c38] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Volume</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">₹{(totalVolumePaise / 100).toLocaleString()}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">Captured Revenue</span>
        </div>

        <div className="bg-white dark:bg-[#111c38] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Orders</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{totalOrders}</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 block">All time</span>
        </div>

        <div className="bg-white dark:bg-[#111c38] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Successful</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{capturedOrders.length}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">Pro Active</span>
        </div>

        <div className="bg-white dark:bg-[#111c38] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending</span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingOrders.length}</p>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 block">Awaiting Confirmation</span>
        </div>

        <div className="bg-white dark:bg-[#111c38] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Failed</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">{failedOrders.length}</p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5 block">Declined / Dropped</span>
        </div>

        <div className="bg-white dark:bg-[#111c38] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Refunded</span>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">{refundedOrders.length}</p>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5 block">Reversed</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111c38] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order ref, user email, ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="CAPTURED">Captured (Paid)</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 font-medium"
          >
            <option value="ALL">All Plans</option>
            <option value="MONTHLY">Pro Monthly (₹99)</option>
            <option value="YEARLY">Pro Yearly (₹899)</option>
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 font-medium"
            >
              <option value="ALL">All Time</option>
              <option value="24H">Last 24 Hours</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Order Ref</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Gateway</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((ord) => {
                  const isCaptured = ord.status === 'CAPTURED';
                  const isPending = ord.status === 'PENDING' || ord.status === 'CREATED';
                  const isFailed = ord.status === 'FAILED' || ord.status === 'CANCELLED';
                  const isRefunded = ord.status === 'REFUNDED';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-medium text-slate-900 dark:text-white">
                        {ord.order_reference}
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-slate-900 dark:text-white block truncate max-w-[180px]">
                          {ord.user_email || ord.user_id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {ord.user_id ? `${ord.user_id.slice(0, 8)}...` : ''}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                        {ord.plan_id?.includes('yearly') ? 'Pro Yearly (365d)' : 'Pro Monthly (30d)'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        ₹{(ord.amount_paise / 100).toFixed(0)} {ord.currency || 'INR'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                            isCaptured
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : isPending
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : isRefunded
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                        Razorpay
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(ord.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3.5 text-right">
                        {isCaptured ? (
                          <button
                            onClick={() => handleRefund(ord.order_reference)}
                            disabled={refundingId === ord.order_reference}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Refund</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    {loading ? 'Loading payment records...' : 'No orders matched your criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
