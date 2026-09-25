/**
 * POST /api/payments/razorpay/webhook
 *
 * Server-Authoritative Razorpay Webhook Endpoint (PART 7.9, 7.10, 7.11)
 * - Raw request body parsing for HMAC verification
 * - Timing-safe HMAC-SHA256 signature verification
 * - Webhook event deduplication / replay protection
 * - Converges idempotently with client checkout callback
 * - Never grants Pro twice
 */

import { NextResponse } from 'next/server';
import { razorpayPaymentService } from '@/lib/billing/razorpay-service';

export async function POST(request: Request) {
  try {
    // 1. Raw body extraction (Strict requirement: do NOT json parse before signature verification)
    const rawBody = await request.text();

    // 2. Extract provider signature and headers
    const headers: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const result = await razorpayPaymentService.handleWebhook(rawBody, headers);

    if (!result.success) {
      console.warn('[Razorpay Webhook Rejected]:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: result.error || 'Cryptographic signature verification failed',
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      received: true,
      eventId: result.eventId,
      duplicate: result.duplicate || false,
    });
  } catch (err) {
    console.error('[Razorpay Webhook Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'WEBHOOK_PROCESSING_ERROR',
          message: err instanceof Error ? err.message : 'Internal webhook processing error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/razorpay/webhook
 * Health check & verification response for browser visits and uptime monitors.
 * Prevents HTTP 405 Method Not Allowed error when tested in browser.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    gateway: 'Razorpay',
    service: 'Saarvi Payment Webhook Gateway',
    timestamp: new Date().toISOString(),
    allowedMethods: ['POST'],
    supportedEvents: ['order.paid', 'payment.captured', 'payment.failed'],
    message: 'Saarvi Razorpay Webhook endpoint is live and accepting POST webhook events.',
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
