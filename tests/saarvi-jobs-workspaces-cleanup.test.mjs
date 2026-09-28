import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("1. Crawlable Directory Cleanup: No visible link dump in /tools and Footer", () => {
  const toolsPageContent = fs.readFileSync(path.join(ROOT, "src/app/tools/page.tsx"), "utf8");
  // Ensure the visible awkward heading "Crawlable Category Directory" is removed from the visible UI
  assert.ok(
    !toolsPageContent.includes("Crawlable Category Directory"),
    "Visible 'Crawlable Category Directory' must be removed from /tools"
  );
  // Ensure replaced with clean category workspace navigation
  assert.ok(
    toolsPageContent.includes("Explore by Category"),
    "Replaced with clean 'Explore by Category' section"
  );
  assert.ok(toolsPageContent.includes('href="/pdf"'), "Links to /pdf workspace");
  assert.ok(toolsPageContent.includes('href="/images"'), "Links to /images workspace");
  assert.ok(toolsPageContent.includes('href="/student-tools"'), "Links to /student-tools workspace");
  assert.ok(toolsPageContent.includes('href="/jobs"'), "Links to /jobs workspace");

  const footerContent = fs.readFileSync(path.join(ROOT, "src/components/layout/Footer.tsx"), "utf8");
  assert.ok(footerContent.includes('href="/pdf"'), "Footer links to /pdf");
  assert.ok(footerContent.includes('href="/images"'), "Footer links to /images");
  assert.ok(footerContent.includes('href="/student-tools"'), "Footer links to /student-tools");
  assert.ok(footerContent.includes('href="/jobs"'), "Footer links to /jobs");
});

test("2. Technical SEO: Sitemap and Robots.txt configure legitimate category workspaces", () => {
  const sitemapContent = fs.readFileSync(path.join(ROOT, "src/app/sitemap.ts"), "utf8");
  assert.ok(sitemapContent.includes("${baseUrl}/pdf"), "Sitemap contains /pdf");
  assert.ok(sitemapContent.includes("${baseUrl}/images"), "Sitemap contains /images");
  assert.ok(sitemapContent.includes("${baseUrl}/student-tools"), "Sitemap contains /student-tools");
  assert.ok(sitemapContent.includes("${baseUrl}/jobs"), "Sitemap contains /jobs");
  // Ensure admin/dashboard/api are NOT in sitemap
  assert.ok(!sitemapContent.includes('"/admin"'), "Sitemap excludes /admin");
  assert.ok(!sitemapContent.includes('"/dashboard"'), "Sitemap excludes /dashboard");
  assert.ok(!sitemapContent.includes('"/api"'), "Sitemap excludes /api");

  const robotsContent = fs.readFileSync(path.join(ROOT, "src/app/robots.ts"), "utf8");
  assert.ok(robotsContent.includes("'/pdf'"), "Robots allows /pdf");
  assert.ok(robotsContent.includes("'/images'"), "Robots allows /images");
  assert.ok(robotsContent.includes("'/student-tools'"), "Robots allows /student-tools");
  assert.ok(robotsContent.includes("'/jobs'"), "Robots allows /jobs");
  assert.ok(robotsContent.includes("'/admin/'"), "Robots disallows /admin/");
  assert.ok(robotsContent.includes("'/api/'"), "Robots disallows /api/");
});

test("3. Category Workspaces: /pdf, /images, /student-tools pages exist and use CategoryWorkspaceView", () => {
  const pdfPage = fs.readFileSync(path.join(ROOT, "src/app/pdf/page.tsx"), "utf8");
  assert.ok(pdfPage.includes("CategoryWorkspaceView"), "PDF page uses CategoryWorkspaceView");
  assert.ok(pdfPage.includes('category="pdf"'), "PDF page specifies category='pdf'");

  const imagesPage = fs.readFileSync(path.join(ROOT, "src/app/images/page.tsx"), "utf8");
  assert.ok(imagesPage.includes("CategoryWorkspaceView"), "Images page uses CategoryWorkspaceView");
  assert.ok(imagesPage.includes('category="image"'), "Images page specifies category='image'");

  const studentPage = fs.readFileSync(path.join(ROOT, "src/app/student-tools/page.tsx"), "utf8");
  assert.ok(studentPage.includes("CategoryWorkspaceView"), "Student tools page uses CategoryWorkspaceView");
  assert.ok(studentPage.includes('category="student"'), "Student page specifies category='student'");

  const workspaceComponent = fs.readFileSync(path.join(ROOT, "src/components/tools/CategoryWorkspaceView.tsx"), "utf8");
  assert.ok(workspaceComponent.includes("CANONICAL_TOOL_REGISTRY"), "Workspace uses CANONICAL_TOOL_REGISTRY");
  assert.ok(workspaceComponent.includes("CATEGORY_TABS"), "Workspace includes Category Switcher Header");
  assert.ok(workspaceComponent.includes("searchQuery"), "Workspace includes category search");
  assert.ok(workspaceComponent.includes("Popular"), "Workspace includes quick actions row");
  assert.ok(workspaceComponent.includes("Explore All Tools"), "Workspace includes related tools / next steps row");
});

test("4. Navbar and MegaMenu: Category-first navigation with direct routing and preview", () => {
  const navbarContent = fs.readFileSync(path.join(ROOT, "src/components/layout/Navbar.tsx"), "utf8");
  assert.ok(navbarContent.includes('href="/pdf"'), "Navbar has link to /pdf");
  assert.ok(navbarContent.includes('href="/images"'), "Navbar has link to /images");
  assert.ok(navbarContent.includes('href="/student-tools"'), "Navbar has link to /student-tools");
  assert.ok(navbarContent.includes('href="/jobs"'), "Navbar has link to /jobs");
  assert.ok(navbarContent.includes('href="/tools"'), "Navbar has link to /tools");

  const megaMenuContent = fs.readFileSync(path.join(ROOT, "src/components/layout/MegaMenu.tsx"), "utf8");
  assert.ok(megaMenuContent.includes('href="/pdf"'), "MegaMenu links to /pdf");
  assert.ok(megaMenuContent.includes('href="/images"'), "MegaMenu links to /images");
  assert.ok(megaMenuContent.includes('href="/student-tools"'), "MegaMenu links to /student-tools");
  assert.ok(megaMenuContent.includes('href="/jobs"'), "MegaMenu links to /jobs");
  assert.ok(megaMenuContent.includes("View All →"), "MegaMenu has View All links");
});

test("5. Jobs Architecture: SerpApiGoogleJobsProvider security and features", () => {
  const serpApiContent = fs.readFileSync(path.join(ROOT, "src/lib/jobs/providers/serpapi.ts"), "utf8");
  // Server-side secret key check
  assert.ok(serpApiContent.includes("SERPAPI_API_KEY"), "Uses server-side SERPAPI_API_KEY");
  assert.ok(!serpApiContent.includes("NEXT_PUBLIC_SERPAPI_API_KEY"), "Never exposes client-side NEXT_PUBLIC_SERPAPI_API_KEY");

  // Advanced provider capabilities
  assert.ok(serpApiContent.includes("class SerpApiGoogleJobsProvider"), "Implements SerpApiGoogleJobsProvider");
  assert.ok(serpApiContent.includes("next_page_token"), "Uses next_page_token pagination");
  assert.ok(serpApiContent.includes("inFlightRequests"), "Implements request coalescing");
  assert.ok(serpApiContent.includes("circuitState"), "Implements circuit breaker pattern");
  assert.ok(serpApiContent.includes("healthCheck"), "Implements provider healthCheck");
});

test("6. Canonical Database Schema: 025_canonical_jobs_and_internships_platform.sql", () => {
  const schemaContent = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/025_canonical_jobs_and_internships_platform.sql"),
    "utf8"
  );
  assert.ok(schemaContent.includes("CREATE TABLE IF NOT EXISTS public.job_opportunities"), "Creates job_opportunities table");
  assert.ok(schemaContent.includes("CREATE TABLE IF NOT EXISTS public.job_source_records"), "Creates job_source_records table");
  assert.ok(schemaContent.includes("CREATE TABLE IF NOT EXISTS public.job_audit_logs"), "Creates job_audit_logs table");
  assert.ok(schemaContent.includes("CREATE TABLE IF NOT EXISTS public.saved_jobs"), "Creates saved_jobs table");
  assert.ok(schemaContent.includes("UNIQUE (user_id, job_id)"), "Enforces UNIQUE(user_id, job_id) on saved_jobs");
  assert.ok(schemaContent.includes("CREATE TABLE IF NOT EXISTS public.job_applications"), "Creates job_applications table");
  assert.ok(schemaContent.includes("idx_job_opps_fts"), "Includes full-text search tsvector GIN index");
  assert.ok(schemaContent.includes("USING GIN (search_vector)"), "GIN index on search_vector");
  assert.ok(schemaContent.includes("ENABLE ROW LEVEL SECURITY"), "Enables Row Level Security");
});

test("7. Opportunity Status Machine and Admin Operations", () => {
  const typesContent = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/types.ts"), "utf8");
  assert.ok(typesContent.includes('"ACTIVE"'), "Supports ACTIVE status");
  assert.ok(typesContent.includes('"PAUSED"'), "Supports PAUSED status");
  assert.ok(typesContent.includes('"ARCHIVED"'), "Supports ARCHIVED status");
  assert.ok(typesContent.includes('"DELETED"'), "Supports DELETED status");
  assert.ok(typesContent.includes("publishedAt"), "Opportunity includes publishedAt field");

  const storeContent = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(storeContent.includes("publishOpportunity"), "Implements publishOpportunity");
  assert.ok(storeContent.includes("pauseOpportunity"), "Implements pauseOpportunity");
  assert.ok(storeContent.includes("resumeOpportunity"), "Implements resumeOpportunity");
  assert.ok(storeContent.includes("archiveOpportunity"), "Implements archiveOpportunity");
  assert.ok(storeContent.includes("deleteOpportunity"), "Implements soft & permanent deleteOpportunity");
  assert.ok(storeContent.includes("markExpired"), "Implements markExpired");
  assert.ok(storeContent.includes("checkAndExpireOutdatedJobs"), "Implements automated deadline expiration");

  const adminCareerPage = fs.readFileSync(path.join(ROOT, "src/app/admin/career/page.tsx"), "utf8");
  assert.ok(adminCareerPage.includes("handleBulkAction"), "Admin page implements handleBulkAction");
  assert.ok(adminCareerPage.includes("handleArchive"), "Admin page implements handleArchive");
  assert.ok(adminCareerPage.includes("openEditModal"), "Admin page implements edit opportunity modal");
  assert.ok(adminCareerPage.includes("DATA QUALITY CHECK:"), "Admin page displays factual Data Quality Check");
  assert.ok(adminCareerPage.includes("Permanent Delete (Superadmin only)"), "Admin page implements permanent delete confirmation");
});

test("8. User Authentication Gate and Intent Preservation", () => {
  const modalContent = fs.readFileSync(path.join(ROOT, "src/components/career/JobsAuthGateModal.tsx"), "utf8");
  assert.ok(
    modalContent.includes("Create a free Saarvi account to search jobs and internships"),
    "Shows exact prompt required by specification"
  );
  assert.ok(modalContent.includes("Continue with Google"), "Includes Continue with Google button");
  assert.ok(modalContent.includes("Continue with Email"), "Includes Continue with Email button");

  const jobsPage = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");
  assert.ok(jobsPage.includes("saveSearchIntent"), "Saves search intent when unauthenticated user searches");
  assert.ok(jobsPage.includes("getSearchIntent"), "Restores pending search query and filters post-login");
  assert.ok(jobsPage.includes("handleSaveJob"), "Implements handleSaveJob toggle with /api/jobs/saved");

  const intentModule = fs.readFileSync(path.join(ROOT, "src/lib/jobs/search-intent.ts"), "utf8");
  assert.ok(intentModule.includes("sessionStorage"), "Persists intent in sessionStorage");
});

test("9. Saved Jobs and Application Tracker API Endpoints", () => {
  const savedRoute = fs.readFileSync(path.join(ROOT, "src/app/api/jobs/saved/route.ts"), "utf8");
  assert.ok(savedRoute.includes("getAuthenticatedUser"), "Protected with user authentication");
  assert.ok(savedRoute.includes("saveJob"), "Supports saving jobs");
  assert.ok(savedRoute.includes("unsaveJob"), "Supports unsaving jobs");

  const appsRoute = fs.readFileSync(path.join(ROOT, "src/app/api/jobs/applications/route.ts"), "utf8");
  assert.ok(appsRoute.includes("getAuthenticatedUser"), "Protected with user authentication");
  assert.ok(appsRoute.includes("createOrUpdateJobApplication"), "Supports tracking application statuses");
  assert.ok(appsRoute.includes("enforceRateLimit"), "Rate limits user tracker requests");
});

test("10. Canonical Admin API Endpoints with Server-Side Authorization", () => {
  const adminJobsRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/route.ts"), "utf8");
  assert.ok(adminJobsRoute.includes("getAuthenticatedAdmin"), "Enforces server-side admin role");
  assert.ok(adminJobsRoute.includes("addManualOpportunity"), "Creates manual opportunities in canonical table");

  const adminJobsIdRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/[id]/route.ts"), "utf8");
  assert.ok(adminJobsIdRoute.includes("getAuthenticatedAdmin"), "Enforces admin authorization on PATCH/DELETE");
  assert.ok(adminJobsIdRoute.includes("deleteOpportunity"), "Supports soft and permanent delete");

  const adminPublishRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/[id]/publish/route.ts"), "utf8");
  assert.ok(adminPublishRoute.includes("publishOpportunity"), "Publishes opportunity live to /jobs");
});
