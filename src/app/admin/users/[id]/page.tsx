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
  Mail,
  Send,
  CreditCard,
  Video,
  Bell,
  FileText,
  ShieldCheck,
  EyeOff,
  Check,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole, UserAccountStatus } from '@/types/auth';
import type { UserAnalyticsSummary } from '@/lib/analytics/analytics-store';
import type { UserToolUsageSummary } from '@/types/tool-control';

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
  welcomeSentAt?: string | null;
}

interface ConversionRecord {
  id: string;
  toolType: string;
  toolName: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

interface InterviewRecord {
  id: string;
  jobRole: string;
  companyTarget: string;
  status: string;
  score?: number | null;
  questionCount: number;
  createdAt: string;
}

interface NotificationItem {
  id: string;
  title: string;
  category: string;
  channel: string;
  deliveryStatus: string;
  read: boolean;
  readAt?: string | null;
  deliveredAt?: string | null;
}

interface SubscriptionRecord {
  id: string;
  type: 'SUBSCRIPTION' | 'REQUEST';
  plan: string;
  status: string;
  amount?: number;
  paymentMethod?: string;
  transactionId?: string;
  billingPeriod?: string;
  createdAt: string;
}

export default function UserAnalyticsDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const { user: currentAdmin, profile: currentProfile } = useAuth();

  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'conversions' | 'interviews' | 'notifications' | 'billing' | 'privacy' | 'usage'>('overview');
  const [userData, setUserData] = useState<UserDetail | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalyticsSummary | null>(null);
  const [userToolUsage, setUserToolUsage] = useState<UserToolUsageSummary | null>(null);
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resendingWelcome, setResendingWelcome] = useState(false);
  const [welcomeFeedback, setWelcomeFeedback] = useState<string | null>(null);

  // Role update state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('USER');
  const [roleReason, setRoleReason] = useState('');

  const isSuperAdmin = currentProfile?.role === 'SUPER_ADMIN' || currentAdmin?.role === 'SUPER_ADMIN';

  const fetchUserData = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      const res = await fetch(`/api/admin/users/${userId}?period=${period}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('User not found');
        if (res.status === 401 || res.status === 403) throw new Error('Unauthorized');
        throw new Error('Failed to load user data');
      }
      const data = await res.json();
      if (data.success) {
        setUserData(data.user);
        setSelectedRole(data.user.role);
        setAnalytics(data.analytics);
        setConversions(data.conversions || []);
        setInterviews(data.interviews || []);
        setNotifications(data.notifications || []);
        setSubscriptions(data.subscriptions || []);

        try {
          const usageRes = await fetch(`/api/admin/tools/user-usage?userId=${userId}`);
          if (usageRes.ok) {
            const uData = await usageRes.json();
            if (uData.success) {
              setUserToolUsage(uData.summary);
            }
          }
        } catch {}
      }
    } catch (err: any) {
      console.error('Error fetching user details:', err);
      setError(err.message || 'Failed to load user details');
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
    } catch {
      alert('Error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendWelcome = async () => {
    if (!userData) return;
    setResendingWelcome(true);
    setWelcomeFeedback(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESEND_WELCOME' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWelcomeFeedback('Welcome email sent successfully!');
        setUserData((prev) => (prev ? { ...prev, welcomeSentAt: new Date().toISOString() } : prev));
        setTimeout(() => setWelcomeFeedback(null), 4000);
      } else {
        alert(data.error || 'Failed to send welcome email');
      }
    } catch {
      alert('Network error while attempting to resend welcome email');
    } finally {
      setResendingWelcome(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!userData || !isSuperAdmin) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ROLE',
          role: selectedRole,
          reason: roleReason || 'Role modified in Admin Center',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserData((prev) => (prev ? { ...prev, role: selectedRole } : prev));
        setShowRoleModal(false);
        setRoleReason('');
      } else {
        alert(data.error || 'Failed to update role');
      }
    } catch {
      alert('Error updating user role');
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
        <p className="text-sm font-medium text-slate-600">Loading user profile & real activity data...</p>
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

  const initials = (userData.fullName || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
                {userData.fullName}
              </h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                userData.plan === 'PRO'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {userData.plan} Plan
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                userData.role === 'SUPER_ADMIN'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : userData.role === 'ADMIN'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {userData.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative server records only. Workspace documents stay local in user browser.
            </p>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Resend Welcome Email Button */}
          <button
            type="button"
            onClick={handleResendWelcome}
            disabled={resendingWelcome}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Resend official welcome onboarding email"
          >
            {resendingWelcome ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>{resendingWelcome ? 'Sending...' : 'Resend Welcome Email'}</span>
          </button>

          {/* Superadmin Role Change Button */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowRoleModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              <span>Change Role</span>
            </button>
          )}

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchUserData();
            }}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            title="Refresh user data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {welcomeFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{welcomeFeedback}</span>
        </div>
      )}

      {/* 2. Identity Card & Lifecycle Summary */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-xs shrink-0 select-none">
            {userData.avatarUrl ? (
              <img src={userData.avatarUrl} alt={userData.fullName} className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base text-slate-900">{userData.fullName}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                userData.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {userData.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {userData.status}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                {userData.authProvider}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500">{userData.email}</p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 flex-wrap">
              <span>ID: <code className="font-mono text-slate-700">{userData.id.slice(0, 12)}...</code></span>
              <span>•</span>
              <span>Joined: <strong className="text-slate-700">{new Date(userData.createdAt).toLocaleDateString()}</strong></span>
              <span>•</span>
              <span>Last Active: <strong className="text-slate-700">{userData.lastSignInAt ? new Date(userData.lastSignInAt).toLocaleString() : 'Never'}</strong></span>
              <span>•</span>
              <span>Welcome Email: <strong className="text-slate-700">{userData.welcomeSentAt ? 'Sent' : 'Pending'}</strong></span>
            </div>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center gap-2">
          {userData.status === 'ACTIVE' ? (
            <button
              onClick={handleToggleStatus}
              disabled={actionLoading || userData.id === currentAdmin?.id}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 transition disabled:opacity-50 cursor-pointer"
            >
              Suspend Account
            </button>
          ) : (
            <button
              onClick={handleToggleStatus}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition disabled:opacity-50 cursor-pointer"
            >
              Reactivate Account
            </button>
          )}
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Telemetry Overview', icon: Activity, count: analytics?.totalToolUses ?? 0 },
          { id: 'usage', label: 'Usage Analytics', icon: Wrench, count: userToolUsage?.totalOperations ?? analytics?.totalToolUses ?? 0 },
          { id: 'conversions', label: 'Conversion History', icon: FileText, count: conversions.length },
          { id: 'interviews', label: 'Mock Interviews', icon: Video, count: interviews.length },
          { id: 'notifications', label: 'Notifications', icon: Bell, count: notifications.length },
          { id: 'billing', label: 'Subscription & Payments', icon: CreditCard, count: subscriptions.length },
          { id: 'privacy', label: 'Privacy & Storage Invariants', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                  isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Contents */}

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Tool Runs</span>
                <Wrench className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                {analytics?.totalToolUses ?? 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Real tool executions</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Successful</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-600 font-mono">
                {analytics?.completedUses ?? 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Completed runs</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Conversions</span>
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-extrabold text-purple-600 font-mono">
                {conversions.length}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Documents processed</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mock Interviews</span>
                <Video className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-extrabold text-indigo-600 font-mono">
                {interviews.length}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Completed sessions</p>
            </div>
          </div>

          {/* Top Tools Grid */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Tool Usage Breakdown</span>
            </h3>

            {analytics?.mostUsedTools && analytics.mostUsedTools.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {analytics.mostUsedTools.map((tool) => (
                  <div key={tool.toolId} className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{tool.toolName}</h4>
                      <p className="text-[10px] font-mono text-slate-400">{tool.toolId}</p>
                    </div>
                    <span className="text-xs font-extrabold font-mono text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                      {tool.count} runs
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No tool executions recorded for this period yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CONVERSIONS */}
      {activeTab === 'conversions' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Document Conversion History
              </h3>
              <p className="text-xs text-slate-500">Real conversion events recorded in database</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              Total: {conversions.length}
            </span>
          </div>

          {conversions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Tool Type</th>
                    <th className="py-3 px-3">Document / Label</th>
                    <th className="py-3 px-3">Size</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {conversions.map((conv) => (
                    <tr key={conv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {conv.toolName || conv.toolType}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 truncate max-w-xs">
                        {conv.fileName}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {conv.fileSize > 0 ? `${(conv.fileSize / 1024).toFixed(1)} KB` : 'Local'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          conv.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {conv.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(conv.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No conversion history recorded for this user yet.
            </div>
          )}
        </div>
      )}

      {/* TAB: MOCK INTERVIEWS */}
      {activeTab === 'interviews' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Mock Interview Sessions
              </h3>
              <p className="text-xs text-slate-500">Real candidate practice sessions and performance telemetry</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              Total: {interviews.length}
            </span>
          </div>

          {interviews.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Job / Target Role</th>
                    <th className="py-3 px-3">Target Company</th>
                    <th className="py-3 px-3">Questions</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interviews.map((intv) => (
                    <tr key={intv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {intv.jobRole}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {intv.companyTarget}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono">
                        {intv.questionCount}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        {typeof intv.score === 'number' ? (
                          <span className="text-blue-600">{intv.score}%</span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                          {intv.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(intv.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No mock interview sessions recorded for this user yet.
            </div>
          )}
        </div>
      )}

      {/* TAB: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Notifications Dispatched
              </h3>
              <p className="text-xs text-slate-500">In-app and transactional communications delivered</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              Total: {notifications.length}
            </span>
          </div>

          {notifications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Notification Title</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Channel</th>
                    <th className="py-3 px-3">Delivery Status</th>
                    <th className="py-3 px-3">Read Status</th>
                    <th className="py-3 px-3">Dispatched At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notifications.map((notif) => (
                    <tr key={notif.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {notif.title}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {notif.category}
                      </td>
                      <td className="py-3 px-3 text-slate-600 uppercase font-mono text-[10px]">
                        {notif.channel}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {notif.deliveryStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {notif.read ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Read
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">Unread</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {notif.deliveredAt ? new Date(notif.deliveredAt).toLocaleString() : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No notifications dispatched to this user yet.
            </div>
          )}
        </div>
      )}

      {/* TAB: BILLING */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Subscriptions & Payment History
              </h3>
              <p className="text-xs text-slate-500">Plan entitlements, UPI verification requests, and audit ledger</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              Total Records: {subscriptions.length}
            </span>
          </div>

          {subscriptions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Plan</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Method / Ref</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {sub.type}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {sub.plan}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {sub.amount ? `₹${sub.amount}` : 'Included'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {sub.paymentMethod || 'Manual'} ({sub.transactionId || 'N/A'})
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'active' || sub.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : sub.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(sub.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No subscription or payment requests found for this user.
            </div>
          )}
        </div>
      )}

      {/* TAB: PRIVACY & STORAGE INVARIANTS */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 text-blue-600">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Privacy & Architecture Invariants</h3>
              <p className="text-xs text-slate-500">Saarvi Local-First Security & Zero-Leak Principles</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Workspace Documents
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                PDFs, resumes, images, and cover letters are processed client-side. Zero server cloud storage is retained.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <Check className="w-3 h-3" /> Local Browser Only
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Academic Marks & Notes
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                VTU semester marks, SGPA snapshots, and draft course notes stay in browser IndexedDB / localStorage.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <Check className="w-3 h-3" /> Zero Cloud Retention
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Admin Impersonation
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Admins and SuperAdmins cannot log in as the user or read their client-side private storage keys.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                <EyeOff className="w-3 h-3" /> Zero Impersonation
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB: USAGE ANALYTICS */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Usage Metrics Header Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Operations</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {userToolUsage?.totalOperations ?? analytics?.totalToolUses ?? 0}
              </span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Unique Tools</span>
              <span className="text-2xl font-black text-blue-600 mt-1 block">
                {userToolUsage?.uniqueTools ?? analytics?.mostUsedTools?.length ?? 0}
              </span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Most Used Tool</span>
              <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
                {userToolUsage?.mostUsedTool !== 'None' ? userToolUsage?.mostUsedTool : (analytics?.mostUsedTools?.[0]?.toolName || 'None')}
              </span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Used Tool</span>
              <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
                {userToolUsage?.lastUsedTool !== 'None' ? userToolUsage?.lastUsedTool : (analytics?.lastUsedTool?.name || 'None')}
              </span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Activity</span>
              <span className="text-xs font-semibold text-slate-600 mt-1 block">
                {userToolUsage?.lastActivity ? new Date(userToolUsage.lastActivity).toLocaleDateString() : 'Never'}
              </span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Success Rate</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {userToolUsage?.successRate ?? 100}%
              </span>
            </div>
          </div>

          {/* Tool Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Per-Tool Usage Breakdown</h3>
                <p className="text-xs text-slate-500">Live operational telemetry recorded for this user.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                {userToolUsage?.tools?.length || 0} tools accessed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Tool</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Total Uses</th>
                    <th className="py-3 px-4 text-center">Successful</th>
                    <th className="py-3 px-4 text-center">Failed</th>
                    <th className="py-3 px-4 text-right">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {userToolUsage && userToolUsage.tools && userToolUsage.tools.length > 0 ? (
                    userToolUsage.tools.map((t) => (
                      <tr key={t.toolKey} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {t.toolName}
                          <span className="block text-[10px] font-mono text-slate-400 font-normal">{t.toolKey}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900">{t.totalUses}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-600">{t.successfulUses}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-rose-500">{t.failedUses}</td>
                        <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-[11px]">
                          {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                        No tool usage records recorded for this user yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUPERADMIN ROLE MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center gap-3 text-purple-600">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Modify User Role</h4>
                <p className="text-xs text-slate-500">SuperAdmin authorization required</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select New Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="USER">USER (Standard Member)</option>
                <option value="ADMIN">ADMIN (Operations & Content)</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (Billing, System & Security)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Reason for Change (Audit Log)
              </label>
              <input
                type="text"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder="e.g., Promotion to operational staff"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={actionLoading}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                {actionLoading ? 'Updating...' : 'Confirm Role Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
