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
    const ratingParam = searchParams.get('rating') || searchParams.get('minRating') || undefined;
    const userTypeParam = searchParams.get('userType') || undefined;
    const toolParam = searchParams.get('tool') || searchParams.get('toolKey') || undefined;
    const search = searchParams.get('q')?.toLowerCase() || searchParams.get('search')?.toLowerCase() || undefined;
    const dateRange = searchParams.get('dateRange') || undefined;

    let items: any[] = [];

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        let query = supabase.from('feedback').select('*').order('created_at', { ascending: false });

        if (status && status !== 'ALL') {
          const normStatus = status === 'UNDER_REVIEW' ? 'IN_REVIEW' : status;
          query = query.or(`status.eq.${normStatus},status.eq.${status}`);
        }

        const { data, error } = await query;
        if (!error && data) {
          items = data.map((row) => ({
            id: row.id,
            userId: row.user_id,
            userType: row.user_type || (row.user_id ? 'FREE' : 'GUEST'),
            guestSessionId: row.guest_session_id,
            rating: row.rating,
            category: row.category,
            toolKey: row.tool_key || row.tool_slug,
            pageUrl: row.page_url,
            message: row.message,
            email: row.email,
            status: row.status === 'UNDER_REVIEW' ? 'IN_REVIEW' : row.status,
            sentiment: row.sentiment || (row.rating >= 4 ? 'POSITIVE' : row.rating === 3 ? 'NEUTRAL' : 'NEGATIVE'),
            adminNotes: row.admin_notes,
            resolvedAt: row.resolved_at,
            resolvedBy: row.resolved_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
      }
    }

    if (items.length === 0) {
      // Mock storage
      items = MockStorageProvider.getFeedbackList().map((f) => ({
        ...f,
        toolKey: f.toolKey,
        userType: f.userType || (f.userId ? 'FREE' : 'GUEST'),
        sentiment: f.sentiment || (f.rating >= 4 ? 'POSITIVE' : f.rating === 3 ? 'NEUTRAL' : 'NEGATIVE'),
        status: (f.status as string) === 'UNDER_REVIEW' ? 'IN_REVIEW' : f.status,
      }));
    }

    // 1. Calculate overall unfiltered analytics from real database records (never fake numbers)
    const totalAll = items.length;
    const avgRatingAll =
      totalAll > 0
        ? Math.round((items.reduce((acc, i) => acc + (i.rating || 0), 0) / totalAll) * 10) / 10
        : 0;

    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const byStatus = { NEW: 0, IN_REVIEW: 0, RESOLVED: 0, ARCHIVED: 0 };
    const byCategory: Record<string, number> = {};
    const byTool: Record<string, number> = {};

    for (const item of items) {
      const r = Math.min(5, Math.max(1, Math.round(item.rating || 1))) as 1 | 2 | 3 | 4 | 5;
      starCounts[r] = (starCounts[r] || 0) + 1;

      const st = item.status === 'IN_REVIEW' || item.status === 'UNDER_REVIEW' ? 'IN_REVIEW' : item.status;
      if (st in byStatus) {
        byStatus[st as keyof typeof byStatus] = (byStatus[st as keyof typeof byStatus] || 0) + 1;
      }

      if (item.category) {
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      }
      if (item.toolKey) {
        byTool[item.toolKey] = (byTool[item.toolKey] || 0) + 1;
      }
    }

    // 2. Apply filters to items
    let filteredItems = items;

    if (category && category !== 'ALL') {
      const catLower = category.toLowerCase();
      filteredItems = filteredItems.filter((i) => (i.category || '').toLowerCase() === catLower);
    }

    if (status && status !== 'ALL') {
      const normStatus = status === 'UNDER_REVIEW' ? 'IN_REVIEW' : status;
      filteredItems = filteredItems.filter((i) => i.status === normStatus || i.status === status);
    }

    if (ratingParam && ratingParam !== 'ALL') {
      const rNum = Number(ratingParam);
      if (!isNaN(rNum)) {
        filteredItems = filteredItems.filter((i) => Math.round(i.rating) === rNum);
      }
    }

    if (userTypeParam && userTypeParam !== 'ALL') {
      filteredItems = filteredItems.filter(
        (i) => (i.userType || '').toUpperCase() === userTypeParam.toUpperCase()
      );
    }

    if (toolParam && toolParam !== 'ALL') {
      const tLower = toolParam.toLowerCase();
      filteredItems = filteredItems.filter((i) => (i.toolKey || '').toLowerCase() === tLower);
    }

    if (dateRange && dateRange !== 'ALL') {
      const now = Date.now();
      let maxAgeMs = Infinity;
      if (dateRange === 'today') maxAgeMs = 24 * 60 * 60 * 1000;
      else if (dateRange === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      else if (dateRange === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

      filteredItems = filteredItems.filter((i) => {
        const itemTime = new Date(i.createdAt).getTime();
        return !isNaN(itemTime) && now - itemTime <= maxAgeMs;
      });
    }

    if (search) {
      filteredItems = filteredItems.filter(
        (i) =>
          i.message?.toLowerCase().includes(search) ||
          i.email?.toLowerCase().includes(search) ||
          i.toolKey?.toLowerCase().includes(search) ||
          i.category?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      items: filteredItems,
      analytics: {
        total: totalAll,
        avgRating: avgRatingAll,
        unresolvedCount: byStatus.NEW + byStatus.IN_REVIEW,
        starCounts,
        byStatus,
        byCategory,
        byTool,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve feedback list';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
