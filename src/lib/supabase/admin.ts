import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './config';

let adminClientInstance: SupabaseClient | null = null;

/**
 * Returns an authoritative server-side Supabase client with elevated permissions
 * using the SUPABASE_SERVICE_ROLE_KEY.
 * Strictly used in server contexts (API routes, server actions).
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (adminClientInstance) {
    return adminClientInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  adminClientInstance = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClientInstance;
}

/**
 * Ensures storage bucket exists in Supabase.
 */
export async function ensureStorageBucket(
  bucketName: string,
  isPublic = true
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn(`[Supabase Storage] List buckets warning: ${error.message}`);
      return false;
    }

    const exists = buckets?.some((b) => b.name === bucketName);
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: isPublic,
      });
      if (createError) {
        console.warn(`[Supabase Storage] Create bucket warning: ${createError.message}`);
        return false;
      }
    }
    return true;
  } catch (err: any) {
    console.warn(`[Supabase Storage] ensureStorageBucket failed: ${err?.message}`);
    return false;
  }
}

/**
 * Uploads an asset buffer to Supabase Storage and returns its durable URL / path.
 */
export async function uploadStorageAsset(
  bucketName: string,
  filePath: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<{ success: boolean; url: string; path: string; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      success: false,
      url: '',
      path: '',
      error: 'Supabase is not configured',
    };
  }

  try {
    await ensureStorageBucket(bucketName, true);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      return { success: false, url: '', path: '', error: error.message };
    }

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(data.path);

    return {
      success: true,
      url: publicData.publicUrl,
      path: data.path,
    };
  } catch (err: any) {
    return { success: false, url: '', path: '', error: err.message };
  }
}
