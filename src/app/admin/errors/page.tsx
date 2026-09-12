"use client";

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  Check,
  Filter,
  Shield,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { PlatformErrorRecord, ErrorSeverity, ErrorStatus } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function AdminErrorsPage() {
  const { user, profile } = useAuth();
  const [errors, setErrors] = useState<PlatformErrorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | ErrorSeverity>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ErrorStatus>('all');

  // Details Modal
  const [selectedError, setSelectedError] = useState<PlatformErrorRecord | null>(null);

  useEffect(() => {
    loadErrors();
  }, []);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const data = await adminService.getSystemErrors();
      setErrors(data);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: ErrorStatus) => {
    if (!user || !profile) return;
    try {
      await adminService.updateErrorStatus(id, newStatus, {
        id: user.id,
        email: user.email,
        role: profile.role,
      });
      await loadErrors();
    } catch (err: any) {
      alert(err?.message || 'Failed to update error status');
    }
  };

  const filteredErrors = errors.filter((err) => {
    const matchesSearch =
      err.service.toLowerCase().includes(search.toLowerCase()) ||
      err.safeMessage.toLowerCase().includes(search.toLowerCase()) ||
      err.requestId.toLowerCase().includes(search.toLowerCase()) ||
      (err.tool && err.tool.toLowerCase().includes(search.toLowerCase()));

    const matchesSeverity = severityFilter === 'all' || err.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || err.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (sev: ErrorSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">CRITICAL</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">ERROR</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">WARNING</span>;
      case 'INFO':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">INFO</span>;
    }
  };

  const getStatusBadge = (st: ErrorStatus) => {
    switch (st) {
      case 'NEW':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">NEW</span>;
      case 'ACKNOWLEDGED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">ACKNOWLEDGED</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">RESOLVED</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Operational Error Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time diagnostics and event triage. Internal error traces are restricted from non-admin users.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
          Open Events: <span className="font-bold text-slate-900">{errors.filter((e) => e.status !== 'RESOLVED').length}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by service, message or request ID..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="ERROR">Error</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="NEW">New</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Errors Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Time & Request</th>
                <th className="py-3 px-3">Service / Tool</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Safe Message</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Triage Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredErrors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No matching operational errors found.
                  </td>
                </tr>
              ) : (
                filteredErrors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-700 font-semibold">
                        {new Date(err.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{err.requestId}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{err.service}</div>
                      {err.tool && <div className="text-[11px] text-blue-600 font-mono">{err.tool}</div>}
                    </td>

                    <td className="py-3 px-3">
                      {getSeverityBadge(err.severity)}
                    </td>

                    <td className="py-3 px-3 max-w-xs">
                      <div className="truncate text-slate-700">{err.safeMessage}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{err.errorType}</div>
                    </td>

                    <td className="py-3 px-3">
                      {getStatusBadge(err.status)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedError(err)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {err.status === 'NEW' && (
                          <button
                            onClick={() => handleStatusUpdate(err.id, 'ACKNOWLEDGED')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold border border-blue-200 transition-colors cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}

                        {err.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleStatusUpdate(err.id, 'RESOLVED')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-semibold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Diagnostic Event Details
                </h3>
                <div className="text-[11px] text-slate-400 font-mono">
                  Request ID: {selectedError.requestId}
                </div>
              </div>
              <button
                onClick={() => setSelectedError(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">Service</span>
                  <span className="font-bold text-slate-800">{selectedError.service}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Error Code</span>
                  <span className="font-mono text-slate-800">{selectedError.errorType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Timestamp</span>
                  <span className="text-slate-700 font-mono">{new Date(selectedError.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Severity</span>
                  <span>{getSeverityBadge(selectedError.severity)}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Public Safe Message</span>
                <p className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
                  {selectedError.safeMessage}
                </p>
              </div>

              {selectedError.diagnostics && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Internal Diagnostic Trace</span>
                  <pre className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {selectedError.diagnostics}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
