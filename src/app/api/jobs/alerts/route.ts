import { NextRequest, NextResponse } from "next/server";
import { jobAlertsStore } from "@/lib/jobs/alerts";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId parameter is required." }, { status: 400 });
  }

  const alerts = jobAlertsStore.getAlertsByUser(userId);
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
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
    const { userId, title, keywords, location, employmentType, frequency, emailNotifications, inAppNotifications } = body;

    if (!userId || !title || !keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, and keywords array are required." },
        { status: 400 }
      );
    }

    const alert = jobAlertsStore.createAlert({
      userId: String(userId),
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
