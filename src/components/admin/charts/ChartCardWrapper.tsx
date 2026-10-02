"use client";

import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ChartCardWrapperProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'blue' | 'purple' | 'emerald' | 'amber';
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  footerInfo?: string;
  className?: string;
}

export default function ChartCardWrapper({
  title,
  subtitle,
  badge,
  badgeColor = 'blue',
  loading,
  error,
  onRetry,
  children,
  headerAction,
  footerInfo,
  className = '',
}: ChartCardWrapperProps) {
  const badgeClasses = {
    blue: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800',
    purple: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800',
  }[badgeColor];

  return (
    <div
      className={`bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all ${className}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
            {badge && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeClasses}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {/* Card Body */}
      <div className="flex-1 flex flex-col justify-center min-h-[220px]">
        {loading ? (
          <div className="space-y-3 animate-pulse p-4">
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md w-1/3"></div>
            <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl w-full"></div>
            <div className="flex gap-2">
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4"></div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4"></div>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-3 bg-red-50/50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-900/50">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-red-900 dark:text-red-300">Couldn't load visualization</p>
              <p className="text-[11px] text-red-600 dark:text-red-400 max-w-xs mx-auto">{error}</p>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#162244] border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Card Footer (optional context or accessibility summary) */}
      {footerInfo && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
          {footerInfo}
        </div>
      )}
    </div>
  );
}
