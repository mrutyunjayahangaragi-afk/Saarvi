/**
 * Saarvi Search Surface Resolver
 * 
 * Enforces the primary UX invariant: ONE PRIMARY SEARCH EXPERIENCE PER VIEWPORT.
 * - On pages with a primary hero search (e.g. Homepage '/'):
 *   Navbar renders a compact Search button/icon [ 🔍 ⌘K ].
 *   Hero renders the full dominant search experience.
 * - On pages WITHOUT a hero search (e.g. '/tools', '/jobs', '/student', '/pricing'):
 *   Navbar renders the compact search input/modal trigger [ Search tools... ⌘K ].
 * 
 * Clicking the compact navbar Search control:
 * - On pages with a mounted hero search: smoothly scrolls to and focuses '#hero-search-input'.
 * - On pages without a hero search: opens the global Search Command Panel.
 */

export type SearchSurfaceMode = 'PRIMARY_HERO_SEARCH' | 'COMPACT_HEADER_SEARCH';

export interface SearchSurfaceConfig {
  hasPrimaryPageSearch: boolean;
  surfaceMode: SearchSurfaceMode;
  primarySearchId: string;
  pageType: 'home' | 'career' | 'tools' | 'student' | 'pricing' | 'other';
}

/**
 * Determines whether a given route pathname contains a primary hero search experience.
 */
export function hasPrimarySearchOnPage(pathname?: string | null): boolean {
  if (!pathname) return false;
  // Canonical root landing page contains the primary hero search
  if (pathname === '/') return true;
  return false;
}

/**
 * Resolves the search surface configuration for a given pathname and optional viewport.
 */
export function resolveSearchSurface(
  pathname?: string | null,
  viewport: 'desktop' | 'tablet' | 'mobile' = 'desktop'
): SearchSurfaceConfig {
  const hasPrimary = hasPrimarySearchOnPage(pathname);
  
  let pageType: SearchSurfaceConfig['pageType'] = 'other';
  if (pathname === '/') pageType = 'home';
  else if (pathname?.startsWith('/jobs')) pageType = 'career';
  else if (pathname?.startsWith('/tools')) pageType = 'tools';
  else if (pathname?.startsWith('/student')) pageType = 'student';
  else if (pathname?.startsWith('/pricing')) pageType = 'pricing';

  return {
    hasPrimaryPageSearch: hasPrimary,
    surfaceMode: hasPrimary ? 'PRIMARY_HERO_SEARCH' : 'COMPACT_HEADER_SEARCH',
    primarySearchId: 'hero-search-input',
    pageType,
  };
}

/**
 * Smoothly scrolls to and focuses the page-level hero search input.
 * Returns true if the hero search element was successfully located and focused.
 */
export function focusHeroSearch(options?: { smooth?: boolean }): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const input = document.getElementById('hero-search-input') as HTMLInputElement | null;
  if (!input) return false;

  // Determine if input is already comfortably visible in viewport
  const rect = input.getBoundingClientRect();
  const isComfortablyVisible = rect.top >= 60 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);

  if (!isComfortablyVisible) {
    input.scrollIntoView({
      behavior: options?.smooth !== false ? 'smooth' : 'auto',
      block: 'center',
    });
  }

  // Slight delay if smooth scrolling to ensure layout settling, then focus
  setTimeout(() => {
    input.focus({ preventScroll: true });
    // Dispatch focus state event
    window.dispatchEvent(new CustomEvent('saarvi:hero-focus-mode', { detail: { focused: true } }));
  }, isComfortablyVisible ? 10 : 150);

  return true;
}
