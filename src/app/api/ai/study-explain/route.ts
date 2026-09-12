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
import { StudyExplanationResult } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = checkRateLimit(`ai:study:${ip}`, AI_LIMITS.MAX_AI_REQUESTS_PER_MINUTE);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { materialText, topic } = body as {
      materialText?: unknown;
      topic?: string;
    };

    const docValidation = validateDocumentText(materialText);
    if (!docValidation.valid) {
      return NextResponse.json({ success: false, error: docValidation.error }, { status: 400 });
    }

    const cleanText = (materialText as string).trim();
    const hash = computeInputHash("study-explain", `${cleanText}:${topic || ""}`);
    const cached = checkIdempotency<StudyExplanationResult>(hash);
    if (cached) {
      return NextResponse.json({ success: true, result: cached, cached: true, requestId });
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      recordAuditLog({
        requestId,
        feature: "study-explain",
        provider: provider.name,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "error",
        errorCode: "PROVIDER_UNAVAILABLE",
      });

      return NextResponse.json(
        { success: false, error: "AI assistance is currently unavailable." },
        { status: 503 }
      );
    }

    const result = await provider.explainStudyMaterial(cleanText, topic);
    saveIdempotency(hash, result);

    recordAuditLog({
      requestId,
      feature: "study-explain",
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
    const error = err instanceof Error ? err.message : "Study explanation error.";
    recordAuditLog({
      requestId,
      feature: "study-explain",
      provider: "unknown",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorCode: error.slice(0, 50),
    });

    return NextResponse.json(
      { success: false, error: "Failed to explain study material. Please try again." },
      { status: 500 }
    );
  }
}
