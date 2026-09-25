"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wrench,
  Search,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Edit2,
  Lock,
  FileCheck,
  Shield,
  RefreshCw,
  BarChart3,
  Activity,
  Zap,
  TrendingUp,
  AlertCircle,
  Check,
  ChevronRight,
  Filter,
  Eye,
  Settings,
  X,
  Gauge,
  Flame,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import type {
  ToolTelemetryMetric,
  ToolControlConfig,
  ToolActivityEvent,
  ToolOperationalStatus,
  ToolAccessTier,
  ToolHealthStatus,
} from '@/types/tool-control';

export default function AdminToolsControlCenterPage() {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Subtabs
  const [activeTab, setActiveTab] = useState<'overview' | 'most-used' | 'beta-controls' | 'health' | 'activity'>('overview');

  // Period for analytics
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d' | 'year' | 'all'>('30d');

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');

  // Data states
  const [metrics, setMetrics] = useState<ToolTelemetryMetric[]>([]);
  const [activities, setActivities] = useState<ToolActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit Tool Modal State
  const [editingTool, setEditingTool] = useState<ToolTelemetryMetric | null>(null);
  const [editStatus, setEditStatus] = useState<ToolOperationalStatus>('AVAILABLE');
  const [editAccessMode, setEditAccessMode] = useState<ToolAccessTier>('FREE');
  const [editBetaFreeLimit, setEditBetaFreeLimit] = useState<number>(10);
  const [editMaintenanceMsg, setEditMaintenanceMsg] = useState<string>('');
  const [editMaxP95, setEditMaxP95] = useState<number>(5000);
  const [editMaxErrorRate, setEditMaxErrorRate] = useState<number>(5.0);

  // Disable / Maintenance Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingTool, setPendingTool] = useState<ToolTelemetryMetric | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ToolOperationalStatus>('DISABLED');

  // Load Overview Data
  const loadOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/admin/tools/overview?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.metrics)) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load tool overview metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  // Load Activity Data
  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tools/activity?limit=100');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          setActivities(data.events);
        }
      }
    } catch (err) {
      console.error('Failed to load tool activity:', err);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === 'activity') {
      loadActivity();
    }
  }, [activeTab, loadActivity]);

  // Filtered metrics
  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => {
      const matchesSearch =
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.toolKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = categoryFilter === 'all' || m.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchesAccess = accessFilter === 'all' || m.accessMode === accessFilter;

      return matchesSearch && matchesCat && matchesStatus && matchesAccess;
    });
  }, [metrics, searchQuery, categoryFilter, statusFilter, accessFilter]);

  // Sorted for Most Used Tab
  const mostUsedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => b.totalUses - a.totalUses);
  }, [metrics]);

  // KPI Calculations
  const totalOperations = useMemo(() => metrics.reduce((acc, m) => acc + m.totalUses, 0), [metrics]);
  const successfulOperations = useMemo(() => metrics.reduce((acc, m) => acc + m.successfulOperations, 0), [metrics]);
  const overallSuccessRate = totalOperations > 0 ? Math.round((successfulOperations / totalOperations) * 1000) / 10 : 100.0;
  const betaToolsCount = useMemo(() => metrics.filter((m) => m.status === 'BETA').length, [metrics]);
  const activeToolsCount = useMemo(() => metrics.filter((m) => m.status === 'AVAILABLE' || m.status === 'BETA').length, [metrics]);
  const proToolsCount = useMemo(() => metrics.filter((m) => m.accessMode === 'PRO').length, [metrics]);
  const limitReachedTotal = useMemo(() => metrics.reduce((acc, m) => acc + (m.limitReachedUsers || 0), 0), [metrics]);

  // Modal open
  const openEditModal = (tool: ToolTelemetryMetric) => {
    setEditingTool(tool);
    setEditStatus(tool.status);
    setEditAccessMode(tool.accessMode);
    setEditBetaFreeLimit(tool.betaFreeLimit || 10);
    setEditMaintenanceMsg('');
    setEditMaxP95(tool.p95DurationMs > 0 ? Math.max(tool.p95DurationMs * 2, 5000) : 5000);
    setEditMaxErrorRate(5.0);
  };

  const handleSaveToolConfig = async () => {
    if (!editingTool) return;
    setSavingEdit(true);

    try {
      const res = await fetch('/api/admin/tools/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolKey: editingTool.toolKey,
          status: editStatus,
          accessMode: editAccessMode,
          betaFreeLimit: Number(editBetaFreeLimit),
          maintenanceMessage: editMaintenanceMsg || undefined,
          maxP95DurationMs: Number(editMaxP95),
          maxErrorRatePct: Number(editMaxErrorRate),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to save tool configuration');
      }

      setEditingTool(null);
      await loadOverview(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating tool';
      alert(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleQuickStatusChange = (tool: ToolTelemetryMetric, targetStatus: ToolOperationalStatus) => {
    if (targetStatus === 'DISABLED' || targetStatus === 'MAINTENANCE') {
      setPendingTool(tool);
      setPendingStatus(targetStatus);
      setConfirmModalOpen(true);
    } else {
      applyStatusDirect(tool.toolKey, targetStatus);
    }
  };

  const applyStatusDirect = async (toolKey: string, status: ToolOperationalStatus) => {
    try {
      const res = await fetch('/api/admin/tools/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolKey, status }),
      });
      if (res.ok) {
        await loadOverview(true);
      }
    } catch (err) {
      console.error('Quick status update error:', err);
    }
  };

  // Health Badge Formatter
  const renderHealthBadge = (health: ToolHealthStatus) => {
    switch (health) {
      case 'Healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Healthy
          </span>
        );
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Degraded
          </span>
        );
      case 'High Error Rate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3 text-red-500" /> High Error Rate
          </span>
        );
      case 'Slow':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <Clock className="w-3 h-3 text-orange-500" /> Slow
          </span>
        );
      case 'Disabled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <X className="w-3 h-3 text-slate-400" /> Disabled
          </span>
        );
      case 'No Recent Usage':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
            Idle
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
            <Wrench className="w-4 h-4" />
            <span>Saarvi Platform Tool Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Tool Control Center & Beta Limits
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Manage canonical tool availability, server-authoritative Beta usage limits, real platform telemetry, and operational health.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Period selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs shadow-2xs">
            {(['today', '7d', '30d', '90d', 'year', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  period === p ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7D' : p === '30d' ? '30D' : p === '90d' ? '90D' : p === 'year' ? '1Y' : 'All'}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadOverview(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Tools</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{metrics.length}</span>
          <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">{activeToolsCount} Active</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Beta Tools</span>
          <span className="text-2xl font-black text-indigo-600 mt-1 block">{betaToolsCount}</span>
          <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">Trial Limited</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pro Required</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">{proToolsCount}</span>
          <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">Exclusive Gated</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Operations</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">{totalOperations.toLocaleString()}</span>
          <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">{period} Telemetry</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Success Rate</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{overallSuccessRate}%</span>
          <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">Execution Reliability</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Limit Reached</span>
          <span className="text-2xl font-black text-purple-600 mt-1 block">{limitReachedTotal}</span>
          <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">Beta Upgrade Prompts</span>
        </div>
      </div>

      {/* 3. Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Tool Overview', icon: Sliders, badge: `${metrics.length}` },
          { id: 'most-used', label: 'Most Used Tools', icon: Flame },
          { id: 'beta-controls', label: 'Beta Usage Controls', icon: Sparkles, badge: `${betaToolsCount} Beta` },
          { id: 'health', label: 'Tool Health & SLAs', icon: Activity },
          { id: 'activity', label: 'Live Activity Stream', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                    isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TOOL OVERVIEW TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search canonical tools by name, slug, or category..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="pdf">PDF Tools</option>
                <option value="image">Image Tools</option>
                <option value="student">Student Tools</option>
                <option value="academic">Academic Tools</option>
                <option value="career">Career Tools</option>
                <option value="ai">AI Tools</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="BETA">Beta</option>
                <option value="DISABLED">Disabled</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="COMING_SOON">Coming Soon</option>
              </select>

              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Access</option>
                <option value="FREE">Free</option>
                <option value="PRO">Pro Required</option>
              </select>
            </div>
          </div>

          {/* Overview Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Tool</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Access</th>
                    <th className="py-3 px-3">Beta</th>
                    <th className="py-3 px-3">Free Limit</th>
                    <th className="py-3 px-3 text-center">Total Uses</th>
                    <th className="py-3 px-3 text-center">Unique Users</th>
                    <th className="py-3 px-3 text-center">Success Rate</th>
                    <th className="py-3 px-3 text-right">Avg Duration</th>
                    <th className="py-3 px-3 text-right">P95 Duration</th>
                    <th className="py-3 px-3">Health</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading authoritative tool inventory & telemetry...
                      </td>
                    </tr>
                  ) : filteredMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400">
                        No canonical tools match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMetrics.map((tool) => (
                      <tr key={tool.toolKey} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {tool.displayName}
                          <span className="block text-[10px] font-mono text-slate-400 font-normal">{tool.toolKey}</span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                            {tool.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tool.status === 'AVAILABLE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : tool.status === 'BETA'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : tool.status === 'DISABLED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : tool.status === 'MAINTENANCE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tool.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              tool.accessMode === 'PRO'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {tool.accessMode}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          {tool.betaEnabled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              BETA
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                          {tool.betaEnabled ? `${tool.betaFreeLimit} uses` : 'Unlimited'}
                        </td>

                        <td className="py-3.5 px-3 text-center font-bold text-slate-900">{tool.totalUses}</td>

                        <td className="py-3.5 px-3 text-center font-bold text-blue-600">{tool.uniqueUsers}</td>

                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`font-bold ${
                              tool.successRate >= 98
                                ? 'text-emerald-600'
                                : tool.successRate >= 90
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {tool.successRate}%
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-[11px] text-slate-600">
                          {tool.avgDurationMs > 0 ? `${(tool.avgDurationMs / 1000).toFixed(1)}s` : '—'}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-[11px] text-slate-600">
                          {tool.p95DurationMs > 0 ? `${(tool.p95DurationMs / 1000).toFixed(1)}s` : '—'}
                        </td>

                        <td className="py-3.5 px-3">{renderHealthBadge(tool.health)}</td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openEditModal(tool)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Configure</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MOST USED TOOLS */}
      {/* ========================================================================= */}
      {activeTab === 'most-used' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Most Used Tools Leaderboard</h3>
              <p className="text-xs text-slate-500">Ranked by total operations executed in selected period ({period}).</p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
              Database Aggregated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {mostUsedMetrics.slice(0, 12).map((tool, idx) => (
              <div
                key={tool.toolKey}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center font-mono">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{tool.displayName}</h4>
                      <span className="text-[10px] font-mono text-slate-400">{tool.category}</span>
                    </div>
                  </div>
                  {renderHealthBadge(tool.health)}
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Uses</span>
                    <span className="text-sm font-black text-slate-900">{tool.totalUses}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Users</span>
                    <span className="text-sm font-black text-blue-600">{tool.uniqueUsers}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Success</span>
                    <span className="text-sm font-black text-emerald-600">{tool.successRate}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                  <span>P50: {tool.p50DurationMs > 0 ? `${(tool.p50DurationMs / 1000).toFixed(1)}s` : '—'}</span>
                  <span>P95: {tool.p95DurationMs > 0 ? `${(tool.p95DurationMs / 1000).toFixed(1)}s` : '—'}</span>
                  <button
                    onClick={() => openEditModal(tool)}
                    className="text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    Edit <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BETA USAGE CONTROLS */}
      {/* ========================================================================= */}
      {activeTab === 'beta-controls' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 border border-indigo-200/90 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-950">Beta Free Usage Policy</h3>
                <p className="text-xs text-indigo-700">
                  Beta is a controlled free-use trial. When users reach their configured limit, the system smoothly prompts them to upgrade to Pro.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-white text-indigo-800 px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs whitespace-nowrap">
              Server-Authoritative Enforcement
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {metrics
              .filter((m) => m.status === 'BETA' || m.betaEnabled)
              .map((tool) => (
                <div key={tool.toolKey} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{tool.displayName}</h4>
                      <span className="text-[10px] font-mono text-slate-400">{tool.toolKey}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      BETA TRIAL
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Free Use Limit:</span>
                      <span className="font-bold text-slate-900 font-mono">{tool.betaFreeLimit} operations</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Action After Limit:</span>
                      <span className="font-bold text-amber-600">Require Pro</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Users Reached Limit:</span>
                      <span className="font-bold text-purple-600 font-mono">{tool.limitReachedUsers || 0} users</span>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(tool)}
                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Adjust Free Limit</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TOOL HEALTH & PERFORMANCE */}
      {/* ========================================================================= */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Deterministic Tool Health Monitor</h3>
              <p className="text-xs text-slate-500">
                Calculated deterministically from actual platform telemetry. Flags high error rates or slow P95 response times.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-700">Telemetry Active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {metrics.map((tool) => (
              <div key={tool.toolKey} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{tool.displayName}</h4>
                    <span className="text-[10px] font-mono text-slate-400">{tool.toolKey}</span>
                  </div>
                  {renderHealthBadge(tool.health)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Error Rate</span>
                    <span className={`text-sm font-black ${tool.successRate < 95 ? 'text-red-600' : 'text-slate-800'}`}>
                      {(100 - tool.successRate).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">P95 Latency</span>
                    <span className={`text-sm font-black ${tool.p95DurationMs > 5000 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {tool.p95DurationMs > 0 ? `${(tool.p95DurationMs / 1000).toFixed(1)}s` : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>Last: {tool.lastUsedAt ? new Date(tool.lastUsedAt).toLocaleDateString() : 'Never'}</span>
                  <span>Mode: {tool.workerMode}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: TOOL ACTIVITY STREAM */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs space-y-0">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Live Tool Operations Activity</h3>
              <p className="text-xs text-slate-500">Strictly safe operational metadata. Never exposes private document contents.</p>
            </div>
            <button
              onClick={loadActivity}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Stream
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Tool</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No operational activities recorded yet.
                    </td>
                  </tr>
                ) : (
                  activities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{act.userEmail || act.userId || 'Guest'}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{act.toolName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{act.action}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            act.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {act.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px]">
                        {act.durationMs && act.durationMs > 0 ? `${(act.durationMs / 1000).toFixed(2)}s` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT TOOL CONFIGURATION MODAL / DRAWER */}
      {/* ========================================================================= */}
      {editingTool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{editingTool.displayName}</h3>
                  <span className="text-[11px] font-mono text-slate-400">{editingTool.toolKey}</span>
                </div>
              </div>
              <button
                onClick={() => setEditingTool(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                  Operational Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ToolOperationalStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="AVAILABLE">AVAILABLE (Normal Operation)</option>
                  <option value="BETA">BETA (Controlled Free-Use Trial)</option>
                  <option value="DISABLED">DISABLED (Completely Unavailable)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Maintenance Notice)</option>
                  <option value="COMING_SOON">COMING_SOON (Roadmap Notice)</option>
                </select>
              </div>

              {/* Access Mode */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                  Access Mode
                </label>
                <select
                  value={editAccessMode}
                  onChange={(e) => setEditAccessMode(e.target.value as ToolAccessTier)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="FREE">FREE (All Users & Guests)</option>
                  <option value="PRO">PRO (Requires Active Pro Entitlement)</option>
                </select>
              </div>

              {/* Beta Free Uses Limit */}
              {editStatus === 'BETA' && (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
                  <label className="block font-bold text-indigo-950 uppercase tracking-wider text-[10px]">
                    Beta Free Uses Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={editBetaFreeLimit}
                    onChange={(e) => setEditBetaFreeLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-900 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-[11px] text-indigo-700">
                    Users can use this tool up to this limit for free. After limit reached, &quot;Require Pro&quot; prompt is presented.
                  </p>
                </div>
              )}

              {/* Maintenance message */}
              {(editStatus === 'DISABLED' || editStatus === 'MAINTENANCE') && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                    Notice Message (Shown to users)
                  </label>
                  <input
                    type="text"
                    value={editMaintenanceMsg}
                    onChange={(e) => setEditMaintenanceMsg(e.target.value)}
                    placeholder="This tool is undergoing routine upgrades. Please check back shortly."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              {/* Performance Thresholds */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1">
                    Max P95 Latency (ms)
                  </label>
                  <input
                    type="number"
                    value={editMaxP95}
                    onChange={(e) => setEditMaxP95(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1">
                    Max Error Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editMaxErrorRate}
                    onChange={(e) => setEditMaxErrorRate(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTool(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveToolConfig}
                disabled={savingEdit}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModalOpen}
        title={`Set ${pendingTool?.displayName} to ${pendingStatus}?`}
        message={`This will immediately update user access for this tool. Users will be shown the ${pendingStatus} platform state.`}
        confirmText={`Yes, Set to ${pendingStatus}`}
        variant={pendingStatus === 'DISABLED' ? 'danger' : 'warning'}
        onConfirm={async () => {
          if (pendingTool) {
            await applyStatusDirect(pendingTool.toolKey, pendingStatus);
          }
          setConfirmModalOpen(false);
          setPendingTool(null);
        }}
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingTool(null);
        }}
      />
    </div>
  );
}
