import { NextResponse } from 'next/server';
import { adminService } from '@/lib/services/adminService';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import type { PlatformSettings, SeoSettings } from '@/types/admin';

export const dynamic = 'force-dynamic';

function mapDbRowToPlatform(row: any): PlatformSettings {
  return {
    appName: row.app_name || 'Saarvi',
    tagline: row.tagline || 'Saarvi — Study. Work. Grow.',
    logoUrl: row.logo_url || '/brand/saarvi-logo.png',
    faviconUrl: row.favicon_url || '/brand/favicon.png',
    brandAccent: row.brand_accent || '#2563eb',
    supportEmail: row.support_email || 'saarvinotifications@gmail.com',
    contactEmail: row.contact_email || 'saarvinotifications@gmail.com',
    defaultLanguage: row.default_language || 'en',
    defaultTimezone: row.default_timezone || 'Asia/Kolkata',
    maintenanceMode: Boolean(row.maintenance_mode),
    maintenanceMessage: row.maintenance_message || 'Saarvi is temporarily under maintenance. Please try again shortly.',
    registrationEnabled: row.registration_enabled !== false,
    guestAccessEnabled: row.guest_access_enabled !== false,
    defaultAutoDownload: row.default_auto_download !== false,
    publicToolAvailability: row.public_tool_availability !== false,
    version: row.version || 1,
    updatedBy: row.updated_by || 'system',
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function mapDbRowToSeo(row: any): SeoSettings {
  let keywords: string[] = ['saarvi', 'pdf tools', 'image converter', 'student tools', 'compress pdf', 'merge pdf', 'resume builder'];
  if (row.maintenance_message) {
    try {
      const parsed = JSON.parse(row.maintenance_message);
      if (Array.isArray(parsed)) keywords = parsed;
    } catch {}
  }

  return {
    siteTitle: row.app_name || 'Saarvi — Study. Work. Grow.',
    siteDescription: row.tagline || 'High-performance browser-based PDF and image conversion tools with VTU CBCS/NEP academic calculators and resume builders.',
    canonicalBase: row.logo_url || 'https://saarvi.app',
    ogTitle: row.support_email || 'Saarvi — Study. Work. Grow.',
    ogDescription: row.contact_email || 'Fast client-side document utilities, SGPA/CGPA calculators, and career organizers.',
    robotsIndexable: row.default_language !== 'noindex',
    keywords,
    updatedBy: row.updated_by || 'system',
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * GET /api/platform/settings
 * Public endpoint delivering live Platform Control and SEO configuration to users & web clients.
 * Reads directly from Supabase database when configured, with resilient fallbacks.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    let platform: PlatformSettings = MockStorageProvider.getPlatformSettings();
    let seo: SeoSettings = MockStorageProvider.getSeoSettings();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const [platRes, seoRes] = await Promise.all([
          supabase.from('platform_settings').select('*').eq('id', 'default_config').maybeSingle(),
          supabase.from('platform_settings').select('*').eq('id', 'seo_config').maybeSingle(),
        ]);

        if (platRes.data) {
          platform = mapDbRowToPlatform(platRes.data);
          MockStorageProvider.updatePlatformSettings(platform, platRes.data.updated_by || 'supabase');
        }

        if (seoRes.data) {
          seo = mapDbRowToSeo(seoRes.data);
          MockStorageProvider.updateSeoSettings(seo, seoRes.data.updated_by || 'supabase');
        }
      }
    }

    return NextResponse.json({
      success: true,
      platform,
      seo,
      version: platform.version,
    });
  } catch (error: any) {
    console.error('[Platform Settings API] GET Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch platform configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/platform/settings
 * Authenticated admin endpoint to update Platform and/or SEO configuration.
 * Persists directly to Supabase database so changes reflect across the entire deployed site.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const { platform: platformUpdates, seo: seoUpdates } = body as {
      platform?: Partial<PlatformSettings>;
      seo?: Partial<SeoSettings>;
    };

    const actor = authResult.user;
    const now = new Date().toISOString();

    let updatedPlatform: PlatformSettings | undefined;
    let updatedSeo: SeoSettings | undefined;

    const supabase = isSupabaseConfigured() ? getSupabaseAdminClient() : null;

    // 1. Update Platform Settings
    if (platformUpdates) {
      updatedPlatform = MockStorageProvider.updatePlatformSettings(platformUpdates, actor.email);

      if (supabase) {
        const payload = {
          id: 'default_config',
          app_name: updatedPlatform.appName,
          tagline: updatedPlatform.tagline,
          logo_url: updatedPlatform.logoUrl,
          favicon_url: updatedPlatform.faviconUrl,
          brand_accent: updatedPlatform.brandAccent,
          support_email: updatedPlatform.supportEmail,
          contact_email: updatedPlatform.contactEmail,
          default_language: updatedPlatform.defaultLanguage,
          default_timezone: updatedPlatform.defaultTimezone,
          maintenance_mode: updatedPlatform.maintenanceMode,
          maintenance_message: updatedPlatform.maintenanceMessage,
          registration_enabled: updatedPlatform.registrationEnabled,
          guest_access_enabled: updatedPlatform.guestAccessEnabled,
          default_auto_download: updatedPlatform.defaultAutoDownload,
          public_tool_availability: updatedPlatform.publicToolAvailability,
          version: updatedPlatform.version,
          updated_by: actor.email,
          updated_at: now,
        };

        const { error: platErr } = await supabase.from('platform_settings').upsert(payload);
        if (platErr) {
          console.error('[Platform Settings API] Supabase platform upsert error:', platErr);
        }
      }

      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action: 'PLATFORM_SETTINGS_UPDATED',
        targetType: 'SETTING',
        targetId: 'platform_config',
        metadata: platformUpdates,
      });
    }

    // 2. Update SEO Settings
    if (seoUpdates) {
      updatedSeo = MockStorageProvider.updateSeoSettings(seoUpdates, actor.email);

      if (supabase) {
        const payload = {
          id: 'seo_config',
          app_name: updatedSeo.siteTitle,
          tagline: updatedSeo.siteDescription,
          logo_url: updatedSeo.canonicalBase,
          support_email: updatedSeo.ogTitle,
          contact_email: updatedSeo.ogDescription,
          default_language: updatedSeo.robotsIndexable ? 'index' : 'noindex',
          maintenance_message: JSON.stringify(updatedSeo.keywords || []),
          version: 1,
          updated_by: actor.email,
          updated_at: now,
        };

        const { error: seoErr } = await supabase.from('platform_settings').upsert(payload);
        if (seoErr) {
          console.error('[Platform Settings API] Supabase SEO upsert error:', seoErr);
        }
      }

      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action: 'SEO_SETTINGS_UPDATED',
        targetType: 'SETTING',
        targetId: 'seo_config',
        metadata: seoUpdates,
      });
    }

    return NextResponse.json({
      success: true,
      platform: updatedPlatform || MockStorageProvider.getPlatformSettings(),
      seo: updatedSeo || MockStorageProvider.getSeoSettings(),
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('[Platform Settings API] POST Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update platform configuration' },
      { status: 500 }
    );
  }
}
