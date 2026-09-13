import { NextResponse } from 'next/server';
import { PaymentStore } from '@/lib/billing/payment-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/payment-config
 * Public endpoint to fetch active payment config (payee UPI, amounts, QR URL, SLA).
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'tools');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const config = PaymentStore.getPublicConfig();
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (err: any) {
    console.error('[PaymentConfig GET] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load payment configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/billing/payment-config
 * Super Admin endpoint to update payment configuration (amounts, UPI ID, SLA hours, instructions).
 */
export async function PUT(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    // Must be SUPER_ADMIN or ADMIN
    if (authResult.user.role !== 'SUPER_ADMIN' && authResult.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      upiId,
      payeeName,
      amountMonthly,
      amountYearly,
      currency,
      qrCodeUrl,
      reviewSlaHours,
      instructions,
      supportEmail,
      status,
    } = body;

    // Validate inputs
    if (amountMonthly !== undefined && (typeof amountMonthly !== 'number' || amountMonthly <= 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid monthly amount: must be positive number' },
        { status: 400 }
      );
    }
    if (amountYearly !== undefined && (typeof amountYearly !== 'number' || amountYearly <= 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid yearly amount: must be positive number' },
        { status: 400 }
      );
    }
    if (reviewSlaHours !== undefined && (typeof reviewSlaHours !== 'number' || reviewSlaHours <= 0)) {
      return NextResponse.json(
        { success: false, error: 'Review SLA hours must be a positive number' },
        { status: 400 }
      );
    }

    const updated = PaymentStore.updateConfig(
      {
        ...(upiId && { upiId: upiId.trim() }),
        ...(payeeName && { payeeName: payeeName.trim() }),
        ...(amountMonthly !== undefined && { amountMonthly }),
        ...(amountYearly !== undefined && { amountYearly }),
        ...(currency && { currency }),
        ...(qrCodeUrl !== undefined && { qrCodeUrl }),
        ...(reviewSlaHours !== undefined && { reviewSlaHours }),
        ...(instructions && { instructions: instructions.trim() }),
        ...(supportEmail && { supportEmail: supportEmail.trim() }),
        ...(status && { status }),
      },
      {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      config: updated,
      message: 'Payment configuration updated successfully',
    });
  } catch (err: any) {
    console.error('[PaymentConfig PUT] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update payment configuration' },
      { status: 500 }
    );
  }
}
