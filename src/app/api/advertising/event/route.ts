import { NextResponse } from 'next/server';
import { adStore } from '@/lib/advertising/ad-store';
import { AdAnalyticsEventType } from '@/types/admin';

export const dynamic = 'force-dynamic';

const VALID_EVENT_TYPES: AdAnalyticsEventType[] = [
  'AD_IMPRESSION',
  'AD_STARTED',
  'AD_SKIPPED',
  'AD_COMPLETED',
  'AD_CTA_CLICKED',
  'AD_MEDIA_ERROR',
];

/**
 * POST /api/advertising/event
 * Records real visitor interaction events for active advertisements.
 * No fake data: every event is captured accurately with timestamps.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adId, eventType, metadata } = body;

    if (!adId || typeof adId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "adId"' }, { status: 400 });
    }

    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Allowed: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const userId = request.headers.get('x-user-id') || undefined;

    const event = await adStore.recordEvent(
      adId,
      eventType as AdAnalyticsEventType,
      userId,
      metadata
    );

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (error: any) {
    console.error('[Ad Event API] Error recording ad event:', error);
    return NextResponse.json({ error: 'Failed to record ad event' }, { status: 500 });
  }
}
