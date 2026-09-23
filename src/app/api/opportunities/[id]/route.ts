import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { getAuthenticatedUser } from "@/lib/security/auth-session";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/opportunities/[id]
 * Endpoint to fetch an approved opportunity by ID for authenticated users.
 */
export async function GET(request: Request, context: RouteParams) {
  // 1. Mandatory Server-Side Authentication Check
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to view opportunity details." },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const opp = opportunityStore.getOpportunityById(id);

    if (!opp || opp.status !== "APPROVED") {
      return NextResponse.json({ error: "Opportunity not found or not published" }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: opp }, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to retrieve opportunity" }, { status: 500 });
  }
}
