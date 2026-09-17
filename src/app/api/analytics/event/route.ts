import { NextResponse } from 'next/server';
import { analyticsStore, AnalyticsEventType } from '@/lib/analytics/analytics-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/event
 * Ingests a safe platform event (tool view, tool run, tool export, search, ai query).
 * STRICT PRIVACY: Zero document content or sensitive payload is accepted.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicWrite');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    const { eventType, toolId, toolSlug, userId, metadata } = body;

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json({ error: 'Valid eventType is required.' }, { status: 400 });
    }

    // Auto-resolve authenticated user from session if not explicitly supplied
    let resolvedUserId: string | null = userId ? String(userId).slice(0, 60) : null;
    if (!resolvedUserId) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          resolvedUserId = user.id;
        }
      } catch {
        // Visitor is unauthenticated
      }
    }

    // Sanitize metadata to avoid accepting any large or private data
    const safeMetadata: Record<string, any> = {};
    if (metadata && typeof metadata === 'object') {
      if (metadata.source) safeMetadata.source = String(metadata.source).slice(0, 50);
      if (metadata.durationMs) safeMetadata.durationMs = Number(metadata.durationMs);
      if (metadata.category) safeMetadata.category = String(metadata.category).slice(0, 50);
      if (metadata.queryLength) safeMetadata.queryLength = Number(metadata.queryLength);
    }

    const event = await analyticsStore.logEvent({
      eventType: eventType as AnalyticsEventType,
      toolId: toolId ? String(toolId).slice(0, 60) : undefined,
      toolSlug: toolSlug ? String(toolSlug).slice(0, 60) : undefined,
      userId: resolvedUserId,
      metadata: safeMetadata,
    });

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (error: any) {
    console.error('[Analytics Event Ingest API] Error:', error);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
