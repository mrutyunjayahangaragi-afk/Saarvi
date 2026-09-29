import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { TemplateRepository } from "@/lib/templates/repository";
import type { CareerTemplate, DocumentType, TemplateStatus } from "@/lib/templates/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const documentType = (searchParams.get("documentType") || searchParams.get("type") || "RESUME") as DocumentType;
    const status = (searchParams.get("status") || "ALL") as TemplateStatus | "ALL";
    const category = searchParams.get("category") || "ALL";
    const search = searchParams.get("q") || searchParams.get("search") || undefined;

    const templates = await TemplateRepository.getAllTemplates({
      documentType,
      status,
      category,
      search,
    });

    // Compute honest database counts
    const allTemplates = await TemplateRepository.getAllTemplates({ documentType });
    const counts = {
      total: allTemplates.length,
      published: allTemplates.filter((t) => t.status === "PUBLISHED").length,
      draft: allTemplates.filter((t) => t.status === "DRAFT").length,
      needsReview: allTemplates.filter((t) => t.status === "NEEDS_REVIEW").length,
      disabled: allTemplates.filter((t) => t.status === "DISABLED" || !t.isActive).length,
      archived: allTemplates.filter((t) => t.status === "ARCHIVED").length,
    };

    return NextResponse.json({
      success: true,
      templates,
      counts,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load templates";
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
    const { action, template, id, isActive, status, adminNotes, updates } = body;

    // 1. Toggle active
    if (action === "toggle" && typeof id === "string") {
      const updated = await TemplateRepository.toggleActive(id, Boolean(isActive));
      return NextResponse.json({ success: true, template: updated });
    }

    // 2. Update publishing status
    if (action === "status" && typeof id === "string" && status) {
      const result = await TemplateRepository.updateStatus(id, status as TemplateStatus, adminNotes);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, template: result.template });
    }

    // 3. Duplicate template
    if (action === "duplicate" && typeof id === "string") {
      const duplicated = await TemplateRepository.duplicateTemplate(id);
      return NextResponse.json({ success: true, template: duplicated });
    }

    // 4. Create new version (v2, v3...)
    if (action === "version" && typeof id === "string") {
      const versioned = await TemplateRepository.createNewVersion(id, updates || {});
      return NextResponse.json({ success: true, template: versioned });
    }

    // 5. Reset to defaults
    if (action === "reset") {
      await TemplateRepository.initializeDefaults();
      const templates = await TemplateRepository.getAllTemplates();
      return NextResponse.json({ success: true, templates });
    }

    // 6. Save or update template
    if (action === "save" && template) {
      const saved = await TemplateRepository.saveTemplate(template as CareerTemplate);
      return NextResponse.json({ success: true, template: saved });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update template";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
