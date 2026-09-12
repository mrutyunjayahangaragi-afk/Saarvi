import { NextResponse } from "next/server";
import { getAuditMetrics } from "@/lib/ai/audit";

export async function GET() {
  const metrics = getAuditMetrics();
  return NextResponse.json({
    success: true,
    metrics,
  });
}
