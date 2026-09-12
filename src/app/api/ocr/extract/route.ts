import { NextRequest, NextResponse } from "next/server";
import { getOCRProvider } from "@/lib/ocr/providers";
import { validateImageBuffer } from "@/lib/ocr/preprocessing";
import { AI_LIMITS, validatePageRange } from "@/lib/ai/limits";
import { checkRateLimit } from "@/lib/billing/rateLimit";
import { recordAuditLog } from "@/lib/ai/audit";
import { OCRRequestOptions } from "@/types/ocr";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const ip = req.headers.get("x-forwarded-for") || "local_client";
    const rateCheck = checkRateLimit(`ocr:extract:${ip}`, AI_LIMITS.MAX_OCR_REQUESTS_PER_MINUTE);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";
    let options: OCRRequestOptions = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: "No file provided in form data." }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type || "image/jpeg";

      const startPage = formData.get("startPage") ? Number(formData.get("startPage")) : undefined;
      const endPage = formData.get("endPage") ? Number(formData.get("endPage")) : undefined;
      if (startPage || endPage) {
        options.pageRange = { start: startPage || 1, end: endPage || 20 };
      }
    } else {
      const body = await req.json();
      const { fileBase64, mime, options: reqOpts } = body as {
        fileBase64?: string;
        mime?: string;
        options?: OCRRequestOptions;
      };

      if (!fileBase64) {
        return NextResponse.json({ success: false, error: "No file data provided." }, { status: 400 });
      }

      fileBuffer = Buffer.from(fileBase64, "base64");
      mimeType = mime || "image/jpeg";
      if (reqOpts) options = reqOpts;
    }

    // Validation
    const isPdf = mimeType.includes("pdf");
    if (!isPdf) {
      const validation = validateImageBuffer(fileBuffer, mimeType);
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
      }
    } else {
      if (fileBuffer.length > AI_LIMITS.MAX_PDF_FILE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `PDF size exceeds the maximum limit of ${AI_LIMITS.MAX_PDF_FILE_BYTES / (1024 * 1024)} MB.`,
          },
          { status: 400 }
        );
      }
    }

    const provider = getOCRProvider();
    if (!provider.isAvailable()) {
      recordAuditLog({
        requestId,
        feature: "ocr",
        provider: provider.name,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "error",
        errorCode: "PROVIDER_UNAVAILABLE",
      });

      return NextResponse.json(
        { success: false, error: "OCR is currently unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const result = isPdf
      ? await provider.extractTextFromPdf(fileBuffer, options)
      : await provider.extractTextFromImage(fileBuffer, mimeType, options);

    if (!result.text || result.text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No readable text was detected in this document. Please ensure the image is clear and in focus.",
        },
        { status: 422 }
      );
    }

    recordAuditLog({
      requestId,
      feature: "ocr",
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
    const error = err instanceof Error ? err.message : "OCR processing error.";
    recordAuditLog({
      requestId,
      feature: "ocr",
      provider: "unknown",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "error",
      errorCode: error.slice(0, 50),
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to extract text from document. OCR results may contain recognition errors.",
      },
      { status: 500 }
    );
  }
}
