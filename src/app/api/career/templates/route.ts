import { NextRequest, NextResponse } from "next/server";
import { TemplateRepository } from "@/lib/templates/repository";
import type { DocumentType } from "@/lib/templates/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentType = (searchParams.get("type") || searchParams.get("documentType") || "RESUME") as DocumentType;

    const templates = await TemplateRepository.getActiveTemplates(documentType);
    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load active career templates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
