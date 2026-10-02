"use client";

import React, { useState } from 'react';
import { TimeSeriesPoint } from '@/types/admin';

interface AdminBarChartProps {
  data: TimeSeriesPoint[];
  metricLabel: string;
  barColor?: string;
  hoverColor?: string;
  emptyMessage?: string;
  height?: number;
}

export default function AdminBarChart({
  data,
  metricLabel,
  barColor = '#2563eb',
  hoverColor = '#1d4ed8',
  emptyMessage = 'No data recorded for this period.',
  height = 200,
}: AdminBarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<{ point: TimeSeriesPoint; x: number; y: number } | null>(null);

  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  if (!data || data.length === 0 || totalValue === 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{emptyMessage}</p>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">0 entries recorded</span>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 4);

  // SVG coordinate canvas
  const svgWidth = 600;
  const svgHeight = 200;
  const paddingX = 30;
  const paddingBottom = 25;
  const paddingTop = 15;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const barSlotWidth = chartWidth / data.length;
  const barWidth = Math.max(Math.min(barSlotWidth * 0.65, 28), 4);

  const bars = data.map((d, idx) => {
    const barHeight = (d.value / maxVal) * chartHeight;
    const x = paddingX + idx * barSlotWidth + (barSlotWidth - barWidth) / 2;
    const y = paddingTop + chartHeight - barHeight;
    return { ...d, x, y, barHeight };
  });

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {/* Screen Reader Semantic Table */}
      <table className="sr-only">
        <caption>{metricLabel} bar chart summary</caption>
        <thead>
          <tr>
            <th scope="col">Date / Category</th>
            <th scope="col">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{d.label}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible select-none"
        role="img"
        aria-label={`${metricLabel} bar chart with total ${totalValue}`}
      >
        {/* Horizontal reference baseline */}
        <line
          x1={paddingX}
          y1={paddingTop + chartHeight}
          x2={svgWidth - paddingX}
          y2={paddingTop + chartHeight}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="1"
        />

        {/* Vertical Bars */}
        {bars.map((bar, idx) => {
          const isHovered = hoveredBar?.point.date === bar.date;
          return (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() =>
                setHoveredBar({
                  point: bar,
                  x: bar.x + barWidth / 2,
                  y: bar.y,
                })
              }
              onMouseLeave={() => setHoveredBar(null)}
            >
              {/* Hit target */}
              <rect
                x={bar.x - 2}
                y={paddingTop}
                width={barWidth + 4}
                height={chartHeight}
                fill="transparent"
              />
              {/* Actual bar */}
              <rect
                x={bar.x}
                y={bar.value > 0 ? bar.y : paddingTop + chartHeight - 2}
                width={barWidth}
                height={bar.value > 0 ? bar.barHeight : 2}
                rx={Math.min(barWidth / 2, 4)}
                fill={isHovered ? hoverColor : bar.value > 0 ? barColor : undefined}
                className={`transition-all duration-150 ${bar.value > 0 ? '' : 'fill-slate-200 dark:fill-slate-800'}`}
              />
            </g>
          );
        })}

        {/* X-axis labels (render subset if many bars) */}
        {bars.map((bar, idx) => {
          const showLabel =
            bars.length <= 10 ||
            idx === 0 ||
            idx === bars.length - 1 ||
            idx === Math.floor(bars.length / 2);

          if (!showLabel) return null;

          return (
            <text
              key={idx}
              x={bar.x + barWidth / 2}
              y={svgHeight - 4}
              textAnchor="middle"
              className="text-[9px] fill-slate-400 dark:fill-slate-500 font-medium"
            >
              {bar.label}
            </text>
          );
        })}
      </svg>

      {/* Floating Tooltip Popover */}
      {hoveredBar && (
        <div
          className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 dark:bg-slate-950 text-white rounded-lg px-2.5 py-1.5 text-xs shadow-lg border border-slate-800 dark:border-slate-700 space-y-0.5 transition-transform"
          style={{
            left: `${(hoveredBar.x / svgWidth) * 100}%`,
            top: `${(hoveredBar.y / svgHeight) * 100}%`,
          }}
        >
          <div className="text-[10px] text-slate-400 font-mono">{hoveredBar.point.label}</div>
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: barColor }}></span>
            <span>{metricLabel}:</span>
            <span className="font-mono text-white font-bold">{hoveredBar.point.value}</span>
          </div>
        </div>
      )}
    </div>
  );
}
