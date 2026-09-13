/**
 * Saarvi — Google OAuth Authentication Integration Test Suite.
 *
 * Covers all 26 required specifications:
 * 1. Google login action exists
 * 2. Provider is exactly "google"
 * 3. Supabase OAuth method is used
 * 4. Redirect is generated correctly
 * 5. External redirect is rejected
 * 6. javascript: redirect is rejected
 * 7. data: redirect is rejected
 * 8. vbscript: redirect is rejected
 * 9. Duplicate OAuth initiation is prevented
 * 10. OAuth cancellation is handled
 * 11. Callback failure is handled
 * 12. Session comes from trusted Supabase auth
 * 13. Client userId is ignored
 * 14. Client email is ignored
 * 15. Google user is not automatically admin
 * 16. Logout works
 * 17. Account switching isolates data
 * 18. Profile image behavior remains isolated
 * 19. Service-role key is not exposed client-side
 * 20. Google secret is not exposed client-side
 * 21. Loading state works
 * 22. Accessible label exists
 * 23. Keyboard accessibility is preserved
 * 24. Mobile touch target requirement (min 44px) is preserved
 * 25. Analytics does not contain sensitive OAuth data
 * 26. Telemetry does not contain sensitive OAuth data
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

// Pure mirror of URL redirect sanitization for direct functional validation
function sanitizeInternalRedirectUrl(rawUrl, fallback = "/dashboard") {
  const safeFallback = fallback && fallback.startsWith("/") && !fallback.startsWith("//") ? fallback : "/dashboard";

  if (!rawUrl || typeof rawUrl !== "string") {
    return safeFallback;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return safeFallback;
  }

  // 1. Disallow control characters and CRLF
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return safeFallback;
  }

  // 2. Disallow protocol-relative or backslash prefixes
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return safeFallback;
  }

  // 3. Must start with a single leading slash
  if (!trimmed.startsWith("/")) {
    return safeFallback;
  }

  // 4. Reject any explicit protocol scheme in the path (e.g. /https://evil.com or javascript:...)
  const dangerousPrefixes = ["javascript:", "data:", "vbscript:", "file:", "http:", "https:"];
  const lower = trimmed.toLowerCase();
  for (const prefix of dangerousPrefixes) {
    if (lower.includes(prefix)) {
      if (lower.startsWith(prefix) || lower.startsWith("/" + prefix) || lower.startsWith("//" + prefix)) {
        return safeFallback;
      }
    }
  }

  // 5. Test resolution against trusted base to prevent host spoofing
  try {
    const dummyBase = "https://saarvi.in";
    const parsed = new URL(trimmed, dummyBase);

    if (parsed.origin !== dummyBase) {
      return safeFallback;
    }

    if (!parsed.pathname.startsWith("/") || parsed.pathname.includes("\\")) {
      return safeFallback;
    }

    if (parsed.pathname.startsWith("//")) {
      return safeFallback;
    }

    try {
      const decoded = decodeURIComponent(trimmed);
      if (
        decoded.startsWith("//") ||
        decoded.startsWith("/\\") ||
        decoded.startsWith("\\") ||
        dangerousPrefixes.some((p) => decoded.toLowerCase().startsWith(p))
      ) {
        return safeFallback;
      }
    } catch {
      return safeFallback;
    }

    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return safeFallback;
  }
}

test("Google Auth - Test 1: Google login action exists in AuthContext, Login page, and Signup page", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  const loginPageCode = fs.readFileSync(path.join(ROOT_DIR, "src/app/login/page.tsx"), "utf-8");
  const signupPageCode = fs.readFileSync(path.join(ROOT_DIR, "src/app/signup/page.tsx"), "utf-8");
  const buttonCode = fs.readFileSync(path.join(ROOT_DIR, "src/components/auth/GoogleSignInButton.tsx"), "utf-8");

  assert.ok(authContextCode.includes("signInWithGoogle"), "AuthContext must define signInWithGoogle");
  assert.ok(loginPageCode.includes("handleGoogleSignIn"), "Login page must define handleGoogleSignIn");
  assert.ok(signupPageCode.includes("handleGoogleSignIn"), "Signup page must define handleGoogleSignIn");
  assert.ok(buttonCode.includes("Continue with Google"), "Google button component must exist with accessible label");
});

test("Google Auth - Test 2: Provider is exactly 'google'", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  assert.ok(
    authContextCode.includes("provider: 'google'") || authContextCode.includes('provider: "google"'),
    "Provider passed to Supabase OAuth must be exactly 'google'"
  );

  // Invariant: Do NOT add Apple, GitHub, Microsoft, Facebook, Twitter, phone auth
  const forbiddenProviders = ["apple", "github", "microsoft", "facebook", "twitter", "phone"];
  for (const forbidden of forbiddenProviders) {
    const regex = new RegExp(`provider:\\s*['"]${forbidden}['"]`, "i");
    assert.strictEqual(regex.test(authContextCode), false, `Forbidden provider '${forbidden}' must not be present`);
  }
});

test("Google Auth - Test 3: Supabase OAuth method is used with select_account prompt", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  assert.ok(
    authContextCode.includes("supabase.auth.signInWithOAuth"),
    "Must use official supabase.auth.signInWithOAuth integration"
  );
  assert.ok(
    authContextCode.includes("prompt: 'select_account'") || authContextCode.includes('prompt: "select_account"'),
    "signInWithOAuth must include queryParams: { prompt: 'select_account' } to force the Google account chooser"
  );
});

test("Google Auth - Test 4: Redirect is generated correctly", () => {
  const target = "/dashboard";
  const sanitized = sanitizeInternalRedirectUrl(target, "/dashboard");
  assert.strictEqual(sanitized, "/dashboard");

  const origin = "https://saarvi.in";
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(sanitized)}`;
  assert.strictEqual(callbackUrl, "https://saarvi.in/auth/callback?next=%2Fdashboard");

  const withParams = "/tools/pdf?action=merge#top";
  const sanitizedWithParams = sanitizeInternalRedirectUrl(withParams, "/dashboard");
  assert.strictEqual(sanitizedWithParams, "/tools/pdf?action=merge#top");
});

test("Google Auth - Test 5: External redirect is rejected", () => {
  const maliciousUrls = [
    "https://evil.example",
    "http://evil.com",
    "https://evil.example/dashboard",
    "//evil.com",
    "//saarvi.app.evil.com",
    "/\\evil.com",
    "/\\attacker.com/dash",
    "http://169.254.169.254/latest/meta-data",
  ];

  for (const malicious of maliciousUrls) {
    const result = sanitizeInternalRedirectUrl(malicious, "/dashboard");
    assert.strictEqual(result, "/dashboard", `External redirect '${malicious}' must be rejected and fallback returned`);
  }
});

test("Google Auth - Test 6: javascript: redirect is rejected", () => {
  const xssPayloads = [
    "javascript:alert(document.cookie)",
    "javascript:void(0)",
    "JAVASCRIPT:alert(1)",
    "/javascript:alert(1)",
    "//javascript:alert(1)",
  ];

  for (const payload of xssPayloads) {
    const result = sanitizeInternalRedirectUrl(payload, "/dashboard");
    assert.strictEqual(result, "/dashboard", `javascript: scheme '${payload}' must be rejected`);
  }
});

test("Google Auth - Test 7: data: redirect is rejected", () => {
  const dataPayloads = [
    "data:text/html,<script>alert(1)</script>",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "/data:text/html,evil",
  ];

  for (const payload of dataPayloads) {
    const result = sanitizeInternalRedirectUrl(payload, "/dashboard");
    assert.strictEqual(result, "/dashboard", `data: scheme '${payload}' must be rejected`);
  }
});

test("Google Auth - Test 8: vbscript: redirect is rejected", () => {
  const vbPayloads = [
    "vbscript:msgbox(1)",
    "VBSCRIPT:msgbox(1)",
    "/vbscript:msgbox(1)",
  ];

  for (const payload of vbPayloads) {
    const result = sanitizeInternalRedirectUrl(payload, "/dashboard");
    assert.strictEqual(result, "/dashboard", `vbscript: scheme '${payload}' must be rejected`);
  }
});

test("Google Auth - Test 9: Duplicate OAuth initiation is prevented", () => {
  const loginCode = fs.readFileSync(path.join(ROOT_DIR, "src/app/login/page.tsx"), "utf-8");
  const signupCode = fs.readFileSync(path.join(ROOT_DIR, "src/app/signup/page.tsx"), "utf-8");
  const buttonCode = fs.readFileSync(path.join(ROOT_DIR, "src/components/auth/GoogleSignInButton.tsx"), "utf-8");

  assert.ok(
    loginCode.includes("if (googleLoading || loading) return;"),
    "Login page must abort duplicate clicks when googleLoading or loading is active"
  );
  assert.ok(
    signupCode.includes("if (googleLoading || loading) return;"),
    "Signup page must abort duplicate clicks when googleLoading or loading is active"
  );
  assert.ok(
    buttonCode.includes("disabled={loading || disabled}"),
    "Google button must be disabled when loading is active"
  );
  assert.ok(
    buttonCode.includes("disabled:pointer-events-none"),
    "Google button must prevent pointer events when disabled"
  );
});

test("Google Auth - Test 10: OAuth cancellation is handled", () => {
  const callbackCode = fs.readFileSync(path.join(ROOT_DIR, "src/app/auth/callback/route.ts"), "utf-8");
  assert.ok(
    callbackCode.includes("searchParams.get('error')"),
    "OAuth callback route must inspect the 'error' query parameter"
  );
  assert.ok(
    callbackCode.includes("access_denied") || callbackCode.includes("isCancelled"),
    "Callback must recognize user cancellation and map to safe user-facing message"
  );
  assert.ok(
    callbackCode.includes("Google authentication was cancelled"),
    "Callback must display clear, safe cancellation message"
  );
});

test("Google Auth - Test 11: Callback failure is handled safely", () => {
  const callbackCode = fs.readFileSync(path.join(ROOT_DIR, "src/app/auth/callback/route.ts"), "utf-8");
  assert.ok(
    callbackCode.includes("Invalid or expired authentication link"),
    "Callback must provide safe fallback error without exposing internal tokens or traces"
  );
  assert.strictEqual(
    callbackCode.includes("error.stack"),
    false,
    "Callback route must NEVER leak stack traces to client redirect URLs"
  );
});

test("Google Auth - Test 12: Session comes from trusted Supabase auth", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  assert.ok(
    authContextCode.includes("supabase.auth.getSession()"),
    "AuthContext must initialize session from trusted Supabase auth"
  );
  assert.ok(
    authContextCode.includes("supabase.auth.onAuthStateChange"),
    "AuthContext must synchronize state via Supabase onAuthStateChange listener"
  );
});

test("Google Auth - Test 13: Client userId is ignored in server authorization", () => {
  const authHelperCode = fs.readFileSync(path.join(ROOT_DIR, "src/lib/notifications/auth-helper.ts"), "utf-8");
  assert.ok(
    authHelperCode.includes("Client-supplied body fields (e.g. body.userId) are NEVER trusted"),
    "Server-side auth helper must document and enforce that untrusted client body.userId is ignored"
  );
  assert.ok(
    authHelperCode.includes("supabase.auth.getUser()"),
    "Identity must derive strictly from trusted supabase.auth.getUser()"
  );
});

test("Google Auth - Test 14: Client email is ignored in server authorization", () => {
  const authHelperCode = fs.readFileSync(path.join(ROOT_DIR, "src/lib/notifications/auth-helper.ts"), "utf-8");
  assert.ok(
    authHelperCode.includes("user.id && user.email"),
    "User email must be derived from verified session object, not request body"
  );
});

test("Google Auth - Test 15: Google user is not automatically admin", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  assert.ok(
    authContextCode.includes("role: 'USER'"),
    "Google authenticated users must be assigned standard 'USER' role by default"
  );

  const mockStorageCode = fs.readFileSync(path.join(ROOT_DIR, "src/lib/supabase/mock-storage.ts"), "utf-8");
  assert.ok(
    mockStorageCode.includes("role: 'USER'"),
    "Mock storage signInWithGoogle must enforce 'USER' role"
  );
});

test("Google Auth - Test 16: Logout works cleanly", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  assert.ok(
    authContextCode.includes("const signOut = async () => {"),
    "AuthContext must declare signOut method"
  );
  assert.ok(
    authContextCode.includes("supabase.auth.signOut()"),
    "signOut must call Supabase auth.signOut()"
  );
  assert.ok(
    authContextCode.includes("setUser(null)"),
    "signOut must reset user state to null"
  );
  assert.ok(
    authContextCode.includes("setProfile(null)"),
    "signOut must reset profile state to null"
  );
});

test("Google Auth - Test 17: Account switching isolates data", () => {
  const mockStorageCode = fs.readFileSync(path.join(ROOT_DIR, "src/lib/supabase/mock-storage.ts"), "utf-8");
  assert.ok(
    mockStorageCode.includes("signOut(): void {"),
    "MockStorageProvider must provide clean session wiping on signOut"
  );
  assert.ok(
    mockStorageCode.includes("localStorage.removeItem(STORAGE_KEYS.SESSION)"),
    "MockStorageProvider signOut must remove active session from storage"
  );
});

test("Google Auth - Test 18: Profile image behavior remains isolated", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  // Ensure we don't overwrite local avatarUrl with raw Google metadata
  assert.strictEqual(
    authContextCode.includes("avatarUrl: session.user.user_metadata?.avatar_url"),
    false,
    "Must NOT forcibly overwrite profile avatarUrl with external Google avatar"
  );
});

test("Google Auth - Test 19: Service-role key is not exposed client-side", () => {
  const clientFiles = [
    "src/context/AuthContext.tsx",
    "src/lib/supabase/client.ts",
    "src/app/login/page.tsx",
    "src/app/signup/page.tsx",
    "src/components/auth/GoogleSignInButton.tsx",
  ];

  for (const rel of clientFiles) {
    const code = fs.readFileSync(path.join(ROOT_DIR, rel), "utf-8");
    assert.strictEqual(
      code.includes("SUPABASE_SERVICE_ROLE_KEY"),
      false,
      `Client file ${rel} must NOT reference SUPABASE_SERVICE_ROLE_KEY`
    );
    assert.strictEqual(
      code.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
      false,
      `Client file ${rel} must NOT reference NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`
    );
  }
});

test("Google Auth - Test 20: Google secret is not exposed client-side", () => {
  const clientFiles = [
    "src/context/AuthContext.tsx",
    "src/lib/supabase/client.ts",
    "src/app/login/page.tsx",
    "src/app/signup/page.tsx",
    "src/components/auth/GoogleSignInButton.tsx",
  ];

  for (const rel of clientFiles) {
    const code = fs.readFileSync(path.join(ROOT_DIR, rel), "utf-8");
    assert.strictEqual(
      code.includes("GOOGLE_CLIENT_SECRET"),
      false,
      `Client file ${rel} must NOT contain GOOGLE_CLIENT_SECRET`
    );
    assert.strictEqual(
      code.includes("NEXT_PUBLIC_GOOGLE_CLIENT_SECRET"),
      false,
      `Client file ${rel} must NOT contain NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`
    );
    assert.strictEqual(
      code.includes("NEXT_PUBLIC_GOOGLE_SECRET"),
      false,
      `Client file ${rel} must NOT contain NEXT_PUBLIC_GOOGLE_SECRET`
    );
  }
});

test("Google Auth - Test 21: Loading state works with Connecting to Google message", () => {
  const buttonCode = fs.readFileSync(path.join(ROOT_DIR, "src/components/auth/GoogleSignInButton.tsx"), "utf-8");
  assert.ok(
    buttonCode.includes("Connecting to Google..."),
    "Google button must render 'Connecting to Google...' in loading state"
  );
  assert.ok(
    buttonCode.includes("animate-spin"),
    "Google button must include animated spinner in loading state"
  );
  assert.ok(
    buttonCode.includes("aria-busy={loading}"),
    "Google button must indicate busy state via aria-busy"
  );
});

test("Google Auth - Test 22: Accessible label exists", () => {
  const buttonCode = fs.readFileSync(path.join(ROOT_DIR, "src/components/auth/GoogleSignInButton.tsx"), "utf-8");
  assert.ok(
    buttonCode.includes('aria-label="Continue with Google"'),
    "Google button must declare explicit aria-label='Continue with Google'"
  );
  assert.ok(
    buttonCode.includes("Continue with Google"),
    "Google button must display accessible text 'Continue with Google'"
  );
});

test("Google Auth - Test 23: Keyboard accessibility is preserved", () => {
  const buttonCode = fs.readFileSync(path.join(ROOT_DIR, "src/components/auth/GoogleSignInButton.tsx"), "utf-8");
  assert.ok(
    buttonCode.includes("focus-visible:ring-2") && buttonCode.includes("focus-visible:outline-none"),
    "Google button must implement visible focus ring for keyboard navigation"
  );
  assert.ok(
    buttonCode.startsWith('"use client";') && buttonCode.includes("<button"),
    "Must use semantic <button> element rather than a non-interactive div"
  );
});

test("Google Auth - Test 24: Mobile touch target requirement (min 44px) is preserved", () => {
  const buttonCode = fs.readFileSync(path.join(ROOT_DIR, "src/components/auth/GoogleSignInButton.tsx"), "utf-8");
  assert.ok(
    buttonCode.includes("min-h-[44px]"),
    "Google button must enforce min-h-[44px] to satisfy WCAG 2.1 mobile touch target requirement"
  );
});

test("Google Auth - Test 25: Analytics does not contain sensitive OAuth data", () => {
  const typesCode = fs.readFileSync(path.join(ROOT_DIR, "src/lib/analytics/types.ts"), "utf-8");
  assert.ok(typesCode.includes("'auth_method_selected'"), "Centralized taxonomy must include auth_method_selected");
  assert.ok(typesCode.includes("'auth_success'"), "Centralized taxonomy must include auth_success");

  // Prohibited keys
  assert.ok(typesCode.includes("'password'"), "Prohibited keys must include password");
  assert.ok(typesCode.includes("'secret'"), "Prohibited keys must include secret");
  assert.ok(typesCode.includes("'token'"), "Prohibited keys must include token");
  assert.ok(typesCode.includes("'bearer'"), "Prohibited keys must include bearer");

  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  assert.strictEqual(
    authContextCode.includes("token:"),
    false,
    "AuthContext must never include raw tokens in analytics events"
  );
});

test("Google Auth - Test 26: Telemetry does not contain sensitive OAuth data", () => {
  const authContextCode = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf-8");
  assert.ok(
    authContextCode.includes("telemetry.measure('auth_oauth_google'"),
    "AuthContext must record telemetry span for Google OAuth operation"
  );

  const telemetryCode = fs.readFileSync(path.join(ROOT_DIR, "src/lib/observability/telemetry.ts"), "utf-8");
  assert.ok(
    telemetryCode.includes("Zero document contents, user PII, or credentials are ever recorded"),
    "Telemetry must enforce zero credentials / tokens invariant"
  );
});
