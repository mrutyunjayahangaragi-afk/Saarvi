"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PrivacyBadge, { PrivacyMode } from "@/components/common/PrivacyBadge";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import { LucideIcon, Lock, ChevronRight, RefreshCw } from "lucide-react";

export interface ToolPageShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  category?: {
    name: string;
    href: string;
  };
  privacyMode?: PrivacyMode;
  badge?: string;
  isDisabled?: boolean;
  isMaintenance?: boolean;
  requiresAuth?: boolean;
  requiresPro?: boolean;
  disabledMessage?: string;
  maintenanceMessage?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export default function ToolPageShell({
  title,
  description,
  icon: IconComponent,
  category = { name: "Tools", href: "/tools" },
  privacyMode,
  badge,
  isDisabled = false,
  isMaintenance = false,
  requiresAuth = false,
  requiresPro = false,
  disabledMessage,
  maintenanceMessage,
  maxWidthClass = "max-w-4xl",
  children,
}: ToolPageShellProps) {
  const { user, profile } = useAuth();
  const pathname = usePathname();

  const isPro = Boolean(
    profile?.role === "ADMIN" ||
    profile?.role === "SUPER_ADMIN" ||
    (user as any)?.plan === "PRO" ||
    (profile as any)?.isPro
  );

  const showAuthGate = requiresAuth && !user;
  const showProGate = requiresPro && !isPro;
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b1329] text-slate-900 dark:text-white font-sans antialiased">
      <Navbar />

      <main className={`flex-1 ${maxWidthClass} w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8`}>
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
          <Link href={category.href} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {category.name}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{title}</span>
        </nav>

        {/* Standardized Tool Header */}
        <header className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto shadow-xs">
            <IconComponent className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {privacyMode && <PrivacyBadge mode={privacyMode} />}
            {badge && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                {badge}
              </span>
            )}
          </div>
        </header>

        {/* Feature Flag Conditionals */}
        {isDisabled ? (
          <div className="p-8 rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {title} is Temporarily Unavailable
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {disabledMessage ||
                  "This tool has been temporarily disabled by platform administrators. Please check back soon or explore other available utilities."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={category.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              >
                <span>Browse Available Tools</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : isMaintenance ? (
          <div className="p-8 rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {title} Under Scheduled Maintenance
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {maintenanceMessage ||
                  "We are performing routine maintenance on this utility. It will be back online shortly."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={category.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              >
                <span>Browse Available Tools</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : showAuthGate ? (
          <div className="p-8 sm:p-10 rounded-3xl border border-blue-200/80 dark:border-blue-900/50 bg-white dark:bg-[#111c38] text-center space-y-5 shadow-sm max-w-md mx-auto my-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 flex items-center justify-center mx-auto shadow-2xs">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                Create a free Saarvi account to use this tool
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Sign up in seconds to access this utility, save your documents locally, and unlock personal workspace tools.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href={`/signup?next=${encodeURIComponent(pathname || category.href)}`}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Create account</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(pathname || category.href)}`}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center cursor-pointer"
              >
                Log in
              </Link>
            </div>
          </div>
        ) : showProGate ? (
          <div className="p-8 sm:p-10 rounded-3xl border border-indigo-200/80 dark:border-indigo-900/50 bg-white dark:bg-[#111c38] text-center space-y-5 shadow-sm max-w-md mx-auto my-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center mx-auto shadow-2xs">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                This feature is available with Saarvi Pro
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Upgrade your account to unlock advanced AI capabilities, higher file limits, and complete career suite features.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/pricing"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <span>Upgrade to Pro</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      <Footer />
    </div>
  );
}
