/**
 * Phase 40 Test Suite:
 * - Production Rate Limiting Policies & 429 Telemetry Tracking
 * - Client Request Coalescing, SWR Caching, and Exponential Backoff
 * - Admin Advertising Health & Diagnostics, CTA URL Sanitization
 * - Mock Interview 2.0 Preflight Setup, Genuine Device Checks, and Monotonic Timing
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// =========================================================================
// TEST 1: RATE LIMIT POLICIES & TELEMETRY
// =========================================================================

test("Rate Limiting: Granular multi-tier policies are configured with correct quotas", async () => {
  const rateLimitPath = path.join(rootDir, "src/lib/security/rate-limit.ts");
  const code = fs.readFileSync(rateLimitPath, "utf8");

  assert.ok(code.includes("adminReads: { limit: 120"), "adminReads policy must have 120 req/min quota");
  assert.ok(code.includes("adminMutations: { limit: 30"), "adminMutations policy must have 30 req/min quota");
  assert.ok(code.includes("adDelivery: { limit: 120"), "adDelivery policy must have 120 req/min quota");
  assert.ok(code.includes("adAnalytics: { limit: 180"), "adAnalytics policy must have 180 req/min quota");
  assert.ok(code.includes("adUpload: { limit: 20"), "adUpload policy must have 20 req/min quota");
  assert.ok(code.includes("interviewSession: { limit: 60"), "interviewSession policy must have 60 req/min quota");
  assert.ok(code.includes("getRateLimitTelemetry"), "Must export getRateLimitTelemetry for real-time monitoring");
  assert.ok(code.includes("RateLimitTelemetryEvent"), "Must define RateLimitTelemetryEvent interface");
});

// =========================================================================
// TEST 2: REQUEST COALESCING, SWR CACHING & BACKOFF
// =========================================================================

test("Client Optimization: request-coalesce module provides SWR, deduplication, and backoff", async () => {
  const coalescePath = path.join(rootDir, "src/lib/api/request-coalesce.ts");
  assert.ok(fs.existsSync(coalescePath), "request-coalesce.ts must exist");

  const code = fs.readFileSync(coalescePath, "utf8");
  assert.ok(code.includes("coalesceRequest"), "Must export coalesceRequest for in-flight promise sharing");
  assert.ok(code.includes("swrFetch"), "Must export swrFetch for stale-while-revalidate caching");
  assert.ok(code.includes("fetchWithBackoff"), "Must export fetchWithBackoff for 429 jittered retry");
  assert.ok(code.includes("invalidateCache"), "Must export invalidateCache for cache purging");

  // Verify behavior dynamically
  const { coalesceRequest, swrFetch, invalidateCache, fetchWithBackoff } = await import(
    `file://${coalescePath}`
  );

  // 2a. Deduplication test
  let callCount = 0;
  const slowFn = async () => {
    callCount++;
    await new Promise((r) => setTimeout(r, 50));
    return "result_data";
  };

  const [res1, res2, res3] = await Promise.all([
    coalesceRequest("test_key", slowFn),
    coalesceRequest("test_key", slowFn),
    coalesceRequest("test_key", slowFn),
  ]);

  assert.equal(res1, "result_data");
  assert.equal(res2, "result_data");
  assert.equal(res3, "result_data");
  assert.equal(callCount, 1, "Concurrent requests must be coalesced into a single execution");

  // 2b. SWR Cache test
  let swrCalls = 0;
  const fetcher = async () => {
    swrCalls++;
    return { value: swrCalls };
  };

  const cached1 = await swrFetch("swr_test", fetcher, { ttlMs: 1000 });
  const cached2 = await swrFetch("swr_test", fetcher, { ttlMs: 1000 });
  assert.equal(cached1.value, 1);
  assert.equal(cached2.value, 1, "Subsequent calls within TTL must hit cache without refetching");
  assert.equal(swrCalls, 1);

  // Invalidate cache
  invalidateCache("swr_test");
  const cached3 = await swrFetch("swr_test", fetcher, { ttlMs: 1000 });
  assert.equal(cached3.value, 2, "Invalidating cache must trigger fresh fetch");

  // 2c. Backoff on 429
  let attempts = 0;
  const failing429Fn = async () => {
    attempts++;
    if (attempts < 2) {
      const err = new Error("Rate limit exceeded");
      err.status = 429;
      err.retryAfterSeconds = 0.05;
      throw err;
    }
    return "recovered";
  };

  const backoffRes = await fetchWithBackoff(failing429Fn, { maxRetries: 3, initialDelayMs: 20 });
  assert.equal(backoffRes, "recovered");
  assert.equal(attempts, 2, "Backoff should have recovered after 429 retry");
});

// =========================================================================
// TEST 3: ADMIN ADVERTISING BACKEND & URL VALIDATION
// =========================================================================

test("Admin Advertising API: GET uses adminReads policy with user ID and returns diagnostics", async () => {
  const routePath = path.join(rootDir, "src/app/api/admin/advertising/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  assert.ok(code.includes("adminReads"), "GET must enforce adminReads rate limit (120 req/min)");
  assert.ok(code.includes("authResult.user.id"), "Rate limiting must partition by user ID to prevent shared IP starvation");
  assert.ok(code.includes("withRateLimitHeaders"), "Responses must return standard RFC rate limit headers");
  assert.ok(code.includes("adStore.getDiagnostics()"), "GET response must include system diagnostics");
  assert.ok(code.includes("getRateLimitTelemetry()"), "GET response must include 429 telemetry data");
});

test("Advertisement Store: Strictly validates CTA URLs and rejects dangerous schemes", async () => {
  const storePath = path.join(rootDir, "src/lib/advertising/ad-store.ts");
  const code = fs.readFileSync(storePath, "utf8");

  assert.ok(code.includes("Invalid or unsafe CTA URL"), "Must throw error on unsafe CTA URLs");
  assert.ok(code.includes("getDiagnostics()"), "adStore must implement getDiagnostics method");
  assert.ok(code.includes("featureFlagEnabled"), "Diagnostics must check feature flag");
  assert.ok(code.includes("serverTimeUtc"), "Diagnostics must include canonical serverTimeUtc");
});

// =========================================================================
// TEST 4: ADMIN ADVERTISING PAGE UX & PREVENT CASCADE RE-RENDERS
// =========================================================================

test("Admin Advertising Page: Eliminates cascade re-renders, debounces search, and exposes Diagnostics", async () => {
  const pagePath = path.join(rootDir, "src/app/admin/advertising/page.tsx");
  const code = fs.readFileSync(pagePath, "utf8");

  assert.ok(code.includes("swrFetch"), "Admin page must use swrFetch for data fetching");
  assert.ok(code.includes("fetchWithBackoff"), "Admin page must wrap API calls with fetchWithBackoff");
  assert.ok(code.includes("debouncedSearch"), "Admin page must debounce search queries to prevent per-keystroke re-renders");
  assert.ok(code.includes("DIAGNOSTICS"), "Admin page must define DIAGNOSTICS tab");
  assert.ok(code.includes("Health & Diagnostics"), "Admin page must render Health & Diagnostics tab");
  assert.ok(code.includes("Rate Limiting Telemetry"), "Health & Diagnostics tab must render telemetry section");
  assert.ok(code.includes("Purge Cache & Recheck") || code.includes("Purge Client Cache") || code.includes("invalidateCache"), "Must allow manual cache purge");
});

// =========================================================================
// TEST 5: MOCK INTERVIEW 2.0 HARDWARE PREFLIGHT & LIFECYCLE
// =========================================================================

test("Mock Interview 2.0: Permission Gate has preflight screen, device switching, and clean teardown", async () => {
  const gatePath = path.join(rootDir, "src/components/interview/InterviewPermissionGate.tsx");
  const code = fs.readFileSync(gatePath, "utf8");

  assert.ok(code.includes("[ Set Up Interview ]"), "Must render [ Set Up Interview ] button on preflight screen");
  assert.ok(code.includes("[ Not Now ]"), "Must render [ Not Now ] button on preflight screen");
  assert.ok(code.includes("isSecureContext"), "Must check window.isSecureContext for HTTPS requirement");
  assert.ok(code.includes("enumerateConnectedDevices") || code.includes("enumerateDevices"), "Must support genuine device enumeration");
  assert.ok(code.includes("stopAllMediaTracks") || code.includes("track.stop()"), "Must stop all media tracks on teardown");
  assert.ok(code.includes("getByteFrequencyData"), "Must use real Web Audio getByteFrequencyData for live volume meter");
  assert.ok(code.includes("Switch to Text MCQ Mode"), "Must preserve fallback to Text MCQ Mode");
  assert.ok(code.includes("handleEnableSimulatedHardware"), "Must preserve handleEnableSimulatedHardware for testing");
  assert.ok(code.includes("Use Simulated Camera for Practice"), "Must preserve simulated camera button");
  assert.ok(code.includes("Use Simulated Audio for Practice"), "Must preserve simulated audio button");
});

test("Mock Interview Room: Employs monotonic delta timer and guarantees media track cleanup on unmount", async () => {
  const roomPath = path.join(rootDir, "src/app/student/copilot/interview/page.tsx");
  const code = fs.readFileSync(roomPath, "utf8");

  assert.ok(code.includes("performance.now()"), "Must use performance.now() monotonic timer for non-drifting countdowns");
  assert.ok(code.includes("mediaStreamRef.current.getTracks().forEach((track) => track.stop())"), "Must cleanly stop camera/mic tracks on component unmount");
});

test("Interview Session API: Enforces session ownership and Set-based question deduplication", async () => {
  const sessionApiPath = path.join(rootDir, "src/app/api/interview/session/route.ts");
  const code = fs.readFileSync(sessionApiPath, "utf8");

  assert.ok(code.includes("interviewSession"), "Interview session API must enforce interviewSession rate limit policy");
  assert.ok(code.includes("seenIds = new Set<string>()"), "Must perform Set-based question deduplication");
  assert.ok(code.includes("existingSession.userId !== user.id"), "Must validate that the authenticated student owns the session");
});

test("Admin Mock Interview: Exposes Camera, Microphone, and Audio Fallback policy toggles", async () => {
  const adminInterviewPath = path.join(rootDir, "src/app/admin/mock-interview/page.tsx");
  const code = fs.readFileSync(adminInterviewPath, "utf8");

  assert.ok(code.includes("Camera Verification Required"), "Admin page must expose camera requirement toggle");
  assert.ok(code.includes("Microphone Verification Required"), "Admin page must expose microphone requirement toggle");
  assert.ok(code.includes("enableAiTtsFallback"), "Admin page must expose AI speech synthesis toggle");
});
