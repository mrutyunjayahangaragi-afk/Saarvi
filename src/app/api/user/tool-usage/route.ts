import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { CANONICAL_TOOL_REGISTRY, normalizeToolKey, getCanonicalToolByKey } from '@/lib/tools/tool-registry';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import type { UserToolUsageSummary } from '@/types/tool-control';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, 'public');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    let userId: string | null = null;
    let userEmail: string | undefined;

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          userEmail = user.email;
        }
      } catch {}
    } else {
      const session = MockStorageProvider.getCurrentSession();
      if (session?.id) {
        userId = session.id;
        userEmail = session.email;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to view personal tool usage' },
        { status: 401 }
      );
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('get_user_tool_usage_summary', {
            p_user_id: userId,
          });

          if (!error && data) {
            const enrichedTools = (data.tools || []).map((t: any) => {
              const matched = getCanonicalToolByKey(t.toolKey);
              return {
                toolKey: normalizeToolKey(t.toolKey),
                toolName: matched?.name || t.toolKey,
                category: matched?.category || 'tool',
                totalUses: t.totalUses ?? 0,
                successfulUses: t.successfulUses ?? 0,
                failedUses: t.failedUses ?? 0,
                lastUsedAt: t.lastUsedAt || null,
              };
            });

            const summary: UserToolUsageSummary = {
              userId,
              userEmail,
              totalOperations: data.totalOperations ?? 0,
              uniqueTools: data.uniqueTools ?? 0,
              mostUsedTool: data.mostUsedTool ?? 'None',
              lastUsedTool: data.lastUsedTool ?? 'None',
              lastActivity: data.lastActivity,
              successRate: data.successRate ?? 100.0,
              tools: enrichedTools,
            };

            return NextResponse.json({
              success: true,
              summary,
            });
          }
        } catch (err) {
          console.warn('[UserToolUsage] Supabase RPC fallback to mock:', err);
        }
      }
    }

    // Local / Mock storage summary
    const summary = MockStorageProvider.getUserToolUsageSummary(userId);
    summary.userEmail = userEmail;
    summary.tools = summary.tools.map((t) => {
      const matched = getCanonicalToolByKey(t.toolKey);
      return {
        ...t,
        toolKey: normalizeToolKey(t.toolKey),
        toolName: matched?.name || t.toolName,
        category: matched?.category || t.category,
      };
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve user tool usage';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
