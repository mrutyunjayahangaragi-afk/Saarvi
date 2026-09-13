"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  ToggleLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Sliders,
  Shield,
  Layers,
  Wrench,
  Clock,
  Search,
  Check,
  Lock,
  RefreshCw,
  Zap,
  Info,
} from 'lucide-react';
import { featureService } from '@/lib/services/featureService';
import { FeatureFlag, FeatureFlagStatus, FeatureAccessMode } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminFeaturesPage() {
  const { user, profile } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tools' | 'student' | 'future'>('all');
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    name: string;
    actionType: 'status' | 'accessMode';
    newStatus?: FeatureFlagStatus;
    newAccessMode?: FeatureAccessMode;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning';
  } | null>(null);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    setLoading(true);
    try {
      // First attempt to load from authoritative admin API
      const res = await fetch('/api/admin/features');
      if (res.ok) {
        const data = await res.json();
        if (data.features) {
          setFlags(data.features);
          return;
        }
      }
      // Resilient local fallback
      const all = featureService.getAllFeatures();
      setFlags(all);
    } catch {
      const all = featureService.getAllFeatures();
      setFlags(all);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = (flag: FeatureFlag, targetStatus: FeatureFlagStatus) => {
    if (flag.status === targetStatus) return;

    if (targetStatus === 'DISABLED' || targetStatus === 'MAINTENANCE') {
      setPendingAction({
        id: flag.id,
        name: flag.name,
        actionType: 'status',
        newStatus: targetStatus,
        title: `Set "${flag.name}" to ${targetStatus}?`,
        message: `This will alter operational availability across the website immediately. Users will no longer have normal access.`,
        confirmText: `Confirm ${targetStatus}`,
        variant: targetStatus === 'DISABLED' ? 'danger' : 'warning',
      });
      setConfirmModalOpen(true);
    } else {
      executeStatusUpdate(flag.id, targetStatus);
    }
  };

  const handleAccessModeToggle = (flag: FeatureFlag, targetMode: FeatureAccessMode) => {
    if (flag.accessMode === targetMode) return;

    if (targetMode === 'SUBSCRIPTION') {
      setPendingAction({
        id: flag.id,
        name: flag.name,
        actionType: 'accessMode',
        newAccessMode: targetMode,
        title: `Restrict "${flag.name}" to Saarvi Pro?`,
        message: `This will require a ₹99/mo or ₹899/yr Pro subscription. Free accounts and guests will be prompted to upgrade.`,
        confirmText: 'Confirm Subscription Gating',
        variant: 'warning',
      });
      setConfirmModalOpen(true);
    } else {
      executeAccessModeUpdate(flag.id, targetMode);
    }
  };

  const executeStatusUpdate = async (id: string, status: FeatureFlagStatus) => {
    if (!user || !profile) return;
    setIsUpdating(id);
    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      if (res.ok) {
        const data = await res.json();
        setFlags((prev) => prev.map((f) => (f.id === id ? data.feature : f)));
        showFeedback('success', `Status updated to ${status}.`);
      } else {
        // Fallback to local featureService
        const updated = featureService.updateFeatureStatus(id, status, {
          id: user.id,
          email: user.email,
          role: profile.role,
        });
        setFlags((prev) => prev.map((f) => (f.id === id ? updated : f)));
        showFeedback('success', `Status updated to ${status}.`);
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to update feature status.');
    } finally {
      setIsUpdating(null);
    }
  };

  const executeAccessModeUpdate = async (id: string, accessMode: FeatureAccessMode) => {
    if (!user || !profile) return;
    setIsUpdating(id);
    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, accessMode }),
      });

      if (res.ok) {
        const data = await res.json();
        setFlags((prev) => prev.map((f) => (f.id === id ? data.feature : f)));
        showFeedback('success', `Access mode set to ${accessMode}.`);
      } else {
        const updated = featureService.updateFeatureAccessMode(id, accessMode, {
          id: user.id,
          email: user.email,
          role: profile.role,
        });
        setFlags((prev) => prev.map((f) => (f.id === id ? updated : f)));
        showFeedback('success', `Access mode set to ${accessMode}.`);
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to update access mode.');
    } finally {
      setIsUpdating(null);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedbackNotice({ type, message });
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const metrics = useMemo(() => {
    const total = flags.length;
    const active = flags.filter((f) => f.status === 'ENABLED' || f.status === 'BETA').length;
    const disabled = flags.filter((f) => f.status === 'DISABLED').length;
    const free = flags.filter((f) => f.accessMode === 'FREE' || !f.accessMode).length;
    const subscription = flags.filter((f) => f.accessMode === 'SUBSCRIPTION').length;
    return { total, active, disabled, free, subscription };
  }, [flags]);

  const filteredFlags = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return flags.filter((f) => {
      const matchCat = selectedCategory === 'all' || f.category === selectedCategory;
      const matchQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        (f.key && f.key.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [flags, selectedCategory, searchQuery]);

  const getStatusBadge = (status: FeatureFlagStatus) => {
    switch (status) {
      case 'ENABLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">ENABLED</span>;
      case 'BETA':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">BETA</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">MAINTENANCE</span>;
      case 'DISABLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">DISABLED</span>;
    }
  };

  const getAccessBadge = (accessMode: FeatureAccessMode = 'FREE') => {
    if (accessMode === 'SUBSCRIPTION') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" />
          <span>PRO</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        FREE
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ToggleLeft className="w-6 h-6 text-blue-600" />
            <span>Feature Flags Control Center</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Authoritative platform control plane: toggle feature availability and set FREE vs SUBSCRIPTION access modes.
          </p>
        </div>

        <button
          onClick={loadFeatures}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync State</span>
        </button>
      </div>

      {/* Real-time feedback alert */}
      {feedbackNotice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
          role="alert"
        >
          {feedbackNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedbackNotice.message}</span>
        </div>
      )}

      {/* Aggregate Statistics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total Features</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.total}</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <div className="text-[11px] font-medium text-emerald-700">Active Features</div>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{metrics.active}</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Disabled</div>
          <div className="text-xl font-bold text-slate-700 mt-0.5">{metrics.disabled}</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <div className="text-[11px] font-medium text-blue-700">Free Access</div>
          <div className="text-xl font-bold text-blue-700 mt-0.5">{metrics.free}</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <div className="text-[11px] font-medium text-purple-700">Subscription Required</div>
          <div className="text-xl font-bold text-purple-700 mt-0.5">{metrics.subscription}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features by name or key..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'tools', label: 'Core Tools' },
            { id: 'student', label: 'Student Suite' },
            { id: 'future', label: 'Pro & AI' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Flags Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFlags.map((flag) => {
          const isUpdatingThis = isUpdating === flag.id;

          return (
            <div
              key={flag.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                flag.status === 'DISABLED'
                  ? 'border-slate-200 bg-slate-50/50 opacity-80'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-2.5">
                {/* Card Header: Title, Key, Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{flag.name}</h3>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{flag.id}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getAccessBadge(flag.accessMode)}
                    {getStatusBadge(flag.status)}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {flag.description}
                </p>

                {/* Metadata: Category & Last Updated */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                  <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {flag.category}
                  </span>
                  <span>•</span>
                  <span>Updated: {new Date(flag.updatedAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>By: {flag.updatedBy || 'system'}</span>
                </div>
              </div>

              {/* Controls Section */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                {/* Access Mode Switcher */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Access:</span>
                  <button
                    onClick={() => handleAccessModeToggle(flag, 'FREE')}
                    disabled={isUpdatingThis}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      flag.accessMode !== 'SUBSCRIPTION'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    FREE
                  </button>
                  <button
                    onClick={() => handleAccessModeToggle(flag, 'SUBSCRIPTION')}
                    disabled={isUpdatingThis}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      flag.accessMode === 'SUBSCRIPTION'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    PRO (₹99/mo)
                  </button>
                </div>

                {/* Status Switcher */}
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  {(['ENABLED', 'BETA', 'MAINTENANCE', 'DISABLED'] as FeatureFlagStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusToggle(flag, st)}
                      disabled={isUpdatingThis}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                        flag.status === st
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-150'
                      }`}
                    >
                      {st === 'MAINTENANCE' ? 'Maint' : st.charAt(0) + st.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {pendingAction && (
        <AdminConfirmModal
          isOpen={confirmModalOpen}
          onClose={() => {
            setConfirmModalOpen(false);
            setPendingAction(null);
          }}
          onConfirm={() => {
            if (pendingAction.actionType === 'status' && pendingAction.newStatus) {
              executeStatusUpdate(pendingAction.id, pendingAction.newStatus);
            } else if (pendingAction.actionType === 'accessMode' && pendingAction.newAccessMode) {
              executeAccessModeUpdate(pendingAction.id, pendingAction.newAccessMode);
            }
            setConfirmModalOpen(false);
            setPendingAction(null);
          }}
          variant={pendingAction.variant}
          title={pendingAction.title}
          message={pendingAction.message}
          confirmText={pendingAction.confirmText}
          cancelText="Cancel"
        />
      )}
    </div>
  );
}
