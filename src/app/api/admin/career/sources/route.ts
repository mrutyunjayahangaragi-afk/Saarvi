import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const sources = opportunityStore.getAllSourceHealth();
    return NextResponse.json({ success: true, sources });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to load source health" }, { status: 500 });
  }
}
