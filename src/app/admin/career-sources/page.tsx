import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CareerSourcePlanner } from "@/lib/career/career-source-planner";
import {
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Server,
  Layers,
  Activity,
  ArrowLeft,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Career Sources Control Center | Saarvi Admin",
  description: "Monitor and manage authoritative career source connectors and provider feeds.",
};

export const dynamic = "force-dynamic";

export default async function CareerSourcesAdminPage() {
  const connectors = CareerSourcePlanner.getAllConnectors();
  const healthStatuses = await Promise.all(
    connectors.map(async (c) => {
      try {
        return await c.healthCheck();
      } catch (err: any) {
        return {
          sourceKey: c.sourceKey,
          displayName: c.displayName,
          status: "FAILED" as const,
          latencyMs: 0,
          lastSyncAt: null,
          discoveredCount: 0,
          publishedCount: 0,
          rateLimitPerMin: c.rateLimitPerMin,
          errorMessage: err.message,
        };
      }
    })
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin" className="hover:text-blue-600 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Admin Center</span>
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-800">Career Sources</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Server className="w-3.5 h-3.5 text-blue-600" />
              <span>Career Source Architecture</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Career Sources Control Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Authoritative operational monitoring across connected career discovery feeds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/career-intelligence"
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition"
            >
              Career Intelligence
            </Link>
            <Link
              href="/jobs"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
            >
              <span>View Live /jobs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Source Connectors Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Connected Provider Inventory ({connectors.length})</span>
            </h2>
            <span className="text-xs text-slate-400">Strictly real operational telemetry</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Source Connector</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Rate Limit</th>
                  <th className="py-3 px-4">Discovered</th>
                  <th className="py-3 px-4">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {healthStatuses.map((source) => {
                  const isHealthy = source.status === "HEALTHY" || source.status === "CONNECTED";
                  const isOutbound = source.status === "OUTBOUND_ONLY" || source.status === "NOT_CONNECTED";

                  return (
                    <tr key={source.sourceKey} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{source.displayName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {source.sourceKey}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {connectors.find((c) => c.sourceKey === source.sourceKey)?.sourceType || "UNKNOWN"}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isHealthy
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isOutbound
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isHealthy ? "bg-emerald-500" : isOutbound ? "bg-slate-400" : "bg-rose-500"
                            }`}
                          />
                          <span>{source.status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                        {source.latencyMs > 0 ? `${source.latencyMs}ms` : "—"}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                        {source.rateLimitPerMin > 0 ? `${source.rateLimitPerMin} req/min` : "None"}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {source.discoveredCount}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleTimeString() : "Pending"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Source Policies & Guardrails */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Platform Source Guardrails (Non-Negotiable)</span>
          </h3>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5 leading-relaxed">
            <li>
              <strong>Zero Scraping Invariant:</strong> LinkedIn and Naukri are strictly configured as outbound redirects unless authorized API partnerships exist.
            </li>
            <li>
              <strong>Server-Side Credentials:</strong> SerpApi and external provider credentials remain exclusively in server environment variables.
            </li>
            <li>
              <strong>Bounded Timeouts:</strong> All connectors enforce strict timeouts (2.0s – 4.5s) to guarantee zero UI latency degradation during partial external downtime.
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
