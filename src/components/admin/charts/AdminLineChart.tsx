"use client";

import React, { useState } from 'react';
import { TimeSeriesPoint } from '@/types/admin';

interface AdminLineChartProps {
  data: TimeSeriesPoint[];
  metricLabel: string;
  strokeColor?: string;
  fillGradientStart?: string;
  fillGradientEnd?: string;
  emptyMessage?: string;
  height?: number;
}

export default function AdminLineChart({
  data,
  metricLabel,
  strokeColor = '#2563eb',
  fillGradientStart = 'rgba(37, 99, 235, 0.22)',
  fillGradientEnd = 'rgba(37, 99, 235, 0.01)',
  emptyMessage = 'No activity recorded for this period.',
  height = 200,
}: AdminLineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ point: TimeSeriesPoint; x: number; y: number } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{emptyMessage}</p>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Real zero-count data</span>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 5);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  // Coordinate math inside fixed SVG coordinate space (600x200)
  const svgWidth = 600;
  const svgHeight = 200;
  const paddingX = 35;
  const paddingY = 25;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = data.map((d, index) => {
    const x = paddingX + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = paddingY + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingY + chartHeight} L ${points[0].x} ${paddingY + chartHeight} Z`;

  // Y-axis grid lines (4 intervals)
  const gridLines = [0, 0.33, 0.66, 1].map((ratio) => {
    const y = paddingY + chartHeight - ratio * chartHeight;
    const val = Math.round(minVal + ratio * range);
    return { y, val };
  });

  // Unique gradient ID to avoid collisions
  const gradId = `line-grad-${metricLabel.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {/* Screen Reader Accessible Table */}
      <table className="sr-only">
        <caption>{metricLabel} timeline data</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
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
        aria-label={`${metricLabel} line chart from ${data[0]?.label} to ${data[data.length - 1]?.label}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillGradientStart} />
            <stop offset="100%" stopColor={fillGradientEnd} />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines & labels */}
        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line
              x1={paddingX}
              y1={line.y}
              x2={svgWidth - paddingX}
              y2={line.y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text
              x={paddingX - 8}
              y={line.y + 3}
              textAnchor="end"
              className="text-[9px] fill-slate-400 dark:fill-slate-500 font-mono font-medium"
            >
              {line.val}
            </text>
          </g>
        ))}

        {/* Gradient Area Fill */}
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* Main Line Path */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Data Points */}
        {points.map((p, idx) => {
          const isHovered = hoveredPoint?.point.date === p.date;
          return (
            <g
              key={idx}
              className="cursor-pointer group"
              onMouseEnter={() => setHoveredPoint({ point: p, x: p.x, y: p.y })}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Invisible larger hit target */}
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
              {/* Visible dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5 : 3}
                fill="currentColor"
                stroke={strokeColor}
                strokeWidth={isHovered ? 3 : 2}
                className="text-white dark:text-slate-900 transition-all duration-150"
              />
            </g>
          );
        })}

        {/* X-axis date labels (start, middle, end) */}
        {points.length > 0 && (
          <g className="text-[10px] fill-slate-400 dark:fill-slate-500 font-medium">
            <text x={points[0].x} y={svgHeight - 4} textAnchor="start">
              {points[0].label}
            </text>
            {points.length > 2 && (
              <text
                x={points[Math.floor(points.length / 2)].x}
                y={svgHeight - 4}
                textAnchor="middle"
              >
                {points[Math.floor(points.length / 2)].label}
              </text>
            )}
            <text x={points[points.length - 1].x} y={svgHeight - 4} textAnchor="end">
              {points[points.length - 1].label}
            </text>
          </g>
        )}
      </svg>

      {/* Floating Tooltip Popover */}
      {hoveredPoint && (
        <div
          className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 dark:bg-slate-950 text-white rounded-lg px-2.5 py-1.5 text-xs shadow-lg border border-slate-800 dark:border-slate-700 space-y-0.5 transition-transform"
          style={{
            left: `${(hoveredPoint.x / svgWidth) * 100}%`,
            top: `${(hoveredPoint.y / svgHeight) * 100}%`,
          }}
        >
          <div className="text-[10px] text-slate-400 font-mono">{hoveredPoint.point.label}</div>
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: strokeColor }}></span>
            <span>{metricLabel}:</span>
            <span className="font-mono text-white font-bold">{hoveredPoint.point.value.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
