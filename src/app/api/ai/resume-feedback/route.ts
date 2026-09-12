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
import { ResumeFeedbackResult } from "@/types/ai";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = checkRateLimit(`ai:resume:${ip}`, AI_LIMITS.MAX_AI_REQUESTS_PER_MINUTE);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { resumeText, targetRole } = body as {
      resumeText?: unknown;
      targetRole?: string;
    };

    const docValidation = validateDocumentText(resumeText);
    if (!docValidation.valid) {
      return NextResponse.json({ success: false, error: docValidation.error }, { status: 400 });
    }

    const cleanText = (resumeText as string).trim();
    if (cleanText.length > 25_000) {
      return NextResponse.json(
        { success: false, error: "Resume text exceeds 25,000 characters limit." },
        { status: 400 }
      );
    }

    const hash = computeInputHash("resume-feedback", `${cleanText}:${targetRole || ""}`);
    const cached = checkIdempotency<ResumeFeedbackResult>(hash);
    if (cached) {
      return NextResponse.json({ success: true, result: cached, cached: true, requestId });
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      recordAuditLog({
        requestId,
        feature: "resume-feedback",
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

    const result = await provider.analyzeResume(cleanText, targetRole);
    saveIdempotency(hash, result);

    recordAuditLog({
      requestId,
      feature: "resume-feedback",
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
    const error = err instanceof Error ? err.message : "Resume analysis error.";
    recordAuditLog({
      requestId,
      feature: "resume-feedback",
      provider: "unknown",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorCode: error.slice(0, 50),
    });

    return NextResponse.json(
      { success: false, error: "Failed to generate resume feedback. Please try again." },
      { status: 500 }
    );
  }
}
