"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { PlatformSettings, SeoSettings } from '@/types/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export interface PlatformContextValue {
  platformSettings: PlatformSettings;
  seoSettings: SeoSettings;
  isLoading: boolean;
  version: number;
  // Computed helpers for quick access across web & user components
  appName: string;
  tagline: string;
  brandAccent: string;
  supportEmail: string;
  contactEmail: string;
  isMaintenance: boolean;
  maintenanceMessage: string;
  isRegistrationEnabled: boolean;
  isGuestAccessEnabled: boolean;
  defaultAutoDownload: boolean;
  seo: SeoSettings;
  refreshSettings: () => Promise<void>;
}

const DEFAULT_PLATFORM: PlatformSettings = {
  appName: 'Saarvi',
  tagline: 'Saarvi — Study. Work. Grow.',
  logoUrl: '/brand/saarvi-logo.png',
  faviconUrl: '/brand/favicon.png',
  brandAccent: '#2563eb',
  supportEmail: 'support@saarvi.in',
  contactEmail: 'contact@saarvi.in',
  defaultLanguage: 'en',
  defaultTimezone: 'Asia/Kolkata',
  maintenanceMode: false,
  maintenanceMessage: 'Saarvi is temporarily under maintenance. Please try again shortly.',
  registrationEnabled: true,
  guestAccessEnabled: true,
  defaultAutoDownload: true,
  publicToolAvailability: true,
  siteTitle: 'Saarvi — Study. Work. Grow.',
  siteDescription: 'High-performance browser-based PDF and image conversion tools with VTU CBCS/NEP academic calculators and resume builders.',
  canonicalBase: 'https://saarvi.app',
  ogTitle: 'Saarvi — Study. Work. Grow.',
  ogDescription: 'Fast client-side document utilities, SGPA/CGPA calculators, and career organizers.',
  robotsIndexable: true,
  keywords: ['saarvi', 'pdf tools', 'image converter', 'student tools', 'compress pdf', 'merge pdf', 'resume builder'],
  version: 1,
  updatedBy: 'system',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_SEO: SeoSettings = {
  siteTitle: 'Saarvi — Study. Work. Grow.',
  siteDescription: 'High-performance browser-based PDF and image conversion tools with VTU CBCS/NEP academic calculators and resume builders.',
  canonicalBase: 'https://saarvi.app',
  ogTitle: 'Saarvi — Study. Work. Grow.',
  ogDescription: 'Fast client-side document utilities, SGPA/CGPA calculators, and career organizers.',
  robotsIndexable: true,
  keywords: ['saarvi', 'pdf tools', 'image converter', 'student tools', 'compress pdf', 'merge pdf', 'resume builder'],
  twitterHandle: '@saarviapp',
  updatedBy: 'system',
  updatedAt: new Date().toISOString(),
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

// --- Pure DOM helpers (no React state, no deps) ---
function updateOrInsertMeta(name: string, content: string, isProperty = false) {
  if (typeof document === 'undefined') return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function updateOrInsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

function applyDomUpdates(plat: PlatformSettings, seo: SeoSettings) {
  if (typeof document === 'undefined') return;

  // 1. Dynamic CSS Variables (Brand Accent)
  if (plat.brandAccent) {
    document.documentElement.style.setProperty('--brand-accent', plat.brandAccent);
    document.documentElement.style.setProperty('--primary', plat.brandAccent);
  }

  // 2. Page title
  if (seo.siteTitle && (document.title.includes('Saarvi') || document.title === '')) {
    document.title = seo.siteTitle;
  }

  // 3. Meta description & robots
  if (seo.siteDescription) updateOrInsertMeta('description', seo.siteDescription);
  updateOrInsertMeta('robots', seo.robotsIndexable ? 'index, follow' : 'noindex, nofollow');
  updateOrInsertMeta('googlebot', seo.robotsIndexable ? 'index, follow' : 'noindex, nofollow');

  // 4. OpenGraph
  if (seo.ogTitle || seo.siteTitle) {
    updateOrInsertMeta('og:title', seo.ogTitle || seo.siteTitle || plat.appName, true);
  }
  if (seo.ogDescription || seo.siteDescription) {
    updateOrInsertMeta('og:description', seo.ogDescription || seo.siteDescription || plat.tagline, true);
  }

  // 5. Canonical
  if (seo.canonicalBase) {
    const currentPath = window.location.pathname;
    const canonicalUrl = `${seo.canonicalBase.replace(/\/$/, '')}${currentPath === '/' ? '' : currentPath}`;
    updateOrInsertCanonical(canonicalUrl);
  }
}

// --- Provider ---
export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM);
  const [seoSettings, setSeoSettings] = useState<SeoSettings>(DEFAULT_SEO);
  const [isLoading, setIsLoading] = useState(true);

  // Refs to always access the latest state inside event handlers
  // without them appearing in dependency arrays
  const platformRef = useRef<PlatformSettings>(DEFAULT_PLATFORM);
  const seoRef = useRef<SeoSettings>(DEFAULT_SEO);

  // Keep refs in sync with state (no re-render, no effect re-run)
  platformRef.current = platformSettings;
  seoRef.current = seoSettings;

  // Stable setter that also applies DOM side-effects
  const applySettings = useCallback((p: PlatformSettings, s: SeoSettings) => {
    setPlatformSettings(p);
    setSeoSettings(s);
    applyDomUpdates(p, s);
  }, []); // truly stable — no outer deps

  // Stable refresh: reads from localStorage then optionally API
  const refreshSettings = useCallback(async () => {
    // 1. Sync from localStorage immediately
    try {
      const p = MockStorageProvider.getPlatformSettings();
      const s = MockStorageProvider.getSeoSettings();
      applySettings(p, s);
    } catch {
      // keep defaults
    }

    // 2. Background reconcile against API (does NOT trigger re-runs)
    try {
      const res = await fetch('/api/platform/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.platform || data.seo) {
          const p = data.platform ?? platformRef.current;
          const s = data.seo ?? seoRef.current;
          applySettings(p, s);
        }
      }
    } catch {
      // network unavailable — local settings are already active
    } finally {
      setIsLoading(false);
    }
  }, [applySettings]); // applySettings is stable → refreshSettings is stable

  // ONE effect, stable deps → runs exactly once on mount
  useEffect(() => {
    // Initial load
    refreshSettings();

    // Platform settings update (same tab, dispatched by adminService)
    const handlePlatformUpdate = (e: Event) => {
      const ev = e as CustomEvent<PlatformSettings>;
      if (ev.detail) {
        applySettings(ev.detail, seoRef.current);
      } else {
        refreshSettings();
      }
    };

    // SEO settings update (same tab, dispatched by adminService)
    const handleSeoUpdate = (e: Event) => {
      const ev = e as CustomEvent<SeoSettings>;
      if (ev.detail) {
        applySettings(platformRef.current, ev.detail);
      } else {
        refreshSettings();
      }
    };

    // Generic platform change notification
    const handlePlatformChange = () => refreshSettings();

    // Cross-tab sync via StorageEvent
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'saarvi_platform_sync_trigger' ||
        e.key === 'saarvi_platform_settings_v1' ||
        e.key === 'saarvi_seo_settings_v1'
      ) {
        refreshSettings();
      }
    };

    window.addEventListener('saarvi_platform_settings_updated', handlePlatformUpdate);
    window.addEventListener('saarvi_seo_updated', handleSeoUpdate);
    window.addEventListener('saarvi_platform_change', handlePlatformChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('saarvi_platform_settings_updated', handlePlatformUpdate);
      window.removeEventListener('saarvi_seo_updated', handleSeoUpdate);
      window.removeEventListener('saarvi_platform_change', handlePlatformChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshSettings, applySettings]); // both are stable useCallbacks → effect runs once

  const value = useMemo<PlatformContextValue>(() => ({
    platformSettings,
    seoSettings,
    isLoading,
    version: platformSettings.version,
    appName: platformSettings.appName || 'Saarvi',
    tagline: platformSettings.tagline || 'Saarvi — Study. Work. Grow.',
    brandAccent: platformSettings.brandAccent || '#2563eb',
    supportEmail: platformSettings.supportEmail || 'support@saarvi.in',
    contactEmail: platformSettings.contactEmail || 'contact@saarvi.in',
    isMaintenance: Boolean(platformSettings.maintenanceMode),
    maintenanceMessage: platformSettings.maintenanceMessage || 'Saarvi is temporarily under maintenance. Please try again shortly.',
    isRegistrationEnabled: platformSettings.registrationEnabled !== false,
    isGuestAccessEnabled: platformSettings.guestAccessEnabled !== false,
    defaultAutoDownload: platformSettings.defaultAutoDownload !== false,
    seo: seoSettings,
    refreshSettings,
  }), [platformSettings, seoSettings, isLoading, refreshSettings]);

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const context = useContext(PlatformContext);
  if (!context) {
    // Graceful fallback if called outside provider (e.g., in edge tests)
    return {
      platformSettings: DEFAULT_PLATFORM,
      seoSettings: DEFAULT_SEO,
      isLoading: false,
      version: 1,
      appName: 'Saarvi',
      tagline: 'Saarvi — Study. Work. Grow.',
      brandAccent: '#2563eb',
      supportEmail: 'support@saarvi.in',
      contactEmail: 'contact@saarvi.in',
      isMaintenance: false,
      maintenanceMessage: 'Saarvi is temporarily under maintenance. Please try again shortly.',
      isRegistrationEnabled: true,
      isGuestAccessEnabled: true,
      defaultAutoDownload: true,
      seo: DEFAULT_SEO,
      refreshSettings: async () => {},
    };
  }
  return context;
}
