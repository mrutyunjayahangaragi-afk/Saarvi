import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { mockStorage } from "@/lib/supabase/mock-storage";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "SAVED",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
]);

/**
 * GET /api/jobs/applications
 * Returns application tracker records for authenticated user.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to view application tracker." },
      { status: 401 }
    );
  }

  try {
    const applications = mockStorage.getJobApplications(authUser.id);
    return NextResponse.json({
      success: true,
      items: applications,
      total: applications.length,
    });
  } catch (err: any) {
    console.error("[GET /api/jobs/applications] Error:", err);
    return NextResponse.json({ error: "Failed to retrieve job applications." }, { status: 500 });
  }
}

/**
 * POST /api/jobs/applications
 * Creates or updates an application status for authenticated user.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to update application tracker." },
      { status: 401 }
    );
  }

  const clientIp = getClientIp(req);
  const rateLimitResult = enforceRateLimit(req, "publicWrite", `jobs:app:${authUser.id}:${clientIp}`);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many application tracker updates. Please wait." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { jobId, jobTitle, companyName, status = "APPLIED", notes } = body;

    if (!jobId || !jobTitle || !companyName) {
      return NextResponse.json(
        { error: "Missing required application fields: jobId, jobTitle, and companyName are required." },
        { status: 400 }
      );
    }

    const upperStatus = String(status).toUpperCase();
    if (!VALID_STATUSES.has(upperStatus)) {
      return NextResponse.json(
        { error: `Invalid status '${status}'. Must be one of: ${Array.from(VALID_STATUSES).join(", ")}` },
        { status: 400 }
      );
    }

    const application = mockStorage.createOrUpdateJobApplication(authUser.id, {
      jobId: String(jobId),
      jobTitle: String(jobTitle),
      companyName: String(companyName),
      status: upperStatus as any,
      notes: notes ? String(notes) : undefined,
    });

    return NextResponse.json({
      success: true,
      application,
      message: "Application tracker updated.",
    });
  } catch (err: any) {
    console.error("[POST /api/jobs/applications] Error:", err);
    return NextResponse.json({ error: "Failed to update job application." }, { status: 500 });
  }
}
