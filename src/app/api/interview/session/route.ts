import { NextRequest, NextResponse } from "next/server";
import { interviewService } from "@/lib/services/interviewService";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

  return NextResponse.json({
    success: true,
    session,
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedNotificationUser(req);
    const userId = user?.id || "guest";
    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      const { mode, role, company, questionCount } = body;
      if (!mode || !role) {
        return NextResponse.json(
          { success: false, error: "Mode and role are required to start an interview." },
          { status: 400 }
        );
      }

      const session = await interviewService.createSession({
        userId,
        mode,
        role,
        company,
        questionCount,
      });

      // Hide correct answers from client during session to prevent client-side inspection
      const sanitizedQuestions = session.questions.map((q) => {
        const { correctAnswer, ...rest } = q;
        return rest;
      });

      return NextResponse.json({
        success: true,
        session: {
          ...session,
          questions: sanitizedQuestions,
        },
      });
    }

    if (action === "submit_answer") {
      const { sessionId, questionId, userAnswer, timeSpentSeconds } = body;
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
      });

      return NextResponse.json({
        success: true,
        session: result.session,
        response: result.response,
      });
    }

    if (action === "proctoring_violation") {
      const { sessionId, type } = body;
      if (!sessionId || !type) {
        return NextResponse.json(
          { success: false, error: "Session ID and violation type are required." },
          { status: 400 }
        );
      }

      const result = await interviewService.recordProctoringViolation({
        sessionId,
        type,
      });

      return NextResponse.json({
        success: true,
        session: result.session,
        terminated: result.terminated,
        warningCount: result.warningCount,
      });
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
