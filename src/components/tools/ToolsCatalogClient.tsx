"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ToolCard from "@/components/tools/ToolCard";
import { ToolDefinition } from "@/types/tool";
import { ToolAccessMode } from "@/lib/tools/access-control";
import { CANONICAL_TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import { useAuth } from "@/context/AuthContext";
import FriendlyAccessModal from "@/components/auth/FriendlyAccessModal";
import { Search, X, Sparkles } from "lucide-react";

interface ToolsCatalogClientProps {
  initialTools: ToolDefinition[];
}

/**
 * Common phrase & user-intent mappings to facilitate task-based discovery (Part 7)
 */
const INTENT_MAPPINGS: Array<{ patterns: string[]; matchedSlugs: string[] }> = [
  {
    patterns: [
      "convert image to pdf",
      "image to pdf",
      "picture to pdf",
      "photo to pdf",
      "photos to pdf",
      "jpg to pdf",
      "jpeg to pdf",
      "png to pdf",
      "combine photos into pdf",
      "make pdf from pictures",
      "save photos as pdf"
    ],
    matchedSlugs: ["jpg-to-pdf", "png-to-pdf", "image-to-pdf", "multiple-images-to-pdf"],
  },
  {
    patterns: [
      "compress pdf",
      "reduce pdf",
      "shrink pdf",
      "small pdf",
      "make pdf smaller",
      "reduce pdf size",
      "lower pdf size",
      "compress document"
    ],
    matchedSlugs: ["compress-pdf"],
  },
  {
    patterns: [
      "calculate sgpa",
      "sgpa",
      "semester gpa",
      "vtu sgpa",
      "calculate cgpa",
      "cgpa",
      "marks to percentage",
      "grade calculator",
      "sgpa calculator",
      "cgpa calculator",
      "grade point"
    ],
    matchedSlugs: ["sgpa-calculator", "cgpa-calculator", "marks-to-percentage", "attendance-tracker"],
  },
  {
    patterns: [
      "make resume",
      "build resume",
      "create cv",
      "resume builder",
      "ats resume",
      "curriculum vitae",
      "cv maker",
      "job resume"
    ],
    matchedSlugs: ["resume-builder"],
  },
  {
    patterns: [
      "combine pdf",
      "merge pdf",
      "join pdf",
      "unite pdf",
      "stitch pdf",
      "connect pdf",
      "bundle pdf"
    ],
    matchedSlugs: ["merge-pdf"],
  },
  {
    patterns: [
      "reduce photo size",
      "compress photo",
      "compress image",
      "shrink photo",
      "reduce image size",
      "resize photo",
      "lower image size",
      "make photo smaller"
    ],
    matchedSlugs: ["compress-image", "resize-image"],
  },
  {
    patterns: [
      "remove pdf pages",
      "delete pdf pages",
      "split pdf",
      "extract pdf pages",
      "cut pdf",
      "separate pdf",
      "take pages out of pdf"
    ],
    matchedSlugs: ["split-pdf", "delete-pdf-pages", "extract-pdf-pages"],
  },
  {
    patterns: [
      "pdf to word",
      "convert pdf to word",
      "pdf to doc",
      "pdf to docx",
      "edit pdf in word"
    ],
    matchedSlugs: ["pdf-to-word"],
  },
  {
    patterns: [
      "word to pdf",
      "convert word to pdf",
      "doc to pdf",
      "docx to pdf"
    ],
    matchedSlugs: ["word-to-pdf"],
  },
  {
    patterns: [
      "pdf to excel",
      "convert pdf to excel",
      "pdf to xlsx",
      "extract table from pdf",
      "table to spreadsheet"
    ],
    matchedSlugs: ["pdf-to-excel"],
  },
  {
    patterns: [
      "excel to pdf",
      "convert excel to pdf",
      "xlsx to pdf",
      "sheet to pdf"
    ],
    matchedSlugs: ["excel-to-pdf"],
  },
  {
    patterns: [
      "protect pdf",
      "lock pdf",
      "password pdf",
      "encrypt pdf",
      "secure pdf"
    ],
    matchedSlugs: ["protect-pdf"],
  },
  {
    patterns: [
      "unlock pdf",
      "remove password from pdf",
      "decrypt pdf",
      "open locked pdf"
    ],
    matchedSlugs: ["unlock-pdf"],
  },
  {
    patterns: [
      "rotate pdf",
      "turn pdf",
      "flip pdf",
      "rotate pages"
    ],
    matchedSlugs: ["rotate-pdf"],
  },
  {
    patterns: [
      "watermark pdf",
      "add watermark",
      "stamp pdf"
    ],
    matchedSlugs: ["watermark-pdf"],
  },
  {
    patterns: [
      "page numbers",
      "add page numbers to pdf",
      "number pdf pages",
      "header footer pdf"
    ],
    matchedSlugs: ["page-numbers-pdf"],
  },
  {
    patterns: [
      "cover letter",
      "job letter",
      "application letter",
      "internship letter",
      "write cover letter"
    ],
    matchedSlugs: ["cover-letter-generator"],
  },
  {
    patterns: [
      "interview",
      "mock interview",
      "interview prep",
      "practice interview",
      "ai interview"
    ],
    matchedSlugs: ["ai-mock-interview"],
  },
  {
    patterns: [
      "id photo",
      "passport photo",
      "stamp size photo",
      "visa photo"
    ],
    matchedSlugs: ["id-photo-maker"],
  },
  {
    patterns: [
      "attendance",
      "bunk calculator",
      "attendance tracker",
      "college attendance"
    ],
    matchedSlugs: ["attendance-tracker"],
  }
];

export default function ToolsCatalogClient({ initialTools }: ToolsCatalogClientProps) {
  const router = useRouter();
  const { user } = useAuth();
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

  // Intent-based tool filter (Part 7)
  const filteredTools = useMemo(() => {
    const rawQuery = searchQuery.toLowerCase().trim();
    if (!rawQuery) {
      return initialTools;
    }

    // Check intent mapping
    const matchingIntentSlugs = new Set<string>();
    for (const intent of INTENT_MAPPINGS) {
      for (const pattern of intent.patterns) {
        if (pattern.includes(rawQuery) || rawQuery.includes(pattern)) {
          intent.matchedSlugs.forEach((slug) => matchingIntentSlugs.add(slug));
        }
      }
    }

    // Split search into individual words
    const queryTokens = rawQuery.split(/\s+/).filter(Boolean);

    return initialTools.filter((tool) => {
      const toolSlug = tool.slug || tool.id;

      // 1. Matched by direct intent mapping
      if (matchingIntentSlugs.has(toolSlug)) {
        return true;
      }

      // 2. Fetch canonical keywords if available
      const canonical = CANONICAL_TOOL_REGISTRY.find(
        (t) => t.key === toolSlug || t.route === tool.route
      );
      const canonicalKeywords = canonical?.keywords || [];
      const toolKeywords = tool.keywords || [];
      const allKeywords = [...toolKeywords, ...canonicalKeywords].map((k) => k.toLowerCase());

      const name = tool.name.toLowerCase();
      const description = tool.description.toLowerCase();
      const category = tool.category.toLowerCase();
      const formats = tool.supportedFormats.map((f) => f.toLowerCase());

      // 3. Whole query match
      if (
        name.includes(rawQuery) ||
        description.includes(rawQuery) ||
        category.includes(rawQuery) ||
        formats.some((f) => f.includes(rawQuery)) ||
        allKeywords.some((kw) => kw.includes(rawQuery))
      ) {
        return true;
      }

      // 4. Token-level matching (all tokens must match somewhere)
      const allTokensMatch = queryTokens.every((token) => {
        return (
          name.includes(token) ||
          description.includes(token) ||
          category.includes(token) ||
          formats.some((f) => f.includes(token)) ||
          allKeywords.some((kw) => kw.includes(token))
        );
      });

      return allTokensMatch;
    });
  }, [initialTools, searchQuery]);

  const handleToolSelect = (tool: ToolDefinition, accessMode: ToolAccessMode) => {
    if (tool.status === "disabled" || accessMode === "DISABLED") {
      return;
    }

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

    router.push(tool.route);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar & Display Controls (Part 6 & Part 28) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Intent Search Bar */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            id="tools-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools... (e.g., convert image to pdf, compress pdf, calculate sgpa)"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs min-h-[44px]"
            aria-label="Search tools by name, alias or intent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              aria-label="Clear tool search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Display All Tools Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] flex items-center gap-2 border shadow-xs ${
              !searchQuery
                ? "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-white dark:bg-[#111c38] border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Display All Tools</span>
          </button>
        </div>
      </div>

      {/* ALL TOOLS Section Header */}
      <div className="flex items-center justify-between pt-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            All Tools
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
            {filteredTools.length}
          </span>
        </div>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Show all {initialTools.length} tools
          </button>
        )}
      </div>

      {/* Clean Responsive Collection of All Available Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onSelect={handleToolSelect}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTools.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-[#111c38] rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3 px-4">
          <p className="text-base font-bold text-slate-800 dark:text-slate-100">
            No tools found matching &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try searching for common actions like &ldquo;compress pdf&rdquo;, &ldquo;calculate sgpa&rdquo;, or &ldquo;convert image to pdf&rdquo;.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Display All Tools
            </button>
          </div>
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
