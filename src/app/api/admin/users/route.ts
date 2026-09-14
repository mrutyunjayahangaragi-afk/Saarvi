import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { adminService } from '@/lib/services/adminService';
import { analyticsStore } from '@/lib/analytics/analytics-store';
import type { UserRole, UserAccountStatus } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'VIEW');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const rawRole = searchParams.get('role')?.trim();
    const rawStatus = searchParams.get('status')?.trim();
    const rawPlan = searchParams.get('plan')?.trim();
    const rawProvider = searchParams.get('provider')?.trim().toUpperCase();

    const role = rawRole && rawRole !== 'all' ? (rawRole as UserRole) : undefined;
    const status = rawStatus && rawStatus !== 'all' ? (rawStatus as UserAccountStatus) : undefined;
    const plan = rawPlan && rawPlan !== 'all' ? (rawPlan as 'FREE' | 'PRO') : undefined;
    const provider = rawProvider && rawProvider !== 'ALL' && rawProvider !== 'ALL PROVIDERS' ? rawProvider : undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '15', 10)));

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Fetch all auth users
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (authError) {
          console.error('[Admin Users API] Supabase auth listUsers error:', authError);
          throw authError;
        }

        // Fetch profiles
        const { data: profiles } = await supabase.from('profiles').select('*');
        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

        // Fetch active subscriptions
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('user_id, status, plan_tier')
          .eq('status', 'active');
        const activeSubUsers = new Set((subs || []).map((s) => s.user_id));

        // Fetch user tool usage counts from analytics_events
        const toolUsageMap = new Map<string, number>();
        try {
          const { data: eventRows } = await supabase
            .from('analytics_events')
            .select('user_id, event_type');
          (eventRows || []).forEach((e) => {
            if (e.user_id) {
              const type = (e.event_type || '').toLowerCase();
              if (
                type.includes('tool') ||
                type.includes('run') ||
                type.includes('click') ||
                type.includes('open')
              ) {
                toolUsageMap.set(e.user_id, (toolUsageMap.get(e.user_id) || 0) + 1);
              }
            }
          });
        } catch {
          // Fallback to local memory analytics store
          const rawEvents = analyticsStore.getRawEvents();
          rawEvents.forEach((e: any) => {
            if (e.userId) {
              toolUsageMap.set(e.userId, (toolUsageMap.get(e.userId) || 0) + 1);
            }
          });
        }

        let users = (authData.users || []).map((u) => {
          const profile = profileMap.get(u.id);
          const rawRole = (profile?.role || u.user_metadata?.role || 'USER') as UserRole;
          const userPlan: 'FREE' | 'PRO' = activeSubUsers.has(u.id) ? 'PRO' : 'FREE';

          // Provider detection
          const rawProvider = (
            u.app_metadata?.provider ||
            (u.email?.toLowerCase().includes('gmail.com') ? 'google' : 'email')
          ).toUpperCase();

          const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
          const isSuspended = isBanned || u.user_metadata?.status === 'SUSPENDED';
          const userStatus: UserAccountStatus = isSuspended ? 'SUSPENDED' : 'ACTIVE';

          const fullName =
            profile?.full_name ||
            u.user_metadata?.full_name ||
            u.user_metadata?.name ||
            (u.email ? u.email.split('@')[0] : 'User');

          return {
            id: u.id,
            email: u.email || '',
            fullName,
            avatarUrl: profile?.avatar_url || u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
            role: rawRole,
            status: userStatus,
            plan: userPlan,
            authProvider: rawProvider as 'EMAIL' | 'GOOGLE',
            createdAt: u.created_at,
            updatedAt: profile?.updated_at || u.updated_at || u.created_at,
            lastSignInAt: u.last_sign_in_at || undefined,
            toolUses: toolUsageMap.get(u.id) || 0,
          };
        });

        // Filter: search
        if (search) {
          users = users.filter(
            (u) =>
              u.email.toLowerCase().includes(search) ||
              u.fullName.toLowerCase().includes(search) ||
              u.id.toLowerCase().includes(search)
          );
        }

        // Filter: role
        if (role) {
          users = users.filter((u) => u.role === role);
        }

        // Filter: status
        if (status) {
          users = users.filter((u) => u.status === status);
        }

        // Filter: plan
        if (plan) {
          users = users.filter((u) => u.plan === plan);
        }

        // Filter: provider
        if (provider) {
          users = users.filter((u) => u.authProvider === provider);
        }

        const total = users.length;
        const paginated = users.slice((page - 1) * limit, page * limit);

        return NextResponse.json({
          success: true,
          users: paginated,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        });
      }
    }

    // Supabase not configured fallback (mock / offline test)
    const fallbackRes = await adminService.listUsers({
      search: search || undefined,
      role,
      status,
      plan,
      page,
      limit,
    });

    const enriched = fallbackRes.users.map((u) => ({
      ...u,
      toolUses: 0,
    }));

    return NextResponse.json({
      success: true,
      users: enriched,
      total: fallbackRes.total,
      page,
      limit,
      totalPages: Math.ceil(fallbackRes.total / limit) || 1,
    });
  } catch (error: any) {
    console.error('[Admin Users API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list users' }, { status: 500 });
  }
}
