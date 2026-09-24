import { NextRequest, NextResponse } from "next/server";
import { jobAlertsStore } from "@/lib/jobs/alerts";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { getUserEntitlement } from "@/lib/billing/entitlements";
import { JobsFeatureControl } from "@/lib/jobs/feature-control";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Mandatory Server-Side Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to access job alerts." },
      { status: 401 }
    );
  }

  // 2. Feature Control Check
  const entitlement = await getUserEntitlement(authUser.id);
  const access = JobsFeatureControl.evaluateAccess(authUser, entitlement);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason || "Jobs & Internships is currently unavailable." },
      { status: 403 }
    );
  }

  // 3. Strict IDOR Defense: Only return alerts belonging to the authenticated session user
  const alerts = jobAlertsStore.getAlertsByUser(authUser.id);
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  // 1. Mandatory Server-Side Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to create job alerts." },
      { status: 401 }
    );
  }

  const clientIp = getClientIp(req);
  const rateLimitResult = enforceRateLimit(req, "publicWrite", `jobs:alert:${clientIp}`);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please retry later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { title, keywords, location, employmentType, frequency, emailNotifications, inAppNotifications } = body;

    if (!title || !keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "Missing required fields: title and keywords array are required." },
        { status: 400 }
      );
    }

    // Strict user isolation: Use server authenticated authUser.id
    const alert = jobAlertsStore.createAlert({
      userId: authUser.id,
      title: String(title),
      keywords: keywords.map(String),
      location: location ? String(location) : undefined,
      employmentType: employmentType ? String(employmentType) : undefined,
      frequency: frequency === "weekly" ? "weekly" : "daily",
      emailNotifications: emailNotifications !== false,
      inAppNotifications: inAppNotifications !== false,
    });

    return NextResponse.json({
      success: true,
      message: "Job alert created successfully.",
      alert,
    });
  } catch (err: any) {
    console.error("[POST /api/jobs/alerts] Error:", err);
    return NextResponse.json({ error: "Failed to create job alert." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const userId = searchParams.get("userId");

  if (!id || !userId) {
    return NextResponse.json({ error: "id and userId parameters are required." }, { status: 400 });
  }

  const deleted = jobAlertsStore.deleteAlert(id, userId);
  return NextResponse.json({ success: deleted });
}
