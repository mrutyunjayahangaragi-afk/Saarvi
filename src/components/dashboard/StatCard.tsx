"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  value: number | string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  loading?: boolean;
}

export default function StatCard({
  value,
  label,
  icon: Icon,
  iconColor = "text-blue-600",
  iconBg = "bg-blue-50",
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="p-5 bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 rounded mb-1.5" />
        <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  return (
    <div className="p-5 bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all hover-3d-lift">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
        {value}
      </p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
