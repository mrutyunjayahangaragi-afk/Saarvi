"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Command,
  FileText,
  FileImage,
  GraduationCap,
  Sparkles,
  ArrowRight,
  X,
  Briefcase
} from "lucide-react";
import {
  CANONICAL_TOOL_REGISTRY,
  CanonicalTool,
  resolveToolState
} from "@/lib/tools/tool-registry";
import { FeatureFlag } from "@/types/admin";

export default function CommandSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlag>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadFlags() {
      try {
        const res = await fetch("/api/features", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.flags && Array.isArray(data.flags)) {
            const map: Record<string, FeatureFlag> = {};
            for (const f of data.flags) {
              map[f.id] = f;
              map[f.key] = f;
            }
            setFeatureFlags(map);
          }
        }
      } catch {}
    }
    loadFlags();
  }, []);

  // Filter tools based on query & omit disabled tools
  const availableTools = CANONICAL_TOOL_REGISTRY.filter((t) => {
    const flag = featureFlags[t.featureFlagKey] || featureFlags[t.key];
    if (flag && flag.status === "DISABLED") return false;
    return true;
  });

  const filteredTools = query.trim()
    ? availableTools.filter((t) => {
        const q = query.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.keywords && t.keywords.some((k) => k.toLowerCase().includes(q)))
        );
      })
    : availableTools.slice(0, 6); // default popular preview

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep selected index within bounds
  const totalItems = filteredTools.length;
  const safeIndex = totalItems > 0 ? Math.min(selectedIndex, totalItems - 1) : 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(1, totalItems)) % Math.max(1, totalItems));
    } else if (e.key === "Enter" && filteredTools[safeIndex]) {
      e.preventDefault();
      const tool = filteredTools[safeIndex];
      router.push(tool.route);
      setIsOpen(false);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const selectTool = (tool: CanonicalTool) => {
    router.push(tool.route);
    setIsOpen(false);
  };

  const searchExamples = ["PDF to JPG", "SGPA Calculator", "Resume Builder", "Compress PDF", "Attendance"];

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto z-30">
      {/* Command Search Bar */}
      <div
        onClick={() => {
          inputRef.current?.focus();
          setIsOpen(true);
        }}
        className={`relative flex items-center rounded-2xl border transition-all duration-200 bg-white shadow-xs ${
          isOpen
            ? "border-blue-500 ring-4 ring-blue-500/10 shadow-lg"
            : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        }`}
      >
        <div className="pl-4 pr-2 text-slate-400">
          <Search className="w-5 h-5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to do? (e.g. SGPA, Resume, Merge PDF)"
          className="w-full py-3.5 px-2 bg-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-normal outline-none"
        />

        {query ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="p-1.5 mr-2 text-slate-400 hover:text-slate-600 rounded-lg"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}

        {/* Keyboard shortcut indicator */}
        <div className="hidden sm:flex items-center gap-1 pr-3.5 text-[11px] font-semibold text-slate-400">
          <kbd className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 flex items-center gap-0.5">
            <Command className="w-3 h-3" />
            <span>K</span>
          </kbd>
        </div>
      </div>

      {/* Suggestion Example Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-2.5 px-1">
        <span className="text-xs text-slate-400 font-medium">Quick:</span>
        {searchExamples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQuery(ex);
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-600 font-medium transition-colors border border-slate-200/60 cursor-pointer"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Floating Results Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 px-3 flex items-center justify-between">
            <span>{query ? `Tools matching "${query}"` : "Suggested tools"}</span>
            <span>Use ↑ ↓ to navigate, Enter to select</span>
          </div>

          <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 p-1.5">
            {filteredTools.length > 0 ? (
              filteredTools.map((tool, idx) => {
                const isSelected = idx === safeIndex;
                const flag = featureFlags[tool.featureFlagKey] || featureFlags[tool.key];
                const resolved = resolveToolState(tool, flag);

                return (
                  <div
                    key={tool.key}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => selectTool(tool)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 text-blue-900"
                        : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {tool.category === "pdf" ? (
                          <FileText className="w-4 h-4" />
                        ) : tool.category === "academic" ? (
                          <GraduationCap className="w-4 h-4" />
                        ) : tool.category === "career" ? (
                          <Briefcase className="w-4 h-4" />
                        ) : tool.category === "ai" ? (
                          <Sparkles className="w-4 h-4" />
                        ) : (
                          <FileImage className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{tool.name}</span>
                          {resolved.isSubscription ? (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                              PRO
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              {tool.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {tool.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-blue-600 animate-in fade-in" />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 px-4 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  No matching tools found
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Try searching for &quot;SGPA&quot;, &quot;Resume&quot;, &quot;PDF&quot;, or &quot;Compress&quot;.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
