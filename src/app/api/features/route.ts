import { NextResponse } from 'next/server';
import { featureServerStore } from '@/lib/features/feature-store';

export const dynamic = 'force-dynamic';

/**
 * Public authoritative endpoint for platform feature availability and access modes.
 * Consumed by client applications, tool runners, and navigation components.
 */
export async function GET() {
  try {
    const features = featureServerStore.getAllFeatures();

    // Map public client-safe feature flags
    const clientFeatures = features
      .filter((f) => f.visibility !== 'hidden')
      .map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        category: f.category,
        status: f.status,
        enabled: f.status === 'ENABLED' || f.status === 'BETA',
        accessMode: f.accessMode || 'FREE',
        route: f.route,
      }));

    return NextResponse.json(
      {
        success: true,
        features: clientFeatures,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (err: any) {
    console.error('[API /api/features] Error loading features:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load feature configuration.' },
      { status: 500 }
    );
  }
}
