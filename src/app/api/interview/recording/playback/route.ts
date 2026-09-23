import { NextRequest, NextResponse } from "next/server";
import { interviewService } from "@/lib/services/interviewService";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedNotificationUser(req);
    const rateLimit = enforceRateLimit(req, "interviewSession", user?.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID parameter is required." },
        { status: 400 }
      );
    }

    // Determine user role
    let userRole = "STUDENT";
    if (user && isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role) userRole = profile.role;
      } catch {}
    }

    const userId = user?.id || "guest";
    const result = await interviewService.getRecordingPlaybackUrl(sessionId, userId, userRole);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Recording not found or playback is not authorized for this session.",
        },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      success: true,
      playbackUrl: result.playbackUrl,
      expiresAt: result.expiresAt,
      recordingStatus: result.session.recordingStatus,
      durationSeconds: result.session.recordingDurationSeconds,
      fileSizeBytes: result.session.recordingFileSizeBytes,
      mimeType: result.session.recordingMimeType,
      candidateEmail: result.session.candidateEmail,
      mode: result.session.mode,
      role: result.session.role,
    });
    return withRateLimitHeaders(response, rateLimit);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal recording playback error.";
    console.error("[Recording Playback GET Error]:", err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedNotificationUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to delete recordings." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    let sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      try {
        const body = await req.json();
        sessionId = body.sessionId;
      } catch {}
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required." },
        { status: 400 }
      );
    }

    // Role check
    let userRole = "STUDENT";
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role) userRole = profile.role;
      } catch {}
    }

    const session = await interviewService.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Interview session not found." },
        { status: 404 }
      );
    }

    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
    if (session.userId !== user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not authorized to delete this recording." },
        { status: 403 }
      );
    }

    const deleted = await interviewService.deleteRecording(sessionId);
    return NextResponse.json({
      success: true,
      message: "Recording successfully deleted.",
      session: deleted,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal recording delete error.";
    console.error("[Recording Playback DELETE Error]:", err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
