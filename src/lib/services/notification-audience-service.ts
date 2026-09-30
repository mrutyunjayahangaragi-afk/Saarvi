import { getSupabaseAdminClient } from '../supabase/admin.ts';
import { isSupabaseConfigured } from '../supabase/config.ts';
import { MockStorageProvider } from '../supabase/mock-storage.ts';
import type { NotificationAudienceType, NotificationAudienceDefinition } from '../../types/notifications-v2.ts';

export interface AuthoritativeUserRecipient {
  id: string;
  email: string;
  fullName: string;
  role: string;
  plan: 'FREE' | 'PRO';
  status: string;
}

export class NotificationAudienceService {
  /**
   * Authoritatively fetches all registered users from the database.
   * Prioritizes Supabase auth.admin + public.profiles + public.subscriptions.
   * Fallback to MockStorageProvider if Supabase is offline or not configured.
   */
  public static async fetchAllRegisteredUsers(): Promise<AuthoritativeUserRecipient[]> {
    if (typeof window === 'undefined' && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          // 1. Fetch auth users (batches if > 1000)
          let authUsers: any[] = [];
          let page = 1;
          const perPage = 1000;
          let hasMore = true;

          while (hasMore && page <= 10) {
            const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({
              page,
              perPage,
            });
            if (authErr || !authData?.users || authData.users.length === 0) {
              hasMore = false;
            } else {
              authUsers = authUsers.concat(authData.users);
              if (authData.users.length < perPage) {
                hasMore = false;
              } else {
                page++;
              }
            }
          }

          // 2. Fetch profiles
          const { data: profiles } = await supabase.from('profiles').select('*');
          const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

          // 3. Fetch active subscriptions for PRO plan mapping
          const { data: subs } = await supabase.from('subscriptions').select('user_id').eq('status', 'active');
          const proSet = new Set((subs || []).map((s: any) => s.user_id));

          if (authUsers.length > 0) {
            return authUsers.map((u) => {
              const prof = profileMap.get(u.id);
              const role = prof?.role || u.user_metadata?.role || 'USER';
              const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
              const isSuspended = isBanned || u.user_metadata?.status === 'SUSPENDED' || prof?.status === 'SUSPENDED';
              const isDisabled = prof?.status === 'DISABLED';
              const isEmailConfirmed = Boolean(u.email_confirmed_at || u.confirmed_at);

              let status = 'ACTIVE';
              if (isSuspended) status = 'SUSPENDED';
              else if (isDisabled) status = 'DISABLED';
              else if (!isEmailConfirmed) status = 'PENDING_EMAIL_VERIFICATION';

              const plan: 'FREE' | 'PRO' = proSet.has(u.id) ? 'PRO' : 'FREE';
              const fullName =
                prof?.full_name ||
                u.user_metadata?.full_name ||
                u.user_metadata?.name ||
                (u.email ? u.email.split('@')[0] : 'User');

              return {
                id: u.id,
                email: u.email || '',
                fullName,
                role,
                plan,
                status,
              };
            });
          }
        }
      } catch (err) {
        console.warn('[NotificationAudienceService] Supabase fetch error, fallback to mock store:', err);
      }
    }

    // Fallback: Local / Memory Mock Storage
    const mockUsers = MockStorageProvider.listAllUsers();
    return mockUsers.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      plan: (u.plan === 'PRO' ? 'PRO' : 'FREE') as 'FREE' | 'PRO',
      status: u.status || 'ACTIVE',
    }));
  }

  /**
   * Resolves target recipients based on audience criteria.
   * Server-authoritative: NEVER trusts client-supplied recipient emails or frontend counts.
   */
  public static async resolveAudience(
    audienceType: NotificationAudienceType,
    audienceDef?: NotificationAudienceDefinition
  ): Promise<AuthoritativeUserRecipient[]> {
    const allUsers = await this.fetchAllRegisteredUsers();

    switch (audienceType) {
      case 'ALL_USERS':
        return allUsers;

      case 'SELECTED_USERS': {
        const allowedIds = new Set(audienceDef?.userIds || []);
        return allUsers.filter((u) => allowedIds.has(u.id));
      }

      case 'FREE_USERS':
        return allUsers.filter((u) => u.plan !== 'PRO');

      case 'PRO_USERS':
        return allUsers.filter((u) => u.plan === 'PRO');

      case 'ADMINS':
        return allUsers.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');

      case 'VERIFIED_USERS':
        return allUsers.filter((u) => u.status === 'ACTIVE');

      case 'UNVERIFIED_USERS':
        return allUsers.filter((u) => u.status !== 'ACTIVE');

      case 'CUSTOM_SEGMENT':
      default:
        return allUsers;
    }
  }

  /**
   * Fast server-side calculation of authoritative audience match count.
   */
  public static async countAudience(
    audienceType: NotificationAudienceType,
    audienceDef?: NotificationAudienceDefinition
  ): Promise<number> {
    const recipients = await this.resolveAudience(audienceType, audienceDef);
    return recipients.length;
  }
}
