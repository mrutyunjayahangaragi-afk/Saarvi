import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/providers";
import { AI_LIMITS } from "@/lib/ai/limits";
import { checkRateLimit } from "@/lib/billing/rateLimit";
import {
  computeInputHash,
  checkIdempotency,
  saveIdempotency,
  recordAuditLog,
} from "@/lib/ai/audit";
import {
  buildCopilotPrompt,
  buildMockInterviewPrompt,
} from "@/lib/ai/prompts/copilot-templates";
import {
  CopilotContextInput,
  CopilotIntentCategory,
  CopilotResponse,
} from "@/types/copilot";

import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";

function cleanJsonText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId =
    req.headers.get("x-request-id") ||
    `cpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const rawForwarded = req.headers.get("x-forwarded-for") || "";
    const clientIp = rawForwarded.split(",")[0]?.trim() || "local_client";
    const user = await getAuthenticatedNotificationUser(req);
    const rateLimitKey = user ? `copilot:chat:usr:${user.id}` : `copilot:chat:ip:${clientIp}`;

    const rateCheck = checkRateLimit(
      rateLimitKey,
      AI_LIMITS.MAX_AI_REQUESTS_PER_MINUTE
    );

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please wait a moment before sending another message.",
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const mode = body.mode || "chat";

    if (mode === "mock_interview") {
      const { role, questionNumber, candidateSkills, lastQuestion, lastAnswer } = body;
      if (!role || typeof role !== "string") {
        return NextResponse.json(
          { success: false, error: "Target role is required for mock interview." },
          { status: 400 }
        );
      }

      const provider = getAIProvider();
      if (!provider.isAvailable()) {
        recordAuditLog({
          requestId,
          feature: "copilot-interview",
          provider: provider.name,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          status: "error",
          errorCode: "PROVIDER_UNAVAILABLE",
        });

        return NextResponse.json(
          { success: false, error: "AI interview coach is currently unavailable." },
          { status: 503 }
        );
      }

      const { system, user } = buildMockInterviewPrompt(
        role,
        questionNumber || 1,
        candidateSkills,
        lastAnswer,
        lastQuestion
      );

      const raw = provider.generateChat
        ? await provider.generateChat(system, user, true)
        : await provider.generateText(`${system}\n\n${user}`);

      let parsed: any;
      try {
        parsed = JSON.parse(cleanJsonText(raw));
      } catch {
        parsed = {
          question: raw.slice(0, 300),
          feedback: lastAnswer
            ? {
                rating: "Strong",
                notes: "Good preliminary response.",
                tips: ["Provide more concrete metrics and structure."],
              }
            : undefined,
        };
      }

      recordAuditLog({
        requestId,
        feature: "copilot-interview",
        provider: provider.name,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "success",
      });

      return NextResponse.json({
        success: true,
        result: parsed,
        requestId,
      });
    }

    // Default: Copilot Chat
    const { query, context, intent } = body as {
      query?: unknown;
      context?: CopilotContextInput;
      intent?: CopilotIntentCategory;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "A non-empty query string is required." },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();
    if (cleanQuery.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Query exceeds the maximum allowed length of 1,000 characters." },
        { status: 400 }
      );
    }

    const safeContext: CopilotContextInput = context || { activeCategories: [] };
    const safeIntent: CopilotIntentCategory = intent || "GENERAL";

    // Idempotency check with SHA-256 scoped to user/client to eliminate cross-user cache leakage
    const userScope = user?.id || clientIp;
    const hash = computeInputHash("copilot-chat", `${cleanQuery}:${JSON.stringify(safeContext)}`, userScope);
    const cached = checkIdempotency<CopilotResponse>(hash);
    if (cached) {
      return NextResponse.json({
        success: true,
        result: cached,
        cached: true,
        requestId,
      });
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      recordAuditLog({
        requestId,
        feature: "copilot-chat",
        provider: provider.name,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "error",
        errorCode: "PROVIDER_UNAVAILABLE",
      });

      return NextResponse.json(
        { success: false, error: "Saarvi Copilot is currently unavailable." },
        { status: 503 }
      );
    }

    const { system, user: userPrompt } = buildCopilotPrompt(cleanQuery, safeContext, safeIntent);

    const raw = provider.generateChat
      ? await provider.generateChat(system, userPrompt, true)
      : await provider.generateText(`${system}\n\n${userPrompt}`);

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(cleanJsonText(raw));
    } catch {
      parsedResponse = {
        message: raw,
        intent: safeIntent,
        suggestedActions: [],
        citations: [],
      };
    }

    const finalResult: CopilotResponse = {
      message: parsedResponse.message || "I have analyzed your request.",
      intent: parsedResponse.intent || safeIntent,
      isDeterministic: false,
      sourceNotice: "AI-generated suggestion based on your local workspace",
      suggestedActions: Array.isArray(parsedResponse.suggestedActions)
        ? parsedResponse.suggestedActions.map((act: any) => ({
            ...act,
            status: "suggested",
          }))
        : [],
      contextUsed: safeContext.activeCategories || [],
      citations: Array.isArray(parsedResponse.citations) ? parsedResponse.citations : [],
    };

    saveIdempotency(hash, finalResult);

    recordAuditLog({
      requestId,
      feature: "copilot-chat",
      provider: provider.name,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      result: finalResult,
      requestId,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Copilot error.";
    recordAuditLog({
      requestId,
      feature: "copilot-chat",
      provider: "unknown",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorCode: errorMsg.slice(0, 50),
    });

    return NextResponse.json(
      { success: false, error: "Failed to process Copilot request. Please try again." },
      { status: 500 }
    );
  }
}
