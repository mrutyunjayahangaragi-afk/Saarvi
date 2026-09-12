import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/providers";
import { AI_LIMITS, validateQuestion, validateDocumentText } from "@/lib/ai/limits";
import { checkRateLimit } from "@/lib/billing/rateLimit";
import { chunkDocumentText } from "@/lib/ai/chunking";
import { retrieveRelevantChunks } from "@/lib/ai/retrieval";
import {
  computeInputHash,
  checkIdempotency,
  saveIdempotency,
  recordAuditLog,
} from "@/lib/ai/audit";
import { ContextChunk, AIQuestionResponse } from "@/types/ai";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = checkRateLimit(`ai:ask:${ip}`, AI_LIMITS.MAX_AI_REQUESTS_PER_MINUTE);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please wait a moment before asking another question.",
          resetAt: rateCheck.resetAt,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { question, text, chunks } = body as {
      question?: unknown;
      text?: unknown;
      chunks?: ContextChunk[];
    };

    const qValidation = validateQuestion(question);
    if (!qValidation.valid) {
      return NextResponse.json({ success: false, error: qValidation.error }, { status: 400 });
    }

    const userQuestion = question as string;
    let allChunks: ContextChunk[] = [];

    if (Array.isArray(chunks) && chunks.length > 0) {
      allChunks = chunks;
    } else if (typeof text === "string") {
      const docValidation = validateDocumentText(text);
      if (!docValidation.valid) {
        return NextResponse.json({ success: false, error: docValidation.error }, { status: 400 });
      }
      allChunks = chunkDocumentText(text);
    } else {
      return NextResponse.json(
        { success: false, error: "Either document text or pre-extracted chunks must be provided." },
        { status: 400 }
      );
    }

    // Retrieve only top relevant chunks (data minimization)
    const topChunks = retrieveRelevantChunks(userQuestion, allChunks, AI_LIMITS.MAX_RETRIEVAL_CHUNKS);

    // Idempotency check
    const combinedContextText = topChunks.map((c) => c.text).join(" ");
    const hash = computeInputHash("ask", `${userQuestion}:${combinedContextText}`);
    const cached = checkIdempotency<AIQuestionResponse>(hash);
    if (cached) {
      return NextResponse.json({
        success: true,
        result: cached,
        cached: true,
        chunksUsed: topChunks.length,
        requestId,
      });
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      recordAuditLog({
        requestId,
        feature: "ask",
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

    const result = await provider.answerQuestion(userQuestion, topChunks);
    saveIdempotency(hash, result);

    recordAuditLog({
      requestId,
      feature: "ask",
      provider: provider.name,
      model: result.model,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      result,
      chunksUsed: topChunks.length,
      requestId,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Document Q&A error.";
    recordAuditLog({
      requestId,
      feature: "ask",
      provider: "unknown",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorCode: error.slice(0, 50),
    });

    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while answering your question. Please verify your query and try again.",
      },
      { status: 500 }
    );
  }
}
