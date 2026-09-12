import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/providers";
import { AI_LIMITS, validateDocumentText } from "@/lib/ai/limits";
import { checkRateLimit } from "@/lib/billing/rateLimit";
import {
  computeInputHash,
  checkIdempotency,
  saveIdempotency,
  recordAuditLog,
} from "@/lib/ai/audit";
import { AISummaryOptions, AISummaryResult } from "@/types/ai";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = checkRateLimit(`ai:summarize:${ip}`, AI_LIMITS.MAX_AI_REQUESTS_PER_MINUTE);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please wait a moment before submitting another request.",
          resetAt: rateCheck.resetAt,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { text, options } = body as { text?: unknown; options?: AISummaryOptions };

    const validation = validateDocumentText(text);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const docText = text as string;
    const lengthMode = options?.length || "standard";

    // Deduplication / Idempotency check
    const hash = computeInputHash("summarize", `${docText}:${lengthMode}`);
    const cached = checkIdempotency<AISummaryResult>(hash);
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
        feature: "summarize",
        provider: provider.name,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "error",
        errorCode: "PROVIDER_UNAVAILABLE",
      });

      return NextResponse.json(
        {
          success: false,
          error: "AI assistance is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    const result = await provider.summarize(docText, options);
    saveIdempotency(hash, result);

    recordAuditLog({
      requestId,
      feature: "summarize",
      provider: provider.name,
      model: result.model,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      result,
      requestId,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Internal AI processing error.";
    recordAuditLog({
      requestId,
      feature: "summarize",
      provider: "unknown",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorCode: error.slice(0, 50),
    });

    return NextResponse.json(
      {
        success: false,
        error: "The AI service encountered an error while summarizing this document. Please try again.",
      },
      { status: 500 }
    );
  }
}
