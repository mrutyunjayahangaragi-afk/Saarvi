"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  CheckCircle2,
  XCircle,
  QrCode,
  Upload,
  Trash2,
  Settings,
  Check,
  ExternalLink,
  Eye,
  Loader2,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import PlanBadge from '@/components/plan/PlanBadge';
import { SubscriptionRecord, BillingInvoiceRecord } from '@/types/plan';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { useAuth } from '@/context/AuthContext';
import { resolvePaymentQrImage } from '@/lib/billing/qr-resolver';

type AdminTab = 'REQUESTS' | 'SETTINGS' | 'SUBSCRIPTIONS';
type StatusFilterType = 'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SLA_APPROACHING' | 'SLA_EXCEEDED';

interface PaymentRequestItem {
  id: string;
  userId: string;
  userEmail: string;
  planDuration: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: string;
  payeeUpiId: string;
  utrNumber: string;
  payerUpiId?: string;
  paymentMethod: string;
  provider: string;
  paymentProofUrl?: string;
  status: 'PENDING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  submittedAt: string;
  slaDeadline: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  subscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentConfigForm {
  upiId: string;
  payeeName: string;
  amountMonthly: number;
  amountYearly: number;
  currency: string;
  qrCodeUrl?: string;
  reviewSlaHours: number;
  instructions: string;
  supportEmail: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
}

export default function AdminBillingPage() {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<AdminTab>('REQUESTS');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [imgError, setImgError] = useState(false);

  // Data states
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestItem[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<any>({ total: 0, pending: 0, approved: 0, rejected: 0, overdue: 0 });
  const [config, setConfig] = useState<PaymentConfigForm>({
    upiId: 'saarvi@upi',
    payeeName: 'Saarvi Educational Services',
    amountMonthly: 49,
    amountYearly: 399,
    currency: 'INR',
    reviewSlaHours: 2,
    instructions: '',
    supportEmail: 'payments@saarvi.in',
    status: 'ACTIVE',
  });
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoiceRecord[]>([]);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'MONTHLY' | 'YEARLY'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Review Modals
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequestItem | null>(null);
  const [modalMode, setModalMode] = useState<'APPROVE' | 'REJECT' | 'DETAILS' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // QR upload file ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAllData = async () => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      // 1. Fetch Payment Requests & Metrics
      const reqRes = await fetch('/api/billing/payment-request');
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        if (reqData.success) {
          setPaymentRequests(reqData.requests || []);
          if (reqData.metrics) setRequestMetrics(reqData.metrics);
        }
      }

      // 2. Fetch Payment Config
      const configRes = await fetch('/api/billing/payment-config');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.success && configData.config) {
          setConfig((prev) => ({ ...prev, ...configData.config }));
        }
      }

      // 3. Load Subscriptions & Invoices from authoritative mock storage / service
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
    loadAllData();
  }, []);

  // Timezone-safe 2-Hour SLA calculation
  const computeSla = (req: PaymentRequestItem) => {
    const isPending = req.status === 'PENDING' || req.status === 'PENDING_REVIEW';
    if (!isPending) {
      return {
        status: 'REVIEWED' as const,
        label: 'Reviewed',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }
    const deadline = new Date(
      req.slaDeadline || new Date(new Date(req.submittedAt || req.createdAt).getTime() + 2 * 60 * 60 * 1000)
    ).getTime();
    const diffMins = Math.round((deadline - Date.now()) / (1000 * 60));
    if (diffMins < 0) {
      return {
        status: 'SLA_EXCEEDED' as const,
        label: `SLA exceeded (${Math.abs(diffMins)}m overdue)`,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-bold',
      };
    }
    if (diffMins <= 30) {
      return {
        status: 'APPROACHING_SLA' as const,
        label: `Approaching SLA (~${diffMins}m left)`,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
      };
    }
    return {
      status: 'WITHIN_SLA' as const,
      label: `Within SLA (~${diffMins}m left)`,
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
    };
  };

  const isRejectionReasonValid = (reason: string) => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) return false;
    const invalidPlaceholders = ['no', 'invalid', 'rejected', 'test', 'reject', 'fake', 'none'];
    if (invalidPlaceholders.includes(trimmed.toLowerCase())) return false;
    return true;
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return paymentRequests.filter((r) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.userEmail.toLowerCase().includes(q) ||
        r.utrNumber.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (planFilter !== 'ALL' && r.planDuration !== planFilter) return false;

      const isPending = r.status === 'PENDING' || r.status === 'PENDING_REVIEW';
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PENDING_REVIEW') return isPending;
      if (statusFilter === 'APPROVED') return r.status === 'APPROVED';
      if (statusFilter === 'REJECTED') return r.status === 'REJECTED';
      if (statusFilter === 'SLA_APPROACHING') {
        return isPending && computeSla(r).status === 'APPROACHING_SLA';
      }
      if (statusFilter === 'SLA_EXCEEDED') {
        return isPending && computeSla(r).status === 'SLA_EXCEEDED';
      }
      return true;
    });
  }, [paymentRequests, searchTerm, statusFilter, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize]);

  // Handle Review Action (Approve / Reject)
  const handleReviewAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedRequest) return;
    if (!isSuperAdmin) {
      setFeedbackMsg({ type: 'error', text: 'Forbidden: SuperAdmin authorization required to approve or reject payments.' });
      return;
    }
    if (action === 'REJECT' && !isRejectionReasonValid(reviewNotes)) {
      setFeedbackMsg({
        type: 'error',
        text: 'A meaningful rejection reason (minimum 5 characters, not generic placeholder) is required.',
      });
      return;
    }
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/billing/payment-request/${selectedRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewNotes: reviewNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (action === 'APPROVE' ? 'Unable to approve this payment. Please try again.' : 'Unable to reject this payment.'));
      }

      setFeedbackMsg({
        type: 'success',
        text: `Payment request ${selectedRequest.id} ${action === 'APPROVE' ? 'approved and Pro activated' : 'rejected'}.`,
      });

      setModalMode(null);
      setSelectedRequest(null);
      setReviewNotes('');
      await loadAllData();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already been reviewed') || msg.toLowerCase().includes('idempotency')) {
        setFeedbackMsg({ type: 'error', text: 'This payment request has already been reviewed.' });
      } else if (action === 'APPROVE') {
        setFeedbackMsg({ type: 'error', text: 'Unable to approve this payment. Please try again.' });
      } else {
        setFeedbackMsg({ type: 'error', text: 'Unable to reject this payment.' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Payment Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      // Exclude qrCodeUrl so general settings save never touches or nullifies the QR code
      const { qrCodeUrl: _, ...settingsPayload } = config;
      const res = await fetch('/api/billing/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update payment settings.');
      }

      setFeedbackMsg({ type: 'success', text: 'Payment settings updated successfully!' });
      if (data.config) {
        setConfig((prev) => ({
          ...prev,
          ...data.config,
          qrCodeUrl: data.config.qrCodeUrl || prev.qrCodeUrl,
        }));
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Update failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle QR Upload
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading(true);
    setFeedbackMsg(null);
    setImgError(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/billing/upload-qr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload QR code.');
      }

      setConfig((prev) => ({ ...prev, qrCodeUrl: data.qrCodeUrl }));
      setImgError(false);
      setFeedbackMsg({ type: 'success', text: 'Custom QR code uploaded and verified!' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'QR upload failed' });
    } finally {
      setActionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle QR Delete
  const handleQrDelete = async () => {
    if (!confirm('Are you sure you want to remove the custom QR code? System will revert to default.')) return;
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch('/api/admin/billing/upload-qr', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove QR code.');
      }
      setConfig((prev) => ({ ...prev, qrCodeUrl: '' }));
      setImgError(false);
      setFeedbackMsg({ type: 'success', text: 'Custom QR code removed.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'QR removal failed' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
              Super Admin
            </span>
            <span className="text-xs text-slate-500 font-medium">Saarvi Platform Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-blue-600" />
            <span>Payment &amp; Billing Control Center</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review manual UPI payments, monitor 2-hour review SLAs, configure pricing &amp; QR, and manage Pro entitlements.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAllData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Total Submissions</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{requestMetrics.total || paymentRequests.length}</div>
          <div className="text-[10px] text-slate-500">All-time UPI submissions</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Pending Review</span>
          </div>
          <div className="text-2xl font-black text-amber-900">{requestMetrics.pending || 0}</div>
          <div className="text-[10px] text-amber-700 font-medium">
            {requestMetrics.overdue > 0 ? (
              <span className="text-rose-600 font-bold">{requestMetrics.overdue} SLA Overdue</span>
            ) : (
              <span>Within 2-hr SLA target</span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Approved (Pro)</span>
          </div>
          <div className="text-2xl font-black text-emerald-900">{requestMetrics.approved || 0}</div>
          <div className="text-[10px] text-emerald-600">Active Pro entitlements</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Rejected</span>
          </div>
          <div className="text-2xl font-black text-rose-900">{requestMetrics.rejected || 0}</div>
          <div className="text-[10px] text-rose-600">Invalid / Unmatched UTRs</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs space-y-1 col-span-2 lg:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>Total Subscriptions</span>
          </div>
          <div className="text-2xl font-black text-blue-900">{subscriptions.length}</div>
          <div className="text-[10px] text-blue-600">{subscriptions.filter((s) => s.status === 'ACTIVE').length} currently active</div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('REQUESTS')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'REQUESTS'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Payment Requests</span>
            {requestMetrics.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                {requestMetrics.pending}
              </span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SETTINGS')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'SETTINGS'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Payment Settings &amp; QR</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SUBSCRIPTIONS')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'SUBSCRIPTIONS'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Subscriptions &amp; Invoices</span>
          </span>
        </button>
      </div>

      {/* TAB 1: PAYMENT REQUESTS */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search email, UTR, ID, user..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Plan Filter */}
              <select
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value as any);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">All Plans</option>
                <option value="MONTHLY">Monthly Plan</option>
                <option value="YEARLY">Yearly Plan</option>
              </select>
            </div>

            {/* Status & SLA Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'PENDING_REVIEW', label: 'Pending Review' },
                { id: 'APPROVED', label: 'Approved' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'SLA_APPROACHING', label: 'SLA Approaching' },
                { id: 'SLA_EXCEEDED', label: 'SLA Exceeded' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter.id as any);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    statusFilter === filter.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {paginatedRequests.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3.5">User / Submitted</th>
                        <th className="p-3.5">Plan &amp; Amount</th>
                        <th className="p-3.5">UTR / Ref</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">2-Hour SLA Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {paginatedRequests.map((req) => {
                        const isPending = req.status === 'PENDING' || req.status === 'PENDING_REVIEW';
                        const sla = computeSla(req);

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">{req.userEmail}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(req.submittedAt || req.createdAt).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>

                            <td className="p-3.5">
                              <span className="font-semibold text-slate-900">{req.planDuration}</span>
                              <div className="text-slate-500 font-bold">
                                ₹{req.amount} {req.currency}
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="font-mono font-bold text-blue-700">{req.utrNumber}</div>
                              {req.payerUpiId && (
                                <div className="text-[10px] text-slate-400">Payer: {req.payerUpiId}</div>
                              )}
                            </td>

                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  isPending
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : req.status === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {isPending ? 'PENDING_REVIEW' : req.status}
                              </span>
                            </td>

                            <td className="p-3.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] border ${sla.badgeClass}`}
                              >
                                {sla.status === 'SLA_EXCEEDED' && <AlertTriangle className="w-3 h-3" />}
                                {sla.status === 'APPROACHING_SLA' && <Clock className="w-3 h-3" />}
                                {sla.status === 'WITHIN_SLA' && <Clock className="w-3 h-3 text-blue-500" />}
                                {sla.status === 'REVIEWED' && <Check className="w-3 h-3 text-slate-500" />}
                                <span>{sla.label}</span>
                              </span>
                            </td>

                            <td className="p-3.5 text-right space-x-1.5">
                              {isPending ? (
                                isSuperAdmin ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setModalMode('APPROVE');
                                        setReviewNotes('');
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setModalMode('REJECT');
                                        setReviewNotes('');
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setModalMode('DETAILS');
                                      }}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                                    >
                                      View
                                    </button>
                                  </>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setModalMode('DETAILS');
                                      }}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                                    >
                                      View
                                    </button>
                                    <span className="text-[10px] text-slate-400 font-semibold italic">
                                      SuperAdmin required
                                    </span>
                                  </div>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setModalMode('DETAILS');
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                  View Details
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
                  <div>
                    Showing <span className="font-bold text-slate-900">{(page - 1) * pageSize + 1}</span> to{' '}
                    <span className="font-bold text-slate-900">
                      {Math.min(page * pageSize, filteredRequests.length)}
                    </span>{' '}
                    of <span className="font-bold text-slate-900">{filteredRequests.length}</span> payment requests
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    <span className="px-2 font-bold text-slate-700">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 space-y-1 bg-slate-50/50">
                <Clock className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No payment requests match this criteria</p>
                <p className="text-[11px]">Submitted payments via UPI will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT SETTINGS & QR CONFIG */}
      {activeTab === 'SETTINGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Payment Gateway &amp; UPI Configuration</h2>
              <p className="text-xs text-slate-500">
                Authoritative pricing and payee account settings enforced across all client interfaces.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payee UPI ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={config.upiId}
                    onChange={(e) => setConfig({ ...config, upiId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">e.g. saarvi@upi or company@oksbi</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payee Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={config.payeeName}
                    onChange={(e) => setConfig({ ...config, payeeName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Shown in PhonePe, GPay, Paytm as recipient</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monthly Plan Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={config.amountMonthly}
                    onChange={(e) => setConfig({ ...config, amountMonthly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Yearly Plan Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={config.amountYearly}
                    onChange={(e) => setConfig({ ...config, amountYearly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Review SLA Guarantee (Hours) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    required
                    value={config.reviewSlaHours}
                    onChange={(e) => setConfig({ ...config, reviewSlaHours: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Default 2 hours review guarantee</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    required
                    value={config.supportEmail}
                    onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Instructions for Students
                </label>
                <textarea
                  rows={3}
                  value={config.instructions || ''}
                  onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                  placeholder="Instructions displayed on payment page..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Payment Settings</span>
                </button>
              </div>
            </form>
          </div>

          {/* QR Code Upload Widget */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Official UPI QR Code</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload a custom brand QR code image. Magic-bytes security ensures safe PNG/JPEG files (max 10MB).
              </p>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col items-center">
                {(() => {
                  const resolvedQrUrl = resolvePaymentQrImage(config.qrCodeUrl);
                  if (resolvedQrUrl && !imgError) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolvedQrUrl}
                        alt="Custom UPI QR"
                        className="w-44 h-44 object-contain rounded-xl border border-slate-100"
                        onError={() => setImgError(true)}
                      />
                    );
                  }
                  if (imgError) {
                    return (
                      <div className="w-44 h-44 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col items-center justify-center text-rose-600 gap-2 p-4 text-center">
                        <AlertCircle className="w-7 h-7 text-rose-500" />
                        <span className="text-xs font-bold">QR Code Unavailable</span>
                        <span className="text-[10px] text-rose-700 leading-tight">
                          Please update or re-upload the QR code in Admin Portal.
                        </span>
                        <button
                          type="button"
                          onClick={() => setImgError(false)}
                          className="mt-1 text-[10px] text-rose-700 underline font-semibold hover:text-rose-900 cursor-pointer"
                        >
                          Retry Loading
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="w-44 h-44 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
                      <QrCode className="w-8 h-8 text-slate-300" />
                      <span className="text-xs font-semibold text-slate-600">No custom QR code configured yet</span>
                      <span className="text-[10px] text-slate-400">System default dynamic QR active</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/80">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleQrUpload}
                accept="image/*,.png,.jpg,.jpeg,.webp"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={actionLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>{resolvePaymentQrImage(config.qrCodeUrl) ? 'Replace Custom QR' : 'Upload Custom QR'}</span>
              </button>

              {resolvePaymentQrImage(config.qrCodeUrl) && (
                <button
                  type="button"
                  onClick={handleQrDelete}
                  disabled={actionLoading}
                  className="w-full py-2 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Custom QR</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTIONS & INVOICES */}
      {activeTab === 'SUBSCRIPTIONS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Active Pro Subscriptions</h3>
                <p className="text-xs text-slate-500">Authoritative records of users with active Pro entitlements.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                {subscriptions.length} Records
              </span>
            </div>

            {subscriptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3.5">User ID</th>
                      <th className="p-3.5">Provider</th>
                      <th className="p-3.5">Plan / Interval</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Expiration / Renewal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-mono text-slate-900 font-bold">{sub.userId}</td>
                        <td className="p-3.5 uppercase font-semibold text-slate-700">{sub.provider}</td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-900 uppercase">{sub.plan}</span> ({sub.billingInterval})
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {sub.currentPeriodEnd
                            ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                            : 'No expiration'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">No subscriptions found.</div>
            )}
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Platform Invoices &amp; Receipts</h3>
                <p className="text-xs text-slate-500">Permanent financial records generated upon payment verification.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {invoices.length} Invoices
              </span>
            </div>

            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3.5">Invoice ID</th>
                      <th className="p-3.5">User ID</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Paid At</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-mono text-slate-900">{inv.providerInvoiceId}</td>
                        <td className="p-3.5 font-mono text-slate-600">{inv.userId}</td>
                        <td className="p-3.5 font-bold text-slate-900">₹{(inv.amountPaid / 100).toFixed(2)} {inv.currency}</td>
                        <td className="p-3.5 text-slate-500">{new Date(inv.paidAt).toLocaleDateString()}</td>
                        <td className="p-3.5">
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
              <div className="py-8 text-center text-xs text-slate-400">No invoices generated yet.</div>
            )}
          </div>
        </div>
      )}

      {/* APPROVE / REJECT / DETAILS MODAL */}
      {modalMode && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {modalMode === 'APPROVE' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Approve Payment &amp; Grant Pro</span>
                  </>
                ) : modalMode === 'REJECT' ? (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Reject Payment Request</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>Payment Request Details</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalMode(null);
                  setSelectedRequest(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* DETAILS MODE (Section 4.18) */}
            {modalMode === 'DETAILS' && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Request ID:</span>
                    <span className="font-mono text-slate-900 font-bold">{selectedRequest.id}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">User Email:</span>
                    <span className="font-semibold text-slate-900">{selectedRequest.userEmail}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">User ID:</span>
                    <span className="font-mono text-slate-600">{selectedRequest.userId}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Plan &amp; Duration:</span>
                    <span className="font-bold text-slate-900">
                      {selectedRequest.planDuration} (₹{selectedRequest.amount} {selectedRequest.currency})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">UTR / Ref:</span>
                    <span className="font-mono font-bold text-blue-700">{selectedRequest.utrNumber}</span>
                  </div>
                  {selectedRequest.payerUpiId && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Payer UPI ID:</span>
                      <span className="font-mono text-slate-900">{selectedRequest.payerUpiId}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Payment Method:</span>
                    <span className="font-semibold text-slate-800">{selectedRequest.paymentMethod || 'Manual UPI'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Current Status:</span>
                    <span className="font-bold uppercase text-slate-900">
                      {selectedRequest.status === 'PENDING' ? 'PENDING_REVIEW' : selectedRequest.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Submitted At:</span>
                    <span className="text-slate-700">
                      {new Date(selectedRequest.submittedAt || selectedRequest.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">2-Hour SLA Status:</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] border ${computeSla(selectedRequest).badgeClass}`}>
                      {computeSla(selectedRequest).label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Entitlement Status:</span>
                    <span className={`font-bold ${selectedRequest.status === 'APPROVED' ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {selectedRequest.status === 'APPROVED' ? 'PRO (Active)' : 'FREE'}
                    </span>
                  </div>
                  {selectedRequest.reviewedAt && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Reviewed At:</span>
                      <span className="text-slate-700">{new Date(selectedRequest.reviewedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedRequest.reviewedBy && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Reviewed By:</span>
                      <span className="font-bold text-slate-800">{selectedRequest.reviewedBy}</span>
                    </div>
                  )}
                  {selectedRequest.reviewNotes && (
                    <div className="pt-1">
                      <span className="text-slate-500 font-medium">
                        {selectedRequest.status === 'REJECTED' ? 'Rejection Reason:' : 'Review Notes:'}
                      </span>
                      <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg mt-1 border border-slate-200">
                        {selectedRequest.reviewNotes}
                      </p>
                    </div>
                  )}
                  {selectedRequest.paymentProofUrl && (
                    <div className="pt-2">
                      <span className="text-slate-500 font-medium block mb-1">Payment Proof:</span>
                      <a
                        href={selectedRequest.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Submitted Screenshot / Proof</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Footer Actions (Section 4.18) */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>

                  <div className="flex items-center gap-2">
                    {selectedRequest.status === 'PENDING' || selectedRequest.status === 'PENDING_REVIEW' ? (
                      isSuperAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setModalMode(null)}
                            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Keep Pending
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalMode('REJECT');
                              setReviewNotes('');
                            }}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalMode('APPROVE');
                              setReviewNotes('');
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            Approve
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-semibold italic">
                          SuperAdmin required to take action
                        </span>
                      )
                    ) : selectedRequest.status === 'APPROVED' ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                          Approved
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('SUBSCRIPTIONS');
                            setModalMode(null);
                          }}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          View User Entitlement
                        </button>
                      </div>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* APPROVE CONFIRMATION MODE (Section 4.4) */}
            {modalMode === 'APPROVE' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
                  Approve this payment and grant the user&apos;s configured plan?
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">User:</span>
                    <span className="font-semibold text-slate-900">{selectedRequest.userEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plan:</span>
                    <span className="font-bold text-slate-900">{selectedRequest.planDuration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-bold text-slate-900">₹{selectedRequest.amount} {selectedRequest.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">UTR / Ref:</span>
                    <span className="font-mono font-bold text-blue-700">{selectedRequest.utrNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Request ID:</span>
                    <span className="font-mono text-slate-700">{selectedRequest.id}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approval Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. Verified on bank credit statement"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalMode('DETAILS')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewAction('APPROVE')}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Approval &amp; Grant Pro</span>
                  </button>
                </div>
              </div>
            )}

            {/* REJECT CONFIRMATION MODE (Section 4.7 & 4.8) */}
            {modalMode === 'REJECT' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Please provide a clear reason for rejecting this payment request. The student will be notified in-app with this sanitized explanation.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. The submitted UTR could not be verified in our banking portal."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {!isRejectionReasonValid(reviewNotes) && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      Minimum 5 characters required (generic words like &apos;no&apos; or &apos;invalid&apos; are disallowed).
                    </p>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalMode('DETAILS')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewAction('REJECT')}
                    disabled={actionLoading || !isRejectionReasonValid(reviewNotes)}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Rejection</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
