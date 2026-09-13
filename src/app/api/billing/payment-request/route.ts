import { NextResponse } from 'next/server';
import { PaymentStore } from '@/lib/billing/payment-store';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/payment-request
 * - Admin: List all payment requests with SLA tracking and filters.
 * - User: List user's own payment requests.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'tools');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as any;

    // Check if requester is Admin
    const adminAuth = await getAuthenticatedAdmin(request);
    if (adminAuth.success) {
      const requests = PaymentStore.getAllRequests(statusFilter ? { status: statusFilter } : undefined);
      const metrics = PaymentStore.getMetrics();
      return NextResponse.json({
        success: true,
        requests,
        metrics,
      });
    }

    // Otherwise check for authenticated standard user
    const authUser = await getAuthenticatedNotificationUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userRequests = PaymentStore.getRequestsByUser(authUser.id);
    return NextResponse.json({
      success: true,
      requests: userRequests,
    });
  } catch (err: any) {
    console.error('[PaymentRequest GET] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve payment requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/payment-request
 * Submit a manual UPI payment request with UTR and payer details.
 * Amount, currency, and payee UPI ID are SERVER-AUTHORITATIVE snapshot.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'userMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authUser = await getAuthenticatedNotificationUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in to submit payment.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planDuration, utrNumber, payerUpiId, paymentProofUrl } = body;

    // Validation
    if (!planDuration || (planDuration !== 'MONTHLY' && planDuration !== 'YEARLY')) {
      return NextResponse.json(
        { success: false, error: 'Plan duration must be either MONTHLY or YEARLY.' },
        { status: 400 }
      );
    }

    if (!utrNumber || typeof utrNumber !== 'string' || utrNumber.trim().length < 6 || utrNumber.trim().length > 35) {
      return NextResponse.json(
        { success: false, error: 'Valid UTR / Transaction Reference Number is required (6-35 characters).' },
        { status: 400 }
      );
    }

    // Clean and normalize UTR
    const cleanUtr = utrNumber.trim().toUpperCase();

    // Create payment request in server store (handles duplicate active check, snapshots server config, sets SLA)
    const newRequest = await PaymentStore.createPaymentRequest({
      userId: authUser.id,
      userEmail: authUser.email,
      planDuration,
      utrNumber: cleanUtr,
      payerUpiId: payerUpiId ? payerUpiId.trim() : undefined,
      paymentProofUrl: paymentProofUrl ? paymentProofUrl.trim() : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        request: newRequest,
        message: 'Payment submitted successfully. Your request is in review with our 2-hour SLA guarantee.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[PaymentRequest POST] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to submit payment request' },
      { status: 400 }
    );
  }
}
