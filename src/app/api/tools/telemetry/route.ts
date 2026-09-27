import { NextRequest, NextResponse } from 'next/server';
import { toolAccessService } from '@/lib/tools/tool-access-service';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const GUEST_COOKIE_NAME = 'saarvi_guest_session_id';

export async function POST(request: NextRequest) {
  // Public rate limit
  const rateLimit = enforceRateLimit(request, 'public');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const body = await request.json().catch(() => ({}));
    const {
      eventName = 'tool_completed',
      toolKey,
      operationId,
      durationMs = 0,
      success = true,
      category,
      metadata = {},
    } = body;

    if (!toolKey || typeof toolKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid parameter: toolKey' },
        { status: 400 }
      );
    }

    if (!operationId || typeof operationId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: operationId' },
        { status: 400 }
      );
    }

    // 1. Resolve Identity Server-Side (Never trust client-provided user IDs or isPro flags)
    let effectiveUserId: string | null = null;
    let userType: 'authenticated' | 'guest' = 'guest';

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          effectiveUserId = user.id;
          userType = 'authenticated';
        }
      } catch {}
    } else {
      const session = MockStorageProvider.getCurrentSession();
      if (session?.id) {
        effectiveUserId = session.id;
        userType = 'authenticated';
      }
    }

    // 2. Resolve Guest Session ID if not authenticated
    let guestSessionId: string | null = null;
    let shouldSetCookie = false;

    if (userType === 'guest') {
      const cookieVal = request.cookies.get(GUEST_COOKIE_NAME)?.value;
      const headerVal = request.headers.get('x-guest-session-id');
      const bodyVal = typeof body.guestSessionId === 'string' ? body.guestSessionId : null;

      if (cookieVal && cookieVal.length > 5) {
        guestSessionId = cookieVal;
      } else if (headerVal && headerVal.length > 5) {
        guestSessionId = headerVal;
      } else if (bodyVal && bodyVal.length > 5) {
        guestSessionId = bodyVal;
      } else {
        const randomId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `gst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        guestSessionId = randomId;
        shouldSetCookie = true;
      }
    }

    // Sanitize metadata: NEVER store document contents, file data, or passwords
    const safeMetadata: Record<string, unknown> = {};
    if (metadata && typeof metadata === 'object') {
      for (const [k, v] of Object.entries(metadata)) {
        const lowerK = k.toLowerCase();
        if (
          lowerK.includes('content') ||
          lowerK.includes('document') ||
          lowerK.includes('password') ||
          lowerK.includes('secret') ||
          lowerK.includes('token') ||
          lowerK.includes('resume') ||
          lowerK.includes('mark')
        ) {
          continue; // strictly exclude private data
        }
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          safeMetadata[k] = v;
        }
      }
    }

    const result = await toolAccessService.recordToolEvent({
      eventName,
      toolKey: toolKey.trim(),
      operationId: operationId.trim(),
      success: Boolean(success),
      durationMs: Number(durationMs) || 0,
      userType,
      userId: effectiveUserId,
      guestSessionId,
      category,
      metadata: safeMetadata,
    });

    const response = NextResponse.json({
      ...result,
      userType,
      guestSessionId,
    });

    if (shouldSetCookie && guestSessionId) {
      response.cookies.set(GUEST_COOKIE_NAME, guestSessionId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year anonymous persistence
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record tool event';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
