/**
 * Saarvi Server-Authoritative Entitlement & Subscription Source of Truth
 *
 * All Pro-protected features and permission gates MUST query this module.
 * Never trust client-submitted isPro, localStorage, query parameters, or JWT claims alone.
 */

import { SubscriptionService } from './subscriptionService';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export interface UserEntitlement {
  userId: string;
  isPro: boolean;
  tier: 'FREE' | 'PRO';
  status: 'ACTIVE' | 'EXPIRED' | 'NONE' | 'TRIALING';
  plan?: 'monthly' | 'yearly';
  expiresAt?: string;
  startedAt?: string;
  source?: string;
}

/**
 * Centrally evaluates and returns the authoritative user entitlement.
 * Enforces server-side period expiration and database-backed state.
 */
export async function getUserEntitlement(userId: string): Promise<UserEntitlement> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return {
      userId: '',
      isPro: false,
      tier: 'FREE',
      status: 'NONE',
    };
  }

  const cleanUserId = userId.trim();
  const now = Date.now();

  try {
    // 1. Authoritative check via SubscriptionService (which verifies period expiration)
    const activeSub = await SubscriptionService.getInstance().getActiveSubscription(cleanUserId);
    if (activeSub && (activeSub.status === 'ACTIVE' || activeSub.status === 'TRIALING')) {
      const isExpired = activeSub.currentPeriodEnd
        ? new Date(activeSub.currentPeriodEnd).getTime() <= now
        : false;

      if (!isExpired) {
        return {
          userId: cleanUserId,
          isPro: true,
          tier: 'PRO',
          status: activeSub.status,
          plan: (activeSub.billingInterval?.toLowerCase() as 'monthly' | 'yearly') || 'monthly',
          expiresAt: activeSub.currentPeriodEnd,
          startedAt: activeSub.currentPeriodStart,
          source: activeSub.provider,
        };
      }
    }

    // 2. Fallback check: Direct lookup in MockStorageProvider
    const storedSub = MockStorageProvider.getUserSubscription(cleanUserId);
    if (storedSub) {
      const isExpired = storedSub.currentPeriodEnd
        ? new Date(storedSub.currentPeriodEnd).getTime() <= now
        : false;

      if (!isExpired && (storedSub.status === 'ACTIVE' || storedSub.status === 'TRIALING')) {
        return {
          userId: cleanUserId,
          isPro: true,
          tier: 'PRO',
          status: storedSub.status,
          plan: (storedSub.billingInterval?.toLowerCase() as 'monthly' | 'yearly') || 'monthly',
          expiresAt: storedSub.currentPeriodEnd,
          startedAt: storedSub.currentPeriodStart,
          source: storedSub.provider,
        };
      }

      if (isExpired) {
        return {
          userId: cleanUserId,
          isPro: false,
          tier: 'FREE',
          status: 'EXPIRED',
          expiresAt: storedSub.currentPeriodEnd,
          source: storedSub.provider,
        };
      }
    }

    // 3. Supabase live database lookup if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', cleanUserId)
          .in('status', ['active', 'ACTIVE', 'trialing', 'TRIALING'])
          .order('current_period_end', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const isExpired = data.current_period_end
            ? new Date(data.current_period_end).getTime() <= now
            : false;

          if (!isExpired) {
            return {
              userId: cleanUserId,
              isPro: true,
              tier: 'PRO',
              status: 'ACTIVE',
              plan: (data.billing_interval?.toLowerCase() as 'monthly' | 'yearly') || 'monthly',
              expiresAt: data.current_period_end,
              startedAt: data.current_period_start,
              source: data.provider,
            };
          }
        }
      }
    }

    // 4. Default non-Pro entitlement
    return {
      userId: cleanUserId,
      isPro: false,
      tier: 'FREE',
      status: 'NONE',
    };
  } catch (err) {
    console.error(`[getUserEntitlement] Error evaluating entitlement for ${cleanUserId}:`, err);
    return {
      userId: cleanUserId,
      isPro: false,
      tier: 'FREE',
      status: 'NONE',
    };
  }
}
