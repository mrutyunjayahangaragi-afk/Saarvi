"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, LogIn, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AdminGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] flex flex-col items-center justify-center p-6" role="status">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Verifying administrative credentials...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1329] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-100 dark:border-red-900/60">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Administrator Access Required</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              The Saarvi Admin Control Center is restricted to authorized platform administrators. You must be signed in with an administrative account.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Link
              href={`/login?returnTo=${encodeURIComponent(pathname)}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in as Admin
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white dark:bg-[#162244] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
