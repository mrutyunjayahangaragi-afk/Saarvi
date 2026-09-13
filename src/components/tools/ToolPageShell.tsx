"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PrivacyBadge, { PrivacyMode } from "@/components/common/PrivacyBadge";
import { ChevronRight, Lock, RefreshCw, LucideIcon } from "lucide-react";

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
  disabledMessage,
  maintenanceMessage,
  maxWidthClass = "max-w-4xl",
  children,
}: ToolPageShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans antialiased">
      <Navbar />

      <main className={`flex-1 ${maxWidthClass} w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8`}>
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href={category.href} className="hover:text-blue-600 transition-colors">
            {category.name}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800 truncate">{title}</span>
        </nav>

        {/* Standardized Tool Header */}
        <header className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-xs">
            <IconComponent className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {privacyMode && <PrivacyBadge mode={privacyMode} />}
            {badge && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                {badge}
              </span>
            )}
          </div>
        </header>

        {/* Feature Flag Conditionals */}
        {isDisabled ? (
          <div className="p-8 rounded-3xl border border-rose-200 bg-rose-50/60 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">
                {title} is Temporarily Unavailable
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {disabledMessage ||
                  "This tool has been temporarily disabled by platform administrators. Please check back soon or explore other available utilities."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={category.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <span>Browse Available Tools</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : isMaintenance ? (
          <div className="p-8 rounded-3xl border border-amber-200 bg-amber-50/60 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">
                {title} Under Scheduled Maintenance
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {maintenanceMessage ||
                  "We are performing routine maintenance on this utility. It will be back online shortly."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={category.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <span>Browse Available Tools</span>
                <ChevronRight className="w-3.5 h-3.5" />
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
