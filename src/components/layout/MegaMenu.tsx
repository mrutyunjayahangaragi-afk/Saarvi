"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  FileImage,
  FileType,
  Combine,
  Scissors,
  FileDown,
  Repeat,
  RefreshCw,
  Maximize2,
  Layers,
  Camera,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Trash2,
  GripVertical,
  LayoutGrid,
  Minimize2,
  Calculator,
  Award,
  Percent,
  Clock,
  Calendar,
  CalendarDays,
  Briefcase,
  Trophy,
  Search,
  FileCheck2,
  ScanText,
  FileSearch,
  MessageSquare,
  Sliders,
  Sparkle
} from "lucide-react";
import {
  CANONICAL_TOOL_REGISTRY,
  CanonicalTool,
  CanonicalToolCategory,
  getCanonicalToolsByCategory,
  resolveToolState
} from "@/lib/tools/tool-registry";
import { FeatureFlag } from "@/types/admin";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  FileImage,
  FileType,
  Combine,
  Scissors,
  FileDown,
  Repeat,
  RefreshCw,
  Maximize2,
  Layers,
  Camera,
  GraduationCap,
  Sparkles,
  Trash2,
  GripVertical,
  LayoutGrid,
  Minimize2,
  Calculator,
  Award,
  Percent,
  Clock,
  Calendar,
  CalendarDays,
  Briefcase,
  Trophy,
  Search,
  FileCheck2,
  ScanText,
  FileSearch,
  MessageSquare,
  Sliders,
  Sparkle
};

export type ActiveMenuCategory = "tools" | "pdf" | "images" | "student" | "academic" | "career" | "ai" | null;

interface MegaMenuProps {
  activeCategory: ActiveMenuCategory;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

interface MenuItemProps {
  tool: CanonicalTool;
  featureFlag?: FeatureFlag;
  onClick?: () => void;
}

function MenuItem({ tool, featureFlag, onClick }: MenuItemProps) {
  const resolved = resolveToolState(tool, featureFlag);

  // If disabled by admin, do not render in public active mega menu
  if (!resolved.isEnabled) {
    return null;
  }

  const IconComponent = ICON_MAP[tool.icon] || FileText;
  const isSubscription = resolved.isSubscription;
  const isComingSoon = tool.status === "coming_soon";

  const handleClick = () => {
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'MEGA_MENU_TOOL_CLICK',
          toolId: tool.key,
          toolSlug: tool.key,
          metadata: { source: 'mega_menu', category: tool.category },
        }),
      }).catch(() => {});
    } catch {}
    if (onClick) onClick();
  };

  return (
    <Link
      href={tool.route}
      onClick={handleClick}
      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100/70 transition-all duration-150 relative cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-600 text-slate-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-xs">
        <IconComponent className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
            {tool.name}
          </span>
          {isSubscription && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-2xs shrink-0">
              PRO
            </span>
          )}
          {isComingSoon && (
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              Coming soon
            </span>
          )}
          {tool.badge && !isSubscription && !isComingSoon && (
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              {tool.badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-1 leading-snug">
          {tool.description}
        </p>
      </div>

      <ArrowRight className="w-3.5 h-3.5 text-blue-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0 mt-1" />
    </Link>
  );
}

export default function MegaMenu({
  activeCategory,
  onMouseEnter,
  onMouseLeave,
  onClose
}: MegaMenuProps) {
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlag>>({});
  const [navCategories, setNavCategories] = useState<any[]>([]);

  useEffect(() => {
    async function loadFlags() {
      try {
        const res = await fetch("/api/features", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.flags && Array.isArray(data.flags)) {
            const map: Record<string, FeatureFlag> = {};
            for (const f of data.flags) {
              map[f.id] = f;
              map[f.key] = f;
            }
            setFeatureFlags(map);
          }
        }
      } catch {
        // Fallback to defaults
      }
    }

    async function loadNavigation() {
      try {
        const res = await fetch("/api/navigation", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.categories && Array.isArray(data.categories)) {
            setNavCategories(data.categories);
          }
        }
      } catch {
        // Fallback to registry
      }
    }

    loadFlags();
    loadNavigation();
  }, []);

  if (!activeCategory) return null;

  const getToolsForCategory = (catId: string, fallbackTools: CanonicalTool[]): CanonicalTool[] => {
    const cat = navCategories.find((c: any) => c.id === catId);
    if (!cat || !cat.tools || cat.tools.length === 0) {
      return fallbackTools;
    }
    return cat.tools
      .filter((t: any) => t.visibleInMegaMenu !== false && t.status !== 'DISABLED')
      .map((t: any) => {
        const canonical = CANONICAL_TOOL_REGISTRY.find((c) => c.key === t.key);
        if (!canonical) return null;
        return {
          ...canonical,
          badge: t.badge !== undefined ? t.badge : canonical.badge,
        };
      })
      .filter(Boolean) as CanonicalTool[];
  };

  const pdfTools = getToolsForCategory("pdf", getCanonicalToolsByCategory("pdf"));
  const imageTools = getToolsForCategory("image", getCanonicalToolsByCategory("image"));
  const academicTools = getToolsForCategory("academic", getCanonicalToolsByCategory("academic"));
  const studentTools = getToolsForCategory("student", getCanonicalToolsByCategory("student"));
  const careerTools = getToolsForCategory("career", getCanonicalToolsByCategory("career"));
  const aiTools = getToolsForCategory("ai", getCanonicalToolsByCategory("ai"));

  return (
    <div
      role="region"
      aria-label="Navigation mega menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute top-full left-0 right-0 z-50 pt-2 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Invisible hover bridge to prevent flickering while cursor crosses the gap */}
      <div className="absolute top-0 left-0 right-0 h-3" />

      {/* Mega Menu Surface */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-7 relative overflow-hidden">
          {/* Subtle top indicator bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-90" />

          {/* 1. COMPREHENSIVE TOOLS MEGA MENU (6 Categories) */}
          {activeCategory === "tools" && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {/* Column 1: PDF Tools */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    PDF Tools
                  </h3>
                  <Link
                    href="/tools?category=pdf"
                    onClick={onClose}
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    All →
                  </Link>
                </div>
                <div className="space-y-1">
                  {pdfTools.slice(0, 5).map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>

              {/* Column 2: Image Tools */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Image Tools
                  </h3>
                  <Link
                    href="/tools?category=image"
                    onClick={onClose}
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    All →
                  </Link>
                </div>
                <div className="space-y-1">
                  {imageTools.slice(0, 5).map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>

              {/* Column 3: Academic Tools */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Academic
                  </h3>
                  <Link
                    href="/student/sgpa-calculator"
                    onClick={onClose}
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    SGPA →
                  </Link>
                </div>
                <div className="space-y-1">
                  {academicTools.map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>

              {/* Column 4: Student Tools */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Student
                  </h3>
                  <Link
                    href="/student"
                    onClick={onClose}
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    Hub →
                  </Link>
                </div>
                <div className="space-y-1">
                  {studentTools.slice(0, 5).map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>

              {/* Column 5: Career Tools */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Career
                  </h3>
                  <Link
                    href="/student/resume"
                    onClick={onClose}
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    Resume →
                  </Link>
                </div>
                <div className="space-y-1">
                  {careerTools.slice(0, 5).map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>

              {/* Column 6: AI Tools */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    <span>AI & OCR</span>
                  </h3>
                  <Link
                    href="/student/copilot"
                    onClick={onClose}
                    className="text-[10px] font-semibold text-purple-600 hover:underline"
                  >
                    Copilot →
                  </Link>
                </div>
                <div className="space-y-1">
                  {aiTools.slice(0, 5).map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. SPECIFIC PDF MENU */}
          {activeCategory === "pdf" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Organize & Edit
                </h3>
                <div className="space-y-1">
                  {pdfTools
                    .filter((t) => ["merge-pdf", "split-pdf", "reorder-pdf", "delete-pdf-pages"].includes(t.key))
                    .map((t) => (
                      <MenuItem
                        key={t.key}
                        tool={t}
                        featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                        onClick={onClose}
                      />
                    ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Convert from PDF
                </h3>
                <div className="space-y-1">
                  {pdfTools
                    .filter((t) => ["pdf-to-jpg", "pdf-to-png"].includes(t.key))
                    .map((t) => (
                      <MenuItem
                        key={t.key}
                        tool={t}
                        featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                        onClick={onClose}
                      />
                    ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Optimize & Secure
                </h3>
                <div className="space-y-1">
                  {pdfTools
                    .filter((t) => ["compress-pdf", "rotate-pdf", "watermark-pdf"].includes(t.key))
                    .map((t) => (
                      <MenuItem
                        key={t.key}
                        tool={t}
                        featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                        onClick={onClose}
                      />
                    ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Client-Side Security
                </h3>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-slate-800">Zero Cloud Upload</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    All PDF rendering, extraction, and page manipulations execute 100% inside your browser WebAssembly sandbox.
                  </p>
                  <Link
                    href="/tools?category=pdf"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline pt-1"
                  >
                    <span>View all PDF tools</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* 3. SPECIFIC IMAGE MENU */}
          {activeCategory === "images" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Convert to PDF
                </h3>
                <div className="space-y-1">
                  {imageTools
                    .filter((t) => ["jpg-to-pdf", "image-to-pdf", "multiple-images-to-pdf"].includes(t.key))
                    .map((t) => (
                      <MenuItem
                        key={t.key}
                        tool={t}
                        featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                        onClick={onClose}
                      />
                    ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Format Conversion
                </h3>
                <div className="space-y-1">
                  {imageTools
                    .filter((t) => ["png-to-jpg", "jpg-to-png", "svg-to-png", "heic-to-jpg"].includes(t.key))
                    .map((t) => (
                      <MenuItem
                        key={t.key}
                        tool={t}
                        featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                        onClick={onClose}
                      />
                    ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Adjust & Compress
                </h3>
                <div className="space-y-1">
                  {imageTools
                    .filter((t) => ["image-resize", "crop-image", "compress-image"].includes(t.key))
                    .map((t) => (
                      <MenuItem
                        key={t.key}
                        tool={t}
                        featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                        onClick={onClose}
                      />
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. SPECIFIC STUDENT MENU */}
          {activeCategory === "student" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Academic Intelligence
                </h3>
                <div className="space-y-1">
                  {academicTools.map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Career & Placement
                </h3>
                <div className="space-y-1">
                  {careerTools.map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Planning & Productivity
                </h3>
                <div className="space-y-1">
                  {studentTools.slice(0, 5).map((t) => (
                    <MenuItem
                      key={t.key}
                      tool={t}
                      featureFlag={featureFlags[t.featureFlagKey] || featureFlags[t.key]}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
