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
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { SystemHealthCheck } from '@/types/admin';

export default function AdminSystemPage() {
  const [checks, setChecks] = useState<SystemHealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastProbed, setLastProbed] = useState<string>('');

  useEffect(() => {
    runProbes();
  }, []);

  const runProbes = async () => {
    setLoading(true);
    try {
      const results = await adminService.runSystemHealthChecks();
      setChecks(results);
      setLastProbed(new Date().toLocaleTimeString());
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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <span>System Health Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time latency and connectivity probes across platform application runtime, auth, and curriculum indices.
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

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 gap-3.5">
        {checks.map((check) => (
          <div
            key={check.id}
            className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
  );
}
