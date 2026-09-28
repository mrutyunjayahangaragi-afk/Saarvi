import { NextResponse } from "next/server";
import { resumeTemplateService } from "@/lib/services/resumeTemplateService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = resumeTemplateService.getActiveTemplates();
    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load active resume templates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
