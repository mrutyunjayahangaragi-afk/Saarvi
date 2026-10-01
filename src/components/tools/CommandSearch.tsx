"use client";

import { useState, useRef, useEffect, useMemo, KeyboardEvent } from "react";
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
import { getStartupFeatures } from "@/lib/api/request-coalesce";
import SmartDiscoverRail from "@/components/tools/SmartDiscoverRail";
import { ROTATING_SEARCH_PLACEHOLDERS } from "@/lib/search/global-search-controller";

export default function CommandSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlag>>({});
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderFading, setPlaceholderFading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load feature flags
  useEffect(() => {
    let mounted = true;
    async function loadFlags() {
      try {
        const res = await getStartupFeatures();
        if (!mounted) return;
        if (res.flags && Array.isArray(res.flags)) {
          const map: Record<string, FeatureFlag> = {};
          for (const f of res.flags) {
            map[f.id] = f;
            map[f.key] = f;
          }
          setFeatureFlags(map);
        }
      } catch {}
    }
    loadFlags();
    return () => {
      mounted = false;
    };
  }, []);

  // Filter tools based on query & omit disabled tools
  const availableTools = useMemo(() => {
    return CANONICAL_TOOL_REGISTRY.filter((t) => {
      const flag = featureFlags[t.featureFlagKey] || featureFlags[t.key];
      if (flag && flag.status === "DISABLED") return false;
      return true;
    });
  }, [featureFlags]);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return availableTools.slice(0, 6); // default popular preview
    }
    return availableTools.filter((t) => {
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.keywords && t.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    });
  }, [query, availableTools]);

  // Close dropdown on click outside & blur focus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Active interaction tracking:
  // Frozen border and halted placeholder rotation on focus, typing, or dropdown
  const isInteracting = isFocused || Boolean(query.trim()) || isOpen;

  // Saarvi Focus Mode event dispatcher
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("saarvi:hero-focus-mode", {
          detail: { focused: isFocused || isOpen },
        })
      );
    }
  }, [isFocused, isOpen]);

  // Contextual Rotating Placeholder:
  // ONLY rotates in true idle state. IMMEDIATELY halts when user focuses, types, or opens suggestions.
  useEffect(() => {
    if (isInteracting) {
      setPlaceholderIndex(0);
      setPlaceholderFading(false);
      return;
    }

    // Check reduced motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = setInterval(() => {
      setPlaceholderFading(true);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % ROTATING_SEARCH_PLACEHOLDERS.length);
        setPlaceholderFading(false);
      }, 200);
    }, 4200);

    return () => clearInterval(interval);
  }, [isInteracting]);

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
      setIsFocused(false);
    }
  };

  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent));
    }
  }, []);

  const selectTool = (tool: CanonicalTool) => {
    router.push(tool.route);
    setIsOpen(false);
  };

  const currentPlaceholder = isInteracting
    ? "Search tools, jobs, internships..."
    : ROTATING_SEARCH_PLACEHOLDERS[placeholderIndex];

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl sm:max-w-3xl lg:max-w-full mx-auto lg:mx-0 z-30">
      {/* High-Priority Search Container with Signature CSS Rotating Gradient Border */}
      {/* Border animation freezes immediately when isInteracting is true (via data-active="true") */}
      <div
        data-active={isInteracting ? "true" : "false"}
        data-focus-mode={isFocused ? "true" : "false"}
        className={`saarvi-search-wrapper ${isOpen || isFocused ? "is-focused is-active" : ""}`}
      >
        <div
          onClick={() => {
            inputRef.current?.focus();
            setIsOpen(true);
            setIsFocused(true);
          }}
          className="saarvi-search-inner flex items-center min-h-[52px] sm:min-h-[56px] w-full bg-white dark:bg-[#111c38] transition-colors duration-200"
        >
          <div className="pl-4 pr-2.5 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 shrink-0" />
          </div>

          <div className="relative flex-1 flex items-center min-w-0">
            <input
              id="hero-search-input"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
                setIsOpen(true);
              }}
              onFocus={() => {
                setIsFocused(true);
                setIsOpen(true);
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder={currentPlaceholder}
              className={`w-full py-3.5 sm:py-4 px-2 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm sm:text-base font-normal outline-none transition-opacity duration-200 ${
                placeholderFading ? "placeholder:opacity-30" : "placeholder:opacity-100"
              }`}
              autoComplete="off"
              spellCheck="false"
              aria-label="Search tools, jobs, internships"
              aria-expanded={isOpen}
              aria-controls="hero-search-results"
            />
          </div>

          {query ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuery("");
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1.5 mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}

          {/* Keyboard shortcut badge */}
          <div className="hidden sm:flex items-center gap-1 pr-4 text-[11px] font-semibold text-slate-400 shrink-0 select-none">
            <kbd className="px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 text-slate-500 dark:text-slate-400 shadow-2xs">
              {isMac ? (
                <>
                  <Command className="w-3 h-3 text-slate-400" />
                  <span>K</span>
                </>
              ) : (
                <span>Ctrl+K</span>
              )}
            </kbd>
          </div>
        </div>
      </div>

      {/* Smart Discover Rail: 3-4 High-Value Real Items (Replaces cluttered Quick row) */}
      <SmartDiscoverRail
        pageContext="home"
        isFocused={isFocused || isOpen}
        onSelect={(toolName) => {
          setQuery(toolName);
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      />

      {/* Floating Results Panel */}
      {isOpen && (
        <div
          id="hero-search-results"
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 z-40"
        >
          <div className="p-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 px-3.5 flex items-center justify-between">
            <span>{query ? `Tools matching "${query}"` : "Popular tools"}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">↑ ↓ Navigate • Enter to select</span>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-1.5">
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
                        ? "bg-blue-50/80 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 shadow-2xs"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
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
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tool.name}</span>
                          {resolved.isSubscription ? (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                              PRO
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                              {tool.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {tool.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-in fade-in" />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 px-4 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No matching tools found
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Try searching for &quot;SGPA&quot;, &quot;Resume&quot;, &quot;PDF&quot;, or &quot;Jobs&quot;.
                </p>
              </div>
            )}

            {/* Quick Action: Search Career & Internships */}
            <div
              onClick={() => {
                router.push(query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs");
                setIsOpen(false);
              }}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block">
                    {query ? `Search Jobs & Internships for "${query}"` : "Browse Jobs & Internships"}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Find student and early-career opportunities
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
