import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { canAccessTool, getDefaultToolAccessMode, ToolAccessMode } from '@/lib/tools/access-control';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import type { AuthSessionUser } from '@/types/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tools/access?toolId=resume-builder
 * Server-authoritative tool access evaluation.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId')?.trim();

    if (!toolId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: toolId' },
        { status: 400 }
      );
    }

    let authUser: AuthSessionUser | null = null;
    let isPro = false;
    let override: any = null;

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        authUser = {
          id: user.id,
          email: user.email || '',
          fullName: user.user_metadata?.full_name || '',
          role: (user.user_metadata?.role as any) || 'USER',
          createdAt: user.created_at,
        };

        // Query active subscription
        const adminClient = getSupabaseAdminClient();
        if (adminClient) {
          const { data: sub } = await adminClient
            .from('subscriptions')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (sub) {
            isPro = true;
          }
        }
      }

      // Query tool override from database
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        const { data: dbOverride } = await adminClient
          .from('tool_overrides')
          .select('*')
          .eq('id', toolId)
          .maybeSingle();

        if (dbOverride) {
          override = {
            accessMode: dbOverride.access_mode as ToolAccessMode,
            status: dbOverride.status,
            requiresAuth: dbOverride.requires_auth,
            requiresPro: dbOverride.requires_pro,
          };
        }
      }
    } else {
      // Mock / offline mode
      const session = MockStorageProvider.getCurrentSession();
      if (session) {
        authUser = session;
        const user = MockStorageProvider.getUserById(session.id);
        if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
          isPro = true;
        }
      }

      const overrides = MockStorageProvider.getToolOverrides();
      const raw = overrides[toolId];
      if (raw) {
        override = {
          accessMode: raw.accessMode as ToolAccessMode,
          status: raw.status,
          requiresAuth: raw.requiresAuth,
          requiresPro: raw.requiresPro,
        };
      }
    }

    const decision = canAccessTool(authUser, toolId, {
      isPro,
      override,
    });

    return NextResponse.json({
      success: true,
      toolId,
      ...decision,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Failed to evaluate tool access permission.' },
      { status: 500 }
    );
  }
}
