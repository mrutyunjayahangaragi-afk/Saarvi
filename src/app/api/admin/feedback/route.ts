import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

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
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const minRating = searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined;
    const search = searchParams.get('q')?.toLowerCase() || undefined;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        let query = supabase.from('feedback').select('*').order('created_at', { ascending: false });

        if (category && category !== 'ALL') {
          query = query.eq('category', category.toUpperCase());
        }
        if (status && status !== 'ALL') {
          query = query.eq('status', status.toUpperCase());
        }
        if (minRating) {
          query = query.gte('rating', minRating);
        }

        const { data, error } = await query;
        if (!error && data) {
          let items = data.map((row) => ({
            id: row.id,
            userId: row.user_id,
            rating: row.rating,
            category: row.category,
            toolSlug: row.tool_slug,
            pageUrl: row.page_url,
            message: row.message,
            email: row.email,
            status: row.status,
            adminNotes: row.admin_notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          if (search) {
            items = items.filter(
              (i) =>
                i.message?.toLowerCase().includes(search) ||
                i.email?.toLowerCase().includes(search) ||
                i.toolSlug?.toLowerCase().includes(search)
            );
          }

          const total = items.length;
          const avgRating =
            total > 0
              ? Math.round((items.reduce((acc, i) => acc + (i.rating || 0), 0) / total) * 10) / 10
              : 5.0;
          const unresolvedCount = items.filter((i) => i.status === 'NEW' || i.status === 'UNDER_REVIEW').length;

          return NextResponse.json({
            success: true,
            items,
            analytics: {
              total,
              avgRating,
              unresolvedCount,
              byCategory: {
                BUG: items.filter((i) => i.category === 'BUG').length,
                FEATURE: items.filter((i) => i.category === 'FEATURE').length,
                PERFORMANCE: items.filter((i) => i.category === 'PERFORMANCE').length,
                UX: items.filter((i) => i.category === 'UX').length,
                OTHER: items.filter((i) => i.category === 'OTHER').length,
              },
              byStatus: {
                NEW: items.filter((i) => i.status === 'NEW').length,
                UNDER_REVIEW: items.filter((i) => i.status === 'UNDER_REVIEW').length,
                RESOLVED: items.filter((i) => i.status === 'RESOLVED').length,
                ARCHIVED: items.filter((i) => i.status === 'ARCHIVED').length,
              },
            },
          });
        }
      }
    }

    // Mock storage fallback
    let items = MockStorageProvider.getFeedbackList();

    // Apply filters in application code since MockStorage takes no params
    if (category && category !== 'ALL') {
      items = items.filter((i) => i.category === category);
    }
    if (status && status !== 'ALL') {
      items = items.filter((i) => i.status === status);
    }
    if (minRating) {
      items = items.filter((i) => i.rating >= minRating);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.message?.toLowerCase().includes(q) ||
          i.userEmail?.toLowerCase().includes(q)
      );
    }

    const analytics = MockStorageProvider.getFeedbackAnalytics();

    return NextResponse.json({
      success: true,
      items,
      analytics,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve feedback list';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
