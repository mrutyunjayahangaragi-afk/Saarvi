"use client";

import React, { useEffect, useState, useCallback } from 'react';
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
  Calendar,
  Download,
  Printer,
  Info,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Server,
  Layers,
  ChevronRight,
  AlertOctagon,
  FileCheck,
  ToggleLeft,
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
  const [initialLoading, setInitialLoading] = useState(true);

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

  // Section error states for partial isolation
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({});

  // Activity filter state
  const [activityFilter, setActivityFilter] = useState<'all' | 'tool' | 'student' | 'account' | 'system'>('all');

  const loadDashboardData = useCallback(
    async (selectedPeriod: DateRangePeriod) => {
      setIsRefreshing(true);
      try {
        let apiOverview: any = null;
        try {
          const res = await fetch(`/api/admin/analytics/overview?period=${selectedPeriod}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              apiOverview = json;
            }
          }
        } catch {
          // fallback to client-side service
        }

        const data = await adminAnalyticsService.getDashboardOverview(selectedPeriod);

        if (apiOverview?.userMetrics) {
          data.kpis.totalUsers = apiOverview.userMetrics.totalUsers;
          data.kpis.newUsers = apiOverview.userMetrics.newUsers;
          data.kpis.previousPeriodNewUsers = apiOverview.userMetrics.previousNewUsers;
          data.kpis.newUsersChangePct = apiOverview.userMetrics.trend?.percentage ?? 0;
          data.kpis.newUsersDiff = apiOverview.userMetrics.trend?.diff ?? 0;
          data.kpis.activeUsers = apiOverview.userMetrics.activeUsers;
          data.kpis.freeUsers = apiOverview.userMetrics.freeUsers;
          data.kpis.proUsers = apiOverview.userMetrics.proUsers;
          data.kpis.suspendedUsers = apiOverview.userMetrics.suspendedUsers;

          const totalU = apiOverview.userMetrics.totalUsers || 1;
          data.accountStatusDist = [
            {
              label: 'Active',
              count: apiOverview.userMetrics.activeUsers,
              color: '#10b981',
              percentage: Math.round((apiOverview.userMetrics.activeUsers / totalU) * 100),
            },
            {
              label: 'Suspended',
              count: apiOverview.userMetrics.suspendedUsers,
              color: '#f59e0b',
              percentage: Math.round((apiOverview.userMetrics.suspendedUsers / totalU) * 100),
            },
          ];
        }

        if (apiOverview?.metrics?.userGrowthTrend && Array.isArray(apiOverview.metrics.userGrowthTrend) && apiOverview.metrics.userGrowthTrend.length > 0) {
          data.userGrowthSeries = apiOverview.metrics.userGrowthTrend.map((p: any) => ({
            date: p.date,
            label: p.label,
            value: p.count,
          }));
        }

        try {
          const usersRes = await fetch('/api/admin/users?limit=6');
          if (usersRes.ok) {
            const usersJson = await usersRes.json();
            if (usersJson.success && Array.isArray(usersJson.users)) {
              data.recentUsers = usersJson.users;
            }
          }
        } catch {
          // fallback
        }

        try {
          const diagRes = await fetch('/api/admin/diagnostics');
          if (diagRes.ok) {
            const diagJson = await diagRes.json();
            if (diagJson.success && Array.isArray(diagJson.probes)) {
              data.systemHealth = diagJson.probes;
            }
          }
        } catch {
          // keep service health fallback
        }

        setKpis(data.kpis);
        setUserGrowthSeries(data.userGrowthSeries);
        setNewUsersSeries(data.newUsersSeries);
        setAccountStatusDist(data.accountStatusDist);
        setToolMetrics(data.toolMetrics);
        setStudentToolsDist(data.studentToolsDist);
        setCurriculumMetrics(data.curriculumMetrics);
        setActivityMetrics(data.activityMetrics);
        setErrorMetrics(data.errorMetrics);
        setSystemHealth(data.systemHealth);
        setRecentUsers(data.recentUsers);
        setRecentAudit(data.recentAudit);
        setRecentErrors(data.recentErrors);

        // Reset any section errors
        setSectionErrors({});
      } catch (err: unknown) {
        console.error('Failed to load dashboard overview data:', err);
        setSectionErrors((prev) => ({
          ...prev,
          global: err instanceof Error ? err.message : 'Failed to synchronize analytics metrics.',
        }));
      } finally {
        setIsRefreshing(false);
        setInitialLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDashboardData(period);
  }, [period, loadDashboardData]);

  // Load activity metrics when category filter changes
  useEffect(() => {
    async function loadFilteredActivity() {
      try {
        const res = await adminAnalyticsService.getPlatformActivityMetrics(period, activityFilter);
        setActivityMetrics(res);
      } catch (e) {
        console.error('Failed to filter activity metrics:', e);
      }
    }
    if (!initialLoading) {
      loadFilteredActivity();
    }
  }, [activityFilter, period, initialLoading]);

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
      {/* 1. TOP HEADER & OPERATIONAL CONTROLS                                       */}
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
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadDashboardData(period)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-60"
            title="Reload real platform metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Export & Print */}
          <button
            type="button"
            onClick={handleExportSummary}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
            title="Export aggregate platform summary JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
            title="Print dashboard report"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Last Updated & Real Data Badge Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 bg-slate-50/80 rounded-xl px-3.5 py-2 border border-slate-200/60">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Last updated: <strong className="text-slate-700 font-mono">{kpis?.lastUpdated || 'Loading...'}</strong>
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
              {kpis?.systemStatus || 'Checking...'}
            </span>
          </div>
        </div>
      </div>

      {/* Global Error Banner if any */}
      {sectionErrors.global && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between gap-3">
          <span>{sectionErrors.global}</span>
          <button
            type="button"
            onClick={() => loadDashboardData(period)}
            className="underline font-bold hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. REUSABLE KPI CARDS (Real Values Only)                                   */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2. REAL USER COUNT DASHBOARD (The 5 Core Real Metrics)                      */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Platform User Overview</span>
          </h2>
          {kpis?.suspendedUsers && kpis.suspendedUsers > 0 ? (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              {kpis.suspendedUsers} Suspended Accounts
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: TOTAL USERS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Users</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                {initialLoading ? '...' : kpis?.totalUsers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Registered accounts</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">All registered</span>
              <Link href="/admin/users" className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                <span>Directory</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Card 2: ACTIVE USERS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Users</span>
                <span
                  className="cursor-help text-slate-400 hover:text-slate-600"
                  title={kpis?.activeUsersLabel || 'Based on recorded sign-in timestamps and real events'}
                >
                  <Info className="w-3 h-3" />
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 font-mono tracking-tight">
                {initialLoading ? '...' : kpis?.activeUsers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Active in {periodLabels[period]}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 truncate">
              Real sign-in & tool telemetry
            </div>
          </div>

          {/* Card 3: FREE USERS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Free Users</span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 font-mono tracking-tight">
                {initialLoading ? '...' : kpis?.freeUsers ?? Math.max(0, (kpis?.totalUsers ?? 0) - (kpis?.proUsers ?? 0))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Free plan accounts</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
              {kpis?.totalUsers ? Math.round(((kpis.freeUsers ?? (kpis.totalUsers - (kpis.proUsers ?? 0))) / kpis.totalUsers) * 100) : 100}% of total
            </div>
          </div>

          {/* Card 4: PRO USERS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pro Users</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono tracking-tight">
                {initialLoading ? '...' : kpis?.proUsers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Active Pro subscriptions</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
              {kpis?.proUsers ? `${kpis.proUsers} paid active` : '0 active paid'}
            </div>
          </div>

          {/* Card 5: NEW USERS (With Trend) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">New Users</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tracking-tight">
                  {initialLoading ? '...' : kpis?.newUsers ?? 0}
                </span>
                {!initialLoading && kpis && kpis.newUsersChangePct !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                      kpis.newUsersDiff > 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : kpis.newUsersDiff < 0
                        ? 'bg-red-50 text-red-700 border border-red-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    title={`${kpis.newUsersDiff >= 0 ? '+' : ''}${kpis.newUsersDiff} vs prior ${periodLabels[period]}`}
                  >
                    {kpis.newUsersDiff > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                    ) : kpis.newUsersDiff < 0 ? (
                      <TrendingDown className="w-3 h-3 text-red-600" />
                    ) : null}
                    <span>
                      {kpis.newUsersDiff > 0 ? '+' : ''}
                      {kpis.newUsersChangePct}%
                    </span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">In {periodLabels[period]}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
              Prior: <strong className="text-slate-600 font-mono">{kpis?.previousPeriodNewUsers ?? 0}</strong>
            </div>
          </div>
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
              {initialLoading ? '...' : `${kpis?.enabledTools ?? 0} / ${kpis?.totalTools ?? 0}`}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {kpis?.disabledTools ? `${kpis.disabledTools} disabled` : 'All tools available'}
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
              {kpis?.verifiedCurriculumCount ?? 0}
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
              {kpis?.openErrorsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-400">Pending investigation</div>
          </div>
          <AlertTriangle
            className={`w-6 h-6 ${kpis && kpis.openErrorsCount > 0 ? 'text-amber-500' : 'text-slate-300'}`}
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
      {/* 3. CHARTS ROW 1: USER GROWTH & USER SIGNUPS                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Growth (Line Chart) */}
        <ChartCardWrapper
          title="User Growth"
          subtitle={`Cumulative registered accounts over ${periodLabels[period]}`}
          badge="Real Data"
          badgeColor="blue"
          loading={initialLoading}
          footerInfo="Tracks authentic user account creation timestamps."
        >
          <AdminLineChart
            data={userGrowthSeries}
            metricLabel="Registered Users"
            strokeColor="#2563eb"
            fillGradientStart="rgba(37, 99, 235, 0.2)"
            fillGradientEnd="rgba(37, 99, 235, 0.01)"
            emptyMessage="No registration timeline data recorded yet."
            height={220}
          />
        </ChartCardWrapper>

        {/* New Users Registrations (Bar Chart) */}
        <ChartCardWrapper
          title="New Registrations"
          subtitle={`New user signups grouped by day for ${periodLabels[period]}`}
          badge="Daily Cadence"
          badgeColor="emerald"
          loading={initialLoading}
          footerInfo="Calculated directly from account registration timestamps."
        >
          <AdminBarChart
            data={newUsersSeries}
            metricLabel="New Users"
            barColor="#10b981"
            hoverColor="#059669"
            emptyMessage="No user registrations recorded for this period."
            height={220}
          />
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
          loading={initialLoading}
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
          loading={initialLoading}
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
          loading={initialLoading}
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
          loading={initialLoading}
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
          loading={initialLoading}
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

        {/* Privacy-Safe Platform Activity */}
        <ChartCardWrapper
          title="Platform Activity"
          subtitle="Genuine privacy-safe interaction events"
          loading={initialLoading}
          headerAction={
            <select
              value={activityFilter}
              aria-label="Filter Platform Activity Category"
              onChange={(e) => setActivityFilter(e.target.value as any)}
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
          <AdminLineChart
            data={activityMetrics?.timeSeries || []}
            metricLabel="Platform Events"
            strokeColor="#8b5cf6"
            fillGradientStart="rgba(139, 92, 246, 0.2)"
            fillGradientEnd="rgba(139, 92, 246, 0.01)"
            emptyMessage="No activity events recorded for this period."
            height={200}
          />
        </ChartCardWrapper>
      </div>

      {/* ========================================================================= */}
      {/* 6. CHARTS ROW 4: ERROR TRENDS & SEVERITY BREAKDOWN                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Error Trend Line Chart */}
        <ChartCardWrapper
          title="Diagnostics & Errors Over Time"
          subtitle={`Platform operational issues logged in ${periodLabels[period]}`}
          badge={errorMetrics && errorMetrics.unresolved > 0 ? `${errorMetrics.unresolved} Unresolved` : 'Clean'}
          badgeColor={errorMetrics && errorMetrics.unresolved > 0 ? 'amber' : 'emerald'}
          loading={initialLoading}
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
          <AdminLineChart
            data={errorMetrics?.timeSeries || []}
            metricLabel="Errors"
            strokeColor="#ef4444"
            fillGradientStart="rgba(239, 68, 68, 0.2)"
            fillGradientEnd="rgba(239, 68, 68, 0.01)"
            emptyMessage="Zero operational errors recorded in this period."
            height={200}
          />
        </ChartCardWrapper>

        {/* Error Severity Distribution */}
        <ChartCardWrapper
          title="Error Severity Breakdown"
          subtitle="Categorization of recorded issues"
          loading={initialLoading}
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
      {/* 7. PRIVACY-FIRST ARCHITECTURE INFORMATIVE NOTICE (Section 24 & 25)         */}
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
      {/* 8. SYSTEM HEALTH CHECK MATRIX (Section 31 & 32)                            */}
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
            onClick={() => loadDashboardData(period)}
            className="text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Recheck</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {systemHealth.map((check) => (
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
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 9. RECENT TABLES: USERS, AUDIT TRAIL, AND ERRORS                           */}
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
            {recentUsers.length === 0 ? (
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
            {recentAudit.length === 0 ? (
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
            {recentErrors.length === 0 ? (
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
      {/* 10. ADMIN QUICK ACTION SHORTCUTS (Section 67)                             */}
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
