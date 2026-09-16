import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";
import { interviewService } from "@/lib/services/interviewService";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedNotificationUser(req);
    const settings = interviewService.getSettings();

    // 1. Policy check: Is mock interview system enabled?
    if (!settings.interviewEnabled) {
      return NextResponse.json({
        eligible: false,
        reason: "Mock Interview system is temporarily undergoing scheduled maintenance.",
        settings,
      });
    }

    // 2. Authentication check: Registration required?
    if (settings.registrationRequired && !authUser) {
      return NextResponse.json({
        eligible: false,
        requiresLogin: true,
        reason: "Registration and sign-in are required to access Mock Interview 2.0.",
        settings,
      });
    }

    const userId = authUser?.id || "guest";
    const userEmail = authUser?.email || "guest@saarvi.app";

    // 3. Email Verification check
    let emailVerified = true;
    let userPlan: "FREE" | "PRO" = "FREE";

    if (authUser && isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          emailVerified = Boolean(user.email_confirmed_at);
          // Check profile for plan
          const { data: profile } = await supabase
            .from("profiles")
            .select("plan, role")
            .eq("id", user.id)
            .single();

          if (profile?.plan === "PRO" || profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN") {
            userPlan = "PRO";
          }
        }
      } catch {
        // Fallback safely
      }
    }

    if (settings.emailVerificationRequired && authUser && !emailVerified) {
      return NextResponse.json({
        eligible: false,
        requiresEmailVerification: true,
        reason: "Please verify your email address before starting an interview session.",
        settings,
      });
    }

    // 4. Plan Access Rule: Free vs Pro
    if (userPlan === "FREE" && !settings.freeAccessAllowed) {
      return NextResponse.json({
        eligible: false,
        requiresPro: true,
        reason: "Mock Interview 2.0 is currently restricted to Saarvi Pro members.",
        planTier: userPlan,
        settings,
      });
    }

    // 5. Attempt Limit Check
    const attemptLimit = userPlan === "PRO" ? 50 : 3; // Free tier default 3 per day
    const attemptsUsed = await interviewService.getUserDailyAttempts(userId);
    const attemptsRemaining = Math.max(0, attemptLimit - attemptsUsed);

    if (attemptsRemaining <= 0) {
      return NextResponse.json({
        eligible: false,
        reason: `You have reached the daily attempt limit (${attemptLimit} interviews). Upgrade to Pro or try again tomorrow.`,
        planTier: userPlan,
        attemptsRemaining: 0,
        settings,
      });
    }

    return NextResponse.json({
      eligible: true,
      userId,
      userEmail,
      emailVerified,
      planTier: userPlan,
      attemptsRemaining,
      settings,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error checking interview eligibility.";
    return NextResponse.json(
      { eligible: false, error: errorMsg },
      { status: 500 }
    );
  }
}
