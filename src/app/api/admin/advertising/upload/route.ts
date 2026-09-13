import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { detectFileFormatFromBytes, isExecutableSignature } from '@/lib/security/file-security';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5 MB
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_IMAGE_FORMATS = ['png', 'jpeg', 'jpg', 'webp', 'gif'];
const ALLOWED_VIDEO_FORMATS = ['mp4', 'webm'];

/**
 * POST /api/admin/advertising/upload
 * Super Admin endpoint for uploading advertisement images or videos.
 * Performs rigorous magic-byte binary validation and executable signature rejection.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const contentType = request.headers.get('content-type') || '';
    let fileBuffer: Buffer | null = null;
    let originalMimeType = '';
    let requestedType: 'IMAGE' | 'VIDEO' | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const typeHint = formData.get('mediaType') as string | null;

      if (typeHint === 'IMAGE' || typeHint === 'VIDEO') {
        requestedType = typeHint;
      }

      if (!file) {
        return NextResponse.json({ error: 'No media file provided.' }, { status: 400 });
      }

      const isVideoExpected = requestedType === 'VIDEO' || file.type.startsWith('video/');
      const maxSize = isVideoExpected ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

      if (file.size > maxSize) {
        const limitMB = Math.round(maxSize / (1024 * 1024));
        return NextResponse.json(
          { error: `File exceeds maximum allowed size of ${limitMB}MB.` },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      originalMimeType = file.type;
    } else {
      // JSON body with dataUrl
      const body = await request.json();
      const { dataUrl, mediaType } = body;

      if (!dataUrl || typeof dataUrl !== 'string') {
        return NextResponse.json(
          { error: 'Valid base64 media data URL is required.' },
          { status: 400 }
        );
      }

      if (mediaType === 'IMAGE' || mediaType === 'VIDEO') {
        requestedType = mediaType;
      }

      const matches = dataUrl.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return NextResponse.json(
          { error: 'Invalid data URL format. Expected data:[mime];base64,...' },
          { status: 400 }
        );
      }

      originalMimeType = matches[1];
      const base64Data = matches[2];
      fileBuffer = Buffer.from(base64Data, 'base64');

      const isVideoExpected = requestedType === 'VIDEO' || originalMimeType.startsWith('video/');
      const maxSize = isVideoExpected ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

      if (fileBuffer.length > maxSize) {
        const limitMB = Math.round(maxSize / (1024 * 1024));
        return NextResponse.json(
          { error: `File exceeds maximum allowed size of ${limitMB}MB.` },
          { status: 400 }
        );
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: 'Empty file buffer.' }, { status: 400 });
    }

    // 1. Check for dangerous executable signatures
    const headerBytes = new Uint8Array(fileBuffer.subarray(0, 32));
    if (isExecutableSignature(headerBytes)) {
      return NextResponse.json(
        { error: 'Security violation: Executable files and binary scripts are strictly prohibited.' },
        { status: 400 }
      );
    }

    // 2. Identify real binary format from magic bytes
    const detectedFormat = await detectFileFormatFromBytes(headerBytes);

    if (!detectedFormat) {
      return NextResponse.json(
        { error: 'Unsupported or unidentifiable media file format.' },
        { status: 400 }
      );
    }

    // 3. Match format against allowed images and videos
    let determinedMediaType: 'IMAGE' | 'VIDEO';
    let outputMime = '';

    if (ALLOWED_IMAGE_FORMATS.includes(detectedFormat)) {
      determinedMediaType = 'IMAGE';
      outputMime = detectedFormat === 'jpg' || detectedFormat === 'jpeg'
        ? 'image/jpeg'
        : `image/${detectedFormat}`;
    } else if (ALLOWED_VIDEO_FORMATS.includes(detectedFormat)) {
      determinedMediaType = 'VIDEO';
      outputMime = detectedFormat === 'mp4' ? 'video/mp4' : 'video/webm';
    } else {
      return NextResponse.json(
        {
          error: `Format "${detectedFormat}" is not permitted. Allowed: Images (${ALLOWED_IMAGE_FORMATS.join(', ')}), Videos (${ALLOWED_VIDEO_FORMATS.join(', ')})`,
        },
        { status: 400 }
      );
    }

    // 4. If admin specified an incompatible mediaType, reject mismatch
    if (requestedType && requestedType !== determinedMediaType) {
      return NextResponse.json(
        {
          error: `Media type mismatch: file was detected as ${determinedMediaType} (${detectedFormat}), but ${requestedType} was selected.`,
        },
        { status: 400 }
      );
    }

    // 5. Construct safe data URL for storage
    const dataUrl = `data:${outputMime};base64,${fileBuffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      mediaType: determinedMediaType,
      format: detectedFormat,
      sizeBytes: fileBuffer.length,
    });
  } catch (error: any) {
    console.error('[Admin Ad Upload API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Media upload failed.' },
      { status: 500 }
    );
  }
}
