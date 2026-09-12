"use client";

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  Eye,
  Activity,
  Shield,
  Clock,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { featureService } from '@/lib/services/featureService';
import { adminAnalyticsService } from '@/lib/services/adminAnalyticsService';

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    recentAuditCount: 0,
    enabledFeatureFlags: 0,
    totalFeatureFlags: 0,
  });
  const [obsMetrics, setObsMetrics] = useState<{
    hasData: boolean;
    displayMessage: string | null;
    totalRequests: number;
    successfulOperations: number;
    failures: number;
    errorRate: number;
    p50DurationMs: number;
    p95DurationMs: number;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, auditLogs, flags, obsRes] = await Promise.all([
          adminService.listUsers(),
          adminService.getAuditLogs(),
          Promise.resolve(featureService.getAllFeatures()),
          adminAnalyticsService.getObservabilityMetrics(),
        ]);

        const activeCount = usersRes.users.filter((u) => u.status === 'ACTIVE').length;
        const enabledFlags = flags.filter((f) => f.status === 'ENABLED').length;

        setMetrics({
          totalUsers: usersRes.total,
          activeUsers: activeCount,
          recentAuditCount: auditLogs.length,
          enabledFeatureFlags: enabledFlags,
          totalFeatureFlags: flags.length,
        });
        setObsMetrics(obsRes);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span>Platform Operational Analytics</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Real, verifiable platform operational metrics. Strictly zero collection of user files or academic records.
        </p>
      </div>

      {/* Critical Privacy Boundary Notice (Section 49 & 51) */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-xs text-emerald-900 leading-relaxed">
        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
          <Shield className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
            Privacy Enforcement Guarantee (Section 49 & 51)
          </h2>
          <p className="text-emerald-800 font-normal">
            Saarvi tools process 100% locally inside the user&apos;s browser using WebAssembly. The platform does not inspect, count, or log private conversion contents, resume drafts, SGPA marks, notes, or certificates. Only measurable platform-level account and administrative events are recorded.
          </p>
        </div>
      </div>

      {/* Actual Measurable Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Registered Accounts
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : metrics.totalUsers}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            {metrics.activeUsers} in Active Standing
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Administrative Events
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : metrics.recentAuditCount}
          </div>
          <div className="text-[11px] text-slate-500">Immutable Audit Trail</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Feature Flags
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : `${metrics.enabledFeatureFlags}/${metrics.totalFeatureFlags}`}
          </div>
          <div className="text-[11px] text-blue-600 font-semibold">Live Modules</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Telemetry Policy
          </span>
          <div className="text-base sm:text-lg font-bold text-slate-900 pt-1">
            Privacy-First
          </div>
          <div className="text-[11px] text-slate-500">Zero file tracking</div>
        </div>
      </div>

      {/* Measurable Event Types Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Platform Measurable Surfaces</h2>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">Authentication & Workspace Sessions</div>
              <div className="text-[11px] text-slate-500">Sign-up, sign-in, and account status transitions.</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
              Active & Monitored
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">Tool Page Invocations</div>
              <div className="text-[11px] text-slate-500">Route loads for document utilities and student calculators.</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
              Active & Monitored
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">Administrative Actions & Configuration Updates</div>
              <div className="text-[11px] text-slate-500">Tool overrides, curriculum verification seals, and security updates.</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
              Active & Monitored
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">Document Contents & Marks Telemetry</div>
              <div className="text-[11px] text-slate-500">PDF binaries, resume text, marks entered, notes, certificates.</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-[10px]">
              Strictly Blocked by Design
            </span>
          </div>
        </div>
      </div>

      {/* Production Performance & Latency Telemetry (Section 25) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Production Performance & Latency Telemetry
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">Lightweight In-Memory Profiling</span>
        </div>

        {obsMetrics && obsMetrics.hasData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total Ops</span>
              <div className="text-xl font-black text-slate-900">{obsMetrics.totalRequests}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500">p50 Latency</span>
              <div className="text-xl font-black text-blue-600">{obsMetrics.p50DurationMs}ms</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500">p95 Latency</span>
              <div className="text-xl font-black text-purple-600">{obsMetrics.p95DurationMs}ms</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500">Error Rate</span>
              <div className="text-xl font-black text-emerald-600">
                {(obsMetrics.errorRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 border border-slate-200/70 rounded-xl text-center space-y-1">
            <Clock className="w-5 h-5 text-slate-400 mx-auto" />
            <div className="text-xs font-bold text-slate-700">No production data yet</div>
            <p className="text-[11px] text-slate-500">
              Live p50/p95 latency and operational health metrics will display dynamically as production requests execute.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
