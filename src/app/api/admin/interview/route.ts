import { NextRequest, NextResponse } from "next/server";
import { interviewService, SEEDED_QUESTIONS } from "@/lib/services/interviewService";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedNotificationUser(req);
    const { searchParams } = new URL(req.url);

    const questions = await interviewService.getQuestions({ count: 100 });
    const settings = interviewService.getSettings();
    const liveSessions = await interviewService.getLiveSessions();
    const questionAnalytics = await interviewService.getQuestionAnalytics();
    const centers = interviewService.getCenters();
    const dashboardMetrics = await interviewService.getDashboardMetrics();

    // Query admin sessions with filters
    const status = searchParams.get("status") || undefined;
    const recordingStatus = searchParams.get("recordingStatus") || undefined;
    const mode = searchParams.get("mode") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 25);

    const sessionsResult = await interviewService.getAdminSessions({
      status,
      recordingStatus,
      mode,
      search,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      questions: questions.length > 0 ? questions : SEEDED_QUESTIONS,
      settings,
      liveSessions,
      questionAnalytics,
      centers,
      dashboardMetrics,
      sessions: sessionsResult.sessions,
      totalSessions: sessionsResult.total,
      page: sessionsResult.page,
      pageSize: sessionsResult.pageSize,
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

    if (action === "import_questions") {
      const { questions } = body;
      if (!Array.isArray(questions) || questions.length === 0) {
        return NextResponse.json(
          { success: false, error: "Valid questions array is required." },
          { status: 400 }
        );
      }

      let importedCount = 0;
      for (const q of questions) {
        if (q.question && (q.role || q.category)) {
          await interviewService.upsertQuestion({
            id: q.id || `q_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            role: q.role || "Software Engineer",
            type: (q.type === "behavioral" || q.type === "technical_coding" || q.type === "communication" ? q.type : "mcq") as any,
            difficulty: q.difficulty || "Medium",
            company: (["Google", "Microsoft", "Amazon", "Infosys", "TCS", "Wipro", "Accenture"].includes(q.company) ? q.company : "General") as any,
            topic: q.topic || "Core Engineering",
            subtopic: q.subtopic || "Placement Preparation",
            category: q.category || "Technical",
            question: q.question.trim(),
            options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
            explanation: q.explanation || "Standard interview question assessment rubric.",
            timeLimitSeconds: q.timeLimitSeconds || 60,
            exposureCount: 0,
            sourceName: q.sourceName || "Curated Dataset",
            sourceType: "Reported interview question",
            isFree: q.isFree !== false,
            isPro: true,
            isActive: true,
          });
          importedCount++;
        }
      }

      return NextResponse.json({ success: true, count: importedCount });
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

    if (action === "delete_recording") {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: "Session ID is required to delete recording." },
          { status: 400 }
        );
      }
      const deleted = await interviewService.deleteRecording(sessionId);
      return NextResponse.json({ success: true, session: deleted });
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
      return NextResponse.json({ success: true, session: cancelled });
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
