"use client";

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { ToolDefinition } from '@/types/tool';
import { ToolOverrideConfig, ToolStatusUpper } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminToolsPage() {
  const { user, profile } = useAuth();
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ToolOverrideConfig>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'image' | 'pdf' | 'student'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ToolStatusUpper>('all');

  // Limit / Status Edit Modal State
  const [editingTool, setEditingTool] = useState<ToolDefinition | null>(null);
  const [editStatus, setEditStatus] = useState<ToolStatusUpper>('AVAILABLE');
  const [editMaxSizeMB, setEditMaxSizeMB] = useState<number>(25);
  const [editRequiresAuth, setEditRequiresAuth] = useState(false);
  const [editRequiresPro, setEditRequiresPro] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Disable Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingDisableTool, setPendingDisableTool] = useState<ToolDefinition | null>(null);
  const [pendingTargetStatus, setPendingTargetStatus] = useState<ToolStatusUpper>('DISABLED');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tools');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.tools)) {
          setTools(json.tools);
          const ov: Record<string, ToolOverrideConfig> = {};
          json.tools.forEach((t: any) => {
            ov[t.id] = {
              id: t.id,
              name: t.name,
              category: t.category,
              status: t.status,
              requiresAuth: t.requiresAuth,
              requiresPro: t.requiresPro,
              accessMode: t.accessMode,
              hidden: !t.publicVisible,
              updatedAt: t.updatedAt,
              updatedBy: t.updatedBy,
            };
          });
          setOverrides(ov);
          return;
        }
      }

      const [allTools, currentOverrides] = await Promise.all([
        adminService.getEffectiveTools(),
        adminService.getToolOverrides(),
      ]);
      setTools(allTools);
      setOverrides(currentOverrides);
    } catch (err) {
      console.error('Failed to load tools:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (tool: any) => {
    setEditingTool(tool);
    const slug = tool.slug || tool.id;
    const existing = overrides[slug] || overrides[tool.id];
    setEditStatus((existing?.status || tool.status?.toUpperCase() || 'AVAILABLE') as ToolStatusUpper);
    setEditMaxSizeMB(existing?.maxSizeMB || tool.maxSizeMB || 25);
    setEditRequiresAuth(existing?.requiresAuth ?? Boolean(tool.requiresAuth));
    setEditRequiresPro(
      existing?.requiresPro !== undefined
        ? existing.requiresPro
        : existing?.accessMode
        ? existing.accessMode === 'SUBSCRIPTION' || (existing.accessMode as string) === 'PRO'
        : Boolean(tool.requiresPro)
    );
    setEditDescription(existing?.description || tool.description || '');
  };

  const handleStatusChangeRequest = (tool: any, newStatus: ToolStatusUpper) => {
    if (newStatus === 'DISABLED' || newStatus === 'MAINTENANCE') {
      setPendingDisableTool(tool);
      setPendingTargetStatus(newStatus);
      setConfirmModalOpen(true);
    } else {
      applyStatusChange(tool, newStatus);
    }
  };

  const applyStatusChange = async (tool: any, newStatus: ToolStatusUpper) => {
    if (!user) return;
    const slug = tool.slug || tool.id;
    try {
      const currentOverride = overrides[slug] || {};
      const res = await fetch('/api/admin/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: slug,
          status: newStatus,
          requiresAuth: currentOverride.requiresAuth ?? Boolean(tool.requiresAuth),
          requiresPro: currentOverride.requiresPro ?? Boolean(tool.requiresPro),
          publicVisible: !currentOverride.hidden,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to update status');
      }

      await loadTools();
    } catch (err: any) {
      alert(err?.message || 'Failed to update tool status');
    }
  };

  const handleQuickToggle = async (
    tool: any,
    field: 'public' | 'requiresAuth' | 'requiresPro' | 'enabled'
  ) => {
    const slug = tool.slug || tool.id;
    const existing = overrides[slug] || {};
    const isCurrentlyAuth = existing.requiresAuth ?? Boolean(tool.requiresAuth);
    const isCurrentlyPro = existing.requiresPro ?? Boolean(tool.requiresPro);
    const isCurrentlyPublic = existing.hidden === undefined ? (tool.publicVisible ?? true) : !existing.hidden;
    const isCurrentlyEnabled = (existing.status || tool.status?.toUpperCase()) !== 'DISABLED';

    let newRequiresAuth = isCurrentlyAuth;
    let newRequiresPro = isCurrentlyPro;
    let newPublicVisible = isCurrentlyPublic;
    let newStatus = existing.status || tool.status?.toUpperCase() || 'AVAILABLE';

    if (field === 'public') {
      newPublicVisible = !isCurrentlyPublic;
    } else if (field === 'requiresAuth') {
      newRequiresAuth = !isCurrentlyAuth;
      if (!newRequiresAuth && newRequiresPro) {
        newRequiresPro = false; // Pro implies auth
      }
    } else if (field === 'requiresPro') {
      newRequiresPro = !isCurrentlyPro;
      if (newRequiresPro) {
        newRequiresAuth = true; // Pro requires auth
      }
    } else if (field === 'enabled') {
      newStatus = isCurrentlyEnabled ? 'DISABLED' : 'AVAILABLE';
    }

    try {
      const res = await fetch('/api/admin/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: slug,
          status: newStatus,
          requiresAuth: newRequiresAuth,
          requiresPro: newRequiresPro,
          publicVisible: newPublicVisible,
          accessMode: newRequiresPro ? 'PRO' : newRequiresAuth ? 'AUTH_REQUIRED' : 'PUBLIC_FREE',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to update setting');
      }

      await loadTools();
    } catch (err: any) {
      alert(err?.message || 'Failed to update setting');
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTool || !user) return;
    const slug = editingTool.slug || (editingTool as any).id;

    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: slug,
          status: editStatus,
          requiresAuth: editRequiresAuth,
          requiresPro: editRequiresPro,
          accessMode: editRequiresPro ? 'PRO' : editRequiresAuth ? 'AUTH_REQUIRED' : 'PUBLIC_FREE',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to update config');
      }

      setEditingTool(null);
      await loadTools();
    } catch (err: any) {
      alert(err?.message || 'Failed to update tool config');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tool.keywords && tool.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesCategory = categoryFilter === 'all' || tool.category === categoryFilter;

    const currentUpperStatus = (overrides[tool.slug]?.status || tool.status.toUpperCase()) as ToolStatusUpper;
    const matchesStatus = statusFilter === 'all' || currentUpperStatus === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'AVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            AVAILABLE
          </span>
        );
      case 'BETA':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            BETA
          </span>
        );
      case 'COMING_SOON':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            COMING SOON
          </span>
        );
      case 'DISABLED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            DISABLED
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            MAINTENANCE
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-500 font-mono">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            <span>Tool Control Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Govern availability, operational states (Available, Beta, Disabled, Maintenance), and client file limits.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
          Total Registered: <span className="font-bold text-slate-800">{tools.length}</span> tools
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, slug or keyword..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category and Status Dropdowns */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="pdf">PDF Tools</option>
            <option value="image">Image Tools</option>
            <option value="student">Student Tools</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="BETA">Beta</option>
            <option value="DISABLED">Disabled</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="COMING_SOON">Coming Soon</option>
          </select>

          <button
            onClick={loadTools}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tools Table (with mobile responsive card fallback) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Tool</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3 text-center">Public</th>
                <th className="py-3.5 px-3 text-center">Login Required</th>
                <th className="py-3.5 px-3 text-center">Pro Required</th>
                <th className="py-3.5 px-3 text-center">Enabled</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No tools match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTools.map((tool: any) => {
                  const slug = tool.slug || tool.id;
                  const override = overrides[slug] || {};
                  const currentStatus = (override.status || tool.status?.toUpperCase() || 'AVAILABLE') as ToolStatusUpper;
                  const isEnabled = currentStatus !== 'DISABLED';
                  const isAuth = override.requiresAuth ?? Boolean(tool.requiresAuth);
                  const isPro = override.requiresPro ?? Boolean(tool.requiresPro);
                  const isPublic = override.hidden === undefined ? (tool.publicVisible ?? true) : !override.hidden;

                  return (
                    <tr key={slug} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{tool.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{slug}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {tool.category}
                        </span>
                      </td>

                      {/* Public Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickToggle(tool, 'public')}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isPublic
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Click to toggle Public visibility"
                        >
                          <span>{isPublic ? 'Public ✓' : 'Hidden ✗'}</span>
                        </button>
                      </td>

                      {/* Login Required Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickToggle(tool, 'requiresAuth')}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isAuth
                              ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Click to toggle Login requirement"
                        >
                          <span>{isAuth ? 'Login ✓' : 'Guest ✗'}</span>
                        </button>
                      </td>

                      {/* Pro Required Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickToggle(tool, 'requiresPro')}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isPro
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Click to toggle Pro requirement"
                        >
                          <span>{isPro ? 'Pro ✓' : 'Free ✗'}</span>
                        </button>
                      </td>

                      {/* Enabled Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickToggle(tool, 'enabled')}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Click to toggle tool Enabled state"
                        >
                          <span>{isEnabled ? 'Enabled ✓' : 'Disabled ✗'}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openEditModal(tool)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                          title="Configure Tool Limits & Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Configure</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards (Screens < 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredTools.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No tools match the selected filters.
            </div>
          ) : (
            filteredTools.map((tool: any) => {
              const slug = tool.slug || tool.id;
              const override = overrides[slug] || {};
              const currentStatus = (override.status || tool.status?.toUpperCase() || 'AVAILABLE') as ToolStatusUpper;
              const isEnabled = currentStatus !== 'DISABLED';
              const isAuth = override.requiresAuth ?? Boolean(tool.requiresAuth);
              const isPro = override.requiresPro ?? Boolean(tool.requiresPro);
              const isPublic = override.hidden === undefined ? (tool.publicVisible ?? true) : !override.hidden;

              return (
                <div key={slug} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{tool.name}</h4>
                      <span className="text-[11px] text-slate-400 font-mono">{slug}</span>
                    </div>
                    <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {tool.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickToggle(tool, 'public')}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl font-bold flex items-center justify-center cursor-pointer border ${
                        isPublic ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isPublic ? 'Public ✓' : 'Hidden ✗'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickToggle(tool, 'requiresAuth')}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl font-bold flex items-center justify-center cursor-pointer border ${
                        isAuth ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isAuth ? 'Login Required ✓' : 'Guest Allowed ✗'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickToggle(tool, 'requiresPro')}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl font-bold flex items-center justify-center cursor-pointer border ${
                        isPro ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isPro ? 'Pro Required ✓' : 'Free Tool ✗'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickToggle(tool, 'enabled')}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl font-bold flex items-center justify-center cursor-pointer border ${
                        isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {isEnabled ? 'Enabled ✓' : 'Disabled ✗'}
                    </button>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => openEditModal(tool)}
                      className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Configure Limits</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Tool Modal */}
      {editingTool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Configure Tool: {editingTool.name}
                </h3>
                <div className="text-[11px] text-slate-500 font-mono">{editingTool.slug}</div>
              </div>
              <button
                onClick={() => setEditingTool(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Tool Operational Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ToolStatusUpper)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AVAILABLE">AVAILABLE (Normal operational mode)</option>
                  <option value="BETA">BETA (Early preview)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Temporarily offline for improvement)</option>
                  <option value="DISABLED">DISABLED (Fully deactivated)</option>
                  <option value="COMING_SOON">COMING_SOON (Upcoming release)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  {editStatus === 'DISABLED' && 'Public page will display: "This tool is temporarily unavailable."'}
                  {editStatus === 'MAINTENANCE' && 'Public page will display: "This tool is temporarily unavailable while we improve it."'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Maximum File Size Limit (MB) — Single Source of Truth
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={editMaxSizeMB}
                  onChange={(e) => setEditMaxSizeMB(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500">
                  Enforced synchronously across the UI dropzone and the client processing worker.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Authentication Requirement</label>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="edit-auth"
                    checked={editRequiresAuth}
                    onChange={(e) => setEditRequiresAuth(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="edit-auth" className="text-slate-700">
                    Require users to log in before executing this specific tool
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Access Mode & Plan Gating</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-access-mode"
                      checked={!editRequiresPro}
                      onChange={() => setEditRequiresPro(false)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 font-semibold">FREE (Guest & Free Accounts)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-access-mode"
                      checked={editRequiresPro}
                      onChange={() => setEditRequiresPro(true)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-purple-700 font-semibold">PRO (₹99/mo or ₹899/yr)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Public Tool Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTool(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  {savingEdit ? 'Saving...' : 'Apply Overrides'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Disabling / Maintenance */}
      <AdminConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingDisableTool(null);
        }}
        onConfirm={() => {
          if (pendingDisableTool) {
            applyStatusChange(pendingDisableTool, pendingTargetStatus);
          }
          setConfirmModalOpen(false);
          setPendingDisableTool(null);
        }}
        variant={pendingTargetStatus === 'DISABLED' ? 'danger' : 'warning'}
        title={`${pendingTargetStatus === 'DISABLED' ? 'Disable' : 'Set Maintenance for'} "${pendingDisableTool?.name}"?`}
        message={`This will immediately make ${pendingDisableTool?.name} unavailable on the public website. Public visitors will see a clear notification without a broken button.`}
        confirmText={`Yes, Set to ${pendingTargetStatus}`}
        cancelText="Keep Available"
      />
    </div>
  );
}
