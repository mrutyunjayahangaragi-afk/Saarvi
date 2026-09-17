import { NextResponse } from 'next/server';
import { UserOnboardingService } from '@/lib/services/user-onboarding-service';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/welcome
 * Handles database-backed idempotent welcome workflow and Admin resend actions.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, userId, targetUserId, email, fullName } = body;

    // 1. Admin Manual Resend Action
    if (action === 'resend') {
      const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
      if (!authResult.success) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status });
      }

      const effectiveTargetId = targetUserId || userId;
      if (!effectiveTargetId) {
        return NextResponse.json({ error: 'Target user ID is required for resend.' }, { status: 400 });
      }

      const resendResult = await UserOnboardingService.resendWelcomeEmail(effectiveTargetId, {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      });

      return NextResponse.json(resendResult);
    }

    // 2. Standard New User Welcome Delivery
    const rateLimit = enforceRateLimit(request, 'authAction');
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await UserOnboardingService.initializeNewSaarviUser({
      id: userId || `usr_${Date.now()}`,
      email: cleanEmail,
      fullName,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal welcome dispatch error.';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

