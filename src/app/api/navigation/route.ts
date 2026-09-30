import { NextResponse } from 'next/server';
import { navigationStore } from '@/lib/navigation/navigation-store';
import { toolDiscoveryService } from '@/lib/navigation/tool-discovery-service';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { NavigationService } from '@/lib/navigation/navigation-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/navigation
 * Public high-performance cached endpoint returning:
 * 1. Dynamic Admin-Controlled Navbar Items (Navigation 7.0)
 * 2. Data-driven smart tool navigation & MegaMenu snapshot (Canonical Tool Registry + Telemetry)
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get('window');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // 1. Fetch Dynamic Top-Level Navbar Items (NavigationService 7.0)
    const items = await NavigationService.getPublishedItems(forceRefresh);

    // 2. Fetch Tool Discovery & MegaMenu snapshot
    await navigationStore.getEffectiveNavigation();
    const { days, period } = toolDiscoveryService.parseWindowPeriod(windowParam);
    const snapshot = await toolDiscoveryService.getNavigationSnapshot({
      windowDays: days,
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      items, // Canonical 7.0 dynamic navigation items
      count: items.length,
      essentialTools: snapshot.essentialTools,
      essentialSlots: snapshot.essentialSlots,
      categories: snapshot.categories,
      globalTools: snapshot.globalTools,
      windowDays: snapshot.windowDays,
      windowPeriod: snapshot.windowPeriod,
      timestamp: snapshot.timestamp,
    });
  } catch (error: any) {
    console.error('[Public Navigation API] Error:', error);
    // Graceful fallback to default navigation
    const items = await NavigationService.getPublishedItems();
    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      categories: [],
      globalTools: { pdf: [], images: [], student: [], career: [], ai: [] },
    });
  }
}
