"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Shield,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  Search,
  Bot,
  Activity,
  Calendar,
  Layers,
  Compass,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole, UserAccountStatus } from '@/types/auth';
import type { UserAnalyticsSummary } from '@/lib/analytics/analytics-store';

interface UserDetail {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserAccountStatus;
  plan: 'FREE' | 'PRO';
  authProvider: 'EMAIL' | 'GOOGLE';
  createdAt: string;
  updatedAt: string;
  lastSignInAt?: string | null;
}

export default function UserAnalyticsDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const { user: currentAdmin, profile: currentProfile } = useAuth();

  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [userData, setUserData] = useState<UserDetail | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      const res = await fetch(`/api/admin/users/${userId}?period=${period}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('User not found');
        if (res.status === 401 || res.status === 403) throw new Error('Unauthorized');
        throw new Error('Failed to load user analytics');
      }
      const data = await res.json();
      if (data.success) {
        setUserData(data.user);
        setAnalytics(data.analytics);
      }
    } catch (err: any) {
      console.error('Error fetching user details:', err);
      setError(err.message || 'Failed to load user analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, period]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleToggleStatus = async () => {
    if (!userData) return;
    const newStatus: UserAccountStatus = userData.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to set this account to ${newStatus}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STATUS', status: newStatus }),
      });
      if (res.ok) {
        setUserData((prev) => (prev ? { ...prev, status: newStatus } : prev));
      } else {
        alert('Failed to update account status');
      }
    } catch (err) {
      alert('Error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  const periodLabels: Record<string, string> = {
    today: 'Today',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    all: 'All Time',
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-600">Loading user analytics dashboard...</p>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">User Dashboard Unavailable</h2>
        <p className="text-sm text-slate-600">{error || 'Could not find the requested user.'}</p>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Users Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            title="Return to Users Directory"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                User Analytics Dashboard
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                {userData.plan} Tier
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive telemetry, tool adoption, category usage, and safe activity history.
            </p>
          </div>
        </div>

        {/* Period Selector Tabs & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {(['today', '7d', '30d', '90d', 'all'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === p
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchUserData();
            }}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Privacy & Compliance Assurance Notice */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900">
        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
        <div>
          <span className="font-bold">Privacy-Preserving Telemetry:</span> Strictly operational counts, tool IDs, and durations are shown.
          No private document text, student marks, notes, resumes, or local workspace files are collected or exposed.
        </div>
      </div>

      {/* 3. User Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-xl font-extrabold shadow-sm shrink-0">
            {userData.fullName ? userData.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{userData.fullName}</h2>
              <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                userData.role === 'SUPER_ADMIN'
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : userData.role === 'ADMIN'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {userData.role}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                userData.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {userData.status}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                {userData.authProvider}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500">{userData.email}</p>
            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
              <span>ID: <code className="font-mono text-slate-700">{userData.id.substring(0, 8)}...</code></span>
              <span>•</span>
              <span>Joined: <strong className="text-slate-700">{new Date(userData.createdAt).toLocaleDateString()}</strong></span>
              <span>•</span>
              <span>Last Active: <strong className="text-slate-700">{userData.lastSignInAt ? new Date(userData.lastSignInAt).toLocaleString() : 'Never'}</strong></span>
            </div>
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          {userData.status === 'ACTIVE' ? (
            <button
              onClick={handleToggleStatus}
              disabled={actionLoading || userData.id === currentAdmin?.id}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 transition disabled:opacity-50"
            >
              Suspend Account
            </button>
          ) : (
            <button
              onClick={handleToggleStatus}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition disabled:opacity-50"
            >
              Reactivate Account
            </button>
          )}
        </div>
      </div>

      {/* 4. Usage KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Tool Uses */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tool Runs</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {analytics?.totalToolUses ?? 0}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Executions in window</p>
          </div>
        </div>

        {/* Completed Runs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Completed</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-600 font-mono">
              {analytics?.completedUses ?? 0}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Successful operations</p>
          </div>
        </div>

        {/* Failed Operations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Errors / Failed</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-red-600 font-mono">
              {analytics?.failedUses ?? 0}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Encountered errors</p>
          </div>
        </div>

        {/* Search Queries */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Searches</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Search className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {analytics?.searches ?? 0}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Quick search queries</p>
          </div>
        </div>

        {/* AI Assistant Uses */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">AI Assistant</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-indigo-600 font-mono">
              {analytics?.aiUses ?? 0}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Assistant interactions</p>
          </div>
        </div>
      </div>

      {/* 5. Most Used Tools & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Used Tools (2 columns on large) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Most Used Tools</h3>
            </div>
            <span className="text-[11px] text-slate-400">{periodLabels[period]}</span>
          </div>

          {!analytics?.mostUsedTools || analytics.mostUsedTools.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No tool executions recorded for this account in the selected period.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.mostUsedTools.map((tool, idx) => {
                const maxCount = analytics.mostUsedTools[0]?.count || 1;
                const percentage = Math.round((tool.count / maxCount) * 100);
                return (
                  <div key={tool.toolId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-slate-400 font-mono text-[11px]">#{idx + 1}</span>
                        <span className="font-semibold text-slate-800">{tool.toolName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          {tool.categoryName}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {tool.count} {tool.count === 1 ? 'run' : 'runs'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Category Usage</h3>
            </div>
          </div>

          {!analytics?.categoryUsage || analytics.categoryUsage.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No category telemetry available.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.categoryUsage.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{cat.categoryName}</span>
                    <span className="font-mono text-slate-900 font-bold">{cat.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Discovery Sources & Activity Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discovery Sources */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Tool Discovery Channels</h3>
            </div>
          </div>

          {!analytics?.discoverySources || analytics.discoverySources.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              No discovery channels recorded.
            </div>
          ) : (
            <div className="space-y-2.5">
              {analytics.discoverySources.map((ds) => (
                <div key={ds.source} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50">
                  <span className="font-medium text-slate-700 capitalize">{ds.source}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600">{ds.count} times</span>
                    <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-900">
                      {ds.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Trend (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm">Activity Frequency Trend</h3>
            </div>
            <span className="text-[11px] text-slate-400">Events per day</span>
          </div>

          {!analytics?.activityTrend || analytics.activityTrend.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              No daily trend data available for this window.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {analytics.activityTrend.slice(-14).map((pt) => (
                <div key={pt.date} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-1">
                  <div className="text-[10px] text-slate-400">{pt.label}</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900">{pt.count}</div>
                  <div className="text-[9px] text-slate-400">events</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Recent Safe Activity History (Zero Private Data) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-slate-900 text-sm">Recent Safe Activity</h3>
          </div>
          <span className="text-[11px] text-slate-400">Last 20 events</span>
        </div>

        {!analytics?.recentActivity || analytics.recentActivity.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            No recent activity recorded for this user.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Tool / Feature</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.recentActivity.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {evt.eventType}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {evt.toolName || evt.toolId || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : evt.status === 'failed'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                      {evt.durationMs ? `${evt.durationMs}ms` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] font-mono">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
