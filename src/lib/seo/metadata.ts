import type { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site';

export interface PageMetadataOptions {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
  keywords?: string[];
  ogType?: 'website' | 'article';
  image?: string;
}

/**
 * Centralized metadata generator for Saarvi pages.
 * Ensures consistent canonical URLs, social share tags, and strict indexing controls.
 */
export function createMetadata({
  title,
  description,
  path = '',
  noIndex = false,
  keywords = [],
  ogType = 'website',
  image = '/og-image.png',
}: PageMetadataOptions): Metadata {
  const baseUrl = SITE_CONFIG.url || 'https://saarvi.in';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const canonicalUrl = `${baseUrl}${cleanPath === '/' ? '' : cleanPath}`;

  const formattedTitle =
    title === 'Saarvi' || title.startsWith('Saarvi —')
      ? title
      : `${title} — Saarvi`;

  const defaultKeywords = [
    'document tools',
    'pdf utilities',
    'image converter',
    'vtu calculators',
    'student tools',
    'local processing',
    'private document tools',
  ];

  const mergedKeywords = Array.from(new Set([...defaultKeywords, ...keywords]));
  const fullImageUrl = image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? '' : '/'}${image}`;

  return {
    title: formattedTitle,
    description,
    keywords: mergedKeywords,
    authors: [{ name: 'Saarvi Team' }],
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
            'max-video-preview': -1,
            'max-image-preview': 'none',
            'max-snippet': -1,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    openGraph: {
      title: formattedTitle,
      description,
      url: canonicalUrl,
      siteName: 'Saarvi',
      locale: 'en_US',
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
      card: 'summary_large_image',
      title: formattedTitle,
      description,
      images: [fullImageUrl],
    },
  };
}
