"use client";

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  Activity,
  Shield,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Compass,
  Sparkles,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import {
  PlatformAnalyticsOverview,
  AnalyticsPeriod,
} from '@/lib/analytics/analytics-store';

const PERIOD_OPTIONS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'all', label: 'All Time' },
];

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<PlatformAnalyticsOverview | null>(null);

  const fetchAnalytics = async (selectedPeriod: AnalyticsPeriod) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/overview?period=${selectedPeriod}`);
      const data = await res.json();
      if (data.success && data.overview) {
        setOverview(data.overview);
      }
    } catch (err) {
      console.error('Failed to load analytics overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
              Super Admin
            </span>
            <span className="text-xs text-slate-500 font-medium">Saarvi Platform Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            <span>Platform Analytics &amp; Tool Intelligence</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real platform telemetry: DAU/WAU/MAU, tool runs, adoption metrics, discovery channels, and unused tools.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-2xs self-start sm:self-auto">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                period === opt.id
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-white/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => fetchAnalytics(period)}
            title="Refresh Metrics"
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Critical Privacy Notice Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-3.5 text-xs text-emerald-900 shadow-2xs">
        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-sm text-emerald-950">
            Privacy-Preserving Telemetry Guarantee
          </h2>
          <p className="mt-1 leading-relaxed text-emerald-800 text-xs">
            Saarvi processes private files, resumes, and study materials locally inside the browser. Platform analytics measures aggregate tool executions, discovery routes, and anonymous interaction counts without ever logging document content or academic marks.
          </p>
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Active Users (DAU / WAU / MAU)</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 flex items-baseline gap-2">
            <span>{overview?.dau ?? 0}</span>
            <span className="text-xs font-semibold text-slate-400">
              / {overview?.wau ?? 0} / {overview?.mau ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">Unique active accounts in window</div>
        </div>

        {/* Total Tool Runs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tool Executions</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 flex items-baseline gap-1.5">
            <span>{overview?.totalToolRuns ?? 0}</span>
            <span className="text-xs font-semibold text-slate-400">runs</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            <span className="text-emerald-700 font-bold">{overview?.authenticatedToolRuns ?? 0}</span> auth · <span className="text-slate-700 font-bold">{overview?.guestToolRuns ?? 0}</span> guest
          </div>
        </div>

        {/* Tool Adoption Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tool Adoption Rate</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">
            {overview?.toolAdoptionRate ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500">
            {overview?.activeToolsCount ?? 0} of {overview?.totalCanonicalTools ?? 0} catalog tools active
          </div>
        </div>

        {/* Total Platform Events */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Total Interactions</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 flex items-baseline gap-1.5">
            <span>{overview?.totalEvents ?? 0}</span>
            <span className="text-xs font-semibold text-slate-400">events</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            <span className="text-purple-700 font-bold">{overview?.uniqueGuestSessions ?? 0}</span> guest sessions
          </div>
        </div>
      </div>

      {/* Main Grid: Top Tools vs Discovery Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Tools Leaderboard (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Top Tools by Volume ({overview?.topTools.length ?? 0})</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-bold uppercase">
              {period.toUpperCase()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                  <th className="py-3 px-4 w-10">#</th>
                  <th className="py-3 px-4">Tool</th>
                  <th className="py-3 px-3 text-center">Category</th>
                  <th className="py-3 px-3 text-right">Views</th>
                  <th className="py-3 px-3 text-right">Runs</th>
                  <th className="py-3 px-4 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview?.topTools && overview.topTools.length > 0 ? (
                  overview.topTools.map((tool, idx) => (
                    <tr key={tool.toolId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {tool.toolName}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 capitalize">
                          {tool.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500 font-medium">{tool.views}</td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700 font-bold">
                        {tool.runs}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {tool.totalInteractions}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                      No tool executions recorded in selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Discovery Channels Breakdown (1 Col) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              <span>Discovery Channels</span>
            </h3>
          </div>

          <div className="space-y-4">
            {overview?.discoveryChannels && overview.discoveryChannels.length > 0 ? (
              overview.discoveryChannels.map((channel) => (
                <div key={channel.channel} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{channel.channel}</span>
                    <span className="font-mono text-slate-500 font-medium">
                      {channel.count} ({channel.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${channel.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No channel data available</p>
            )}
          </div>

          {/* Event Distribution Summary */}
          <div className="pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              Interaction Types
            </span>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {overview?.eventTypeDistribution &&
                Object.entries(overview.eventTypeDistribution).map(([type, count]) => (
                  <span
                    key={type}
                    className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-mono"
                  >
                    {type}: <strong className="text-slate-900">{count}</strong>
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Under-Utilized Catalog Tools */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900">
              Under-Utilized Catalog Tools ({overview?.unusedTools.length ?? 0})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">0 runs recorded in {period}</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          These verified canonical tools had zero user runs during this period. Consider promoting them via Featured flags, badges, or navbar placement in Navigation Management.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {overview?.unusedTools && overview.unusedTools.length > 0 ? (
            overview.unusedTools.map((t) => (
              <span
                key={t.toolId}
                className="px-3 py-1 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-700 inline-flex items-center gap-1.5 hover:border-slate-300 transition"
              >
                <span className="font-medium">{t.toolName}</span>
                <span className="text-[10px] text-slate-400 font-mono">({t.category})</span>
              </span>
            ))
          ) : (
            <p className="text-xs text-emerald-600 font-semibold">Every tool in the catalog has been used!</p>
          )}
        </div>
      </div>
    </div>
  );
}
