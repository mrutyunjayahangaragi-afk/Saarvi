import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { counts } = opportunityStore.getAdminOpportunities();
    const sources = opportunityStore.getAllSourceHealth();
    const recentAuditLogs = opportunityStore.getRecentAuditLogs(25);
    const config = opportunityStore.getDiscoveryConfig();

    return NextResponse.json({
      success: true,
      analytics: {
        counts,
        sources,
        config,
        recentAuditLogs,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to load career analytics" }, { status: 500 });
  }
}
