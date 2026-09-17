import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { analyticsStore, AnalyticsPeriod } from '@/lib/analytics/analytics-store';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { UserOnboardingService } from '@/lib/services/user-onboarding-service';
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
    let conversions: any[] = [];
    let interviews: any[] = [];
    let notifications: any[] = [];
    let subscriptions: any[] = [];
    let welcomeSentAt: string | null = null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // 1. Fetch Supabase Auth user
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

          // Check welcome email status from metadata or auth_email_logs
          welcomeSentAt =
            u.user_metadata?.welcome_sent_at ||
            profile?.welcome_sent_at ||
            null;

          if (!welcomeSentAt) {
            try {
              const { data: emailLog } = await supabase
                .from('auth_email_logs')
                .select('sent_at')
                .eq('user_id', id)
                .eq('email_type', 'WELCOME')
                .maybeSingle();
              if (emailLog?.sent_at) {
                welcomeSentAt = emailLog.sent_at;
              }
            } catch {
              // Graceful if table missing
            }
          }

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
            plan: sub?.plan || profile?.plan || 'FREE',
            authProvider: (
              u.app_metadata?.provider ||
              (u.email?.toLowerCase().includes('gmail.com') ? 'google' : 'email')
            ).toUpperCase(),
            createdAt: u.created_at,
            updatedAt: profile?.updated_at || u.updated_at || u.created_at,
            lastSignInAt: u.last_sign_in_at || null,
            welcomeSentAt,
          };
        }

        // 2. Fetch real conversions from conversion_history
        try {
          const { data: convData } = await supabase
            .from('conversion_history')
            .select('*')
            .eq('user_id', id)
            .order('created_at', { ascending: false })
            .limit(50);
          if (convData) {
            conversions = convData.map((c: any) => ({
              id: c.id,
              toolType: c.tool_type || c.tool_id || 'conversion',
              toolName: c.tool_name || c.tool_type || 'Conversion Tool',
              fileName: c.file_name || 'Document',
              fileSize: c.file_size || 0,
              status: c.status || 'completed',
              createdAt: c.created_at,
            }));
          }
        } catch (cErr) {
          console.warn('[Admin User API] Conversion fetch note:', cErr);
        }

        // 3. Fetch real mock interview sessions
        try {
          const { data: intData } = await supabase
            .from('interview_sessions')
            .select('*')
            .eq('user_id', id)
            .order('created_at', { ascending: false })
            .limit(50);
          if (intData) {
            interviews = intData.map((s: any) => ({
              id: s.id,
              jobRole: s.role_target || s.job_role || 'General Interview',
              companyTarget: s.company_target || 'General',
              status: s.status || 'COMPLETED',
              score: s.score ?? s.overall_score ?? null,
              questionCount: s.questions_count || (Array.isArray(s.responses) ? s.responses.length : 0),
              createdAt: s.created_at,
            }));
          }
        } catch (iErr) {
          console.warn('[Admin User API] Interview fetch note:', iErr);
        }

        // 4. Fetch notifications for user
        try {
          const { data: notifData } = await supabase
            .from('notification_recipients')
            .select(`
              id,
              delivery_status,
              channel,
              read_at,
              delivered_at,
              notifications (
                id,
                title,
                category,
                type,
                created_at
              )
            `)
            .eq('user_id', id)
            .order('delivered_at', { ascending: false })
            .limit(50);

          if (notifData) {
            notifications = notifData.map((r: any) => ({
              id: r.id,
              title: r.notifications?.title || 'System Notification',
              category: r.notifications?.category || 'SYSTEM',
              channel: r.channel,
              deliveryStatus: r.delivery_status,
              read: Boolean(r.read_at),
              readAt: r.read_at,
              deliveredAt: r.delivered_at,
            }));
          }
        } catch (nErr) {
          console.warn('[Admin User API] Notification fetch note:', nErr);
        }

        // 5. Fetch subscriptions and payment requests
        try {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', id);

          const { data: reqData } = await supabase
            .from('subscription_requests')
            .select('*')
            .eq('user_id', id)
            .order('created_at', { ascending: false });

          subscriptions = [
            ...(subData || []).map((s: any) => ({
              id: s.id,
              type: 'SUBSCRIPTION',
              plan: s.plan,
              status: s.status,
              billingPeriod: s.billing_cycle || 'monthly',
              expiresAt: s.current_period_end,
              createdAt: s.created_at,
            })),
            ...(reqData || []).map((r: any) => ({
              id: r.id,
              type: 'REQUEST',
              plan: r.plan,
              status: r.status,
              amount: r.amount,
              paymentMethod: r.payment_method || 'UPI',
              transactionId: r.utr_number || r.payment_id || 'N/A',
              notes: r.admin_notes || null,
              createdAt: r.created_at,
            })),
          ];
        } catch (sErr) {
          console.warn('[Admin User API] Subscription fetch note:', sErr);
        }
      }
    }

    // Mock storage fallback
    if (!user) {
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
          welcomeSentAt: null,
        };
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Compute user analytics combining analytics_events & conversion_history
    const rawAnalytics = await analyticsStore.getUserAnalytics(id, period);

    // If conversion_history has rows, augment tool uses and completed counts
    const completedConversions = conversions.filter((c) => c.status === 'completed').length;
    const totalToolUses = Math.max(rawAnalytics.totalToolUses, conversions.length);
    const completedUses = Math.max(rawAnalytics.completedUses, completedConversions);

    const analytics = {
      ...rawAnalytics,
      totalToolUses,
      completedUses,
      conversionsCount: conversions.length,
      interviewCount: interviews.length,
    };

    return NextResponse.json({
      success: true,
      user,
      analytics,
      conversions,
      interviews,
      notifications,
      subscriptions,
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
    const { action, status, role, reason } = body;

    // Resend Welcome Email Action
    if (action === 'RESEND_WELCOME') {
      const resendResult = await UserOnboardingService.resendWelcomeEmail(
        id,
        {
          id: authResult.user.id,
          email: authResult.user.email,
          role: authResult.user.role,
        }
      );

      if (!resendResult.success) {
        return NextResponse.json({ error: resendResult.error || resendResult.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Welcome email resent successfully',
        resendResult,
      });
    }

    if (action === 'UPDATE_STATUS' && status) {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          if (status === 'SUSPENDED') {
            await supabase.auth.admin.updateUserById(id, {
              ban_duration: '876000h',
              user_metadata: { status: 'SUSPENDED' },
            });
          } else {
            await supabase.auth.admin.updateUserById(id, {
              ban_duration: 'none',
              user_metadata: { status: 'ACTIVE' },
            });
          }

          try {
            await supabase
              .from('profiles')
              .update({ status, updated_at: new Date().toISOString() })
              .eq('id', id);
          } catch {
            // Graceful fallback
          }
        }
      }

      // Record admin audit log
      MockStorageProvider.addAuditLog({
        adminUserId: authResult.user.id,
        adminEmail: authResult.user.email,
        action: `USER_STATUS_${status}`,
        targetType: 'USER',
        targetId: id,
        metadata: { status, reason: reason || 'Admin updated account status' },
      });

      return NextResponse.json({ success: true, status });
    }

    if (action === 'UPDATE_ROLE' && role) {
      // Role update requires SUPER_ADMIN privilege
      if (authResult.user.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Only SuperAdmins can alter user roles' },
          { status: 403 }
        );
      }

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          await supabase.auth.admin.updateUserById(id, {
            user_metadata: { role },
          });

          try {
            await supabase
              .from('profiles')
              .update({ role, updated_at: new Date().toISOString() })
              .eq('id', id);
          } catch {
            // Graceful fallback
          }

          // Record role audit log
          try {
            await supabase.from('role_audit_logs').insert({
              actor_user_id: authResult.user.id,
              target_user_id: id,
              old_role: 'UNKNOWN',
              new_role: role,
              action: 'ROLE_CHANGED',
              reason: reason || 'SuperAdmin updated role',
            });
          } catch {
            // Table might have slight variation
          }
        }
      }

      MockStorageProvider.addAuditLog({
        adminUserId: authResult.user.id,
        adminEmail: authResult.user.email,
        action: `USER_ROLE_${role}`,
        targetType: 'USER',
        targetId: id,
        metadata: { role, reason: reason || 'SuperAdmin updated role' },
      });

      return NextResponse.json({ success: true, role });
    }

    return NextResponse.json({ error: 'Invalid action payload' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin User Detail Action API] Error:', error);
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}
