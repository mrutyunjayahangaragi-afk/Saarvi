"use client";

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Eye,
  Shield,
  FileCode,
  Calendar,
  Lock,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { AuditLogRecord } from '@/types/admin';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAuditLogs();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.targetId.toLowerCase().includes(search.toLowerCase());

    const matchesType = targetTypeFilter === 'all' || log.targetType === targetTypeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Immutable Administrative Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident append-only ledger of privileged administrative events. Strictly excludes tokens and document data.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
          Recorded Events: <span className="font-bold text-slate-900">{logs.length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, admin email, or target ID..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Target Types</option>
            <option value="TOOL">Tools</option>
            <option value="CURRICULUM">Curriculum</option>
            <option value="USER">Users</option>
            <option value="ANNOUNCEMENT">Announcements</option>
            <option value="SETTING">Settings</option>
            <option value="FEATURE">Features</option>
            <option value="SYSTEM">System</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Administrator</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target</th>
                <th className="py-3 px-3">Target ID</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors font-sans">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 text-xs">{log.adminEmail}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.adminUserId}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-mono font-medium">
                        {log.targetType}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-700 text-xs truncate max-w-xs">
                      {log.targetId}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 rounded-lg text-[11px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Audit Entry: {selectedLog.action}
                </h3>
                <div className="text-[11px] text-slate-400 font-mono">ID: {selectedLog.id}</div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">Actor Email</span>
                  <span className="font-bold text-slate-800">{selectedLog.adminEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Target Type</span>
                  <span className="font-mono text-slate-800">{selectedLog.targetType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Target ID</span>
                  <span className="font-mono text-slate-800">{selectedLog.targetId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Timestamp</span>
                  <span className="text-slate-700 font-mono">{new Date(selectedLog.timestamp).toISOString()}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Audit Metadata Payload</span>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
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
