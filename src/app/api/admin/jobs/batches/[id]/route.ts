import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/jobs/batches/[id]
 * Returns details and opportunities associated with a single discovery batch.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  const batches = opportunityStore.getDiscoveryBatches();
  const batch = batches.find((b) => b.id === id);

  if (!batch) {
    return NextResponse.json({ error: `Discovery batch ${id} not found.` }, { status: 404 });
  }

  const allOpps = opportunityStore.getAdminOpportunities({ pageSize: 500 });
  const batchOpps = allOpps.items.filter((o) => o.discoveryBatchId === id);

  return NextResponse.json({
    success: true,
    batch,
    opportunities: batchOpps,
    total: batchOpps.length,
  });
}
