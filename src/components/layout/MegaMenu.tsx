"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Sparkle,
  Lock,
  Unlock,
  Table,
  FileSpreadsheet,
  FileCode,
  Presentation,
  ShieldCheck,
  Zap,
  Star,
  Flame,
  CheckCircle2,
  X,
  Stamp,
  Heading,
  Tags,
  Info,
  ListOrdered,
  Scan,
  FileCheck,
} from "lucide-react";
import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_MAP,
  CanonicalTool,
  resolveToolState,
} from "@/lib/tools/tool-registry";
import { FeatureFlag } from "@/types/admin";
import { getStartupFeatures, getStartupNavigation } from "@/lib/api/request-coalesce";
import {
  SmartNavToolItem,
  SmartNavCategory,
  deriveCanonicalSubcategory,
} from "@/lib/navigation/tool-discovery-service";

// ─── Canonical Icon Map ───────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  FileText, FileImage, FileType, Combine, Scissors, FileDown, Repeat,
  RefreshCw, Maximize2, Layers, Camera, GraduationCap, Sparkles, Trash2,
  GripVertical, LayoutGrid, Minimize2, Calculator, Award, Percent, Clock,
  Calendar, CalendarDays, Briefcase, Trophy, Search, FileCheck2, ScanText,
  FileSearch, MessageSquare, Sliders, Sparkle, Lock, Unlock, Table,
  FileSpreadsheet, FileCode, Presentation, ShieldCheck, Zap, Star, Flame,
  Stamp, Heading, Tags, Info, ListOrdered, Scan, FileCheck,
};

export type ActiveMenuCategory = "tools" | "pdf" | "images" | "student" | "academic" | "career" | "ai" | null;

export type ToolsLauncherCategory = "essential" | "pdf" | "images" | "student" | "career" | "ai";

export interface CategoryTabConfig {
  id: ToolsLauncherCategory;
  label: string;
  icon: React.ElementType;
  title: string;
  description: string;
  viewAllRoute: string;
  viewAllLabel: string;
  colorClass: string;
  activeBadgeBg: string;
}

export const CATEGORY_TABS: CategoryTabConfig[] = [
  {
    id: "essential",
    label: "Essential Tools",
    icon: Zap,
    title: "ESSENTIAL TOOLS",
    description: "Quick access to Saarvi's everyday tools.",
    viewAllRoute: "/tools",
    viewAllLabel: "View All Saarvi Tools",
    colorClass: "text-amber-500",
    activeBadgeBg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: FileText,
    title: "PDF TOOLS",
    description: "Convert, organize, compress and work with PDF files.",
    viewAllRoute: "/pdf",
    viewAllLabel: "View All PDF Tools",
    colorClass: "text-red-500",
    activeBadgeBg: "bg-red-50 text-red-700 border-red-200",
  },
  {
    id: "images",
    label: "Images",
    icon: FileImage,
    title: "IMAGE TOOLS",
    description: "Convert, compress, resize and optimize images with ease.",
    viewAllRoute: "/images",
    viewAllLabel: "View All Image Tools",
    colorClass: "text-sky-500",
    activeBadgeBg: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    id: "student",
    label: "Student",
    icon: GraduationCap,
    title: "STUDENT TOOLS",
    description: "Academic calculators, study organizers, and campus utilities.",
    viewAllRoute: "/student-tools",
    viewAllLabel: "View All Student Tools",
    colorClass: "text-indigo-500",
    activeBadgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "career",
    label: "Career",
    icon: Briefcase,
    title: "CAREER TOOLS",
    description: "Build resumes, prepare for interviews, and track job applications.",
    viewAllRoute: "/career",
    viewAllLabel: "View All Career Tools",
    colorClass: "text-emerald-500",
    activeBadgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "ai",
    label: "AI & OCR",
    icon: Sparkles,
    title: "AI & OCR TOOLS",
    description: "Artificial intelligence, OCR extraction, and document intelligence.",
    viewAllRoute: "/tools?category=ai",
    viewAllLabel: "View All AI & OCR Tools",
    colorClass: "text-purple-500",
    activeBadgeBg: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

export interface MegaMenuProps {
  activeCategory: ActiveMenuCategory;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  onOpenSearch?: () => void;
  essentialTools?: Array<SmartNavToolItem | CanonicalTool | any>;
}

interface SmartToolCardProps {
  tool: SmartNavToolItem | CanonicalTool;
  onClick?: () => void;
  compact?: boolean;
}

// ─── Subcategory Definitions (Ordered by Scan Priority) ───────────────────────
export const PDF_SUBCAT_DEFS = [
  { id: "organize", label: "Organize", color: "text-blue-600" },
  { id: "convert-to", label: "Convert to PDF", color: "text-emerald-600" },
  { id: "convert-from", label: "Convert from PDF", color: "text-red-600" },
  { id: "optimize", label: "Optimize & Edit", color: "text-amber-600" },
  { id: "security", label: "Security", color: "text-purple-600" },
  { id: "inspect", label: "Inspect & Info", color: "text-slate-600" },
];

export const IMAGE_SUBCAT_DEFS = [
  { id: "convert", label: "Convert Format", color: "text-blue-600" },
  { id: "optimize", label: "Optimize & Edit", color: "text-emerald-600" },
  { id: "scan", label: "Scan & PDF", color: "text-amber-600" },
];

export const STUDENT_SUBCAT_DEFS = [
  { id: "academic", label: "Academic Calculators", color: "text-indigo-600" },
  { id: "planning", label: "Planning & Schedule", color: "text-blue-600" },
];

export const CAREER_SUBCAT_DEFS = [
  { id: "career", label: "Career & Placement", color: "text-emerald-600" },
];

export const AI_SUBCAT_DEFS = [
  { id: "ai", label: "AI Intelligence & OCR", color: "text-purple-600" },
];

// ─── Dynamic Subcategory Group Builder ────────────────────────────────────────
function groupToolsBySubcategory(
  tools: SmartNavToolItem[],
  defs: Array<{ id: string; label: string; color: string }>
): Array<{ id: string; label: string; color: string; tools: SmartNavToolItem[] }> {
  const groups: Array<{ id: string; label: string; color: string; tools: SmartNavToolItem[] }> = [];
  const assigned = new Set<string>();

  for (const def of defs) {
    const matching = tools.filter((t) => {
      const sub = t.subcategory || deriveCanonicalSubcategory(t.key, t.category);
      return sub === def.id;
    });
    if (matching.length > 0) {
      matching.forEach((t) => assigned.add(t.key));
      groups.push({ id: def.id, label: def.label, color: def.color, tools: matching });
    }
  }

  // Leftover tools fallback
  const remaining = tools.filter((t) => !assigned.has(t.key));
  if (remaining.length > 0) {
    groups.push({ id: "other", label: "Other Tools", color: "text-slate-500", tools: remaining });
  }

  return groups;
}

// ─── Helper to Convert CanonicalTool → SmartNavToolItem ───────────────────────
function toSmartItem(t: CanonicalTool): SmartNavToolItem {
  return {
    key: t.key,
    name: t.name,
    description: t.description,
    category: t.category,
    subcategory: t.subcategory || deriveCanonicalSubcategory(t.key, t.category),
    route: t.route,
    icon: t.icon,
    position: 0,
    isFeatured: false,
    isMostUsed: false,
    badge: t.badge || null,
    successfulUses: 0,
    uniqueUsers: 0,
    guestAllowed: t.defaultAccess !== "SUBSCRIPTION",
    freeAllowed: t.defaultAccess !== "SUBSCRIPTION",
    requiresPro: t.defaultAccess === "SUBSCRIPTION",
    isBeta: t.status === "beta",
    status: t.status === "coming_soon" ? "COMING_SOON" : t.status === "beta" ? "BETA" : "ACTIVE",
    isEnabled: t.status !== "coming_soon",
  };
}

// ─── Smart Tool Card Component ────────────────────────────────────────────────
export function SmartToolCard({ tool, onClick, compact = false }: SmartToolCardProps) {
  const IconComponent = ICON_MAP[tool.icon] || FileText;

  const isFeatured = "isFeatured" in tool ? Boolean(tool.isFeatured) : false;
  const isMostUsed = "isMostUsed" in tool ? Boolean(tool.isMostUsed) : false;
  const requiresPro =
    "requiresPro" in tool
      ? Boolean(tool.requiresPro)
      : "defaultAccess" in tool && tool.defaultAccess === "SUBSCRIPTION";
  const isBeta = "isBeta" in tool ? Boolean(tool.isBeta) : tool.status === "beta";
  const isComingSoon = tool.status === "coming_soon";

  const handleClick = () => {
    try {
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "MEGA_MENU_TOOL_CLICK",
          toolId: tool.key,
          toolSlug: tool.key,
          metadata: { source: "mega_menu", category: tool.category },
        }),
      }).catch(() => {});
    } catch {}
    if (onClick) onClick();
  };

  return (
    <Link
      href={tool.route}
      onClick={handleClick}
      id={`nav-tool-${tool.key}`}
      className={`group flex items-start gap-2 rounded-lg transition-all duration-150 relative cursor-pointer ${
        compact
          ? "p-1.5 hover:bg-slate-50"
          : "p-2 hover:bg-slate-100/80 rounded-xl"
      }`}
    >
      {/* 20px Icon container */}
      <div
        className={`rounded-md flex items-center justify-center shrink-0 transition-colors shadow-xs mt-0.5 ${
          compact
            ? "w-5 h-5 bg-slate-100 group-hover:bg-blue-600 text-slate-600 group-hover:text-white"
            : "w-7 h-7 bg-slate-100 group-hover:bg-blue-600 text-slate-500 group-hover:text-white rounded-lg"
        }`}
      >
        <IconComponent
          className={`transition-transform group-hover:scale-105 ${
            compact ? "w-3 h-3" : "w-3.5 h-3.5"
          }`}
        />
      </div>

      {/* Metadata */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className={`font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate ${
              compact ? "text-[12.5px]" : "text-xs font-semibold"
            }`}
          >
            {tool.name}
          </span>

          {isFeatured && (
            <span className="text-[8.5px] font-bold tracking-tight px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center gap-0.5 shrink-0">
              <Star className="w-2 h-2 fill-purple-600 text-purple-600" />
              <span>Featured</span>
            </span>
          )}
          {!isFeatured && isMostUsed && (
            <span className="text-[8.5px] font-bold tracking-tight px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-0.5 shrink-0">
              <Flame className="w-2 h-2 fill-emerald-600 text-emerald-600" />
              <span>Most Used</span>
            </span>
          )}
          {requiresPro && (
            <span className="text-[8.5px] font-bold uppercase px-1 py-0.2 rounded bg-gradient-to-r from-amber-500 to-amber-600 text-white shrink-0">
              PRO
            </span>
          )}
          {isBeta && !requiresPro && (
            <span className="text-[8.5px] font-semibold uppercase px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              Beta
            </span>
          )}
          {isComingSoon && (
            <span className="text-[8.5px] font-semibold uppercase px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              Soon
            </span>
          )}
        </div>

        {/* Max 1 short line description */}
        <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight group-hover:text-slate-500 transition-colors">
          {tool.description}
        </p>
      </div>

      {!compact && (
        <ArrowRight className="w-3 h-3 text-blue-500 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0 mt-1.5" />
      )}
    </Link>
  );
}

// ─── Navbar 7.0 Essential Tool Card Component (Section 10, 12) ───────────────
export function EssentialToolCard({
  tool,
  onClick,
}: {
  tool: SmartNavToolItem | CanonicalTool | any;
  onClick?: () => void;
}) {
  const IconComponent = ICON_MAP[tool.icon] || FileText;

  let catLabel = "Tool";
  let catBadgeClass = "bg-slate-100 text-slate-600 border-slate-200";
  if (tool.category === "pdf") {
    catLabel = "PDF";
    catBadgeClass = "bg-red-50 text-red-700 border-red-200/80";
  } else if (tool.category === "image") {
    catLabel = "Image";
    catBadgeClass = "bg-sky-50 text-sky-700 border-sky-200/80";
  } else if (tool.category === "student" || tool.category === "academic") {
    catLabel = "Student";
    catBadgeClass = "bg-indigo-50 text-indigo-700 border-indigo-200/80";
  } else if (tool.category === "career") {
    catLabel = "Career";
    catBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
  } else if (tool.category === "ai") {
    catLabel = "AI";
    catBadgeClass = "bg-purple-50 text-purple-700 border-purple-200/80";
  }

  // Section 7 & 42: Honest badge labeling
  const isPinnedOrAdmin = Boolean(tool.isPinned || tool.isEssential);
  const isGenuinelyMostUsed = Boolean(
    tool.isMostUsed && !isPinnedOrAdmin && ((tool.successfulUses || 0) > 0)
  );
  const requiresPro =
    "requiresPro" in tool
      ? Boolean(tool.requiresPro)
      : "defaultAccess" in tool && tool.defaultAccess === "SUBSCRIPTION";

  const handleClick = () => {
    try {
      fetch("/api/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "NAVBAR_ESSENTIAL_TOOL_CLICK",
          toolId: tool.key,
          toolSlug: tool.key,
          metadata: { source: "navbar_essential_menu", category: tool.category },
        }),
      }).catch(() => {});
    } catch {}
    if (onClick) onClick();
  };

  return (
    <Link
      href={tool.route}
      onClick={handleClick}
      id={`nav-essential-${tool.key}`}
      className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {/* 20px Icon inside 32px rounded container */}
        <div className="w-8 h-8 rounded-lg bg-slate-100/90 text-slate-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-150 shadow-2xs">
          <IconComponent className="w-4 h-4 transition-transform group-hover:scale-110" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
              {tool.name}
            </span>

            {isPinnedOrAdmin && (
              <span className="text-[8.5px] font-semibold tracking-tight px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200/70 shrink-0">
                Admin Essential
              </span>
            )}
            {isGenuinelyMostUsed && (
              <span className="text-[8.5px] font-semibold tracking-tight px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0 flex items-center gap-0.5">
                <Flame className="w-2 h-2 fill-emerald-600 text-emerald-600" />
                <span>Most Used</span>
              </span>
            )}
            {requiresPro && (
              <span className="text-[8.5px] font-bold uppercase px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500 to-amber-600 text-white shrink-0">
                PRO
              </span>
            )}
          </div>

          {/* Section 12: ONE short description */}
          <p className="text-[11px] text-slate-400 group-hover:text-slate-500 transition-colors truncate mt-0.5">
            {tool.description || `${tool.name} utility`}
          </p>
        </div>
      </div>

      {/* Section 10: Mini category badge */}
      <span
        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border shrink-0 uppercase tracking-wider ${catBadgeClass}`}
      >
        {catLabel}
      </span>
    </Link>
  );
}

// ─── Compact Quick Access Strip ───────────────────────────────────────────────
function QuickAccessStrip({
  tools,
  onClose,
}: {
  tools: Array<SmartNavToolItem | CanonicalTool>;
  onClose: () => void;
}) {
  if (!tools || tools.length === 0) return null;

  const quickTools = tools
    .filter((t) => ("isFeatured" in t && t.isFeatured) || ("isMostUsed" in t && t.isMostUsed))
    .slice(0, 6);

  if (quickTools.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-1 py-2 border-b border-slate-100 mb-3 overflow-x-auto">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
        <Zap className="w-3 h-3 text-amber-500" />
        Quick Access:
      </span>
      <div className="flex items-center gap-1.5 flex-nowrap">
        {quickTools.map((tool) => {
          const isFeatured = "isFeatured" in tool && tool.isFeatured;
          const isMostUsed = "isMostUsed" in tool && tool.isMostUsed;
          return (
            <Link
              key={tool.key}
              href={tool.route}
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition-colors border border-slate-200/80 shrink-0"
            >
              {isFeatured && <Star className="w-2.5 h-2.5 text-purple-600 fill-purple-600 shrink-0" />}
              {!isFeatured && isMostUsed && <Flame className="w-2.5 h-2.5 text-emerald-600 fill-emerald-600 shrink-0" />}
              <span>{tool.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Category Search Input Component ──────────────────────────────────────────
function CategorySearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-14 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 placeholder:text-slate-400 text-slate-700 transition-all"
        aria-label={placeholder}
        autoComplete="off"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-slate-400 hover:text-slate-700 cursor-pointer pointer-events-auto"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-block text-[9.5px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-400 font-mono shadow-xs">
            ⌘K
          </kbd>
        )}
      </div>
    </div>
  );
}

// ─── Subgroup Section Component ───────────────────────────────────────────────
function SubgroupSection({
  label,
  colorClass,
  tools,
  onClose,
  compact = false,
}: {
  label: string;
  colorClass: string;
  tools: Array<SmartNavToolItem | CanonicalTool>;
  onClose: () => void;
  compact?: boolean;
}) {
  if (!tools || tools.length === 0) return null;
  return (
    <div className="space-y-0.5 mb-3 last:mb-0">
      <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 px-1 ${colorClass}`}>
        {label}
      </p>
      {tools.map((tool) => (
        <SmartToolCard key={tool.key} tool={tool} onClick={onClose} compact={compact} />
      ))}
    </div>
  );
}

// ─── Main MegaMenu 5.0 Component ──────────────────────────────────────────────
export default function MegaMenu({
  activeCategory,
  onMouseEnter,
  onMouseLeave,
  onClose,
  onOpenSearch,
  essentialTools,
}: MegaMenuProps) {
  const [navData, setNavData] = useState<{
    categories: SmartNavCategory[];
    globalTools: any;
    windowDays: number;
    essentialTools?: SmartNavToolItem[];
  }>({ categories: [], globalTools: null, windowDays: 30 });

  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<ToolsLauncherCategory>("essential");

  // Sync activeTab with activeCategory prop
  useEffect(() => {
    if (activeCategory === "pdf") setActiveTab("pdf");
    else if (activeCategory === "images") setActiveTab("images");
    else if (activeCategory === "student" || activeCategory === "academic") setActiveTab("student");
    else if (activeCategory === "career") setActiveTab("career");
    else if (activeCategory === "ai") setActiveTab("ai");
    else setActiveTab("essential");
  }, [activeCategory]);

  // Load coalesced navigation snapshot
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const data = await getStartupNavigation();
        if (!mounted) return;
        if (data && Array.isArray(data.categories)) {
          setNavData({
            categories: data.categories,
            globalTools: data.globalTools || null,
            windowDays: data.windowDays || 30,
          });
        }
      } catch (err) {
        console.warn("[MegaMenu] Navigation snapshot error:", err);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // Reset search when active category changes
  useEffect(() => {
    setSearchFilter("");
  }, [activeCategory]);

  // ─── Resolve category allTools with canonical fallback ──────────────────────
  const resolveAllTools = (
    catIds: string[],
    canonicalCategories: string[]
  ): SmartNavToolItem[] => {
    for (const catId of catIds) {
      const found = navData.categories.find((c) => c.id === catId);
      if (found && found.allTools && found.allTools.length > 0) {
        return found.allTools;
      }
    }
    return CANONICAL_TOOL_REGISTRY.filter((t) =>
      canonicalCategories.includes(t.category)
    ).map(toSmartItem);
  };

  // ─── Categorized Tools (Memoized unconditionally) ──────────────────────────
  const pdfAllTools = useMemo(() => resolveAllTools(["pdf"], ["pdf"]), [navData.categories]);
  const imageAllTools = useMemo(() => resolveAllTools(["images", "image"], ["image"]), [navData.categories]);
  const studentAcademicTools = useMemo(() => resolveAllTools(["student"], ["academic"]), [navData.categories]);
  const studentPlanningTools = useMemo(() => resolveAllTools(["student"], ["student"]), [navData.categories]);
  const studentAllTools = useMemo(() => [...studentAcademicTools, ...studentPlanningTools], [studentAcademicTools, studentPlanningTools]);
  const careerAllTools = useMemo(() => resolveAllTools(["career"], ["career"]), [navData.categories]);
  const aiAllTools = useMemo(() => resolveAllTools(["ai"], ["ai"]), [navData.categories]);

  // All combined tools across all categories
  const allSaarviTools = useMemo(
    () => [...pdfAllTools, ...imageAllTools, ...studentAllTools, ...careerAllTools, ...aiAllTools],
    [pdfAllTools, imageAllTools, studentAllTools, careerAllTools, aiAllTools]
  );

  // Subgroup groups derived dynamically from tool.subcategory
  const pdfSubgroups = useMemo(() => groupToolsBySubcategory(pdfAllTools, PDF_SUBCAT_DEFS), [pdfAllTools]);
  const imageSubgroups = useMemo(() => groupToolsBySubcategory(imageAllTools, IMAGE_SUBCAT_DEFS), [imageAllTools]);
  const studentSubgroups = useMemo(() => groupToolsBySubcategory(studentAllTools, STUDENT_SUBCAT_DEFS), [studentAllTools]);
  const careerSubgroups = useMemo(() => groupToolsBySubcategory(careerAllTools, CAREER_SUBCAT_DEFS), [careerAllTools]);
  const aiSubgroups = useMemo(() => groupToolsBySubcategory(aiAllTools, AI_SUBCAT_DEFS), [aiAllTools]);

  // ─── Filtered Tools for Search Mode ─────────────────────────────────────────
  const filteredAllTools = useMemo(() => {
    if (!searchFilter.trim()) return allSaarviTools;
    const q = searchFilter.toLowerCase().trim();
    return allSaarviTools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [allSaarviTools, searchFilter]);

  const filteredPdfTools = useMemo(() => {
    if (!searchFilter.trim()) return pdfAllTools;
    const q = searchFilter.toLowerCase().trim();
    return pdfAllTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [pdfAllTools, searchFilter]);

  const filteredImageTools = useMemo(() => {
    if (!searchFilter.trim()) return imageAllTools;
    const q = searchFilter.toLowerCase().trim();
    return imageAllTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [imageAllTools, searchFilter]);

  const filteredStudentTools = useMemo(() => {
    if (!searchFilter.trim()) return studentAllTools;
    const q = searchFilter.toLowerCase().trim();
    return studentAllTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [studentAllTools, searchFilter]);

  const quickFeaturedTools = useMemo(
    () => allSaarviTools.filter((t) => t.isFeatured || t.isMostUsed).slice(0, 6),
    [allSaarviTools]
  );

  // Section 3 & 8: Essential tools selection (Strict max 6 tools)
  const activeEssentialTools = useMemo(() => {
    if (essentialTools && essentialTools.length > 0) {
      return essentialTools.slice(0, 6);
    }
    const fromFeatured = allSaarviTools.filter(
      (t) => (t.isEssential || t.isFeatured || t.isMostUsed) && t.status !== "coming_soon" && t.status !== "disabled"
    );
    if (fromFeatured.length >= 6) {
      return fromFeatured.slice(0, 6);
    }
    const fallbackKeys = [
      "merge-pdf",
      "compress-pdf",
      "pdf-to-jpg",
      "jpg-to-pdf",
      "sgpa-calculator",
      "resume-builder",
    ];
    const resolved = fallbackKeys
      .map((k) => allSaarviTools.find((t) => t.key === k))
      .filter(Boolean) as Array<SmartNavToolItem | CanonicalTool>;
    return resolved.slice(0, 6);
  }, [essentialTools, allSaarviTools]);

  const docEssentialTools = useMemo(() => {
    return activeEssentialTools.filter(
      (t) => t.category === "pdf" || t.category === "image" || t.category === "document"
    );
  }, [activeEssentialTools]);

  const studentCareerEssentialTools = useMemo(() => {
    return activeEssentialTools.filter(
      (t) => t.category === "student" || t.category === "academic" || t.category === "career" || t.category === "ai"
    );
  }, [activeEssentialTools]);

  const col1Tools = docEssentialTools.length > 0
    ? docEssentialTools
    : activeEssentialTools.slice(0, Math.ceil(activeEssentialTools.length / 2));
  const col2Tools = studentCareerEssentialTools.length > 0
    ? studentCareerEssentialTools
    : activeEssentialTools.slice(Math.ceil(activeEssentialTools.length / 2));

    // Current tab config & active pool
  const currentTabConfig = useMemo(() => {
    return CATEGORY_TABS.find((t) => t.id === activeTab) || CATEGORY_TABS[0];
  }, [activeTab]);

  const currentCategoryTools = useMemo(() => {
    switch (activeTab) {
      case "pdf":
        return pdfAllTools;
      case "images":
        return imageAllTools;
      case "student":
        return studentAllTools;
      case "career":
        return careerAllTools;
      case "ai":
        return aiAllTools;
      default:
        return activeEssentialTools;
    }
  }, [activeTab, pdfAllTools, imageAllTools, studentAllTools, careerAllTools, aiAllTools, activeEssentialTools]);

  const currentSubgroups = useMemo(() => {
    switch (activeTab) {
      case "pdf":
        return pdfSubgroups;
      case "images":
        return imageSubgroups;
      case "student":
        return studentSubgroups;
      case "career":
        return careerSubgroups;
      case "ai":
        return aiSubgroups;
      default:
        return [];
    }
  }, [activeTab, pdfSubgroups, imageSubgroups, studentSubgroups, careerSubgroups, aiSubgroups]);

  const categorySearchResults = useMemo(() => {
    if (!searchFilter.trim()) return [];
    const q = searchFilter.toLowerCase().trim();
    const pool = activeTab === "essential" ? allSaarviTools : currentCategoryTools;
    return pool.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.subcategory && t.subcategory.toLowerCase().includes(q))
    );
  }, [searchFilter, activeTab, allSaarviTools, currentCategoryTools]);

  // Jump to category column helper (Section 53 & backwards compatibility)
  const scrollToCategory = (catId: string) => {
    if (catId === "pdf" || catId === "images" || catId === "student" || catId === "career" || catId === "ai") {
      setActiveTab(catId as ToolsLauncherCategory);
      setSearchFilter("");
    }
    const col = document.getElementById(`nav-category-col-${catId}`);
    if (col) {
      col.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      col.classList.add("bg-blue-50/50");
      setTimeout(() => col.classList.remove("bg-blue-50/50"), 1200);
    }
  };

  // ─── Early Return (MUST be after all hooks) ──────────────────────────────────
  if (!activeCategory) return null;

  return (
    <div
      role="region"
      aria-label="Navigation mega menu"
      id="navbar-mega-menu-overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      className="absolute top-full left-0 right-0 z-50 pt-1 pointer-events-none animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="w-full max-w-[960px] mx-auto px-3 sm:px-4 lg:px-6 relative pointer-events-none transition-all duration-200">
        {/* Pointer bridge overlay */}
        <div
          className="absolute -top-3 left-4 right-4 h-5 pointer-events-auto"
          onMouseEnter={onMouseEnter}
          aria-hidden="true"
        />

        <div
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 relative overflow-hidden pointer-events-auto"
        >
          {/* Subtle Top Accent Gradient */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

          {/* ================================================================== */}
          {/* MASTER TOOLS MEGA MENU (Section 1-49: Compact 5-Category Launcher) */}
          {/* ================================================================== */}
          {activeCategory && (
            <div className="flex flex-col">
              {/* Header: Title, Category Badge, Search, and Category View All CTA */}
              <div className="px-5 sm:px-6 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl ${currentTabConfig.activeBadgeBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                      <currentTabConfig.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          {currentTabConfig.title}
                        </h2>
                        {activeTab === "essential" ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            Daily Use
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {currentCategoryTools.length} Tools
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {currentTabConfig.description} · ALL SAARVI TOOLS available on /tools
                      </p>
                    </div>
                  </div>

                  {/* Search Input & Dynamic Category View All Link */}
                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <div className="flex-1 sm:w-60">
                      <CategorySearch
                        value={searchFilter}
                        onChange={setSearchFilter}
                        placeholder={
                          activeTab === "essential"
                            ? "Search all tools… ⌘K"
                            : `Search ${currentTabConfig.label} tools… ⌘K`
                        }
                      />
                    </div>
                    <Link
                      href={currentTabConfig.viewAllRoute}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                    >
                      {currentTabConfig.viewAllLabel}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Category Switcher Tabs Bar (Section 1, 22: Instant Switching) */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-5 sm:px-6 py-2.5 border-b border-slate-100 bg-slate-50/60 no-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                  Explore:
                </span>
                {CATEGORY_TABS.map((tab) => {
                  const IconComp = tab.icon;
                  const isActive = activeTab === tab.id;
                  const count =
                    tab.id === "essential"
                      ? activeEssentialTools.length
                      : tab.id === "pdf"
                      ? pdfAllTools.length
                      : tab.id === "images"
                      ? imageAllTools.length
                      : tab.id === "student"
                      ? studentAllTools.length
                      : tab.id === "career"
                      ? careerAllTools.length
                      : aiAllTools.length;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      id={`nav-tab-${tab.id}`}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSearchFilter("");
                      }}
                      className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-all duration-150 shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-xs font-bold"
                          : "bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/70"
                      }`}
                    >
                      <IconComp className={`w-3.5 h-3.5 ${isActive ? "text-white" : tab.colorClass}`} />
                      <span>{tab.label}</span>
                      {count > 0 && (
                        <span
                          className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-semibold ${
                            isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Main Content Area: Zero layout jump with shared min-height */}
              <div className="px-5 sm:px-6 py-4 overflow-y-auto min-h-[340px] max-h-[50vh]">
                {searchFilter.trim() ? (
                  /* Live Search Results Mode */
                  categorySearchResults.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold text-slate-600">
                          Found {categorySearchResults.length} {activeTab === "essential" ? "Saarvi" : currentTabConfig.label} tools matching &ldquo;{searchFilter}&rdquo;
                        </span>
                        <button
                          type="button"
                          onClick={() => setSearchFilter("")}
                          className="text-xs text-blue-600 hover:underline cursor-pointer"
                        >
                          Clear filter
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {categorySearchResults.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Section 42: No results in category search */
                    <div className="py-14 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-700">
                        No {currentTabConfig.label} tools match &ldquo;{searchFilter}&rdquo;.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenSearch) onOpenSearch();
                          else {
                            setActiveTab("essential");
                            setSearchFilter("");
                          }
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Search All Saarvi Tools →
                      </button>
                    </div>
                  )
                ) : activeTab === "essential" ? (
                  /* 1. ESSENTIAL TOOLS TAB (Default View: 2 Compact Columns, Max 6 Tools) */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Column 1: PDF & Documents */}
                    <div id="nav-category-col-pdf" className="space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            PDF &amp; DOCUMENTS
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-blue-600">
                          <Link
                            href="/pdf"
                            onClick={onClose}
                            className="hover:underline flex items-center gap-0.5"
                          >
                            View All PDF Tools →
                          </Link>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {col1Tools.map((tool) => (
                          <EssentialToolCard key={tool.key} tool={tool} onClick={onClose} />
                        ))}
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <Link
                          href="/images"
                          onClick={onClose}
                          className="font-medium text-slate-500 hover:text-blue-600 hover:underline"
                        >
                          View All Image Tools →
                        </Link>
                      </div>
                    </div>

                    {/* Column 2: Student & Career */}
                    <div id="nav-category-col-student" className="space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            STUDENT &amp; CAREER
                          </h3>
                        </div>
                        <Link
                          href="/student-tools"
                          onClick={onClose}
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          View All Student Tools →
                        </Link>
                      </div>

                      <div className="space-y-1.5">
                        {col2Tools.map((tool) => (
                          <EssentialToolCard key={tool.key} tool={tool} onClick={onClose} />
                        ))}
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <Link
                          href="/career"
                          onClick={onClose}
                          className="font-medium text-slate-500 hover:text-blue-600 hover:underline"
                        >
                          View Career Tools →
                        </Link>
                        <Link
                          href="/tools?category=ai"
                          onClick={onClose}
                          className="font-medium text-slate-500 hover:text-purple-600 hover:underline"
                        >
                          AI &amp; OCR Hub →
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : activeTab === "pdf" ? (
                  /* 2. PDF TOOLS TAB (Section 6: Full Organized Subgroups) */
                  <div id="nav-category-col-pdf" className="space-y-4">
                    {currentSubgroups.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {currentSubgroups.map((group) => (
                          <SubgroupSection
                            key={group.id}
                            label={group.label}
                            colorClass={group.color}
                            tools={group.tools}
                            onClose={onClose}
                            compact
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-14 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">
                          PDF tools are temporarily unavailable.
                        </p>
                        <Link
                          href="/tools"
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          View All Saarvi Tools →
                        </Link>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Showing {pdfAllTools.length} enabled PDF tools · Processed 100% in your browser
                      </span>
                      <Link
                        href="/pdf"
                        onClick={onClose}
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View All PDF Tools →
                      </Link>
                    </div>
                  </div>
                ) : activeTab === "images" ? (
                  /* 3. IMAGE TOOLS TAB (Section 7) */
                  <div id="nav-category-col-images" className="space-y-4">
                    {currentSubgroups.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {currentSubgroups.map((group) => (
                          <SubgroupSection
                            key={group.id}
                            label={group.label}
                            colorClass={group.color}
                            tools={group.tools}
                            onClose={onClose}
                            compact
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-14 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">
                          Image tools are temporarily unavailable.
                        </p>
                        <Link
                          href="/tools"
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          View All Saarvi Tools →
                        </Link>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Showing {imageAllTools.length} enabled Image tools · Fast local format conversion
                      </span>
                      <Link
                        href="/images"
                        onClick={onClose}
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View All Image Tools →
                      </Link>
                    </div>
                  </div>
                ) : activeTab === "student" ? (
                  /* 4. STUDENT TOOLS TAB (Section 8) */
                  <div id="nav-category-col-student" className="space-y-4">
                    {currentSubgroups.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {currentSubgroups.map((group) => (
                          <SubgroupSection
                            key={group.id}
                            label={group.label}
                            colorClass={group.color}
                            tools={group.tools}
                            onClose={onClose}
                            compact
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-14 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">
                          Student tools are temporarily unavailable.
                        </p>
                        <Link
                          href="/tools"
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          View All Saarvi Tools →
                        </Link>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Showing {studentAllTools.length} verified academic &amp; campus utilities
                      </span>
                      <Link
                        href="/student-tools"
                        onClick={onClose}
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View All Student Tools →
                      </Link>
                    </div>
                  </div>
                ) : activeTab === "career" ? (
                  /* 5. CAREER TOOLS TAB (Section 9) */
                  <div id="nav-category-col-career" className="space-y-4">
                    {currentSubgroups.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {currentSubgroups.map((group) => (
                          <SubgroupSection
                            key={group.id}
                            label={group.label}
                            colorClass={group.color}
                            tools={group.tools}
                            onClose={onClose}
                            compact
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-14 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">
                          Career tools are temporarily unavailable.
                        </p>
                        <Link
                          href="/career"
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          Explore Career Hub →
                        </Link>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Showing {careerAllTools.length} career preparation tools
                      </span>
                      <Link
                        href="/career"
                        onClick={onClose}
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View All Career Tools →
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* 6. AI & OCR TOOLS TAB (Section 10) */
                  <div id="nav-category-col-ai" className="space-y-4">
                    {currentSubgroups.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {currentSubgroups.map((group) => (
                          <SubgroupSection
                            key={group.id}
                            label={group.label}
                            colorClass={group.color}
                            tools={group.tools}
                            onClose={onClose}
                            compact
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-14 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">
                          AI &amp; OCR tools are temporarily unavailable.
                        </p>
                        <Link
                          href="/tools?category=ai"
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          Explore AI &amp; OCR Hub →
                        </Link>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Showing {aiAllTools.length} intelligence &amp; OCR utilities
                      </span>
                      <Link
                        href="/tools?category=ai"
                        onClick={onClose}
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View All AI &amp; OCR Tools →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Shared Compact Footer (Section 15, 44) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-5 sm:px-6 py-2.5 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl sm:rounded-b-3xl shrink-0">
                <div className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium">
                    <strong className="text-slate-700">100% Client-Side Privacy:</strong> Files processed locally in your browser. Never uploaded.
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenSearch) onOpenSearch();
                      else onClose();
                    }}
                    className="text-[11px] font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Search all tools</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-600 shadow-2xs">
                      ⌘K
                    </kbd>
                  </button>
                  <Link
                    href="/tools"
                    onClick={onClose}
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 text-xs shrink-0"
                  >
                    View All Saarvi Tools
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
