import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/jobs/[id]
 */
export async function GET(req: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const opp = opportunityStore.getOpportunityById(id);
  if (!opp) {
    return NextResponse.json({ error: "Job opportunity not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, job: opp });
}

/**
 * PATCH /api/admin/jobs/[id]
 * Updates fields or triggers status action (APPROVE, REJECT, PAUSE, RESUME, ARCHIVE, EXPIRE).
 */
export async function PATCH(req: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const rateLimit = enforceRateLimit(req, "adminMutations", authResult.user.id);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const body = await req.json();
    const { action, patch, notes, reason } = body;

    let result = null;
    if (action === "APPROVE") {
      result = opportunityStore.approveOpportunity(id, authResult.user.id, notes);
    } else if (action === "PUBLISH") {
      result = opportunityStore.publishOpportunity(id, authResult.user.id);
    } else if (action === "PAUSE") {
      result = opportunityStore.pauseOpportunity(id, authResult.user.id);
    } else if (action === "RESUME") {
      result = opportunityStore.resumeOpportunity(id, authResult.user.id);
    } else if (action === "ARCHIVE") {
      result = opportunityStore.archiveOpportunity(id, authResult.user.id);
    } else if (action === "REJECT") {
      result = opportunityStore.rejectOpportunity(id, authResult.user.id, reason);
    } else if (action === "EXPIRE") {
      result = opportunityStore.markExpired(id, authResult.user.id);
    } else if (patch) {
      result = opportunityStore.editOpportunity(id, patch, authResult.user.id);
    } else {
      return NextResponse.json({ error: "No valid action or patch provided" }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, job: result });
    return withRateLimitHeaders(response, rateLimit);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update job" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/jobs/[id]
 * Soft-deletes/archives by default. Permanent delete if permanent=true query parameter.
 */
export async function DELETE(req: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const rateLimit = enforceRateLimit(req, "adminMutations", authResult.user.id);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  const { searchParams } = new URL(req.url);
  const isPermanent = searchParams.get("permanent") === "true";

  const deleted = opportunityStore.deleteOpportunity(id, authResult.user.id, isPermanent);
  if (!deleted) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const response = NextResponse.json({
    success: true,
    message: isPermanent ? "Job permanently deleted." : "Job archived/soft deleted.",
  });
  return withRateLimitHeaders(response, rateLimit);
}
