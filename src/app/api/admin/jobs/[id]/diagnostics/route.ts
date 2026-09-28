import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/jobs/[id]/diagnostics
 * Health and route-integrity inspector for a specific canonical job.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  const diagnostic = opportunityStore.getJobDiagnostics(id);

  return NextResponse.json({
    success: true,
    diagnostic,
  });
}
