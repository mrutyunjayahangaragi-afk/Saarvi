import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { resumeTemplateService } from "@/lib/services/resumeTemplateService";
import type { ResumeTemplateDefinition } from "@/types/career";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const templates = resumeTemplateService.getAllTemplates();
    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load resume templates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await req.json();
    const { action, template, id, isActive } = body;

    if (action === "toggle" && typeof id === "string") {
      const updated = resumeTemplateService.toggleTemplateActive(id, Boolean(isActive));
      return NextResponse.json({ success: true, template: updated });
    }

    if (action === "duplicate" && typeof id === "string") {
      const duplicated = resumeTemplateService.duplicateTemplate(id);
      return NextResponse.json({ success: true, template: duplicated });
    }

    if (action === "reset") {
      const templates = resumeTemplateService.resetToDefaults();
      return NextResponse.json({ success: true, templates });
    }

    if (action === "save" && template) {
      const saved = resumeTemplateService.saveTemplate(template as ResumeTemplateDefinition);
      return NextResponse.json({ success: true, template: saved });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update resume template";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
