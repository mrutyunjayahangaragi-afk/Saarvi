"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  RefreshCw,
  Search,
  Filter,
  ArrowLeft,
  Activity,
  Lock,
  Layers,
  FileText,
  FileImage,
  GraduationCap,
  Briefcase,
  Sparkles,
  ExternalLink,
  Info,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { CANONICAL_TOOL_REGISTRY, CanonicalTool } from "@/lib/tools/tool-registry";
import { featureServerStore } from "@/lib/features/feature-store";

// ─── Health Status Config ─────────────────────────────────────────────────────
type HealthStatus =
  | "HEALTHY"
  | "PARTIALLY_WORKING"
  | "BROKEN"
  | "COMING_SOON"
  | "PLACEHOLDER"
  | "MISCONFIGURED"
  | "ACCESS_BLOCKED"
  | "DEPENDENCY_UNAVAILABLE"
  | "UNKNOWN";

const HEALTH_CONFIG: Record<
  HealthStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  HEALTHY: {
    label: "Healthy",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
  PARTIALLY_WORKING: {
    label: "Partial",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertTriangle,
  },
  BROKEN: {
    label: "Broken",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
  },
  COMING_SOON: {
    label: "Coming Soon",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Clock,
  },
  PLACEHOLDER: {
    label: "Placeholder",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: Layers,
  },
  MISCONFIGURED: {
    label: "Misconfigured",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: AlertCircle,
  },
  ACCESS_BLOCKED: {
    label: "Access Blocked",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: Lock,
  },
  DEPENDENCY_UNAVAILABLE: {
    label: "Dependency Down",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: TrendingDown,
  },
  UNKNOWN: {
    label: "Unknown",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: Info,
  },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  image: FileImage,
  academic: GraduationCap,
  student: GraduationCap,
  career: Briefcase,
  ai: Sparkles,
};

// ─── Tool health derivation from registry + feature flags ─────────────────────
interface ToolHealthEntry {
  tool: CanonicalTool;
  derivedHealth: HealthStatus;
  healthReason: string;
  isEnabled: boolean;
  featureStatus: string | null;
}

function deriveToolHealth(tool: CanonicalTool): ToolHealthEntry {
  const featureFlag = featureServerStore.getFeature(tool.key);
  const featureStatus = featureFlag?.status || null;
  const isEnabled = tool.status !== "coming_soon" && featureStatus !== "DISABLED";

  let derivedHealth: HealthStatus = "UNKNOWN";
  let healthReason = "";

  if (featureStatus === "DISABLED") {
    derivedHealth = "ACCESS_BLOCKED";
    healthReason = "Disabled via feature flag";
  } else if (featureStatus === "MAINTENANCE") {
    derivedHealth = "PARTIALLY_WORKING";
    healthReason = "Under maintenance";
  } else if (tool.status === "coming_soon") {
    derivedHealth = "COMING_SOON";
    healthReason = "Not yet implemented";
    // Check for misconfiguration: tool is in coming_soon but feature flag says ENABLED
    if (featureStatus === "ENABLED") {
      derivedHealth = "MISCONFIGURED";
      healthReason = "Feature flag is ENABLED but tool is marked coming_soon";
    }
  } else if (tool.status === "beta") {
    derivedHealth = "PARTIALLY_WORKING";
    healthReason = "Beta — may have issues";
  } else if (tool.status === "available") {
    derivedHealth = "HEALTHY";
    healthReason = "Route and implementation present";
  } else {
    derivedHealth = "UNKNOWN";
    healthReason = "Status unknown";
  }

  return { tool, derivedHealth, healthReason, isEnabled, featureStatus };
}

// ─── Summary Counts ───────────────────────────────────────────────────────────
function getSummary(entries: ToolHealthEntry[]) {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    counts[e.derivedHealth] = (counts[e.derivedHealth] || 0) + 1;
  }
  return counts;
}

// ─── Health Badge ─────────────────────────────────────────────────────────────
function HealthBadge({ status }: { status: HealthStatus }) {
  const cfg = HEALTH_CONFIG[status] || HEALTH_CONFIG.UNKNOWN;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({
  label,
  count,
  status,
  active,
  onClick,
}: {
  label: string;
  count: number;
  status: HealthStatus | null;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = status ? (HEALTH_CONFIG[status] || HEALTH_CONFIG.UNKNOWN) : null;
  const Icon = cfg?.icon || Activity;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start p-4 rounded-2xl border transition-all cursor-pointer text-left ${
        active
          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {cfg && <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />}
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      </div>
      <span className="text-2xl font-bold text-slate-900">{count}</span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ToolHealthCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<HealthStatus | "ALL">("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Derive health for all tools from the canonical registry
  const allHealthEntries = useMemo<ToolHealthEntry[]>(
    () => CANONICAL_TOOL_REGISTRY.map(deriveToolHealth),
    [lastRefreshed]
  );

  const summary = useMemo(() => getSummary(allHealthEntries), [allHealthEntries]);

  const categories = useMemo(
    () => Array.from(new Set(CANONICAL_TOOL_REGISTRY.map((t) => t.category))).sort(),
    []
  );

  const filtered = useMemo(() => {
    let list = allHealthEntries;

    if (filterStatus !== "ALL") {
      list = list.filter((e) => e.derivedHealth === filterStatus);
    }
    if (filterCategory !== "ALL") {
      list = list.filter((e) => e.tool.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.tool.name.toLowerCase().includes(q) ||
          e.tool.key.toLowerCase().includes(q) ||
          e.tool.category.toLowerCase().includes(q)
      );
    }

    // Sort: broken/misconfigured first, then by status, then name
    const order: HealthStatus[] = [
      "BROKEN",
      "MISCONFIGURED",
      "DEPENDENCY_UNAVAILABLE",
      "ACCESS_BLOCKED",
      "UNKNOWN",
      "PARTIALLY_WORKING",
      "PLACEHOLDER",
      "COMING_SOON",
      "HEALTHY",
    ];
    return [...list].sort((a, b) => {
      const ai = order.indexOf(a.derivedHealth);
      const bi = order.indexOf(b.derivedHealth);
      if (ai !== bi) return ai - bi;
      return a.tool.name.localeCompare(b.tool.name);
    });
  }, [allHealthEntries, filterStatus, filterCategory, searchQuery]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastRefreshed(new Date());
      setIsRefreshing(false);
    }, 600);
  };

  const totalTools = allHealthEntries.length;
  const misconfigured = (summary["MISCONFIGURED"] || 0);
  const broken = (summary["BROKEN"] || 0);
  const alertCount = misconfigured + broken;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-slate-500 hover:text-slate-800 transition-colors"
            aria-label="Back to Admin"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Tool Health Center
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalTools} registered tools · Last updated {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {alertCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-bold">{alertCount} issue{alertCount !== 1 ? "s" : ""} need attention</span>
            </div>
          )}
          <button
            id="tool-health-refresh-btn"
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        <SummaryCard
          label="All Tools"
          count={totalTools}
          status={null}
          active={filterStatus === "ALL"}
          onClick={() => setFilterStatus("ALL")}
        />
        {(
          [
            ["Healthy", "HEALTHY"],
            ["Partial", "PARTIALLY_WORKING"],
            ["Broken", "BROKEN"],
            ["Misconfigured", "MISCONFIGURED"],
            ["Coming Soon", "COMING_SOON"],
            ["Placeholder", "PLACEHOLDER"],
            ["Access Blocked", "ACCESS_BLOCKED"],
            ["Unknown", "UNKNOWN"],
          ] as [string, HealthStatus][]
        ).map(([label, status]) =>
          (summary[status] || 0) > 0 || filterStatus === status ? (
            <SummaryCard
              key={status}
              label={label}
              count={summary[status] || 0}
              status={status}
              active={filterStatus === status}
              onClick={() => setFilterStatus(filterStatus === status ? "ALL" : status)}
            />
          ) : null
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            id="tool-health-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name or key…"
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-slate-700"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            id="tool-health-category-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-500">
            Showing <strong>{filtered.length}</strong> of <strong>{totalTools}</strong>
          </span>
        </div>
      </div>

      {/* Misconfiguration Alert Banner */}
      {misconfigured > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-200">
          <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-orange-800">
              {misconfigured} Misconfigured {misconfigured === 1 ? "Tool" : "Tools"} Detected
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              These tools are either enabled in feature flags but marked{" "}
              <code>coming_soon</code> in the registry, or vice versa. Resolve by updating
              the feature flag or tool status to match.
            </p>
          </div>
        </div>
      )}

      {/* Tool Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <div className="col-span-3">Tool</div>
          <div className="col-span-1">Category</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Access</div>
          <div className="col-span-2">Health</div>
          <div className="col-span-3">Reason</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">No tools match your filters</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("ALL");
                  setFilterCategory("ALL");
                }}
                className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filtered.map((entry) => {
              const CategoryIcon = CATEGORY_ICONS[entry.tool.category] || Layers;
              const isMisconfigured = entry.derivedHealth === "MISCONFIGURED";
              const isBroken = entry.derivedHealth === "BROKEN";

              return (
                <div
                  key={entry.tool.key}
                  id={`tool-health-row-${entry.tool.key}`}
                  className={`grid grid-cols-12 gap-2 px-5 py-3 text-xs items-center transition-colors ${
                    isMisconfigured || isBroken
                      ? "bg-red-50/40 hover:bg-red-50/80"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  {/* Tool Name + Key */}
                  <div className="col-span-3 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{entry.tool.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{entry.tool.key}</p>
                  </div>

                  {/* Category */}
                  <div className="col-span-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold">
                      <CategoryIcon className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate capitalize">{entry.tool.category}</span>
                    </span>
                  </div>

                  {/* Registry Status */}
                  <div className="col-span-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${
                        entry.tool.status === "available"
                          ? "bg-emerald-50 text-emerald-700"
                          : entry.tool.status === "beta"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {entry.tool.status === "coming_soon"
                        ? "Coming Soon"
                        : entry.tool.status.charAt(0).toUpperCase() + entry.tool.status.slice(1)}
                    </span>
                  </div>

                  {/* Access Mode */}
                  <div className="col-span-1">
                    <span className="text-[10px] font-semibold text-slate-600">
                      {entry.tool.defaultAccess === "SUBSCRIPTION" ? (
                        <span className="text-amber-700 font-bold">PRO</span>
                      ) : (
                        <span className="text-emerald-700">Free</span>
                      )}
                    </span>
                  </div>

                  {/* Health Badge */}
                  <div className="col-span-2">
                    <HealthBadge status={entry.derivedHealth} />
                    {entry.featureStatus && (
                      <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                        Flag: {entry.featureStatus}
                      </p>
                    )}
                  </div>

                  {/* Health Reason */}
                  <div className="col-span-3">
                    <p className="text-[11px] text-slate-600 leading-snug">{entry.healthReason}</p>
                    {isMisconfigured && (
                      <p className="text-[10px] text-orange-600 font-semibold mt-0.5">
                        ⚠ Action required: Align feature flag with registry status
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-end gap-1.5">
                    <Link
                      href={entry.tool.route}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition-colors"
                      title={`Open ${entry.tool.name}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <Link
                      href={`/admin/features?search=${entry.tool.key}`}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-500 hover:text-orange-600 transition-colors"
                      title="Manage Feature Flag"
                    >
                      <Zap className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-3 uppercase tracking-wider">Health Status Legend</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(HEALTH_CONFIG).map(([status, cfg]) => {
            const Icon = cfg.icon;
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
              </span>
            );
          })}
        </div>
        <div className="mt-3 space-y-1">
          {[
            ["HEALTHY", "Tool is available, enabled, and implementation is present"],
            ["PARTIALLY_WORKING", "Tool works but has known limitations (beta, maintenance)"],
            ["BROKEN", "Implementation error detected — do not enable for users"],
            ["COMING_SOON", "Not yet implemented — correctly shows Coming Soon UI to users"],
            ["MISCONFIGURED", "Feature flag and registry status are inconsistent — action required"],
            ["ACCESS_BLOCKED", "Disabled via Admin feature flag — not visible to users"],
            ["DEPENDENCY_UNAVAILABLE", "External service or dependency is unavailable"],
            ["UNKNOWN", "No health information available"],
          ].map(([s, desc]) => (
            <p key={s} className="text-[10px] text-slate-500">
              <strong className="text-slate-700">{s}:</strong> {desc}
            </p>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-500">
            <strong className="text-slate-700">Important:</strong> This dashboard derives health status
            from the canonical tool registry and feature flags. For runtime health testing with real
            file fixtures, use the{" "}
            <Link href="/admin/tools" className="text-blue-600 hover:underline">
              Tool Control Center
            </Link>
            . Health checks are never run on user documents.
          </p>
        </div>
      </div>
    </div>
  );
}
