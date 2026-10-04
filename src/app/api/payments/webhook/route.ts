/**
 * POST /api/payments/webhook
 *
 * Server-Authoritative Canonical Razorpay Webhook Endpoint
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
    const rawBody = await request.text();
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
 * GET /api/payments/webhook
 * Health check & verification response for browser visits and uptime monitors.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    gateway: 'Razorpay',
    service: 'Saarvi Canonical Payment Webhook Gateway',
    timestamp: new Date().toISOString(),
    allowedMethods: ['POST'],
    supportedEvents: ['order.paid', 'payment.captured', 'payment.failed', 'refund.processed'],
    message: 'Saarvi Razorpay Webhook endpoint is live and accepting POST events.',
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
