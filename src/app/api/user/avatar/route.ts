import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient, ensureStorageBucket } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const BUCKET_NAME = 'profile-images';

/**
 * Validates magic bytes for JPEG, PNG, and WebP.
 */
function validateImageMagicBytes(buffer: Buffer): { valid: boolean; format?: 'jpeg' | 'png' | 'webp' } {
  if (buffer.length < 12) return { valid: false };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: 'jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: 'png' };
  }

  // WebP: RIFF .... WEBP
  // Byte 0-3: 52 49 46 46 ("RIFF")
  // Byte 8-11: 57 45 42 50 ("WEBP")
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, format: 'webp' };
  }

  return { valid: false };
}

/**
 * GET /api/user/avatar?userId=...
 * Generates signed URL for user's profile image
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId') || user?.id;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 503 });
    }

    const filePath = `${targetUserId}/avatar.webp`;
    const { data, error } = await adminClient.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24); // 24-hour signed URL

    if (error || !data?.signedUrl) {
      // Return 404 if no custom avatar uploaded
      return NextResponse.json({ signedUrl: null, error: 'Avatar not found' }, { status: 404 });
    }

    const redirect = searchParams.get('redirect') === 'true';
    if (redirect) {
      return NextResponse.redirect(data.signedUrl);
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/user/avatar
 * Uploads a WebP avatar image (up to 5MB, verified magic bytes).
 * Supports multipart/form-data or application/json { base64Data, contentType }.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let fileBuffer: Buffer | null = null;
    let contentType = 'image/webp';

    const reqContentType = req.headers.get('content-type') || '';

    if (reqContentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'Image file exceeds 5MB limit. Please select a smaller photo.' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      contentType = file.type || 'image/webp';
    } else if (reqContentType.includes('application/json')) {
      const body = await req.json();
      const { base64Data, mimeType } = body;
      if (!base64Data) {
        return NextResponse.json({ error: 'Missing base64Data' }, { status: 400 });
      }

      const base64Clean = base64Data.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
      fileBuffer = Buffer.from(base64Clean, 'base64');
      contentType = mimeType || 'image/webp';

      if (fileBuffer.length > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'Image file exceeds 5MB limit. Please select a smaller photo.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: 'Empty file payload' }, { status: 400 });
    }

    // Verify magic bytes
    const verification = validateImageMagicBytes(fileBuffer);
    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Invalid image format. Only WebP, PNG, and JPEG images are allowed.' },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 503 });
    }

    // Ensure bucket exists
    await ensureStorageBucket(BUCKET_NAME, false);

    const filePath = `${user.id}/avatar.webp`;
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Avatar Upload Error]', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Generate signed URL with timestamp cache buster
    const { data: signedData } = await adminClient.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7-day signed URL

    const avatarUrl = signedData?.signedUrl || `/api/user/avatar?userId=${user.id}&t=${Date.now()}`;

    // Update auth metadata
    await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        avatar_url: avatarUrl,
        avatar_path: filePath,
        avatar_updated_at: new Date().toISOString(),
      },
    });

    // Dual-write update to profiles table if available
    try {
      await adminClient
        .from('profiles')
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    } catch {
      // Graceful fallback if profiles columns differ
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
      path: filePath,
      message: 'Avatar updated successfully',
    });
  } catch (err: any) {
    console.error('[Avatar API Error]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/avatar
 * Removes user's custom avatar and resets to default.
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 503 });
    }

    const filePath = `${user.id}/avatar.webp`;
    await adminClient.storage.from(BUCKET_NAME).remove([filePath]);

    // Reset user metadata
    await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        avatar_url: null,
        avatar_path: null,
        avatar_updated_at: new Date().toISOString(),
      },
    });

    // Reset profiles table
    try {
      await adminClient
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    } catch {
      // Graceful fallback
    }

    return NextResponse.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
