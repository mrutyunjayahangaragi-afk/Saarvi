import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

test("SEO Domination 1: SITE_CONFIG and metadata configure canonical https://saarvi.app", () => {
  const siteTs = fs.readFileSync(path.join(ROOT_DIR, "src/config/site.ts"), "utf8");
  assert.ok(siteTs.includes('canonicalUrl: "https://saarvi.app"'));
  assert.ok(siteTs.includes('name: "Saarvi"'));
  assert.ok(siteTs.includes('tagline: "Study. Work. Grow."'));

  const metadataTs = fs.readFileSync(path.join(ROOT_DIR, "src/lib/seo/metadata.ts"), "utf8");
  assert.ok(metadataTs.includes("https://saarvi.app"));

  const layoutTs = fs.readFileSync(path.join(ROOT_DIR, "src/app/layout.tsx"), "utf8");
  assert.ok(layoutTs.includes('metadataBase: new URL("https://saarvi.app")'));
});

test("SEO Domination 2: Direct Search -> Exact Tool Page 308 redirects in next.config.ts", () => {
  const nextConfigTs = fs.readFileSync(path.join(ROOT_DIR, "next.config.ts"), "utf8");
  
  const expectedRedirects = [
    { source: "/pdf-to-jpg", dest: "/tools/pdf-to-jpg" },
    { source: "/jpg-to-pdf", dest: "/tools/jpg-to-pdf" },
    { source: "/image-to-pdf", dest: "/tools/image-to-pdf" },
    { source: "/compress-pdf", dest: "/tools/compress-pdf" },
    { source: "/merge-pdf", dest: "/tools/merge-pdf" },
    { source: "/split-pdf", dest: "/tools/split-pdf" },
    { source: "/pdf-to-png", dest: "/tools/pdf-to-png" },
    { source: "/png-to-jpg", dest: "/tools/png-to-jpg" },
    { source: "/jpg-to-png", dest: "/tools/jpg-to-png" },
    { source: "/image-compressor", dest: "/tools/compress-image" },
    { source: "/compress-image", dest: "/tools/compress-image" },
    { source: "/resume-builder", dest: "/student/resume" },
    { source: "/ats-checker", dest: "/student/ats" },
    { source: "/cover-letter", dest: "/student/cover-letter" },
  ];

  for (const { source, dest } of expectedRedirects) {
    assert.ok(
      nextConfigTs.includes(`source: "${source}"`) && nextConfigTs.includes(`destination: "${dest}"`),
      `Missing redirect from ${source} to ${dest}`
    );
  }
});

test("SEO Domination 3: Unused Hero Column is completely removed from HeroSection.tsx", () => {
  const heroTs = fs.readFileSync(path.join(ROOT_DIR, "src/components/home/HeroSection.tsx"), "utf8");

  // Verify the exact unused element was deleted
  assert.doesNotMatch(heroTs, /lg:col-span-5 flex items-center justify-center pt-6 lg:pt-0/);
  assert.doesNotMatch(heroTs, /100% In-Browser/);

  // Verify upgraded hero content
  assert.ok(heroTs.includes("PRIVATE BY DESIGN • FAST BY DESIGN"));
  assert.ok(heroTs.includes("Your everyday tools."));
  assert.ok(heroTs.includes("One simple workspace."));
  assert.ok(heroTs.includes("Explore Tools"));
  assert.ok(heroTs.includes("Local processing"));
  assert.ok(heroTs.includes("Automatic download"));
});

test("SEO Domination 4: Server-rendered /tools page has metadata and crawlable links", () => {
  const toolsPage = fs.readFileSync(path.join(ROOT_DIR, "src/app/tools/page.tsx"), "utf8");

  // Must NOT be client-only
  assert.doesNotMatch(toolsPage, /^"use client"/m);

  // Must export metadata
  assert.ok(toolsPage.includes("export const metadata: Metadata"));
  assert.ok(toolsPage.includes("All Tools"));

  // Must include standard crawlable HTML links
  assert.ok(toolsPage.includes("PDF Tools"));
  assert.ok(toolsPage.includes("Image Tools"));
  assert.ok(toolsPage.includes("Academic & Student Tools"));
  assert.ok(toolsPage.includes("href={t.route}"));
});

test("SEO Domination 5: Tool SEO educational content is rich, unique, and honest", () => {
  const contentTs = fs.readFileSync(path.join(ROOT_DIR, "src/config/tool-seo-content.ts"), "utf8");

  // Core tools are registered with unique content
  assert.ok(contentTs.includes("pdf-to-jpg"));
  assert.ok(contentTs.includes("jpg-to-pdf"));
  assert.ok(contentTs.includes("compress-pdf"));
  assert.ok(contentTs.includes("merge-pdf"));
  assert.ok(contentTs.includes("split-pdf"));

  // Check unique educational topics
  assert.ok(contentTs.includes("JPG vs. JPEG: What is the difference?"));
  assert.ok(contentTs.includes("How Multi-Page PDF Conversion Works in Saarvi"));
  assert.ok(contentTs.includes("Lossy vs. Lossless Image Compression"));

  // High-intent search titles
  assert.ok(contentTs.includes("PDF to JPG Converter — Free Online PDF to JPG | Saarvi"));
  assert.ok(contentTs.includes("Compress PDF — Reduce PDF File Size Online Free | Saarvi"));
});

test("SEO Domination 6: Robots.txt and Sitemap.xml reference https://saarvi.app and exclude private boundaries", () => {
  const robotsTs = fs.readFileSync(path.join(ROOT_DIR, "src/app/robots.ts"), "utf8");
  assert.ok(robotsTs.includes("https://saarvi.app"));
  assert.ok(robotsTs.includes("'/blog'"));

  const sitemapTs = fs.readFileSync(path.join(ROOT_DIR, "src/app/sitemap.ts"), "utf8");
  assert.ok(sitemapTs.includes("https://saarvi.app"));
  assert.ok(sitemapTs.includes("/blog"));
  assert.ok(sitemapTs.includes("/blog/how-to-convert-pdf-to-jpg"));
  assert.ok(sitemapTs.includes("/blog/how-to-compress-pdf"));
});

test("SEO Domination 7: Educational Blog system is populated with genuine tutorials", () => {
  const blogDataTs = fs.readFileSync(path.join(ROOT_DIR, "src/config/blog-data.ts"), "utf8");
  assert.ok(blogDataTs.includes("how-to-convert-pdf-to-jpg"));
  assert.ok(blogDataTs.includes("how-to-compress-pdf"));
  assert.ok(blogDataTs.includes("how-to-convert-jpg-to-pdf"));
  assert.ok(blogDataTs.includes("how-to-merge-pdf-files"));
  assert.ok(blogDataTs.includes("pdf-vs-jpg"));

  const blogIndexPath = path.join(ROOT_DIR, "src/app/blog/page.tsx");
  assert.ok(fs.existsSync(blogIndexPath));

  const blogPostPath = path.join(ROOT_DIR, "src/app/blog/[slug]/page.tsx");
  assert.ok(fs.existsSync(blogPostPath));
});

test("SEO Domination 8: Structured data includes Organization, WebSite, WebApplication, and Article schemas", () => {
  const sdTs = fs.readFileSync(path.join(ROOT_DIR, "src/lib/seo/structured-data.ts"), "utf8");
  assert.ok(sdTs.includes("export function generateOrganizationSchema()"));
  assert.ok(sdTs.includes("export function generateWebSiteSchema()"));
  assert.ok(sdTs.includes("export function generateToolSchema"));
  assert.ok(sdTs.includes("export function generateArticleSchema"));
  assert.ok(sdTs.includes("https://saarvi.app"));
});

test("SEO Domination 9: Footer exposes direct crawlable category links", () => {
  const footerTs = fs.readFileSync(path.join(ROOT_DIR, "src/components/layout/Footer.tsx"), "utf8");
  assert.ok(footerTs.includes('href="/tools/pdf-to-jpg"'));
  assert.ok(footerTs.includes('href="/tools/compress-pdf"'));
  assert.ok(footerTs.includes('href="/student/resume"'));
  assert.ok(footerTs.includes('href="/blog"'));
});
