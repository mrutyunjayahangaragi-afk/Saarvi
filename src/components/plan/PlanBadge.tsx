"use client";

import React from 'react';
import { Plan } from '@/types/plan';
import { Sparkles, Shield, Clock } from 'lucide-react';

interface PlanBadgeProps {
  plan?: Plan | 'coming_soon';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export default function PlanBadge({
  plan = 'free',
  size = 'md',
  showIcon = true,
  className = '',
}: PlanBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
    lg: 'text-sm px-3 py-1 gap-2',
  }[size];

  if (plan === 'pro') {
    return (
      <span
        className={`inline-flex items-center font-extrabold uppercase tracking-wider rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 border border-purple-200/80 shadow-2xs ${sizeClasses} ${className}`}
      >
        {showIcon && <Sparkles className="w-3 h-3 text-purple-600" />}
        <span>PRO</span>
      </span>
    );
  }

  if (plan === 'coming_soon') {
    return (
      <span
        className={`inline-flex items-center font-bold uppercase tracking-wider rounded-md bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses} ${className}`}
      >
        {showIcon && <Clock className="w-3 h-3 text-amber-600" />}
        <span>Coming Soon</span>
      </span>
    );
  }

  if (plan === 'guest') {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses} ${className}`}
      >
        <span>GUEST</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 ${sizeClasses} ${className}`}
    >
      {showIcon && <Shield className="w-3 h-3 text-blue-600" />}
      <span>FREE</span>
    </span>
  );
}
