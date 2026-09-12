"use client";

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { adminService } from '@/lib/services/adminService';

interface NavItem {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  category: string;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'nav-tools', label: 'All Tools', href: '/tools', visible: true, category: 'Main Menu' },
  { id: 'nav-pdf', label: 'PDF Utilities', href: '/tools?category=pdf', visible: true, category: 'Mega Menu' },
  { id: 'nav-image', label: 'Image Tools', href: '/tools?category=image', visible: true, category: 'Mega Menu' },
  { id: 'nav-student', label: 'Student Workspace', href: '/student', visible: true, category: 'Main Menu' },
  { id: 'nav-calculators', label: 'VTU Academic Calculators', href: '/student#calculators', visible: true, category: 'Student Submenu' },
  { id: 'nav-about', label: 'About Saarvi', href: '/about', visible: true, category: 'Footer / Info' },
  { id: 'nav-contact', label: 'Contact Support', href: '/contact', visible: true, category: 'Footer / Info' },
  { id: 'nav-terms', label: 'Terms of Service', href: '/terms', visible: true, category: 'Footer / Info' },
  { id: 'nav-privacy', label: 'Privacy Policy', href: '/privacy', visible: true, category: 'Footer / Info' },
];

export default function AdminNavigationPage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<NavItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Load persisted navigation or default
    try {
      const stored = localStorage.getItem('saarvi_admin_navigation_v1') || localStorage.getItem('docease_admin_navigation_v1');
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        setItems(DEFAULT_NAV_ITEMS);
      }
    } catch {
      setItems(DEFAULT_NAV_ITEMS);
    }
  }, []);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setItems(newItems);
  };

  const toggleVisibility = (index: number) => {
    const newItems = [...items];
    newItems[index].visible = !newItems[index].visible;
    setItems(newItems);
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem('saarvi_admin_navigation_v1', JSON.stringify(items));
      if (user && profile) {
        adminService.getAuditLogs().then(() => {
          // Log audit entry
          adminService.updatePlatformSettings(
            {},
            { id: user.id, email: user.email, role: profile.role }
          );
        });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            <span>Navigation & Mega-Menu Control</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize navbar items, mega-menu sections, and visibility across desktop and mobile menus.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Navigation'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Navigation order and visibility saved successfully.</span>
        </div>
      )}

      {/* Navigation Reordering Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-xs font-bold text-slate-700">Navbar & Submenu Hierarchy</div>
          <div className="text-[11px] text-slate-500">Stable IDs • Zero Executable Payloads</div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`p-3.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                item.visible ? 'bg-white' : 'bg-slate-50/60 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 text-center font-mono text-[11px] text-slate-400 font-semibold">
                  #{index + 1}
                </span>

                <div className="min-w-0">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span>{item.label}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-md font-mono bg-slate-100 text-slate-600 font-medium border border-slate-200">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{item.href}</div>
                </div>
              </div>

              {/* Order and Visibility Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move Up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === items.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move Down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisibility(index)}
                  className={`p-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    item.visible
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  title={item.visible ? 'Hide from public menu' : 'Show in public menu'}
                >
                  {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{item.visible ? 'Visible' : 'Hidden'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
