"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Navigation,
  Eye,
  EyeOff,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Star,
  Search,
  RotateCcw,
  Compass,
  Plus,
  Bot,
  Settings2,
  X,
  AlertTriangle,
  Info,
  Layers,
  Flame,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
  FileImage,
  GraduationCap,
  Briefcase,
  Activity,
  BarChart2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NavigationConfigItem, NavigationStatus, CategoryConfigItem } from '@/lib/navigation/navigation-store';
import { CANONICAL_TOOL_REGISTRY } from '@/lib/tools/tool-registry';
import { SmartNavigationSnapshot } from '@/lib/navigation/tool-discovery-service';

const DEFAULT_CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'pdf', label: 'PDF Tools' },
  { id: 'image', label: 'Image Tools' },
  { id: 'student', label: 'Student Tools' },
  { id: 'academic', label: 'Academic Tools' },
  { id: 'career', label: 'Career Tools' },
  { id: 'ai', label: 'AI Tools' },
];

export default function AdminNavigationPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NavigationConfigItem[]>([]);
  const [categories, setCategories] = useState<CategoryConfigItem[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<SmartNavigationSnapshot | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Time Window State
  const [usageWindow, setUsageWindow] = useState<'7d' | '30d' | '90d'>('30d');
  const [activePreviewCategory, setActivePreviewCategory] = useState<'pdf' | 'images' | 'student' | 'tools'>('pdf');
  const [showNavbarPreview, setShowNavbarPreview] = useState(true);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Add Tool form state
  const [newToolId, setNewToolId] = useState(CANONICAL_TOOL_REGISTRY[0]?.key || '');
  const [newCategoryId, setNewCategoryId] = useState('pdf');
  const [newVisibleNavbar, setNewVisibleNavbar] = useState(true);
  const [newVisibleMegaMenu, setNewVisibleMegaMenu] = useState(true);
  const [newVisibleSearch, setNewVisibleSearch] = useState(true);
  const [newVisibleAI, setNewVisibleAI] = useState(true);
  const [newFeatured, setNewFeatured] = useState(false);
  const [newBadge, setNewBadge] = useState('');
  const [newStatus, setNewStatus] = useState<NavigationStatus>('ACTIVE');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Load from Supabase via API
  const loadNavigation = async (windowChoice?: string) => {
    setLoading(true);
    try {
      const activeWin = windowChoice || usageWindow;
      const res = await fetch(`/api/admin/navigation?window=${activeWin}`);
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (data.previewSnapshot) setPreviewSnapshot(data.previewSnapshot);
      }
    } catch (err) {
      console.error('Failed to load navigation configs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNavigation();
  }, [usageWindow]);

  const displayCategories = useMemo(() => {
    if (categories.length > 0) {
      return [{ id: 'all', label: 'All Categories' }, ...categories.map((c) => ({ id: c.id, label: c.label }))];
    }
    return DEFAULT_CATEGORIES;
  }, [categories]);

  // Build a lookup map of real usage metrics from the snapshot
  const telemetryLookup = useMemo(() => {
    const map = new Map<string, { uses: number; users: number; isMostUsed: boolean; isFeatured: boolean }>();
    if (!previewSnapshot) return map;

    previewSnapshot.categories.forEach((cat) => {
      (cat.allTools || cat.topTools || []).forEach((t) => {
        map.set(t.key, {
          uses: t.successfulUses,
          users: t.uniqueUsers,
          isMostUsed: t.isMostUsed,
          isFeatured: t.isFeatured,
        });
      });
    });
    return map;
  }, [previewSnapshot]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCat = selectedCategory === 'all' || item.categoryId === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        item.toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.toolId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.route.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const showNotification = (msg: string) => {
    setSaveSuccessMessage(msg);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const updateItemField = async (
    item: NavigationConfigItem,
    field: keyof NavigationConfigItem,
    value: any
  ) => {
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, [field]: value } : i))
    );

    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: item.toolId,
          categoryId: item.categoryId,
          updates: { [field]: value },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update item');
      }
      showNotification(`Updated ${item.toolName}`);
      loadNavigation(); // Refresh live preview
    } catch (err) {
      console.error('Save failed:', err);
      loadNavigation();
    }
  };

  const handleRemoveFromNavbar = async (item: NavigationConfigItem) => {
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_from_navbar',
          toolId: item.toolId,
          categoryId: item.categoryId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, visibleInNavbar: false } : i))
        );
        showNotification(`Removed ${item.toolName} from Navbar (Route still active)`);
        loadNavigation();
      }
    } catch (err) {
      console.error('Failed to remove from navbar:', err);
    }
  };

  const handleAddToolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToolId || !newCategoryId) return;

    setIsSubmittingAdd(true);
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_tool',
          toolId: newToolId,
          categoryId: newCategoryId,
          overrides: {
            visibleInNavbar: newVisibleNavbar,
            visibleInMegaMenu: newVisibleMegaMenu,
            visibleInSearch: newVisibleSearch,
            visibleInAI: newVisibleAI,
            featured: newFeatured,
            badge: newBadge.trim() || null,
            status: newStatus,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add tool to navigation');
      }

      showNotification(`Added ${newToolId} to ${newCategoryId}`);
      setAddModalOpen(false);
      await loadNavigation();
    } catch (err: any) {
      alert(err.message || 'Failed to add tool');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const moveItem = async (item: NavigationConfigItem, direction: 'up' | 'down') => {
    const categoryItems = items
      .filter((i) => i.categoryId === item.categoryId)
      .sort((a, b) => a.position - b.position);

    const index = categoryItems.findIndex((i) => i.id === item.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

    // Swap in array
    const reordered = [...categoryItems];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const orderedIds = reordered.map((i) => i.toolId);

    // Optimistic
    setItems((prev) => {
      const copy = [...prev];
      orderedIds.forEach((tid, pos) => {
        const found = copy.find((c) => c.toolId === tid && c.categoryId === item.categoryId);
        if (found) found.position = pos;
      });
      return copy.sort((a, b) => a.position - b.position);
    });

    try {
      await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          categoryId: item.categoryId,
          toolIdsInOrder: orderedIds,
        }),
      });
      loadNavigation();
    } catch (err) {
      console.error('Reorder error:', err);
      loadNavigation();
    }
  };

  const handleSetPlatformDefaultWindow = async (days: number) => {
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_window',
          windowDays: days,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Set platform ranking window to ${days} days.`);
        loadNavigation();
      }
    } catch (err) {
      console.error('Failed to set platform default window:', err);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all tool navigation, positions, and visibility to default canonical settings? This is persisted to Supabase.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
        showNotification('Reset to canonical defaults successfully.');
        loadNavigation();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Navigation className="w-5 h-5 text-indigo-600" />
            <span>Smart Navbar &amp; Tool Discovery Control Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Data-driven tool discovery ranking based on real completions (<code className="text-blue-600 font-mono">tool_completed, success=true</code>) with Admin Featured overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Usage Window Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Window:</span>
            <button
              onClick={() => setUsageWindow('7d')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                usageWindow === '7d' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setUsageWindow('30d')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                usageWindow === '30d' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30D (Default)
            </button>
            <button
              onClick={() => setUsageWindow('90d')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                usageWindow === '90d' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              90D
            </button>
          </div>

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tool</span>
          </button>

          <button
            onClick={() => setShowNavbarPreview(!showNavbarPreview)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span>{showNavbarPreview ? 'Hide Preview' : 'Show Preview'}</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INNOVATION: LIVE NAVBAR MEGA MENU PREVIEW                                */}
      {/* ========================================================================= */}
      {showNavbarPreview && previewSnapshot && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Live Navbar Mega Menu Preview</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                    Real Analytics Calibrated
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Exact mega menu representation as seen by users • Aggregated over {usageWindow.toUpperCase()} window
                </p>
              </div>
            </div>

            {/* Preview Category Tabs */}
            <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10 text-xs font-semibold">
              <button
                onClick={() => setActivePreviewCategory('pdf')}
                className={`px-3 py-1 rounded-lg transition ${
                  activePreviewCategory === 'pdf' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                PDF
              </button>
              <button
                onClick={() => setActivePreviewCategory('images')}
                className={`px-3 py-1 rounded-lg transition ${
                  activePreviewCategory === 'images' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Images
              </button>
              <button
                onClick={() => setActivePreviewCategory('student')}
                className={`px-3 py-1 rounded-lg transition ${
                  activePreviewCategory === 'student' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Student Tools
              </button>
              <button
                onClick={() => setActivePreviewCategory('tools')}
                className={`px-3 py-1 rounded-lg transition ${
                  activePreviewCategory === 'tools' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Tools (Global)
              </button>
            </div>
          </div>

          {/* Active Category Preview Card */}
          <div className="bg-white rounded-2xl p-5 text-slate-900 shadow-md">
            {activePreviewCategory === 'pdf' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Top PDF Tools</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                    View All PDF Tools →
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {previewSnapshot.categories
                    .find((c) => c.id === 'pdf')
                    ?.topTools.map((t) => (
                      <div key={t.key} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/70 transition space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{t.name}</span>
                          {t.isFeatured ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              Featured
                            </span>
                          ) : t.isMostUsed ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              Most Used
                            </span>
                          ) : t.requiresPro ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold">
                              PRO
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                        <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span>{t.successfulUses} uses</span>
                          <span>{t.uniqueUsers} users</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activePreviewCategory === 'images' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Top Image Tools</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                    View All Image Tools →
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {previewSnapshot.categories
                    .find((c) => c.id === 'images')
                    ?.topTools.map((t) => (
                      <div key={t.key} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/70 transition space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{t.name}</span>
                          {t.isFeatured ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              Featured
                            </span>
                          ) : t.isMostUsed ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              Most Used
                            </span>
                          ) : t.requiresPro ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold">
                              PRO
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                        <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span>{t.successfulUses} uses</span>
                          <span>{t.uniqueUsers} users</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activePreviewCategory === 'student' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Top Student Tools</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                    View All Student Tools →
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {previewSnapshot.categories
                    .find((c) => c.id === 'student')
                    ?.topTools.map((t) => (
                      <div key={t.key} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/70 transition space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{t.name}</span>
                          {t.isFeatured ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              Featured
                            </span>
                          ) : t.isMostUsed ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              Most Used
                            </span>
                          ) : t.requiresPro ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold">
                              PRO
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                        <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span>{t.successfulUses} uses</span>
                          <span>{t.uniqueUsers} users</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activePreviewCategory === 'tools' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-100 pb-1 block">PDF</span>
                  {previewSnapshot.globalTools.pdf.slice(0, 4).map((t) => (
                    <div key={t.key} className="p-2 rounded-lg bg-slate-50 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-700 truncate">{t.name}</span>
                      {t.isFeatured ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">Featured</span>
                      ) : t.isMostUsed ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 font-bold">Most Used</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-100 pb-1 block">Images</span>
                  {previewSnapshot.globalTools.images.slice(0, 4).map((t) => (
                    <div key={t.key} className="p-2 rounded-lg bg-slate-50 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-700 truncate">{t.name}</span>
                      {t.isFeatured ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">Featured</span>
                      ) : t.isMostUsed ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 font-bold">Most Used</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-100 pb-1 block">Student</span>
                  {previewSnapshot.globalTools.student.slice(0, 4).map((t) => (
                    <div key={t.key} className="p-2 rounded-lg bg-slate-50 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-700 truncate">{t.name}</span>
                      {t.isFeatured ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">Featured</span>
                      ) : t.isMostUsed ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 font-bold">Most Used</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-100 pb-1 block">Career</span>
                  {previewSnapshot.globalTools.career.slice(0, 4).map((t) => (
                    <div key={t.key} className="p-2 rounded-lg bg-slate-50 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-700 truncate">{t.name}</span>
                      {t.isFeatured ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">Featured</span>
                      ) : t.isMostUsed ? (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 font-bold">Most Used</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Controls Bar: Search & Category Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {displayCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools or routes..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />
        </div>
      </div>

      {/* Navigation Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading navigation configurations...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No navigation items match criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="py-3 px-3 w-16 text-center">Order</th>
                  <th className="py-3 px-4">Tool / Route</th>
                  <th className="py-3 px-3 text-center">Category</th>
                  <th className="py-3 px-3 text-center">Successful Uses</th>
                  <th className="py-3 px-3 text-center">Unique Users</th>
                  <th className="py-3 px-3 text-center">Featured</th>
                  <th className="py-3 px-3 text-center">Navbar</th>
                  <th className="py-3 px-3 text-center">Mega Menu</th>
                  <th className="py-3 px-3 text-center">Search</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const telemetry = telemetryLookup.get(item.toolId) || { uses: 0, users: 0, isMostUsed: false, isFeatured: false };

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition group"
                    >
                      {/* Position & Move */}
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => moveItem(item, 'up')}
                            title="Move Up"
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono text-slate-500 w-4 text-center">
                            {item.position + 1}
                          </span>
                          <button
                            onClick={() => moveItem(item, 'down')}
                            title="Move Down"
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Tool Name & Route */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{item.toolName}</span>
                          {item.featured && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                              Featured
                            </span>
                          )}
                          {!item.featured && telemetry.isMostUsed && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              Most Used
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {item.route}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                          {item.categoryId}
                        </span>
                      </td>

                      {/* Successful Uses */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {telemetry.uses.toLocaleString()}
                      </td>

                      {/* Unique Users */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {telemetry.users.toLocaleString()}
                      </td>

                      {/* Featured Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => updateItemField(item, 'featured', !item.featured)}
                          title="Toggle Admin Featured status (prominently displays tool)"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            item.featured
                              ? 'bg-purple-50 text-purple-600 border-purple-300'
                              : 'bg-slate-100 text-slate-300 border-slate-200'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${item.featured ? 'fill-current' : ''}`} />
                        </button>
                      </td>

                      {/* Navbar Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => updateItemField(item, 'visibleInNavbar', !item.visibleInNavbar)}
                          title="Toggle visibility in top navbar"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            item.visibleInNavbar
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          {item.visibleInNavbar ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* Mega Menu Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => updateItemField(item, 'visibleInMegaMenu', !item.visibleInMegaMenu)}
                          title="Toggle visibility in dropdown mega menus"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            item.visibleInMegaMenu
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          <Compass className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Search Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => updateItemField(item, 'visibleInSearch', !item.visibleInSearch)}
                          title="Toggle visibility in search and command bar"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            item.visibleInSearch
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3 px-3">
                        <select
                          value={item.status}
                          onChange={(e) => updateItemField(item, 'status', e.target.value as NavigationStatus)}
                          className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="NAVBAR_HIDDEN">Navbar Hidden</option>
                          <option value="MAINTENANCE">Maintenance</option>
                          <option value="DISABLED">Disabled</option>
                        </select>
                      </td>

                      {/* Actions: Remove / Add */}
                      <td className="py-3 px-3 text-right">
                        {item.visibleInNavbar ? (
                          <button
                            onClick={() => handleRemoveFromNavbar(item)}
                            className="px-2 py-1 rounded-lg text-[11px] text-red-600 hover:bg-red-50 font-medium transition cursor-pointer border border-red-100"
                            title="Remove from Nav"
                          >
                            Remove from Nav
                          </button>
                        ) : (
                          <button
                            onClick={() => updateItemField(item, 'visibleInNavbar', true)}
                            className="px-2 py-1 rounded-lg text-[11px] text-blue-600 hover:bg-blue-50 font-medium transition cursor-pointer border border-blue-100"
                            title="Add tool to top Navbar"
                          >
                            Show
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Add Tool to Navbar / Mega Menu */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add Existing Tool to Navigation</span>
              </h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddToolSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Registered Tool
                </label>
                <select
                  value={newToolId}
                  onChange={(e) => setNewToolId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {CANONICAL_TOOL_REGISTRY.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name} ({t.route})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Destination Category
                </label>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="pdf">PDF Tools</option>
                  <option value="image">Image Tools</option>
                  <option value="student">Student Tools</option>
                  <option value="academic">Academic Tools</option>
                  <option value="career">Career Tools</option>
                  <option value="ai">AI Tools</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newVisibleNavbar}
                    onChange={(e) => setNewVisibleNavbar(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Show in Navbar</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newVisibleMegaMenu}
                    onChange={(e) => setNewVisibleMegaMenu(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Show in Mega Menu</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFeatured}
                    onChange={(e) => setNewFeatured(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Featured Tool</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Adding...' : 'Add to Navigation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
