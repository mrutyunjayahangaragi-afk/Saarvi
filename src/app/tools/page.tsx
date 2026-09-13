"use client";

import { useState, useMemo, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ToolCard from "@/components/tools/ToolCard";
import { TOOLS_CONFIG } from "@/config/tools";
import { ToolCategory, ToolDefinition } from "@/types/tool";
import { adminService } from "@/lib/services/adminService";
import { Search, SlidersHorizontal } from "lucide-react";

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolDefinition[]>(TOOLS_CONFIG);
  const [selectedCategory, setSelectedCategory] = useState<"all" | ToolCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    adminService
      .getEffectiveTools()
      .then((eff) => {
        if (eff && eff.length > 0) setTools(eff);
      })
      .catch(() => {});
  }, []);

  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return tools.filter((tool) => {
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
  }, [tools, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    return {
      all: tools.length,
      image: tools.filter((t) => t.category === "image").length,
      pdf: tools.filter((t) => t.category === "pdf").length,
      student: tools.filter((t) => t.category === "student").length,
    };
  }, [tools]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 space-y-8">
        {/* Page Heading */}
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            All tools
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Browse our complete catalog of image, PDF, and student utilities. All tools are free to use without login.
          </p>
        </div>

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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
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
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What do you want to do?"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-blue-600 transition-colors shadow-xs"
            />
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>

        {/* Empty Search State */}
        {filteredTools.length === 0 && (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No tools found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No utilities match your filter &quot;{searchQuery}&quot;. Try searching for &quot;pdf&quot;, &quot;image&quot;, or clearing the search box.
            </p>
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
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
