// DocEase Supabase Configuration Detection

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return false;
  if (url.includes('your-project') || url.includes('placeholder')) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol.startsWith('http');
  } catch {
    return false;
  }
}
