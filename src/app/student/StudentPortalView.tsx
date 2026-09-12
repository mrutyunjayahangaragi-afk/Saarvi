"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Award,
  Calculator,
  Percent,
  Clock,
  Calendar,
  CalendarDays,
  FileText,
  Briefcase,
  Trophy,
  Layers,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Search,
  X,
  FileDown,
  BookOpen,
} from "lucide-react";
import { TOOLS_CONFIG } from "@/config/tools";
import { ToolDefinition } from "@/types/tool";

const ICON_MAP: Record<string, React.ElementType> = {
  GraduationCap,
  Award,
  Calculator,
  Percent,
  Clock,
  Calendar,
  CalendarDays,
  FileText,
  Briefcase,
  Trophy,
  Layers,
  Sparkles,
  CheckCircle2,
  FileDown,
};

interface StudentCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const CATEGORIES: StudentCategory[] = [
  {
    id: "all",
    name: "All Tools",
    description: "Complete student productivity and academic intelligence suite.",
    icon: GraduationCap,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    id: "academic",
    name: "Academic Calculators",
    description: "VTU 2022 Scheme SGPA/CGPA, attendance targets, and composite marks.",
    icon: Calculator,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    id: "planning",
    name: "Planning & Routine",
    description: "Conflict-aware study sessions, priority coursework, and weekly timetables.",
    icon: CalendarDays,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
  {
    id: "career",
    name: "Career & Applications",
    description: "ATS-optimized student resumes and matching professional cover letters.",
    icon: Sparkles,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    id: "organization",
    name: "Trackers & Credentials",
    description: "Internship pipeline, hackathons, and zero-upload certificate organizer.",
    icon: Trophy,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  {
    id: "documents",
    name: "Document Utilities",
    description: "Notes to PDF, image bundling, and portal size compression.",
    icon: FileText,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
];

// Document tools to display in Student Document Tools section
const STUDENT_DOCUMENT_TOOLS = [
  {
    slug: "multiple-images-to-pdf",
    name: "Notes to PDF",
    description: "Convert photos of handwritten lecture notes and whiteboard diagrams into a multi-page PDF document.",
    badge: "Multi-Page",
    route: "/tools/multiple-images-to-pdf",
    icon: "Layers",
  },
  {
    slug: "jpg-to-pdf",
    name: "Images to PDF",
    description: "Turn assignment scans and diagram snapshots into clean, printable A4 PDF documents.",
    badge: "Instant A4",
    route: "/tools/jpg-to-pdf",
    icon: "FileText",
  },
  {
    slug: "compress-pdf",
    name: "Compress for Portals",
    description: "Reduce PDF file size to meet strict college portal and job application upload limits.",
    badge: "Lossless Text",
    route: "/tools/compress-pdf",
    icon: "FileDown",
  },
];

export default function StudentPortalView() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Base student tools from registry
  const studentTools = useMemo(() => {
    return TOOLS_CONFIG.filter((t) => t.category === "student" && t.status === "available");
  }, []);

  // Filtered tools by search and category
  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return studentTools.filter((tool) => {
      const matchCat =
        selectedCategory === "all" ||
        tool.subcategory === selectedCategory;

      if (!matchCat) return false;

      if (!q) return true;

      const matchName = tool.name.toLowerCase().includes(q);
      const matchDesc = tool.description.toLowerCase().includes(q);
      const matchBadge = (tool.badge || "").toLowerCase().includes(q);
      const matchKw = (tool.keywords || []).some((kw) => kw.toLowerCase().includes(q));

      return matchName || matchDesc || matchBadge || matchKw;
    });
  }, [studentTools, selectedCategory, searchQuery]);

  // Grouped for the "all" view without active search
  const academicTools = useMemo(
    () => studentTools.filter((t) => t.subcategory === "academic"),
    [studentTools]
  );
  const planningTools = useMemo(
    () => studentTools.filter((t) => t.subcategory === "planning"),
    [studentTools]
  );
  const careerTools = useMemo(
    () => studentTools.filter((t) => t.subcategory === "career"),
    [studentTools]
  );
  const organizationTools = useMemo(
    () => studentTools.filter((t) => t.subcategory === "organization"),
    [studentTools]
  );

  return (
    <div className="space-y-12">
      {/* Hero Header */}
      <div className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs">
          <GraduationCap className="w-4 h-4" />
          <span>VTU Academic Intelligence & Student Workspace</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Student tools that make everyday work easier
        </h1>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Calculate VTU 2022 Scheme SGPA/CGPA with official course codes, plan study sessions with conflict detection, track internships, and format ATS resumes.
        </p>

        {/* Live Search & Filter Bar */}
        <div className="pt-2 max-w-xl mx-auto">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student tools (e.g. VTU SGPA, timetable, conflict, resume)..."
              className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* SEARCH OR FILTERED VIEW */}
      {(searchQuery.trim() !== "" || selectedCategory !== "all") ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {searchQuery ? `Search Results for "${searchQuery}"` : CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </h2>
              <p className="text-xs text-slate-500">
                Found {filteredTools.length} matching tool{filteredTools.length !== 1 ? "s" : ""}
              </p>
            </div>
            {(searchQuery || selectedCategory !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>

          {filteredTools.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No matching tools found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                We couldn&apos;t find any tools matching your query. Try searching for &quot;SGPA&quot;, &quot;CGPA&quot;, &quot;resume&quot;, or &quot;planner&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTools.map((tool) => (
                <ToolCardItem key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* STRUCTURED CATEGORIZED VIEW */
        <div className="space-y-16">
          {/* Featured Academic Workspace Banner */}
          <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Semester Intelligence</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Multi-Semester Academic Dashboard
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                Track cumulative degree progress, monitor active VTU backlogs, analyze your semester GPA curve, and export your private grades locally.
              </p>
            </div>
            <Link
              href="/student/dashboard"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 text-xs sm:text-sm font-extrabold shadow-sm transition-all shrink-0 cursor-pointer"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 1. Academic Calculators */}
          <section className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Academic Calculators
                </h2>
                <p className="text-xs text-slate-500">
                  Official VTU 2022 Scheme grading engine, pure SGPA/CGPA calculations, and attendance tracking.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {academicTools.map((tool) => (
                <ToolCardItem key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* 2. Planning & Routine */}
          <section className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Planning & Scheduling
                </h2>
                <p className="text-xs text-slate-500">
                  Interval overlap conflict detection, multi-criteria assignment sorting, and weekly routine generation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {planningTools.map((tool) => (
                <ToolCardItem key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* 3. Career & Applications */}
          <section className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Career & Applications
                </h2>
                <p className="text-xs text-slate-500">
                  Build ATS-compliant resumes with dual-pane preview and tailored cover letters with vector PDF export.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {careerTools.map((tool) => (
                <ToolCardItem key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* 4. Trackers & Organization */}
          <section className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Trackers & Credentials
                </h2>
                <p className="text-xs text-slate-500">
                  Privacy-first zero-upload certificate organizer, internship pipeline stages, and hackathon milestones.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {organizationTools.map((tool) => (
                <ToolCardItem key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* 5. Documents & Academic Utilities */}
          <section className="p-8 sm:p-10 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Student Document Utilities</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STUDENT_DOCUMENT_TOOLS.map((docTool) => {
                const Icon = ICON_MAP[docTool.icon] || FileText;
                return (
                  <Link
                    key={docTool.slug}
                    href={docTool.route}
                    className="p-5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl space-y-2.5 transition-all hover-3d-lift cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <Icon className="w-4 h-4 text-blue-600" />
                          <span>{docTool.name}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {docTool.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {docTool.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-blue-600 pt-2">
                      <span>Open tool</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ToolCardItem({ tool }: { tool: ToolDefinition }) {
  const Icon = ICON_MAP[tool.icon] || BookOpen;

  return (
    <Link
      href={tool.route}
      className="group p-5 bg-white border border-slate-200/90 rounded-3xl shadow-xs hover:shadow-md hover:border-blue-300 transition-all hover-3d-lift flex flex-col justify-between space-y-4 cursor-pointer"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-xs">
            <Icon className="w-5 h-5" />
          </div>
          {tool.badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {tool.badge}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
            {tool.name}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mt-1">
            {tool.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 group-hover:text-blue-700 pt-2 border-t border-slate-100">
        <span>Open tool</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}
