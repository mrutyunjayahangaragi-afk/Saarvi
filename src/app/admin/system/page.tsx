"use client";

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Lock,
  BookOpen,
  Cpu,
  Layers,
  Zap,
  Gauge,
  CreditCard,
  Bot,
  Search,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { SystemHealthCheck } from '@/types/admin';

interface SystemHealthData {
  activeRequests: number;
  queueDepth: number;
  workerUtilization: number;
  databaseLatency: number;
  cacheHitRate: number;
  errorRate: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  providers: {
    razorpay: { name: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' };
    serpapi: { name: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' };
    gemini: { name: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' };
    email: { name: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' };
  };
  probes: SystemHealthCheck[];
}

export default function AdminSystemPage() {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastProbed, setLastProbed] = useState<string>('');

  useEffect(() => {
    runProbes();
  }, []);

  const runProbes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system/health');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setHealthData(json.data);
          setLastProbed(new Date().toLocaleTimeString());
        }
      }
    } catch (err) {
      console.error('Failed to probe system health:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: SystemHealthCheck['status']) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'UNAVAILABLE':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: SystemHealthCheck['status']) => {
    switch (status) {
      case 'HEALTHY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">HEALTHY</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">WARNING</span>;
      case 'UNAVAILABLE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">UNAVAILABLE</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">UNKNOWN</span>;
    }
  };

  const getCircuitBadge = (status: 'CLOSED' | 'OPEN' | 'HALF_OPEN') => {
    switch (status) {
      case 'CLOSED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">HEALTHY (CLOSED)</span>;
      case 'HALF_OPEN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">RECOVERING (HALF-OPEN)</span>;
      case 'OPEN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">DEGRADED (OPEN)</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <span>Admin System Health & Telemetry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time operational metrics across OS concurrency queues, worker pools, database latency, and external provider circuit breakers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {lastProbed && (
            <span className="text-[11px] text-slate-400 font-mono">
              Last probe: {lastProbed}
            </span>
          )}
          <button
            onClick={runProbes}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Probe Now</span>
          </button>
        </div>
      </div>

      {/* Real-time Telemetry Metrics Grid (PART 6) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Active Requests</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
            {healthData?.activeRequests ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">In-flight HTTP calls</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Queue Depth</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
            {healthData?.queueDepth ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Max capacity: 500</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span>Worker Pool</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
            {healthData?.workerUtilization ?? 0}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">8 worker slots</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>DB Latency</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
            {healthData?.databaseLatency ?? 0} ms
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Live query probe</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Cache Hit Rate</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
            {healthData?.cacheHitRate ?? 85.0}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Registry & flags</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Error Rate</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
            {healthData?.errorRate ?? 0.0}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">SLA target &lt; 1%</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <Gauge className="w-3.5 h-3.5 text-teal-600" />
            <span>P95 Latency</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
            {healthData?.p95Latency ?? 35} ms
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">P50: {healthData?.p50Latency ?? 15}ms</div>
        </div>
      </div>

      {/* External Provider Health & Circuit Breakers (PART 4.15 & 6) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">External Provider Circuit Breakers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fault isolation preventing cascading outages across upstream dependencies.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
            Automated Trip &amp; Recovery
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Razorpay</div>
                <div className="text-[10px] text-slate-500">Payments &amp; Orders</div>
              </div>
            </div>
            {getCircuitBadge(healthData?.providers?.razorpay?.status || 'CLOSED')}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">SerpApi</div>
                <div className="text-[10px] text-slate-500">Live Job Search</div>
              </div>
            </div>
            {getCircuitBadge(healthData?.providers?.serpapi?.status || 'CLOSED')}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Gemini AI</div>
                <div className="text-[10px] text-slate-500">Interview &amp; Resume</div>
              </div>
            </div>
            {getCircuitBadge(healthData?.providers?.gemini?.status || 'CLOSED')}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Gmail SMTP</div>
                <div className="text-[10px] text-slate-500">System Emails</div>
              </div>
            </div>
            {getCircuitBadge(healthData?.providers?.email?.status || 'CLOSED')}
          </div>
        </div>
      </div>

      {/* Health Probes Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Subsystem Connectivity Probes</h2>
        <div className="grid grid-cols-1 gap-3">
          {(healthData?.probes || []).map((check) => (
            <div
              key={check.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-4.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
                  {getStatusIcon(check.status)}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{check.name}</h3>
                    {getStatusBadge(check.status)}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {check.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Latency</div>
                  <div className="font-mono font-bold text-slate-800">{check.latencyMs} ms</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
