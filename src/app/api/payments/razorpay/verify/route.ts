/**
 * POST /api/payments/razorpay/verify
 *
 * Cryptographic Razorpay Signature Verification & Entitlement Activation (PART 7.7 & 7.8)
 * - Verifies HMAC-SHA256 signature using timingSafeEqual
 * - Reads authoritative server-side order record
 * - Provisions server-authoritative Pro entitlement idempotently
 * - Prevents client-side spoofing of isPro
 */

import { NextResponse } from 'next/server';
import { razorpayPaymentService } from '@/lib/billing/razorpay-service';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { checkRateLimit } from '@/lib/billing/rateLimit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    const rateCheck = checkRateLimit(`rzp_verify:${ip}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many verification attempts. Please wait a moment.',
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const orderId = body.orderId || body.razorpay_order_id;
    const paymentId = body.paymentId || body.razorpay_payment_id;
    const signature = body.signature || body.razorpay_signature;
    const userId = body.userId;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Missing orderId, paymentId, or signature required for verification.',
          },
        },
        { status: 400 }
      );
    }

    const authUser = await getAuthenticatedNotificationUser(request, body);
    const effectiveUserId = authUser?.id || userId;

    const result = await razorpayPaymentService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
      userId: effectiveUserId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SIGNATURE_VERIFICATION_FAILED',
            message: result.error || 'Payment signature verification failed.',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully. Pro entitlement activated.',
      data: {
        isPro: true,
        orderId,
        paymentId,
        order: result.order,
      },
    });
  } catch (err) {
    console.error('[Razorpay Verify Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: err instanceof Error ? err.message : 'Internal error during payment verification',
        },
      },
      { status: 500 }
    );
  }
}
