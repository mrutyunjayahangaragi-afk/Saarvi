"use client";

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { featureService } from '@/lib/services/featureService';
import { FeatureFlag, FeatureFlagStatus } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminFeaturesPage() {
  const { user, profile } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tools' | 'student' | 'future'>('all');

  // Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    id: string;
    name: string;
    newStatus: FeatureFlagStatus;
  } | null>(null);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = () => {
    setLoading(true);
    try {
      const all = featureService.getAllFeatures();
      setFlags(all);
    } finally {
      setLoading(false);
    }
  };

  const requestStatusChange = (flag: FeatureFlag, newStatus: FeatureFlagStatus) => {
    if (newStatus === 'DISABLED' || newStatus === 'MAINTENANCE') {
      setPendingToggle({ id: flag.id, name: flag.name, newStatus });
      setConfirmModalOpen(true);
    } else {
      applyStatus(flag.id, newStatus);
    }
  };

  const applyStatus = (id: string, status: FeatureFlagStatus) => {
    if (!user || !profile) return;
    try {
      featureService.updateFeatureStatus(id, status, {
        id: user.id,
        email: user.email,
        role: profile.role,
      });
      loadFeatures();
    } catch (err: any) {
      alert(err?.message || 'Failed to update feature status');
    }
  };

  const filteredFlags = flags.filter((f) => {
    if (selectedCategory === 'all') return true;
    return f.category === selectedCategory;
  });

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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ToggleLeft className="w-5 h-5 text-blue-600" />
            <span>Feature Flags Control</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Centrally manage runtime functionality and preview future roadmap modules without hardcoded conditions.
          </p>
        </div>

        {/* Category selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedCategory === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('tools')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedCategory === 'tools' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tools
          </button>
          <button
            onClick={() => setSelectedCategory('student')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedCategory === 'student' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Student
          </button>
          <button
            onClick={() => setSelectedCategory('future')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedCategory === 'future' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Future Tiers
          </button>
        </div>
      </div>

      {/* Flags Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredFlags.map((flag) => (
          <div
            key={flag.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{flag.name}</h3>
                  <div className="text-[11px] text-slate-400 font-mono">{flag.id}</div>
                </div>
                {getStatusBadge(flag.status)}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {flag.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="capitalize text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                {flag.category}
              </span>

              {/* Status Switcher */}
              <div className="flex items-center gap-1">
                {(['ENABLED', 'BETA', 'MAINTENANCE', 'DISABLED'] as FeatureFlagStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => requestStatusChange(flag, st)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                      flag.status === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {st.charAt(0) + st.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingToggle(null);
        }}
        onConfirm={() => {
          if (pendingToggle) {
            applyStatus(pendingToggle.id, pendingToggle.newStatus);
          }
          setConfirmModalOpen(false);
          setPendingToggle(null);
        }}
        variant={pendingToggle?.newStatus === 'DISABLED' ? 'danger' : 'warning'}
        title={`Set "${pendingToggle?.name}" to ${pendingToggle?.newStatus}?`}
        message={`This will alter the operational availability of this feature across the platform immediately.`}
        confirmText={`Confirm ${pendingToggle?.newStatus}`}
        cancelText="Cancel"
      />
    </div>
  );
}
