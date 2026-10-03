"use client";

import React, { useEffect, useState, useCallback } from 'react';
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
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  FileText,
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
  environment: 'SANDBOX' | 'PRODUCTION';
  created_at: string;
  updated_at: string;
}

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PaymentOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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
    if (!confirm(`Are you sure you want to refund order ${orderRef}? This will revoke active Pro access.`)) {
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
        setActionNotice({ type: 'success', message: `Order ${orderRef} refunded successfully.` });
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
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.order_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.user_email && o.user_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      o.user_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
            <span>ADMIN PORTAL</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600">FINANCIAL OPERATIONS</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Cashfree Payments &amp; Revenue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Production INR payment management, transaction logs, and customer refunds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/payments/webhooks"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Webhook Logs</span>
          </Link>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
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
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionNotice.message}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Volume</span>
          <p className="text-xl font-black text-slate-900 mt-1">₹{(totalVolumePaise / 100).toLocaleString()}</p>
          <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">Captured Revenue</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
          <p className="text-xl font-black text-slate-900 mt-1">{totalOrders}</p>
          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">All time</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Successful</span>
          <p className="text-xl font-black text-emerald-600 mt-1">{capturedOrders.length}</p>
          <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">Pro Active</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
          <p className="text-xl font-black text-amber-600 mt-1">{pendingOrders.length}</p>
          <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">Awaiting Confirmation</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Failed</span>
          <p className="text-xl font-black text-rose-600 mt-1">{failedOrders.length}</p>
          <span className="text-[10px] text-rose-600 font-medium mt-0.5 block">Declined / Dropped</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Refunded</span>
          <p className="text-xl font-black text-purple-600 mt-1">{refundedOrders.length}</p>
          <span className="text-[10px] text-purple-600 font-medium mt-0.5 block">Reversed</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order ref, user email, ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="CAPTURED">Captured (Paid)</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
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
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((ord) => {
                  const isCaptured = ord.status === 'CAPTURED';
                  const isPending = ord.status === 'PENDING' || ord.status === 'CREATED';
                  const isFailed = ord.status === 'FAILED' || ord.status === 'CANCELLED';
                  const isRefunded = ord.status === 'REFUNDED';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 font-mono font-medium text-slate-900">
                        {ord.order_reference}
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-slate-900 block truncate max-w-[180px]">
                          {ord.user_email || ord.user_id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {ord.user_id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-800">
                        {ord.plan_id.includes('yearly') ? 'Pro Yearly' : 'Pro Monthly'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        ₹{(ord.amount_paise / 100).toFixed(0)} {ord.currency}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                            isCaptured
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isRefunded
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">
                        Cashfree ({ord.environment || 'PROD'})
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
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
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Refund</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
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
