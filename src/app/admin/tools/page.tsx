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

  const openEditModal = (tool: ToolDefinition) => {
    setEditingTool(tool);
    const existing = overrides[tool.slug] || overrides[tool.id];
    setEditStatus((existing?.status || tool.status.toUpperCase()) as ToolStatusUpper);
    setEditMaxSizeMB(existing?.maxSizeMB || tool.maxSizeMB || 25);
    setEditRequiresAuth(existing?.requiresAuth ?? tool.requiresAuth);
    setEditRequiresPro(
      existing?.requiresPro !== undefined
        ? existing.requiresPro
        : existing?.accessMode
        ? existing.accessMode === 'SUBSCRIPTION'
        : Boolean(tool.requiresPro)
    );
    setEditDescription(existing?.description || tool.description);
  };

  const handleStatusChangeRequest = (tool: ToolDefinition, newStatus: ToolStatusUpper) => {
    if (newStatus === 'DISABLED' || newStatus === 'MAINTENANCE') {
      // Require confirmation for disabling or putting into maintenance!
      setPendingDisableTool(tool);
      setPendingTargetStatus(newStatus);
      setConfirmModalOpen(true);
    } else {
      applyStatusChange(tool, newStatus);
    }
  };

  const applyStatusChange = async (tool: ToolDefinition, newStatus: ToolStatusUpper) => {
    if (!user || !profile) return;
    try {
      const currentOverride = overrides[tool.slug] || {};
      const updated: ToolOverrideConfig = {
        ...currentOverride,
        id: tool.slug,
        status: newStatus,
        maxSizeMB: currentOverride.maxSizeMB || tool.maxSizeMB,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email,
      };
      await adminService.updateToolOverride(updated, {
        id: user.id,
        email: user.email,
        role: profile.role,
      });
      await loadTools();
    } catch (err: any) {
      alert(err?.message || 'Failed to update tool status');
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTool || !user || !profile) return;

    setSavingEdit(true);
    try {
      const updated: ToolOverrideConfig = {
        id: editingTool.slug,
        status: editStatus,
        maxSizeMB: Number(editMaxSizeMB),
        requiresAuth: editRequiresAuth,
        requiresPro: editRequiresPro,
        accessMode: editRequiresPro ? 'SUBSCRIPTION' : 'FREE',
        description: editDescription.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.email,
      };

      await adminService.updateToolOverride(updated, {
        id: user.id,
        email: user.email,
        role: profile.role,
      });

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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tool Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Processing Engine</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">File Limit</th>
                <th className="py-3 px-3">Auth Rule</th>
                <th className="py-3 px-4 text-right">Actions</th>
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
                filteredTools.map((tool) => {
                  const currentStatus = (overrides[tool.slug]?.status || tool.status.toUpperCase()) as ToolStatusUpper;
                  const currentLimit = overrides[tool.slug]?.maxSizeMB || tool.maxSizeMB || 25;

                  return (
                    <tr key={tool.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{tool.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{tool.slug}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {tool.category}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[11px] text-slate-600 font-medium">
                          Browser (Client-Side)
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {getStatusBadge(currentStatus)}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-slate-700 font-semibold">{currentLimit} MB</span>
                      </td>

                      <td className="py-3 px-3">
                        {tool.requiresAuth ? (
                          <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            Guest Allowed
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Quick Toggle Status */}
                          {currentStatus === 'AVAILABLE' ? (
                            <button
                              onClick={() => handleStatusChangeRequest(tool, 'DISABLED')}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-semibold border border-red-200 transition-colors cursor-pointer"
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChangeRequest(tool, 'AVAILABLE')}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-semibold border border-emerald-200 transition-colors cursor-pointer"
                            >
                              Enable
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(tool)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Configure Tool Limits & Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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
