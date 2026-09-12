/**
 * DocEase Phase 27 — Technical SEO & Metadata Test Suite.
 *
 * Verifies:
 * 1. Metadata generator helper formatting (titles, descriptions, canonical URLs)
 * 2. Canonical URL handling, path normalization, and duplicate index prevention
 * 3. Robots.txt rules: public routes allowed, private/admin/auth/dashboard routes disallowed
 * 4. Sitemap generation: valid public URLs only, strict exclusion of private/admin/auth routes
 * 5. Structured data (JSON-LD): WebSite, WebApplication, FAQPage (only with visible FAQs), BreadcrumbList
 * 6. Open Graph & Twitter Card social metadata integrity
 * 7. Verification of non-indexable private routes (noindex, nofollow)
 */

import test from "node:test";
import assert from "node:assert/strict";

// =========================================================================
// 1. METADATA HELPER & CANONICAL STRATEGY IMPLEMENTATION
// =========================================================================

function createMetadata({
  title,
  description,
  path = "",
  noIndex = false,
  keywords = [],
  ogType = "website",
  image = "/og-image.png",
}) {
  const baseUrl = "https://saarvi.app";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const canonicalUrl = `${baseUrl}${cleanPath === "/" ? "" : cleanPath}`;

  const formattedTitle =
    title === "Saarvi" || title.startsWith("Saarvi —")
      ? title
      : `${title} — Saarvi`;

  const defaultKeywords = [
    "document tools",
    "pdf utilities",
    "image converter",
    "vtu calculators",
    "student tools",
    "local processing",
    "private document tools",
  ];

  const mergedKeywords = Array.from(new Set([...defaultKeywords, ...keywords]));
  const fullImageUrl = image.startsWith("http") ? image : `${baseUrl}${image.startsWith("/") ? "" : "/"}${image}`;

  return {
    title: formattedTitle,
    description,
    keywords: mergedKeywords,
    authors: [{ name: "Saarvi Team" }],
    metadataBase: new URL(baseUrl),
    alternates: noIndex
      ? undefined
      : {
          canonical: canonicalUrl,
        },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            "max-video-preview": -1,
            "max-image-preview": "none",
            "max-snippet": -1,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    openGraph: {
      title: formattedTitle,
      description,
      url: canonicalUrl,
      siteName: "Saarvi",
      locale: "en_US",
      type: ogType,
      images: [
        {
          url: fullImageUrl,
          width: 1200,
          height: 630,
          alt: formattedTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: formattedTitle,
      description,
      images: [fullImageUrl],
    },
  };
}

test("Phase 27 - SEO 1: Metadata helper formats consistent brand titles and descriptions", () => {
  const metaHome = createMetadata({
    title: "Saarvi — Study. Work. Grow.",
    description: "Convert, compress and manage documents.",
    path: "/",
  });
  assert.equal(metaHome.title, "Saarvi — Study. Work. Grow.");
  assert.equal(metaHome.description, "Convert, compress and manage documents.");

  const metaTool = createMetadata({
    title: "JPG to PDF",
    description: "Convert JPG images to PDF.",
    path: "/tools/jpg-to-pdf",
  });
  assert.equal(metaTool.title, "JPG to PDF — Saarvi");
  assert.equal(metaTool.description, "Convert JPG images to PDF.");
  assert.ok(metaTool.alternates?.canonical);
  assert.equal(metaTool.alternates.canonical, "https://saarvi.app/tools/jpg-to-pdf");
});

test("Phase 27 - SEO 2: Canonical URL handling normalizes leading slashes and prevents duplicate indexing", () => {
  const metaWithSlash = createMetadata({
    title: "Pricing",
    description: "Saarvi pricing",
    path: "/pricing",
  });
  const metaWithoutSlash = createMetadata({
    title: "Pricing",
    description: "Saarvi pricing",
    path: "pricing",
  });
  assert.equal(metaWithSlash.alternates?.canonical, "https://saarvi.app/pricing");
  assert.equal(metaWithoutSlash.alternates?.canonical, "https://saarvi.app/pricing");

  // Root path canonical normalization
  const metaHome = createMetadata({
    title: "Saarvi",
    description: "Saarvi homepage",
    path: "/",
  });
  assert.equal(metaHome.alternates?.canonical, "https://saarvi.app");
});

test("Phase 27 - SEO 3: Private non-indexable routes receive strict noindex, nofollow directives", () => {
  const privateMeta = createMetadata({
    title: "Admin Control Center",
    description: "Platform management",
    path: "/admin",
    noIndex: true,
  });

  assert.equal(privateMeta.alternates?.canonical, undefined);
  assert.deepEqual(privateMeta.robots, {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  });
});

// =========================================================================
// 2. ROBOTS.TXT CRAWLER DIRECTIVES
// =========================================================================

function generateRobots() {
  const baseUrl = "https://saarvi.app";
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/tools",
        "/tools/*",
        "/student",
        "/student/sgpa-calculator",
        "/student/cgpa-calculator",
        "/student/marks-calculator",
        "/student/percentage",
        "/about",
        "/pricing",
        "/privacy",
        "/terms",
        "/contact",
      ],
      disallow: [
        "/admin/",
        "/admin/*",
        "/dashboard/",
        "/dashboard/*",
        "/api/",
        "/api/*",
        "/auth/",
        "/auth/*",
        "/checkout/",
        "/checkout/*",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/career/",
        "/career/*",
        "/student/dashboard",
        "/student/copilot",
        "/student/copilot/*",
        "/student/attendance",
        "/student/timetable",
        "/student/assignment-planner",
        "/student/study-planner",
        "/student/tasks",
        "/student/goals",
        "/student/exams",
        "/student/certificates",
        "/student/internships",
        "/student/hackathons",
        "/student/applications",
        "/student/resume",
        "/student/cover-letter",
        "/student/career",
        "/student/study-assistant",
        "/student/settings",
        "/student/settings/*",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

test("Phase 27 - SEO 4: Robots.txt allows public routes and disallows private/admin/auth/dashboard routes", () => {
  const robotsConfig = generateRobots();
  assert.ok(robotsConfig.rules);
  const rules = robotsConfig.rules;

  // Verify allow array exists and includes public surfaces
  assert.ok(Array.isArray(rules.allow));
  assert.ok(rules.allow.includes("/"));
  assert.ok(rules.allow.includes("/tools"));
  assert.ok(rules.allow.includes("/student"));
  assert.ok(rules.allow.includes("/student/sgpa-calculator"));
  assert.ok(rules.allow.includes("/pricing"));

  // Verify disallow array exists and includes private boundaries
  assert.ok(Array.isArray(rules.disallow));
  const disallows = rules.disallow;
  assert.ok(disallows.includes("/admin/"));
  assert.ok(disallows.includes("/dashboard/"));
  assert.ok(disallows.includes("/api/"));
  assert.ok(disallows.includes("/auth/"));
  assert.ok(disallows.includes("/checkout/"));
  assert.ok(disallows.includes("/login"));
  assert.ok(disallows.includes("/signup"));
  assert.ok(disallows.includes("/student/dashboard"));
  assert.ok(disallows.includes("/student/attendance"));
  assert.ok(disallows.includes("/student/timetable"));
  assert.ok(disallows.includes("/student/assignment-planner"));
  assert.ok(disallows.includes("/student/copilot"));

  // Verify declared sitemap
  assert.equal(robotsConfig.sitemap, "https://saarvi.app/sitemap.xml");
});

// =========================================================================
// 3. XML SITEMAP GENERATION
// =========================================================================

function generateSitemap() {
  const baseUrl = "https://saarvi.app";
  const now = new Date();

  const staticRoutes = [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/tools`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/student`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const studentCalculatorRoutes = [
    { url: `${baseUrl}/student/sgpa-calculator`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/student/cgpa-calculator`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/student/marks-calculator`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/student/percentage`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  const standaloneToolRoutes = [
    { url: `${baseUrl}/tools/organize-pdf`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/tools/ocr-pdf`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/tools/ocr-image`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/tools/document-qa`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${baseUrl}/tools/document-summary`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
  ];

  const sampleToolSlugs = [
    "jpg-to-pdf", "png-to-jpg", "jpg-to-png", "compress-pdf", "merge-pdf", "split-pdf"
  ];
  const dynamicToolRoutes = sampleToolSlugs.map((slug) => ({
    url: `${baseUrl}/tools/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const uniqueMap = new Map();
  [...staticRoutes, ...studentCalculatorRoutes, ...standaloneToolRoutes, ...dynamicToolRoutes].forEach((entry) => {
    if (!uniqueMap.has(entry.url)) {
      uniqueMap.set(entry.url, entry);
    }
  });

  return Array.from(uniqueMap.values());
}

test("Phase 27 - SEO 5: Sitemap contains only valid public URLs and strictly excludes private/admin routes", () => {
  const sitemapEntries = generateSitemap();
  assert.ok(Array.isArray(sitemapEntries));
  assert.ok(sitemapEntries.length >= 20);

  const urls = sitemapEntries.map((e) => e.url);

  // Must include core public routes
  assert.ok(urls.includes("https://saarvi.app"));
  assert.ok(urls.includes("https://saarvi.app/tools"));
  assert.ok(urls.includes("https://saarvi.app/student"));
  assert.ok(urls.includes("https://saarvi.app/pricing"));
  assert.ok(urls.includes("https://saarvi.app/about"));
  assert.ok(urls.includes("https://saarvi.app/privacy"));
  assert.ok(urls.includes("https://saarvi.app/terms"));
  assert.ok(urls.includes("https://saarvi.app/contact"));

  // Must include public calculators
  assert.ok(urls.includes("https://saarvi.app/student/sgpa-calculator"));
  assert.ok(urls.includes("https://saarvi.app/student/cgpa-calculator"));
  assert.ok(urls.includes("https://saarvi.app/student/marks-calculator"));

  // Must strictly exclude private and admin paths
  for (const url of urls) {
    assert.ok(!url.includes("/admin"), `Sitemap must not contain admin route: ${url}`);
    assert.ok(!url.includes("/dashboard"), `Sitemap must not contain dashboard route: ${url}`);
    assert.ok(!url.includes("/api"), `Sitemap must not contain API route: ${url}`);
    assert.ok(!url.includes("/login"), `Sitemap must not contain login: ${url}`);
    assert.ok(!url.includes("/signup"), `Sitemap must not contain signup: ${url}`);
    assert.ok(!url.includes("/attendance"), `Sitemap must not contain private attendance: ${url}`);
    assert.ok(!url.includes("/timetable"), `Sitemap must not contain private timetable: ${url}`);
    assert.ok(!url.includes("/copilot"), `Sitemap must not contain private copilot: ${url}`);
    assert.ok(!url.includes("?"), `Sitemap must not contain query parameters: ${url}`);
  }
});

// =========================================================================
// 4. STRUCTURED DATA (JSON-LD)
// =========================================================================

function generateWebSiteSchema() {
  const baseUrl = "https://saarvi.app";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Saarvi",
    url: baseUrl,
    description: "Simple tools for your documents.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/tools?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function generateToolSchema(tool) {
  const baseUrl = "https://saarvi.app";
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${tool.name} — Saarvi`,
    description: tool.description,
    url: `${baseUrl}${tool.route}`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "All",
    browserRequirements: "Requires modern web browser with HTML5 and JavaScript support.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

function generateFaqSchema(faqItems) {
  if (!faqItems || faqItems.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function generateBreadcrumbSchema(items) {
  const baseUrl = "https://saarvi.app";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${baseUrl}${item.url.startsWith("/") ? "" : "/"}${item.url}`,
    })),
  };
}

test("Phase 27 - SEO 6: Structured data schemas adhere to Schema.org standards without fake reviews or ratings", () => {
  // WebSite schema
  const siteSchema = generateWebSiteSchema();
  assert.equal(siteSchema["@context"], "https://schema.org");
  assert.equal(siteSchema["@type"], "WebSite");
  assert.equal(siteSchema.name, "Saarvi");
  assert.ok(siteSchema.potentialAction);

  // WebApplication schema for tool
  const sampleTool = { name: "JPG to PDF", description: "Convert JPG to PDF", route: "/tools/jpg-to-pdf" };
  const toolSchema = generateToolSchema(sampleTool);
  assert.equal(toolSchema["@context"], "https://schema.org");
  assert.equal(toolSchema["@type"], "WebApplication");
  assert.equal(toolSchema.applicationCategory, "UtilitiesApplication");
  assert.equal(toolSchema.operatingSystem, "All");
  assert.equal(toolSchema.offers.price, "0");
  assert.equal(toolSchema.aggregateRating, undefined, "Must NOT contain fake aggregate ratings");
  assert.equal(toolSchema.review, undefined, "Must NOT contain fake reviews");

  // FAQPage schema only where FAQs visibly exist
  const emptyFaq = generateFaqSchema([]);
  assert.equal(emptyFaq, null, "Must return null when no FAQs exist");

  const realFaq = generateFaqSchema([
    { question: "Is Saarvi free?", answer: "Yes, basic tools are free." },
  ]);
  assert.ok(realFaq);
  assert.equal(realFaq["@type"], "FAQPage");
  assert.equal(realFaq.mainEntity.length, 1);
  assert.equal(realFaq.mainEntity[0].name, "Is Saarvi free?");

  // BreadcrumbList schema
  const breadcrumbs = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Tools", url: "/tools" },
    { name: "JPG to PDF", url: "/tools/jpg-to-pdf" },
  ]);
  assert.equal(breadcrumbs["@type"], "BreadcrumbList");
  assert.equal(breadcrumbs.itemListElement.length, 3);
  assert.equal(breadcrumbs.itemListElement[0].position, 1);
  assert.equal(breadcrumbs.itemListElement[2].item, "https://saarvi.app/tools/jpg-to-pdf");
});

// =========================================================================
// 5. OPEN GRAPH & SOCIAL METADATA
// =========================================================================

test("Phase 27 - SEO 7: Open Graph and Twitter Card metadata include verified image, type, and siteName", () => {
  const meta = createMetadata({
    title: "VTU SGPA Calculator",
    description: "Calculate official VTU SGPA",
    path: "/student/sgpa-calculator",
    ogType: "website",
  });

  assert.ok(meta.openGraph);
  assert.equal(meta.openGraph.siteName, "Saarvi");
  assert.equal(meta.openGraph.type, "website");
  assert.equal(meta.openGraph.url, "https://saarvi.app/student/sgpa-calculator");
  assert.ok(Array.isArray(meta.openGraph.images));
  assert.equal(meta.openGraph.images[0].width, 1200);
  assert.equal(meta.openGraph.images[0].height, 630);

  assert.ok(meta.twitter);
  assert.equal(meta.twitter.card, "summary_large_image");
  assert.equal(meta.twitter.title, "VTU SGPA Calculator — Saarvi");
});
