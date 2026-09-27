import { NextResponse } from 'next/server';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['BUG', 'FEATURE', 'PERFORMANCE', 'UX', 'OTHER'] as const;

function sanitizeInput(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
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
      toolSlug,
      pageUrl,
      email: rawEmail,
      viewport,
    } = body;

    // Validation
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid rating between 1 and 5.' },
        { status: 400 }
      );
    }

    const upperCategory = (category || '').toUpperCase().trim();
    if (!VALID_CATEGORIES.includes(upperCategory as any)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Feedback message is required.' },
        { status: 400 }
      );
    }

    const cleanMessage = sanitizeInput(message);
    if (cleanMessage.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Feedback message must be at least 10 characters.' },
        { status: 400 }
      );
    }
    if (cleanMessage.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Feedback message must not exceed 2000 characters.' },
        { status: 400 }
      );
    }

    // Resolve user from server session (never trust client userId)
    let authenticatedUserId: string | null = null;
    let authenticatedEmail: string | null = null;

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          authenticatedUserId = user.id;
          authenticatedEmail = user.email || null;
        }
      } catch {}
    } else {
      const session = MockStorageProvider.getCurrentSession();
      if (session) {
        authenticatedUserId = session.id;
        authenticatedEmail = session.email;
      }
    }

    const effectiveEmail = authenticatedEmail || (typeof rawEmail === 'string' ? sanitizeInput(rawEmail) : undefined);
    const userAgent = request.headers.get('user-agent') || undefined;

    const feedbackData = {
      userId: authenticatedUserId || undefined,
      rating: Math.round(numRating),
      category: upperCategory as 'BUG' | 'FEATURE' | 'PERFORMANCE' | 'UX' | 'OTHER',
      toolSlug: toolSlug ? sanitizeInput(String(toolSlug)).slice(0, 100) : undefined,
      pageUrl: pageUrl ? sanitizeInput(String(pageUrl)).slice(0, 500) : undefined,
      message: cleanMessage,
      email: effectiveEmail,
      userAgent: userAgent ? userAgent.slice(0, 300) : undefined,
      viewport: viewport ? sanitizeInput(String(viewport)).slice(0, 50) : undefined,
    };

    if (isSupabaseConfigured()) {
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        const { error: dbError } = await adminClient.from('feedback').insert({
          user_id: feedbackData.userId || null,
          rating: feedbackData.rating,
          category: feedbackData.category,
          tool_slug: feedbackData.toolSlug || null,
          page_url: feedbackData.pageUrl || null,
          message: feedbackData.message,
          email: feedbackData.email || null,
          user_agent: feedbackData.userAgent || null,
          viewport: feedbackData.viewport || null,
          status: 'NEW',
        });

        if (dbError) {
          console.warn('[Feedback API] DB insert error, falling back to mock:', dbError);
          MockStorageProvider.addFeedback(feedbackData);
        }
      } else {
        MockStorageProvider.addFeedback(feedbackData);
      }
    } else {
      MockStorageProvider.addFeedback(feedbackData);
    }

    // Telemetry event (non-blocking)
    MockStorageProvider.recordPlatformEvent({
      eventName: 'feedback_submitted',
      userId: authenticatedUserId || undefined,
      toolKey: feedbackData.toolSlug,
      category: feedbackData.category,
      success: true,
      metadata: { rating: feedbackData.rating },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your feedback has been received and helps us make Saarvi better.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit feedback';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
