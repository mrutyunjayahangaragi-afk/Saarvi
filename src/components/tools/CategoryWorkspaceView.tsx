"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FileImage,
  GraduationCap,
  Briefcase,
  Sparkles,
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  ChevronRight,
  Filter,
  CheckCircle2,
  X,
  Layers
} from "lucide-react";
import {
  CANONICAL_TOOL_REGISTRY,
  CanonicalTool,
  CanonicalToolCategory,
  resolveToolState
} from "@/lib/tools/tool-registry";
import { getStartupFeatures } from "@/lib/api/request-coalesce";
import { FeatureFlag } from "@/types/admin";

interface CategoryWorkspaceViewProps {
  category: "pdf" | "image" | "student" | "career";
  title: string;
  tagline: string;
  description: string;
  iconName: "FileText" | "FileImage" | "GraduationCap" | "Briefcase";
  popularKeys?: string[];
  faqItems?: Array<{ q: string; a: string }>;
}

const CATEGORY_TABS = [
  { key: "pdf", label: "PDF Tools", href: "/pdf", icon: FileText, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800" },
  { key: "image", label: "Image Tools", href: "/images", icon: FileImage, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800" },
  { key: "student", label: "Student Tools", href: "/student-tools", icon: GraduationCap, color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800" },
  { key: "career", label: "Jobs & Career", href: "/jobs", icon: Briefcase, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800" },
  { key: "all", label: "All Tools", href: "/tools", icon: Layers, color: "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
];

export default function CategoryWorkspaceView({
  category,
  title,
  tagline,
  description,
  iconName,
  popularKeys = [],
  faqItems = [],
}: CategoryWorkspaceViewProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "guest" | "pro">("all");
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlag>>({});

  // SWR-cached feature flags and tool controls
  useEffect(() => {
    let mounted = true;
    async function loadFlags() {
      try {
        const res = await getStartupFeatures();
        const flagsList = Array.isArray(res?.flags) ? res.flags : [];
        if (mounted && flagsList.length > 0) {
          const map: Record<string, FeatureFlag> = {};
          flagsList.forEach((f: any) => {
            if (f?.key) map[f.key] = f;
          });
          setFeatureFlags(map);
        }
      } catch (err) {
        console.warn("Failed to load feature flags for category workspace:", err);
      }
    }
    loadFlags();
    return () => {
      mounted = false;
    };
  }, []);

  // Filter tools belonging to this category
  const categoryTools = useMemo(() => {
    let matches: CanonicalTool[] = [];
    if (category === "student") {
      matches = CANONICAL_TOOL_REGISTRY.filter(
        (t) => t.category === "student" || t.category === "academic"
      );
    } else {
      matches = CANONICAL_TOOL_REGISTRY.filter((t) => t.category === category);
    }

    // Filter out disabled tools according to Admin Tool Control & Feature Flags
    return matches.filter((tool) => {
      const flag = featureFlags[tool.featureFlagKey] || featureFlags[tool.key];
      const resolved = resolveToolState(tool, flag);
      return resolved.isEnabled;
    });
  }, [category, featureFlags]);

  // Featured / Popular tools for quick actions row
  const popularTools = useMemo(() => {
    if (popularKeys.length > 0) {
      const keySet = new Set(popularKeys);
      const customMatches = categoryTools.filter((t) => keySet.has(t.key));
      if (customMatches.length > 0) return customMatches;
    }
    return categoryTools.filter((t) => t.popular).slice(0, 4);
  }, [categoryTools, popularKeys]);

  // Filtered tools based on in-category search and access filter
  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return categoryTools.filter((tool) => {
      const flag = featureFlags[tool.featureFlagKey] || featureFlags[tool.key];
      const resolved = resolveToolState(tool, flag);

      if (activeFilter === "pro" && !resolved.isSubscription) return false;
      if (activeFilter === "guest" && resolved.isSubscription) return false;

      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        (tool.keywords && tool.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    });
  }, [categoryTools, searchQuery, activeFilter, featureFlags]);

  const IconComponent =
    iconName === "FileText"
      ? FileText
      : iconName === "FileImage"
      ? FileImage
      : iconName === "GraduationCap"
      ? GraduationCap
      : Briefcase;

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <Link href="/tools" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Tools
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">{title}</span>
      </nav>

      {/* 2. Category Workspace Switcher Header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200/80 dark:border-slate-800">
        {CATEGORY_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-slate-900 dark:bg-blue-600 text-white shadow-xs"
                  : "bg-white dark:bg-[#111c38] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* 3. Hero Section */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50/60 to-blue-50/30 dark:from-[#111c38] dark:via-[#111c38] dark:to-blue-950/30 border border-slate-200/80 dark:border-slate-800 p-8 sm:p-12 shadow-xs">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <IconComponent className="w-3.5 h-3.5" />
            <span>{tagline}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
            {description}
          </p>

          {/* Trust Invariants */}
          <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Client-Side Local Sandbox</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-500" />
              <span>Instant Local Processing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              <span>No Account Required for Guest Tools</span>
            </div>
          </div>
        </div>
      </header>

      {/* 4. Popular / Quick Actions Row */}
      {popularTools.length > 0 && (
        <section aria-label="Popular Quick Actions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Popular Quick Actions
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Fast entry points</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {popularTools.map((tool) => (
              <Link
                key={tool.key}
                href={tool.route}
                className="p-4 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 hover:shadow-xs transition-all group flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                    {tool.name}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 block">
                    {tool.description}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                    Launch →
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 5. In-Category Search & Filters */}
      <section aria-label="Search category tools" className="space-y-6 pt-4 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium shrink-0 self-start sm:self-auto border border-transparent dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilter === "all"
                  ? "bg-white dark:bg-[#111c38] text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All ({categoryTools.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("guest")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilter === "guest"
                  ? "bg-white dark:bg-[#111c38] text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Guest Free
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("pro")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilter === "pro"
                  ? "bg-white dark:bg-[#111c38] text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Pro
            </button>
          </div>
        </div>

        {/* 6. Tool Cards Grid */}
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => {
              const flag = featureFlags[tool.featureFlagKey] || featureFlags[tool.key];
              const resolved = resolveToolState(tool, flag);
              const isPro = resolved.isSubscription;

              return (
                <div
                  key={tool.key}
                  className="p-5 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/80 dark:hover:border-blue-500/80 hover:shadow-xs transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {tool.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {tool.popular && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Featured
                          </span>
                        )}
                        {isPro ? (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                            PRO
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Guest
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      {tool.workerMode === "client" ? "Local Browser Processing" : "Saarvi Secure Engine"}
                    </span>
                    <Link
                      href={tool.route}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all"
                    >
                      <span>Try Tool</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No matching {title.toLowerCase()} found.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Try searching with different keywords or explore our complete catalog.
            </p>
            <div className="pt-2">
              <Link
                href="/tools"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors"
              >
                <span>Browse All Saarvi Tools</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 7. Helpful Information / FAQ */}
      {faqItems.length > 0 && (
        <section aria-label="Helpful guidance" className="space-y-4 pt-8 border-t border-slate-200/80 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqItems.map((faq, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
              >
                <h3 className="font-bold text-slate-900 dark:text-white">{faq.q}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Related Workspaces & Next Steps */}
      <section aria-label="Next steps" className="rounded-3xl bg-slate-900 text-white p-8 sm:p-10 space-y-4">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-xl font-bold tracking-tight">
            Looking for something else?
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Saarvi offers integrated student calculators, document converters, and verified job discovery. Explore other specialized workspaces or browse the master catalog.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/tools"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Explore All Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/jobs"
            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Jobs & Internships</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
