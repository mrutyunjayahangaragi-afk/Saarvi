import { NextResponse } from 'next/server';
import { adStore } from '@/lib/advertising/ad-store';
import { SubscriptionService } from '@/lib/billing/subscriptionService';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { ActiveAdResponse } from '@/types/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/advertising/active
 * Evaluates caller eligibility server-side.
 * Pro users are strictly exempt and NEVER receive ads.
 */
export async function GET(request: Request) {
  try {
    let userId: string | null = null;
    let isProUser = false;

    // 1. Check verified Supabase session
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          userId = user.id;
          const role = user.user_metadata?.role;
          if (role === 'PRO') {
            isProUser = true;
          }
        }
      } catch (e) {
        // Session check error -> treat as unauthenticated guest
      }
    }

    // 2. Check test / dev header if applicable
    if (!userId && process.env.NODE_ENV !== 'production') {
      const headerUserId = request.headers.get('x-user-id');
      const headerRole = request.headers.get('x-user-role');
      if (headerUserId) {
        userId = headerUserId;
        if (headerRole === 'PRO') {
          isProUser = true;
        }
      }
    }

    // 3. Authoritative server check for active Pro subscription
    if (userId && !isProUser) {
      try {
        const activeSub = await SubscriptionService.getInstance().getActiveSubscription(userId);
        if (activeSub && (activeSub.status === 'ACTIVE' || activeSub.status === 'TRIALING')) {
          isProUser = true;
        } else {
          // Check local mock storage / profile
          const mockSub = MockStorageProvider.getUserSubscription(userId);
          if (mockSub && (mockSub.status === 'ACTIVE' || mockSub.status === 'TRIALING')) {
            isProUser = true;
          }
        }
      } catch (err) {
        console.error('[Ad Active API] Subscription evaluation error:', err);
      }
    }

    // 4. Server-Authoritative PRO EXEMPTION
    if (isProUser) {
      const response: ActiveAdResponse = {
        showAd: false,
        isPro: true,
        reason: 'PRO_EXEMPT',
      };
      return NextResponse.json(response);
    }

    // 5. Query active eligible advertisement from authoritative store
    const { ad, settings } = adStore.getActiveEligibleAd();

    if (!ad) {
      const response: ActiveAdResponse = {
        showAd: false,
        isPro: false,
        reason: settings.adsEnabled ? 'NO_ACTIVE_AD' : 'ADS_DISABLED',
        settings,
      };
      return NextResponse.json(response);
    }

    const response: ActiveAdResponse = {
      showAd: true,
      isPro: false,
      reason: 'OK',
      ad,
      settings,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Ad Active API] Fatal error:', error);
    return NextResponse.json(
      { showAd: false, error: 'Internal server error while resolving advertisement.' },
      { status: 500 }
    );
  }
}
