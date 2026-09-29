import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { TemplateBatchService } from "@/lib/templates/batch-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing batch ID" }, { status: 400 });
  }

  try {
    const batch = await TemplateBatchService.getBatchById(id);
    if (!batch) {
      return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      batch,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load batch status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
