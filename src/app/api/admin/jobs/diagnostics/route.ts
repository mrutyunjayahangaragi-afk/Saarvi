import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/jobs/diagnostics
 * Inspects a specific job (via ?id=...) or runs full route-integrity reconciliation.
 */
export async function GET(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("id");

  if (targetId) {
    const diag = opportunityStore.getJobDiagnostics(targetId);
    return NextResponse.json({
      success: true,
      diagnostic: diag,
    });
  }

  // Run full integrity reconciliation check on published opportunities
  const integrity = opportunityStore.runRouteIntegrityCheck();

  return NextResponse.json({
    success: true,
    integrity,
  });
}
