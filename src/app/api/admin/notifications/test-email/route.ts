import { NextResponse } from 'next/server';
import { providerFactory } from '@/lib/notifications/providers/provider-factory';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';

export const dynamic = 'force-dynamic';

// Sliding window rate limiter for admin test emails (Max 5 emails per 10 minutes per admin)
const MAX_TEST_EMAILS_PER_WINDOW = 5;
const WINDOW_DURATION_MS = 10 * 60 * 1000;
const testEmailRateLimitMap = new Map<string, number[]>();

function checkRateLimit(adminId: string): boolean {
  const now = Date.now();
  const timestamps = testEmailRateLimitMap.get(adminId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < WINDOW_DURATION_MS);

  if (validTimestamps.length >= MAX_TEST_EMAILS_PER_WINDOW) {
    testEmailRateLimitMap.set(adminId, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  testEmailRateLimitMap.set(adminId, validTimestamps);
  return true;
}

// Simple helper to reset rate limit for testing
export function _resetTestEmailRateLimits(): void {
  testEmailRateLimitMap.clear();
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(request: Request) {
  try {
    // 1. Server-Authoritative Admin Authentication
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Administrative privileges required.' },
        { status: 403 }
      );
    }

    // 2. Rate Limiting Protection
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: You can send at most 5 test emails per 10 minutes.' },
        { status: 429 }
      );
    }

    // 3. Request Body Parsing & Validation
    let body: { recipient?: string; to?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Bad Request: Invalid JSON body.' },
        { status: 400 }
      );
    }

    const rawRecipient = body.recipient || body.to;
    if (!rawRecipient || typeof rawRecipient !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request: Recipient email address is required.' },
        { status: 400 }
      );
    }

    // Check for CRLF / Header Injection
    if (/[\r\n]/.test(rawRecipient)) {
      return NextResponse.json(
        { error: 'Bad Request: Header injection detected in recipient address.' },
        { status: 400 }
      );
    }

    const cleanRecipient = rawRecipient.trim();
    if (!EMAIL_REGEX.test(cleanRecipient)) {
      return NextResponse.json(
        { error: 'Bad Request: Invalid recipient email address format.' },
        { status: 400 }
      );
    }

    // 4. Dispatch Test Email via Active Provider
    const emailProvider = providerFactory.getEmailProvider();

    const timestamp = new Date().toISOString();
    const result = await emailProvider.sendTransactionalEmail({
      to: cleanRecipient,
      subject: 'Saarvi — Transactional Email Verification',
      text: `Hello,\n\nThis is a test transactional email from Saarvi sent via ${emailProvider.name} on ${new Date().toLocaleString()}.\n\nIf you received this email, your transactional email provider configuration is working properly.\n\n— The Saarvi Team\nhttps://saarvi.app`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px;">
          <h2 style="color: #2563eb; margin-top: 0;">Saarvi Email Verification</h2>
          <p style="color: #334155; line-height: 1.6;">
            This is a test transactional email sent via <strong>${emailProvider.name}</strong>.
          </p>
          <div style="background-color: #f8fafc; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #475569; margin: 16px 0;">
            <strong>Dispatch Status:</strong> Successful<br/>
            <strong>Timestamp:</strong> ${timestamp}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
            Saarvi — Study. Work. Grow. • <a href="https://saarvi.app" style="color: #2563eb;">saarvi.app</a>
          </p>
        </div>
      `,
      metadata: {
        type: 'test_email',
        initiatedBy: user.id,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Unable to send test email: ${result.error || 'Provider delivery failure.'}`,
          provider: emailProvider.name,
          status: result.status,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully.',
      provider: emailProvider.name,
      messageId: result.providerMessageId,
      timestamp: result.timestamp,
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown server error.';
    // Redact any credential traces
    const sanitized = rawMessage.replace(/pass(word)?\s*[:=]\s*[^\s,;]+/gi, 'password=[REDACTED]');
    return NextResponse.json(
      { error: `Internal Server Error: ${sanitized}` },
      { status: 500 }
    );
  }
}
