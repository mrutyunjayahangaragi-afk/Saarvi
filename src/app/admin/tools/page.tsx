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
  Lock,
  Unlock,
  Shield,
  RefreshCw,
  BarChart3,
  Activity,
  Flame,
  Check,
  ChevronRight,
  Filter,
  Eye,
  Settings,
  X,
  History,
  RotateCcw,
  Gift,
  ShieldAlert,
  ArrowRight,
  Info,
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
  ToolAccessAuditLog,
  ToolChangeImpactSummary,
} from '@/types/tool-control';

export default function AdminToolsControlCenterPage() {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Subtabs
  const [activeTab, setActiveTab] = useState<'overview' | 'access-matrix' | 'most-used' | 'beta-controls' | 'health' | 'activity'>('overview');

  // Period for analytics
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d' | 'year' | 'all'>('30d');

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'enabled' | 'disabled' | 'guest' | 'account' | 'pro' | 'beta'>('all');

  // Data states
  const [metrics, setMetrics] = useState<ToolTelemetryMetric[]>([]);
  const [activities, setActivities] = useState<ToolActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [matrixSavingKey, setMatrixSavingKey] = useState<string | null>(null);
  const [matrixSuccessKey, setMatrixSuccessKey] = useState<string | null>(null);

  // Edit Tool Drawer State
  const [editingTool, setEditingTool] = useState<ToolTelemetryMetric | null>(null);
  const [editStatus, setEditStatus] = useState<ToolOperationalStatus>('AVAILABLE');
  const [editAccessMode, setEditAccessMode] = useState<ToolAccessTier>('FREE');
  const [editGuestAllowed, setEditGuestAllowed] = useState<boolean>(true);
  const [editFreeAllowed, setEditFreeAllowed] = useState<boolean>(true);
  const [editProAllowed, setEditProAllowed] = useState<boolean>(true);
  const [editFeatured, setEditFeatured] = useState<boolean>(false);
  const [editNavVisible, setEditNavVisible] = useState<boolean>(true);
  const [editSearchVisible, setEditSearchVisible] = useState<boolean>(true);
  const [editBetaFreeLimit, setEditBetaFreeLimit] = useState<number>(10);
  const [editMaintenanceMsg, setEditMaintenanceMsg] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [concurrencyConflictError, setConcurrencyConflictError] = useState<string | null>(null);

  // Audit History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTool, setHistoryTool] = useState<ToolTelemetryMetric | null>(null);
  const [auditLogs, setAuditLogs] = useState<ToolAccessAuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);

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

  // Quick Status counts
  const statusCounts = useMemo(() => {
    return {
      total: metrics.length,
      enabled: metrics.filter((m) => m.status !== 'DISABLED').length,
      disabled: metrics.filter((m) => m.status === 'DISABLED').length,
      guest: metrics.filter((m) => m.guestAllowed ?? (m.accessMode === 'FREE')).length,
      account: metrics.filter((m) => !(m.guestAllowed ?? (m.accessMode === 'FREE'))).length,
      pro: metrics.filter((m) => m.accessMode === 'PRO' || m.proAllowed === true).length,
      beta: metrics.filter((m) => m.status === 'BETA' || m.betaEnabled === true).length,
    };
  }, [metrics]);

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

      // Quick filter
      let matchesQuick = true;
      if (quickFilter === 'enabled') matchesQuick = m.status !== 'DISABLED';
      else if (quickFilter === 'disabled') matchesQuick = m.status === 'DISABLED';
      else if (quickFilter === 'guest') matchesQuick = Boolean(m.guestAllowed ?? (m.accessMode === 'FREE'));
      else if (quickFilter === 'account') matchesQuick = !Boolean(m.guestAllowed ?? (m.accessMode === 'FREE'));
      else if (quickFilter === 'pro') matchesQuick = m.accessMode === 'PRO';
      else if (quickFilter === 'beta') matchesQuick = m.status === 'BETA' || m.betaEnabled === true;

      return matchesSearch && matchesCat && matchesStatus && matchesAccess && matchesQuick;
    });
  }, [metrics, searchQuery, categoryFilter, statusFilter, accessFilter, quickFilter]);

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

  // Open Edit Drawer
  const openEditDrawer = (tool: ToolTelemetryMetric) => {
    setEditingTool(tool);
    setEditStatus(tool.status);
    setEditAccessMode(tool.accessMode);
    setEditGuestAllowed(tool.guestAllowed ?? (tool.accessMode === 'FREE'));
    setEditFreeAllowed(tool.freeAllowed ?? true);
    setEditProAllowed(tool.proAllowed ?? true);
    setEditFeatured(tool.featured ?? false);
    setEditNavVisible(tool.navVisible ?? (tool.status !== 'DISABLED'));
    setEditSearchVisible(tool.searchVisible ?? true);
    setEditBetaFreeLimit(tool.betaFreeLimit || 10);
    setEditMaintenanceMsg('');
    setEditReason('');
    setConcurrencyConflictError(null);
  };

  // Check if draft has unsaved changes
  const isDraftDirty = useMemo(() => {
    if (!editingTool) return false;
    const initialGuest = editingTool.guestAllowed ?? (editingTool.accessMode === 'FREE');
    const initialFree = editingTool.freeAllowed ?? true;
    const initialPro = editingTool.proAllowed ?? true;
    const initialFeatured = editingTool.featured ?? false;
    const initialNav = editingTool.navVisible ?? (editingTool.status !== 'DISABLED');
    const initialSearch = editingTool.searchVisible ?? true;

    return (
      editStatus !== editingTool.status ||
      editAccessMode !== editingTool.accessMode ||
      editGuestAllowed !== initialGuest ||
      editFreeAllowed !== initialFree ||
      editProAllowed !== initialPro ||
      editFeatured !== initialFeatured ||
      editNavVisible !== initialNav ||
      editSearchVisible !== initialSearch ||
      editBetaFreeLimit !== (editingTool.betaFreeLimit || 10) ||
      Boolean(editMaintenanceMsg)
    );
  }, [
    editingTool,
    editStatus,
    editAccessMode,
    editGuestAllowed,
    editFreeAllowed,
    editProAllowed,
    editFeatured,
    editNavVisible,
    editSearchVisible,
    editBetaFreeLimit,
    editMaintenanceMsg,
  ]);

  // Dynamic conflict warnings for draft
  const draftConflicts = useMemo(() => {
    const warnings: string[] = [];
    if (editStatus === 'DISABLED' && editGuestAllowed) {
      warnings.push('Conflict: Tool is DISABLED but Guest Allowed is ON. Guests will still be blocked.');
    }
    if (editStatus === 'DISABLED' && editFreeAllowed) {
      warnings.push('Conflict: Tool is DISABLED but Free User Allowed is ON. Free users will still be blocked.');
    }
    if (editStatus === 'DISABLED' && (editNavVisible || editSearchVisible)) {
      warnings.push('Warning: Tool is DISABLED but remaining visible in Navigation or Search.');
    }
    if (editAccessMode === 'PRO' && editGuestAllowed) {
      warnings.push('Conflict: Pro Tier is required, but Guest Allowed is ON. Unauthenticated visitors cannot access Pro tools.');
    }
    if (editAccessMode === 'PRO' && editFreeAllowed) {
      warnings.push('Conflict: Pro Tier is required, but Free Users Allowed is ON. Free users will be prompted to upgrade.');
    }
    if (editStatus === 'BETA' && editBetaFreeLimit <= 0) {
      warnings.push('Warning: Beta trial limit is 0 uses. Free users will be blocked immediately.');
    }
    return warnings;
  }, [editStatus, editAccessMode, editGuestAllowed, editFreeAllowed, editNavVisible, editSearchVisible, editBetaFreeLimit]);

  // Save Tool Config with Concurrency Versioning
  const handleSaveToolConfig = async () => {
    if (!editingTool) return;
    setSavingEdit(true);
    setConcurrencyConflictError(null);

    try {
      const res = await fetch('/api/admin/tools/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolKey: editingTool.toolKey,
          version: editingTool.version,
          reason: editReason || 'Admin configuration updated from Control Center 3.0',
          status: editStatus,
          accessMode: editAccessMode,
          guestAllowed: editGuestAllowed,
          freeAllowed: editFreeAllowed,
          proAllowed: editProAllowed,
          featured: editFeatured,
          navVisible: editNavVisible,
          searchVisible: editSearchVisible,
          betaFreeLimit: Number(editBetaFreeLimit),
          maintenanceMessage: editMaintenanceMsg || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 || data.code === 'CONCURRENCY_CONFLICT') {
          setConcurrencyConflictError(data.error || 'Conflict: This tool was updated by another administrator. Please refresh.');
          return;
        }
        throw new Error(data.error || 'Failed to save tool configuration');
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

  // Open History Modal
  const openHistoryModal = async (tool: ToolTelemetryMetric) => {
    setHistoryTool(tool);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/tools/configure?toolKey=${tool.toolKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setAuditLogs(data.history);
        }
      }
    } catch (err) {
      console.error('Failed to load audit history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Rollback tool version
  const handleRollback = async (targetVersion: number) => {
    if (!historyTool) return;
    if (!confirm(`Are you sure you want to rollback ${historyTool.displayName} to Version ${targetVersion}?`)) return;

    setRollingBackVersion(targetVersion);
    try {
      const res = await fetch('/api/admin/tools/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          toolKey: historyTool.toolKey,
          targetVersion,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to rollback version');
      }

      await loadOverview(true);
      // reload audit history
      const historyRes = await fetch(`/api/admin/tools/configure?toolKey=${historyTool.toolKey}`);
      if (historyRes.ok) {
        const hData = await historyRes.json();
        if (hData.success) setAuditLogs(hData.history);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error rolling back configuration';
      alert(msg);
    } finally {
      setRollingBackVersion(null);
    }
  };

  // Apply matrix row update directly
  const updateMatrixRow = async (
    toolKey: string,
    updates: Record<string, unknown>
  ) => {
    setMatrixSavingKey(toolKey);
    try {
      const tool = metrics.find((m) => m.toolKey === toolKey);
      const res = await fetch('/api/admin/tools/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolKey,
          version: tool?.version,
          reason: 'Quick toggle from Access Matrix',
          ...updates,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to update tool matrix');
      }
      setMatrixSuccessKey(toolKey);
      setTimeout(() => setMatrixSuccessKey(null), 2000);
      await loadOverview(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating tool matrix';
      alert(msg);
    } finally {
      setMatrixSavingKey(null);
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
      const tool = metrics.find((m) => m.toolKey === toolKey);
      const res = await fetch('/api/admin/tools/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolKey,
          status,
          version: tool?.version,
          reason: `Quick status update to ${status}`,
        }),
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
            Tool Control Center 3.0
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Real-time server-authoritative tool access rules, multi-admin optimistic concurrency protection, live user experience preview, and version rollback.
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

      {/* 2. Top Quick Status Filter Bar (7 clickable cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button
          type="button"
          onClick={() => setQuickFilter('all')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
            quickFilter === 'all'
              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Tools</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">{statusCounts.total}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">Entire Inventory</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('enabled')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
            quickFilter === 'enabled'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Enabled</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <span className="text-xl font-black text-emerald-700 mt-1 block">{statusCounts.enabled}</span>
          <span className="text-[10px] text-emerald-600/80 font-semibold mt-0.5 block">Online & Usable</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('disabled')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
            quickFilter === 'disabled'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Disabled</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <span className="text-xl font-black text-rose-700 mt-1 block">{statusCounts.disabled}</span>
          <span className="text-[10px] text-rose-600/80 font-semibold mt-0.5 block">Blocked Access</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('guest')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
            quickFilter === 'guest'
              ? 'bg-teal-50/80 border-teal-400 ring-2 ring-teal-500/20'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">Guest Allowed</span>
            <Unlock className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <span className="text-xl font-black text-teal-800 mt-1 block">{statusCounts.guest}</span>
          <span className="text-[10px] text-teal-600 font-semibold mt-0.5 block">No Login Required</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('account')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
            quickFilter === 'account'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Account Req.</span>
            <Lock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-xl font-black text-amber-800 mt-1 block">{statusCounts.account}</span>
          <span className="text-[10px] text-amber-600 font-semibold mt-0.5 block">Login Mandatory</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('pro')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
            quickFilter === 'pro'
              ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-500/20'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Pro Tier</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <span className="text-xl font-black text-purple-800 mt-1 block">{statusCounts.pro}</span>
          <span className="text-[10px] text-purple-600 font-semibold mt-0.5 block">Paid Membership</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('beta')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
            quickFilter === 'beta'
              ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">Beta Trials</span>
            <Flame className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-xl font-black text-indigo-800 mt-1 block">{statusCounts.beta}</span>
          <span className="text-[10px] text-indigo-600 font-semibold mt-0.5 block">Quota Guarded</span>
        </button>
      </div>

      {/* 3. Navigation Subtabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/80 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Telemetry & Inventory</span>
        </button>

        <button
          onClick={() => setActiveTab('access-matrix')}
          className={`pb-3 px-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'access-matrix'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Authoritative Access Matrix</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
            Real-Time
          </span>
        </button>

        <button
          onClick={() => setActiveTab('most-used')}
          className={`pb-3 px-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'most-used'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Usage Volume</span>
        </button>

        <button
          onClick={() => setActiveTab('beta-controls')}
          className={`pb-3 px-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'beta-controls'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Beta Trials & Quotas</span>
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`pb-3 px-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'health'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Operational Health</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-3 px-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'activity'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Activity Audit Stream</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW INVENTORY */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tools by key, name, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="pdf">PDF Tools</option>
                <option value="excel">Excel Tools</option>
                <option value="academic">Academic Tools</option>
                <option value="resume">Career Tools</option>
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

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Tool</th>
                    <th className="py-3 px-3">Access Rule</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Tier</th>
                    <th className="py-3 px-3">Beta Quota</th>
                    <th className="py-3 px-3 text-center">Total Uses</th>
                    <th className="py-3 px-3 text-center">Auth Uses</th>
                    <th className="py-3 px-3 text-center">Guest Uses</th>
                    <th className="py-3 px-3 text-center">Success Rate</th>
                    <th className="py-3 px-3">Health</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading authoritative tool inventory & telemetry...
                      </td>
                    </tr>
                  ) : filteredMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No canonical tools match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMetrics.map((tool) => {
                      const isGuest = tool.guestAllowed ?? (tool.accessMode === 'FREE');
                      return (
                        <tr key={tool.toolKey} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {tool.displayName}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-400 font-normal">{tool.toolKey}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600">
                                {tool.category}
                              </span>
                              {tool.version && (
                                <span className="font-mono text-[9px] text-blue-600 font-semibold">v{tool.version}</span>
                              )}
                            </div>
                          </td>

                          {/* Access Rule High-Contrast Badge */}
                          <td className="py-3.5 px-3">
                            {isGuest ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" /> Guest Allowed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Lock className="w-3 h-3 text-amber-600" /> Account Required
                              </span>
                            )}
                          </td>

                          {/* Operational Status */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                tool.status === 'AVAILABLE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : tool.status === 'BETA'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : tool.status === 'DISABLED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : tool.status === 'MAINTENANCE'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {tool.status === 'AVAILABLE' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {tool.status === 'BETA' && <Flame className="w-3 h-3 text-indigo-600" />}
                              {tool.status === 'DISABLED' && <XCircle className="w-3 h-3 text-rose-600" />}
                              {tool.status === 'MAINTENANCE' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                              {tool.status}
                            </span>
                          </td>

                          {/* Tier */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                tool.accessMode === 'PRO'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {tool.accessMode === 'PRO' ? (
                                <>
                                  <Sparkles className="w-3 h-3 text-purple-600" /> Pro Tier
                                </>
                              ) : (
                                <>
                                  <Gift className="w-3 h-3 text-blue-600" /> Free Tier
                                </>
                              )}
                            </span>
                          </td>

                          {/* Beta quota */}
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                            {tool.status === 'BETA' || tool.betaEnabled ? `${tool.betaFreeLimit || 10} uses` : 'Unlimited'}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-slate-900">{tool.totalUses}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-emerald-600">{tool.authenticatedUses ?? 0}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-600">{tool.guestUses ?? 0}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-blue-600">{tool.successRate}%</td>

                          <td className="py-3.5 px-3">{renderHealthBadge(tool.health)}</td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditDrawer(tool)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>Configure</span>
                              </button>
                              <button
                                onClick={() => openHistoryModal(tool)}
                                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="View Version History & Rollback"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUTHORITATIVE ACCESS MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'access-matrix' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Authoritative Tool Access Matrix</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Live Production Rules
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure Guest unauthenticated runs, Free signed-in access, Pro tier requirements, beta limits, and navigation visibility. Changes persist server-authoritatively.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Total Tools: {metrics.length}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/90 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider border-b border-slate-200/90 select-none">
                  <tr>
                    <th className="py-3.5 px-4">Tool</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3 text-center">Guest Access</th>
                    <th className="py-3.5 px-3 text-center">Free Account</th>
                    <th className="py-3.5 px-3 text-center">Pro Tier</th>
                    <th className="py-3.5 px-3 text-center">Beta Mode</th>
                    <th className="py-3.5 px-3 text-center">Beta Limit</th>
                    <th className="py-3.5 px-3 text-center">Nav Visible</th>
                    <th className="py-3.5 px-3 text-center">Search Visible</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMetrics.map((tool) => {
                    const isSaving = matrixSavingKey === tool.toolKey;
                    const isSuccess = matrixSuccessKey === tool.toolKey;
                    const isGuest = tool.guestAllowed ?? (tool.accessMode === 'FREE');
                    const isFree = tool.freeAllowed ?? true;
                    const isPro = tool.proAllowed ?? (tool.accessMode === 'PRO');
                    const isNavVis = tool.navVisible ?? true;
                    const isSearchVis = tool.searchVisible ?? true;

                    return (
                      <tr key={tool.toolKey} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{tool.displayName}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-400">{tool.toolKey}</span>
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-bold">
                                {tool.category}
                              </span>
                              {tool.version && (
                                <span className="font-mono text-[9px] text-blue-600 font-semibold">v{tool.version}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <select
                            value={tool.status}
                            disabled={isSaving}
                            onChange={(e) => updateMatrixRow(tool.toolKey, { status: e.target.value as ToolOperationalStatus })}
                            className="text-[11px] font-bold py-1 px-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden cursor-pointer"
                          >
                            <option value="AVAILABLE">Available</option>
                            <option value="BETA">Beta</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="DISABLED">Disabled</option>
                            <option value="COMING_SOON">Coming Soon</option>
                          </select>
                        </td>

                        {/* Guest Allowed Visual Switch */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => updateMatrixRow(tool.toolKey, { guestAllowed: !isGuest })}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                              isGuest
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {isGuest ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> Guest Allowed
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 text-amber-600" /> Account Req.
                              </>
                            )}
                          </button>
                        </td>

                        {/* Free Account Toggle */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => updateMatrixRow(tool.toolKey, { freeAllowed: !isFree })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                              isFree
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {isFree ? 'Allowed' : 'Blocked'}
                          </button>
                        </td>

                        {/* Pro Tier Toggle */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              updateMatrixRow(tool.toolKey, {
                                proAllowed: !isPro,
                                accessMode: !isPro ? 'PRO' : 'FREE',
                              })
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors border ${
                              isPro
                                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {isPro ? (
                              <>
                                <Sparkles className="w-3 h-3 text-purple-600" /> Pro Tier
                              </>
                            ) : (
                              'Standard'
                            )}
                          </button>
                        </td>

                        {/* Beta Mode Toggle */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              updateMatrixRow(tool.toolKey, {
                                status: tool.status === 'BETA' ? 'AVAILABLE' : 'BETA',
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                              tool.status === 'BETA'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {tool.status === 'BETA' ? 'Active' : 'Off'}
                          </button>
                        </td>

                        {/* Beta Limit */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                          {tool.status === 'BETA' || tool.betaEnabled ? (
                            <input
                              type="number"
                              disabled={isSaving}
                              defaultValue={tool.betaFreeLimit || 10}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (val > 0 && val !== tool.betaFreeLimit) {
                                  updateMatrixRow(tool.toolKey, { betaFreeLimit: val });
                                }
                              }}
                              className="w-16 text-center py-1 px-1 border border-slate-200 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>

                        {/* Nav Visible */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => updateMatrixRow(tool.toolKey, { navVisible: !isNavVis })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              isNavVis ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {isNavVis ? 'Visible' : 'Hidden'}
                          </button>
                        </td>

                        {/* Search Visible */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => updateMatrixRow(tool.toolKey, { searchVisible: !isSearchVis })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              isSearchVis ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {isSearchVis ? 'Indexed' : 'Excluded'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isSuccess && (
                              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 animate-pulse">
                                <Check className="w-3 h-3" /> Saved
                              </span>
                            )}
                            <button
                              onClick={() => openEditDrawer(tool)}
                              className="p-1 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                              title="Full Configuration & UX Preview"
                            >
                              <Sliders className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                            <button
                              onClick={() => openHistoryModal(tool)}
                              className="p-1 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                              title="Audit History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: USAGE VOLUME */}
      {/* ========================================================================= */}
      {activeTab === 'most-used' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">Platform Usage Volume Ranking</h3>
            <p className="text-xs text-slate-500 mt-1">
              Top canonical tools sorted by total operations in the chosen reporting window ({period}).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mostUsedMetrics.slice(0, 12).map((tool, idx) => (
              <div key={tool.toolKey} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 font-black text-xs flex items-center justify-center border border-blue-200">
                    #{idx + 1}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {tool.category}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">{tool.displayName}</h4>
                  <span className="font-mono text-[10px] text-slate-400">{tool.toolKey}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Uses</span>
                    <span className="text-sm font-black text-slate-800">{tool.totalUses}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Success</span>
                    <span className="text-sm font-black text-emerald-600">{tool.successRate}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Latency</span>
                    <span className="text-sm font-black text-slate-800">{tool.avgDurationMs}ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BETA CONTROLS */}
      {/* ========================================================================= */}
      {activeTab === 'beta-controls' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">Beta Tools Free Trial Quotas</h3>
            <p className="text-xs text-slate-500 mt-1">
              Authoritative limits on how many free trials a user receives before being prompted to upgrade to Pro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics
              .filter((m) => m.status === 'BETA' || m.betaEnabled)
              .map((tool) => (
                <div key={tool.toolKey} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" /> Beta Active
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-800">
                      Limit: {tool.betaFreeLimit || 10} Uses
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{tool.displayName}</h4>
                    <span className="font-mono text-[10px] text-slate-400">{tool.toolKey}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">Users who reached quota:</span>
                    <span className="font-bold text-amber-700">{tool.limitReachedUsers ?? 0}</span>
                  </div>
                  <button
                    onClick={() => openEditDrawer(tool)}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Adjust Quota
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: HEALTH */}
      {/* ========================================================================= */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">Deterministic Operational Health</h3>
            <p className="text-xs text-slate-500 mt-1">
              Evaluated strictly from real telemetry: error rates, latency (p95), and operational availability.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-100 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Tool</th>
                    <th className="py-3 px-3">Health Status</th>
                    <th className="py-3 px-3">Worker Mode</th>
                    <th className="py-3 px-3">Processing Type</th>
                    <th className="py-3 px-3 text-right">Error Rate</th>
                    <th className="py-3 px-3 text-right">Avg Latency</th>
                    <th className="py-3 px-3 text-right">P95 Latency</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredMetrics.map((tool) => {
                    const errorRate = tool.totalUses > 0 ? Math.round(((tool.failedOperations || 0) / tool.totalUses) * 1000) / 10 : 0;
                    return (
                      <tr key={tool.toolKey} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-bold text-slate-900">{tool.displayName}</td>
                        <td className="py-3 px-3">{renderHealthBadge(tool.health)}</td>
                        <td className="py-3 px-3 font-mono text-[11px] uppercase">{tool.workerMode}</td>
                        <td className="py-3 px-3 font-mono text-[11px] uppercase">{tool.processingType}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">{errorRate}%</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">{tool.avgDurationMs}ms</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">{tool.p95DurationMs}ms</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openEditDrawer(tool)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                          >
                            Configure
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: ACTIVITY AUDIT STREAM */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tool Execution Telemetry Stream</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time stream of tool invocations across the platform.</p>
            </div>
            <button
              onClick={loadActivity}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Refresh Stream
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-100 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">Tool</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No recent activity recorded in this window.
                    </td>
                  </tr>
                ) : (
                  activities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{act.toolName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{act.userEmail || 'Guest Visitor'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{act.action}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {act.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                        {act.durationMs ? `${act.durationMs}ms` : '—'}
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
      {/* 4. EDIT TOOL CONFIGURATION DRAWER + LIVE USER EXPERIENCE PREVIEW */}
      {/* ========================================================================= */}
      {editingTool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in duration-150 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-2xs">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{editingTool.displayName}</h3>
                    {editingTool.version && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                        Version {editingTool.version}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{editingTool.toolKey}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isDraftDirty && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    Unsaved Draft Changes
                  </span>
                )}
                <button
                  onClick={() => setEditingTool(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Concurrency Conflict Banner */}
            {concurrencyConflictError && (
              <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-800 flex-1">
                  <span className="font-bold block text-rose-900">Multi-Admin Concurrency Conflict</span>
                  {concurrencyConflictError}
                </div>
                <button
                  onClick={() => {
                    loadOverview(true);
                    setEditingTool(null);
                  }}
                  className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg text-xs hover:bg-rose-700 shrink-0 cursor-pointer"
                >
                  Reload Latest
                </button>
              </div>
            )}

            {/* Modal Body: 2 Columns */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT COLUMN: Controls & Rules (7 cols) */}
              <div className="lg:col-span-7 space-y-4 text-xs">
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
                    <option value="BETA">BETA (Controlled Free-Use Trial Quota)</option>
                    <option value="DISABLED">DISABLED (Completely Halted)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Maintenance Notice)</option>
                    <option value="COMING_SOON">COMING_SOON (Roadmap Notice)</option>
                  </select>
                </div>

                {/* Access Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Access Tier
                    </label>
                    <select
                      value={editAccessMode}
                      onChange={(e) => {
                        const val = e.target.value as ToolAccessTier;
                        setEditAccessMode(val);
                        if (val === 'PRO') {
                          setEditGuestAllowed(false);
                          setEditFreeAllowed(false);
                        } else {
                          setEditFreeAllowed(true);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="FREE">FREE Tier</option>
                      <option value="PRO">PRO Tier Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Guest Allowance
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditGuestAllowed(!editGuestAllowed)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        editGuestAllowed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {editGuestAllowed ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Guest Allowed
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-600" /> Account Required
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Free & Pro access toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Free User Access
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditFreeAllowed(!editFreeAllowed)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        editFreeAllowed
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {editFreeAllowed ? 'Free Users Allowed' : 'Free Users Blocked'}
                    </button>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Pro User Access
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditProAllowed(!editProAllowed)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        editProAllowed
                          ? 'bg-purple-50 text-purple-700 border-purple-300'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {editProAllowed ? 'Pro Users Allowed' : 'Pro Users Blocked'}
                    </button>
                  </div>
                </div>

                {/* Visibility toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Navigation Bar
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditNavVisible(!editNavVisible)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        editNavVisible
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                      }`}
                    >
                      {editNavVisible ? 'Visible in Nav' : 'Hidden from Nav'}
                    </button>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Search Index
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditSearchVisible(!editSearchVisible)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        editSearchVisible
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                      }`}
                    >
                      {editSearchVisible ? 'Searchable' : 'Hidden from Search'}
                    </button>
                  </div>
                </div>

                {/* Beta Quota Input */}
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
                      Users can run this tool up to this limit for free before Pro subscription is requested.
                    </p>
                  </div>
                )}

                {/* Maintenance Message */}
                {(editStatus === 'DISABLED' || editStatus === 'MAINTENANCE') && (
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Notice Message (Shown on Tool Page)
                    </label>
                    <input
                      type="text"
                      value={editMaintenanceMsg}
                      onChange={(e) => setEditMaintenanceMsg(e.target.value)}
                      placeholder="This tool is undergoing routine maintenance. Please check back shortly."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}

                {/* Audit Change Reason */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                    Reason for Change (Audit Note)
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g., Opening beta access for guest testing"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Live User Experience Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-600" /> Live User Experience Preview
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Real-Time Simulation</span>
                </div>

                {/* Conflict Warnings */}
                {draftConflicts.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Logical Rule Conflict Detected:</span>
                    </div>
                    {draftConflicts.map((c, i) => (
                      <p key={i} className="text-[10px] text-amber-800 leading-tight pl-4">
                        • {c}
                      </p>
                    ))}
                  </div>
                )}

                {/* Simulated Tool Card */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-100 text-slate-600">
                      {editingTool.category}
                    </span>
                    <div className="flex items-center gap-1">
                      {editGuestAllowed ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Guest OK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Account Req.
                        </span>
                      )}
                      {editAccessMode === 'PRO' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          Pro
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800">
                          Free
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-900">{editingTool.displayName}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                      {editingTool.description || 'Fast, private in-browser document processing tool designed for students and professionals.'}
                    </p>
                  </div>

                  {/* Status Banner Preview */}
                  {editStatus === 'DISABLED' && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-800 font-semibold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{editMaintenanceMsg || 'This tool is temporarily unavailable.'}</span>
                    </div>
                  )}

                  {editStatus === 'MAINTENANCE' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{editMaintenanceMsg || 'Scheduled platform maintenance in progress.'}</span>
                    </div>
                  )}

                  {/* CTA Buttons by User Tier */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Buttons Seen by User Tiers:
                    </span>

                    {/* Unauthenticated Guest */}
                    <div className="p-2.5 bg-slate-50 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-600">Guest Visitor:</span>
                        <span className="text-slate-400 font-mono">unauthenticated</span>
                      </div>
                      <div className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-center text-xs font-bold text-slate-800 shadow-2xs">
                        {editStatus === 'DISABLED'
                          ? 'Unavailable'
                          : editAccessMode === 'PRO'
                          ? 'Sign In to Upgrade to Pro'
                          : !editGuestAllowed
                          ? 'Sign In to Access Tool'
                          : 'Try Tool (No Login Required)'}
                      </div>
                    </div>

                    {/* Free Logged-In User */}
                    <div className="p-2.5 bg-slate-50 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-600">Free Logged-in User:</span>
                        <span className="text-slate-400 font-mono">tier: free</span>
                      </div>
                      <div className="w-full py-1.5 px-3 bg-blue-600 text-white rounded-lg text-center text-xs font-bold shadow-2xs">
                        {editStatus === 'DISABLED'
                          ? 'Unavailable'
                          : editAccessMode === 'PRO'
                          ? 'Upgrade to Pro'
                          : editStatus === 'BETA'
                          ? `Start Beta Trial (${editBetaFreeLimit} uses)`
                          : 'Launch Tool'}
                      </div>
                    </div>

                    {/* Pro User */}
                    <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-purple-900">Pro Subscriber:</span>
                        <span className="text-purple-600 font-mono">tier: pro</span>
                      </div>
                      <div className="w-full py-1.5 px-3 bg-purple-600 text-white rounded-lg text-center text-xs font-bold shadow-2xs">
                        {editStatus === 'DISABLED' ? 'Unavailable' : 'Launch Pro Tool'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
              <button
                type="button"
                onClick={() => setEditingTool(null)}
                className="px-4 py-2 bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Discard & Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToolConfig}
                  disabled={savingEdit || !isDraftDirty}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Saving Configuration...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. AUDIT HISTORY & ROLLBACK MODAL */}
      {/* ========================================================================= */}
      {historyModalOpen && historyTool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in duration-150 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{historyTool.displayName} — Version History</h3>
                  <span className="text-[11px] font-mono text-slate-400">{historyTool.toolKey}</span>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading version snapshots...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  No historical snapshots recorded yet for this tool.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          v{log.version}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{log.reason || 'Configuration update'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Changed by {log.changedBy}</span>
                        <span>•</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-600 pt-1">
                        <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold">
                          Status: {log.newConfig?.status || 'N/A'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold">
                          Tier: {log.newConfig?.accessMode || 'N/A'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold">
                          Guest: {log.newConfig?.guestAllowed ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={rollingBackVersion === log.version}
                      onClick={() => handleRollback(log.version)}
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-blue-700 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0 shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{rollingBackVersion === log.version ? 'Rolling back...' : `Rollback to v${log.version}`}</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/70">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close History
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
