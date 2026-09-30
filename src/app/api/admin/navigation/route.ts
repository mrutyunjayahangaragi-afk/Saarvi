import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { navigationStore } from '@/lib/navigation/navigation-store';
import { toolDiscoveryService } from '@/lib/navigation/tool-discovery-service';
import { NavigationService } from '@/lib/navigation/navigation-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/navigation
 * Returns:
 * 1. Tool discovery config & previewSnapshot
 * 2. Dynamic Navbar 7.0 draft, published, versions, and validation results
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'VIEW');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get('window');
    const { days } = toolDiscoveryService.parseWindowPeriod(windowParam);

    // 1. Tool Discovery metadata & Preview Snapshot
    const [items, categories, previewSnapshot] = await Promise.all([
      navigationStore.getAllConfigs(),
      navigationStore.getCategoryConfigs(),
      toolDiscoveryService.getNavigationSnapshot({ windowDays: days, forceRefresh: true }),
    ]);

    // 2. Dynamic Top Navbar 7.0 items, drafts, and version history
    const [draft, published, versions] = await Promise.all([
      NavigationService.getDraftItems(),
      NavigationService.getPublishedItems(true),
      NavigationService.getVersions(),
    ]);

    const validation = NavigationService.validateNavigation(draft);

    return NextResponse.json({
      success: true,
      items,
      categories,
      previewSnapshot,
      windowDays: days,
      defaultWindowDays: toolDiscoveryService.getDefaultWindowDays(),
      // Dynamic Navbar 7.0
      draft,
      published,
      versions,
      validation,
    });
  } catch (error: any) {
    console.error('[Admin Navigation API] GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch navigation' }, { status: 500 });
  }
}

/**
 * POST /api/admin/navigation
 * Admin actions:
 * - Dynamic Navbar 7.0: save_draft | publish | rollback | reset_navbar
 * - Tool Discovery: set_window | reset | reorder | reorder_categories | update_category | add_tool | remove_from_navbar | update single item
 */
export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const adminEmail = authResult.user?.email || 'admin@saarvi.internal';
    const adminId = authResult.user?.id || 'admin';
    const body = await request.json().catch(() => ({}));
    const {
      action,
      toolId,
      categoryId,
      updates,
      toolIdsInOrder,
      categoryIdsInOrder,
      overrides,
      windowDays,
      items: draftItems,
      notes,
      version,
    } = body;

    // ── Dynamic Navbar 7.0 Actions ───────────────────────────────────────────
    if (action === 'save_draft') {
      if (!Array.isArray(draftItems)) {
        return NextResponse.json({ error: 'Items must be an array' }, { status: 400 });
      }
      const result = NavigationService.saveDraft(draftItems);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({
        success: true,
        message: 'Draft navigation saved successfully.',
        errors: result.errors,
      });
    }

    if (action === 'publish') {
      const result = await NavigationService.publishDraft(adminId, notes);
      toolDiscoveryService.invalidateCache();
      if (!result.success) {
        return NextResponse.json(
          {
            error: 'Validation failed before publish.',
            errors: result.errors,
          },
          { status: 422 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Navigation published to live users successfully.',
        version: result.version,
      });
    }

    if (action === 'rollback') {
      const versionNumber = Number(version);
      if (!versionNumber) {
        return NextResponse.json({ error: 'Valid version number required' }, { status: 400 });
      }
      const result = await NavigationService.rollbackToVersion(versionNumber, adminId);
      toolDiscoveryService.invalidateCache();
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Rollback failed' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: `Successfully rolled back navigation to version ${versionNumber}.`,
      });
    }

    if (action === 'reset_navbar') {
      const defaultItems = NavigationService.resetToDefault();
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({
        success: true,
        message: 'Reset navigation draft to default setup.',
        items: defaultItems,
      });
    }

    // ── Existing Tool Discovery Actions ──────────────────────────────────────
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

    if (action === 'reset') {
      const itemsRes = await navigationStore.resetToDefaults(adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, items: itemsRes });
    }

    if (action === 'reorder') {
      if (!categoryId || !Array.isArray(toolIdsInOrder)) {
        return NextResponse.json({ error: 'categoryId and toolIdsInOrder array are required.' }, { status: 400 });
      }
      const itemsRes = await navigationStore.reorderCategory(categoryId, toolIdsInOrder, adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, items: itemsRes });
    }

    if (action === 'reorder_categories') {
      if (!Array.isArray(categoryIdsInOrder)) {
        return NextResponse.json({ error: 'categoryIdsInOrder array is required.' }, { status: 400 });
      }
      const categoriesRes = await navigationStore.reorderCategories(categoryIdsInOrder);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, categories: categoriesRes });
    }

    if (action === 'update_category') {
      if (!categoryId || !updates) {
        return NextResponse.json({ error: 'categoryId and updates are required.' }, { status: 400 });
      }
      const categoriesRes = await navigationStore.updateCategoryConfig(categoryId, updates, adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, categories: categoriesRes });
    }

    if (action === 'add_tool') {
      if (!toolId || !categoryId) {
        return NextResponse.json({ error: 'toolId and categoryId are required.' }, { status: 400 });
      }
      const item = await navigationStore.addTool(toolId, categoryId, overrides, adminEmail);
      toolDiscoveryService.invalidateCache();
      return NextResponse.json({ success: true, item });
    }

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
