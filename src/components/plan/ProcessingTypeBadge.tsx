"use client";

import React from 'react';
import { ProcessingType } from '@/types/plan';
import { ShieldCheck, Cloud, Cpu } from 'lucide-react';

interface ProcessingTypeBadgeProps {
  type: ProcessingType;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export default function ProcessingTypeBadge({
  type,
  showTooltip = true,
  size = 'md',
  className = '',
}: ProcessingTypeBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  if (type === 'local') {
    return (
      <span
        title={showTooltip ? '100% Client-Side Processing. Your documents never leave this device.' : undefined}
        className={`inline-flex items-center gap-1 font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 cursor-help ${sizeClasses} ${className}`}
      >
        <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>Local (In-Browser)</span>
      </span>
    );
  }

  if (type === 'server') {
    return (
      <span
        title={showTooltip ? 'Requires secure remote processing.' : undefined}
        className={`inline-flex items-center gap-1 font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200 cursor-help ${sizeClasses} ${className}`}
      >
        <Cloud className="w-3 h-3 text-slate-500 shrink-0" />
        <span>Server Processing</span>
      </span>
    );
  }

  return (
    <span
      title={showTooltip ? 'Combines client-side preparation with optional remote enrichment.' : undefined}
      className={`inline-flex items-center gap-1 font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200 cursor-help ${sizeClasses} ${className}`}
    >
      <Cpu className="w-3 h-3 text-purple-600 shrink-0" />
      <span>Mixed Architecture</span>
    </span>
  );
}
