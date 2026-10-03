import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("1. Master Theme Architecture: ThemeProvider supports Light, Dark, System & Admin Forced-Light", () => {
  const providerContent = fs.readFileSync(path.join(ROOT, "src/components/theme/ThemeProvider.tsx"), "utf8");

  // Type definitions
  assert.ok(providerContent.includes('export type Theme = "light" | "dark" | "system"'), "Supports light, dark, system");
  assert.ok(providerContent.includes('resolvedTheme: "light" | "dark"'), "Distinguishes theme from resolvedTheme");
  assert.ok(providerContent.includes("isAdminRoute"), "Provides isAdminRoute boundary indicator");

  // Admin route forced light without wiping localStorage
  assert.ok(providerContent.includes('pathname?.startsWith("/admin")'), "Detects admin routes");
  assert.ok(providerContent.includes('applyThemeToDOM("light", true)'), "Forces DOM light in admin routes");

  // Media query listener for OS changes
  assert.ok(providerContent.includes('matchMedia("(prefers-color-scheme: dark)")'), "Binds media query listener");

  // Cross-tab synchronization
  assert.ok(providerContent.includes('window.addEventListener("storage"'), "Listens to storage events for cross-tab sync");
});

test("2. Flash Prevention: layout.tsx contains synchronous inline script with admin bypass", () => {
  const layoutContent = fs.readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");

  assert.ok(layoutContent.includes("isPathAdmin"), "Checks if path is admin in head script");
  assert.ok(layoutContent.includes("document.documentElement.classList.remove('dark')"), "Removes dark class immediately for admin");
  assert.ok(layoutContent.includes("document.documentElement.style.colorScheme"), "Sets colorScheme synchronously");
});

test("3. Admin Portal Isolation: AdminLayoutClient is locked to forced-light", () => {
  const adminLayout = fs.readFileSync(path.join(ROOT, "src/components/admin/AdminLayoutClient.tsx"), "utf8");

  assert.ok(adminLayout.includes("forced-light"), "Admin layout has forced-light class");
  assert.ok(adminLayout.includes("light"), "Admin layout has light class");
  assert.ok(adminLayout.includes("colorScheme: 'light'"), "Admin layout has colorScheme light");
});

test("4. Tools Page: Explore by Category is completely removed from public UI", () => {
  const toolsPage = fs.readFileSync(path.join(ROOT, "src/app/tools/page.tsx"), "utf8");

  assert.ok(!toolsPage.includes("Explore by Category"), "No 'Explore by Category'");
  assert.ok(!toolsPage.includes("PDF Workspace"), "No 'PDF Workspace'");
  assert.ok(!toolsPage.includes("Image Workspace"), "No 'Image Workspace'");
  assert.ok(!toolsPage.includes("Student Workspace"), "No 'Student Workspace'");
  assert.ok(!toolsPage.includes("View all PDF tools"), "No 'View all PDF tools'");
  assert.ok(!toolsPage.includes("View all Image tools"), "No 'View all Image tools'");
  assert.ok(toolsPage.includes("Saarvi Tools"), "Contains 'Saarvi Tools' heading");
  assert.ok(toolsPage.includes("Find the tool you need and get the task done."), "Contains master subline");
  assert.ok(toolsPage.includes("<ToolsCatalogClient"), "Renders ToolsCatalogClient");
});

test("5. Tools UX & Intent Search: ToolsCatalogClient implements Display All Tools and intent queries", () => {
  const catalogClient = fs.readFileSync(path.join(ROOT, "src/components/tools/ToolsCatalogClient.tsx"), "utf8");

  assert.ok(catalogClient.includes("Display All Tools"), "Provides 'Display All Tools' button");
  assert.ok(catalogClient.includes("All Tools"), "Has 'All Tools' section header");
  assert.ok(catalogClient.includes("INTENT_MAPPINGS"), "Has intent-based query mappings");
  assert.ok(catalogClient.includes("convert image to pdf"), "Supports 'convert image to pdf' intent");
  assert.ok(catalogClient.includes("compress pdf"), "Supports 'compress pdf' intent");
  assert.ok(catalogClient.includes("calculate sgpa"), "Supports 'calculate sgpa' intent");
  assert.ok(catalogClient.includes("make resume"), "Supports 'make resume' intent");
  assert.ok(catalogClient.includes("combine pdf"), "Supports 'combine pdf' intent");
  assert.ok(catalogClient.includes("reduce photo size"), "Supports 'reduce photo size' intent");
  assert.ok(catalogClient.includes("remove pdf pages"), "Supports 'remove pdf pages' intent");
});

test("6. Tool Card Icon Alignment: ToolCardIcon strictly centers icons with block SVG", () => {
  const iconComp = fs.readFileSync(path.join(ROOT, "src/components/tools/ToolCardIcon.tsx"), "utf8");

  assert.ok(iconComp.includes("flex"), "Uses flex");
  assert.ok(iconComp.includes("items-center"), "Uses items-center");
  assert.ok(iconComp.includes("justify-center"), "Uses justify-center");
  assert.ok(iconComp.includes("shrink-0"), "Uses shrink-0");
  assert.ok(iconComp.includes("block"), "SVG has block display");
  assert.ok(iconComp.includes('aria-hidden="true"'), "SVG is decorative aria-hidden='true'");

  const toolCard = fs.readFileSync(path.join(ROOT, "src/components/tools/ToolCard.tsx"), "utf8");
  assert.ok(toolCard.includes("<ToolCardIcon"), "ToolCard uses ToolCardIcon component");
});

test("7. Career Search Select Controls: Delivery Mode & Duration are dark-aware", () => {
  const jobsPage = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");

  // Delivery Mode
  assert.ok(jobsPage.includes('id="training-mode-select"'), "Contains training-mode-select");
  assert.ok(!jobsPage.includes('id="training-mode-select"\n                        value={deliveryMode}\n                        onChange={(e) => setDeliveryMode(e.target.value)}\n                        className="w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white"'), "Delivery mode does not have white-only styling");
  assert.ok(jobsPage.includes("dark:bg-[#111c38]"), "Delivery mode has dark surface");
  assert.ok(jobsPage.includes("dark:text-slate-200"), "Delivery mode has light text in dark mode");

  // Duration
  assert.ok(jobsPage.includes('id="training-dur-select"'), "Contains training-dur-select");
  assert.ok(!jobsPage.includes('id="training-dur-select"\n                        value={duration}\n                        onChange={(e) => setDuration(e.target.value)}\n                        className="w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white"'), "Duration does not have white-only styling");

  // Labels
  assert.ok(jobsPage.includes('htmlFor="training-mode-select" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"'), "Delivery Mode label has dark:text-slate-400");
  assert.ok(jobsPage.includes('htmlFor="training-dur-select" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"'), "Duration label has dark:text-slate-400");
});

test("8. Global CSS Semantic Design Tokens & Custom Variant", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  assert.ok(css.includes("@custom-variant dark (&:where(.dark, .dark *));"), "Configures @custom-variant dark for Tailwind v4");
  assert.ok(css.includes("--background:"), "Defines --background token");
  assert.ok(css.includes("--surface-elevated:"), "Defines --surface-elevated token");
  assert.ok(css.includes(".forced-light"), "Defines .forced-light rules");
  assert.ok(css.includes(".dark select"), "Defines dark select background rule");
});
