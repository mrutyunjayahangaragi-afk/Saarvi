import { NextResponse } from 'next/server';
import { toolAccessService } from '@/lib/tools/tool-access-service';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { toolKey, userId: clientUserId } = body;

    if (!toolKey || typeof toolKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid parameter: toolKey' },
        { status: 400 }
      );
    }

    let effectiveUserId: string | null = clientUserId || null;

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
      // For anonymous users, allow access or prompt login
      return NextResponse.json({
        success: true,
        allowed: true,
        usageCount: 0,
        remainingUses: 10,
        isAnonymous: true,
      });
    }

    const reservation = await toolAccessService.reserveBetaUse(effectiveUserId, toolKey.trim());

    return NextResponse.json({
      success: true,
      ...reservation,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reserve Beta usage';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
