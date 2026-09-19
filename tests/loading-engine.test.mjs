import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { dataClient } from "../src/lib/data/data-client.ts";

const ROOT_DIR = process.cwd();

// =========================================================================
// 1. DATA CLIENT & CACHE ENGINE TESTS
// =========================================================================

test("Data Client — Generates account-scoped cache keys", () => {
  const keyGuest = dataClient.getCacheKey("/api/notifications", null, "notifications");
  const keyUser1 = dataClient.getCacheKey("/api/notifications", "usr_1", "notifications");
  const keyUser2 = dataClient.getCacheKey("/api/notifications", "usr_2", "notifications");

  assert.strictEqual(keyGuest, "notifications:guest:/api/notifications");
  assert.strictEqual(keyUser1, "notifications:usr_1:/api/notifications");
  assert.strictEqual(keyUser2, "notifications:usr_2:/api/notifications");
  assert.notStrictEqual(keyUser1, keyUser2, "User cache keys must never collide");
});

test("Data Client — Request Deduplication coalesces simultaneous calls into one network request", async () => {
  let networkCallCount = 0;

  const mockFetcher = async () => {
    networkCallCount++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { notifications: [{ id: "n1", title: "Test Notification" }] };
  };

  dataClient.invalidate(); // Clear cache

  // Dispatch 3 identical requests simultaneously
  const [res1, res2, res3] = await Promise.all([
    dataClient.fetch("/test/dedup", mockFetcher, { userId: "user_dedup", ttlMs: 5000 }),
    dataClient.fetch("/test/dedup", mockFetcher, { userId: "user_dedup", ttlMs: 5000 }),
    dataClient.fetch("/test/dedup", mockFetcher, { userId: "user_dedup", ttlMs: 5000 }),
  ]);

  assert.strictEqual(networkCallCount, 1, "Simultaneous identical requests must only trigger 1 network call");
  assert.deepStrictEqual(res1.data, res2.data);
  assert.deepStrictEqual(res2.data, res3.data);
});

test("Data Client — Account-Scoped Cache Isolation prevents User A data appearing for User B", async () => {
  dataClient.invalidate();

  const fetcherUserA = async () => ({ user: "A", secret: "data_for_user_A" });
  const fetcherUserB = async () => ({ user: "B", secret: "data_for_user_B" });

  const resA = await dataClient.fetch("/profile", fetcherUserA, { userId: "user_A", ttlMs: 10000 });
  const resB = await dataClient.fetch("/profile", fetcherUserB, { userId: "user_B", ttlMs: 10000 });

  assert.strictEqual(resA.data.user, "A");
  assert.strictEqual(resB.data.user, "B");
  assert.notStrictEqual(resA.data.secret, resB.data.secret);
});

test("Data Client — Timeout Protection aborts hanging requests safely", async () => {
  dataClient.invalidate();

  const hangingFetcher = async (signal) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({ done: true });
      }, 5000);

      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Request timed out as expected"));
      });
    });
  };

  await assert.rejects(
    async () => {
      await dataClient.fetch("/test/timeout", hangingFetcher, {
        userId: "user_timeout",
        timeoutMs: 100, // Short timeout for test
      });
    },
    /timed out/i,
    "Hanging request must be aborted by timeout"
  );
});

test("Data Client — Mutate optimistically updates cached data immediately", async () => {
  dataClient.invalidate();

  await dataClient.fetch("/test/mutate", async () => ({ count: 1 }), { userId: "user_m", ttlMs: 10000 });

  // Optimistic update
  dataClient.mutate("/test/mutate", { count: 2 }, "user_m");

  const cached = await dataClient.fetch("/test/mutate", async () => ({ count: 99 }), { userId: "user_m" });
  assert.strictEqual(cached.data.count, 2, "Mutate must update cached value without network call");
});

test("Data Client — ClearUserSession resets private cache on logout", async () => {
  dataClient.invalidate();

  await dataClient.fetch("/private", async () => ({ token: "123" }), { userId: "user_logout", ttlMs: 10000 });
  dataClient.clearUserSession("user_logout");

  let freshCalled = false;
  await dataClient.fetch("/private", async () => {
    freshCalled = true;
    return { token: "new_token" };
  }, { userId: "user_logout" });

  assert.strictEqual(freshCalled, true, "Cleared user session must force a fresh fetch");
});

// =========================================================================
// 2. NOTIFICATIONS PAGE ARCHITECTURE & UI SHELL INVARIANTS
// =========================================================================

test("Notifications Page — Contains Immediate UI Shell and S-Logo Loading Integration", () => {
  const notifPagePath = path.join(ROOT_DIR, "src/app/notifications/page.tsx");
  assert.ok(fs.existsSync(notifPagePath), "notifications page.tsx must exist");
  const content = fs.readFileSync(notifPagePath, "utf-8");

  // Immediate UI Shell Invariants
  assert.ok(content.includes("<Navbar />"), "Navbar must render in immediate UI shell");
  assert.ok(content.includes("<Footer />"), "Footer must render in immediate UI shell");
  assert.ok(content.includes("Saarvi Notification Center"), "Page title must render in immediate UI shell");
  assert.ok(content.includes("CATEGORY_TABS"), "Category tabs must render in immediate UI shell");

  // Section-Level S-Logo Loading
  assert.ok(content.includes("SaarviLoadingLogo"), "Must import and render SaarviLoadingLogo in content area");
  assert.ok(content.includes("useDataFetch"), "Must use useDataFetch for SWR and deduplication");

  // Guaranteed Exit States
  assert.ok(content.includes("You're all caught up") || content.includes("You&apos;re all caught up"), "Must have empty state");
  assert.ok(content.includes("We couldn't load your notifications") || content.includes("We couldn&apos;t load your notifications"), "Must have error state");
  assert.ok(content.includes("Retry notifications"), "Must have retry action");
  assert.ok(content.includes("Sign in to view your notifications"), "Must have unauthenticated guest state");
});

test("Root Loading Boundary — loading.tsx contains timeout fallback and non-destructive layout", () => {
  const loadingPath = path.join(ROOT_DIR, "src/app/loading.tsx");
  assert.ok(fs.existsSync(loadingPath));
  const content = fs.readFileSync(loadingPath, "utf-8");

  assert.ok(content.includes("SaarviLoadingLogo"), "Must use SaarviLoadingLogo");
  assert.ok(content.includes("setTimeout"), "Must have timeout protection");
  assert.ok(content.includes("Saarvi is preparing your workspace..."));
});
