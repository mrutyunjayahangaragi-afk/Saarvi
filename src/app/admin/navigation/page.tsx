"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Navigation,
  ArrowUpDown,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Layers,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Star,
  Search,
  RotateCcw,
  Sliders,
  Shield,
  Tag,
  Globe,
  Bot,
  Compass,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NavigationConfigItem, NavigationStatus } from '@/lib/navigation/navigation-store';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'pdf', label: 'PDF Tools' },
  { id: 'image', label: 'Image Tools' },
  { id: 'student', label: 'Student Suite' },
  { id: 'academic', label: 'Academic Suite' },
  { id: 'career', label: 'Career Suite' },
  { id: 'ai', label: 'AI Suite' },
];

export default function AdminNavigationPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NavigationConfigItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Load from Supabase via API
  const loadNavigation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/navigation');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
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

  const updateItemField = async (
    item: NavigationConfigItem,
    field: keyof NavigationConfigItem,
    value: any
  ) => {
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, [field]: value } : i))
    );
    setSavingItem(item.id);

    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: item.toolId,
          categoryId: item.categoryId,
          updates: { [field]: value },
          adminEmail: user?.email || 'admin@saarvi.in',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update item');
      }
      setSaveSuccessMessage(`Updated ${item.toolName}`);
      setTimeout(() => setSaveSuccessMessage(null), 2500);
    } catch (err) {
      console.error('Save failed:', err);
      // Revert on failure
      loadNavigation();
    } finally {
      setSavingItem(null);
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
          adminEmail: user?.email || 'admin@saarvi.in',
        }),
      });
    } catch (err) {
      console.error('Reorder error:', err);
      loadNavigation();
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all tool navigation, positions, and visibility to default canonical settings?')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', adminEmail: user?.email || 'admin@saarvi.in' }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
        setSaveSuccessMessage('Reset to canonical defaults successfully.');
        setTimeout(() => setSaveSuccessMessage(null), 3000);
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
            Dynamically configure tool positions, mega menus, search visibility, badges, and featured flags. Persisted in Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Controls Bar: Search & Category Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
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
                  <th className="py-3 px-3 text-center">Featured</th>
                  <th className="py-3 px-3">Badge</th>
                  <th className="py-3 px-3">Status</th>
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
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-slate-500 w-4 text-center">
                          {item.position + 1}
                        </span>
                        <button
                          onClick={() => moveItem(item, 'down')}
                          title="Move Down"
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
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
                        className={`p-1.5 rounded-lg border transition ${
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
                        className={`p-1.5 rounded-lg border transition ${
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
                        className={`p-1.5 rounded-lg border transition ${
                          item.visibleInSearch
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </td>

                    {/* Featured Toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => updateItemField(item, 'featured', !item.featured)}
                        title="Highlight as featured tool"
                        className={`p-1.5 rounded-lg border transition ${
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
                        className="w-24 text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
