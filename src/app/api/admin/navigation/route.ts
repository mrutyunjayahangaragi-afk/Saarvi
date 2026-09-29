import { NextResponse } from 'next/server';
import { navigationStore } from '@/lib/navigation/navigation-store';
import { toolDiscoveryService } from '@/lib/navigation/tool-discovery-service';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/navigation
 * Returns current navigation configs, categories, and smart navbar preview snapshot.
 * Requires server-authoritative admin authentication.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const authResult = await getAuthenticatedAdmin(request, 'VIEW');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get('window');
    const { days } = toolDiscoveryService.parseWindowPeriod(windowParam);

    const [items, categories, previewSnapshot] = await Promise.all([
      navigationStore.getAllConfigs(),
      navigationStore.getCategoryConfigs(),
      toolDiscoveryService.getNavigationSnapshot({ windowDays: days, forceRefresh: true }),
    ]);

    return NextResponse.json({
      success: true,
      items,
      categories,
      previewSnapshot,
      windowDays: days,
      defaultWindowDays: toolDiscoveryService.getDefaultWindowDays(),
    });
  } catch (error: any) {
    console.error('[Admin Navigation API] GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch navigation' }, { status: 500 });
  }
}

/**
 * POST /api/admin/navigation
 * Update single item, add tool, remove tool from navbar, reorder category, set usage window, or reset to defaults.
 * Requires server-authoritative admin authentication with MANAGE permission.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const adminEmail = authResult.user.email;
    const body = await request.json();
    const { action, toolId, categoryId, updates, toolIdsInOrder, categoryIdsInOrder, overrides, windowDays } = body;

    // Action: Set Default Usage Window
    if (action === 'set_window') {
      if (typeof windowDays === 'number' || windowDays === '7d' || windowDays === '30d' || windowDays === '90d') {
        toolDiscoveryService.setDefaultWindow(windowDays);
        return NextResponse.json({
          success: true,
          defaultWindowDays: toolDiscoveryService.getDefaultWindowDays(),
        });
      } else if (typeof windowDays === 'string') {
        const parsed = parseInt(windowDays, 10);
        if (!isNaN(parsed) && (parsed === 7 || parsed === 30 || parsed === 90)) {
          toolDiscoveryService.setDefaultWindow(parsed);
          return NextResponse.json({
            success: true,
            defaultWindowDays: toolDiscoveryService.getDefaultWindowDays(),
          });
        }
      }
      return NextResponse.json({ error: 'windowDays must be 7, 30, 90, "7d", "30d", or "90d".' }, { status: 400 });
    }

    // Action 1: Reset to canonical defaults
    if (action === 'reset') {
      const items = await navigationStore.resetToDefaults(adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, items });
    }

    // Action 2: Reorder tools within a category
    if (action === 'reorder') {
      if (!categoryId || !Array.isArray(toolIdsInOrder)) {
        return NextResponse.json({ error: 'categoryId and toolIdsInOrder array are required.' }, { status: 400 });
      }
      const items = await navigationStore.reorderCategory(categoryId, toolIdsInOrder, adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, items });
    }

    // Action 3: Reorder categories
    if (action === 'reorder_categories') {
      if (!Array.isArray(categoryIdsInOrder)) {
        return NextResponse.json({ error: 'categoryIdsInOrder array is required.' }, { status: 400 });
      }
      const categories = await navigationStore.reorderCategories(categoryIdsInOrder);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, categories });
    }

    // Action 4: Update category metadata (label, visibility)
    if (action === 'update_category') {
      if (!categoryId || !updates) {
        return NextResponse.json({ error: 'categoryId and updates are required.' }, { status: 400 });
      }
      const categories = await navigationStore.updateCategoryConfig(categoryId, updates, adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, categories });
    }

    // Action 5: Add an existing canonical tool to category
    if (action === 'add_tool') {
      if (!toolId || !categoryId) {
        return NextResponse.json({ error: 'toolId and categoryId are required.' }, { status: 400 });
      }
      const item = await navigationStore.addTool(toolId, categoryId, overrides, adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, item });
    }

    // Action 6: Remove tool from Navbar visibility
    if (action === 'remove_from_navbar') {
      if (!toolId || !categoryId) {
        return NextResponse.json({ error: 'toolId and categoryId are required.' }, { status: 400 });
      }
      const item = await navigationStore.removeFromNavbar(toolId, categoryId, adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, item });
    }

    // Default action: update single item
    if (!toolId || !categoryId || !updates) {
      return NextResponse.json({ error: 'toolId, categoryId, and updates object are required.' }, { status: 400 });
    }

    const updated = await navigationStore.updateConfig(toolId, categoryId, updates, adminEmail);
    toolDiscoveryService.invalidateCache();
    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('[Admin Navigation API] POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update navigation' }, { status: 500 });
  }
}
