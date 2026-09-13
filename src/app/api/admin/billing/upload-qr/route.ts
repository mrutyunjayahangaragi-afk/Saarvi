import { NextResponse } from 'next/server';
import { PaymentStore } from '@/lib/billing/payment-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { detectFileFormatFromBytes, isExecutableSignature } from '@/lib/security/file-security';

export const dynamic = 'force-dynamic';

const MAX_QR_FILE_SIZE = 2 * 1024 * 1024; // 2 MB safety cap
const ALLOWED_IMAGE_FORMATS = ['png', 'jpeg', 'webp'];

/**
 * POST /api/admin/billing/upload-qr
 * Super Admin endpoint to upload or replace the official UPI Payment QR Code.
 * Magic bytes security validation prevents executable uploads and DoS.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/png';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No image file uploaded' },
          { status: 400 }
        );
      }

      if (file.size > MAX_QR_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: 'File size exceeds maximum allowed limit of 2MB' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      // JSON with base64 data
      const body = await request.json();
      const { dataUrl } = body;

      if (!dataUrl || typeof dataUrl !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Valid base64 image data URL is required' },
          { status: 400 }
        );
      }

      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return NextResponse.json(
          { success: false, error: 'Invalid data URL format. Expected data:image/...;base64,...' },
          { status: 400 }
        );
      }

      mimeType = matches[1];
      const base64Data = matches[2];
      imageBuffer = Buffer.from(base64Data, 'base64');

      if (imageBuffer.length > MAX_QR_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: 'File size exceeds maximum allowed limit of 2MB' },
          { status: 400 }
        );
      }
    }

    // Binary Security Inspection
    const uint8 = new Uint8Array(imageBuffer);

    if (isExecutableSignature(uint8)) {
      return NextResponse.json(
        { success: false, error: 'Security violation: executable signatures are strictly rejected.' },
        { status: 400 }
      );
    }

    const detectedFormat = await detectFileFormatFromBytes(uint8);
    if (!detectedFormat || !ALLOWED_IMAGE_FORMATS.includes(detectedFormat)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file format: Detected "${detectedFormat || 'unknown'}". Only authentic PNG, JPEG, and WebP images are allowed.`,
        },
        { status: 400 }
      );
    }

    const finalMime = detectedFormat === 'jpeg' ? 'image/jpeg' : `image/${detectedFormat}`;
    const generatedDataUrl = `data:${finalMime};base64,${imageBuffer.toString('base64')}`;

    // Update authoritative payment config
    const updated = PaymentStore.updateConfig(
      { qrCodeUrl: generatedDataUrl },
      {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      qrCodeUrl: updated.qrCodeUrl,
      format: detectedFormat,
      message: 'UPI QR code uploaded and verified successfully.',
    });
  } catch (err: any) {
    console.error('[Admin QR Upload Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while processing QR code' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/billing/upload-qr
 * Super Admin endpoint to remove the custom QR code image (reverts to default).
 */
export async function DELETE(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const updated = PaymentStore.updateConfig(
      { qrCodeUrl: '' },
      {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      config: updated,
      message: 'UPI QR code removed successfully.',
    });
  } catch (err: any) {
    console.error('[Admin QR Delete Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to remove QR code' },
      { status: 500 }
    );
  }
}
