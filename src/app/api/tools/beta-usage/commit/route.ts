import { NextResponse } from 'next/server';
import { toolAccessService } from '@/lib/tools/tool-access-service';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { toolKey, userId: clientUserId, durationMs } = body;

    if (!toolKey || typeof toolKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid parameter: toolKey' },
        { status: 400 }
      );
    }

    let effectiveUserId: string | null = null;

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          effectiveUserId = user.id;
        }
      } catch {}
    } else {
      const session = MockStorageProvider.getCurrentSession();
      if (session) {
        effectiveUserId = session.id;
      }
    }

    if (!effectiveUserId) {
      return NextResponse.json({ success: true, usageCount: 0, remainingUses: 10 });
    }

    const elapsed =
      typeof durationMs === 'number'
        ? durationMs
        : typeof body.processingTimeMs === 'number'
        ? body.processingTimeMs
        : 0;

    const result = await toolAccessService.commitBetaUse(
      effectiveUserId,
      toolKey.trim(),
      elapsed,
      body.operationId
    );

    return NextResponse.json({
      ...result,
      data: result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to commit Beta usage';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
