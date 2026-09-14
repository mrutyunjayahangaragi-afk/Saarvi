"use client";

import { useState, useRef, useEffect, KeyboardEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  FileImage,
  GraduationCap,
  Calendar,
  Briefcase,
  MessageSquare,
  ArrowRight,
  X,
  Sparkles,
  Clock,
  Trash2,
} from "lucide-react";
import { TOOLS_CONFIG } from "@/config/tools";
import { CANONICAL_TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import { ToolDefinition } from "@/types/tool";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { LightweightSearchIndex } from "@/lib/student/algorithms/search-index";

export type SearchDomain = "tools" | "academic" | "planning" | "career" | "conversations";

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
const LEGACY_RECENT_SEARCHES_KEY = "docease_recent_searches";

interface GlobalSearchCache {
  profileId: string;
  timestamp: number;
  items: GlobalSearchItem[];
}
let globalSearchCache: GlobalSearchCache | null = null;
const SEARCH_CACHE_TTL_MS = 60_000; // 1 minute

export function invalidateGlobalSearchCache(): void {
  globalSearchCache = null;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  profileId = "guest",
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [domainItems, setDomainItems] = useState<GlobalSearchItem[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Reset query and selected index on close
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY) || window.localStorage.getItem(LEGACY_RECENT_SEARCHES_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setRecentSearches(list.slice(0, 8));
        }
      } catch {}
    }
  }, [isOpen]);

  const saveRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || typeof window === "undefined" || !window.localStorage) return;
    try {
      const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
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

  // Load indexed data across 5 domains with caching
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function loadAllDomains() {
      if (
        globalSearchCache &&
        globalSearchCache.profileId === profileId &&
        Date.now() - globalSearchCache.timestamp < SEARCH_CACHE_TTL_MS
      ) {
        if (isMounted) {
          setDomainItems(globalSearchCache.items);
        }
        return;
      }

      const items: GlobalSearchItem[] = [];

      // Fetch dynamic feature flags to respect disabled / pro access
      let flagsMap: Record<string, any> = {};
      try {
        const flagRes = await fetch('/api/features', { cache: 'no-store' });
        if (flagRes.ok) {
          const data = await flagRes.json();
          if (data.flags && Array.isArray(data.flags)) {
            for (const f of data.flags) {
              flagsMap[f.id] = f;
              flagsMap[f.key] = f;
            }
          }
        }
      } catch {
        // Continue with local defaults
      }

      // 1. Tools Domain from Canonical Registry (omits disabled tools, tags PRO)
      for (const t of CANONICAL_TOOL_REGISTRY) {
        const flag = flagsMap[t.featureFlagKey] || flagsMap[t.key];
        if (flag && flag.status === 'DISABLED') {
          continue; // Disabled tools must not appear as active available search results
        }
        const isSubscription = flag ? flag.accessMode === 'SUBSCRIPTION' : t.defaultAccess === 'SUBSCRIPTION';

        items.push({
          id: `tool_${t.key}`,
          domain: "tools",
          title: t.name,
          description: t.description,
          route: t.route,
          badge: isSubscription ? "PRO" : (t.badge || t.category.toUpperCase()),
        });
      }

      // 2. Academic Domain
      const staticAcademic: GlobalSearchItem[] = [
        {
          id: "acad_calc",
          domain: "academic",
          title: "SGPA & CGPA Calculator",
          description: "Calculate semester SGPA, cumulative CGPA, and degree percentage across supported schemes.",
          route: "/student/sgpa-calculator",
          badge: "Academic",
        },
        {
          id: "acad_courses",
          domain: "academic",
          title: "Academic Curriculum & Courses",
          description: "Browse verified engineering courses, credits, and syllabus codes across Semesters 1-8.",
          route: "/student",
          badge: "Curriculum",
        },
        {
          id: "acad_att",
          domain: "academic",
          title: "Attendance Tracker & Margin Calculator",
          description: "Track subject attendance percentages, safe skips, and recovery classes to maintain 75%.",
          route: "/student/attendance",
          badge: "Attendance",
        },
        {
          id: "acad_sem",
          domain: "academic",
          title: "Semester Records & Grade History",
          description: "View verified semester marks, backlogs, and academic performance history.",
          route: "/student/cgpa-calculator",
          badge: "Grades",
        },
        {
          id: "acad_copilot",
          domain: "academic",
          title: "AI Student & Career Copilot",
          description: "Intelligent assistant for academics, study schedules, attendance recovery, and career prep.",
          route: "/student/copilot",
          badge: "Copilot",
        },
        {
          id: "career_mock_interview",
          domain: "career",
          title: "Mock Interview Coach",
          description: "Practice technical and behavioral interview questions tailored to your target placement role.",
          route: "/student/copilot/interview",
          badge: "Interview",
        },
      ];
      items.push(...staticAcademic);

      try {
        // 3. Planning Domain (Local Storage)
        const [tasks, asgns, exams, studySessions] = await Promise.all([
          academicStorage.getTasks(profileId),
          academicStorage.getAssignments(profileId),
          academicStorage.getExams(profileId),
          academicStorage.getStudySessions(profileId),
        ]);

        for (const t of tasks) {
          items.push({
            id: `task_${t.id}`,
            domain: "planning",
            title: t.title,
            description: `Task • Priority: ${t.priority} • Status: ${t.status}`,
            route: "/student/tasks",
            badge: "Task",
          });
        }
        for (const a of asgns) {
          items.push({
            id: `asgn_${a.id}`,
            domain: "planning",
            title: `${a.subject}: ${a.title}`,
            description: `Assignment due ${a.dueDate || "soon"} • Status: ${a.status}`,
            route: "/student/assignment-planner",
            badge: "Assignment",
          });
        }
        for (const e of exams) {
          items.push({
            id: `exam_${e.id}`,
            domain: "planning",
            title: `${e.subject} Exam`,
            description: `Exam scheduled on ${e.date || "TBD"} (${e.examType})`,
            route: "/student/exams",
            badge: "Exam",
          });
        }
        for (const s of studySessions) {
          items.push({
            id: `study_${s.id}`,
            domain: "planning",
            title: `Study: ${s.subject} (${s.topic})`,
            description: `Session on ${s.date} • ${s.startTime} - ${s.endTime || ""}`,
            route: "/student/study-planner",
            badge: "Study",
          });
        }

        // 4. Career Domain (Scoped by profileId)
        const [resumes, applications, interviews] = await Promise.all([
          academicStorage.getAllResumeVersions(profileId),
          academicStorage.getAllJobApplications(profileId),
          academicStorage.getAllInterviews(profileId),
        ]);

        items.push({
          id: "career_res_home",
          domain: "career",
          title: "Resume & CV Builder",
          description: "Create and export ATS-friendly resumes across 5 professional templates.",
          route: "/student/resume",
          badge: "Resume",
        });

        for (const r of resumes) {
          items.push({
            id: `res_${r.id}`,
            domain: "career",
            title: `Resume: ${r.name}`,
            description: `Target Role: ${r.targetRole} • Template: ${r.template}`,
            route: "/student/resume",
            badge: "Resume",
          });
        }
        for (const app of applications) {
          items.push({
            id: `app_${app.id}`,
            domain: "career",
            title: `Job Application: ${app.company}`,
            description: `${app.role} • Status: ${app.status}`,
            route: "/student/applications",
            badge: "Application",
          });
        }
        for (const intv of interviews) {
          items.push({
            id: `intv_${intv.id}`,
            domain: "career",
            title: `Interview: ${intv.company}`,
            description: `${intv.role} (${intv.round}) on ${intv.date}`,
            route: "/student/applications",
            badge: "Interview",
          });
        }

        // 5. Conversations Domain
        const convs = await academicStorage.getAllConversations(profileId);
        for (const c of convs) {
          items.push({
            id: `conv_${c.id}`,
            domain: "conversations",
            title: c.title,
            description: c.summary || `${c.messageCount} messages • Local memory`,
            route: `/dashboard/conversations/${c.id}`,
            badge: c.pinned ? "Pinned Chat" : "Chat",
          });
        }
      } catch (err) {
        console.warn("GlobalSearchModal: error loading domain stores:", err);
      }

      if (isMounted) {
        setDomainItems(items);
      }
    }

    loadAllDomains();

    return () => {
      isMounted = false;
    };
  }, [isOpen, profileId]);

  // Inverted Search Index
  const searchIndex = useMemo(() => {
    const idx = new LightweightSearchIndex<GlobalSearchItem>();
    for (const item of domainItems) {
      idx.indexDocument(item.id, item, [item.title, item.description, item.domain, item.badge]);
    }
    return idx;
  }, [domainItems]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global escape
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered results using inverted index
  const searchHits = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return searchIndex.search(q, { limit: 30 });
  }, [query, searchIndex]);

  // Default popular / recommended items when query is empty
  const defaultItems = useMemo(() => {
    const popularSlugs = ["pdf-to-jpg", "jpg-to-pdf", "compress-pdf", "merge-pdf"];
    const tools = popularSlugs
      .map((slug) => TOOLS_CONFIG.find((t) => t.slug === slug))
      .filter((t): t is ToolDefinition => Boolean(t))
      .map(
        (t): GlobalSearchItem => ({
          id: `tool_${t.id}`,
          domain: "tools",
          title: t.name,
          description: t.description,
          route: t.route,
          badge: "Popular Tool",
        })
      );

    const acad: GlobalSearchItem = {
      id: "def_acad_calc",
      domain: "academic",
      title: "VTU SGPA / CGPA Calculator",
      description: "Official 2022 & 2025 scheme grading formulas and marks breakdown.",
      route: "/student/sgpa-calculator",
      badge: "Academic",
    };

    const career: GlobalSearchItem = {
      id: "def_car_res",
      domain: "career",
      title: "Resume & CV Builder",
      description: "Craft ATS-ready student resumes with one-click export.",
      route: "/student/resume",
      badge: "Career",
    };

    return [...tools, acad, career];
  }, []);

  const activeResults = query.trim() ? searchHits : defaultItems;
  const totalItems = activeResults.length;
  const safeIndex = totalItems > 0 ? Math.min(selectedIndex, totalItems - 1) : 0;

  const handleSelectItem = (item: GlobalSearchItem) => {
    if (query.trim()) {
      saveRecentSearch(query);
    }
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'SEARCH_TOOL_OPEN',
          toolId: item.id,
          toolSlug: item.id,
          metadata: { source: 'search', domain: item.domain, route: item.route },
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

  // Group active results by domain
  const grouped = useMemo(() => {
    const map: Record<SearchDomain, GlobalSearchItem[]> = {
      tools: [],
      academic: [],
      planning: [],
      career: [],
      conversations: [],
    };
    for (const item of activeResults) {
      if (map[item.domain]) {
        map[item.domain].push(item);
      }
    }
    return map;
  }, [activeResults]);

  const domainConfig: Record<
    SearchDomain,
    { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
  > = {
    tools: { label: "Tools", icon: FileText, color: "text-blue-600 bg-blue-50" },
    academic: { label: "Academic", icon: GraduationCap, color: "text-indigo-600 bg-indigo-50" },
    planning: { label: "Planning", icon: Calendar, color: "text-emerald-600 bg-emerald-50" },
    career: { label: "Career", icon: Briefcase, color: "text-amber-600 bg-amber-50" },
    conversations: { label: "Conversations", icon: MessageSquare, color: "text-purple-600 bg-purple-50" },
  };

  const searchExamples = ["PDF to JPG", "VTU Calculator", "Resume", "Attendance", "Study Plan"];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search across tools, academic, career, and conversations"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-20 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
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
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tools, courses, tasks, resumes, conversations..."
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-normal outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg mr-2 cursor-pointer"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <kbd className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">ESC</kbd>
          </div>
        </div>

        {/* Suggestion Example Pills */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-slate-50/70 border-b border-slate-100">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Try:</span>
          {searchExamples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                inputRef.current?.focus();
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 font-medium transition-colors border border-slate-200/80 shadow-2xs cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Recent Searches Bar if Query is Empty */}
        {!query && recentSearches.length > 0 && (
          <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Recent:</span>
              {recentSearches.map((rec, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(rec);
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium shrink-0 cursor-pointer"
                >
                  {rec}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearRecentSearches}
              className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Results Container */}
        <div className="overflow-y-auto p-3 sm:p-4 space-y-4 max-h-[60vh]">
          {activeResults.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No matches found for "{query}". Try checking another domain or a broader keyword.
            </div>
          ) : (
            (Object.keys(grouped) as SearchDomain[]).map((dom) => {
              const list = grouped[dom];
              if (!list || list.length === 0) return null;

              const conf = domainConfig[dom];
              const IconComp = conf.icon;

              return (
                <div key={dom} className="space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 flex items-center gap-1.5">
                    <IconComp className="w-3.5 h-3.5 text-slate-400" />
                    <span>{conf.label}</span>
                    <span className="text-[10px] text-slate-400">({list.length})</span>
                  </h4>

                  <div className="space-y-1">
                    {list.map((item) => {
                      const globalIdx = activeResults.indexOf(item);
                      const isSelected = globalIdx === safeIndex;

                      return (
                        <div
                          key={item.id}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          onClick={() => handleSelectItem(item)}
                          className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/90 text-blue-900 border border-blue-200/80 shadow-xs"
                              : "hover:bg-slate-50 text-slate-800 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected ? "bg-blue-600 text-white" : conf.color
                              }`}
                            >
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold truncate">{item.title}</p>
                              <p className="text-[11px] text-slate-500 truncate">{item.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {item.badge && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                                {item.badge}
                              </span>
                            )}
                            <ArrowRight className="w-4 h-4 text-blue-600 shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
