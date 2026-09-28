import { NextRequest, NextResponse } from "next/server";
import { POST as careerDiscoverPost } from "@/app/api/admin/career/discover/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/jobs/discover
 * Canonical route alias forwarding to admin career discovery engine.
 */
export async function POST(req: NextRequest) {
  return careerDiscoverPost(req);
}
