import { NextResponse } from 'next/server';
import { navigationStore } from '@/lib/navigation/navigation-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/navigation
 * Returns current navigation configs across all categories.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const items = await navigationStore.getAllConfigs();
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('[Admin Navigation API] GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch navigation' }, { status: 500 });
  }
}

/**
 * POST /api/admin/navigation
 * Update single item, reorder category, or reset to defaults.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminWrite');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const body = await request.json();
    const { action, toolId, categoryId, updates, toolIdsInOrder, adminEmail } = body;

    if (action === 'reset') {
      const items = await navigationStore.resetToDefaults(adminEmail);
      return NextResponse.json({ success: true, items });
    }

    if (action === 'reorder') {
      if (!categoryId || !Array.isArray(toolIdsInOrder)) {
        return NextResponse.json({ error: 'categoryId and toolIdsInOrder array are required.' }, { status: 400 });
      }
      const items = await navigationStore.reorderCategory(categoryId, toolIdsInOrder, adminEmail);
      return NextResponse.json({ success: true, items });
    }

    // Default action: update single item
    if (!toolId || !categoryId || !updates) {
      return NextResponse.json({ error: 'toolId, categoryId, and updates object are required.' }, { status: 400 });
    }

    const updated = await navigationStore.updateConfig(toolId, categoryId, updates, adminEmail);
    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('[Admin Navigation API] POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update navigation' }, { status: 500 });
  }
}
