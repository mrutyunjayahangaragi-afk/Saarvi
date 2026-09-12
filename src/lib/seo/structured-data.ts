import { ToolDefinition } from '@/types/tool';
import { SITE_CONFIG } from '@/config/site';

/**
 * Structured Data (JSON-LD) Generators.
 * STRICT TRUTHFULNESS: Only generates schemas for content that visibly exists.
 * Zero fake reviews, zero fake ratings, zero fabricated testimonials.
 */

export function generateWebSiteSchema() {
  const baseUrl = SITE_CONFIG.url || 'https://saarvi.app';

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Saarvi',
    url: baseUrl,
    description: SITE_CONFIG.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/tools?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateToolSchema(tool: ToolDefinition) {
  const baseUrl = SITE_CONFIG.url || 'https://saarvi.app';

  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${tool.name} — Saarvi`,
    description: tool.description,
    url: `${baseUrl}${tool.route}`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'All',
    browserRequirements: 'Requires modern web browser with HTML5 and JavaScript support.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: tool.howItWorks ? tool.howItWorks.join(', ') : undefined,
  };
}

export function generateFaqSchema(faqItems: Array<{ question: string; answer: string }>) {
  if (!faqItems || faqItems.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  const baseUrl = SITE_CONFIG.url || 'https://saarvi.app';

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url.startsWith('/') ? '' : '/'}${item.url}`,
    })),
  };
}
