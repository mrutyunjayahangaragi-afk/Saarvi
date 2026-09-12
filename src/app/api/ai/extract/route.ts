import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/providers";
import { AI_LIMITS, validateDocumentText } from "@/lib/ai/limits";
import { checkRateLimit } from "@/lib/billing/rateLimit";
import { recordAuditLog } from "@/lib/ai/audit";
import { StructuredExtractionSchema, StructuredExtractionResult } from "@/types/ai";

function validateExtractedDataAgainstSchema(
  data: unknown,
  schema: StructuredExtractionSchema
): { validated: Record<string, unknown>; needsReview: boolean; extractedFieldsCount: number } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { validated: {}, needsReview: true, extractedFieldsCount: 0 };
  }

  const raw = data as Record<string, unknown>;
  const validated: Record<string, unknown> = {};
  let validCount = 0;
  let hasMissingRequired = false;

  for (const field of schema.fields) {
    const val = raw[field.name];

    if (val === undefined || val === null) {
      if (field.required) hasMissingRequired = true;
      validated[field.name] = null;
      continue;
    }

    if (field.type === "number") {
      const num = Number(val);
      if (!isNaN(num)) {
        validated[field.name] = num;
        validCount++;
      } else {
        if (field.required) hasMissingRequired = true;
        validated[field.name] = null;
      }
    } else if (field.type === "array") {
      if (Array.isArray(val)) {
        validated[field.name] = val;
        validCount++;
      } else {
        validated[field.name] = [String(val)];
        validCount++;
      }
    } else if (field.type === "date") {
      const dateStr = String(val).trim();
      const parsedDate = Date.parse(dateStr);
      if (!isNaN(parsedDate) || /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        validated[field.name] = dateStr;
        validCount++;
      } else {
        if (field.required) hasMissingRequired = true;
        validated[field.name] = dateStr;
      }
    } else {
      // String or object
      validated[field.name] = String(val).trim();
      validCount++;
    }
  }

  return {
    validated,
    needsReview: hasMissingRequired || validCount < Math.max(1, schema.fields.length / 2),
    extractedFieldsCount: validCount,
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = checkRateLimit(`ai:extract:${ip}`, AI_LIMITS.MAX_AI_REQUESTS_PER_MINUTE);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { text, schema } = body as {
      text?: unknown;
      schema?: StructuredExtractionSchema;
    };

    const docValidation = validateDocumentText(text);
    if (!docValidation.valid) {
      return NextResponse.json({ success: false, error: docValidation.error }, { status: 400 });
    }

    if (!schema || !Array.isArray(schema.fields) || schema.fields.length === 0) {
      return NextResponse.json(
        { success: false, error: "A valid extraction schema with field definitions is required." },
        { status: 400 }
      );
    }

    const provider = getAIProvider();
    if (!provider.isAvailable()) {
      recordAuditLog({
        requestId,
        feature: "extract",
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

    const rawData = await provider.extractStructuredData(text as string, schema);
    const { validated, needsReview, extractedFieldsCount } = validateExtractedDataAgainstSchema(
      rawData,
      schema
    );

    const result: StructuredExtractionResult = {
      data: validated,
      needsReview,
      extractedFieldsCount,
      provider: provider.name,
    };

    recordAuditLog({
      requestId,
      feature: "extract",
      provider: provider.name,
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
    const error = err instanceof Error ? err.message : "Extraction error.";
    recordAuditLog({
      requestId,
      feature: "extract",
      provider: "unknown",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorCode: error.slice(0, 50),
    });

    return NextResponse.json(
      { success: false, error: "Structured extraction failed. Please review document contents." },
      { status: 500 }
    );
  }
}
