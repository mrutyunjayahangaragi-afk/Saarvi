import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { NotificationAudienceService } from '@/lib/services/notification-audience-service';
import type { NotificationAudienceType, NotificationAudienceDefinition } from '@/types/notifications-v2';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'VIEW');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const body = await request.json();
    const audienceType = (body.audience_type || 'ALL_USERS') as NotificationAudienceType;
    const audienceDef = body.audience_definition as NotificationAudienceDefinition | undefined;

    const matchedCount = await NotificationAudienceService.countAudience(audienceType, audienceDef);

    return NextResponse.json({
      success: true,
      audienceType,
      matchedCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to calculate audience count.' },
      { status: 500 }
    );
  }
}
