import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { analyticsStore, AnalyticsPeriod } from '@/lib/analytics/analytics-store';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import type { UserRole, UserAccountStatus } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'VIEW');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as AnalyticsPeriod) || '30d';

    let user: any = null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Fetch Supabase Auth user
        const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(id);
        if (!authErr && authData?.user) {
          const u = authData.user;
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          const { data: sub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', id)
            .eq('status', 'active')
            .maybeSingle();

          const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
          const isSuspended = isBanned || u.user_metadata?.status === 'SUSPENDED';

          user = {
            id: u.id,
            email: u.email || '',
            fullName:
              profile?.full_name ||
              u.user_metadata?.full_name ||
              u.user_metadata?.name ||
              (u.email ? u.email.split('@')[0] : 'User'),
            avatarUrl:
              profile?.avatar_url ||
              u.user_metadata?.avatar_url ||
              u.user_metadata?.picture ||
              '',
            role: (profile?.role || u.user_metadata?.role || 'USER') as UserRole,
            status: isSuspended ? 'SUSPENDED' : 'ACTIVE',
            plan: sub ? 'PRO' : 'FREE',
            authProvider: (
              u.app_metadata?.provider ||
              (u.email?.toLowerCase().includes('gmail.com') ? 'google' : 'email')
            ).toUpperCase(),
            createdAt: u.created_at,
            updatedAt: profile?.updated_at || u.updated_at || u.created_at,
            lastSignInAt: u.last_sign_in_at || null,
          };
        }
      }
    }

    if (!user) {
      // Check mock storage fallback
      const local = MockStorageProvider.getUserById(id);
      if (local) {
        user = {
          id: local.id,
          email: local.email,
          fullName: local.fullName,
          avatarUrl: local.avatarUrl || '',
          role: local.role,
          status: local.status || 'ACTIVE',
          plan: local.plan || (local.role === 'SUPER_ADMIN' ? 'PRO' : 'FREE'),
          authProvider: local.authProvider || (local.email.includes('gmail.com') ? 'GOOGLE' : 'EMAIL'),
          createdAt: local.createdAt,
          updatedAt: local.updatedAt,
          lastSignInAt: local.lastSignInAt || null,
        };
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Real per-user analytics from analytics-store
    const analytics = await analyticsStore.getUserAnalytics(id, period);

    return NextResponse.json({
      success: true,
      user,
      analytics,
    });
  } catch (error: any) {
    console.error('[Admin User Detail API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch user details' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, status, role } = body;

    if (action === 'UPDATE_STATUS' && status) {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          if (status === 'SUSPENDED') {
            await supabase.auth.admin.updateUserById(id, {
              ban_duration: '876000h', // 100 years
              user_metadata: { status: 'SUSPENDED' },
            });
          } else {
            await supabase.auth.admin.updateUserById(id, {
              ban_duration: 'none',
              user_metadata: { status: 'ACTIVE' },
            });
          }
        }
      }

      try {
        MockStorageProvider.updateUserStatus(id, status as UserAccountStatus);
      } catch (err: any) {
        if (err?.message?.includes('At least one active SuperAdmin is required')) {
          MockStorageProvider.addRoleAuditLog({
            actor_user_id: authResult.user.id,
            target_user_id: id,
            old_role: 'SUPER_ADMIN',
            new_role: 'SUPER_ADMIN',
            action: 'LAST_SUPERADMIN_PROTECTION_TRIGGERED',
            reason: err.message,
          });
          return NextResponse.json({ error: 'At least one active SuperAdmin is required.' }, { status: 400 });
        }
        throw err;
      }

      MockStorageProvider.addAuditLog({
        adminUserId: authResult.user.id,
        adminEmail: authResult.user.email,
        action: `USER_STATUS_${status}`,
        targetType: 'USER',
        targetId: id,
        metadata: { status },
      });

      return NextResponse.json({ success: true, message: `User status set to ${status}` });
    }

    if (action === 'UPDATE_ROLE' && role) {
      const targetUser = MockStorageProvider.getUserById(id);
      const oldRole = targetUser?.role || 'USER';

      if (authResult.user.role !== 'SUPER_ADMIN') {
        MockStorageProvider.addRoleAuditLog({
          actor_user_id: authResult.user.id,
          target_user_id: id,
          old_role: oldRole,
          new_role: role,
          action: 'ROLE_CHANGE_DENIED',
          reason: 'Non-superadmin attempted role elevation',
        });
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admins can alter user roles' },
          { status: 403 }
        );
      }

      try {
        MockStorageProvider.updateUserRole(id, role as UserRole);
      } catch (err: any) {
        if (err?.message?.includes('At least one active SuperAdmin is required')) {
          MockStorageProvider.addRoleAuditLog({
            actor_user_id: authResult.user.id,
            target_user_id: id,
            old_role: oldRole,
            new_role: role,
            action: 'LAST_SUPERADMIN_PROTECTION_TRIGGERED',
            reason: err.message,
          });
          return NextResponse.json({ error: 'At least one active SuperAdmin is required.' }, { status: 400 });
        }
        throw err;
      }

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          await supabase.from('profiles').update({ role }).eq('id', id);
          await supabase.auth.admin.updateUserById(id, {
            user_metadata: { role },
          });
        }
      }

      let eventAction = `USER_ROLE_${role}`;
      if (role === 'SUPER_ADMIN' && oldRole !== 'SUPER_ADMIN') {
        eventAction = 'SUPERADMIN_CREATED';
      } else if (oldRole === 'SUPER_ADMIN' && role === 'ADMIN') {
        eventAction = 'SUPERADMIN_REVOKED';
      } else if (oldRole === 'SUPER_ADMIN' && role === 'USER') {
        eventAction = 'SUPERADMIN_REVOKED';
      } else if (role === 'ADMIN' && oldRole === 'USER') {
        eventAction = 'ADMIN_CREATED';
      } else if (oldRole === 'ADMIN' && role === 'USER') {
        eventAction = 'ADMIN_REVOKED';
      }

      MockStorageProvider.addRoleAuditLog({
        actor_user_id: authResult.user.id,
        target_user_id: id,
        old_role: oldRole,
        new_role: role,
        action: eventAction,
        reason: `Role changed to ${role} via admin API`,
      });

      MockStorageProvider.addAuditLog({
        adminUserId: authResult.user.id,
        adminEmail: authResult.user.email,
        action: eventAction,
        targetType: 'USER',
        targetId: id,
        metadata: { oldRole, newRole: role },
      });

      return NextResponse.json({ success: true, message: `User role set to ${role}` });
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin User Update API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}
