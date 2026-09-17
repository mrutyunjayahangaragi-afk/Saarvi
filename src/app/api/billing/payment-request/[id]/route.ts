import { NextResponse } from 'next/server';
import { PaymentStore } from '@/lib/billing/payment-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/payment-request/[id]
 * Fetch single payment request status and SLA tracking.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const rateLimit = enforceRateLimit(request, 'tools');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const { id } = await Promise.resolve(context.params);
    const paymentRequest = PaymentStore.getRequestById(id);

    if (!paymentRequest) {
      return NextResponse.json(
        { success: false, error: 'Payment request not found' },
        { status: 404 }
      );
    }

    // Access check: must be Admin or the owner user
    const adminAuth = await getAuthenticatedAdmin(request);
    if (!adminAuth.success) {
      const user = await getAuthenticatedNotificationUser(request);
      if (!user || user.id !== paymentRequest.userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized access to this payment record' },
          { status: 403 }
        );
      }
    }

    const sla = PaymentStore.calculateSlaStatus(paymentRequest);

    return NextResponse.json({
      success: true,
      request: paymentRequest,
      sla,
    });
  } catch (err: any) {
    console.error('[PaymentRequest [id] GET] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve payment request' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/billing/payment-request/[id]
 * Super Admin review action (APPROVE or REJECT).
 * On APPROVE: Concurrency mutex protected, activates Pro subscription, creates invoice.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authResult = await getAuthenticatedAdmin(request, 'SUPER_ADMIN');
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: SuperAdmin privileges are strictly required to approve or reject payments.' },
        { status: 403 }
      );
    }

    const { id } = await Promise.resolve(context.params);
    const body = await request.json();
    const { action, reviewNotes } = body;

    if (!action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return NextResponse.json(
        { success: false, error: 'Action must be either APPROVE or REJECT' },
        { status: 400 }
      );
    }

    const adminActor = {
      id: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role,
    };

    if (action === 'APPROVE') {
      const approved = await PaymentStore.approveRequest(id, adminActor, reviewNotes);
      return NextResponse.json({
        success: true,
        request: approved,
        message: 'Payment approved successfully. Saarvi Pro subscription is now active.',
      });
    } else {
      if (!reviewNotes || reviewNotes.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Review notes / rejection reason is required when rejecting a payment.' },
          { status: 400 }
        );
      }

      const rejected = await PaymentStore.rejectRequest(id, adminActor, reviewNotes.trim());
      return NextResponse.json({
        success: true,
        request: rejected,
        message: 'Payment request rejected.',
      });
    }
  } catch (err: any) {
    console.error('[PaymentRequest [id] PUT] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process payment request' },
      { status: 400 }
    );
  }
}
