"use client";

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Download,
  Upload,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Shield,
  Layers,
  Lock,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { PlatformSettings } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminSettingsPage() {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'backup'>('general');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // Reset Confirmation Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const s = await adminService.getPlatformSettings();
      setSettings(s);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const jsonStr = await adminService.exportPlatformConfiguration();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saarvi-platform-config-${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim() || !user || !profile) return;

    setImporting(true);
    try {
      const res = await adminService.validateAndImportConfiguration(importText, {
        id: user.id,
        email: user.email,
        role: profile.role,
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setImportText('');
        await loadSettings();
      } else {
        alert(res.message);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!user || !profile) return;
    try {
      await adminService.updatePlatformSettings(
        {
          appName: 'Saarvi',
          tagline: 'Study. Work. Grow.',
          brandAccent: '#2563eb',
          supportEmail: 'support@saarvi.app',
          contactEmail: 'contact@saarvi.app',
          defaultLanguage: 'en',
          defaultTimezone: 'Asia/Kolkata',
          maintenanceMode: false,
          registrationEnabled: true,
          guestAccessEnabled: true,
          defaultAutoDownload: true,
        },
        { id: user.id, email: user.email, role: profile.role }
      );
      setResetModalOpen(false);
      setSuccessMsg('Reset to safe platform defaults.');
      await loadSettings();
    } catch (err: any) {
      alert(err?.message || 'Failed to reset settings');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>Platform Configuration & Backup</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Categorized system settings, validated configuration exports, and schema-verified imports.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          General & Versioning
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'privacy' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Privacy & Storage Limits
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'backup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          JSON Backup & Import
        </button>
      </div>

      {/* Tab 1: General & Versioning */}
      {activeTab === 'general' && settings && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Current Configuration State</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl">
            <div>
              <span className="text-slate-400 block text-[10px]">Config Version</span>
              <span className="font-bold text-slate-800 text-sm">v{settings.version}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Last Updated By</span>
              <span className="font-mono text-slate-700">{settings.updatedBy}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Timestamp</span>
              <span className="font-mono text-slate-700">{new Date(settings.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="font-bold text-slate-800">Operational Invariants:</div>
            <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px]">
              <li>Every setting has a validated runtime schema and safe static fallback.</li>
              <li>Administrative mutations are recorded in the append-only audit trail.</li>
              <li>Platform continues running using static fallbacks if configuration storage is unreachable.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Privacy Policy Bounds */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Air-Gapped Local Privacy Guarantees</h2>
              <div className="text-[11px] text-slate-500">Phase 11 Critical Privacy Invariants</div>
            </div>
          </div>

          <div className="space-y-2 text-slate-600 leading-relaxed">
            <p className="text-emerald-800 leading-relaxed">
              The Saarvi platform architecture guarantees that student document files, resumes, academic marks, and personal notes are stored strictly in client memory and browser localStorage.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-800">Protected Client Entities:</div>
              <div className="font-mono text-[11px] text-slate-600">
                PDF Documents • JPG/PNG Images • Resume Drafts • SGPA Marks • Study Plans • Certificates • Timetables
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Backup & Import */}
      {activeTab === 'backup' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Import Validated Configuration JSON</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Paste a previously exported configuration JSON. Secrets and tokens are rejected; schema is validated before applying.
            </p>
          </div>

          <form onSubmit={handleImportSubmit} className="space-y-3">
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste JSON configuration payload here..."
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{importing ? 'Validating...' : 'Validate & Apply Configuration'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <AdminConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleResetDefaults}
        variant="danger"
        title="Reset All Settings to Defaults?"
        message="This will restore application name, guest access, and default limits to the original factory configuration. Existing user accounts and curriculum records will remain unaffected."
        confirmText="Reset to Defaults"
      />
    </div>
  );
}
