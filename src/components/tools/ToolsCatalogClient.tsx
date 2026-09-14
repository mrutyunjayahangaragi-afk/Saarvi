"use client";

import { useState, useMemo } from "react";
import ToolCard from "@/components/tools/ToolCard";
import { ToolCategory, ToolDefinition } from "@/types/tool";
import { Search } from "lucide-react";

interface ToolsCatalogClientProps {
  initialTools: ToolDefinition[];
}

export default function ToolsCatalogClient({ initialTools }: ToolsCatalogClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | ToolCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return initialTools.filter((tool) => {
      const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory;
      const matchesQuery =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        tool.supportedFormats.some((f) => f.toLowerCase().includes(q)) ||
        (tool.keywords || []).some((kw) => kw.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [initialTools, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    return {
      all: initialTools.length,
      image: initialTools.filter((t) => t.category === "image").length,
      pdf: initialTools.filter((t) => t.category === "pdf").length,
      student: initialTools.filter((t) => t.category === "student").length,
    };
  }, [initialTools]);

  return (
    <div className="space-y-8">
      {/* Controls: Search & Category Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", label: "All" },
            { id: "pdf", label: "PDF" },
            { id: "image", label: "Images" },
            { id: "student", label: "Student" }
          ].map((tab) => {
            const count = categoryCounts[tab.id as keyof typeof categoryCounts];
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as ToolCategory | "all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Real-time Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-xs min-h-[44px]"
          />
        </div>
      </div>

      {/* Filtered Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
          <p className="text-sm font-semibold text-slate-700">No tools matched your search.</p>
          <p className="text-xs text-slate-500">Try searching for generic terms like &quot;pdf&quot;, &quot;image&quot;, or &quot;sgpa&quot;.</p>
        </div>
      )}
    </div>
  );
}
