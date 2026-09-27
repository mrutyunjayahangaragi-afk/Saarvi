import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import type { UserAccountStatus } from '@/types/auth';

export type UserRegistrationState =
  | 'PENDING_EMAIL_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DISABLED';

/**
 * Server-Authoritative User Registration & Account Status Helper
 * 
 * Never trusts client headers, localStorage, or client boolean flags.
 * Directly queries Supabase Auth / PostgreSQL profiles or Mock storage.
 */
export async function getUserRegistrationStatus(
  userId: string
): Promise<UserRegistrationState> {
  if (!userId || typeof userId !== 'string') {
    return 'PENDING_EMAIL_VERIFICATION';
  }

  // 1. Supabase Mode
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        return 'PENDING_EMAIL_VERIFICATION';
      }

      // Fetch official auth record
      const { data: authUserRes, error: authErr } =
        await supabase.auth.admin.getUserById(userId);

      if (authErr || !authUserRes?.user) {
        return 'PENDING_EMAIL_VERIFICATION';
      }

      const u = authUserRes.user;

      // Check banned status
      const isBanned = Boolean(
        u.banned_until && new Date(u.banned_until) > new Date()
      );
      if (isBanned || u.user_metadata?.status === 'SUSPENDED') {
        return 'SUSPENDED';
      }

      // Fetch profile status
      const { data: profile } = await supabase
        .from('profiles')
        .select('status, role')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.status === 'SUSPENDED') {
        return 'SUSPENDED';
      }

      if (profile?.status === 'DISABLED') {
        return 'DISABLED';
      }

      // Determine provider: Google OAuth vs Email
      const detectedProvider = (
        u.app_metadata?.provider ||
        u.identities?.[0]?.provider ||
        'email'
      ).toLowerCase();

      // Google OAuth is pre-verified by provider
      if (detectedProvider === 'google') {
        return 'ACTIVE';
      }

      // Email/password requires explicit confirmation
      const isEmailConfirmed = Boolean(u.email_confirmed_at || u.confirmed_at);
      if (!isEmailConfirmed) {
        return 'PENDING_EMAIL_VERIFICATION';
      }

      if (profile?.status === 'PENDING' || profile?.status === 'PENDING_EMAIL_VERIFICATION') {
        // If email was confirmed but profile status lag, activate
        return 'ACTIVE';
      }

      return 'ACTIVE';
    } catch (err) {
      console.error('[UserStatus] Error querying status:', err);
      return 'PENDING_EMAIL_VERIFICATION';
    }
  }

  // 2. Mock / Offline Mode
  const storedUser = MockStorageProvider.getUserById(userId);
  if (!storedUser) {
    return 'PENDING_EMAIL_VERIFICATION';
  }

  if (storedUser.status === 'SUSPENDED') {
    return 'SUSPENDED';
  }

  if (storedUser.status === 'DISABLED') {
    return 'DISABLED';
  }

  if (
    storedUser.status === 'PENDING' ||
    storedUser.status === 'PENDING_EMAIL_VERIFICATION' ||
    (storedUser as any).emailVerified === false
  ) {
    return 'PENDING_EMAIL_VERIFICATION';
  }

  return 'ACTIVE';
}
