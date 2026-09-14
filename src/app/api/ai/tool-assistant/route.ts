import { NextResponse } from 'next/server';
import { resolveAssistantQuery } from '@/lib/ai/ai-assistant-router';
import { featureServerStore } from '@/lib/features/feature-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { analyticsStore } from '@/lib/analytics/analytics-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/tool-assistant
 * Server endpoint for natural language tool discovery, educational assistance, and routing.
 * Evaluates CANONICAL_TOOL_REGISTRY deterministically first for instantaneous response.
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    // 1. Feature Flag Check
    const isAssistantEnabled =
      featureServerStore.isFeatureEnabled('ai_assistant_enabled') ||
      featureServerStore.isFeatureEnabled('ai-assistant-enabled') ||
      featureServerStore.isFeatureEnabled('aiAssistantEnabled');

    if (!isAssistantEnabled) {
      return NextResponse.json(
        { error: 'Saarvi AI Assistant is currently disabled by administrator.' },
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

    // 3. Server-authoritative Admin check (never trust client claims)
    let isAdmin = false;
    try {
      const authResult = await getAuthenticatedAdmin(request, 'VIEW');
      if (authResult.success) {
        isAdmin = true;
      }
    } catch {
      isAdmin = false;
    }

    // 4. Resolve query via AI Assistant 2.0 Router
    const execution = await resolveAssistantQuery(message, { isAdmin });
    const durationMs = Date.now() - startTime;

    // 5. Safe platform telemetry: aggregate intent, timing, and toolId only (never raw prompt or documents)
    try {
      await analyticsStore.logEvent({
        eventType: 'ai_query',
        toolId: execution.result.tools?.[0]?.key,
        metadata: {
          intent: execution.intent,
          isDeterministic: execution.isDeterministic,
          provider: execution.providerUsed || (execution.isDeterministic ? 'deterministic_knowledge' : 'openrouter'),
          durationMs,
          success: execution.success,
        },
      });
    } catch (telemetryErr) {
      console.warn('[AI Assistant API] Non-blocking telemetry log error:', telemetryErr);
    }

    return NextResponse.json({
      success: execution.success,
      reply: execution.reply,
      result: execution.result,
      intent: execution.intent,
      isDeterministic: execution.isDeterministic,
      providerUsed: execution.providerUsed,
    });
  } catch (error: any) {
    console.error('[AI Assistant API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing AI query.' },
      { status: 500 }
    );
  }
}
