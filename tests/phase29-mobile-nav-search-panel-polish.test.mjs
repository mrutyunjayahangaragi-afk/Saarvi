import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("1. Mobile Header Architecture: Single Search, Avatar Only on Mobile, Old Hamburger Removed", () => {
  const navbarCode = fs.readFileSync(path.join(ROOT, "src/components/layout/Navbar.tsx"), "utf8");

  // Official Logo used
  assert.ok(
    navbarCode.includes("<SaarviNavbarLogo />"),
    "Navbar must render canonical SaarviNavbarLogo"
  );

  // Desktop search is hidden on mobile (< sm)
  assert.ok(
    navbarCode.includes("hidden sm:inline-flex saarvi-navbar-search-wrapper"),
    "Desktop search wrapper must be hidden on mobile (< sm) to prevent duplicate search"
  );

  // Mobile search is displayed on mobile (< sm)
  assert.ok(
    navbarCode.includes("sm:hidden saarvi-navbar-search-wrapper"),
    "Mobile search wrapper must be shown on mobile (< sm)"
  );

  // Mobile search has 44x44px touch target
  assert.ok(
    navbarCode.includes("min-w-[44px] min-h-[44px]") && navbarCode.includes("aria-label=\"Search Saarvi\""),
    "Mobile search button must have accessible min 44x44px touch target"
  );

  // Old hamburger toggle button removed from header
  assert.ok(
    !navbarCode.includes("aria-label=\"Toggle Navigation Menu\""),
    "Old generic hamburger toggle button must be removed from the mobile header"
  );

  // Account button on mobile hides name and chevron
  assert.ok(
    navbarCode.includes("hidden sm:inline max-w-[100px] truncate"),
    "Account name text must be hidden on mobile (< sm) for compact avatar presentation"
  );
});

test("2. Mobile Bottom Navigation & Overlay Coordination", () => {
  const bottomNavCode = fs.readFileSync(path.join(ROOT, "src/components/layout/MobileBottomNav.tsx"), "utf8");
  const navbarCode = fs.readFileSync(path.join(ROOT, "src/components/layout/Navbar.tsx"), "utf8");

  // 5 Canonical tabs in bottom nav
  assert.ok(bottomNavCode.includes("grid grid-cols-5"), "Bottom nav must feature 5 equal columns");
  assert.ok(bottomNavCode.includes(">Home</span>"), "Tab 1 must be Home");
  assert.ok(bottomNavCode.includes(">Tools</span>"), "Tab 2 must be Tools");
  assert.ok(bottomNavCode.includes(">Jobs</span>"), "Tab 3 must be Jobs");
  assert.ok(bottomNavCode.includes(">Search</span>"), "Tab 4 must be Search");
  assert.ok(bottomNavCode.includes(">More</span>"), "Tab 5 must be More");
  assert.ok(bottomNavCode.includes("MoreHorizontal"), "More tab must use MoreHorizontal icon");

  // Overlay event coordination
  assert.ok(
    navbarCode.includes("saarvi:close-navigation-overlays"),
    "Navbar must coordinate closing overlays"
  );
  assert.ok(
    navbarCode.includes("window.history.pushState({ saarviOverlay: \"profile\""),
    "Navbar must support browser/Android back button to close profile overlay"
  );
});

test("3. Search Panel Layout & Interactive Border Animation Freezing", () => {
  const jobsCode = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");
  const cssCode = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  // isSearchPanelActive state in jobs/page.tsx
  assert.ok(
    jobsCode.includes("isSearchPanelActive"),
    "Jobs page must compute isSearchPanelActive state"
  );
  assert.ok(
    jobsCode.includes("data-active={isSearchPanelActive ? \"true\" : \"false\"}"),
    "Search panel wrapper must bind data-active attribute based on isSearchPanelActive"
  );

  // CSS animation-play-state paused rules
  assert.ok(
    cssCode.includes(".saarvi-search-wrapper[data-active=\"true\"]::before"),
    "globals.css must define data-active selector for saarvi-search-wrapper"
  );
  assert.ok(
    cssCode.includes("animation-play-state: paused"),
    "globals.css must pause animation-play-state when active or focused"
  );
  assert.ok(
    cssCode.includes(".saarvi-search-wrapper[data-active=\"true\"]:hover::before"),
    "Hover must NOT restart animation if panel is active"
  );

  // Layout fitting: box-sizing, min-w-0, w-full
  assert.ok(
    cssCode.includes("box-sizing: border-box"),
    "saarvi-search-wrapper must enforce box-sizing: border-box"
  );
  assert.ok(
    jobsCode.includes("min-h-[105px] min-w-0 flex flex-col justify-between"),
    "Opportunity cards must use min-h-[105px] and min-w-0 to prevent overflow"
  );
});

test("4. Design System Compliance & Dark Mode Hygiene", () => {
  const files = [
    "src/app/jobs/page.tsx",
    "src/components/layout/Navbar.tsx",
    "src/components/layout/MobileBottomNav.tsx",
    "src/components/layout/MobileProfileSheet.tsx",
    "src/components/layout/MobileMoreSheet.tsx",
  ];

  for (const f of files) {
    const content = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!content.includes("bg-slate-950"), `${f} must not contain forbidden bg-slate-950`);
    assert.ok(!content.includes("bg-gray-950"), `${f} must not contain forbidden bg-gray-950`);
  }
});
