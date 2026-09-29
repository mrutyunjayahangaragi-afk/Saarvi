import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { TemplateBatchService } from "@/lib/templates/batch-service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing batch ID" }, { status: 400 });
  }

  try {
    const updatedBatch = await TemplateBatchService.retryFailedTasks(id, []);
    return NextResponse.json({
      success: true,
      batch: updatedBatch,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retry batch tasks";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
