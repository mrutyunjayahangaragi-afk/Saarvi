import { NextResponse } from 'next/server';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

const CANONICAL_CATEGORIES = [
  'General',
  'Bug',
  'Tool Issue',
  'Feature Request',
  'Performance',
  'Privacy',
  'Payment',
  'Other',
] as const;

type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

function normalizeCategory(raw?: string): CanonicalCategory | null {
  if (!raw) return 'General';
  const trimmed = raw.trim();
  const direct = CANONICAL_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;
  const upper = trimmed.toUpperCase();
  if (upper === 'FEATURE') return 'Feature Request';
  if (upper === 'UX') return 'General';
  if (upper === 'BUG') return 'Bug';
  if (upper === 'PERFORMANCE') return 'Performance';
  if (upper === 'OTHER') return 'Other';
  return null;
}

function sanitizeInput(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function deriveSentiment(rating: number): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' {
  if (rating >= 4) return 'POSITIVE';
  if (rating === 3) return 'NEUTRAL';
  return 'NEGATIVE';
}

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'feedback');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      rating,
      category,
      message,
      toolKey,
      toolSlug,
      pageUrl,
      page,
      email: rawEmail,
      viewport,
      idempotencyKey,
      operationId,
      guestSessionId,
    } = body;

    // 1. Validate Rating (1-5 integer)
    const numRating = Number(rating);
    if (!numRating || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid rating between 1 and 5 stars.' },
        { status: 400 }
      );
    }

    // 2. Validate Category
    const validatedCategory = normalizeCategory(category);
    if (!validatedCategory) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category. Allowed categories are: ${CANONICAL_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 3. Validate & Sanitize Message
    const rawMessageStr = typeof message === 'string' ? message : '';
    const cleanMessage = sanitizeInput(rawMessageStr || `User submitted a ${numRating}-star rating.`);

    if (cleanMessage.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Feedback message must be at least 3 characters.' },
        { status: 400 }
      );
    }
    if (cleanMessage.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Feedback message must not exceed 2000 characters.' },
        { status: 400 }
      );
    }

    // 4. Resolve User Identity Server-Side (Never trust client user_id)
    let authenticatedUserId: string | null = null;
    let authenticatedEmail: string | null = null;
    let userType: 'GUEST' | 'FREE' | 'PRO' = 'GUEST';

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          authenticatedUserId = user.id;
          authenticatedEmail = user.email || null;
          userType = (user.user_metadata?.plan === 'PRO') ? 'PRO' : 'FREE';
        }
      } catch {}
    } else {
      const session = MockStorageProvider.getCurrentSession();
      if (session) {
        authenticatedUserId = session.id;
        authenticatedEmail = session.email;
        const storedUser = MockStorageProvider.getUserById(session.id);
        userType = storedUser?.plan === 'PRO' ? 'PRO' : 'FREE';
      }
    }

    // Resolve Guest Session ID
    const effectiveGuestSessionId =
      !authenticatedUserId
        ? (
            request.headers.get('x-guest-session-id') ||
            (typeof guestSessionId === 'string' ? sanitizeInput(guestSessionId).slice(0, 100) : null)
          )
        : null;

    // Resolve Tool Key
    const rawToolKey = toolKey || toolSlug;
    const sanitizedToolKey = rawToolKey
      ? sanitizeInput(String(rawToolKey)).toLowerCase().slice(0, 100)
      : undefined;

    // Resolve Page
    const rawPage = page || pageUrl;
    const sanitizedPage = rawPage ? sanitizeInput(String(rawPage)).slice(0, 300) : undefined;

    // Idempotency Key
    const rawIdemKey = idempotencyKey || operationId;
    const effectiveIdemKey = rawIdemKey ? sanitizeInput(String(rawIdemKey)).slice(0, 120) : null;

    // Non-destructive automated sentiment classification
    const sentiment = deriveSentiment(numRating);

    const feedbackPayload = {
      userId: authenticatedUserId,
      userType,
      guestSessionId: effectiveGuestSessionId,
      userEmail: authenticatedEmail || (typeof rawEmail === 'string' ? sanitizeInput(rawEmail) : undefined),
      rating: numRating,
      category: validatedCategory,
      toolKey: sanitizedToolKey,
      pageUrl: sanitizedPage,
      message: cleanMessage,
      sentiment,
      status: 'NEW' as const,
      idempotencyKey: effectiveIdemKey,
    };

    let createdRecordId: string | null = null;

    // Persist to Supabase Database
    if (isSupabaseConfigured()) {
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        // Idempotency check in DB
        if (effectiveIdemKey) {
          const { data: existing } = await adminClient
            .from('feedback')
            .select('id')
            .eq('idempotency_key', effectiveIdemKey)
            .maybeSingle();

          if (existing) {
            return NextResponse.json({
              success: true,
              feedbackId: existing.id,
              message: 'Feedback already recorded.',
            });
          }
        }

        const { data: inserted, error: dbError } = await adminClient
          .from('feedback')
          .insert({
            user_id: feedbackPayload.userId,
            guest_session_id: feedbackPayload.guestSessionId,
            user_type: feedbackPayload.userType,
            rating: feedbackPayload.rating,
            category: feedbackPayload.category,
            tool_key: feedbackPayload.toolKey || null,
            tool_slug: feedbackPayload.toolKey || null,
            page_url: feedbackPayload.pageUrl || null,
            message: feedbackPayload.message,
            email: feedbackPayload.userEmail || null,
            sentiment: feedbackPayload.sentiment,
            status: 'NEW',
            idempotency_key: feedbackPayload.idempotencyKey,
          })
          .select('id')
          .maybeSingle();

        if (dbError) {
          console.warn('[Feedback API] DB insert error, falling back to mock storage:', dbError.message);
          const savedMock = MockStorageProvider.addFeedback(feedbackPayload);
          createdRecordId = savedMock.id;
        } else if (inserted) {
          createdRecordId = inserted.id;
        }
      } else {
        const savedMock = MockStorageProvider.addFeedback(feedbackPayload);
        createdRecordId = savedMock.id;
      }
    } else {
      const savedMock = MockStorageProvider.addFeedback(feedbackPayload);
      createdRecordId = savedMock.id;
    }

    // Telemetry event (non-blocking)
    MockStorageProvider.recordPlatformEvent({
      eventName: 'feedback_submitted',
      userId: authenticatedUserId || undefined,
      toolKey: feedbackPayload.toolKey,
      category: feedbackPayload.category,
      success: true,
      metadata: { rating: feedbackPayload.rating, userType: feedbackPayload.userType },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      feedbackId: createdRecordId,
      message: 'Thank you! Your feedback has been received and helps us make Saarvi better.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit feedback';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
