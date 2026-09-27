import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['NEW', 'UNDER_REVIEW', 'RESOLVED', 'ARCHIVED'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing feedback ID' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { status, adminNotes } = body;

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (status) updatePayload.status = status;
        if (typeof adminNotes === 'string') updatePayload.admin_notes = adminNotes.trim();

        const { data, error } = await supabase
          .from('feedback')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json({ success: true, item: data });
        }
      }
    }

    // Mock fallback
    const updated = MockStorageProvider.updateFeedbackStatus(
      id,
      status || 'UNDER_REVIEW',
      adminNotes
    );

    if (!updated) {
      return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update feedback item';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
