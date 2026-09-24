import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured } from './config';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClientInstance: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClientInstance) {
    return browserClientInstance;
  }

  if (!isSupabaseConfigured()) {
    // Provide a safe client instance with dummy values to prevent crashing during SSG or unconfigured dev
    browserClientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
    );
    return browserClientInstance;
  }

  browserClientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClientInstance;
}

