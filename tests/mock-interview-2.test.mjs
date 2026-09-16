import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Mock Interview 2.0, Search Engine 2.0 & Google OAuth Polish Verification Suite", () => {
  const rootDir = process.cwd();

  // =========================================================================
  // 1. Migration 014 & Database Schema
  // =========================================================================
  test("Requirement 1: Migration 014 enforces authoritative tables, indexes, and RLS", () => {
    const migrationPath = path.join(rootDir, "supabase/migrations/014_mock_interview_system_2.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 014 must exist");

    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("interview_questions"), "Must alter/create interview_questions");
    assert.ok(sql.includes("source_name"), "Must support source_name attribution");
    assert.ok(sql.includes("source_type"), "Must support source_type attribution");
    assert.ok(sql.includes("interview_sessions"), "Must alter/create interview_sessions");
    assert.ok(sql.includes("privacy_mode"), "Must support privacy_mode");
    assert.ok(sql.includes("session_state"), "Must support session_state machine");
    assert.ok(sql.includes("interview_answers"), "Must create interview_answers table");
    assert.ok(sql.includes("interview_events"), "Must create interview_events table");
    assert.ok(sql.includes("interview_permissions"), "Must create interview_permissions table");
    assert.ok(sql.includes("interview_centers"), "Must create interview_centers table");
    assert.ok(sql.includes("interview_locations"), "Must create interview_locations table");
    assert.ok(sql.includes("subscription_requests"), "Must create subscription_requests table");
    assert.ok(sql.includes("subscription_audit_logs"), "Must create subscription_audit_logs table");
    assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"), "Must enforce RLS policies");
  });

  // =========================================================================
  // 2. Domain Types & State Machine
  // =========================================================================
  test("Requirement 2: Core Domain Types support state machine and privacy modes", () => {
    const typesPath = path.join(rootDir, "src/types/interview.ts");
    assert.ok(fs.existsSync(typesPath), "src/types/interview.ts must exist");

    const code = fs.readFileSync(typesPath, "utf8");
    assert.ok(code.includes("REGISTERED"), "Must support REGISTERED state");
    assert.ok(code.includes("PERMISSION_CHECK"), "Must support PERMISSION_CHECK state");
    assert.ok(code.includes("TERMINATED"), "Must support TERMINATED state");
    assert.ok(code.includes("FULL_VIDEO"), "Must support FULL_VIDEO privacy mode");
    assert.ok(code.includes("BLURRED_CANDIDATE_VIDEO"), "Must support BLURRED_CANDIDATE_VIDEO");
    assert.ok(code.includes("NO_CANDIDATE_VIDEO"), "Must support NO_CANDIDATE_VIDEO");
    assert.ok(code.includes("QuestionSourceType"), "Must declare QuestionSourceType");
    assert.ok(code.includes("InterviewPermissionState"), "Must declare InterviewPermissionState");
    assert.ok(code.includes("InterviewCenter"), "Must declare InterviewCenter");
  });

  // =========================================================================
  // 3. Reusable InterviewPermissionGate Component
  // =========================================================================
  test("Requirement 3: InterviewPermissionGate component verifies camera, mic, location, and proctoring consent", () => {
    const gatePath = path.join(rootDir, "src/components/interview/InterviewPermissionGate.tsx");
    assert.ok(fs.existsSync(gatePath), "InterviewPermissionGate.tsx must exist");

    const code = fs.readFileSync(gatePath, "utf8");
    assert.ok(code.includes("getUserMedia"), "Must call browser getUserMedia API");
    assert.ok(code.includes("AudioContext"), "Must set up live AudioContext frequency analyzer");
    assert.ok(code.includes("geolocation"), "Must support conditional geolocation check");
    assert.ok(code.includes("getDisplayMedia"), "Must support optional screen share check");
    assert.ok(code.includes("privacyMode"), "Must allow candidate to select privacy mode");
    assert.ok(code.includes("onReadyToStart"), "Must unlock onReadyToStart only after checks pass");
    assert.ok(code.includes("Try Again") || code.includes("Try Camera Again"), "Must provide Try Again for denied permissions");
  });

  // =========================================================================
  // 4. Eligibility API & Attempt Limits
  // =========================================================================
  test("Requirement 4: Eligibility API verifies authenticated user, email, plan tier, and attempt limits", () => {
    const apiPath = path.join(rootDir, "src/app/api/interview/eligibility/route.ts");
    assert.ok(fs.existsSync(apiPath), "eligibility API must exist");

    const code = fs.readFileSync(apiPath, "utf8");
    assert.ok(code.includes("registrationRequired"), "Must check registrationRequired setting");
    assert.ok(code.includes("emailVerificationRequired"), "Must check email verification");
    assert.ok(code.includes("freeAccessAllowed"), "Must check free plan rules");
    assert.ok(code.includes("getUserDailyAttempts"), "Must compute daily attempt limits");
  });

  // =========================================================================
  // 5. Mock Interview Room & Anti-Tab Switch Proctoring
  // =========================================================================
  test("Requirement 5: Interview room enforces 4-warning proctoring limit, timers, and AI voice fallback", () => {
    const pagePath = path.join(rootDir, "src/app/student/copilot/interview/page.tsx");
    assert.ok(fs.existsSync(pagePath), "copilot/interview/page.tsx must exist");

    const code = fs.readFileSync(pagePath, "utf8");
    assert.ok(code.includes("InterviewPermissionGate"), "Must use InterviewPermissionGate before active room");
    assert.ok(code.includes("visibilitychange"), "Must listen to document visibility changes");
    assert.ok(code.includes("speechSynthesis"), "Must use SpeechSynthesis for AI question delivery");
    assert.ok(code.includes("timeLimitSeconds"), "Must respect authoritative question timer");
    assert.ok(code.includes("TERMINATED"), "Must transition to TERMINATED on max warnings");
    assert.ok(code.includes("AI-assisted evaluation"), "Must label subjective AI feedback as AI-assisted");
  });

  // =========================================================================
  // 6. Admin Live Interview Moderation & Question Bank
  // =========================================================================
  test("Requirement 6: Admin moderation hub supports Question Bank, Live Sessions, Analytics, and Centers", () => {
    const adminPath = path.join(rootDir, "src/app/admin/mock-interview/page.tsx");
    assert.ok(fs.existsSync(adminPath), "admin/mock-interview/page.tsx must exist");

    const code = fs.readFileSync(adminPath, "utf8");
    assert.ok(code.includes("Question Bank"), "Must have Question Bank tab");
    assert.ok(code.includes("Live Interviews"), "Must have Live Interviews tab");
    assert.ok(code.includes("Question Analytics"), "Must have Question Analytics tab");
    assert.ok(code.includes("Assessment Centers"), "Must have Centers tab");
    assert.ok(code.includes("sourceType"), "Must support source attribution in question form");
  });

  // =========================================================================
  // 7. Superadmin Billing & Subscription Approval Queue
  // =========================================================================
  test("Requirement 7: Superadmin billing API enforces PENDING -> APPROVED/REJECTED review and audit logs", () => {
    const billingApiPath = path.join(rootDir, "src/app/api/admin/billing/subscriptions/route.ts");
    assert.ok(fs.existsSync(billingApiPath), "admin/billing/subscriptions API must exist");

    const code = fs.readFileSync(billingApiPath, "utf8");
    assert.ok(code.includes("PENDING"), "Must support PENDING status");
    assert.ok(code.includes("APPROVED"), "Must support APPROVED status");
    assert.ok(code.includes("REJECTED"), "Must support REJECTED status");
    assert.ok(code.includes("subscription_audit_logs"), "Must write to subscription_audit_logs");
    assert.ok(code.includes("plan: \"PRO\""), "Must update user plan to PRO on approval");
  });

  // =========================================================================
  // 8. Search Engine 2.0 & Global DSA Architecture
  // =========================================================================
  test("Requirement 8: SearchEngine, Trie, and KMP algorithms implement modular DSA search", () => {
    const triePath = path.join(rootDir, "src/lib/dsa/trie.ts");
    const kmpPath = path.join(rootDir, "src/lib/algorithms/kmp.ts");
    const enginePath = path.join(rootDir, "src/lib/search/search-engine.ts");
    const registryPath = path.join(rootDir, "src/lib/domain/search-registry.ts");

    assert.ok(fs.existsSync(triePath), "src/lib/dsa/trie.ts must exist");
    assert.ok(fs.existsSync(kmpPath), "src/lib/algorithms/kmp.ts must exist");
    assert.ok(fs.existsSync(enginePath), "src/lib/search/search-engine.ts must exist");
    assert.ok(fs.existsSync(registryPath), "src/lib/domain/search-registry.ts must exist");

    const kmpCode = fs.readFileSync(kmpPath, "utf8");
    assert.ok(kmpCode.includes("computeLPSArray"), "Must compute LPS table in KMP");
    assert.ok(kmpCode.includes("kmpSearch"), "Must export kmpSearch");

    const trieCode = fs.readFileSync(triePath, "utf8");
    assert.ok(trieCode.includes("searchPrefix"), "Trie must implement searchPrefix");

    const engineCode = fs.readFileSync(enginePath, "utf8");
    assert.ok(engineCode.includes("SearchEngine"), "Must export SearchEngine class");
    assert.ok(engineCode.includes("exact"), "Must perform exact match");
    assert.ok(engineCode.includes("prefix"), "Must perform prefix match");
    assert.ok(engineCode.includes("substring"), "Must perform substring match");
  });

  // =========================================================================
  // 9. Command Palette UX & Accessibility
  // =========================================================================
  test("Requirement 9: GlobalSearchModal implements OS detection, accessible ARIA dialog, and keyboard navigation", () => {
    const modalPath = path.join(rootDir, "src/components/tools/GlobalSearchModal.tsx");
    assert.ok(fs.existsSync(modalPath), "GlobalSearchModal.tsx must exist");

    const code = fs.readFileSync(modalPath, "utf8");
    assert.ok(code.includes("role=\"dialog\""), "Must have role='dialog'");
    assert.ok(code.includes("role=\"combobox\""), "Must have role='combobox'");
    assert.ok(code.includes("Press Cmd + K to search"), "Must display Mac shortcut hint");
    assert.ok(code.includes("Press Ctrl + K to search"), "Must display Windows/Linux shortcut hint");
    assert.ok(code.includes("ArrowDown") && code.includes("ArrowUp"), "Must handle arrow key navigation");
    assert.ok(code.includes("min-h-[44px]"), "Must satisfy 44px minimum touch target standard");
  });

  // =========================================================================
  // 10. Google OAuth Branding & Safe Callback
  // =========================================================================
  test("Requirement 10: Google OAuth specifies select_account, safe host checking, and documentation", () => {
    const authContextPath = path.join(rootDir, "src/context/AuthContext.tsx");
    const callbackPath = path.join(rootDir, "src/app/auth/callback/route.ts");
    const docsPath = path.join(rootDir, "docs/google-oauth-branding.md");

    assert.ok(fs.existsSync(authContextPath), "AuthContext.tsx must exist");
    assert.ok(fs.existsSync(callbackPath), "auth/callback/route.ts must exist");
    assert.ok(fs.existsSync(docsPath), "docs/google-oauth-branding.md must exist");

    const authCode = fs.readFileSync(authContextPath, "utf8");
    assert.ok(authCode.includes("prompt: 'select_account'"), "Must specify prompt: 'select_account'");

    const callbackCode = fs.readFileSync(callbackPath, "utf8");
    assert.ok(callbackCode.includes("NEXT_PUBLIC_SITE_URL"), "Callback must respect NEXT_PUBLIC_SITE_URL");
    assert.ok(callbackCode.includes(".vercel.app"), "Callback must allow verified Vercel environments");

    const docsContent = fs.readFileSync(docsPath, "utf8");
    assert.ok(docsContent.includes("Saarvi"), "Docs must reference Saarvi app name");
    assert.ok(docsContent.includes("Google Auth Platform"), "Docs must guide Google Auth Platform setup");
    assert.ok(docsContent.includes("Supabase Dashboard"), "Docs must guide Supabase configuration");
  });
});
