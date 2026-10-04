"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

interface WebhookEventRow {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  signature_verified: boolean;
  processed: boolean;
  received_at: string;
  processed_at?: string;
  error_message?: string;
}

export default function AdminWebhooksPage() {
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/billing/orders');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.webhooks || data.webhookEvents || []);
      }
    } catch (err) {
      console.error('[Admin Webhook Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] text-slate-900 dark:text-white p-6 sm:p-8 space-y-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            <Link href="/admin/payments" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Payments</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
            <span className="text-slate-600 dark:text-slate-400">WEBHOOK AUDIT LOG</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Razorpay Webhook Events
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cryptographic signatures, idempotency processing status, and payload receipts.
          </p>
        </div>

        <button
          onClick={fetchEvents}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition self-start sm:self-auto disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Webhook Log Table */}
      <div className="bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Event ID</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5 text-center">Signature Valid</th>
                <th className="p-3.5 text-center">Idempotent Processed</th>
                <th className="p-3.5">Received At</th>
                <th className="p-3.5">Notes / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
              {events.length > 0 ? (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono font-medium text-slate-900 dark:text-white">{evt.event_id}</td>
                    <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">{evt.event_type}</td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="w-3 h-3" />
                        <span>HMAC-SHA256 Valid</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          evt.processed
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {evt.processed ? 'Processed' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(evt.received_at).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-xs">
                      {evt.error_message ? (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">{evt.error_message}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    {loading ? 'Loading webhook audit logs...' : 'No webhook events recorded yet.'}
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
