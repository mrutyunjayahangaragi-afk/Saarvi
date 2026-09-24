"use client";

import { useState, useRef, useEffect, KeyboardEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  GraduationCap,
  Briefcase,
  ArrowRight,
  X,
  Clock,
  Trash2,
  BookOpen,
  CornerDownLeft,
  Sparkles,
} from "lucide-react";
import { SearchEngine } from "@/lib/search/search-engine";
import { getStaticDomainSearchItems, DomainSearchItem } from "@/lib/domain/search-registry";

export type SearchDomain = "tools" | "academic" | "career" | "interview" | "guides" | "features";

export interface GlobalSearchItem {
  id: string;
  domain: SearchDomain;
  title: string;
  description: string;
  route: string;
  badge?: string;
  meta?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId?: string;
}

const RECENT_SEARCHES_KEY = "saarvi_recent_searches";

export default function GlobalSearchModal({
  isOpen,
  onClose,
  profileId: _profileId = "guest",
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isMac, setIsMac] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Detect OS platform for Cmd+K vs Ctrl+K display
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator?.userAgent || "";
      setIsMac(/macintosh|mac os x/i.test(ua));
    }
  }, []);

  const [jobsSearchVisible, setJobsSearchVisible] = useState(true);

  // Check Jobs & Internships feature control search visibility
  useEffect(() => {
    async function checkSearchVisibility() {
      try {
        const res = await fetch('/api/jobs/feature-control');
        if (res.ok) {
          const data = await res.json();
          if (data.search_visible === false || data.mode === 'DISABLED' || data.enabled === false) {
            setJobsSearchVisible(false);
          } else {
            setJobsSearchVisible(true);
          }
        }
      } catch {}
    }
    if (isOpen) {
      checkSearchVisibility();
    }

    const handleFeatureChanged = (e: any) => {
      const detail = e?.detail;
      if (detail) {
        if (detail.search_visible === false || detail.mode === 'DISABLED' || detail.enabled === false) {
          setJobsSearchVisible(false);
        } else {
          setJobsSearchVisible(true);
        }
      } else {
        checkSearchVisibility();
      }
    };

    window.addEventListener('saarvi:jobs-feature-changed', handleFeatureChanged);
    return () => {
      window.removeEventListener('saarvi:jobs-feature-changed', handleFeatureChanged);
    };
  }, [isOpen]);

  // Initialize SearchEngine with static domain items (Tools, Academic, Career, Interview, Guides, Features)
  const searchEngine = useMemo(() => {
    const engine = new SearchEngine<DomainSearchItem>();
    let staticItems = getStaticDomainSearchItems();
    if (!jobsSearchVisible) {
      staticItems = staticItems.filter(
        (item) =>
          !item.route.startsWith('/jobs') &&
          !item.route.startsWith('/internships') &&
          item.id !== 'car_jobs_board'
      );
    }
    engine.indexBatch(staticItems);
    return engine;
  }, [jobsSearchVisible]);

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setRecentSearches(list.slice(0, 6));
        }
      } catch {}
    }
  }, [isOpen]);

  const saveRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || typeof window === "undefined" || !window.localStorage) return;
    try {
      const updated = [
        clean,
        ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 6);
      setRecentSearches(updated);
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(RECENT_SEARCHES_KEY);
      } catch {}
    }
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global Escape key
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Ranked Search Results from SearchEngine
  const searchHits: GlobalSearchItem[] = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    let results = searchEngine.search(q, { limit: 25 });
    if (!jobsSearchVisible) {
      results = results.filter(
        (r) =>
          !r.item.route.startsWith("/jobs") &&
          !r.item.route.startsWith("/internships") &&
          r.item.id !== "car_jobs_board"
      );
    }
    return results.map((r) => ({
      id: r.item.id,
      domain: r.item.domain,
      title: r.item.title,
      description: r.item.description,
      route: r.item.route,
      badge: r.item.badge || r.item.category,
    }));
  }, [query, searchEngine, jobsSearchVisible]);

  // Default suggested items when query is empty
  const defaultItems: GlobalSearchItem[] = useMemo(() => {
    return [
      {
        id: "sug_pdf_jpg",
        domain: "tools",
        title: "PDF to JPG Converter",
        description: "Extract high-resolution JPG images from multi-page PDFs instantly.",
        route: "/tools/pdf-to-jpg",
        badge: "Popular",
      },
      {
        id: "sug_sgpa",
        domain: "academic",
        title: "SGPA & CGPA Calculator",
        description: "Official 2022 & 2025 scheme grading formulas and marks breakdown.",
        route: "/student/sgpa-calculator",
        badge: "Academic",
      },
      {
        id: "sug_resume",
        domain: "career",
        title: "ATS Resume Builder",
        description: "Craft ATS-ready student resumes with one-click export and scoring.",
        route: "/career/resume-builder",
        badge: "Career",
      },
      {
        id: "sug_interview",
        domain: "interview",
        title: "Mock Interview 2.0",
        description: "Live WebRTC video & timed 30s/60s MCQ assessments with company question bank.",
        route: "/student/copilot/interview",
        badge: "Interview",
      },
      {
        id: "sug_attendance",
        domain: "academic",
        title: "Attendance Tracker & Margin Calculator",
        description: "Track subject attendance percentages, safe skips, and recovery classes.",
        route: "/student/attendance",
        badge: "Attendance",
      },
    ];
  }, []);

  const activeResults = query.trim() ? searchHits : defaultItems;
  const totalItems = activeResults.length;
  const safeIndex = totalItems > 0 ? Math.min(selectedIndex, totalItems - 1) : 0;

  const handleSelectItem = (item: GlobalSearchItem) => {
    if (query.trim()) {
      saveRecentSearch(query);
    }
    try {
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "SEARCH_TOOL_OPEN",
          toolId: item.id,
          toolSlug: item.id,
          metadata: { source: "search", domain: item.domain, route: item.route },
        }),
      }).catch(() => {});
    } catch {}
    router.push(item.route);
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(1, totalItems)) % Math.max(1, totalItems));
    } else if (e.key === "Enter" && activeResults[safeIndex]) {
      e.preventDefault();
      handleSelectItem(activeResults[safeIndex]);
    }
  };

  const domainIcons: Record<SearchDomain, React.ComponentType<{ className?: string }>> = {
    tools: FileText,
    academic: GraduationCap,
    career: Briefcase,
    interview: Sparkles,
    guides: BookOpen,
    features: Sparkles,
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search palette"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-20 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
      >
        {/* Search Header Bar */}
        <div className="relative flex items-center border-b border-slate-100 p-4 sm:p-5">
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={totalItems > 0}
            aria-controls="search-results-list"
            aria-label="Search tools, curriculum, career tools, and guides"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tools, SGPA, resume builder, mock interview, guides..."
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-normal outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mr-2 cursor-pointer"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-500 font-semibold shadow-2xs">
            {isMac ? "Cmd + K" : "Ctrl + K"}
          </kbd>
        </div>

        {/* Recent Searches (shown when query is empty and recent searches exist) */}
        {!query && recentSearches.length > 0 && (
          <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 shrink-0">Recent:</span>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    setSelectedIndex(0);
                  }}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shrink-0 font-medium text-xs cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={clearRecentSearches}
              className="text-[11px] text-slate-400 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer shrink-0 ml-2"
              title="Clear recent searches"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        )}

        {/* Results List */}
        <div id="search-results-list" role="listbox" className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50">
          {totalItems === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">No matching results</p>
              <p className="text-xs text-slate-400 mt-1">
                Try searching for “SGPA”, “Resume”, “PDF to JPG”, “Mock Interview”, or “ACID”.
              </p>
            </div>
          ) : (
            activeResults.map((item, index) => {
              const isSelected = index === safeIndex;
              const IconComponent = domainIcons[item.domain] || FileText;

              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`min-h-[44px] p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50/80 border border-blue-200 shadow-xs"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-slate-400">
                    {isSelected ? (
                      <CornerDownLeft className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">Enter</kbd> to select
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">Esc</kbd> to close
            </span>
          </div>

          <div className="font-semibold text-slate-600">
            {isMac ? "Press Cmd + K to search" : "Press Ctrl + K to search"}
          </div>
        </div>
      </div>
    </div>
  );
}
