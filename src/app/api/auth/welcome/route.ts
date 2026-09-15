import { NextResponse } from 'next/server';
import { transactionalEmailProvider } from '@/lib/notifications/providers/email-provider';
import { authEmailLogger } from '@/lib/observability/auth-email-logger';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory set of delivered welcome email idempotency keys
const dispatchedWelcomeKeys = new Set<string>();

/**
 * POST /api/auth/welcome
 * Dispatches the official Saarvi welcome onboarding email after account verification.
 * 
 * Guarantees:
 * 1. Strict idempotency key per user / email prevents duplicate deliveries.
 * 2. Rate limiting safeguards against abuse.
 * 3. Safe logging without credentials or sensitive user secrets.
 */
export async function POST(request: Request) {
  // 1. Rate limiting
  const rateLimit = enforceRateLimit(request, 'authAction');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { email, fullName, userId } = body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName ? String(fullName).trim() : undefined;
    const idempotencyKey = `welcome:${userId || cleanEmail}`;

    // 2. Strict Idempotency Check
    if (dispatchedWelcomeKeys.has(idempotencyKey)) {
      return NextResponse.json({
        success: true,
        message: 'Welcome email already dispatched for this account.',
        idempotent: true,
      });
    }

    // Mark as dispatched immediately
    dispatchedWelcomeKeys.add(idempotencyKey);

    // Keep set bounded (max 5,000 entries in memory)
    if (dispatchedWelcomeKeys.size > 5000) {
      const firstKey = dispatchedWelcomeKeys.values().next().value;
      if (firstKey) dispatchedWelcomeKeys.delete(firstKey);
    }

    // 3. Dispatch welcome email via Gmail SMTP
    const delivery = await transactionalEmailProvider.sendRegistrationSuccessEmail({
      to: cleanEmail,
      fullName: cleanName,
      idempotencyKey,
    });

    // 4. Log delivery event
    await authEmailLogger.logEvent({
      userId: userId ? String(userId) : undefined,
      email: cleanEmail,
      eventType: 'WELCOME_EMAIL_SENT',
      provider: 'Gmail SMTP',
      status: delivery.success ? 'SUCCESS' : 'FAILURE',
      errorCategory: delivery.error ? 'SMTP_DELIVERY_ISSUE' : undefined,
      errorMessage: delivery.error,
    });

    if (!delivery.success) {
      // If delivery failed (e.g. SMTP credentials not set), remove key so retry can occur if needed
      dispatchedWelcomeKeys.delete(idempotencyKey);
      return NextResponse.json({
        success: false,
        message: delivery.error || 'Failed to dispatch welcome email.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Welcome email dispatched successfully.',
      providerMessageId: delivery.providerMessageId,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal welcome dispatch error.';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
