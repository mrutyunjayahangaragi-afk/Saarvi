import { NextRequest, NextResponse } from 'next/server';
import { TrainingDiscoveryService } from '@/lib/career/training-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || undefined;
    const domain = searchParams.get('domain') || undefined;
    const mode = searchParams.get('mode') || undefined;
    const duration = searchParams.get('duration') || undefined;
    const isVerifiedOnly = searchParams.get('verifiedOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await TrainingDiscoveryService.searchTraining({
      query,
      domain,
      mode,
      duration,
      isVerifiedOnly,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
      page,
      pageSize: limit,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch training opportunities.' },
      { status: 500 }
    );
  }
}
