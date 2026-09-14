import { NextResponse } from 'next/server';
import { PaymentStore } from '@/lib/billing/payment-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { detectFileFormatFromBytes, isExecutableSignature } from '@/lib/security/file-security';
import { uploadStorageAsset, getSupabaseAdminClient } from '@/lib/supabase/admin';
import { resolvePaymentQrImage } from '@/lib/billing/qr-resolver';

export const dynamic = 'force-dynamic';

const MAX_QR_FILE_SIZE = 10 * 1024 * 1024; // 10 MB safety cap for scanner and high-res camera images
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
          { success: false, error: 'File size exceeds maximum allowed limit of 10MB' },
          { status: 400 }
        );
      }

      mimeType = file.type || 'image/png';
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
          { success: false, error: 'File size exceeds maximum allowed limit of 10MB' },
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

    let detectedFormat = await detectFileFormatFromBytes(uint8);

    // Fallback detection for scanner images with EXIF/JFIF/custom headers
    if (!detectedFormat) {
      if (uint8.length >= 2 && uint8[0] === 0xff && uint8[1] === 0xd8) {
        detectedFormat = 'jpeg';
      } else if (uint8.length >= 4 && uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47) {
        detectedFormat = 'png';
      } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
        detectedFormat = 'jpeg';
      } else if (mimeType.includes('png')) {
        detectedFormat = 'png';
      } else if (mimeType.includes('webp')) {
        detectedFormat = 'webp';
      }
    }

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
    const timestamp = Date.now();
    const storagePath = `qr-codes/saarvi-upi-qr-${timestamp}.${detectedFormat}`;

    // Previous path for safe post-update cleanup
    const previousConfig = PaymentStore.getPaymentConfig();
    const oldStoragePath = previousConfig.qrImageUrl;

    // 1. Upload asset to Supabase Storage bucket 'payment-assets' for durability
    const storageRes = await uploadStorageAsset(
      'payment-assets',
      storagePath,
      imageBuffer,
      finalMime
    );

    if (!storageRes.success) {
      return NextResponse.json(
        { success: false, error: storageRes.error || 'Failed to upload QR asset to storage' },
        { status: 500 }
      );
    }

    // 2. Update authoritative payment config with the canonical storage path
    const updated = PaymentStore.updateConfig(
      { qrCodeUrl: storageRes.path },
      {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      }
    );

    // 3. Persist to Supabase database AND verify it succeeded before returning success
    const persistRes = await PaymentStore.persistConfigToSupabase(authResult.user);
    if (!persistRes.success) {
      return NextResponse.json(
        { success: false, error: `Database persistence failed: ${persistRes.error}` },
        { status: 500 }
      );
    }

    // 4. Safe post-update cleanup of older file (only after new file and DB record are fully committed)
    if (oldStoragePath && oldStoragePath !== storageRes.path && oldStoragePath.startsWith('qr-codes/')) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          await supabase.storage.from('payment-assets').remove([oldStoragePath]);
        }
      } catch (cleanErr) {
        console.warn('[Storage Cleanup Warning]:', cleanErr);
      }
    }

    // 5. Construct browser-loadable URL with cache-busting timestamp
    const resolvedUrl = resolvePaymentQrImage(storageRes.path, timestamp);

    return NextResponse.json({
      success: true,
      qrCodeUrl: resolvedUrl,
      storagePath: storageRes.path,
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

    const oldConfig = PaymentStore.getPaymentConfig();
    const oldPath = oldConfig.qrImageUrl;

    // 1. Update in-memory config
    const updated = PaymentStore.updateConfig(
      { qrCodeUrl: '' },
      {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      }
    );

    // 2. Persist to database AND verify it succeeded
    const persistRes = await PaymentStore.persistConfigToSupabase(authResult.user);
    if (!persistRes.success) {
      return NextResponse.json(
        { success: false, error: `Failed to remove QR code from database: ${persistRes.error}` },
        { status: 500 }
      );
    }

    // 3. Safe cleanup from storage
    if (oldPath && oldPath.startsWith('qr-codes/')) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          await supabase.storage.from('payment-assets').remove([oldPath]);
        }
      } catch (cleanErr) {
        console.warn('[Storage QR Cleanup Warning]:', cleanErr);
      }
    }

    return NextResponse.json({
      success: true,
      config: updated,
      qrCodeUrl: null,
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
