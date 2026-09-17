import { NextResponse } from "next/server";
import { checkGeminiHealth } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

/**
 * Public Safe AI Health Check Endpoint.
 * Never leaks API keys, headers, or secrets.
 */
export async function GET() {
  try {
    const health = await checkGeminiHealth();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...health,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        provider: "gemini",
        status: "offline",
        latencyMs: 0,
        message: "AI service configuration check failed.",
      },
      { status: 500 }
    );
  }
}
