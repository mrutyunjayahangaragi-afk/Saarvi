"use client";

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
  Trophy
} from "lucide-react";
import { getToolBySlug } from "@/config/tools";

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
};

export type ActiveMenuCategory = "tools" | "pdf" | "images" | "student" | null;

interface MegaMenuProps {
  activeCategory: ActiveMenuCategory;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

interface MenuItemProps {
  slug: string;
  customTitle?: string;
  customDescription?: string;
  onClick?: () => void;
}

function MenuItem({ slug, customTitle, customDescription, onClick }: MenuItemProps) {
  const tool = getToolBySlug(slug);

  if (!tool) {
    return null;
  }

  const IconComponent = ICON_MAP[tool.icon] || FileText;
  const isComingSoon = tool.status === "coming_soon";
  const title = customTitle || tool.name;
  const description = customDescription || tool.description;

  return (
    <Link
      href={tool.route}
      onClick={onClick}
      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100/70 transition-all duration-150 relative cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-600 text-slate-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-xs">
        <IconComponent className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
            {title}
          </span>
          {isComingSoon && (
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              Coming soon
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-1 leading-snug">
          {description}
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
  if (!activeCategory) return null;

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

      {/* Mega Menu White Surface Card */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-7 relative overflow-hidden">
          
          {/* Subtle top indicator bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 opacity-90" />

          {/* 1. TOOLS MEGA MENU (3 Columns) */}
          {activeCategory === "tools" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* PDF Tools Column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    PDF Tools
                  </h3>
                  <Link
                    href="/tools?category=pdf"
                    onClick={onClose}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                <div className="space-y-1">
                  <MenuItem slug="pdf-to-jpg" onClick={onClose} />
                  <MenuItem slug="merge-pdf" onClick={onClose} />
                  <MenuItem slug="split-pdf" onClick={onClose} />
                  <MenuItem slug="organize-pdf" onClick={onClose} />
                  <MenuItem slug="compress-pdf" onClick={onClose} />
                  <MenuItem slug="rotate-pdf" onClick={onClose} />
                </div>
              </div>

              {/* Image Tools Column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Image Tools
                  </h3>
                  <Link
                    href="/tools?category=image"
                    onClick={onClose}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                <div className="space-y-1">
                  <MenuItem slug="jpg-to-pdf" onClick={onClose} />
                  <MenuItem slug="png-to-jpg" onClick={onClose} />
                  <MenuItem slug="jpg-to-png" onClick={onClose} />
                  <MenuItem slug="image-to-pdf" onClick={onClose} />
                  <MenuItem slug="image-resize" onClick={onClose} />
                  <MenuItem slug="compress-image" onClick={onClose} />
                </div>
              </div>

              {/* Student Tools Column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Student Tools
                  </h3>
                  <Link
                    href="/student"
                    onClick={onClose}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                <div className="space-y-1">
                  <MenuItem slug="resume-builder" onClick={onClose} />
                  <MenuItem slug="id-photo" onClick={onClose} />
                  <MenuItem slug="notes-to-pdf" onClick={onClose} />
                </div>
                <div className="mt-4 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1">
                  <p className="text-xs font-bold text-blue-900">Guest Access Enabled</p>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    All tools process documents in your browser without requiring account creation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. PDF MEGA MENU (4 Columns: Organize, Convert, Optimize, More) */}
          {activeCategory === "pdf" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Organize */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Organize
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="organize-pdf" onClick={onClose} />
                  <MenuItem slug="merge-pdf" onClick={onClose} />
                  <MenuItem slug="split-pdf" onClick={onClose} />
                  <MenuItem slug="extract-pdf-pages" onClick={onClose} />
                  <MenuItem slug="delete-pdf-pages" onClick={onClose} />
                  <MenuItem slug="rotate-pdf" onClick={onClose} />
                </div>
              </div>

              {/* Convert */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Convert
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="pdf-to-jpg" onClick={onClose} />
                  <MenuItem slug="pdf-to-png" onClick={onClose} />
                  <MenuItem slug="jpg-to-pdf" onClick={onClose} />
                  <MenuItem slug="image-to-pdf" onClick={onClose} />
                </div>
              </div>

              {/* Optimize */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Optimize
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="compress-pdf" onClick={onClose} />
                </div>
              </div>

              {/* More (Clearly Marked Future Tools) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  More
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="notes-to-pdf" onClick={onClose} />
                  <MenuItem slug="resume-builder" onClick={onClose} />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500 leading-relaxed">
                  🔒 100% In-browser execution. Your PDF bytes never leave your machine.
                </div>
              </div>
            </div>
          )}

          {/* 3. IMAGES MEGA MENU (4 Columns: Convert, Create, Edit, Student) */}
          {activeCategory === "images" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Convert */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Convert
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="jpg-to-png" onClick={onClose} />
                  <MenuItem slug="png-to-jpg" onClick={onClose} />
                  <MenuItem slug="webp-to-jpg" onClick={onClose} />
                  <MenuItem slug="webp-to-png" onClick={onClose} />
                </div>
              </div>

              {/* Create */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Create
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="image-to-pdf" onClick={onClose} />
                  <MenuItem slug="multiple-images-to-pdf" onClick={onClose} />
                </div>
              </div>

              {/* Edit */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Edit
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="image-resize" onClick={onClose} />
                  <MenuItem slug="crop-image" onClick={onClose} />
                  <MenuItem slug="rotate-image" onClick={onClose} />
                  <MenuItem slug="compress-image" onClick={onClose} />
                </div>
              </div>

              {/* Student */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Student
                </h3>
                <div className="space-y-1">
                  <MenuItem slug="id-photo" onClick={onClose} />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500 leading-relaxed">
                  ⚡ Client-side canvas transformations without server latency.
                </div>
              </div>
            </div>
          )}

          {/* 4. STUDENT TOOLS MEGA MENU (5 Columns) */}
          {activeCategory === "student" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                {/* 1. Academic Calculators */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                    Academic
                  </h3>
                  <div className="space-y-0.5">
                    <MenuItem slug="cgpa-calculator" onClick={onClose} />
                    <MenuItem slug="sgpa-calculator" onClick={onClose} />
                    <MenuItem slug="percentage" onClick={onClose} />
                    <MenuItem slug="attendance" onClick={onClose} />
                    <MenuItem slug="marks-calculator" onClick={onClose} />
                  </div>
                </div>

                {/* 2. Planning */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                    Planning
                  </h3>
                  <div className="space-y-0.5">
                    <MenuItem slug="study-planner" onClick={onClose} />
                    <MenuItem slug="assignment-planner" onClick={onClose} />
                    <MenuItem slug="timetable" onClick={onClose} />
                  </div>
                </div>

                {/* 3. Career */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                    Career
                  </h3>
                  <div className="space-y-0.5">
                    <MenuItem slug="resume-builder" onClick={onClose} />
                    <MenuItem slug="cover-letter" onClick={onClose} />
                  </div>
                </div>

                {/* 4. Organization */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                    Organization
                  </h3>
                  <div className="space-y-0.5">
                    <MenuItem slug="certificates" onClick={onClose} />
                    <MenuItem slug="internships" onClick={onClose} />
                    <MenuItem slug="hackathons" onClick={onClose} />
                  </div>
                </div>

                {/* 5. Documents */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                    Documents
                  </h3>
                  <div className="space-y-0.5">
                    <MenuItem slug="notes-to-pdf" onClick={onClose} />
                    <MenuItem slug="multiple-images-to-pdf" customTitle="Images to PDF" onClick={onClose} />
                    <MenuItem slug="compress-pdf" customTitle="Compress for Portals" onClick={onClose} />
                  </div>
                </div>
              </div>

              {/* Small visual message banner */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-indigo-950">
                    Student utilities for scoring, coursework deadlines, resumes, and career applications.
                  </span>
                </div>
                <Link
                  href="/student"
                  onClick={onClose}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 shrink-0"
                >
                  Explore student portal <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
