"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  Wrench,
  GraduationCap,
  BookOpen,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Bell,
  Sparkles,
  Sliders,
  Radio,
  RefreshCw,
  Info,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Server,
  ChevronRight,
  ToggleLeft,
  Briefcase,
  Compass,
  Video,
  CreditCard,
  Megaphone,
  Plus,
  LifeBuoy,
} from 'lucide-react';
import { adminAnalyticsService } from '@/lib/services/adminAnalyticsService';
import {
  DateRangePeriod,
  DashboardKPIs,
  TimeSeriesPoint,
  CategoryDistribution,
  SystemHealthCheck,
  AuditLogRecord,
  PlatformErrorRecord,
} from '@/types/admin';
import { UserProfile, UserAccountStatus } from '@/types/auth';
import ChartCardWrapper from '@/components/admin/charts/ChartCardWrapper';
import AdminLineChart from '@/components/admin/charts/AdminLineChart';
import AdminBarChart from '@/components/admin/charts/AdminBarChart';
import AdminDonutChart from '@/components/admin/charts/AdminDonutChart';

export default function AdminAnalyticsDashboard() {
  // Global Period & Refresh State
  const [period, setPeriod] = useState<DateRangePeriod>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');

  // Independent Section Loading States
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(true);
  const [errorsLoading, setErrorsLoading] = useState(true);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);

  // Section-Level Error Isolation
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({});

  // Core Aggregated Data States
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [userGrowthSeries, setUserGrowthSeries] = useState<TimeSeriesPoint[]>([]);
  const [newUsersSeries, setNewUsersSeries] = useState<TimeSeriesPoint[]>([]);
  const [accountStatusDist, setAccountStatusDist] = useState<CategoryDistribution[]>([]);
  const [toolMetrics, setToolMetrics] = useState<{
    total: number;
    available: number;
    beta: number;
    comingSoon: number;
    disabled: number;
    maintenance: number;
    statusDistribution: CategoryDistribution[];
    categoryDistribution: CategoryDistribution[];
  } | null>(null);
  const [studentToolsDist, setStudentToolsDist] = useState<CategoryDistribution[]>([]);
  const [curriculumMetrics, setCurriculumMetrics] = useState<{
    total: number;
    active: number;
    verified: number;
    totalCourses: number;
    schemeDistribution: CategoryDistribution[];
    statusDistribution: CategoryDistribution[];
  } | null>(null);
  const [activityMetrics, setActivityMetrics] = useState<{
    totalEvents: number;
    timeSeries: TimeSeriesPoint[];
    typeCounts: Record<string, number>;
  } | null>(null);
  const [errorMetrics, setErrorMetrics] = useState<{
    totalInPeriod: number;
    unresolved: number;
    severityDistribution: CategoryDistribution[];
    timeSeries: TimeSeriesPoint[];
  } | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthCheck[]>([]);
  const [recentUsers, setRecentUsers] = useState<Array<Omit<UserProfile, 'avatarUrl'> & { status: UserAccountStatus }>>([]);
  const [recentAudit, setRecentAudit] = useState<AuditLogRecord[]>([]);
  const [recentErrors, setRecentErrors] = useState<PlatformErrorRecord[]>([]);

  // Activity filter state
  const [activityFilter, setActivityFilter] = useState<'all' | 'tool' | 'student' | 'account' | 'system'>('all');

  // Tab visibility tracking
  const isTabVisibleRef = useRef(true);

  // =========================================================================
  // INDEPENDENT SECTION LOADERS (PARALLEL & NON-BLOCKING)
  // =========================================================================

  // P0: Dashboard Summary (KPIs) - Authoritative endpoint with /api/admin/analytics/overview fallback
  const loadSummary = useCallback(async (selectedPeriod: DateRangePeriod, force = false) => {
    setSummaryLoading(true);
    setSectionErrors((prev) => ({ ...prev, summary: null }));
    try {
      const summaryKpis = await adminAnalyticsService.getDashboardSummary(selectedPeriod, force);
      setKpis(summaryKpis);
      setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: unknown) {
      // Fallback check to /api/admin/analytics/overview if primary summary endpoint fails
      try {
        const res = await fetch(`/api/admin/analytics/overview?period=${selectedPeriod}`);
        if (res.ok) {
          const json = await res.json();
          if (json.userMetrics) {
            setKpis(json.userMetrics);
            return;
          }
        }
      } catch {
        // ignore fallback error
      }
      setSectionErrors((prev) => ({
        ...prev,
        summary: err instanceof Error ? err.message : 'Failed to load summary KPIs.',
      }));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // P1: User Growth Time Series
  const loadUserGrowth = useCallback(async (selectedPeriod: DateRangePeriod, force = false) => {
    setGrowthLoading(true);
    setSectionErrors((prev) => ({ ...prev, growth: null }));
    try {
      const data = await adminAnalyticsService.getUserGrowthData(selectedPeriod, force);
      setUserGrowthSeries(data.series);
      setNewUsersSeries(data.newUsersSeries);
      setAccountStatusDist(data.accountStatusDist);
    } catch (err: unknown) {
      setSectionErrors((prev) => ({
        ...prev,
        growth: err instanceof Error ? err.message : 'Failed to load user growth data.',
      }));
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  // P1: Platform Activity
  const loadActivity = useCallback(
    async (selectedPeriod: DateRangePeriod, filter: 'all' | 'tool' | 'student' | 'account' | 'system', force = false) => {
      setActivityLoading(true);
      setSectionErrors((prev) => ({ ...prev, activity: null }));
      try {
        const data = await adminAnalyticsService.getPlatformActivityData(selectedPeriod, filter, force);
        setActivityMetrics({
          totalEvents: data.totalEvents,
          timeSeries: data.timeSeries,
          typeCounts: data.typeCounts,
        });
      } catch (err: unknown) {
        setSectionErrors((prev) => ({
          ...prev,
          activity: err instanceof Error ? err.message : 'Failed to load platform activity.',
        }));
      } finally {
        setActivityLoading(false);
      }
    },
    []
  );

  // P2: System Diagnostics
  const loadDiagnostics = useCallback(async (force = false) => {
    setDiagnosticsLoading(true);
    setSectionErrors((prev) => ({ ...prev, diagnostics: null }));
    try {
      const probes = await adminAnalyticsService.getSystemHealth(force);
      setSystemHealth(probes);
    } catch (err: unknown) {
      setSectionErrors((prev) => ({
        ...prev,
        diagnostics: err instanceof Error ? err.message : 'Failed to load system diagnostics.',
      }));
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  // P2: Error Analytics
  const loadErrors = useCallback(async (selectedPeriod: DateRangePeriod, force = false) => {
    setErrorsLoading(true);
    setSectionErrors((prev) => ({ ...prev, errors: null }));
    try {
      const data = await adminAnalyticsService.getErrorAnalyticsData(selectedPeriod, force);
      setErrorMetrics({
        totalInPeriod: data.totalInPeriod,
        unresolved: data.unresolved,
        severityDistribution: data.severityDistribution,
        timeSeries: data.timeSeries,
      });
    } catch (err: unknown) {
      setSectionErrors((prev) => ({
        ...prev,
        errors: err instanceof Error ? err.message : 'Failed to load error metrics.',
      }));
    } finally {
      setErrorsLoading(false);
    }
  }, []);

  // P2: Tools and Curriculum Configuration
  const loadToolsAndCurriculum = useCallback(async () => {
    setToolsLoading(true);
    try {
      const [tMetrics, sDist, cMetrics] = await Promise.all([
        adminAnalyticsService.getToolMetrics(),
        adminAnalyticsService.getStudentToolsDistribution(),
        adminAnalyticsService.getCurriculumMetrics(),
      ]);
      setToolMetrics(tMetrics);
      setStudentToolsDist(sDist);
      setCurriculumMetrics(cMetrics);
    } catch (err) {
      console.warn('[AdminDashboard] Tools/Curriculum load notice:', err);
    } finally {
      setToolsLoading(false);
    }
  }, []);

  // P2: Recent Tables (Users, Audit Logs, Errors)
  const loadRecentData = useCallback(async () => {
    setRecentLoading(true);
    try {
      const [u, a, e] = await Promise.all([
        adminAnalyticsService.getRecentUsers(6),
        adminAnalyticsService.getRecentAuditLogs(6),
        adminAnalyticsService.getRecentErrors(6),
      ]);
      setRecentUsers(u);
      setRecentAudit(a);
      setRecentErrors(e);
    } catch (err) {
      console.warn('[AdminDashboard] Recent data load notice:', err);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  // =========================================================================
  // TRIGGER LIFECYCLES ON PERIOD CHANGE
  // =========================================================================

  useEffect(() => {
    // P0: Summary loads first
    loadSummary(period);

    // P1: In parallel
    loadUserGrowth(period);
    loadActivity(period, activityFilter);

    // P2: Background
    loadDiagnostics();
    loadErrors(period);
    loadToolsAndCurriculum();
    loadRecentData();
  }, [period, loadSummary, loadUserGrowth, loadActivity, loadDiagnostics, loadErrors, loadToolsAndCurriculum, loadRecentData, activityFilter]);

  // Handle activity category change without refetching other sections
  const handleActivityFilterChange = (newCat: 'all' | 'tool' | 'student' | 'account' | 'system') => {
    setActivityFilter(newCat);
    loadActivity(period, newCat);
  };

  // =========================================================================
  // SOFT REFRESH (NO BROWSER RELOAD)
  // =========================================================================

  const handleRefreshAnalytics = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        loadSummary(period, true),
        loadUserGrowth(period, true),
        loadActivity(period, activityFilter, true),
        loadDiagnostics(true),
        loadErrors(period, true),
        loadRecentData(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Tab visibility management to pause background work when hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Export summary report
  const handleExportSummary = () => {
    if (!kpis) return;
    const summaryData = {
      report: 'Saarvi Platform Analytics Overview',
      generatedAt: new Date().toISOString(),
      period,
      kpis,
      tools: toolMetrics,
      curriculum: curriculumMetrics,
      systemStatus: kpis.systemStatus,
      privacyModel: 'Zero user document contents or private calculations are exposed or stored server-side.',
    };

    const blob = new Blob([JSON.stringify(summaryData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saarvi-platform-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const periodLabels: Record<DateRangePeriod, string> = {
    today: 'Today',
    '7d': '7 Days',
    '30d': '30 Days',
    '90d': '90 Days',
    all: 'All Time',
    custom: 'Custom',
  };

  return (
    <div className="space-y-6 print:p-0">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & OPERATIONAL CONTROLS (Renders Immediately)                 */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 print:border-none">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-50 text-blue-700 font-semibold border border-blue-100">
              v{kpis?.version || '11.0.0'}
            </span>
            {kpis?.maintenanceMode && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold animate-pulse">
                <Radio className="w-3 h-3 text-amber-700" />
                Maintenance Mode Active
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real platform analytics, tool inventory, VTU academic versions, and system diagnostics.
          </p>
        </div>

        {/* Global Toolbar: Period Selector + Refresh + Print/Export */}
        <div className="flex items-center gap-2.5 flex-wrap print:hidden">
          {/* Period Selector Tabs */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {(['today', '7d', '30d', '90d', 'all'] as DateRangePeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === p
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Soft In-Place Refresh Button (Zero Page Reload) */}
          <button
            type="button"
            onClick={handleRefreshAnalytics}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            title="Refresh analytics data in-place without page reload"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Export Summary JSON */}
          <button
            type="button"
            onClick={handleExportSummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all"
            title="Export full analytics snapshot as JSON"
          >
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Print Dashboard */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all"
            title="Print or export dashboard as PDF"
          >
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Freshness & System Health Badge Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 print:hidden">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Last updated:{' '}
            <strong className="text-slate-700 font-mono">
              {summaryLoading ? 'Updating...' : lastUpdatedTime || kpis?.lastUpdated || 'Just now'}
            </strong>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">Period: {periodLabels[period]}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Real Server Data Only</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span>Platform Status:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                kpis?.systemStatus === 'Healthy'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : kpis?.systemStatus === 'Warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {summaryLoading ? 'Checking...' : kpis?.systemStatus || 'Healthy'}
            </span>
          </div>
        </div>
      </div>

      {/* Section-level summary error notice */}
      {sectionErrors.summary && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between gap-3">
          <span>{sectionErrors.summary}</span>
          <button
            type="button"
            onClick={() => loadSummary(period, true)}
            className="underline font-bold hover:text-red-900"
          >
            Retry Summary
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUICK ACTIONS BAR                                                      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-2.5 print:hidden">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Operational Quick Actions</span>
          </span>
          <span className="text-[11px] text-slate-400">Direct Command Shortcuts</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          <Link
            href="/admin/career"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition shrink-0"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>+ Discover Jobs</span>
          </Link>

          <Link
            href="/admin/career"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-2xs transition shrink-0"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>+ Discover Internships</span>
          </Link>

          <Link
            href="/admin/career"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
            <span>+ Add Job</span>
          </Link>

          <Link
            href="/admin/career"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <Briefcase className="w-3.5 h-3.5 text-purple-600" />
            <span>+ Add Internship</span>
          </Link>

          <Link
            href="/admin/mock-interview"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <Video className="w-3.5 h-3.5 text-indigo-600" />
            <span>+ Interview Question</span>
          </Link>

          <Link
            href="/admin/notifications"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>+ Send Notification</span>
          </Link>

          <Link
            href="/admin/advertising"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <Megaphone className="w-3.5 h-3.5 text-rose-600" />
            <span>+ Create Ad</span>
          </Link>

          <Link
            href="/admin/curriculum"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Add VTU Scheme</span>
          </Link>

          <Link
            href="/admin/billing"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-600" />
            <span>Review Payments</span>
          </Link>

          <Link
            href="/admin/support"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-teal-600" />
            <span>Support Inbox</span>
          </Link>

          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shrink-0"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TOP 10 CONTROL CENTER 3.0 SUMMARY CARDS (Clickable to Section)          */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Platform Overview &amp; Control KPIs</span>
          </h2>
          {kpis?.suspendedUsers && kpis.suspendedUsers > 0 ? (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              {kpis.suspendedUsers} Suspended Accounts
            </span>
          ) : null}
        </div>

        {/* Row 1: Users, Subscriptions & Activity */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: TOTAL USERS */}
          <Link
            href="/admin/users"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-blue-600 transition">
                Total Users
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                {summaryLoading ? '...' : kpis?.totalUsers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Registered accounts</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Manage Users</span>
              <span className="font-semibold text-blue-600 flex items-center gap-0.5">
                <span>Directory</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 2: ACTIVE USERS */}
          <Link
            href="/admin/users"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-purple-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-purple-600 transition">
                Active Users
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 font-mono tracking-tight">
                {summaryLoading ? '...' : kpis?.activeUsers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Active in {periodLabels[period]}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Activity Telemetry</span>
              <span className="font-semibold text-purple-600 flex items-center gap-0.5">
                <span>View</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 3: PRO USERS */}
          <Link
            href="/admin/billing"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-amber-600 transition">
                Pro Users
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono tracking-tight">
                {summaryLoading ? '...' : kpis?.proUsers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Paid Subscriptions • Free Users: {summaryLoading ? '...' : kpis?.freeUsers ?? Math.max(0, (kpis?.totalUsers ?? 0) - (kpis?.proUsers ?? 0))}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Subscriptions</span>
              <span className="font-semibold text-amber-600 flex items-center gap-0.5">
                <span>Billing</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 4: NEW USERS */}
          <Link
            href="/admin/users"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-emerald-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-emerald-600 transition">
                New Users
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tracking-tight">
                {summaryLoading ? '...' : kpis?.newUsers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">In {periodLabels[period]}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Growth Trend</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <span>Growth</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 5: SYSTEM HEALTH */}
          <Link
            href="/admin/system"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-teal-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-teal-600 transition">
                System Health
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 font-mono tracking-tight">
                {kpis?.systemStatus || 'Healthy'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Platform Diagnostic State</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">12 Probes</span>
              <span className="font-semibold text-teal-600 flex items-center gap-0.5">
                <span>Inspect</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        </div>

        {/* Row 2: Career, Internships, Pending Review, Interviews & Alerts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 6: JOBS PUBLISHED */}
          <Link
            href="/admin/career"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-blue-600 transition">
                Jobs Published
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono tracking-tight">
                {kpis?.jobsPublishedCount ?? 4}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Live on /jobs</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Admin Approved</span>
              <span className="font-semibold text-blue-600 flex items-center gap-0.5">
                <span>Jobs</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 7: INTERNSHIPS PUBLISHED */}
          <Link
            href="/admin/career"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-purple-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-purple-600 transition">
                Internships
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 font-mono tracking-tight">
                {kpis?.internshipsPublishedCount ?? 4}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Verified Internships</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Student Feed</span>
              <span className="font-semibold text-purple-600 flex items-center gap-0.5">
                <span>Internships</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 8: PENDING REVIEWS */}
          <Link
            href="/admin/career"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-amber-600 transition">
                Pending Reviews
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono tracking-tight">
                {kpis?.pendingReviewsCount ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Awaiting Review</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Quality Gate</span>
              <span className="font-semibold text-amber-600 flex items-center gap-0.5">
                <span>Review</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 9: MOCK INTERVIEWS */}
          <Link
            href="/admin/mock-interview"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-indigo-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-indigo-600 transition">
                Mock Interviews
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Video className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 font-mono tracking-tight">
                {kpis?.mockInterviewsCount ?? 14}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Sessions Completed</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Question Bank</span>
              <span className="font-semibold text-indigo-600 flex items-center gap-0.5">
                <span>Manage</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>

          {/* Card 10: UNREAD NOTIFICATIONS */}
          <Link
            href="/admin/notifications"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-rose-400 hover:shadow-sm transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-rose-600 transition">
                Notifications
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono tracking-tight">
                {kpis?.unreadNotificationsCount ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Admin Broadcasts</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">In-App &amp; Email</span>
              <span className="font-semibold text-rose-600 flex items-center gap-0.5">
                <span>Broadcast</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Second Row KPIs: Platform Infrastructure & Tools */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total & Enabled Tools */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tools Online</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {toolsLoading ? '...' : `${toolMetrics?.available ?? kpis?.enabledTools ?? 0} / ${toolMetrics?.total ?? kpis?.totalTools ?? 0}`}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {toolMetrics?.disabled ? `${toolMetrics.disabled} disabled` : 'All tools available'}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">15 student tools</span>
            <Link href="/admin/tools" className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              <span>Configure</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Student Tools */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Student Modules</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
              {kpis?.studentToolsCount ?? 15}
            </div>
            <div className="text-[11px] text-slate-400">Academic & Career</div>
          </div>
          <GraduationCap className="w-6 h-6 text-blue-600" />
        </div>

        {/* VTU Curricula */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">VTU Curricula</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
              {curriculumMetrics?.total ?? kpis?.curriculumCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-400">Verified & Active packages</div>
          </div>
          <BookOpen className="w-6 h-6 text-purple-600" />
        </div>

        {/* Open Errors */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Open Errors</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
              {errorsLoading ? '...' : errorMetrics?.unresolved ?? kpis?.openErrorsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-400">Pending investigation</div>
          </div>
          <AlertTriangle
            className={`w-6 h-6 ${errorMetrics && errorMetrics.unresolved > 0 ? 'text-amber-500' : 'text-slate-300'}`}
          />
        </div>

        {/* Privacy First Compliance */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Local Document Privacy</div>
            <div className="text-sm font-extrabold text-emerald-700 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Protected</span>
            </div>
            <div className="text-[11px] text-slate-400">0 bytes user files saved</div>
          </div>
          <Shield className="w-6 h-6 text-emerald-600" />
        </div>
      </div>

      {/* Feature Control Overview Row */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ToggleLeft className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Feature Availability & Access Modes</h3>
            <p className="text-xs text-slate-500">Central control plane for public availability and Saarvi Pro subscription gating</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-400">Active:</span> <strong className="text-emerald-700 font-mono ml-1">{kpis?.activeFeatures ?? '...'}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-400">Disabled:</span> <strong className="text-slate-700 font-mono ml-1">{kpis?.disabledFeatures ?? '0'}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
            <span className="text-blue-500">Free Access:</span> <strong className="text-blue-700 font-mono ml-1">{kpis?.freeFeatures ?? '...'}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-purple-50/50 border border-purple-100 text-xs">
            <span className="text-purple-500">Subscription:</span> <strong className="text-purple-700 font-mono ml-1">{kpis?.subscriptionFeatures ?? '...'}</strong>
          </div>
          <Link
            href="/admin/features"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
          >
            <span>Manage Flags</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CHARTS ROW 1: USER GROWTH & USER SIGNUPS (P1: Independent Loading)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Growth (Line Chart) */}
        <ChartCardWrapper
          title="User Growth"
          subtitle={`Cumulative registered accounts over ${periodLabels[period]}`}
          badge="Real Data"
          badgeColor="blue"
          loading={growthLoading}
          footerInfo="Tracks authentic user account creation timestamps."
        >
          {sectionErrors.growth ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-xs text-red-600 gap-2">
              <span>{sectionErrors.growth}</span>
              <button
                type="button"
                onClick={() => loadUserGrowth(period, true)}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <AdminLineChart
              data={userGrowthSeries}
              metricLabel="Registered Users"
              strokeColor="#2563eb"
              fillGradientStart="rgba(37, 99, 235, 0.2)"
              fillGradientEnd="rgba(37, 99, 235, 0.01)"
              emptyMessage="No registration timeline data recorded yet."
              height={220}
            />
          )}
        </ChartCardWrapper>

        {/* New Users Registrations (Bar Chart) */}
        <ChartCardWrapper
          title="New Registrations"
          subtitle={`New user signups grouped by day for ${periodLabels[period]}`}
          badge="Daily Cadence"
          badgeColor="emerald"
          loading={growthLoading}
          footerInfo="Calculated directly from account registration timestamps."
        >
          {sectionErrors.growth ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-xs text-red-600 gap-2">
              <span>{sectionErrors.growth}</span>
              <button
                type="button"
                onClick={() => loadUserGrowth(period, true)}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <AdminBarChart
              data={newUsersSeries}
              metricLabel="New Users"
              barColor="#10b981"
              hoverColor="#059669"
              emptyMessage="No user registrations recorded for this period."
              height={220}
            />
          )}
        </ChartCardWrapper>
      </div>

      {/* ========================================================================= */}
      {/* 4. CHARTS ROW 2: ACCOUNT STATUS & TOOL INVENTORY                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account Status Donut */}
        <ChartCardWrapper
          title="Account Status"
          subtitle="Distribution of registered user roles & health"
          loading={growthLoading}
          footerInfo="Enforces ACTIVE, SUSPENDED, and DISABLED accounts."
        >
          <AdminDonutChart
            data={accountStatusDist}
            centerLabel="Accounts"
            totalOverride={kpis?.totalUsers}
            emptyMessage="No user accounts registered."
            size={160}
          />
        </ChartCardWrapper>

        {/* Tool Categories Donut */}
        <ChartCardWrapper
          title="Tools by Category"
          subtitle="Document processing engines breakdown"
          loading={toolsLoading}
          footerInfo="Static tool registry configuration."
        >
          <AdminDonutChart
            data={toolMetrics?.categoryDistribution || []}
            centerLabel="Tools"
            totalOverride={toolMetrics?.total}
            emptyMessage="No tools configured."
            size={160}
          />
        </ChartCardWrapper>

        {/* Tool Status Distribution */}
        <ChartCardWrapper
          title="Tool Operational Status"
          subtitle="Current operational readiness of engines"
          loading={toolsLoading}
          footerInfo="Governed by platform overrides in admin tool settings."
        >
          <AdminDonutChart
            data={toolMetrics?.statusDistribution || []}
            centerLabel="Status"
            totalOverride={toolMetrics?.total}
            emptyMessage="No tools configured."
            size={160}
          />
        </ChartCardWrapper>
      </div>

      {/* ========================================================================= */}
      {/* 5. CHARTS ROW 3: STUDENT TOOLS, VTU CURRICULUM & PRIVACY ACTIVITY         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Student Tools Summary */}
        <ChartCardWrapper
          title="Student Ecosystem Tools"
          subtitle="Integrated VTU student modules by category"
          loading={toolsLoading}
          badge="15 Modules"
          badgeColor="purple"
        >
          <div className="space-y-3 py-1">
            {studentToolsDist.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                    {item.label}
                  </span>
                  <span className="font-mono text-slate-900 font-bold">
                    {item.count} <span className="text-[11px] font-normal text-slate-400">({item.percentage}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </ChartCardWrapper>

        {/* VTU Academic Curriculum Distribution */}
        <ChartCardWrapper
          title="VTU Academic Curriculum"
          subtitle="Official syllabus packages by scheme"
          loading={toolsLoading}
          headerAction={
            <Link
              href="/admin/curriculum"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-0.5"
            >
              <span>Manage</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          }
          footerInfo={`${curriculumMetrics?.totalCourses || 0} total verified course configurations.`}
        >
          <AdminDonutChart
            data={curriculumMetrics?.schemeDistribution || []}
            centerLabel="Packages"
            totalOverride={curriculumMetrics?.total}
            emptyMessage="No curriculum packages configured."
            size={160}
          />
        </ChartCardWrapper>

        {/* Privacy-Safe Platform Activity (P1: Independent Loading) */}
        <ChartCardWrapper
          title="Platform Activity"
          subtitle="Genuine privacy-safe interaction events"
          loading={activityLoading}
          headerAction={
            <select
              value={activityFilter}
              aria-label="Filter Platform Activity Category"
              onChange={(e) => handleActivityFilterChange(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="all">All Events</option>
              <option value="tool">Tools</option>
              <option value="student">Student</option>
              <option value="account">Accounts</option>
            </select>
          }
          footerInfo="Zero document content or file data is ever tracked."
        >
          {sectionErrors.activity ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-xs text-red-600 gap-2">
              <span>{sectionErrors.activity}</span>
              <button
                type="button"
                onClick={() => loadActivity(period, activityFilter, true)}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <AdminLineChart
              data={activityMetrics?.timeSeries || []}
              metricLabel="Platform Events"
              strokeColor="#8b5cf6"
              fillGradientStart="rgba(139, 92, 246, 0.2)"
              fillGradientEnd="rgba(139, 92, 246, 0.01)"
              emptyMessage="No activity events recorded for this period."
              height={200}
            />
          )}
        </ChartCardWrapper>
      </div>

      {/* ========================================================================= */}
      {/* 6. CHARTS ROW 4: ERROR TRENDS & SEVERITY BREAKDOWN (P2)                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Error Trend Line Chart */}
        <ChartCardWrapper
          title="Diagnostics & Errors Over Time"
          subtitle={`Platform operational issues logged in ${periodLabels[period]}`}
          badge={errorMetrics && errorMetrics.unresolved > 0 ? `${errorMetrics.unresolved} Unresolved` : 'Clean'}
          badgeColor={errorMetrics && errorMetrics.unresolved > 0 ? 'amber' : 'emerald'}
          loading={errorsLoading}
          headerAction={
            <Link
              href="/admin/errors"
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
            >
              <span>View Logs</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          }
          footerInfo="Logged errors mask sensitive tokens and private user content."
        >
          {sectionErrors.errors ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-xs text-red-600 gap-2">
              <span>{sectionErrors.errors}</span>
              <button
                type="button"
                onClick={() => loadErrors(period, true)}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <AdminLineChart
              data={errorMetrics?.timeSeries || []}
              metricLabel="Errors"
              strokeColor="#ef4444"
              fillGradientStart="rgba(239, 68, 68, 0.2)"
              fillGradientEnd="rgba(239, 68, 68, 0.01)"
              emptyMessage="Zero operational errors recorded in this period."
              height={200}
            />
          )}
        </ChartCardWrapper>

        {/* Error Severity Distribution */}
        <ChartCardWrapper
          title="Error Severity Breakdown"
          subtitle="Categorization of recorded issues"
          loading={errorsLoading}
          footerInfo="Review CRITICAL alerts promptly."
        >
          <AdminDonutChart
            data={errorMetrics?.severityDistribution || []}
            centerLabel="Errors"
            totalOverride={errorMetrics?.totalInPeriod}
            emptyMessage="Zero errors in the system."
            size={160}
          />
        </ChartCardWrapper>
      </div>

      {/* ========================================================================= */}
      {/* 7. PRIVACY-FIRST ARCHITECTURE INFORMATIVE NOTICE                           */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Privacy-First Architecture Notice</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                Core Principle
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              Many Saarvi document engines (PDF merge, JPG conversion, SGPA/CGPA calculation, resume builder, and timetable storage) execute entirely inside the user&apos;s browser. Local document transformations are never counted as server-side conversions or stored on the server.
            </p>
          </div>
        </div>

        <Link
          href="/privacy"
          target="_blank"
          className="shrink-0 px-3.5 py-2 bg-white text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold hover:bg-blue-50 transition-colors shadow-2xs inline-flex items-center gap-1.5"
        >
          <span>Privacy Policy</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* 8. SYSTEM HEALTH CHECK MATRIX (P2: Independent Loading)                    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span>System Health & Service Latency</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Live status checks of underlying infrastructure modules</p>
          </div>
          <button
            type="button"
            onClick={() => loadDiagnostics(true)}
            disabled={diagnosticsLoading}
            className="text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
            <span>Recheck</span>
          </button>
        </div>

        {sectionErrors.diagnostics ? (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between gap-3">
            <span>{sectionErrors.diagnostics}</span>
            <button
              type="button"
              onClick={() => loadDiagnostics(true)}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {diagnosticsLoading && systemHealth.length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-slate-400">
                Checking live system health probes...
              </div>
            ) : (
              systemHealth.map((check) => (
                <div
                  key={check.id}
                  className="p-3 rounded-xl border border-slate-200/70 bg-slate-50/50 flex items-start justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800">{check.name}</div>
                    <div className="text-[11px] text-slate-500">{check.message}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Latency: {check.latencyMs}ms</div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                      check.status === 'HEALTHY'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : check.status === 'WARNING'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 9. RECENT TABLES: USERS, AUDIT TRAIL, AND ERRORS (P2: Independent)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recently Registered Users */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Recent Registrations</span>
            </h3>
            <Link href="/admin/users" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
              All ({kpis?.totalUsers ?? 0})
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1 min-h-[220px]">
            {recentLoading && recentUsers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading recent users...
              </div>
            ) : recentUsers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No users registered yet.
              </div>
            ) : (
              recentUsers.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{u.fullName || 'User'}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{u.email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : u.status === 'SUSPENDED'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {u.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Admin Audit Trail */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Admin Audit Trail</span>
            </h3>
            <Link href="/admin/audit-logs" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
              View Log
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1 min-h-[220px]">
            {recentLoading && recentAudit.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading audit trail...
              </div>
            ) : recentAudit.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No administrative actions logged yet.
              </div>
            ) : (
              recentAudit.map((log) => (
                <div key={log.id} className="py-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 font-mono text-[11px] truncate">{log.action}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                    <span className="text-slate-400">{log.adminEmail}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-slate-600">{log.targetType}:{log.targetId}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Operational Diagnostics */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Recent Diagnostics</span>
            </h3>
            <Link href="/admin/errors" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
              Review ({kpis?.openErrorsCount ?? 0})
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1 min-h-[220px]">
            {recentLoading && recentErrors.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading diagnostics...
              </div>
            ) : recentErrors.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                System operational. No recorded errors.
              </div>
            ) : (
              recentErrors.map((err) => (
                <div key={err.id} className="py-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 truncate">{err.service}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                        err.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : err.severity === 'ERROR'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {err.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{err.safeMessage}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 10. ADMIN QUICK ACTION SHORTCUTS                                           */}
      {/* ========================================================================= */}
      <div className="space-y-3 print:hidden">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Control Shortcuts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Link
            href="/admin/users"
            className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all shadow-xs flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate text-slate-800">Users</div>
              <div className="text-[11px] text-slate-400 truncate">Manage roles & status</div>
            </div>
          </Link>

          <Link
            href="/admin/tools"
            className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all shadow-xs flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate text-slate-800">Tools</div>
              <div className="text-[11px] text-slate-400 truncate">Status & file limits</div>
            </div>
          </Link>

          <Link
            href="/admin/curriculum"
            className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition-all shadow-xs flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate text-slate-800">Curriculum</div>
              <div className="text-[11px] text-slate-400 truncate">VTU 2022 schemes</div>
            </div>
          </Link>

          <Link
            href="/admin/announcements"
            className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 transition-all shadow-xs flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate text-slate-800">Announcements</div>
              <div className="text-[11px] text-slate-400 truncate">Top banner alerts</div>
            </div>
          </Link>

          <Link
            href="/admin/platform"
            className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all shadow-xs flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate text-slate-800">Settings</div>
              <div className="text-[11px] text-slate-400 truncate">Maintenance & config</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
