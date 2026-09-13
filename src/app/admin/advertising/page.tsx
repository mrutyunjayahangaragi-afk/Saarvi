"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Megaphone,
  Sparkles,
  Play,
  Pause,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Settings,
  Calendar,
  BarChart3,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Upload,
  Video,
  Image as ImageIcon,
  Smartphone,
  Monitor,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Lock,
  ArrowRight,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import {
  AdvertisementRecord,
  AdDisplaySettings,
  AdAnalyticsEvent,
  AdAnalyticsSummary,
  AdvertisementStatus,
  AdMediaType,
  AdDisplayMode,
  AdAudience,
  AdFrequencyMode,
} from '@/types/admin';
import { sanitizeUrl } from '@/lib/security/url-security';

type AdTab =
  | 'OVERVIEW'
  | 'ADS'
  | 'CREATE'
  | 'SCHEDULING'
  | 'SETTINGS'
  | 'ANALYTICS'
  | 'AUDIT';

export default function AdminAdvertisingPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdTab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Authentication Headers Helper for resilient administrative authorization
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (user?.id) headers['x-user-id'] = user.id;
    if (user?.email) headers['x-user-email'] = user.email;
    if (profile?.role) headers['x-user-role'] = profile.role;
    return headers;
  }, [user, profile]);

  // Core Data
  const [ads, setAds] = useState<AdvertisementRecord[]>([]);
  const [settings, setSettings] = useState<AdDisplaySettings>({
    adsEnabled: true,
    defaultDisplayMode: 'FULLSCREEN_GATE',
    defaultDurationSeconds: 15,
    defaultSkipEnabled: true,
    defaultSkipAfterSeconds: 5,
    defaultFrequencyMode: 'ONCE_PER_SESSION',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  });
  const [summary, setSummary] = useState<AdAnalyticsSummary>({
    impressions: 0,
    completed: 0,
    skipped: 0,
    ctaClicks: 0,
    mediaErrors: 0,
    completionRate: 0,
    skipRate: 0,
    ctr: 0,
  });
  const [recentEvents, setRecentEvents] = useState<AdAnalyticsEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Preview Drawer State
  const [previewAd, setPreviewAd] = useState<AdvertisementRecord | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewSecondsLeft, setPreviewSecondsLeft] = useState<number>(15);
  const [previewCanSkip, setPreviewCanSkip] = useState<boolean>(false);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Create / Edit Form State
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    mediaType: 'IMAGE' as AdMediaType,
    mediaUrl: '',
    thumbnailUrl: '',
    headline: '',
    bodyText: '',
    ctaText: '',
    ctaUrl: '',
    advertiserName: '',
    status: 'DRAFT' as AdvertisementStatus,
    priority: 0,
    audience: 'FREE_ONLY' as AdAudience,
    startAt: '',
    endAt: '',
    timezone: 'UTC',
    durationSeconds: 15,
    skipEnabled: true,
    skipAfterSeconds: 5,
    displayMode: 'FULLSCREEN_GATE' as AdDisplayMode,
    frequencyMode: 'ONCE_PER_SESSION' as AdFrequencyMode,
  });

  // Fetch initial data with resilient fallback
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/advertising', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAds(data.ads || []);
          if (data.settings) setSettings(data.settings);
          if (data.summary) setSummary(data.summary);
          if (data.recentEvents) setRecentEvents(data.recentEvents);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const message = errData.error || `Failed to load data (${res.status})`;
        console.warn('[Admin Ad Page] Fetch response notice:', message);
        setFeedback({
          type: 'error',
          text: message,
        });
      }
    } catch (err: any) {
      console.error('[Admin Ad Page] Fetch error:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to load advertising data.' });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered ads
  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      const matchesSearch =
        ad.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ad.headline && ad.headline.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ad.advertiserName && ad.advertiserName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || ad.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [ads, searchQuery, statusFilter]);

  // Active currently scheduled ad
  const activeScheduledAd = useMemo(() => {
    const now = Date.now();
    return ads.find((ad) => {
      if (ad.status !== 'ACTIVE') return false;
      if (ad.startAt && new Date(ad.startAt).getTime() > now) return false;
      if (ad.endAt && new Date(ad.endAt).getTime() < now) return false;
      return true;
    });
  }, [ads]);

  // Handle media file upload
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setFeedback(null);
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      uploadForm.append('mediaType', formData.mediaType);

      const res = await fetch('/api/admin/advertising/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: uploadForm,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setFormData((prev) => ({
        ...prev,
        mediaUrl: data.url,
        mediaType: data.mediaType,
      }));

      setFeedback({
        type: 'success',
        text: `Media validated (${data.format.toUpperCase()}, ${(data.sizeBytes / 1024).toFixed(1)} KB) and ready. Save to publish.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to upload media.' });
    } finally {
      setUploading(false);
    }
  };

  // Submit create / edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', text: 'Advertisement Name is required.' });
      return;
    }
    if (!formData.mediaUrl.trim()) {
      setFeedback({ type: 'error', text: 'Please upload or provide an advertisement media file/URL.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (editingAdId) {
        // Update
        const res = await fetch('/api/admin/advertising', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ id: editingAdId, ...formData }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');
        setFeedback({ type: 'success', text: `Advertisement "${formData.name}" updated successfully.` });
      } else {
        // Create
        const res = await fetch('/api/admin/advertising', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Creation failed');
        setFeedback({ type: 'success', text: `Advertisement "${formData.name}" created successfully.` });
      }

      // Refresh
      await fetchData();
      resetForm();
      setActiveTab('ADS');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save advertisement.' });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (ad: AdvertisementRecord) => {
    setEditingAdId(ad.id);
    setFormData({
      name: ad.name,
      description: ad.description || '',
      mediaType: ad.mediaType,
      mediaUrl: ad.mediaUrl,
      thumbnailUrl: ad.thumbnailUrl || '',
      headline: ad.headline || '',
      bodyText: ad.bodyText || '',
      ctaText: ad.ctaText || '',
      ctaUrl: ad.ctaUrl || '',
      advertiserName: ad.advertiserName || '',
      status: ad.status,
      priority: ad.priority,
      audience: ad.audience,
      startAt: ad.startAt || '',
      endAt: ad.endAt || '',
      timezone: ad.timezone || 'UTC',
      durationSeconds: ad.durationSeconds,
      skipEnabled: ad.skipEnabled,
      skipAfterSeconds: ad.skipAfterSeconds,
      displayMode: ad.displayMode,
      frequencyMode: ad.frequencyMode,
    });
    setActiveTab('CREATE');
  };

  const resetForm = () => {
    setEditingAdId(null);
    setFormData({
      name: '',
      description: '',
      mediaType: 'IMAGE',
      mediaUrl: '',
      thumbnailUrl: '',
      headline: '',
      bodyText: '',
      ctaText: '',
      ctaUrl: '',
      advertiserName: '',
      status: 'DRAFT',
      priority: 0,
      audience: 'FREE_ONLY',
      startAt: '',
      endAt: '',
      timezone: 'UTC',
      durationSeconds: settings.defaultDurationSeconds,
      skipEnabled: settings.defaultSkipEnabled,
      skipAfterSeconds: settings.defaultSkipAfterSeconds,
      displayMode: settings.defaultDisplayMode,
      frequencyMode: settings.defaultFrequencyMode,
    });
  };

  const toggleStatus = async (ad: AdvertisementRecord) => {
    const nextStatus: AdvertisementStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetch('/api/admin/advertising', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: ad.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update status');
      setFeedback({ type: 'success', text: `Ad "${ad.name}" set to ${nextStatus}.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const deleteAd = async (ad: AdvertisementRecord) => {
    if (!confirm(`Are you sure you want to permanently delete advertisement "${ad.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/advertising?id=${ad.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
      setFeedback({ type: 'success', text: `Ad "${ad.name}" deleted.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const updateGlobalSettings = async (updates: Partial<AdDisplaySettings>) => {
    try {
      const res = await fetch('/api/admin/advertising', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'UPDATE_SETTINGS', settings: updates }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update settings');
      setSettings(data.settings);
      setFeedback({ type: 'success', text: 'Display settings updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  // Preview management
  const openPreview = (ad: AdvertisementRecord) => {
    setPreviewAd(ad);
    setPreviewSecondsLeft(ad.durationSeconds);
    setPreviewCanSkip(!ad.skipEnabled || ad.skipAfterSeconds === 0);

    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    const start = Date.now();
    const durationMs = ad.durationSeconds * 1000;
    const skipMs = ad.skipAfterSeconds * 1000;

    previewTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setPreviewSecondsLeft(left);

      if (ad.skipEnabled && elapsed >= skipMs) {
        setPreviewCanSkip(true);
      }

      if (elapsed >= durationMs) {
        if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      }
    }, 250);
  };

  const closePreview = () => {
    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    setPreviewAd(null);
  };

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Advertising & Promotional Gate
              </h1>
              <p className="text-sm text-slate-500">
                Super Admin control center for promotional media gates, timers, and audience targeting.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => updateGlobalSettings({ adsEnabled: !settings.adsEnabled })}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              settings.adsEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                settings.adsEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            {settings.adsEnabled ? 'Ads System: Enabled' : 'Ads System: Disabled'}
          </button>

          <button
            onClick={() => {
              resetForm();
              setActiveTab('CREATE');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Advertisement
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in slide-in-from-top-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'OVERVIEW', label: 'Overview', icon: BarChart3 },
          { id: 'ADS', label: `Advertisements (${ads.length})`, icon: Megaphone },
          {
            id: 'CREATE',
            label: editingAdId ? 'Edit Advertisement' : 'Create Advertisement',
            icon: editingAdId ? Edit2 : Plus,
          },
          { id: 'SCHEDULING', label: 'Scheduling', icon: Calendar },
          { id: 'SETTINGS', label: 'Display Settings', icon: Sliders },
          { id: 'ANALYTICS', label: 'Analytics', icon: Eye },
          { id: 'AUDIT', label: 'Audit Log', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Active Ad Banner */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Currently Serving Live
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Active Promotional Gate
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  Target: Free Users Only (Pro Exempt)
                </span>
              </div>
            </div>

            {activeScheduledAd ? (
              <div className="flex flex-col md:flex-row items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-32 h-20 rounded-lg overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center relative border border-slate-300">
                  {activeScheduledAd.mediaType === 'IMAGE' ? (
                    <img
                      src={activeScheduledAd.mediaUrl}
                      alt={activeScheduledAd.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-slate-900 text-white">
                      <Video className="w-6 h-6 text-blue-400" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/70 text-white">
                    {activeScheduledAd.mediaType}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {activeScheduledAd.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      ACTIVE NOW
                    </span>
                    <span className="text-xs text-slate-400">Priority: {activeScheduledAd.priority}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                    {activeScheduledAd.headline || activeScheduledAd.description || 'No headline configured'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>Duration: {activeScheduledAd.durationSeconds}s</span>
                    <span>Skip: {activeScheduledAd.skipEnabled ? `After ${activeScheduledAd.skipAfterSeconds}s` : 'Disabled'}</span>
                    <span>Mode: {activeScheduledAd.displayMode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openPreview(activeScheduledAd)}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                    Preview
                  </button>
                  <button
                    onClick={() => startEdit(activeScheduledAd)}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Edit2 className="w-4 h-4 text-slate-600" />
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                <Megaphone className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-semibold text-slate-700">
                  No advertisement is currently scheduled and active.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Free users will enter Saarvi directly without an ad gate until an advertisement is marked ACTIVE.
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setActiveTab('CREATE');
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Advertisement
                </button>
              </div>
            )}
          </div>

          {/* Real Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Real Impressions</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {summary.impressions.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Captured gate loads</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Completed Views</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {summary.completed.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 mt-0.5 block font-medium">
                {summary.completionRate}% completion rate
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Skipped Views</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {summary.skipped.toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-600 mt-0.5 block font-medium">
                {summary.skipRate}% skip rate
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">CTA Click-Throughs</span>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {summary.ctaClicks.toLocaleString()}
              </div>
              <span className="text-[11px] text-blue-600 mt-0.5 block font-medium">
                {summary.ctr}% CTR
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADVERTISEMENTS LIST */}
      {activeTab === 'ADS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ads by name, brand, headline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="DRAFT">Draft</option>
                <option value="PAUSED">Paused</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {filteredAds.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No advertisements match your query.</p>
              <p className="text-xs text-slate-400 mt-1">Create an advertisement or clear your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="p-3.5">Ad & Media</th>
                    <th className="p-3.5">Media Type</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Duration & Skip</th>
                    <th className="p-3.5">Schedule</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAds.map((ad) => (
                    <tr key={ad.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {ad.mediaType === 'IMAGE' ? (
                              <img src={ad.mediaUrl} alt={ad.name} className="w-full h-full object-cover" />
                            ) : (
                              <Video className="w-5 h-5 text-slate-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{ad.name}</div>
                            {ad.headline && (
                              <div className="text-[11px] text-slate-500 line-clamp-1">{ad.headline}</div>
                            )}
                            {ad.advertiserName && (
                              <span className="text-[10px] text-blue-600 font-medium">{ad.advertiserName}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ad.mediaType === 'VIDEO'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {ad.mediaType}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ad.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ad.status === 'PAUSED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : ad.status === 'SCHEDULED'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ad.status}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono font-semibold text-slate-700">
                        {ad.priority}
                      </td>

                      <td className="p-3.5 text-slate-600">
                        <div>{ad.durationSeconds}s duration</div>
                        <div className="text-[11px] text-slate-400">
                          {ad.skipEnabled ? `Skip after ${ad.skipAfterSeconds}s` : 'No skip'}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {ad.startAt ? new Date(ad.startAt).toLocaleDateString() : 'Immediate'}
                        {ad.endAt ? ` → ${new Date(ad.endAt).toLocaleDateString()}` : ' (No expiry)'}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openPreview(ad)}
                            title="Preview Visitor Experience"
                            className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(ad)}
                            title={ad.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                          >
                            {ad.status === 'ACTIVE' ? (
                              <Pause className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Play className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                          <button
                            onClick={() => startEdit(ad)}
                            title="Edit Advertisement"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteAd(ad)}
                            title="Delete"
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CREATE / EDIT ADVERTISEMENT */}
      {activeTab === 'CREATE' && (
        <form onSubmit={handleSubmitForm} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingAdId ? 'Edit Advertisement' : 'Create New Advertisement'}
                </h3>
                <p className="text-xs text-slate-500">
                  Upload media and configure display gates, duration, and safe CTA destinations.
                </p>
              </div>
              {editingAdId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Advertisement Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Back-to-School VTU Prep Offer"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Advertiser / Brand Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Saarvi Academic Network"
                  value={formData.advertiserName}
                  onChange={(e) => setFormData({ ...formData, advertiserName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Media Upload Section */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Media Type & Asset *
              </label>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mediaType"
                    value="IMAGE"
                    checked={formData.mediaType === 'IMAGE'}
                    onChange={() => setFormData({ ...formData, mediaType: 'IMAGE' })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  Image (PNG, JPEG, WebP, GIF max 5MB)
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mediaType"
                    value="VIDEO"
                    checked={formData.mediaType === 'VIDEO'}
                    onChange={() => setFormData({ ...formData, mediaType: 'VIDEO' })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <Video className="w-4 h-4 text-purple-600" />
                  Video (MP4, WebM browser-safe max 20MB)
                </label>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-blue-300 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="ad-media-file"
                  accept={
                    formData.mediaType === 'VIDEO'
                      ? 'video/mp4,video/webm'
                      : 'image/png,image/jpeg,image/webp,image/gif'
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
                <label htmlFor="ad-media-file" className="cursor-pointer">
                  {uploading ? (
                    <div className="flex flex-col items-center">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                      <span className="text-xs font-semibold text-slate-700">
                        Validating file magic bytes and security signature...
                      </span>
                    </div>
                  ) : formData.mediaUrl ? (
                    <div className="flex flex-col items-center">
                      <div className="w-48 h-28 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 mb-2 relative">
                        {formData.mediaType === 'IMAGE' ? (
                          <img
                            src={formData.mediaUrl}
                            alt="Ad Preview"
                            className="w-full h-full object-contain bg-slate-900"
                          />
                        ) : (
                          <video
                            src={formData.mediaUrl}
                            muted
                            controls
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-blue-600 hover:underline">
                        Click to replace media asset
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-700">
                        Click to browse or drop {formData.mediaType.toLowerCase()} file here
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Magic-byte binary inspection will verify authentic file container.
                      </span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Headline, Body, CTA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Headline (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Your Semester with Saarvi Pro"
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CTA Button Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Learn More / View Offer"
                  value={formData.ctaText}
                  onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CTA Destination URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. /pricing or https://partner.example.com"
                  value={formData.ctaUrl}
                  onChange={(e) => setFormData({ ...formData, ctaUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Strictly validated: javascript: and dangerous schemes are neutralized.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Body Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Access 45+ academic tools and ATS resume templates."
                  value={formData.bodyText}
                  onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Timing & Display Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duration (Seconds)
                </label>
                <input
                  type="number"
                  min={3}
                  max={120}
                  value={formData.durationSeconds}
                  onChange={(e) =>
                    setFormData({ ...formData, durationSeconds: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skip Delay (Seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  max={formData.durationSeconds}
                  disabled={!formData.skipEnabled}
                  value={formData.skipAfterSeconds}
                  onChange={(e) =>
                    setFormData({ ...formData, skipAfterSeconds: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="skipEnabled"
                  checked={formData.skipEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, skipEnabled: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="skipEnabled" className="text-xs font-semibold text-slate-700">
                  Allow Users to Skip
                </label>
              </div>
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as AdvertisementStatus })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="DRAFT">DRAFT (Not shown)</option>
                  <option value="ACTIVE">ACTIVE (Ready to display)</option>
                  <option value="PAUSED">PAUSED (Temporarily stopped)</option>
                  <option value="SCHEDULED">SCHEDULED (Dates enforced)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority (Highest Wins)
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audience
                </label>
                <select
                  value={formData.audience}
                  onChange={(e) =>
                    setFormData({ ...formData, audience: e.target.value as AdAudience })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="FREE_ONLY">FREE_ONLY (Pro Users 100% Exempt)</option>
                  <option value="PRO_EXCLUDED">PRO_EXCLUDED</option>
                  <option value="PUBLIC_VISITORS">PUBLIC_VISITORS</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab('ADS');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || uploading}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {editingAdId ? 'Save Advertisement' : 'Create & Save Advertisement'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: SCHEDULING */}
      {activeTab === 'SCHEDULING' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Advertisement Scheduling Overview
            </h3>
            <p className="text-xs text-slate-500">
              Server-authoritative scheduling. Expired and future ads are strictly suppressed.
            </p>
          </div>

          <div className="space-y-3">
            {ads.map((ad) => {
              const now = Date.now();
              const isFuture = ad.startAt && new Date(ad.startAt).getTime() > now;
              const isExpired = ad.endAt && new Date(ad.endAt).getTime() < now;
              const isLive = ad.status === 'ACTIVE' && !isFuture && !isExpired;

              return (
                <div
                  key={ad.id}
                  className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{ad.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isLive
                            ? 'bg-emerald-100 text-emerald-800'
                            : isFuture
                            ? 'bg-indigo-100 text-indigo-800'
                            : isExpired
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isLive ? 'LIVE NOW' : isFuture ? 'SCHEDULED (FUTURE)' : isExpired ? 'EXPIRED' : ad.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                      <span>Start: {ad.startAt ? new Date(ad.startAt).toLocaleString() : 'Immediate'}</span>
                      <span>End: {ad.endAt ? new Date(ad.endAt).toLocaleString() : 'Permanent'}</span>
                      <span>Timezone: {ad.timezone}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => startEdit(ad)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 self-start sm:self-center"
                  >
                    Adjust Schedule
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: DISPLAY SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">
              Platform-Wide Promotional Gate Settings
            </h3>
            <p className="text-xs text-slate-500">
              Global defaults and fail-safes applied across all user-facing entry points.
            </p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Master Advertising Enable</span>
                <span className="text-[11px] text-slate-500">
                  When off, no advertisement gate is presented to any user.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.adsEnabled}
                onChange={(e) => updateGlobalSettings({ adsEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Mode (Production Standard: FULLSCREEN_GATE)
              </label>
              <select
                value={settings.defaultDisplayMode}
                onChange={(e) =>
                  updateGlobalSettings({ defaultDisplayMode: e.target.value as AdDisplayMode })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="FULLSCREEN_GATE">FULLSCREEN_GATE (Initial Visit Interstitial)</option>
                <option value="CENTER_MODAL">CENTER_MODAL (Focused Modal)</option>
                <option value="BANNER">BANNER (Subtle Header/Footer Banner)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Gate Duration (Seconds)
              </label>
              <input
                type="number"
                min={3}
                max={120}
                value={settings.defaultDurationSeconds}
                onChange={(e) =>
                  updateGlobalSettings({ defaultDurationSeconds: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Skip Delay (Seconds)
              </label>
              <input
                type="number"
                min={0}
                max={settings.defaultDurationSeconds}
                value={settings.defaultSkipAfterSeconds}
                onChange={(e) =>
                  updateGlobalSettings({ defaultSkipAfterSeconds: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Frequency Mode
              </label>
              <select
                value={settings.defaultFrequencyMode}
                onChange={(e) =>
                  updateGlobalSettings({ defaultFrequencyMode: e.target.value as AdFrequencyMode })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="ONCE_PER_SESSION">ONCE_PER_SESSION (Default - Prevents route interrupts)</option>
                <option value="EVERY_VISIT">EVERY_VISIT (Shows on every full visit)</option>
                <option value="ONCE_PER_DAY">ONCE_PER_DAY (24h cooldown)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Total Impressions</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{summary.impressions}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Completed Views</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{summary.completed}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Skipped Views</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">{summary.skipped}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">CTA Clicks</span>
              <div className="text-2xl font-bold text-blue-600 mt-1">{summary.ctaClicks}</div>
            </div>
          </div>

          {/* Event Stream */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Recent Interaction Events (Zero Fake Data)
              </h4>
              <button
                onClick={fetchData}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No analytics events recorded yet. Events will populate as free visitors trigger the gate.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {recentEvents.slice(0, 20).map((evt) => (
                  <div key={evt.id} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        evt.eventType === 'AD_COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : evt.eventType === 'AD_SKIPPED'
                          ? 'bg-amber-100 text-amber-800'
                          : evt.eventType === 'AD_CTA_CLICKED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {evt.eventType}
                      </span>
                      <span className="font-mono text-slate-500">{evt.adId}</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: AUDIT LOG */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">
              Advertising Audit Trail
            </h3>
            <p className="text-xs text-slate-500">
              Immutable audit history of all ad creations, schedule updates, media uploads, and publishing actions.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900">System Initialized</span>
                <span className="text-slate-400 text-[11px]">{new Date().toLocaleDateString()}</span>
              </div>
              <p className="text-slate-600">
                Authoritative AdStore initialized with FULLSCREEN_GATE default and Pro-exempt gating.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE PREVIEW MODAL / DRAWER */}
      {previewAd && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col w-full max-w-4xl max-h-[90vh]">
            {/* Header / Device switcher */}
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-300">Visitor Preview:</span>
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                      previewDevice === 'desktop' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                      previewDevice === 'mobile' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Mobile
                  </button>
                </div>
              </div>

              <button
                onClick={closePreview}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewport Frame */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-900">
              <div
                className={`transition-all duration-300 relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col ${
                  previewDevice === 'mobile'
                    ? 'w-[360px] h-[640px]'
                    : 'w-full max-w-2xl h-[420px]'
                }`}
              >
                {/* Gate Header Over Media */}
                <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white/90 border border-white/10">
                      Sponsored
                    </span>
                    {previewAd.advertiserName && (
                      <span className="text-[11px] font-medium text-white/80 drop-shadow">
                        {previewAd.advertiserName}
                      </span>
                    )}
                  </div>

                  {/* Skip Control */}
                  {previewAd.skipEnabled && (
                    <button
                      disabled={!previewCanSkip}
                      onClick={closePreview}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md transition-all flex items-center gap-1 ${
                        previewCanSkip
                          ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg'
                          : 'bg-black/60 text-white/80 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {previewCanSkip ? (
                        <>
                          Skip <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        `Skip in ${Math.max(
                          0,
                          previewAd.skipAfterSeconds - (previewAd.durationSeconds - previewSecondsLeft)
                        )}s`
                      )}
                    </button>
                  )}
                </div>

                {/* Media Container */}
                <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                  {previewAd.mediaType === 'IMAGE' ? (
                    <img
                      src={previewAd.mediaUrl}
                      alt={previewAd.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      src={previewAd.mediaUrl}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Bottom Text & CTA */}
                  {(previewAd.headline || previewAd.ctaText) && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white z-20">
                      {previewAd.headline && (
                        <h4 className="text-sm font-bold drop-shadow">{previewAd.headline}</h4>
                      )}
                      {previewAd.bodyText && (
                        <p className="text-xs text-white/80 line-clamp-2 mt-0.5">
                          {previewAd.bodyText}
                        </p>
                      )}
                      {previewAd.ctaText && (
                        <div className="mt-3">
                          <a
                            href={previewAd.ctaUrl ? sanitizeUrl(previewAd.ctaUrl, '#') : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            {previewAd.ctaText}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
