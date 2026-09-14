"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NavigationConfigItem, NavigationStatus, CategoryConfigItem } from '@/lib/navigation/navigation-store';
import { CANONICAL_TOOL_REGISTRY } from '@/lib/tools/tool-registry';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

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
  const loadNavigation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/navigation');
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.categories)) setCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to load navigation configs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNavigation();
  }, []);

  const displayCategories = useMemo(() => {
    if (categories.length > 0) {
      return [{ id: 'all', label: 'All Categories' }, ...categories.map((c) => ({ id: c.id, label: c.label }))];
    }
    return DEFAULT_CATEGORIES;
  }, [categories]);

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
    } catch (err) {
      console.error('Reorder error:', err);
      loadNavigation();
    }
  };

  const handleUpdateCategory = async (catId: string, updates: Partial<CategoryConfigItem>) => {
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_category',
          categoryId: catId,
          updates,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
        showNotification(`Updated category ${catId}`);
      }
    } catch (err) {
      console.error('Category update failed:', err);
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
            <span>Navbar & Tool Navigation Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Super Admin control center for Navbar, Mega Menu, Categories, and AI tool visibility. Persisted in Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tool to Navbar</span>
          </button>

          <button
            onClick={() => setCategoryModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manage Categories</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Persistence and Non-Destructive Invariant Callout */}
      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Non-Destructive Navigation Invariant:</span> Removing a tool from the Navbar or Mega Menu alters presentation only. The underlying tool route (e.g. <code className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200 text-[11px]">/tools/pdf-to-word</code>) remains fully operational and discoverable in Search/AI unless disabled via Feature Flags.
        </div>
      </div>

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
                  <th className="py-3 px-3 text-center">Navbar</th>
                  <th className="py-3 px-3 text-center">Mega Menu</th>
                  <th className="py-3 px-3 text-center">Search</th>
                  <th className="py-3 px-3 text-center">AI</th>
                  <th className="py-3 px-3 text-center">Featured</th>
                  <th className="py-3 px-3">Badge</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
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
                      <div className="font-semibold text-slate-900">
                        {item.toolName}
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

                    {/* AI Toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => updateItemField(item, 'visibleInAI', !item.visibleInAI)}
                        title="Toggle visibility in AI assistant tool recommendations"
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          item.visibleInAI
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </button>
                    </td>

                    {/* Featured Toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => updateItemField(item, 'featured', !item.featured)}
                        title="Highlight as featured tool"
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          item.featured
                            ? 'bg-amber-50 text-amber-600 border-amber-300'
                            : 'bg-slate-100 text-slate-300 border-slate-200'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${item.featured ? 'fill-current' : ''}`} />
                      </button>
                    </td>

                    {/* Badge Input */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        defaultValue={item.badge || ''}
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== item.badge) {
                            updateItemField(item, 'badge', val);
                          }
                        }}
                        placeholder="e.g. NEW, PRO"
                        className="w-20 text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      />
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

                    {/* Actions: Remove from Navbar */}
                    <td className="py-3 px-3 text-right">
                      {item.visibleInNavbar ? (
                        <button
                          onClick={() => handleRemoveFromNavbar(item)}
                          className="px-2 py-1 rounded-lg text-[11px] text-red-600 hover:bg-red-50 font-medium transition cursor-pointer border border-red-100"
                          title="Hide tool from top Navbar (retains tool functionality)"
                        >
                          Remove from Nav
                        </button>
                      ) : (
                        <button
                          onClick={() => updateItemField(item, 'visibleInNavbar', true)}
                          className="px-2 py-1 rounded-lg text-[11px] text-blue-600 hover:bg-blue-50 font-medium transition cursor-pointer border border-blue-100"
                          title="Add tool to top Navbar"
                        >
                          Add to Nav
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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
              {/* Tool Selector */}
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

              {/* Category */}
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

              {/* Toggles */}
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
                    checked={newVisibleSearch}
                    onChange={(e) => setNewVisibleSearch(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Show in Search</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newVisibleAI}
                    onChange={(e) => setNewVisibleAI(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Show in AI</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFeatured}
                    onChange={(e) => setNewFeatured(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Highlight as Featured</span>
                </label>
              </div>

              {/* Badge & Status */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Custom Badge (Optional)
                  </label>
                  <input
                    type="text"
                    value={newBadge}
                    onChange={(e) => setNewBadge(e.target.value)}
                    placeholder="e.g. NEW, PRO"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as NavigationStatus)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="NAVBAR_HIDDEN">Navbar Hidden</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAdd ? 'Saving...' : 'Add to Navigation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Category Management */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Category Management</span>
              </h2>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Customize the display names and visibility of top-level navigation categories. Internal IDs remain stable.
            </p>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 space-y-1">
                    <div className="font-mono text-[10px] text-slate-400 uppercase">
                      ID: {cat.id}
                    </div>
                    <input
                      type="text"
                      defaultValue={cat.label}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== cat.label) {
                          handleUpdateCategory(cat.id, { label: val });
                        }
                      }}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 text-xs"
                    />
                  </div>

                  <button
                    onClick={() => handleUpdateCategory(cat.id, { visible: !cat.visible })}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      cat.visible
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-200 text-slate-500 border-slate-300'
                    }`}
                    title={cat.visible ? 'Visible in navigation' : 'Hidden in navigation'}
                  >
                    {cat.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
