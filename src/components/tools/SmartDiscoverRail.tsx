"use client";

import React from "react";
import Link from "next/link";
import {
  FileImage,
  Calculator,
  Briefcase,
  Sparkles,
  ArrowRight,
  GraduationCap,
  FileText,
} from "lucide-react";
import { CANONICAL_DISCOVER_ITEMS, DiscoverItem } from "@/lib/search/global-search-controller";

interface SmartDiscoverRailProps {
  pageContext?: "home" | "career" | "student" | "tools";
  isFocused?: boolean;
  onSelect?: (query: string) => void;
  className?: string;
}

export default function SmartDiscoverRail({
  pageContext = "home",
  isFocused = false,
  onSelect,
  className = "",
}: SmartDiscoverRailProps) {
  // Context-specific 3-4 curated items
  const items: DiscoverItem[] = React.useMemo(() => {
    if (pageContext === "career") {
      return [
        {
          key: "career-internships",
          name: "Internships",
          description: "Early career & student internships",
          route: "/jobs?type=internship",
          category: "career",
          iconName: "Sparkles",
          badge: "Featured",
        },
        {
          key: "career-jobs",
          name: "Full-Time Jobs",
          description: "Fresh graduate and verified positions",
          route: "/jobs?type=job",
          category: "career",
          iconName: "Briefcase",
          badge: "Verified",
        },
        {
          key: "resume-builder",
          name: "Resume Builder",
          description: "ATS-friendly live preview resume builder",
          route: "/student/resume",
          category: "career",
          iconName: "FileText",
          badge: "Tool",
        },
      ];
    }

    if (pageContext === "student") {
      return [
        {
          key: "sgpa-calculator",
          name: "SGPA Calculator",
          description: "Deterministic semester SGPA",
          route: "/student/sgpa-calculator",
          category: "academic",
          iconName: "GraduationCap",
          badge: "VTU 2022",
        },
        {
          key: "attendance-tracker",
          name: "Attendance Tracker",
          description: "Safety margins for 75% & 85% cutoffs",
          route: "/student/attendance",
          category: "academic",
          iconName: "Calculator",
          badge: "Academic",
        },
        {
          key: "resume-builder",
          name: "Resume Builder",
          description: "ATS single-column resume export",
          route: "/student/resume",
          category: "career",
          iconName: "Briefcase",
          badge: "Career",
        },
      ];
    }

    // Default Home Page Context: Exactly 4 Canonical High-Value Items
    return CANONICAL_DISCOVER_ITEMS.slice(0, 4);
  }, [pageContext]);

  const renderIcon = (name: string) => {
    switch (name) {
      case "FileImage":
        return <FileImage className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case "GraduationCap":
        return <GraduationCap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case "Briefcase":
        return <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case "Sparkles":
        return <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      case "Calculator":
        return <Calculator className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div
      className={`w-full max-w-2xl mx-auto pt-3 px-1 transition-opacity duration-200 ${
        isFocused ? "opacity-60" : "opacity-100"
      } ${className}`}
      aria-label="Popular discoveries"
    >
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Subtle Label */}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 select-none">
          Popular
        </span>

        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">·</span>

        {/* 3-4 Compact Discover Chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap w-full overflow-x-auto no-scrollbar py-0.5">
          {items.map((item) => {
            const content = (
              <div className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-[#111c38]/90 hover:bg-white dark:hover:bg-[#162244] border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700/80 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer shrink-0">
                <span className="p-0.5 rounded-md bg-slate-50 dark:bg-slate-800/80 group-hover:scale-105 transition-transform duration-150">
                  {renderIcon(item.iconName)}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {item.name}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
              </div>
            );

            if (onSelect) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.name)}
                  className="text-left cursor-pointer outline-hidden"
                  aria-label={`Discover ${item.name}`}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.route}
                className="outline-hidden"
                aria-label={`Discover ${item.name}`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
