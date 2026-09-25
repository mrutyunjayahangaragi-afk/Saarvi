import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { CANONICAL_TOOL_REGISTRY } from '@/lib/tools/tool-registry';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import type { ToolActivityEvent } from '@/types/tool-control';

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
    const toolFilter = searchParams.get('toolKey')?.toLowerCase().trim();
    const limit = Math.min(200, Math.max(10, Number(searchParams.get('limit')) || 50));

    let events: ToolActivityEvent[] = [];

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          let query = supabase
            .from('platform_events')
            .select('id, user_id, event_name, tool_key, success, duration_ms, category, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (toolFilter) {
            query = query.eq('tool_key', toolFilter);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            events = data.map((d: any) => {
              const matchedTool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === d.tool_key);
              return {
                id: d.id,
                timestamp: d.created_at,
                userId: d.user_id,
                userEmail: d.user_id ? `user_${d.user_id.substring(0, 6)}@saarvi.local` : 'Anonymous Guest',
                toolKey: d.tool_key || 'unknown',
                toolName: matchedTool?.name || d.tool_key || 'Document Operation',
                action: d.event_name || 'execute',
                status: d.success ? 'SUCCESS' : 'FAILED',
                durationMs: d.duration_ms,
                category: d.category || 'tool',
              };
            });
          }
        } catch (err) {
          console.warn('[AdminToolActivity] Supabase fallback to mock storage:', err);
        }
      }
    }

    if (events.length === 0) {
      const rawEvents = (MockStorageProvider.getPlatformEvents() as any[]) || [];
      const filtered = toolFilter
        ? rawEvents.filter((e) => (e.toolKey || e.tool_key || e.targetId) === toolFilter)
        : rawEvents;

      events = filtered.slice(0, limit).map((e: any) => {
        const k = e.toolKey || e.tool_key || e.targetId;
        const matchedTool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === k);
        return {
          id: e.id,
          timestamp: e.timestamp || e.created_at || new Date().toISOString(),
          userId: e.userId || e.user_id,
          userEmail: e.userId || e.user_id ? `user_${String(e.userId || e.user_id).substring(0, 6)}@saarvi.local` : 'Anonymous Guest',
          toolKey: k || 'unknown',
          toolName: matchedTool?.name || k || 'Document Operation',
          action: e.eventName || e.eventType || 'execute',
          status: e.success !== false ? 'SUCCESS' : 'FAILED',
          durationMs: e.durationMs || 0,
          category: e.category || 'tool',
        };
      });
    }

    return NextResponse.json({
      success: true,
      events,
      totalCount: events.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve tool activity';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
