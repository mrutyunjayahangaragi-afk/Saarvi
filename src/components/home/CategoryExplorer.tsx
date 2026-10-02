"use client";

import { useState } from "react";
import { ToolDefinition } from "@/types/tool";
import ToolCard from "@/components/tools/ToolCard";
import { Layers, FileText, FileImage, GraduationCap } from "lucide-react";

interface CategoryExplorerProps {
  tools: ToolDefinition[];
}

type TabType = "all" | "pdf" | "image" | "student";

export default function CategoryExplorer({ tools }: CategoryExplorerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Layers },
    { id: "pdf", label: "PDF", icon: FileText },
    { id: "image", label: "Images", icon: FileImage },
    { id: "student", label: "Student", icon: GraduationCap }
  ];

  const filtered = activeTab === "all"
    ? tools
    : tools.filter((t) => t.category === activeTab);

  return (
    <div className="space-y-8">
      {/* Category Tabs */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Filter tools by category"
          className="inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-2xs"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white dark:bg-[#111c38] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-xs scale-[1.02]"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtered Grid with 3D cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-200">
        {filtered.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
