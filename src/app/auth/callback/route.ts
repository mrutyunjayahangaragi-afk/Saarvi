import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { sanitizeInternalRedirectUrl } from '@/lib/security/url-security';
import { UserOnboardingService } from '@/lib/services/user-onboarding-service';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');

  // Strictly sanitize the redirect destination to prevent open-redirect attacks
  const safeNext = sanitizeInternalRedirectUrl(rawNext, '/dashboard');

  // Handle OAuth provider error or user cancellation
  if (oauthError) {
    const isCancelled = oauthError === 'access_denied' || (oauthErrorDescription && oauthErrorDescription.toLowerCase().includes('cancel'));
    const userMessage = isCancelled
      ? 'Google authentication was cancelled.'
      : 'Google authentication could not be completed. Please try again.';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(userMessage)}`);
  }

  // Live Supabase OAuth Code Exchange
  if (code && isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Trigger centralized idempotent user onboarding service (Google OAuth)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.email) {
            await UserOnboardingService.initializeNewSaarviUser({
              id: user.id,
              email: user.email,
              fullName: user.user_metadata?.full_name || user.user_metadata?.name || '',
              avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
            });
          }
        } catch (onboardErr) {
          console.warn('[AuthCallback] Non-blocking onboarding initialization notice:', onboardErr);
        }
        const forwardedHost = request.headers.get('x-forwarded-host');
        const isLocalEnv = process.env.NODE_ENV === 'development';
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
        let configuredHost: string | null = null;
        if (siteUrl) {
          try {
            configuredHost = new URL(siteUrl).host;
          } catch {}
        }

        const allowedHosts = new Set([
          'saarvi.in',
          'www.saarvi.in',
          'saarvi.app',
          'www.saarvi.app',
          ...(configuredHost ? [configuredHost] : []),
        ]);

        const isAllowedHost =
          forwardedHost &&
          (allowedHosts.has(forwardedHost) || forwardedHost.endsWith('.vercel.app'));

        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${safeNext}`);
        } else if (isAllowedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
        } else {
          return NextResponse.redirect(`${origin}${safeNext}`);
        }
      }
    } catch {
      // Exchange failed gracefully without leaking internal details
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Authentication session could not be established. Please try again.')}`
      );
    }
  }

  // Fallback to login with sanitized error message
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Invalid or expired authentication link.')}`
  );
}
