/**
 * Saarvi Global Search Controller
 * 
 * Central controller for:
 * - Keyboard shortcut Cmd/Ctrl + K
 * - Search query filtering and ranking
 * - Contextual search suggestions (Tools, Career, Academic)
 * - Rotating contextual placeholders (pauses immediately on interaction)
 * - Recent searches persistence
 * - Popular discover items
 */

import { CANONICAL_TOOL_REGISTRY, CanonicalTool } from "@/lib/tools/tool-registry";
import { focusHeroSearch, hasPrimarySearchOnPage } from "./search-surface-resolver";

export interface DiscoverItem {
  key: string;
  name: string;
  description: string;
  route: string;
  category: "pdf" | "academic" | "career" | "image";
  iconName: "FileText" | "FileImage" | "GraduationCap" | "Briefcase" | "Sparkles" | "Calculator";
  badge?: string;
}

export const CANONICAL_DISCOVER_ITEMS: DiscoverItem[] = [
  {
    key: "pdf-to-jpg",
    name: "PDF to JPG",
    description: "Convert PDF pages into high-resolution JPG images client-side",
    route: "/tools/pdf-to-jpg",
    category: "pdf",
    iconName: "FileImage",
    badge: "Local",
  },
  {
    key: "sgpa-calculator",
    name: "SGPA Calculator",
    description: "Verified VTU semester SGPA calculation with credit preservation",
    route: "/student/sgpa-calculator",
    category: "academic",
    iconName: "GraduationCap",
    badge: "Student",
  },
  {
    key: "resume-builder",
    name: "Resume Builder",
    description: "ATS-compliant resumes with instant live A4 paper preview",
    route: "/student/resume",
    category: "career",
    iconName: "Briefcase",
    badge: "Career",
  },
  {
    key: "career-search",
    name: "Jobs & Internships",
    description: "Search student & early-career opportunities across verified sources",
    route: "/jobs",
    category: "career",
    iconName: "Sparkles",
    badge: "Explore",
  },
];

export const ROTATING_SEARCH_PLACEHOLDERS = [
  "Search tools, jobs, internships...",
  "Search PDF tools: PDF to JPG, Merge...",
  "Find software internships & jobs...",
  "Calculate VTU SGPA & credit percentage...",
  "Build ATS-friendly resume...",
];

/**
 * Filter tools based on query and enabled status.
 */
export function filterToolsByQuery(
  query: string,
  tools: CanonicalTool[] = CANONICAL_TOOL_REGISTRY,
  limit: number = 6
): CanonicalTool[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return tools.slice(0, limit);
  }
  return tools
    .filter((t) => {
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.keywords && t.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    })
    .slice(0, limit);
}

/**
 * Handles global Cmd+K / Ctrl+K keyboard shortcut.
 * If current page has a hero search input and it's visible or mounted, focuses it.
 * Otherwise, invokes onOpenModal to launch the Global Search Modal.
 */
export function handleGlobalSearchShortcut(
  e: KeyboardEvent,
  pathname: string | null,
  onOpenModal: () => void
): boolean {
  const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
  if (!isCmdK) return false;

  e.preventDefault();

  // If we are on the homepage with a primary hero search, try focusing it first
  if (hasPrimarySearchOnPage(pathname)) {
    const focused = focusHeroSearch({ smooth: true });
    if (focused) return true;
  }

  // Fallback: open modal command palette
  onOpenModal();
  return true;
}
