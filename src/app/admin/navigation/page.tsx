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
  Laptop,
  Tablet,
  Smartphone,
  History,
  Send,
  Save,
  Trash2,
  Edit2,
  GripVertical,
  ExternalLink,
  Globe,
  Sliders,
  Home,
  Lock,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NavigationConfigItem, NavigationStatus, CategoryConfigItem } from '@/lib/navigation/navigation-store';
import { CANONICAL_TOOL_REGISTRY } from '@/lib/tools/tool-registry';
import { SmartNavigationSnapshot } from '@/lib/navigation/tool-discovery-service';
import {
  NavigationItem,
  NavigationVersion,
  NavigationValidationError,
  DEFAULT_NAVIGATION_ITEMS,
  RESERVED_SYSTEM_KEYS,
} from '@/lib/navigation/navigation-service';

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

  // ── Dynamic Navbar 7.0 State ──────────────────────────────────────────────
  const [adminTab, setAdminTab] = useState<'navbar' | 'megamenu'>('navbar');
  const [navbarDraft, setNavbarDraft] = useState<NavigationItem[]>(DEFAULT_NAVIGATION_ITEMS);
  const [navbarVersions, setNavbarVersions] = useState<NavigationVersion[]>([]);
  const [navbarValidation, setNavbarValidation] = useState<{ valid: boolean; errors: NavigationValidationError[] }>({ valid: true, errors: [] });
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [navbarItemModalOpen, setNavbarItemModalOpen] = useState(false);
  const [editingNavbarItem, setEditingNavbarItem] = useState<NavigationItem | null>(null);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Form state for Navbar Item
  const [itemLabel, setItemLabel] = useState('');
  const [itemRoute, setItemRoute] = useState('');
  const [itemIcon, setItemIcon] = useState('FileText');
  const [itemAudience, setItemAudience] = useState<'ALL' | 'AUTHENTICATED' | 'FREE' | 'PRO' | 'ADMIN'>('ALL');
  const [itemDesktop, setItemDesktop] = useState(true);
  const [itemMobile, setItemMobile] = useState(true);
  const [itemNewTab, setItemNewTab] = useState(false);
  const [itemFeatureFlag, setItemFeatureFlag] = useState('');
  const [itemExternalUrl, setItemExternalUrl] = useState('');

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
        if (Array.isArray(data.draft)) setNavbarDraft(data.draft);
        if (Array.isArray(data.versions)) setNavbarVersions(data.versions);
        if (data.validation) setNavbarValidation(data.validation);
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

  const validateLocalDraft = (draftList: NavigationItem[]) => {
    const errors: NavigationValidationError[] = [];
    const seenLabels = new Set<string>();
    const seenRoutes = new Set<string>();
    let desktopCount = 0;

    for (const item of draftList) {
      if (!item.enabled) continue;
      const normLabel = item.label.trim().toLowerCase();
      if (seenLabels.has(normLabel)) {
        errors.push({
          itemKey: item.key,
          field: 'label',
          message: `Duplicate navbar label "${item.label}".`,
          severity: 'error',
        });
      }
      seenLabels.add(normLabel);

      const normRoute = item.route.trim().toLowerCase();
      if (seenRoutes.has(normRoute) && normRoute !== '#') {
        errors.push({
          itemKey: item.key,
          field: 'route',
          message: `Duplicate route "${item.route}".`,
          severity: 'error',
        });
      }
      seenRoutes.add(normRoute);

      const checkUrl = item.external_url || item.route;
      if (/^(javascript|data|file|vbscript):/i.test(checkUrl)) {
        errors.push({
          itemKey: item.key,
          field: 'route',
          message: `Disallowed URL scheme in "${checkUrl}".`,
          severity: 'error',
        });
      }

      if (!item.external_url && !item.route.startsWith('/') && item.route !== '#') {
        errors.push({
          itemKey: item.key,
          field: 'route',
          message: `Route "${item.route}" must start with a leading slash.`,
          severity: 'error',
        });
      }

      if (item.visible_desktop) desktopCount++;
    }

    if (desktopCount > 7) {
      errors.push({
        message: `${desktopCount} desktop items may overflow horizontally on smaller screens.`,
        severity: 'warning',
      });
    }

    setNavbarValidation({
      valid: !errors.some((e) => e.severity === 'error'),
      errors,
    });
  };

  const handleMoveNavbarItem = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= navbarDraft.length) return;
    const copy = [...navbarDraft];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    copy.forEach((it, idx) => { it.order_index = idx; });
    setNavbarDraft(copy);
    validateLocalDraft(copy);
  };

  const handleToggleNavbarItem = (index: number) => {
    const copy = [...navbarDraft];
    copy[index].enabled = !copy[index].enabled;
    setNavbarDraft(copy);
    validateLocalDraft(copy);
  };

  const handleDeleteNavbarItem = (index: number) => {
    const item = navbarDraft[index];
    if (item.is_system || RESERVED_SYSTEM_KEYS.has(item.key)) {
      alert(`Cannot delete reserved system component "${item.label}".`);
      return;
    }
    const copy = navbarDraft.filter((_, idx) => idx !== index);
    copy.forEach((it, idx) => { it.order_index = idx; });
    setNavbarDraft(copy);
    validateLocalDraft(copy);
  };

  const handleOpenAddNavbarItem = () => {
    setEditingNavbarItem(null);
    setItemLabel('');
    setItemRoute('');
    setItemIcon('FileText');
    setItemAudience('ALL');
    setItemDesktop(true);
    setItemMobile(true);
    setItemNewTab(false);
    setItemFeatureFlag('');
    setItemExternalUrl('');
    setNavbarItemModalOpen(true);
  };

  const handleOpenEditNavbarItem = (item: NavigationItem) => {
    setEditingNavbarItem(item);
    setItemLabel(item.label);
    setItemRoute(item.route);
    setItemIcon(item.icon || 'FileText');
    setItemAudience(item.audience || 'ALL');
    setItemDesktop(item.visible_desktop);
    setItemMobile(item.visible_mobile);
    setItemNewTab(item.open_behavior === 'new_tab');
    setItemFeatureFlag(item.feature_flag || '');
    setItemExternalUrl(item.external_url || '');
    setNavbarItemModalOpen(true);
  };

  const handleSaveNavbarItemModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemLabel.trim() || !itemRoute.trim()) {
      alert('Label and Route are required');
      return;
    }

    if (editingNavbarItem) {
      const copy = navbarDraft.map((it) => {
        if (it.id === editingNavbarItem.id) {
          return {
            ...it,
            label: itemLabel.trim(),
            route: itemRoute.trim(),
            icon: itemIcon,
            audience: itemAudience,
            visible_desktop: itemDesktop,
            visible_mobile: itemMobile,
            open_behavior: itemNewTab ? ('new_tab' as const) : ('same_tab' as const),
            feature_flag: itemFeatureFlag.trim() || null,
            external_url: itemExternalUrl.trim() || null,
          };
        }
        return it;
      });
      setNavbarDraft(copy);
      validateLocalDraft(copy);
    } else {
      const key = itemLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `item-${Date.now()}`;
      const newItem: NavigationItem = {
        id: `nav-${key}-${Date.now()}`,
        key,
        label: itemLabel.trim(),
        route: itemRoute.trim(),
        icon: itemIcon,
        order_index: navbarDraft.length,
        enabled: true,
        visible_desktop: itemDesktop,
        visible_mobile: itemMobile,
        open_behavior: itemNewTab ? 'new_tab' : 'same_tab',
        is_system: false,
        audience: itemAudience,
        feature_flag: itemFeatureFlag.trim() || null,
        external_url: itemExternalUrl.trim() || null,
      };
      const copy = [...navbarDraft, newItem];
      setNavbarDraft(copy);
      validateLocalDraft(copy);
    }

    setNavbarItemModalOpen(false);
  };

  const handleSaveNavbarDraft = async () => {
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_draft', items: navbarDraft }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Draft navigation saved successfully.');
        loadNavigation();
      } else {
        alert(data.error || 'Failed to save draft');
      }
    } catch (e: any) {
      alert(e.message || 'Save failed');
    }
  };

  const handlePublishNavbar = async () => {
    if (!navbarValidation.valid) {
      alert('Cannot publish while critical validation errors exist. Please resolve them first.');
      return;
    }
    setIsPublishing(true);
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', notes: publishNotes }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Navbar configuration published live to all users!');
        setPublishNotes('');
        loadNavigation();
      } else {
        alert(data.error || 'Failed to publish navbar');
      }
    } catch (e: any) {
      alert(e.message || 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRollbackNavbar = async (version: number) => {
    if (!confirm(`Are you sure you want to rollback navbar to version ${version}?`)) return;
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', version }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Rolled back to version ${version}`);
        setRollbackModalOpen(false);
        loadNavigation();
      } else {
        alert(data.error || 'Rollback failed');
      }
    } catch (e: any) {
      alert(e.message || 'Rollback failed');
    }
  };

  const handleResetNavbarDefaults = async () => {
    if (!confirm('Reset navbar configuration to standard default (Home, Tools, Jobs, Plans)?')) return;
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_navbar' }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Reset navbar draft to defaults.');
        loadNavigation();
      }
    } catch {}
  };

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

      {/* Dynamic 7.0 Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setAdminTab('navbar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            adminTab === 'navbar'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Dynamic Top Navbar 7.0 (Structure, Reorder &amp; Publish)</span>
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('megamenu')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            adminTab === 'megamenu'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Smart Tool MegaMenu (Telemetry &amp; Categories)</span>
        </button>
      </div>

      {adminTab === 'navbar' && (
        <div className="space-y-6">
          {/* Section A: Live Responsive Navbar Preview */}
          <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-blue-400" />
                  <span>Live Interactive Navbar Preview</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  See how the navbar looks to users before publishing. Test desktop, tablet, and mobile layouts.
                </p>
              </div>

              {/* Device Selector */}
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Desktop (100%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    previewDevice === 'tablet' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span>Tablet (768px)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile (375px)</span>
                </button>
              </div>
            </div>

            {/* Mock Viewport Container */}
            <div className="flex justify-center p-4 bg-slate-950/60 rounded-2xl border border-white/5 overflow-x-auto">
              <div
                className={`transition-all duration-300 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 text-slate-900 ${
                  previewDevice === 'mobile'
                    ? 'w-[375px]'
                    : previewDevice === 'tablet'
                    ? 'w-[768px]'
                    : 'w-full max-w-5xl'
                }`}
              >
                {/* Mock Browser Header */}
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <span>https://saarvi.org</span>
                  <span>{previewDevice.toUpperCase()}</span>
                </div>

                {/* Rendered Navbar */}
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  {/* Brand */}
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                      S
                    </div>
                    <span>Saarvi</span>
                  </div>

                  {/* Desktop / Tablet Links */}
                  {previewDevice !== 'mobile' && (
                    <div className="flex items-center gap-1.5">
                      {navbarDraft
                        .filter((item) => item.enabled && item.visible_desktop)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer border border-transparent hover:border-slate-200"
                          >
                            <span>{item.label}</span>
                            {item.audience !== 'ALL' && (
                              <span className="text-[9px] px-1 py-0.2 bg-blue-100 text-blue-800 rounded font-bold">
                                {item.audience}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Actions (Search, Notification, Profile) */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-xs">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-xs">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      A
                    </div>
                  </div>
                </div>

                {/* Mobile Drawer representation when previewDevice === 'mobile' */}
                {previewDevice === 'mobile' && (
                  <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 mb-1">
                      Mobile Menu Drawer Preview
                    </span>
                    {navbarDraft
                      .filter((item) => item.enabled && item.visible_mobile)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="px-3 py-2 rounded-xl text-xs font-medium text-slate-800 bg-white border border-slate-200/80 flex items-center justify-between"
                        >
                          <span className="font-semibold">{item.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.route}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section B: Validation Status Banner */}
          <div>
            {!navbarValidation.valid ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-red-800">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Validation Blockers ({navbarValidation.errors.filter((e) => e.severity === 'error').length})</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 pt-1">
                  {navbarValidation.errors
                    .filter((e) => e.severity === 'error')
                    .map((err, idx) => (
                      <li key={idx}>{err.message}</li>
                    ))}
                </ul>
              </div>
            ) : navbarValidation.errors.length > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>Validation Warnings ({navbarValidation.errors.length})</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 pt-1">
                  {navbarValidation.errors.map((err, idx) => (
                    <li key={idx}>{err.message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Configuration Valid: Safe to publish to live navbar.</span>
              </div>
            )}
          </div>

          {/* Section C: Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleOpenAddNavbarItem}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Navbar Item</span>
              </button>
              <button
                type="button"
                onClick={handleSaveNavbarDraft}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setRollbackModalOpen(true)}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>Version History &amp; Rollback ({navbarVersions.length})</span>
              </button>
              <button
                type="button"
                onClick={handleResetNavbarDefaults}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Standard</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Publish release notes..."
                value={publishNotes}
                onChange={(e) => setPublishNotes(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handlePublishNavbar}
                disabled={!navbarValidation.valid || isPublishing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPublishing ? 'Publishing...' : 'Publish to Live'}</span>
              </button>
            </div>
          </div>

          {/* Section D: Navbar Items Reorder & Management Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Configured Navbar Items ({navbarDraft.length})
              </h4>
              <span className="text-xs text-slate-500">
                Use Move Up / Down to change display order
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {navbarDraft.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                    !item.enabled ? 'bg-slate-50/70 opacity-60' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Order controls */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveNavbarItem(index, 'up')}
                        className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === navbarDraft.length - 1}
                        onClick={() => handleMoveNavbarItem(index, 'down')}
                        className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs">
                      {index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{item.label}</span>
                        {item.is_system && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>System</span>
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                          {item.audience}
                        </span>
                        {item.feature_flag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-mono">
                            flag:{item.feature_flag}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {item.external_url ? (
                          <span className="text-blue-600 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {item.external_url}
                          </span>
                        ) : (
                          item.route
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggles & Actions */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mr-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${item.visible_desktop ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        Desktop: {item.visible_desktop ? 'Yes' : 'No'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${item.visible_mobile ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        Mobile: {item.visible_mobile ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {/* Enable Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleNavbarItem(index)}
                      className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                        item.enabled
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                      title={item.enabled ? 'Enabled' : 'Disabled'}
                    >
                      {item.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditNavbarItem(item)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={item.is_system || RESERVED_SYSTEM_KEYS.has(item.key)}
                      onClick={() => handleDeleteNavbarItem(index)}
                      className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={item.is_system ? 'System items cannot be deleted' : 'Delete Item'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adminTab === 'megamenu' && (
        <div className="space-y-6">
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
      )}

      {/* ========================================================================= */}
      {/* NAVBAR 7.0: ADD / EDIT NAVBAR ITEM MODAL                                  */}
      {/* ========================================================================= */}
      {navbarItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingNavbarItem ? `Edit Navbar Item: ${editingNavbarItem.label}` : 'Add Navbar Item'}
              </h3>
              <button
                type="button"
                onClick={() => setNavbarItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNavbarItemModal} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Navbar Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Careers, Student Hub, Blog"
                  value={itemLabel}
                  onChange={(e) => setItemLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Route *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. /jobs, /pricing, /student-tools"
                  value={itemRoute}
                  onChange={(e) => setItemRoute(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must start with a slash (/) for internal routes.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Audience</label>
                  <select
                    value={itemAudience}
                    onChange={(e: any) => setItemAudience(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="ALL">All Users</option>
                    <option value="AUTHENTICATED">Logged In Users</option>
                    <option value="FREE">Free Users</option>
                    <option value="PRO">Pro Subscribers</option>
                    <option value="ADMIN">Administrators</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Icon</label>
                  <select
                    value={itemIcon}
                    onChange={(e) => setItemIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="FileText">FileText</option>
                    <option value="Home">Home</option>
                    <option value="LayoutGrid">LayoutGrid</option>
                    <option value="Briefcase">Briefcase</option>
                    <option value="Sparkles">Sparkles</option>
                    <option value="GraduationCap">GraduationCap</option>
                    <option value="Compass">Compass</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Feature Flag (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. jobs_platform, ai_features"
                  value={itemFeatureFlag}
                  onChange={(e) => setItemFeatureFlag(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs focus:outline-hidden"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={itemDesktop}
                    onChange={(e) => setItemDesktop(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Visible on Desktop Navbar</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={itemMobile}
                    onChange={(e) => setItemMobile(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Visible in Mobile Drawer</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={itemNewTab}
                    onChange={(e) => setItemNewTab(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Open in New Tab</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNavbarItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NAVBAR 7.0: ROLLBACK & VERSION HISTORY MODAL                              */}
      {/* ========================================================================= */}
      {rollbackModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Published Version History &amp; Rollback</span>
              </h3>
              <button
                type="button"
                onClick={() => setRollbackModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {navbarVersions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">No previous versions found.</p>
                <p>Version history is automatically snapshotted every time you click &quot;Publish to Live&quot;.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 space-y-2">
                {navbarVersions.map((ver) => (
                  <div key={ver.id || ver.version_number} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>Version #{ver.version_number}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {new Date(ver.published_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        {ver.notes || `Published by ${ver.created_by || 'Admin'}`}
                      </p>
                      <span className="text-[10px] text-blue-600 font-semibold">
                        {(ver.items || []).length} navigation items
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRollbackNavbar(ver.version_number)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer"
                    >
                      Rollback
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRollbackModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
