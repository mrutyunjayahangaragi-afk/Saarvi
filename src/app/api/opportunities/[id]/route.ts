import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/opportunities/[id]
 * Public endpoint to fetch an approved opportunity by ID.
 */
export async function GET(request: Request, context: RouteParams) {
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
