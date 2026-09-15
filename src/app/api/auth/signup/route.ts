import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { transactionalEmailProvider } from '@/lib/notifications/providers/email-provider';
import { authEmailLogger } from '@/lib/observability/auth-email-logger';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/signup
 * Server-authoritative account creation & branded verification email dispatch.
 * 
 * Flow:
 * 1. Validates full name, email format, and password length.
 * 2. Enforces IP and email rate limiting.
 * 3. Uses official Supabase admin.generateLink({ type: 'signup' }) to register user & generate official OTP.
 * 4. Dispatches professional branded Saarvi verification email via Gmail SMTP (Port 465 SSL).
 * 5. Logs deliverability telemetry safely (zero raw passwords or OTPs stored).
 */
export async function POST(request: Request) {
  // 1. Rate limiting
  const rateLimit = enforceRateLimit(request, 'authAction');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    // 2. Validate input parameters
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json(
        { error: 'Please enter your full name.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    // 3. Development / Mock Mode
    if (!isSupabaseConfigured()) {
      const mockResult = MockStorageProvider.signUp({
        email: cleanEmail,
        password,
        fullName: cleanName,
      });

      // Send mock email in test/dev
      const mockOtp = '123456';
      await transactionalEmailProvider.sendAuthVerificationEmail({
        to: cleanEmail,
        fullName: cleanName,
        otpCode: mockOtp,
        expiryMinutes: 10,
      });

      await authEmailLogger.logEvent({
        userId: mockResult.user.id,
        email: cleanEmail,
        eventType: 'SIGNUP_OTP_SENT',
        provider: 'Mock Email Provider',
        status: 'SUCCESS',
      });

      return NextResponse.json({
        success: true,
        email: cleanEmail,
        requiresVerification: true,
        message: 'Verification code dispatched to your email.',
      });
    }

    // 4. Production Supabase Mode
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentication service temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Request official Supabase signup & token generation
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
        },
      },
    });

    if (error) {
      const msg = error.message || '';
      if (
        msg.toLowerCase().includes('already been registered') ||
        msg.toLowerCase().includes('already exists')
      ) {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please sign in instead.' },
          { status: 409 }
        );
      }

      await authEmailLogger.logEvent({
        email: cleanEmail,
        eventType: 'OTP_DELIVERY_FAILED',
        status: 'FAILURE',
        errorCategory: 'SUPABASE_SIGNUP_ERROR',
        errorMessage: msg,
      });

      return NextResponse.json(
        { error: msg || "We couldn't create your account. Please try again." },
        { status: 400 }
      );
    }

    const otpCode = data.properties?.email_otp;
    const userId = data.user?.id;

    if (!otpCode) {
      await authEmailLogger.logEvent({
        userId,
        email: cleanEmail,
        eventType: 'OTP_DELIVERY_FAILED',
        status: 'FAILURE',
        errorCategory: 'MISSING_OTP_TOKEN',
        errorMessage: 'Supabase did not return an OTP code for signup.',
      });

      return NextResponse.json(
        { error: 'Unable to generate verification token. Please try again.' },
        { status: 500 }
      );
    }

    // 5. Dispatch branded verification email via Gmail SMTP
    const delivery = await transactionalEmailProvider.sendAuthVerificationEmail({
      to: cleanEmail,
      fullName: cleanName,
      otpCode,
      expiryMinutes: 10,
    });

    if (!delivery.success) {
      await authEmailLogger.logEvent({
        userId,
        email: cleanEmail,
        eventType: 'OTP_DELIVERY_FAILED',
        provider: 'Gmail SMTP',
        status: 'FAILURE',
        errorCategory: delivery.status || 'SMTP_FAILED',
        errorMessage: delivery.error || 'SMTP delivery rejected',
      });

      return NextResponse.json(
        {
          error:
            'We created your registration, but could not deliver the verification email. Please check your address or request a new code.',
        },
        { status: 500 }
      );
    }

    // 6. Record safe telemetry log
    await authEmailLogger.logEvent({
      userId,
      email: cleanEmail,
      eventType: 'SIGNUP_OTP_SENT',
      provider: 'Gmail SMTP',
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      requiresVerification: true,
      message: 'Verification code successfully sent to your email.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected signup error';
    return NextResponse.json(
      { error: 'An unexpected server error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
