import { NextResponse } from 'next/server';
import { toolAccessService } from '@/lib/tools/tool-access-service';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { toolKey, userId: clientUserId, error: errorMsg } = body;

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
      return NextResponse.json({ success: true, usageCount: 0 });
    }

    const opId =
      typeof body.operationId === 'string' && body.operationId.trim()
        ? body.operationId.trim()
        : `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const result = await toolAccessService.recordToolEvent({
      eventName: 'tool_error',
      toolKey: toolKey.trim(),
      operationId: opId,
      success: false,
      userId: effectiveUserId,
      userType: effectiveUserId ? 'authenticated' : 'guest',
      metadata: { error: typeof errorMsg === 'string' ? errorMsg : 'Operation failed' },
    });

    return NextResponse.json({
      success: true,
      usageCount: result.usageCount ?? 0,
      remainingUses: result.remainingUses ?? 10,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to release Beta usage';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
