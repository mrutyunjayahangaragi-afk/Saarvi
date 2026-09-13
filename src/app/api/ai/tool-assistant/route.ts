import { NextResponse } from 'next/server';
import { resolveToolQuery } from '@/lib/ai/tool-discovery-engine';
import { featureServerStore } from '@/lib/features/feature-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/tool-assistant
 * Server endpoint for natural language tool discovery and routing.
 * Evaluates CANONICAL_TOOL_REGISTRY deterministically first for instantaneous response.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    // 1. Feature Flag Check
    const isAssistantEnabled = featureServerStore.isFeatureEnabled('ai_assistant_enabled') ||
      featureServerStore.isFeatureEnabled('ai-assistant-enabled');

    if (!isAssistantEnabled) {
      return NextResponse.json(
        { error: 'Saarvi AI Tool Assistant is currently disabled by administrator.' },
        { status: 403 }
      );
    }

    // 2. Validate Body
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'A valid message string is required.' },
        { status: 400 }
      );
    }

    // 3. Deterministic resolution against canonical tool registry
    const result = resolveToolQuery(message);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[AI Tool Assistant API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while searching for tool.' },
      { status: 500 }
    );
  }
}
