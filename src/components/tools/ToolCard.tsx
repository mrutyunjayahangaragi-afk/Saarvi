"use client";

import Link from "next/link";
import { ToolDefinition } from "@/types/tool";
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
  Lock
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
  GraduationCap
};

interface ToolCardProps {
  tool: ToolDefinition;
  featured?: boolean;
}

export default function ToolCard({ tool, featured = false }: ToolCardProps) {
  const IconComponent = ICON_MAP[tool.icon] || FileImage;

  return (
    <Link
      href={tool.route}
      className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border transition-all duration-200 focus-visible:outline-2 focus-visible:outline-blue-600 hover-3d-lift cursor-pointer ${
        featured
          ? "bg-white border-blue-200 shadow-xs hover:border-blue-400 hover:shadow-md"
          : "bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md"
      }`}
    >
      <div className="space-y-3.5">
        {/* Top: Icon + Privacy Indicator */}
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:-translate-y-0.5 transition-all duration-200 shadow-2xs">
            <IconComponent className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-1.5">
            {tool.requiresPro ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                Pro
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700">
                Free
              </span>
            )}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
              <Lock className="w-2.5 h-2.5" />
              <span>Local</span>
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {tool.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
            {tool.description}
          </p>
        </div>
      </div>

      {/* Bottom: Formats and Action */}
      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
        <span className="text-[11px] text-slate-400 font-mono">
          {tool.supportedFormats.length > 0 ? tool.supportedFormats.join(" • ") : "Interactive"}
        </span>

        {tool.status === "available" ? (
          <span className="flex items-center gap-1 text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        ) : tool.status === "disabled" ? (
          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold border border-red-200">
            Unavailable
          </span>
        ) : tool.status === "maintenance" ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
            Maintenance
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
            Coming soon
          </span>
        )}
      </div>
    </Link>
  );
}
