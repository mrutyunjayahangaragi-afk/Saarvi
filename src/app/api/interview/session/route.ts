import { NextRequest, NextResponse } from "next/server";
import { interviewService } from "@/lib/services/interviewService";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  enforceRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedNotificationUser(req);
  const rateLimit = enforceRateLimit(req, "interviewSession", user?.id);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: "Session ID is required." },
      { status: 400 }
    );
  }

  const session = await interviewService.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Session not found." },
      { status: 404 }
    );
  }

  // Session ownership check
  if (user && session.userId !== "guest" && session.userId !== user.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: You do not have permission to view this interview session." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    success: true,
    session,
  });
  return withRateLimitHeaders(response, rateLimit);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedNotificationUser(req);
    const userId = user?.id || "guest";
    const userEmail = user?.email || "guest@saarvi.app";

    const rateLimit = enforceRateLimit(req, "interviewSession", user?.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await req.json();
    const { action } = body;

    // Validate session ownership for session-specific actions
    if (body.sessionId) {
      const existingSession = await interviewService.getSession(body.sessionId);
      if (!existingSession) {
        return NextResponse.json(
          { success: false, error: "Interview session not found." },
          { status: 404 }
        );
      }
      if (user && existingSession.userId !== "guest" && existingSession.userId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: You do not have permission to modify this interview session." },
          { status: 403 }
        );
      }
    }

    // Determine plan tier
    let planTier: "FREE" | "PRO" = "FREE";
    if (user && isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, role")
          .eq("id", user.id)
          .single();
        if (profile?.plan === "PRO" || profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN") {
          planTier = "PRO";
        }
      } catch {
        // Fallback
      }
    }

    if (action === "start") {
      const { mode, role, company, questionCount, privacyMode, centerId } = body;
      if (!mode || !role) {
        return NextResponse.json(
          { success: false, error: "Mode and role are required to start an interview." },
          { status: 400 }
        );
      }

      const session = await interviewService.createSession({
        userId,
        candidateEmail: userEmail,
        planTier,
        mode,
        role,
        company,
        privacyMode,
        questionCount,
        centerId,
      });

      // If media readiness or recording consent was provided during preflight start
      if (body.recordingConsent !== undefined || body.cameraLabel || body.micLabel) {
        await interviewService.updateSessionMediaReadiness(session.id, {
          cameraReady: body.cameraReady ?? true,
          micReady: body.micReady ?? true,
          recordingConsent: Boolean(body.recordingConsent),
          cameraLabel: body.cameraLabel,
          micLabel: body.micLabel,
        });
      }

      // Set-based question deduplication
      const seenIds = new Set<string>();
      const deduplicatedQuestions = session.questions.filter((q) => {
        if (seenIds.has(q.id)) return false;
        seenIds.add(q.id);
        return true;
      });
      session.questions = deduplicatedQuestions;

      // Hide correct answers from client during active test to prevent devtools inspection
      const sanitizedQuestions = session.questions.map((q) => {
        const { correctAnswer, ...rest } = q;
        return rest;
      });

      const response = NextResponse.json({
        success: true,
        session: {
          ...session,
          questions: sanitizedQuestions,
        },
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "heartbeat") {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: "Session ID is required for heartbeat." },
          { status: 400 }
        );
      }
      await interviewService.recordHeartbeat(sessionId);
      const response = NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "update_media_state") {
      const { sessionId, cameraReady, micReady, recordingConsent, cameraLabel, micLabel } = body;
      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: "Session ID is required." },
          { status: 400 }
        );
      }
      const updated = await interviewService.updateSessionMediaReadiness(sessionId, {
        cameraReady,
        micReady,
        recordingConsent,
        cameraLabel,
        micLabel,
      });
      const response = NextResponse.json({
        success: true,
        session: updated,
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "cancel_session") {
      const { sessionId, reason } = body;
      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: "Session ID is required." },
          { status: 400 }
        );
      }
      const cancelled = await interviewService.cancelSession(sessionId, reason);
      const response = NextResponse.json({
        success: true,
        session: cancelled,
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "submit_answer") {
      const { sessionId, questionId, userAnswer, timeSpentSeconds, isTimeout } = body;
      if (!sessionId || !questionId || userAnswer === undefined) {
        return NextResponse.json(
          { success: false, error: "Missing required parameters for submitting answer." },
          { status: 400 }
        );
      }

      const result = await interviewService.submitResponse({
        sessionId,
        questionId,
        userAnswer,
        timeSpentSeconds: Number(timeSpentSeconds || 0),
        isTimeout: Boolean(isTimeout),
      });

      const response = NextResponse.json({
        success: true,
        session: result.session,
        response: result.response,
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "proctoring_violation") {
      const { sessionId, type, pageVisibilityState } = body;
      if (!sessionId || !type) {
        return NextResponse.json(
          { success: false, error: "Session ID and violation type are required." },
          { status: 400 }
        );
      }

      const result = await interviewService.recordProctoringViolation({
        sessionId,
        type,
        pageVisibilityState,
      });

      const response = NextResponse.json({
        success: true,
        session: result.session,
        terminated: result.terminated,
        warningCount: result.warningCount,
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "record_permission") {
      const { sessionId, permissions } = body;
      if (!sessionId || !permissions) {
        return NextResponse.json(
          { success: false, error: "Session ID and permission states are required." },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        try {
          const supabase = await createClient();
          await supabase.from("interview_permissions").insert({
            id: `perm_${Date.now()}`,
            session_id: sessionId,
            user_id: userId,
            camera_status: permissions.camera || "unavailable",
            microphone_status: permissions.microphone || "unavailable",
            location_status: permissions.location || "unavailable",
            screen_status: permissions.screen || "unavailable",
            consent_status: permissions.consent || "accepted",
            browser_supported: permissions.browserSupported ?? true,
          });
        } catch {
          // memory fallback
        }
      }

      const response = NextResponse.json({ success: true });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "capture_location") {
      const { sessionId, centerId, latitude, longitude, accuracy, timezone } = body;
      if (!sessionId || latitude === undefined || longitude === undefined) {
        return NextResponse.json(
          { success: false, error: "Session ID and coordinates are required." },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        try {
          const supabase = await createClient();
          await supabase.from("interview_locations").insert({
            id: `loc_${Date.now()}`,
            session_id: sessionId,
            center_id: centerId,
            user_id: userId,
            consent_status: "granted",
            latitude,
            longitude,
            accuracy,
            timezone: timezone || "Asia/Kolkata",
          });
        } catch {
          // memory fallback
        }
      }

      const response = NextResponse.json({ success: true });
      return withRateLimitHeaders(response, rateLimit);
    }

    return NextResponse.json(
      { success: false, error: `Invalid interview action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal interview session error.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
