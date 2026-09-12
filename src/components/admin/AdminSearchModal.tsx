"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  Wrench,
  BookOpen,
  Users,
  Bell,
  AlertTriangle,
  FileClock,
  Settings,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { TOOLS_CONFIG } from '@/config/tools';

interface AdminSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  title: string;
  category: string;
  route: string;
  icon: React.ElementType;
}

export default function AdminSearchModal({ isOpen, onClose }: AdminSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    } else {
      setQuery('');
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build searchable index of admin destinations and tools (strictly excluding private local user data)
  const systemItems: SearchItem[] = [
    { id: 'admin-overview', title: 'Admin Overview & System Status', category: 'Dashboard', route: '/admin', icon: Settings },
    { id: 'admin-platform', title: 'Platform Control & Maintenance Mode', category: 'Platform', route: '/admin/platform', icon: Settings },
    { id: 'admin-users', title: 'User Accounts & Verification State', category: 'Users', route: '/admin/users', icon: Users },
    { id: 'admin-admins', title: 'Administrators & Roles (SUPER_ADMIN)', category: 'Security', route: '/admin/admins', icon: Shield },
    { id: 'admin-tools', title: 'Tool Control Center & Limits', category: 'Tools', route: '/admin/tools', icon: Wrench },
    { id: 'admin-student-tools', title: 'Student Tools & Ordering', category: 'Student', route: '/admin/student-tools', icon: BookOpen },
    { id: 'admin-curriculum', title: 'VTU Curriculum Management (5-Stage Workflow)', category: 'Curriculum', route: '/admin/curriculum', icon: BookOpen },
    { id: 'admin-grading', title: 'VTU Grading Rules & Grade Points', category: 'Curriculum', route: '/admin/curriculum/grading', icon: BookOpen },
    { id: 'admin-features', title: 'Centralized Feature Flags', category: 'Features', route: '/admin/features', icon: Settings },
    { id: 'admin-content', title: 'Content & Homepage FAQ Management', category: 'Content', route: '/admin/content', icon: Settings },
    { id: 'admin-announcements', title: 'Announcements & Top Alert Banners', category: 'Announcements', route: '/admin/announcements', icon: Bell },
    { id: 'admin-analytics', title: 'Platform Analytics & Operational Metrics', category: 'Analytics', route: '/admin/analytics', icon: FileClock },
    { id: 'admin-errors', title: 'Error Monitoring & Diagnostics', category: 'Diagnostics', route: '/admin/errors', icon: AlertTriangle },
    { id: 'admin-system', title: 'System Health Probes', category: 'System', route: '/admin/system', icon: Settings },
    { id: 'admin-security', title: 'Security Posture & Sessions', category: 'Security', route: '/admin/security', icon: Shield },
    { id: 'admin-seo', title: 'SEO Metadata & Robots Indexing', category: 'SEO', route: '/admin/seo', icon: Settings },
    { id: 'admin-audit', title: 'Audit Logs (Append-Only Event Trail)', category: 'Audit', route: '/admin/audit-logs', icon: FileClock },
    { id: 'admin-settings', title: 'Platform Settings & Backup Export', category: 'Settings', route: '/admin/settings', icon: Settings },
  ];

  const toolItems: SearchItem[] = TOOLS_CONFIG.map((t) => ({
    id: `tool-${t.slug}`,
    title: `${t.name} (${t.category.toUpperCase()})`,
    category: 'Tools Configuration',
    route: `/admin/tools?search=${encodeURIComponent(t.slug)}`,
    icon: Wrench,
  }));

  const allItems = [...systemItems, ...toolItems];

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : systemItems.slice(0, 8);

  const handleSelect = (route: string) => {
    onClose();
    router.push(route);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, curriculum, users, announcements, errors, settings..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching administrative resources found for &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.route)}
                  className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-blue-50/60 hover:text-blue-900 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 text-slate-600 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500">{item.category}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0 ml-2" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Esc to close</span>
          <span className="text-emerald-700 font-medium">Privacy Safe: User local workspace data is never indexed</span>
        </div>
      </div>
    </div>
  );
}
