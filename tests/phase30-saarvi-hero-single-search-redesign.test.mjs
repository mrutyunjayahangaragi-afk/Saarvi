import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  hasPrimarySearchOnPage,
  resolveSearchSurface,
} from "../src/lib/search/search-surface-resolver.ts";

const ROOT = process.cwd();

test("1. SearchSurfaceResolver Architecture: Single Primary Search Decision", () => {
  // Homepage has primary page search
  assert.equal(hasPrimarySearchOnPage("/"), true, "Homepage must have hasPrimarySearchOnPage = true");
  
  // Other routes do not have primary hero search
  assert.equal(hasPrimarySearchOnPage("/tools"), false, "/tools must have hasPrimarySearchOnPage = false");
  assert.equal(hasPrimarySearchOnPage("/jobs"), false, "/jobs must have hasPrimarySearchOnPage = false");
  assert.equal(hasPrimarySearchOnPage("/student"), false, "/student must have hasPrimarySearchOnPage = false");
  assert.equal(hasPrimarySearchOnPage("/pricing"), false, "/pricing must have hasPrimarySearchOnPage = false");

  // Surface configuration resolution
  const homeConfig = resolveSearchSurface("/");
  assert.equal(homeConfig.hasPrimaryPageSearch, true);
  assert.equal(homeConfig.surfaceMode, "PRIMARY_HERO_SEARCH");
  assert.equal(homeConfig.primarySearchId, "hero-search-input");
  assert.equal(homeConfig.pageType, "home");

  const toolsConfig = resolveSearchSurface("/tools/pdf-to-jpg");
  assert.equal(toolsConfig.hasPrimaryPageSearch, false);
  assert.equal(toolsConfig.surfaceMode, "COMPACT_HEADER_SEARCH");
  assert.equal(toolsConfig.pageType, "tools");
});

test("2. Navbar Redesign: Compact Control on Homepage & Full Trigger on Other Pages", () => {
  const navbarCode = fs.readFileSync(path.join(ROOT, "src/components/layout/Navbar.tsx"), "utf8");

  // Must import search-surface-resolver
  assert.ok(
    navbarCode.includes("hasPrimarySearchOnPage") && navbarCode.includes("focusHeroSearch"),
    "Navbar must import hasPrimarySearchOnPage and focusHeroSearch from search-surface-resolver"
  );

  // Must compute hasHeroSearch from pathname
  assert.ok(
    navbarCode.includes("const hasHeroSearch = hasPrimarySearchOnPage(pathname);"),
    "Navbar must resolve hasHeroSearch boolean"
  );

  // Conditional desktop search control
  assert.ok(
    navbarCode.includes("{hasHeroSearch ? ("),
    "Navbar must conditionally render compact control on homepage vs search field on other pages"
  );

  // Compact control on homepage: Jump to search (Cmd+K)
  assert.ok(
    navbarCode.includes("focusHeroSearch({ smooth: true })"),
    "Clicking search on homepage must call focusHeroSearch with smooth scroll"
  );

  // Fallback to GlobalSearchModal if hero search is not mounted or on other pages
  assert.ok(
    navbarCode.includes("if (!focused) setSearchOpen(true)"),
    "Navbar must fall back to opening search modal if hero search is not found"
  );

  // Desktop search wrapper class preserved for mobile responsiveness
  assert.ok(
    navbarCode.includes("hidden sm:inline-flex saarvi-navbar-search-wrapper"),
    "Desktop search wrapper class must be preserved"
  );
  assert.ok(
    navbarCode.includes("sm:hidden saarvi-navbar-search-wrapper"),
    "Mobile search wrapper class must be preserved"
  );

  // Keyboard shortcut Cmd/Ctrl+K coordinates with hero search
  assert.ok(
    navbarCode.includes("if (hasPrimarySearchOnPage(pathname))"),
    "Global Cmd/Ctrl+K must focus hero search on pages with primary search"
  );
});

test("3. Hero Search: Single Focal Point, Bounded Ambient Layer, No Giant Rotating Object", () => {
  const heroCode = fs.readFileSync(path.join(ROOT, "src/components/home/HeroSection.tsx"), "utf8");
  const homeCode = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
  const cssCode = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  // Hero ambient layer containment
  assert.ok(
    heroCode.includes("className=\"hero-ambient-layer\""),
    "HeroSection must use .hero-ambient-layer for bounded decorative graphics"
  );
  assert.ok(
    cssCode.includes(".hero-ambient-layer {"),
    "globals.css must define .hero-ambient-layer"
  );
  assert.ok(
    cssCode.includes("pointer-events: none") && cssCode.includes("overflow: hidden"),
    ".hero-ambient-layer must enforce pointer-events: none and overflow: hidden"
  );

  // Ambient motion is slow (8-20s, CSS-first)
  assert.ok(
    cssCode.includes("@keyframes saarvi-ambient-drift") && cssCode.includes("14s ease-in-out infinite"),
    "Ambient motion must be slow 14s ease-in-out drift"
  );

  // Single primary search mounted directly in hero flow
  assert.ok(
    heroCode.includes("<CommandSearch />"),
    "HeroSection must host the single primary CommandSearch experience"
  );

  // page.tsx must NOT contain duplicate floating CommandSearch section
  assert.doesNotMatch(
    homeCode,
    /<section[^>]*><CommandSearch \/><\/section>/,
    "page.tsx must NOT render duplicate CommandSearch section outside HeroSection"
  );
});

test("4. Search Border Animation & Interaction State Freezing", () => {
  const commandCode = fs.readFileSync(path.join(ROOT, "src/components/tools/CommandSearch.tsx"), "utf8");
  const cssCode = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  // id="hero-search-input" bound on input for single global focus target
  assert.ok(
    commandCode.includes("id=\"hero-search-input\""),
    "CommandSearch input must have id='hero-search-input'"
  );

  // isInteracting computed state (focused, query, or dropdown open)
  assert.ok(
    commandCode.includes("isInteracting"),
    "CommandSearch must compute isInteracting state"
  );
  assert.ok(
    commandCode.includes("data-active={isInteracting ? \"true\" : \"false\"}"),
    "saarvi-search-wrapper must bind data-active attribute based on isInteracting"
  );

  // Overflow hidden on search wrapper prevents giant rotating blade
  assert.ok(
    cssCode.includes(".saarvi-search-wrapper {") && cssCode.includes("overflow: hidden;"),
    ".saarvi-search-wrapper must have overflow: hidden to clip rotating conic gradient within the 1.5px border"
  );

  // Animation play state paused on active/focus
  assert.ok(
    cssCode.includes(".saarvi-search-wrapper[data-active=\"true\"]::before"),
    "globals.css must pause animation on [data-active='true']"
  );
  assert.ok(
    cssCode.includes("animation-play-state: paused !important"),
    "Border animation must be paused with !important when interacting"
  );
});

test("5. Smart Discover Rail: Max 4 Real Items & Clutter Elimination", () => {
  const discoverCode = fs.readFileSync(path.join(ROOT, "src/components/tools/SmartDiscoverRail.tsx"), "utf8");
  const controllerCode = fs.readFileSync(path.join(ROOT, "src/lib/search/global-search-controller.ts"), "utf8");
  const commandCode = fs.readFileSync(path.join(ROOT, "src/components/tools/CommandSearch.tsx"), "utf8");

  // CommandSearch uses SmartDiscoverRail instead of old Quick pills row
  assert.ok(
    commandCode.includes("<SmartDiscoverRail"),
    "CommandSearch must render SmartDiscoverRail"
  );
  assert.ok(
    !commandCode.includes("<span className=\"text-xs text-slate-500 dark:text-slate-400 font-medium\">Quick:</span>"),
    "Old cluttered 'Quick:' row must be eliminated"
  );

  // Canonical Discover Items (Max 4 items on home)
  assert.ok(discoverCode.includes("CANONICAL_DISCOVER_ITEMS.slice(0, 4)"), "Discover rail must limit to 4 items on home");
  assert.ok(controllerCode.includes("PDF to JPG"), "Discover rail must include PDF to JPG");
  assert.ok(controllerCode.includes("SGPA Calculator"), "Discover rail must include SGPA Calculator");
  assert.ok(controllerCode.includes("Resume Builder"), "Discover rail must include Resume Builder");
  assert.ok(controllerCode.includes("Jobs & Internships"), "Discover rail must include Jobs & Internships");
});

test("6. Search Placeholder Rotation: Freezes Immediately on Focus or Typing", () => {
  const commandCode = fs.readFileSync(path.join(ROOT, "src/components/tools/CommandSearch.tsx"), "utf8");

  // Contextual placeholder rotation
  assert.ok(
    commandCode.includes("ROTATING_SEARCH_PLACEHOLDERS"),
    "CommandSearch must use ROTATING_SEARCH_PLACEHOLDERS"
  );

  // Stops immediately when isInteracting is true
  assert.ok(
    commandCode.includes("if (isInteracting) {"),
    "Placeholder rotation must pause immediately when user interacts"
  );
  assert.ok(
    commandCode.includes("Search tools, jobs, internships..."),
    "Must show default placeholder when interacting"
  );
});

test("7. Saarvi Focus Mode Architecture", () => {
  const heroCode = fs.readFileSync(path.join(ROOT, "src/components/home/HeroSection.tsx"), "utf8");
  const commandCode = fs.readFileSync(path.join(ROOT, "src/components/tools/CommandSearch.tsx"), "utf8");
  const cssCode = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  // Focus mode event dispatched
  assert.ok(
    commandCode.includes("saarvi:hero-focus-mode"),
    "CommandSearch must dispatch saarvi:hero-focus-mode event"
  );

  // HeroSection listens and binds data-focus-mode
  assert.ok(
    heroCode.includes("saarvi:hero-focus-mode"),
    "HeroSection must listen for saarvi:hero-focus-mode"
  );
  assert.ok(
    heroCode.includes("data-focus-mode={isFocused ? \"true\" : \"false\"}"),
    "HeroSection must bind data-focus-mode attribute"
  );

  // CSS rules for focus mode
  assert.ok(
    cssCode.includes("[data-focus-mode=\"true\"] .hero-ambient-layer"),
    "globals.css must quiet down ambient layer in focus mode"
  );
});

test("8. Accessibility, Performance, and Dark Mode Compliance", () => {
  const files = [
    "src/components/layout/Navbar.tsx",
    "src/components/home/HeroSection.tsx",
    "src/components/tools/CommandSearch.tsx",
    "src/components/tools/SmartDiscoverRail.tsx",
  ];

  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!code.includes("bg-slate-950"), `${f} must not contain forbidden bg-slate-950`);
    assert.ok(!code.includes("bg-gray-950"), `${f} must not contain forbidden bg-gray-950`);
  }

  const cssCode = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
  // Reduced motion support
  assert.ok(
    cssCode.includes("prefers-reduced-motion: reduce"),
    "globals.css must support prefers-reduced-motion"
  );
  assert.ok(
    cssCode.includes(".animate-ambient-drift"),
    "Reduced motion must disable .animate-ambient-drift"
  );
});
