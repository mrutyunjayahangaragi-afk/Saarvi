"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Globe,
  Users,
  ShieldCheck,
  Wrench,
  GraduationCap,
  BookOpen,
  ToggleLeft,
  FileText,
  Bell,
  BarChart3,
  AlertTriangle,
  Activity,
  Lock,
  Search,
  History,
  Sliders,
  X,
  Sparkles,
  CreditCard,
  Megaphone,
  Navigation,
} from 'lucide-react';
import { SaarviMark } from '@/components/brand/SaarviLogo';
import { useAuth } from '@/context/AuthContext';

interface AdminSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  openErrorsCount?: number;
}

export default function AdminSidebar({
  mobileOpen,
  onCloseMobile,
  openErrorsCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Platform', href: '/admin/platform', icon: Globe },
    { label: 'Users', href: '/admin/users', icon: Users },
    {
      label: 'Admins & Roles',
      href: '/admin/admins',
      icon: ShieldCheck,
      badge: isSuperAdmin ? undefined : 'Super',
      locked: !isSuperAdmin,
    },
    { label: 'Tools', href: '/admin/tools', icon: Wrench },
    { label: 'Navigation & Tools', href: '/admin/navigation', icon: Navigation },
    { label: 'Student Tools', href: '/admin/student-tools', icon: GraduationCap },
    { label: 'Curriculum', href: '/admin/curriculum', icon: BookOpen },
    { label: 'Feature Flags', href: '/admin/features', icon: ToggleLeft },
    { label: 'Content', href: '/admin/content', icon: FileText },
    { label: 'Announcements', href: '/admin/announcements', icon: Bell },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Billing & Subscriptions', href: '/admin/billing', icon: CreditCard },
    { label: 'Advertising', href: '/admin/advertising', icon: Megaphone },
    {
      label: 'Errors',
      href: '/admin/errors',
      icon: AlertTriangle,
      badge: openErrorsCount > 0 ? `${openErrorsCount}` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    { label: 'System Health', href: '/admin/system', icon: Activity },
    { label: 'Security', href: '/admin/security', icon: Lock },
    { label: 'SEO', href: '/admin/seo', icon: Search },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: History },
    { label: 'Settings', href: '/admin/settings', icon: Sliders },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/90 w-64 select-none">
      {/* Platform Branding Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2.5 group">
          <SaarviMark size={32} className="group-hover:scale-105 transition-transform" />
          <div>
            <div className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Saarvi</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                Admin
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Control Center</div>
          </div>
        </Link>
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs">
        <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Operational Center
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    item.badgeColor || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer: Privacy Badge Indicator */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Local Workspace Privacy</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-normal">
          User documents, marks & resumes remain isolated on student devices.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Always Visible on lg+) */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-150"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
