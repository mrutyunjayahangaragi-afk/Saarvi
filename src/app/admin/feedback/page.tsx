"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
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
  Smile,
  Meh,
  Frown,
  ArrowUpRight,
  Wrench,
  Mail,
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  userId?: string | null;
  userType?: 'GUEST' | 'FREE' | 'PRO';
  guestSessionId?: string | null;
  rating: number;
  category: string;
  toolKey?: string;
  toolSlug?: string;
  pageUrl?: string;
  message: string;
  email?: string;
  userAgent?: string;
  viewport?: string;
  status: 'NEW' | 'IN_REVIEW' | 'UNDER_REVIEW' | 'RESOLVED' | 'ARCHIVED';
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'UNKNOWN';
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

interface FeedbackAnalytics {
  total: number;
  avgRating: number;
  unresolvedCount: number;
  starCounts?: { 5: number; 4: number; 3: number; 2: number; 1: number };
  byCategory?: Record<string, number>;
  byStatus?: Record<string, number>;
  byTool?: Record<string, number>;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics>({
    total: 0,
    avgRating: 0,
    unresolvedCount: 0,
    starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    byCategory: {},
    byStatus: { NEW: 0, IN_REVIEW: 0, RESOLVED: 0, ARCHIVED: 0 },
    byTool: {},
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ratingFilter, setRatingFilter] = useState('ALL');
  const [userTypeFilter, setUserTypeFilter] = useState('ALL');
  const [toolFilter, setToolFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState('');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (ratingFilter !== 'ALL') params.set('rating', ratingFilter);
      if (userTypeFilter !== 'ALL') params.set('userType', userTypeFilter);
      if (toolFilter !== 'ALL') params.set('tool', toolFilter);
      if (dateFilter !== 'ALL') params.set('dateRange', dateFilter);
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
  }, [categoryFilter, statusFilter, ratingFilter, userTypeFilter, toolFilter, dateFilter, search]);

  useEffect(() => {
    fetchFeedback();
    const interval = setInterval(() => {
      fetchFeedback();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchFeedback]);

  const updateStatus = async (
    id: string,
    newStatus: 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'ARCHIVED',
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
        await fetchFeedback();
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
      'Sentiment',
      'Category',
      'Tool',
      'Status',
      'Email',
      'Message',
      'Admin Notes',
    ];
    const rows = items.map((i) => {
      const sentiment = i.rating >= 4 ? 'Positive' : i.rating === 3 ? 'Neutral' : 'Negative';
      return [
        i.id,
        new Date(i.createdAt).toISOString(),
        i.rating,
        sentiment,
        i.category,
        i.toolSlug || '',
        i.status,
        i.email || 'Anonymous',
        `"${i.message.replace(/"/g, '""')}"`,
        `"${(i.adminNotes || '').replace(/"/g, '""')}"`,
      ];
    });

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

  // Helper for non-destructive automated sentiment classification
  const getSentiment = (rating: number): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' => {
    if (rating >= 4) return 'POSITIVE';
    if (rating === 3) return 'NEUTRAL';
    return 'NEGATIVE';
  };

  // Rating Distribution Counts
  const starCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    items.forEach((item) => {
      const r = Math.min(5, Math.max(1, Math.round(item.rating))) as 1 | 2 | 3 | 4 | 5;
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [items]);

  // Filter items including Sentiment
  const displayedItems = useMemo(() => {
    return items.filter((item) => {
      if (sentimentFilter === 'ALL') return true;
      return getSentiment(item.rating) === sentimentFilter;
    });
  }, [items, sentimentFilter]);

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

  const renderSentimentBadge = (rating: number) => {
    const s = getSentiment(rating);
    if (s === 'POSITIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Smile className="w-3 h-3 text-emerald-600" /> Positive
        </span>
      );
    }
    if (s === 'NEUTRAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
          <Meh className="w-3 h-3 text-sky-600" /> Neutral
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <Frown className="w-3 h-3 text-rose-600" /> Attention Needed
      </span>
    );
  };

  const satisfactionRate = useMemo(() => {
    if (items.length === 0) return 100;
    const satisfied = items.filter((i) => i.rating >= 4).length;
    return Math.round((satisfied / items.length) * 100);
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                User Feedback & Sentiment Center 3.0
              </h1>
              <p className="text-xs text-slate-500">
                Authoritative user sentiment, 1–5 star rating distribution, and tool performance cross-referencing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchFeedback}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportCSV}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition shadow-2xs disabled:bg-slate-300 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top Analytics Cards + 1-5 Star Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        {/* KPI 1: Total & Avg Rating */}
        <div className="lg:col-span-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Average Rating</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="my-2">
            {analytics.total === 0 ? (
              <div className="text-xl font-bold text-slate-400">No feedback yet</div>
            ) : (
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {analytics.avgRating.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-slate-400">/ 5.0</span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    analytics.total > 0 && analytics.avgRating >= s
                      ? 'text-amber-400 fill-amber-400'
                      : analytics.total > 0 && analytics.avgRating >= s - 0.5
                      ? 'text-amber-300 fill-amber-200'
                      : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Total Feedback: <span className="font-bold text-slate-800">{analytics.total}</span>
          </div>
        </div>

        {/* KPI 2: Star Distribution Progress Bars */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            1-to-5 Star Distribution (5★ to 1★)
          </span>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = analytics.starCounts?.[star as 1 | 2 | 3 | 4 | 5] || 0;
              const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700 w-8 font-mono flex items-center gap-0.5">
                    {star} <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-blue-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-[11px] font-mono text-slate-500">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* KPI 3: Status Breakdown */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-slate-500 text-xs font-medium">New</span>
            <div className="my-1">
              <span className="text-2xl font-black text-indigo-600">{analytics.byStatus?.NEW || 0}</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">Fresh submissions</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-slate-500 text-xs font-medium">In Review</span>
            <div className="my-1">
              <span className="text-2xl font-black text-amber-600">{analytics.byStatus?.IN_REVIEW || 0}</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">Under evaluation</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-slate-500 text-xs font-medium">Resolved</span>
            <div className="my-1">
              <span className="text-2xl font-black text-emerald-600">{analytics.byStatus?.RESOLVED || 0}</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">Completed</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-slate-500 text-xs font-medium">Archived</span>
            <div className="my-1">
              <span className="text-2xl font-black text-slate-600">{analytics.byStatus?.ARCHIVED || 0}</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">Stored for history</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search feedback text, email, user, or tool..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden text-slate-800 font-semibold cursor-pointer"
            >
              <option value="ALL">Status: All</option>
              <option value="NEW">New</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            {/* Rating Filter */}
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden text-slate-800 font-semibold cursor-pointer"
            >
              <option value="ALL">Rating: All</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            {/* User Type Filter */}
            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden text-slate-800 font-semibold cursor-pointer"
            >
              <option value="ALL">User Type: All</option>
              <option value="GUEST">Guest</option>
              <option value="FREE">Free Account</option>
              <option value="PRO">Pro Account</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden text-slate-800 font-semibold cursor-pointer"
            >
              <option value="ALL">Date: All</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>

            {/* Sentiment Filter */}
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden text-slate-800 font-semibold cursor-pointer"
            >
              <option value="ALL">Sentiment: All</option>
              <option value="POSITIVE">Positive</option>
              <option value="NEUTRAL">Neutral</option>
              <option value="NEGATIVE">Negative</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: 'General', label: 'General' },
            { id: 'Bug', label: 'Bug' },
            { id: 'Tool Issue', label: 'Tool Issue' },
            { id: 'Feature Request', label: 'Feature Request' },
            { id: 'Performance', label: 'Performance' },
            { id: 'Privacy', label: 'Privacy' },
            { id: 'Payment', label: 'Payment' },
            { id: 'Other', label: 'Other' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
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

      {/* Feedback Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading real feedback database records...
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No feedback yet</div>
            <p className="text-xs text-slate-400">
              When users complete tools and submit ratings, feedback records will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-4 min-w-[220px]">Message</th>
                  <th className="py-3 px-3">Tool</th>
                  <th className="py-3 px-3">User Type</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.map((item) => {
                  const userLabel = item.email || (item.userId ? `User: ${item.userId.slice(0, 8)}...` : item.guestSessionId ? `Guest: ${item.guestSessionId.slice(0, 10)}...` : 'Guest');
                  const userTypeBadgeColor =
                    item.userType === 'PRO'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : item.userType === 'FREE'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => {
                        setSelectedItem(item);
                        setAdminNotesInput(item.adminNotes || '');
                      }}
                    >
                      {/* Rating */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                item.rating >= star
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {categoryIcon(item.category)}
                          <span>{item.category}</span>
                        </span>
                      </td>

                      {/* Message */}
                      <td className="py-3 px-4 max-w-xs truncate text-slate-800 font-medium">
                        "{item.message}"
                      </td>

                      {/* Tool */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.toolKey || item.toolSlug ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {item.toolKey || item.toolSlug}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* User Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${userTypeBadgeColor}`}>
                          {item.userType || 'GUEST'}
                        </span>
                      </td>

                      {/* User */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium truncate max-w-[130px]">
                        {userLabel}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {statusBadge(item.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={item.status === 'UNDER_REVIEW' ? 'IN_REVIEW' : item.status}
                          disabled={updatingId === item.id}
                          onChange={(e) => updateStatus(item.id, e.target.value as any)}
                          className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-700 font-bold cursor-pointer"
                        >
                          <option value="NEW">New</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {categoryIcon(selectedItem.category)}
                <h3 className="text-base font-bold text-slate-900">Feedback Details</h3>
              </div>
              <div className="flex items-center gap-2">
                {renderSentimentBadge(selectedItem.rating)}
                {statusBadge(selectedItem.status)}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed text-slate-800 font-medium">
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
                  <span className="font-semibold text-slate-800">User Type:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedItem.userType || 'GUEST'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">User Identity:</span>{' '}
                  {selectedItem.email ? (
                    <a
                      href={`mailto:${selectedItem.email}?subject=Saarvi%20Support%20Follow-up`}
                      className="text-blue-600 hover:underline font-bold inline-flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" /> {selectedItem.email}
                    </a>
                  ) : selectedItem.userId ? (
                    <span className="font-mono text-[11px] text-slate-700">{selectedItem.userId}</span>
                  ) : selectedItem.guestSessionId ? (
                    <span className="font-mono text-[11px] text-slate-500">Guest ({selectedItem.guestSessionId.slice(0, 14)}...)</span>
                  ) : (
                    'Guest User'
                  )}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Tool:</span>{' '}
                  {selectedItem.toolKey || selectedItem.toolSlug ? (
                    <Link
                      href={`/admin/tools`}
                      className="text-blue-600 font-mono font-bold hover:underline"
                    >
                      {selectedItem.toolKey || selectedItem.toolSlug}
                    </Link>
                  ) : (
                    'General Platform'
                  )}
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
                {selectedItem.resolvedAt && (
                  <div className="col-span-2 text-emerald-700 font-medium">
                    Resolved at {new Date(selectedItem.resolvedAt).toLocaleString()} by {selectedItem.resolvedBy || 'Admin'}
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div className="space-y-1.5 pt-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Internal Admin Note (Never shown to users)
                </label>
                <textarea
                  rows={3}
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="Internal notes about bug resolution, JIRA/linear ticket, or user follow-up..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-800 resize-none font-medium"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateStatus(selectedItem.id, 'IN_REVIEW', adminNotesInput)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer transition shadow-2xs"
                >
                  Mark In Review
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(selectedItem.id, 'RESOLVED', adminNotesInput)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition shadow-2xs"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(selectedItem.id, 'ARCHIVED', adminNotesInput)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition"
                >
                  Archive
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  updateStatus(selectedItem.id, selectedItem.status as any, adminNotesInput);
                  setSelectedItem(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-xs"
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
