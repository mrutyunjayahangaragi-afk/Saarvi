import { NextRequest, NextResponse } from "next/server";
import { interviewService, SEEDED_QUESTIONS } from "@/lib/services/interviewService";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedNotificationUser(req);
    // Role check: in production ensure ADMIN or SUPER_ADMIN
    const questions = await interviewService.getQuestions({ count: 100 });
    const settings = interviewService.getSettings();
    const liveSessions = await interviewService.getLiveSessions();
    const questionAnalytics = await interviewService.getQuestionAnalytics();
    const centers = interviewService.getCenters();

    return NextResponse.json({
      success: true,
      questions: questions.length > 0 ? questions : SEEDED_QUESTIONS,
      settings,
      liveSessions,
      questionAnalytics,
      centers,
      totalQuestions: (questions.length > 0 ? questions : SEEDED_QUESTIONS).length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal admin interview error.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedNotificationUser(req);
    const body = await req.json();
    const { action } = body;

    if (action === "upsert_question") {
      const { question } = body;
      if (!question || !question.id || !question.role || !question.question) {
        return NextResponse.json(
          { success: false, error: "Question must have valid id, role, and text." },
          { status: 400 }
        );
      }
      const saved = await interviewService.upsertQuestion(question);
      return NextResponse.json({ success: true, question: saved });
    }

    if (action === "update_settings") {
      const { settings } = body;
      const updated = interviewService.updateSettings(settings || {});
      return NextResponse.json({ success: true, settings: updated });
    }

    if (action === "upsert_center") {
      const { center } = body;
      if (!center || !center.id || !center.centerName) {
        return NextResponse.json(
          { success: false, error: "Center must have valid id and centerName." },
          { status: 400 }
        );
      }
      const saved = interviewService.upsertCenter(center);
      return NextResponse.json({ success: true, center: saved });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported admin action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Admin action execution failed.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
