import { NextResponse } from 'next/server';
import { adStore } from '@/lib/advertising/ad-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import {
  enforceRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
  getRateLimitTelemetry,
} from '@/lib/security/rate-limit';
import { AdDisplayMode, AdFrequencyMode, AdvertisementStatus } from '@/types/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/advertising
 * Returns all advertisements, display settings, real analytics, recent logs,
 * system diagnostics, and rate limit telemetry.
 * Rate limited under 'adminReads' (120 req/min).
 */
export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'VIEW');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, 'adminReads', authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const adId = searchParams.get('adId') || undefined;

    const ads = adStore.getAllAds();
    const settings = adStore.getDisplaySettings();
    const summary = adStore.getAnalyticsSummary(adId);
    const recentEvents = adStore.getRecentEvents(50, adId);
    const diagnostics = adStore.getDiagnostics();
    const rateLimitTelemetry = getRateLimitTelemetry();

    const response = NextResponse.json({
      success: true,
      ads,
      settings,
      summary,
      recentEvents,
      diagnostics,
      rateLimitTelemetry,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error('[Admin Advertising GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal error loading advertising management data.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/advertising
 * Creates a new advertisement in DRAFT or ACTIVE state.
 * Rate limited under 'adminMutations' (30 req/min).
 */
export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, 'adminMutations', authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const {
      name,
      description,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      headline,
      bodyText,
      ctaText,
      ctaUrl,
      advertiserName,
      status,
      priority,
      audience,
      startAt,
      endAt,
      timezone,
      durationSeconds,
      skipEnabled,
      skipAfterSeconds,
      displayMode,
      frequencyMode,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Advertisement Name is required.' },
        { status: 400 }
      );
    }

    if (!mediaType || (mediaType !== 'IMAGE' && mediaType !== 'VIDEO')) {
      return NextResponse.json(
        { error: 'Valid mediaType ("IMAGE" | "VIDEO") is required.' },
        { status: 400 }
      );
    }

    if (!mediaUrl || typeof mediaUrl !== 'string' || !mediaUrl.trim()) {
      return NextResponse.json(
        { error: 'Media URL or uploaded media is required.' },
        { status: 400 }
      );
    }

    const newAd = await adStore.createAd(
      {
        name,
        description,
        mediaType,
        mediaUrl,
        thumbnailUrl,
        headline,
        bodyText,
        ctaText,
        ctaUrl,
        advertiserName,
        status: status as AdvertisementStatus,
        priority: Number(priority) || 0,
        audience,
        startAt,
        endAt,
        timezone,
        durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
        skipEnabled: skipEnabled !== undefined ? Boolean(skipEnabled) : undefined,
        skipAfterSeconds: skipAfterSeconds !== undefined ? Number(skipAfterSeconds) : undefined,
        displayMode: displayMode as AdDisplayMode,
        frequencyMode: frequencyMode as AdFrequencyMode,
      },
      authResult.user.email
    );

    const response = NextResponse.json({ success: true, ad: newAd }, { status: 201 });
    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error('[Admin Advertising POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create advertisement.' },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/admin/advertising
 * Updates an advertisement or platform-wide display settings.
 * Rate limited under 'adminMutations' (30 req/min).
 */
export async function PATCH(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, 'adminMutations', authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { action, id, settings: newSettings, ...updates } = body;

    // 1. Update Global Display Settings
    if (action === 'UPDATE_SETTINGS' || newSettings) {
      const updatedSettings = await adStore.updateDisplaySettings(
        newSettings || updates,
        authResult.user.email
      );
      const response = NextResponse.json({ success: true, settings: updatedSettings });
      return withRateLimitHeaders(response, rateLimit);
    }

    // 2. Update Specific Advertisement
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid advertisement "id".' },
        { status: 400 }
      );
    }

    const updatedAd = await adStore.updateAd(id, updates, authResult.user.email);
    const response = NextResponse.json({ success: true, ad: updatedAd });
    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error('[Admin Advertising PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update advertisement.' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/advertising
 * Permanently removes an advertisement.
 * Rate limited under 'adminMutations' (30 req/min).
 */
export async function DELETE(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, 'adminMutations', authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing advertisement "id".' }, { status: 400 });
    }

    const deleted = await adStore.deleteAd(id, authResult.user.email);
    if (!deleted) {
      return NextResponse.json({ error: 'Advertisement not found.' }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, id });
    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error('[Admin Advertising DELETE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete advertisement.' },
      { status: 500 }
    );
  }
}
