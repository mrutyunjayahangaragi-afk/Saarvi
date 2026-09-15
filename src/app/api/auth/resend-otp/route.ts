import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { transactionalEmailProvider } from '@/lib/notifications/providers/email-provider';
import { authEmailLogger } from '@/lib/observability/auth-email-logger';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory cooldown tracking: email -> timestamp of last send
const RESEND_COOLDOWN_MAP = new Map<string, number>();
const COOLDOWN_SECONDS = 60;

/**
 * POST /api/auth/resend-otp
 * Dispatches a refreshed 6-digit verification OTP to the user's email inbox via Gmail SMTP.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authAction');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Enforce 60-second cooldown per email
    const now = Date.now();
    const lastSent = RESEND_COOLDOWN_MAP.get(cleanEmail);
    if (lastSent && now - lastSent < COOLDOWN_SECONDS * 1000) {
      const remaining = Math.ceil((COOLDOWN_SECONDS * 1000 - (now - lastSent)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${remaining} seconds before requesting another code.` },
        { status: 429 }
      );
    }

    // Mock mode
    if (!isSupabaseConfigured()) {
      RESEND_COOLDOWN_MAP.set(cleanEmail, now);
      await transactionalEmailProvider.sendAuthVerificationEmail({
        to: cleanEmail,
        otpCode: '123456',
        expiryMinutes: 10,
      });

      await authEmailLogger.logEvent({
        email: cleanEmail,
        eventType: 'RESEND_OTP_SENT',
        provider: 'Mock Email Provider',
        status: 'SUCCESS',
      });

      return NextResponse.json({
        success: true,
        message: 'A new 6-digit verification code has been dispatched to your inbox.',
      });
    }

    // Supabase mode
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentication service temporarily unavailable.' },
        { status: 503 }
      );
    }

    // Generate link/otp for unconfirmed or existing user via magiclink
    let { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
    });

    if (error || !data?.properties?.email_otp) {
      await authEmailLogger.logEvent({
        email: cleanEmail,
        eventType: 'OTP_DELIVERY_FAILED',
        status: 'FAILURE',
        errorCategory: 'RESEND_TOKEN_FAILED',
        errorMessage: error?.message || 'Could not generate OTP token for resend',
      });

      return NextResponse.json(
        { error: 'Unable to resend verification code. Please check your email address and try again.' },
        { status: 400 }
      );
    }

    const otpCode = data.properties.email_otp;
    const fullName = data.user?.user_metadata?.full_name;

    const delivery = await transactionalEmailProvider.sendAuthVerificationEmail({
      to: cleanEmail,
      fullName,
      otpCode,
      expiryMinutes: 10,
    });

    if (!delivery.success) {
      await authEmailLogger.logEvent({
        userId: data.user?.id,
        email: cleanEmail,
        eventType: 'OTP_DELIVERY_FAILED',
        provider: 'Gmail SMTP',
        status: 'FAILURE',
        errorCategory: delivery.status || 'SMTP_FAILED',
        errorMessage: delivery.error || 'SMTP delivery rejected',
      });

      return NextResponse.json(
        { error: 'Failed to deliver email. Please check your connection and try again.' },
        { status: 500 }
      );
    }

    // Update cooldown timestamp
    RESEND_COOLDOWN_MAP.set(cleanEmail, now);

    await authEmailLogger.logEvent({
      userId: data.user?.id,
      email: cleanEmail,
      eventType: 'RESEND_OTP_SENT',
      provider: 'Gmail SMTP',
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      message: 'A new 6-digit verification code has been dispatched to your inbox.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'An unexpected error occurred while resending verification code.' },
      { status: 500 }
    );
  }
}
