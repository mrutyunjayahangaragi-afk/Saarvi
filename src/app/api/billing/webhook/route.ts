// DocEase Phase 14: Cryptographic Razorpay Webhook Handler with Idempotency
// Processes verified billing provider events and updates subscription state.
// Uses raw request body, HMAC SHA-256 verification, and strict replay protection.

import { NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/billing/subscriptionService';

export async function POST(request: Request) {
  try {
    // 1. Extract RAW body text for cryptographic HMAC signature verification (do NOT JSON.parse first)
    const rawBody = await request.text();

    // 2. Extract provider signature and authentication headers
    const headers: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    // 3. Delegate to SubscriptionService for cryptographic verification & idempotent processing
    const result = await subscriptionService.handleWebhook(rawBody, headers);

    if (!result.success) {
      console.warn('Razorpay webhook verification rejected:', result.error);
      // Section 7 Requirement: Return 401 for invalid signatures
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

    // Section 7 & 8 Requirement: Return 200 only after valid event is processed or recognized as duplicate
    return NextResponse.json({
      success: true,
      received: true,
      eventId: result.eventId,
      duplicate: result.duplicate || false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal webhook processing error';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'WEBHOOK_PROCESSING_ERROR',
          message,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/billing/webhook
 * Health check & verification response for browser visits.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'Saarvi Subscription Webhook Gateway',
    timestamp: new Date().toISOString(),
    allowedMethods: ['POST'],
    message: 'Billing webhook endpoint is live and accepting POST events.',
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
