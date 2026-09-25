import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { CANONICAL_TOOL_REGISTRY } from '@/lib/tools/tool-registry';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import type { UserToolUsageSummary } from '@/types/tool-control';

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
    const userId = searchParams.get('userId')?.trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: userId' },
        { status: 400 }
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
              const matched = CANONICAL_TOOL_REGISTRY.find((c) => c.key === t.toolKey);
              return {
                toolKey: t.toolKey,
                toolName: matched?.name || t.toolKey,
                category: matched?.category || 'tool',
                totalUses: t.totalUses,
                successfulUses: t.successfulUses,
                failedUses: t.failedUses,
                lastUsedAt: t.lastUsedAt,
              };
            });

            const summary: UserToolUsageSummary = {
              userId,
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
          console.warn('[AdminUserUsage] Supabase RPC fallback:', err);
        }
      }
    }

    // Resilient local store aggregation
    const summary = MockStorageProvider.getUserToolUsageSummary(userId);

    // Enrich with canonical tool names and categories
    summary.tools = summary.tools.map((t) => {
      const matched = CANONICAL_TOOL_REGISTRY.find((c) => c.key === t.toolKey);
      return {
        ...t,
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
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
