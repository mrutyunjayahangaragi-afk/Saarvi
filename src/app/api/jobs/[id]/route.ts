import { NextRequest, NextResponse } from "next/server";
import { jobSearchService } from "@/lib/jobs/search";
import { getAuthenticatedUser } from "@/lib/security/auth-session";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  // 1. Mandatory Server-Side Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to view opportunity details." },
      { status: 401 }
    );
  }

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid job ID provided." }, { status: 400 });
  }

  try {
    const job = await jobSearchService.getJobById(id);

    if (!job) {
      return NextResponse.json({ error: "Job listing not found or expired." }, { status: 404 });
    }

    return NextResponse.json({ job }, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (err: any) {
    console.error(`[GET /api/jobs/${id}] Error:`, err);
    return NextResponse.json({ error: "Failed to fetch job details." }, { status: 500 });
  }
}
