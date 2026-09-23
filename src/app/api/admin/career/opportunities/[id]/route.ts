import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import {
  enforceRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const authResult = await getAuthenticatedAdmin(request, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const opp = opportunityStore.getOpportunityById(id);
    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: opp });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to retrieve opportunity" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const authResult = await getAuthenticatedAdmin(request, "MANAGE");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, "adminMutations", authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { action, notes, reason, patch } = body as {
      action: "APPROVE" | "REJECT" | "EDIT" | "EXPIRE";
      notes?: string;
      reason?: string;
      patch?: Record<string, any>;
    };

    let result = null;

    if (action === "APPROVE") {
      result = opportunityStore.approveOpportunity(id, authResult.user.id, notes);
    } else if (action === "REJECT") {
      result = opportunityStore.rejectOpportunity(id, authResult.user.id, reason);
    } else if (action === "EDIT" && patch) {
      result = opportunityStore.editOpportunity(id, patch, authResult.user.id);
    } else if (action === "EXPIRE") {
      result = opportunityStore.markExpired(id, authResult.user.id);
    } else {
      return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      item: result,
      message: `Opportunity successfully ${action.toLowerCase()}d.`,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Admin Career Opportunity PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update opportunity" }, { status: 500 });
  }
}
