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
import { SmartNavToolItem, SmartNavCategory } from "@/lib/navigation/tool-discovery-service";

// ─── Icon Registry ────────────────────────────────────────────────────────────
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

interface MegaMenuProps {
  activeCategory: ActiveMenuCategory;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

interface SmartToolCardProps {
  tool: SmartNavToolItem | CanonicalTool;
  onClick?: () => void;
  compact?: boolean;
}

// ─── PDF Subcategory Groups ────────────────────────────────────────────────────
const PDF_SUBGROUPS: Array<{ id: string; label: string; color: string; keys: string[] }> = [
  {
    id: "organize",
    label: "Organize PDF",
    color: "text-blue-600",
    keys: ["merge-pdf", "split-pdf", "reorder-pdf", "rotate-pdf", "delete-pdf-pages", "extract-pdf-pages"],
  },
  {
    id: "convert-from",
    label: "Convert from PDF",
    color: "text-red-600",
    keys: ["pdf-to-word", "pdf-to-excel", "pdf-to-powerpoint", "pdf-to-jpg", "pdf-to-png"],
  },
  {
    id: "convert-to",
    label: "Convert to PDF",
    color: "text-emerald-600",
    keys: ["word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf", "txt-to-pdf", "csv-to-pdf", "html-to-pdf"],
  },
  {
    id: "optimize",
    label: "Optimize & Edit",
    color: "text-amber-600",
    keys: ["compress-pdf", "watermark-pdf", "page-numbers-pdf", "pdf-header-footer", "flatten-pdf"],
  },
  {
    id: "security",
    label: "Security",
    color: "text-purple-600",
    keys: ["protect-pdf", "unlock-pdf"],
  },
  {
    id: "inspect",
    label: "Inspect & Info",
    color: "text-slate-600",
    keys: ["pdf-metadata", "pdf-info"],
  },
];

// ─── Image Subcategory Groups ────────────────────────────────────────────────
const IMAGE_SUBGROUPS: Array<{ id: string; label: string; color: string; keys: string[] }> = [
  {
    id: "to-pdf",
    label: "Images → PDF",
    color: "text-red-600",
    keys: ["jpg-to-pdf", "image-to-pdf", "multiple-images-to-pdf", "scan-to-pdf"],
  },
  {
    id: "convert",
    label: "Convert Format",
    color: "text-blue-600",
    keys: ["png-to-jpg", "jpg-to-png", "svg-to-png", "heic-to-jpg"],
  },
  {
    id: "edit",
    label: "Edit & Transform",
    color: "text-emerald-600",
    keys: ["image-resize", "crop-image", "compress-image"],
  },
  {
    id: "scan",
    label: "Scan & Capture",
    color: "text-amber-600",
    keys: ["document-scanner", "photo-to-document"],
  },
];

// ─── Student Subcategory Groups ────────────────────────────────────────────────
const STUDENT_SUBGROUPS: Array<{ id: string; label: string; color: string; canonicalCategories: string[] }> = [
  {
    id: "academic",
    label: "Academic Calculators",
    color: "text-indigo-600",
    canonicalCategories: ["academic"],
  },
  {
    id: "planning",
    label: "Planning & Schedule",
    color: "text-blue-600",
    canonicalCategories: ["student_planning"],
  },
  {
    id: "career",
    label: "Career & Placement",
    color: "text-emerald-600",
    canonicalCategories: ["career"],
  },
  {
    id: "ai",
    label: "AI Tools",
    color: "text-purple-600",
    canonicalCategories: ["ai"],
  },
];

// Student planning tool keys (to separate from academic)
const STUDENT_PLANNING_KEYS = [
  "timetable-generator",
  "study-planner",
  "exam-tracker",
  "assignment-tracker",
  "student-notes",
  "certificate-manager",
  "internship-tracker",
  "hackathon-tracker",
  "notes-to-pdf",
];

// ─── Universal Tool Card ────────────────────────────────────────────────────────
function SmartToolCard({ tool, onClick, compact = false }: SmartToolCardProps) {
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
      className={`group flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-100/80 transition-all duration-150 relative cursor-pointer ${
        compact ? "py-1.5" : "py-2"
      }`}
    >
      {/* Icon */}
      <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-600 text-slate-500 group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-150 shadow-sm group-hover:shadow-blue-500/20">
        <IconComponent className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
      </div>

      {/* Metadata */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
            {tool.name}
          </span>

          {isFeatured && (
            <span className="text-[9px] font-bold tracking-tight px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center gap-0.5 shrink-0">
              <Star className="w-2.5 h-2.5 fill-purple-600 text-purple-600" />
              <span>Featured</span>
            </span>
          )}
          {!isFeatured && isMostUsed && (
            <span className="text-[9px] font-bold tracking-tight px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-0.5 shrink-0">
              <Flame className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
              <span>Most Used</span>
            </span>
          )}
          {requiresPro && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-amber-600 text-white shrink-0">
              PRO
            </span>
          )}
          {isBeta && !requiresPro && (
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              Beta
            </span>
          )}
          {isComingSoon && (
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              Soon
            </span>
          )}
        </div>
        {!compact && (
          <p className="text-[10.5px] text-slate-400 line-clamp-1 leading-snug group-hover:text-slate-500 transition-colors">
            {tool.description}
          </p>
        )}
        {compact && (
          <p className="text-[10px] text-slate-400 line-clamp-1 leading-snug group-hover:text-slate-500 transition-colors hidden sm:block">
            {tool.description}
          </p>
        )}
      </div>

      {/* Hover Arrow */}
      <ArrowRight className="w-3 h-3 text-blue-500 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0 mt-1.5" />
    </Link>
  );
}

// ─── Quick Access Strip ────────────────────────────────────────────────────────
function QuickAccessStrip({
  tools,
  onClose,
}: {
  tools: Array<SmartNavToolItem | CanonicalTool>;
  onClose: () => void;
}) {
  if (!tools || tools.length === 0) return null;

  const quickTools = tools.filter(
    (t) => ("isFeatured" in t && t.isFeatured) || ("isMostUsed" in t && t.isMostUsed)
  );
  if (quickTools.length === 0) return null;

  return (
    <div className="mb-4 pb-3 border-b border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">
        ⚡ Quick Access
      </p>
      <div className="flex flex-wrap gap-1.5">
        {quickTools.slice(0, 6).map((tool) => {
          const isFeatured = "isFeatured" in tool && tool.isFeatured;
          const isMostUsed = "isMostUsed" in tool && tool.isMostUsed;
          return (
            <Link
              key={tool.key}
              href={tool.route}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition-all duration-150 border border-slate-200 hover:border-blue-500 hover:shadow-sm group cursor-pointer"
            >
              {isFeatured && <Star className="w-3 h-3 text-purple-500 group-hover:text-white shrink-0" />}
              {!isFeatured && isMostUsed && (
                <Flame className="w-3 h-3 text-emerald-500 group-hover:text-white shrink-0" />
              )}
              <span>{tool.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Category Search Bar ─────────────────────────────────────────────────────
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
        className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 placeholder:text-slate-400 text-slate-700 transition-all"
        aria-label={placeholder}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Subgroup Section ─────────────────────────────────────────────────────────
function SubgroupSection({
  label,
  colorClass,
  tools,
  onClose,
}: {
  label: string;
  colorClass: string;
  tools: Array<SmartNavToolItem | CanonicalTool>;
  onClose: () => void;
}) {
  if (!tools || tools.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <p className={`text-[9.5px] font-bold uppercase tracking-widest mb-1 px-1 ${colorClass}`}>{label}</p>
      {tools.map((tool) => (
        <SmartToolCard key={tool.key} tool={tool} onClick={onClose} />
      ))}
    </div>
  );
}

// ─── Helper to convert CanonicalTool → SmartNavToolItem shape ─────────────────
function toSmartItem(t: CanonicalTool): SmartNavToolItem {
  return {
    key: t.key,
    name: t.name,
    description: t.description,
    category: t.category,
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

// ─── Main MegaMenu ────────────────────────────────────────────────────────────
export default function MegaMenu({
  activeCategory,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: MegaMenuProps) {
  const [navData, setNavData] = useState<{
    categories: SmartNavCategory[];
    globalTools: any;
    windowDays: number;
  }>({ categories: [], globalTools: null, windowDays: 30 });

  const [searchFilter, setSearchFilter] = useState("");

  // Load coalesced smart navigation snapshot
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
    return () => { mounted = false; };
  }, []);

  // Reset search when category changes
  useEffect(() => {
    setSearchFilter("");
  }, [activeCategory]);

  // ─── Resolve category allTools, falling back to CANONICAL_TOOL_REGISTRY ─────
  const resolveAllTools = (
    catIds: string[],
    canonicalCategories: string[]
  ): SmartNavToolItem[] => {
    // Primary: use smart nav snapshot allTools (contains admin overrides + telemetry)
    for (const catId of catIds) {
      const found = navData.categories.find((c) => c.id === catId);
      if (found && found.allTools && found.allTools.length > 0) {
        return found.allTools;
      }
    }
    // Fallback: derive from CANONICAL_TOOL_REGISTRY
    return CANONICAL_TOOL_REGISTRY.filter((t) =>
      canonicalCategories.includes(t.category)
    ).map(toSmartItem);
  };

  // ─── PDF: all tools ──────────────────────────────────────────────────────────
  const pdfAllTools = useMemo(
    () => resolveAllTools(["pdf"], ["pdf"]),
    [navData.categories]
  );

  const pdfCategory = navData.categories.find((c) => c.id === "pdf");

  const filteredPdfTools = useMemo(() => {
    if (!searchFilter.trim()) return pdfAllTools;
    const q = searchFilter.toLowerCase().trim();
    return pdfAllTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [pdfAllTools, searchFilter]);

  // ─── Images: all tools ────────────────────────────────────────────────────────
  const imageAllTools = useMemo(
    () => resolveAllTools(["images", "image"], ["image"]),
    [navData.categories]
  );

  const imageCategory = navData.categories.find((c) => c.id === "images" || c.id === "image");

  const filteredImageTools = useMemo(() => {
    if (!searchFilter.trim()) return imageAllTools;
    const q = searchFilter.toLowerCase().trim();
    return imageAllTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [imageAllTools, searchFilter]);

  // ─── Student: all tools (academic + student + career + ai for the menu) ────
  const studentAcademicTools = useMemo(
    () => resolveAllTools(["student"], ["academic"]),
    [navData.categories]
  );

  const studentPlanningTools = useMemo(
    () =>
      resolveAllTools(["student"], ["student"]).filter((t) =>
        STUDENT_PLANNING_KEYS.includes(t.key)
      ),
    [navData.categories]
  );

  const careerAllTools = useMemo(
    () => resolveAllTools(["career"], ["career"]),
    [navData.categories]
  );

  const aiAllTools = useMemo(
    () => resolveAllTools(["ai"], ["ai"]),
    [navData.categories]
  );

  const studentCategory = navData.categories.find((c) => c.id === "student");

  const allStudentMenuTools = useMemo(
    () => [...studentAcademicTools, ...studentPlanningTools],
    [studentAcademicTools, studentPlanningTools]
  );

  const filteredStudentAcademic = useMemo(() => {
    if (!searchFilter.trim()) return studentAcademicTools;
    const q = searchFilter.toLowerCase().trim();
    return studentAcademicTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [studentAcademicTools, searchFilter]);

  const filteredStudentPlanning = useMemo(() => {
    if (!searchFilter.trim()) return studentPlanningTools;
    const q = searchFilter.toLowerCase().trim();
    return studentPlanningTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [studentPlanningTools, searchFilter]);

  const filteredCareer = useMemo(() => {
    if (!searchFilter.trim()) return careerAllTools;
    const q = searchFilter.toLowerCase().trim();
    return careerAllTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [careerAllTools, searchFilter]);

  const filteredAi = useMemo(() => {
    if (!searchFilter.trim()) return aiAllTools;
    const q = searchFilter.toLowerCase().trim();
    return aiAllTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [aiAllTools, searchFilter]);

  const studentHasResults =
    filteredStudentAcademic.length > 0 ||
    filteredStudentPlanning.length > 0 ||
    filteredCareer.length > 0 ||
    filteredAi.length > 0;

  // ─── Tools (global): all tools organized by category ────────────────────────
  const globalAllPdf = useMemo(
    () => resolveAllTools(["pdf"], ["pdf"]),
    [navData.categories]
  );
  const globalAllImages = useMemo(
    () => resolveAllTools(["images", "image"], ["image"]),
    [navData.categories]
  );
  const globalAllStudent = useMemo(
    () => resolveAllTools(["student"], ["academic", "student"]),
    [navData.categories]
  );
  const globalAllCareer = useMemo(
    () => resolveAllTools(["career"], ["career"]),
    [navData.categories]
  );
  const globalAllAi = useMemo(
    () => resolveAllTools(["ai"], ["ai"]),
    [navData.categories]
  );

  // Filter all global tools by search
  const applyGlobalFilter = (tools: SmartNavToolItem[]) => {
    if (!searchFilter.trim()) return tools;
    const q = searchFilter.toLowerCase().trim();
    return tools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  };

  const gFilteredPdf = useMemo(() => applyGlobalFilter(globalAllPdf), [globalAllPdf, searchFilter]);
  const gFilteredImages = useMemo(() => applyGlobalFilter(globalAllImages), [globalAllImages, searchFilter]);
  const gFilteredStudent = useMemo(() => applyGlobalFilter(globalAllStudent), [globalAllStudent, searchFilter]);
  const gFilteredCareer = useMemo(() => applyGlobalFilter(globalAllCareer), [globalAllCareer, searchFilter]);
  const gFilteredAi = useMemo(() => applyGlobalFilter(globalAllAi), [globalAllAi, searchFilter]);

  const globalHasResults =
    gFilteredPdf.length > 0 ||
    gFilteredImages.length > 0 ||
    gFilteredStudent.length > 0 ||
    gFilteredCareer.length > 0 ||
    gFilteredAi.length > 0;

  if (!activeCategory) return null;

  // ─── Resolve PDF subgroups for organized display ──────────────────────────
  const buildPdfSubgroups = (tools: SmartNavToolItem[]) => {
    const toolMap = new Map(tools.map((t) => [t.key, t]));
    const assigned = new Set<string>();
    const groups: Array<{ label: string; color: string; tools: SmartNavToolItem[] }> = [];

    for (const group of PDF_SUBGROUPS) {
      const groupTools = group.keys
        .map((k) => toolMap.get(k))
        .filter((t): t is SmartNavToolItem => Boolean(t));
      if (groupTools.length > 0) {
        groupTools.forEach((t) => assigned.add(t.key));
        groups.push({ label: group.label, color: group.color, tools: groupTools });
      }
    }
    // Other / remaining PDF tools not in any group
    const remaining = tools.filter((t) => !assigned.has(t.key));
    if (remaining.length > 0) {
      groups.push({ label: "Other PDF Tools", color: "text-slate-500", tools: remaining });
    }
    return groups;
  };

  const buildImageSubgroups = (tools: SmartNavToolItem[]) => {
    const toolMap = new Map(tools.map((t) => [t.key, t]));
    const assigned = new Set<string>();
    const groups: Array<{ label: string; color: string; tools: SmartNavToolItem[] }> = [];

    for (const group of IMAGE_SUBGROUPS) {
      const groupTools = group.keys
        .map((k) => toolMap.get(k))
        .filter((t): t is SmartNavToolItem => Boolean(t));
      if (groupTools.length > 0) {
        groupTools.forEach((t) => assigned.add(t.key));
        groups.push({ label: group.label, color: group.color, tools: groupTools });
      }
    }
    const remaining = tools.filter((t) => !assigned.has(t.key));
    if (remaining.length > 0) {
      groups.push({ label: "Other Image Tools", color: "text-slate-500", tools: remaining });
    }
    return groups;
  };

  const pdfSubgroups = useMemo(
    () => (searchFilter.trim() ? [] : buildPdfSubgroups(pdfAllTools)),
    [pdfAllTools, searchFilter]
  );

  const imageSubgroups = useMemo(
    () => (searchFilter.trim() ? [] : buildImageSubgroups(imageAllTools)),
    [imageAllTools, searchFilter]
  );

  const totalCount = (cat: SmartNavCategory | undefined, fallback: number) =>
    cat?.totalVisibleCount ?? fallback;

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
      className="absolute top-full left-0 right-0 z-50 pt-1.5 pointer-events-none animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative pointer-events-none">
        {/* Diagonal hover bridge */}
        <div
          className="absolute -top-3 left-4 right-4 h-6 pointer-events-auto"
          onMouseEnter={onMouseEnter}
          aria-hidden="true"
        />

        <div
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 relative overflow-hidden pointer-events-auto"
        >
          {/* Color bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

          {/* ================================================================== */}
          {/* 1. PDF MEGA MENU — Complete Tool Directory                          */}
          {/* ================================================================== */}
          {activeCategory === "pdf" && (
            <div className="flex flex-col">
              {/* Sticky Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 sm:px-7 pt-5 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      PDF Tools
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      {totalCount(pdfCategory, pdfAllTools.length)} tools · merge, split, convert, secure &amp; more
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex-1 sm:w-56">
                    <CategorySearch
                      value={searchFilter}
                      onChange={setSearchFilter}
                      placeholder="Search PDF tools…"
                    />
                  </div>
                  <Link
                    href="/pdf"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                  >
                    View All PDF Tools
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="px-6 sm:px-7 py-4 overflow-y-auto" style={{ maxHeight: "68vh" }}>
                {/* Quick Access */}
                <QuickAccessStrip tools={pdfAllTools} onClose={onClose} />

                {/* Search mode: flat list */}
                {searchFilter.trim() ? (
                  filteredPdfTools.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                      {filteredPdfTools.map((t) => (
                        <SmartToolCard key={t.key} tool={t} onClick={onClose} />
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500 font-medium">
                        No PDF tools match &ldquo;{searchFilter}&rdquo;
                      </p>
                      <button
                        onClick={() => setSearchFilter("")}
                        className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
                      >
                        Clear search
                      </button>
                    </div>
                  )
                ) : (
                  /* Subgroup mode: organized columns */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                    {pdfSubgroups.map((group) => (
                      <SubgroupSection
                        key={group.label}
                        label={group.label}
                        colorClass={group.color}
                        tools={group.tools}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 sm:px-7 py-3 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl shrink-0">
                <div className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[10.5px] font-medium">
                    <strong className="text-slate-700">100% Client-Side Privacy:</strong> Files processed locally in your browser. Never uploaded.
                  </span>
                </div>
                <Link
                  href="/pdf"
                  onClick={onClose}
                  className="text-xs font-semibold text-blue-600 hover:underline shrink-0 flex items-center gap-1"
                >
                  Explore PDF Hub
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* 2. IMAGES MEGA MENU — Complete Tool Directory                       */}
          {/* ================================================================== */}
          {activeCategory === "images" && (
            <div className="flex flex-col">
              {/* Sticky Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 sm:px-7 pt-5 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileImage className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Image Tools
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      {totalCount(imageCategory, imageAllTools.length)} tools · convert, resize, compress &amp; scan
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex-1 sm:w-56">
                    <CategorySearch
                      value={searchFilter}
                      onChange={setSearchFilter}
                      placeholder="Search image tools…"
                    />
                  </div>
                  <Link
                    href="/images"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                  >
                    View All Image Tools
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="px-6 sm:px-7 py-4 overflow-y-auto" style={{ maxHeight: "68vh" }}>
                <QuickAccessStrip tools={imageAllTools} onClose={onClose} />

                {searchFilter.trim() ? (
                  filteredImageTools.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                      {filteredImageTools.map((t) => (
                        <SmartToolCard key={t.key} tool={t} onClick={onClose} />
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500 font-medium">
                        No image tools match &ldquo;{searchFilter}&rdquo;
                      </p>
                      <button
                        onClick={() => setSearchFilter("")}
                        className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
                      >
                        Clear search
                      </button>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                    {imageSubgroups.map((group) => (
                      <SubgroupSection
                        key={group.label}
                        label={group.label}
                        colorClass={group.color}
                        tools={group.tools}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 sm:px-7 py-3 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl shrink-0">
                <div className="flex items-center gap-2 text-slate-600">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-[10.5px] font-medium">
                    <strong className="text-slate-700">Instant Canvas Processing:</strong> Converts JPG, PNG, WebP &amp; HEIC with zero cloud roundtrips.
                  </span>
                </div>
                <Link
                  href="/images"
                  onClick={onClose}
                  className="text-xs font-semibold text-blue-600 hover:underline shrink-0 flex items-center gap-1"
                >
                  Explore Image Hub
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* 3. STUDENT TOOLS MEGA MENU — Complete Directory with Subgroups     */}
          {/* ================================================================== */}
          {activeCategory === "student" && (
            <div className="flex flex-col">
              {/* Sticky Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 sm:px-7 pt-5 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Student Tools
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Academic, planning, career &amp; AI tools for students
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex-1 sm:w-56">
                    <CategorySearch
                      value={searchFilter}
                      onChange={setSearchFilter}
                      placeholder="Search student tools…"
                    />
                  </div>
                  <Link
                    href="/student-tools"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                  >
                    View All Student Tools
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="px-6 sm:px-7 py-4 overflow-y-auto" style={{ maxHeight: "68vh" }}>
                {studentHasResults ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                    {/* Academic Calculators */}
                    {filteredStudentAcademic.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1 px-1 text-indigo-600">
                          Academic Calculators
                        </p>
                        {filteredStudentAcademic.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} />
                        ))}
                      </div>
                    )}

                    {/* Planning & Schedule */}
                    {filteredStudentPlanning.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1 px-1 text-blue-600">
                          Planning &amp; Schedule
                        </p>
                        {filteredStudentPlanning.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} />
                        ))}
                      </div>
                    )}

                    {/* Career & Placement */}
                    {filteredCareer.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1 px-1 text-emerald-600">
                          Career &amp; Placement
                        </p>
                        {filteredCareer.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} />
                        ))}
                        <Link
                          href="/jobs"
                          onClick={onClose}
                          className="flex items-center gap-1.5 p-2 rounded-xl text-[10.5px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Briefcase className="w-3.5 h-3.5 shrink-0" />
                          Jobs &amp; Internships →
                        </Link>
                      </div>
                    )}

                    {/* AI Tools */}
                    {filteredAi.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1 px-1 text-purple-600">
                          AI Tools
                        </p>
                        {filteredAi.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500 font-medium">
                      No student tools match &ldquo;{searchFilter}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchFilter("")}
                      className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 sm:px-7 py-3 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl shrink-0">
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-[10.5px] font-medium">
                    <strong className="text-slate-700">Multi-University Verified:</strong> VTU 2022/2021/2018 schemes, Autonomous &amp; State engineering universities.
                  </span>
                </div>
                <Link
                  href="/student/sgpa-calculator"
                  onClick={onClose}
                  className="text-xs font-semibold text-blue-600 hover:underline shrink-0 flex items-center gap-1"
                >
                  Launch SGPA Calculator
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* 4. TOOLS MEGA MENU — All Saarvi Tools Organized by Category         */}
          {/* ================================================================== */}
          {activeCategory === "tools" && (
            <div className="flex flex-col">
              {/* Sticky Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 sm:px-7 pt-5 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      All Saarvi Tools
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Every tool organized by category
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex-1 sm:w-56">
                    <CategorySearch
                      value={searchFilter}
                      onChange={setSearchFilter}
                      placeholder="Search all tools…"
                    />
                  </div>
                  <Link
                    href="/tools"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                  >
                    View All Saarvi Tools
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="px-6 sm:px-7 py-4 overflow-y-auto" style={{ maxHeight: "68vh" }}>
                {globalHasResults ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-5 gap-y-5">
                    {/* PDF Column */}
                    {gFilteredPdf.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-red-500" />
                            PDF
                          </h3>
                          <Link href="/pdf" onClick={onClose} className="text-[9.5px] font-semibold text-blue-600 hover:underline">
                            All →
                          </Link>
                        </div>
                        {gFilteredPdf.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} compact />
                        ))}
                      </div>
                    )}

                    {/* Images Column */}
                    {gFilteredImages.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <FileImage className="w-3 h-3 text-blue-500" />
                            Images
                          </h3>
                          <Link href="/images" onClick={onClose} className="text-[9.5px] font-semibold text-blue-600 hover:underline">
                            All →
                          </Link>
                        </div>
                        {gFilteredImages.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} compact />
                        ))}
                      </div>
                    )}

                    {/* Student Column */}
                    {gFilteredStudent.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-indigo-500" />
                            Student
                          </h3>
                          <Link href="/student-tools" onClick={onClose} className="text-[9.5px] font-semibold text-blue-600 hover:underline">
                            All →
                          </Link>
                        </div>
                        {gFilteredStudent.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} compact />
                        ))}
                      </div>
                    )}

                    {/* Career Column */}
                    {gFilteredCareer.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-emerald-500" />
                            Career
                          </h3>
                          <Link href="/jobs" onClick={onClose} className="text-[9.5px] font-semibold text-blue-600 hover:underline">
                            Jobs →
                          </Link>
                        </div>
                        {gFilteredCareer.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} compact />
                        ))}
                      </div>
                    )}

                    {/* AI Column */}
                    {gFilteredAi.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-500" />
                            AI &amp; OCR
                          </h3>
                          <Link href="/tools?category=ai" onClick={onClose} className="text-[9.5px] font-semibold text-blue-600 hover:underline">
                            All →
                          </Link>
                        </div>
                        {gFilteredAi.map((t) => (
                          <SmartToolCard key={t.key} tool={t} onClick={onClose} compact />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500 font-medium">
                      No tools match &ldquo;{searchFilter}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchFilter("")}
                      className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 sm:px-7 py-3 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl shrink-0">
                <span className="text-[10.5px] text-slate-500 font-medium">
                  Looking for something specific? Press{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-600 shadow-sm">
                    Cmd+K
                  </kbd>{" "}
                  to search all tools.
                </span>
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
          )}
        </div>
      </div>
    </div>
  );
}
