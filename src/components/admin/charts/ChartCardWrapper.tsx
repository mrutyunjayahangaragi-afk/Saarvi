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
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }[badgeColor];

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all ${className}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
            {badge && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeClasses}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {/* Card Body */}
      <div className="flex-1 flex flex-col justify-center min-h-[220px]">
        {loading ? (
          <div className="space-y-3 animate-pulse p-4">
            <div className="h-4 bg-slate-100 rounded-md w-1/3"></div>
            <div className="h-32 bg-slate-100 rounded-xl w-full"></div>
            <div className="flex gap-2">
              <div className="h-3 bg-slate-100 rounded w-1/4"></div>
              <div className="h-3 bg-slate-100 rounded w-1/4"></div>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-3 bg-red-50/50 rounded-xl border border-red-100">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-red-900">Couldn't load visualization</p>
              <p className="text-[11px] text-red-600 max-w-xs mx-auto">{error}</p>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-colors shadow-2xs"
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
        <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
          {footerInfo}
        </div>
      )}
    </div>
  );
}
