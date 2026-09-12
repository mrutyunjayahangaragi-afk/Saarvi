"use client";

import React, { useState, useEffect } from 'react';
import {
  Globe,
  ShieldAlert,
  Save,
  Radio,
  CheckCircle2,
  Lock,
  Mail,
  Sliders,
  Palette,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { PlatformSettings } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminPlatformPage() {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [appName, setAppName] = useState('');
  const [tagline, setTagline] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [defaultTimezone, setDefaultTimezone] = useState('Asia/Kolkata');
  const [brandAccent, setBrandAccent] = useState('#2563eb');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [guestAccessEnabled, setGuestAccessEnabled] = useState(true);
  const [defaultAutoDownload, setDefaultAutoDownload] = useState(true);

  // Modals
  const [guestWarningModalOpen, setGuestWarningModalOpen] = useState(false);
  const [pendingGuestToggle, setPendingGuestToggle] = useState<boolean | null>(null);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await adminService.getPlatformSettings();
        setSettings(s);
        setAppName(s.appName);
        setTagline(s.tagline);
        setSupportEmail(s.supportEmail);
        setContactEmail(s.contactEmail);
        setDefaultLanguage(s.defaultLanguage);
        setDefaultTimezone(s.defaultTimezone);
        setBrandAccent(s.brandAccent);
        setMaintenanceMode(s.maintenanceMode);
        setMaintenanceMessage(s.maintenanceMessage);
        setRegistrationEnabled(s.registrationEnabled);
        setGuestAccessEnabled(s.guestAccessEnabled);
        setDefaultAutoDownload(s.defaultAutoDownload);
      } catch (err) {
        console.error('Failed to load platform settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleGuestToggleClick = (checked: boolean) => {
    if (!checked) {
      // Disabling guest access: Section 7 requires warning dialog!
      setPendingGuestToggle(false);
      setGuestWarningModalOpen(true);
    } else {
      setGuestAccessEnabled(true);
    }
  };

  const confirmGuestAccessDisable = () => {
    setGuestAccessEnabled(false);
    setGuestWarningModalOpen(false);
    setPendingGuestToggle(null);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setSaving(true);
    setSuccessMsg(null);

    try {
      const updated = await adminService.updatePlatformSettings(
        {
          appName: appName.trim(),
          tagline: tagline.trim(),
          supportEmail: supportEmail.trim(),
          contactEmail: contactEmail.trim(),
          defaultLanguage,
          defaultTimezone,
          brandAccent,
          maintenanceMode,
          maintenanceMessage: maintenanceMessage.trim(),
          registrationEnabled,
          guestAccessEnabled,
          defaultAutoDownload,
        },
        { id: user.id, email: user.email, role: profile.role }
      );

      setSettings(updated);
      setSuccessMsg('Platform settings updated successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save platform settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading platform configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          <span>Platform Control</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure product identity, maintenance state, guest tool accessibility, and communication channels.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* 1. Maintenance Mode Switch (Section 8) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Radio className={`w-4 h-4 ${maintenanceMode ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
                <span>Maintenance Mode</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Temporarily pause public tool execution while allowing admin dashboard access.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {maintenanceMode && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Public Maintenance Notice Message
              </label>
              <input
                type="text"
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Saarvi is temporarily under maintenance. Please try again shortly."
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-amber-700">
                Notice: All administrative functions remain completely operable during maintenance.
              </p>
            </div>
          )}
        </div>

        {/* 2. Global Guest Access Control (Section 7) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>Global Guest Access Control</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enable or disable unauthenticated guest usage of public client tools.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={guestAccessEnabled}
                onChange={(e) => handleGuestToggleClick(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
            {guestAccessEnabled ? (
              <span className="text-emerald-700 font-medium">
                Guest mode active: Visitors can convert documents locally without creating an account.
              </span>
            ) : (
              <span className="text-amber-700 font-semibold">
                Login required: Visitors must sign in or create a free account before running tools.
              </span>
            )}
          </div>
        </div>

        {/* 3. Product Branding & Identity (Section 9, 10) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <span>Product Identity & Branding</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Application Name</label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Brand Accent Color (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandAccent}
                  onChange={(e) => setBrandAccent(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={brandAccent}
                  onChange={(e) => setBrandAccent(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700">Product Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 4. Communication & Support Channels (Section 64) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <span>Support & Communications</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Contact / Press Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Default Language</label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English (en-US)</option>
                <option value="kn">Kannada (kn-IN)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Default Timezone</label>
              <input
                type="text"
                value={defaultTimezone}
                onChange={(e) => setDefaultTimezone(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>
        </div>

        {/* 5. User Registration & Default Preferences */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Workspace & Account Defaults</span>
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">Public User Registration</div>
                <div className="text-[11px] text-slate-500">Allow new students to create free accounts.</div>
              </div>
              <input
                type="checkbox"
                checked={registrationEnabled}
                onChange={(e) => setRegistrationEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-800">Default Auto-Download Behavior</div>
                <div className="text-[11px] text-slate-500">Automatically trigger browser download upon local tool completion.</div>
              </div>
              <input
                type="checkbox"
                checked={defaultAutoDownload}
                onChange={(e) => setDefaultAutoDownload(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Changes...' : 'Save Platform Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Guest Access Warning Confirmation Modal (Section 7) */}
      <AdminConfirmModal
        isOpen={guestWarningModalOpen}
        onClose={() => {
          setGuestWarningModalOpen(false);
          setPendingGuestToggle(null);
        }}
        onConfirm={confirmGuestAccessDisable}
        variant="warning"
        title="Disable Global Guest Access?"
        message="Disabling guest access will require users to sign in before using selected tools. Public visitors without an account will not be able to process files until they register."
        confirmText="Yes, Require Login"
        cancelText="Keep Guest Access"
      />
    </div>
  );
}
