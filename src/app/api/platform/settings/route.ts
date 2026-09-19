import { NextResponse } from 'next/server';
import { adminService } from '@/lib/services/adminService';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/platform/settings
 * Public endpoint delivering live Platform Control and SEO configuration to users & web clients.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const [platform, seo] = await Promise.all([
      adminService.getPlatformSettings(),
      adminService.getSeoSettings(),
    ]);

    return NextResponse.json({
      success: true,
      platform,
      seo,
      version: platform.version,
    });
  } catch (error: any) {
    console.error('[Platform Settings API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch platform configuration' },
      { status: 500 }
    );
  }
}
