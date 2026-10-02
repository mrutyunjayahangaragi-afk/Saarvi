"use client";

import React, { useState } from 'react';
import { CategoryDistribution } from '@/types/admin';

interface AdminDonutChartProps {
  data: CategoryDistribution[];
  centerLabel?: string;
  totalOverride?: number;
  emptyMessage?: string;
  size?: number;
}

export default function AdminDonutChart({
  data,
  centerLabel = 'Total',
  totalOverride,
  emptyMessage = 'No distribution data available.',
  size = 180,
}: AdminDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const calculatedTotal = data.reduce((sum, item) => sum + item.count, 0);
  const total = totalOverride !== undefined ? totalOverride : calculatedTotal;

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{emptyMessage}</p>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">0 entries</span>
      </div>
    );
  }

  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const segments = data.map((item, idx) => {
    const itemPct = total > 0 ? item.count / total : 0;
    const strokeDasharray = `${itemPct * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += itemPct;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
      {/* Donut SVG */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 select-none"
          role="img"
          aria-label={`${centerLabel} donut chart`}
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {segments.map((seg) => {
            const isHovered = hoveredIdx === seg.idx;
            return (
              <circle
                key={seg.idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(seg.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
          <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
            {activeItem ? activeItem.count : total}
          </span>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate max-w-[100px]">
            {activeItem ? activeItem.label : centerLabel}
          </span>
        </div>
      </div>

      {/* Legend & Details */}
      <div className="flex flex-col gap-2 min-w-[160px] w-full sm:w-auto">
        {data.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          const pct = item.percentage ?? Math.round((item.count / total) * 100);
          return (
            <div
              key={idx}
              className={`flex items-center justify-between gap-3 text-xs p-1.5 rounded-lg cursor-pointer transition-colors ${
                isHovered ? 'bg-slate-100/80 dark:bg-slate-800 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                ></span>
                <span className="text-slate-700 dark:text-slate-300 truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="text-slate-900 dark:text-white font-bold">{item.count}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
