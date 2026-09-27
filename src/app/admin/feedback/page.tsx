"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Star,
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  Archive,
  AlertCircle,
  Bug,
  Lightbulb,
  Zap,
  Palette,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  userId?: string;
  rating: number;
  category: 'BUG' | 'FEATURE' | 'PERFORMANCE' | 'UX' | 'OTHER';
  toolSlug?: string;
  pageUrl?: string;
  message: string;
  email?: string;
  userAgent?: string;
  viewport?: string;
  status: 'NEW' | 'UNDER_REVIEW' | 'RESOLVED' | 'ARCHIVED';
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface FeedbackAnalytics {
  total: number;
  avgRating: number;
  unresolvedCount: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics>({
    total: 0,
    avgRating: 5.0,
    unresolvedCount: 0,
    byCategory: {},
    byStatus: {},
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [minRatingFilter, setMinRatingFilter] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState('');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (minRatingFilter !== 'ALL') params.set('minRating', minRatingFilter);
      if (search.trim()) params.set('q', search.trim());

      const res = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.analytics) setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, minRatingFilter, search]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const updateStatus = async (
    id: string,
    newStatus: 'NEW' | 'UNDER_REVIEW' | 'RESOLVED' | 'ARCHIVED',
    notes?: string
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, adminNotes: notes }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: newStatus, adminNotes: notes ?? item.adminNotes }
              : item
          )
        );
        if (selectedItem?.id === id) {
          setSelectedItem((prev) =>
            prev ? { ...prev, status: newStatus, adminNotes: notes ?? prev.adminNotes } : null
          );
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCSV = () => {
    if (items.length === 0) return;
    const headers = [
      'ID',
      'Date',
      'Rating',
      'Category',
      'Tool',
      'Status',
      'Email',
      'Message',
      'Admin Notes',
    ];
    const rows = items.map((i) => [
      i.id,
      new Date(i.createdAt).toISOString(),
      i.rating,
      i.category,
      i.toolSlug || '',
      i.status,
      i.email || 'Anonymous',
      `"${i.message.replace(/"/g, '""')}"`,
      `"${(i.adminNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `saarvi-feedback-${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'BUG':
        return <Bug className="w-3.5 h-3.5 text-rose-500" />;
      case 'FEATURE':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-500" />;
      case 'PERFORMANCE':
        return <Zap className="w-3.5 h-3.5 text-blue-500" />;
      case 'UX':
        return <Palette className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            New
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            Under Review
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Resolved
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Archive className="w-3 h-3 text-slate-400" />
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  const satisfactionRate = useMemo(() => {
    if (items.length === 0) return 100;
    const satisfied = items.filter((i) => i.rating >= 4).length;
    return Math.round((satisfied / items.length) * 100);
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                User Feedback & Sentiment
              </h1>
              <p className="text-xs text-slate-500">
                Authoritative user sentiment, bug reports, and UX ratings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchFeedback}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportCSV}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition shadow-xs disabled:bg-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Average Rating</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {analytics.avgRating.toFixed(1)}{' '}
            <span className="text-xs font-semibold text-slate-400">/ 5.0</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Across {analytics.total} total submissions
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Satisfaction Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {satisfactionRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Rated 4 or 5 stars</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Unresolved Items</span>
            <AlertCircle className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 tracking-tight">
            {analytics.unresolvedCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Awaiting review or fix</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Bug Reports</span>
            <Bug className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600 tracking-tight">
            {analytics.byCategory?.BUG || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Reported issues</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search feedback text, email, or tool..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              value={minRatingFilter}
              onChange={(e) => setMinRatingFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
            >
              <option value="ALL">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
              <option value="1">1-2 Stars</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: 'BUG', label: 'Bugs' },
            { id: 'FEATURE', label: 'Features' },
            { id: 'PERFORMANCE', label: 'Performance' },
            { id: 'UX', label: 'UX & Design' },
            { id: 'OTHER', label: 'Other' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                categoryFilter === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Items List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading feedback entries...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No feedback entries found</div>
            <p className="text-xs text-slate-400">
              Try adjusting your search criteria or category filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-slate-50/60 transition flex flex-col sm:flex-row items-start justify-between gap-4 cursor-pointer"
                onClick={() => {
                  setSelectedItem(item);
                  setAdminNotesInput(item.adminNotes || '');
                }}
              >
                <div className="space-y-2 flex-1">
                  {/* Rating + Category + Status */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            item.rating >= star
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                      {categoryIcon(item.category)}
                      <span>{item.category}</span>
                    </div>

                    {item.toolSlug && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-50 text-blue-700">
                        {item.toolSlug}
                      </span>
                    )}

                    {statusBadge(item.status)}
                  </div>

                  {/* Message */}
                  <p className="text-xs text-slate-800 leading-relaxed font-normal">
                    {item.message}
                  </p>

                  {/* Metadata Footer */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span>{item.email || 'Anonymous User'}</span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    {item.adminNotes && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600 font-medium truncate max-w-xs">
                          Note: {item.adminNotes}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Dropdown */}
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <select
                    value={item.status}
                    disabled={updatingId === item.id}
                    onChange={(e) => updateStatus(item.id, e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700 font-medium"
                  >
                    <option value="NEW">Mark as New</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="ARCHIVED">Archive</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Detail Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {categoryIcon(selectedItem.category)}
                <h3 className="text-base font-bold text-slate-900">Feedback Details</h3>
              </div>
              {statusBadge(selectedItem.status)}
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed text-slate-800">
                {selectedItem.message}
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="font-semibold text-slate-800">Rating:</span> {selectedItem.rating} / 5
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Category:</span> {selectedItem.category}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Email:</span>{' '}
                  {selectedItem.email || 'Anonymous'}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Tool:</span>{' '}
                  {selectedItem.toolSlug || 'General'}
                </div>
                {selectedItem.pageUrl && (
                  <div className="col-span-2 truncate">
                    <span className="font-semibold text-slate-800">Page:</span> {selectedItem.pageUrl}
                  </div>
                )}
                {selectedItem.viewport && (
                  <div>
                    <span className="font-semibold text-slate-800">Viewport:</span>{' '}
                    {selectedItem.viewport}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-slate-800">Submitted:</span>{' '}
                  {new Date(selectedItem.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Admin Notes */}
              <div className="space-y-1.5 pt-2">
                <label className="font-semibold text-slate-700 block">Admin Notes / Internal Log</label>
                <textarea
                  rows={3}
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="Notes about bug ticket, follow up, or resolution..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-800 resize-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateStatus(selectedItem.id, 'RESOLVED', adminNotesInput)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  Mark Resolved
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(selectedItem.id, 'ARCHIVED', adminNotesInput)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Archive
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  updateStatus(selectedItem.id, selectedItem.status, adminNotesInput);
                  setSelectedItem(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
