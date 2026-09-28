"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ToolCard from "@/components/tools/ToolCard";
import { ToolCategory, ToolDefinition } from "@/types/tool";
import { ToolAccessMode } from "@/lib/tools/access-control";
import { useAuth } from "@/context/AuthContext";
import FriendlyAccessModal from "@/components/auth/FriendlyAccessModal";
import { Search } from "lucide-react";

interface ToolsCatalogClientProps {
  initialTools: ToolDefinition[];
}

type CatalogCategoryFilter = "all" | "pdf" | "image" | "student" | "career" | "productivity" | "ai";

export default function ToolsCatalogClient({ initialTools }: ToolsCatalogClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Friendly Access Modal State for Guests
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedGatedTool, setSelectedGatedTool] = useState<{
    name: string;
    slug: string;
    route: string;
    tier: "AUTH_REQUIRED" | "PRO";
    description?: string;
  } | null>(null);

  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return initialTools.filter((tool) => {
      // Category match
      let matchesCategory = true;
      if (selectedCategory !== "all") {
        if (selectedCategory === "career") {
          matchesCategory = tool.category === "student" && (tool.keywords || []).some(k => k.includes("resume") || k.includes("career") || k.includes("job"));
        } else if (selectedCategory === "productivity") {
          matchesCategory = tool.category === "student" && (tool.keywords || []).some(k => k.includes("attendance") || k.includes("tracker") || k.includes("calendar"));
        } else if (selectedCategory === "ai") {
          matchesCategory = (tool.keywords || []).some(k => k.includes("ai") || k.includes("ocr") || k.includes("intelligence") || k.includes("summary"));
        } else {
          matchesCategory = tool.category === selectedCategory;
        }
      }

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
      pdf: initialTools.filter((t) => t.category === "pdf").length,
      image: initialTools.filter((t) => t.category === "image").length,
      student: initialTools.filter((t) => t.category === "student").length,
      career: initialTools.filter((t) => (t.keywords || []).some(k => k.includes("resume") || k.includes("career") || k.includes("job"))).length,
      productivity: initialTools.filter((t) => (t.keywords || []).some(k => k.includes("attendance") || k.includes("tracker"))).length,
      ai: initialTools.filter((t) => (t.keywords || []).some(k => k.includes("ai") || k.includes("ocr") || k.includes("summary"))).length,
    };
  }, [initialTools]);

  const handleToolSelect = (tool: ToolDefinition, accessMode: ToolAccessMode) => {
    // If tool is disabled, do nothing
    if (tool.status === "disabled" || accessMode === "DISABLED") {
      return;
    }

    // Guest protection: if tool requires auth or pro and user is not signed in
    if (!user && (accessMode === "AUTH_REQUIRED" || accessMode === "PRO")) {
      setSelectedGatedTool({
        name: tool.name,
        slug: tool.slug || tool.id,
        route: tool.route,
        tier: accessMode === "PRO" ? "PRO" : "AUTH_REQUIRED",
        description: tool.description,
      });
      setAccessModalOpen(true);
      return;
    }

    // Otherwise navigate directly
    router.push(tool.route);
  };

  return (
    <div className="space-y-8">
      {/* Controls: Search & Category Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2">
        {/* Category Tabs: All, PDF, Images, Student, Career, Productivity, AI */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", label: "All" },
            { id: "pdf", label: "PDF" },
            { id: "image", label: "Images" },
            { id: "student", label: "Student" },
            { id: "career", label: "Career" },
            { id: "productivity", label: "Productivity" },
            { id: "ai", label: "AI" },
          ].map((tab) => {
            const count = categoryCounts[tab.id as keyof typeof categoryCounts] || 0;
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as CatalogCategoryFilter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
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
            placeholder="Search tools by name or format..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-xs min-h-[44px]"
          />
        </div>
      </div>

      {/* Filtered Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onSelect={handleToolSelect}
          />
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 space-y-3">
          <p className="text-sm font-semibold text-slate-700">No matching tools found</p>
          <p className="text-xs text-slate-400">Try clearing your search query or selecting a different category.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
            className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Guest Friendly Access Dialog */}
      {selectedGatedTool && (
        <FriendlyAccessModal
          isOpen={accessModalOpen}
          onClose={() => setAccessModalOpen(false)}
          toolName={selectedGatedTool.name}
          toolSlug={selectedGatedTool.slug}
          benefitDescription={selectedGatedTool.description}
          returnUrl={selectedGatedTool.route}
          requiredTier={selectedGatedTool.tier}
        />
      )}
    </div>
  );
}
