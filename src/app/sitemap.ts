import { MetadataRoute } from 'next';
import { TOOLS_CONFIG } from '@/config/tools';
import { SITE_CONFIG } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_CONFIG.url || 'https://saarvi.app';
  const now = new Date();

  // 1. Core Static Public Pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/tools`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/student`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // 2. Public Student Academic Calculators
  const studentCalculatorRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/student/sgpa-calculator`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/student/cgpa-calculator`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/student/marks-calculator`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/student/percentage`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];

  // 3. Standalone Tool Pages
  const standaloneToolRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/tools/organize-pdf`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/tools/ocr-pdf`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/tools/ocr-image`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/tools/document-qa`, lastModified: now, changeFrequency: 'weekly', priority: 0.75 },
    { url: `${baseUrl}/tools/document-summary`, lastModified: now, changeFrequency: 'weekly', priority: 0.75 },
  ];

  // 4. Dynamic Tool Routes from TOOLS_CONFIG (Only public accessible tools)
  const dynamicToolRoutes: MetadataRoute.Sitemap = TOOLS_CONFIG
    .filter((tool) => !tool.requiresAuth)
    .map((tool) => ({
      url: `${baseUrl}${tool.route}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: tool.popular ? 0.85 : 0.75,
    }));

  // Deduplicate by URL
  const uniqueMap = new Map<string, MetadataRoute.Sitemap[number]>();
  [
    ...staticRoutes,
    ...studentCalculatorRoutes,
    ...standaloneToolRoutes,
    ...dynamicToolRoutes,
  ].forEach((entry) => {
    if (!uniqueMap.has(entry.url)) {
      uniqueMap.set(entry.url, entry);
    }
  });

  return Array.from(uniqueMap.values());
}
