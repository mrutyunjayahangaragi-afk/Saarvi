"use client";

import Link from "next/link";
import { ToolDefinition } from "@/types/tool";
import { getDefaultToolAccessMode, ToolAccessMode } from "@/lib/tools/access-control";
import { CANONICAL_TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import {
  FileImage,
  FileType,
  RefreshCw,
  Repeat,
  Image as ImageIcon,
  Layers,
  Combine,
  Scissors,
  FileDown,
  Maximize2,
  Camera,
  GraduationCap,
  ArrowRight,
  Lock,
  Sparkles,
  Briefcase,
  FileSpreadsheet,
  FileCode,
  ShieldCheck
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  FileImage,
  FileType,
  RefreshCw,
  Repeat,
  Image: ImageIcon,
  Layers,
  Combine,
  Scissors,
  FileDown,
  Maximize2,
  Camera,
  GraduationCap,
  Briefcase,
  FileSpreadsheet,
  FileCode
};

interface ToolCardProps {
  tool: ToolDefinition;
  featured?: boolean;
  onSelect?: (tool: ToolDefinition, accessMode: ToolAccessMode) => void;
}

export default function ToolCard({ tool, featured = false, onSelect }: ToolCardProps) {
  const IconComponent = ICON_MAP[tool.icon] || FileImage;

  // Resolve authoritative access mode from central Tool Registry
  const toolSlug = tool.slug || tool.id;
  const canonical = CANONICAL_TOOL_REGISTRY.find(
    (t) => t.key === toolSlug || t.route === tool.route || t.featureFlagKey === toolSlug
  );

  const accessMode: ToolAccessMode = getDefaultToolAccessMode(toolSlug);
  const isBeta = tool.status === "beta" || canonical?.status === "beta";
  const isLocal = canonical?.processingType === "local" || tool.processingType === "local";

  const renderAccessBadge = () => {
    if (tool.status === "disabled" || accessMode === "DISABLED") {
      return (
        <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-[10px] font-semibold text-red-700 dark:text-red-400">
          Disabled
        </span>
      );
    }
    if (isBeta) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
          Beta
        </span>
      );
    }
    if (accessMode === "PRO" || tool.requiresPro) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[10px] font-bold text-amber-700 dark:text-amber-400">
          Pro
        </span>
      );
    }
    if (accessMode === "AUTH_REQUIRED") {
      return (
        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-400">
          Free Account
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
        Guest
      </span>
    );
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect) {
      e.preventDefault();
      onSelect(tool, accessMode);
    }
  };

  return (
    <Link
      href={tool.route}
      onClick={handleClick}
      className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border transition-all duration-200 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer ${
        featured
          ? "bg-white dark:bg-[#111c38] border-blue-200/90 dark:border-blue-900 shadow-2xs hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-lg hover:-translate-y-1"
          : "bg-white dark:bg-[#111c38] border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-2xs hover:shadow-md hover:-translate-y-1"
      }`}
    >
      <div className="space-y-3.5">
        {/* Top: Icon + Access & Processing Badges */}
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white group-hover:-translate-y-0.5 transition-all duration-200 shadow-2xs group-hover:shadow-xs">
            <IconComponent className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
          </div>

          <div className="flex items-center gap-1.5">
            {featured && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                Popular
              </span>
            )}
            {renderAccessBadge()}
            {isLocal && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <Lock className="w-2.5 h-2.5" />
                <span>Local</span>
              </div>
            )}
          </div>
        </div>

        {/* Title & One-line Utility Description */}
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {tool.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
            {tool.description}
          </p>
        </div>
      </div>

      {/* Bottom: Supported Formats and Primary Action */}
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium">
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
          {tool.supportedFormats && tool.supportedFormats.length > 0
            ? tool.supportedFormats.slice(0, 3).join(" • ")
            : "Interactive"}
        </span>

        {tool.status === "disabled" ? (
          <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-[10px] font-semibold border border-red-200 dark:border-red-800">
            Unavailable
          </span>
        ) : tool.status === "maintenance" ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-semibold border border-amber-200 dark:border-amber-800">
            Maintenance
          </span>
        ) : tool.status === "coming_soon" ? (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium border border-slate-200 dark:border-slate-700">
            Coming soon
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        )}
      </div>
    </Link>
  );
}
