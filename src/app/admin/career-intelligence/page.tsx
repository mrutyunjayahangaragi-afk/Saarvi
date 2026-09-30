import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CareerSourcePlanner } from "@/lib/career/career-source-planner";
import { jobRepository } from "@/lib/jobs/repository";
import {
  Briefcase,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Activity,
  ArrowLeft,
  Search,
  ExternalLink,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Career Intelligence Center | Saarvi Admin",
  description: "Real telemetry on opportunity discovery, deduplication, verification, and freshness.",
};

export const dynamic = "force-dynamic";

export default async function CareerIntelligenceAdminPage() {
  const verifiedRes = await jobRepository.getLiveVerifiedOpportunities({ limit: 100 });
  const storedSource = await jobRepository.getStoredSourceDiscoveries({ limit: 100 });
  const connectors = CareerSourcePlanner.getAllConnectors();

  const totalVerified = verifiedRes.liveCount || verifiedRes.items.length;
  const totalSource = storedSource.length;
  const totalTracked = totalVerified + totalSource;

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
          <span className="font-semibold text-slate-800">Career Intelligence</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Saarvi Career Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Platform Career Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Real telemetry across discovery, deduplication, verification states, and source freshness.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/career-sources"
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition"
            >
              Source Connectors
            </Link>
            <Link
              href="/jobs"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
            >
              <span>Test Live Search</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Core Real Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Opportunities</span>
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{totalTracked}</div>
            <div className="text-[11px] text-slate-400">Canonical database index</div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saarvi Verified</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-700">{totalVerified}</div>
            <div className="text-[11px] text-slate-400">Passed strict verification checks</div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Discoveries</span>
              <Briefcase className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-extrabold text-indigo-700">{totalSource}</div>
            <div className="text-[11px] text-slate-400">Imported from external feeds</div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connectors</span>
              <Activity className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-extrabold text-purple-700">{connectors.length}</div>
            <div className="text-[11px] text-slate-400">Registered platform adapters</div>
          </div>
        </div>

        {/* Telemetry Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section: Deduplication & Provenance Policy */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Multi-Source Deduplication Architecture</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When Google Jobs, Company Careers, and Greenhouse index the same position, Saarvi&apos;s
              CanonicalJobDeduplicationEngine computes a deterministic key and merges them into a single
              canonical record.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono space-y-1">
              <div className="text-slate-500">Uniqueness Signature:</div>
              <div className="text-blue-700 font-bold">ck_{"{company}"}_{"{title}"}_{"{location}"}</div>
            </div>
          </div>

          {/* Section: Freshness & Expiration Policy */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Freshness Thresholds</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-700">Fresh</span>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">≤ 7 Days</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-700">Recent</span>
                <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">8 – 30 Days</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-700">Stale</span>
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">&gt; 30 Days</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="font-semibold text-slate-700">Expired</span>
                <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">Past Application Deadline</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
