"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  Search,
  ExternalLink,
  LogOut,
  ChevronDown,
  Shield,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AdminSearchModal from './AdminSearchModal';

interface AdminHeaderProps {
  onToggleMobileMenu: () => void;
}

export default function AdminHeader({ onToggleMobileMenu }: AdminHeaderProps) {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const getSectionTitle = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 1 && parts[0] === 'admin') return 'Overview';
    const sub = parts[1];
    if (!sub) return 'Overview';
    return sub
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Left: Mobile hamburger + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs">
            <Link href="/admin" className="font-semibold text-slate-500 hover:text-blue-600 transition-colors">
              Admin
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">{getSectionTitle()}</span>
          </div>
        </div>

        {/* Right Actions: Search button, Status pill, Public Site link, User menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Search shortcut */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs transition-colors cursor-pointer"
            aria-label="Search admin resources"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Search platform</span>
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 bg-white border border-slate-200 rounded text-slate-400">
              ⌘K
            </kbd>
          </button>

          {/* System status pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Healthy</span>
          </div>

          {/* Return to Public Site */}
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3 h-3 text-slate-400" />
            <span>Public Site</span>
          </Link>

          {/* Admin User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {profile?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-left text-xs leading-tight">
                <div className="font-semibold text-slate-900 truncate max-w-[100px]">
                  {profile?.fullName || 'Admin'}
                </div>
                <div className="text-[10px] text-blue-600 font-medium">
                  {profile?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 text-xs z-50 animate-in fade-in duration-100"
                onClick={() => setUserDropdownOpen(false)}
              >
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <div className="font-semibold text-slate-900 truncate">{profile?.fullName}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{user?.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                    <Shield className="w-3 h-3" />
                    {profile?.role}
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <span>Student Workspace</span>
                </Link>

                <button
                  onClick={handleSignOut}
                  className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <AdminSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
