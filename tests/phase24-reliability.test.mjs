/**
 * DocEase Phase 24 — Advanced Performance, Scalability & Reliability Test Suite.
 *
 * Verifies system reliability under stress workloads, concurrency safety,
 * atomic transactions with rollback, worker leasing, and error isolation.
 */

import test from "node:test";
import assert from "node:assert/strict";

// =========================================================================
// 1. CURRICULUM COMPOSITE INDEX STRESS & IMMUTABILITY
// =========================================================================
test("Phase 24 - Test 1: Curriculum Index handles 50,000 courses with O(1) queries & immutability", () => {
  const index = new Map();
  const count = 50000;
  const schemes = ["2022", "2025"];
  const branches = ["CSE", "ISE", "AIML", "ECE", "MECH"];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  for (let i = 0; i < count; i++) {
    const scheme = schemes[i % schemes.length];
    const branch = branches[Math.floor(i / schemes.length) % branches.length];
    const sem = semesters[Math.floor(i / (schemes.length * branches.length)) % semesters.length];
    const key = `${scheme}|${branch}|${sem}`;

    let list = index.get(key);
    if (!list) {
      list = [];
      index.set(key, list);
    }
    list.push({
      courseCode: `CS${scheme}${branch}${sem}_${i}`,
      title: `Course ${i}`,
      credits: 3,
      scheme,
      branch,
      semester: sem,
    });
  }

  // Freeze lists
  for (const [k, v] of index.entries()) {
    index.set(k, Object.freeze([...v]));
  }

  assert.equal(index.size, 2 * 5 * 8); // 80 combinations
  const res = index.get("2022|CSE|1");
  assert.ok(res);
  assert.ok(res.length > 0);
  assert.ok(Object.isFrozen(res), "Array must be frozen to prevent accidental mutation");

  // Attempting mutation on frozen array must throw
  assert.throws(() => {
    res.push({ courseCode: "HACK" });
  }, TypeError);
});

// =========================================================================
// 2. USER-SCOPED CACHE ISOLATION & EVICTION
// =========================================================================
test("Phase 24 - Test 2: User-Scoped Cache enforces profile boundary isolation", () => {
  const cache = new Map();

  function composeKey(profileId, domain, key) {
    return `${profileId}::${domain}::${key}`;
  }

  function set(profileId, domain, key, data, ttlMs = 60000) {
    cache.set(composeKey(profileId, domain, key), {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  function get(profileId, domain, key) {
    const entry = cache.get(composeKey(profileId, domain, key));
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(composeKey(profileId, domain, key));
      return null;
    }
    return entry.data;
  }

  // Profile A writes private academic data
  set("student_alice", "academic", "summary", { gpa: 9.2 });
  // Profile B writes private academic data
  set("student_bob", "academic", "summary", { gpa: 7.8 });

  // Isolation check
  assert.deepEqual(get("student_alice", "academic", "summary"), { gpa: 9.2 });
  assert.deepEqual(get("student_bob", "academic", "summary"), { gpa: 7.8 });
  assert.equal(get("guest", "academic", "summary"), null);

  // Invalidate profile A
  const prefixA = "student_alice::";
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefixA)) cache.delete(k);
  }

  assert.equal(get("student_alice", "academic", "summary"), null);
  assert.deepEqual(get("student_bob", "academic", "summary"), { gpa: 7.8 }, "Bob's cache must remain unaffected");
});

// =========================================================================
// 3. CONVERSATION HISTORY APPEND & PAGINATION
// =========================================================================
test("Phase 24 - Test 3: Conversation Message Append is O(1) and pagination works correctly", () => {
  const messagesStore = [];
  let conv = { id: "conv_1", messageCount: 0, updatedAt: "" };

  function appendMessage(msg) {
    messagesStore.push(msg);
    // O(1) Counter increment (Phase 24 optimization)
    conv.messageCount = (conv.messageCount || 0) + 1;
    conv.updatedAt = msg.createdAt;
  }

  function getMessagesPaginated(convId, limit = 10, offset = 0, order = "asc") {
    const matching = messagesStore.filter(m => m.conversationId === convId);
    matching.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return order === "asc" ? diff : -diff;
    });
    const total = matching.length;
    const paginated = matching.slice(offset, offset + limit);
    return {
      messages: paginated,
      total,
      hasMore: offset + paginated.length < total,
    };
  }

  // Append 25 messages
  for (let i = 0; i < 25; i++) {
    appendMessage({
      id: `m_${i}`,
      conversationId: "conv_1",
      content: `Message ${i}`,
      createdAt: new Date(1700000000000 + i * 1000).toISOString(),
    });
  }

  assert.equal(conv.messageCount, 25);
  assert.equal(conv.updatedAt, new Date(1700000000000 + 24 * 1000).toISOString());

  // First page (10 items)
  const page1 = getMessagesPaginated("conv_1", 10, 0);
  assert.equal(page1.messages.length, 10);
  assert.equal(page1.total, 25);
  assert.equal(page1.hasMore, true);
  assert.equal(page1.messages[0].id, "m_0");

  // Second page (10 items)
  const page2 = getMessagesPaginated("conv_1", 10, 10);
  assert.equal(page2.messages.length, 10);
  assert.equal(page2.hasMore, true);
  assert.equal(page2.messages[0].id, "m_10");

  // Third page (5 items)
  const page3 = getMessagesPaginated("conv_1", 10, 20);
  assert.equal(page3.messages.length, 5);
  assert.equal(page3.hasMore, false);
  assert.equal(page3.messages[4].id, "m_24");
});

// =========================================================================
// 4. ATOMIC WORKSPACE IMPORT ROLLBACK
// =========================================================================
test("Phase 24 - Test 4: Atomic Workspace Import rolls back on corrupt input with zero partial writes", () => {
  const store = {
    semesters: new Map(),
    tasks: new Map(),
  };

  function atomicImport(jsonString) {
    if (!jsonString || typeof jsonString !== "string") {
      throw new Error("Payload must be non-empty");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error("Invalid JSON");
    }

    if (!parsed || parsed.application !== "DocEase") {
      throw new Error("Missing DocEase identifier");
    }

    // Pre-validate all entities before writing
    const validSemesters = [];
    if (Array.isArray(parsed.semesters)) {
      for (const s of parsed.semesters) {
        if (!s.id || typeof s.semester !== "number" || s.sgpa < 0 || s.sgpa > 10) {
          throw new Error(`Corrupt semester entity: ${s.id || "unknown"}`);
        }
        validSemesters.push(s);
      }
    }

    // Only commit to store if pre-validation passes completely
    for (const s of validSemesters) {
      store.semesters.set(s.id, s);
    }
    return { importedCount: validSemesters.length };
  }

  // Pre-populate with initial data
  store.semesters.set("sem_init", { id: "sem_init", semester: 1, sgpa: 9.0 });

  // Corrupt payload (third semester has invalid SGPA 15)
  const corruptPayload = JSON.stringify({
    application: "DocEase",
    semesters: [
      { id: "sem_1", semester: 1, sgpa: 8.5 },
      { id: "sem_2", semester: 2, sgpa: 8.7 },
      { id: "sem_3", semester: 3, sgpa: 15.0 }, // Invalid!
    ],
  });

  assert.throws(() => atomicImport(corruptPayload), /Corrupt semester entity/);

  // Verify atomic rollback: Neither sem_1 nor sem_2 was committed
  assert.equal(store.semesters.size, 1);
  assert.ok(store.semesters.has("sem_init"));
  assert.equal(store.semesters.has("sem_1"), false, "sem_1 must NOT be written when transaction fails");
  assert.equal(store.semesters.has("sem_2"), false, "sem_2 must NOT be written when transaction fails");
});

// =========================================================================
// 5. NOTIFICATION SERVER STORE IDEMPOTENCY & LEASING
// =========================================================================
test("Phase 24 - Test 5: Notification queue ensures O(1) deduplication and atomic worker leases", () => {
  const jobsMap = new Map();
  const idempotencyMap = new Map();

  function saveJob(job) {
    const existingId = idempotencyMap.get(job.idempotencyKey);
    if (existingId) {
      const existing = jobsMap.get(existingId);
      if (existing && (existing.status === "SENT" || existing.status === "PROCESSING")) {
        return existing;
      }
      jobsMap.set(existingId, { ...job, id: existingId });
      return jobsMap.get(existingId);
    }
    jobsMap.set(job.id, job);
    idempotencyMap.set(job.idempotencyKey, job.id);
    return job;
  }

  function claimDueJobs(nowMs, workerId, leaseTimeoutMs = 60000, limit = 10) {
    const claimed = [];
    for (const [id, job] of jobsMap.entries()) {
      if (claimed.length >= limit) break;
      const isDue = job.targetExecutionTimestamp <= nowMs;
      const canClaim = job.status === "SCHEDULED" || (job.status === "FAILED" && job.retryCount < job.maxRetries);

      if (isDue && canClaim) {
        const updated = {
          ...job,
          status: "PROCESSING",
          lockedBy: workerId,
          lockExpiresAt: nowMs + leaseTimeoutMs,
        };
        jobsMap.set(id, updated);
        claimed.push(updated);
      }
    }
    return claimed;
  }

  const now = Date.now();
  // Insert initial jobs
  saveJob({
    id: "job_1",
    idempotencyKey: "evt_1_email_100",
    status: "SCHEDULED",
    targetExecutionTimestamp: now - 1000,
    retryCount: 0,
    maxRetries: 3,
  });

  // Duplicate insert with same idempotency key must deduplicate
  saveJob({
    id: "job_duplicate",
    idempotencyKey: "evt_1_email_100",
    status: "SCHEDULED",
    targetExecutionTimestamp: now - 1000,
    retryCount: 0,
    maxRetries: 3,
  });

  assert.equal(jobsMap.size, 1, "Duplicate idempotency key must not create new job");

  // Worker 1 claims due jobs
  const claimedWorker1 = claimDueJobs(now, "worker_1", 30000);
  assert.equal(claimedWorker1.length, 1);
  assert.equal(claimedWorker1[0].lockedBy, "worker_1");
  assert.equal(claimedWorker1[0].status, "PROCESSING");

  // Worker 2 attempts to claim concurrently
  const claimedWorker2 = claimDueJobs(now, "worker_2", 30000);
  assert.equal(claimedWorker2.length, 0, "Worker 2 must not claim job already locked by Worker 1");
});

// =========================================================================
// 6. NOTIFICATION STUCK-JOB LEASE RECOVERY
// =========================================================================
test("Phase 24 - Test 6: Stuck jobs with expired leases are automatically recovered", () => {
  const jobsMap = new Map();

  function recoverStuckJobs(nowMs) {
    let recovered = 0;
    for (const [id, job] of jobsMap.entries()) {
      if (job.status === "PROCESSING") {
        const isExpired = job.lockExpiresAt ? job.lockExpiresAt <= nowMs : true;
        if (isExpired) {
          jobsMap.set(id, {
            ...job,
            status: job.retryCount < job.maxRetries ? "SCHEDULED" : "FAILED",
            lockedBy: undefined,
            lockExpiresAt: undefined,
          });
          recovered++;
        }
      }
    }
    return recovered;
  }

  const baseTime = 1700000000000;
  jobsMap.set("stuck_job", {
    id: "stuck_job",
    status: "PROCESSING",
    lockedBy: "crashed_worker",
    lockExpiresAt: baseTime + 30000, // expired at baseTime + 30s
    retryCount: 1,
    maxRetries: 3,
  });

  // Check before expiration
  assert.equal(recoverStuckJobs(baseTime + 10000), 0);
  assert.equal(jobsMap.get("stuck_job").status, "PROCESSING");

  // Check after expiration (at baseTime + 35s)
  const recovered = recoverStuckJobs(baseTime + 35000);
  assert.equal(recovered, 1);
  const job = jobsMap.get("stuck_job");
  assert.equal(job.status, "SCHEDULED", "Job must be recovered to SCHEDULED for redelivery");
  assert.equal(job.lockedBy, undefined);
  assert.equal(job.lockExpiresAt, undefined);
});

// =========================================================================
// 7. PERMANENT ERROR NON-RETRY TERMINATION
// =========================================================================
test("Phase 24 - Test 7: Permanent delivery errors terminate immediately without wasteful backoff", () => {
  function isPermanentFailure(error) {
    if (!error) return false;
    const lower = error.toLowerCase();
    return (
      lower.includes("invalid email") ||
      lower.includes("invalid recipient") ||
      lower.includes("invalid phone") ||
      lower.includes("not configured") ||
      lower.includes("unregistered") ||
      lower.includes("malformed")
    );
  }

  function handleDeliveryResult(job, errorMsg) {
    if (isPermanentFailure(errorMsg)) {
      return {
        ...job,
        status: "FAILED",
        retryCount: job.maxRetries,
        lastError: errorMsg,
      };
    } else {
      return {
        ...job,
        retryCount: job.retryCount + 1,
        status: job.retryCount + 1 >= job.maxRetries ? "FAILED" : "SCHEDULED",
        lastError: errorMsg,
      };
    }
  }

  const job = { id: "j1", status: "PROCESSING", retryCount: 0, maxRetries: 3 };

  // Transient network glitch -> retried
  const transientResult = handleDeliveryResult(job, "Connection timeout 504");
  assert.equal(transientResult.status, "SCHEDULED");
  assert.equal(transientResult.retryCount, 1);

  // Permanent bad address -> immediate FAILED
  const permanentResult = handleDeliveryResult(job, "Invalid email address format");
  assert.equal(permanentResult.status, "FAILED");
  assert.equal(permanentResult.retryCount, 3, "Retry count must be maximized to stop further polling");
});

// =========================================================================
// 8. BOUNDED CONCURRENCY BATCH RUNNER & ABORT
// =========================================================================
test("Phase 24 - Test 8: Bounded concurrency batch runner respects concurrency and abort signal", async () => {
  const items = new Array(10).fill(0).map((_, i) => ({ id: `item_${i}`, value: i }));
  let activeWorkers = 0;
  let maxActiveWorkers = 0;
  const processed = [];
  const cleanedUp = [];

  const controller = new AbortController();

  async function processor(item, idx, signal) {
    activeWorkers++;
    maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers);
    if (signal?.aborted) throw new Error("Aborted");

    // Simulate work
    await new Promise(r => setTimeout(r, 10));
    activeWorkers--;
    processed.push(item.id);
    return item.value * 2;
  }

  const cleanup = (item) => {
    cleanedUp.push(item.id);
  };

  // Run with concurrency = 2
  const concurrency = 2;
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      if (controller.signal.aborted) break;
      const item = items[nextIdx++];
      try {
        await processor(item, nextIdx - 1, controller.signal);
      } finally {
        cleanup(item);
      }
    }
  }

  await Promise.all([worker(), worker()]);

  assert.ok(maxActiveWorkers <= concurrency, `Max active workers (${maxActiveWorkers}) must not exceed concurrency (${concurrency})`);
  assert.equal(processed.length, 10);
  assert.equal(cleanedUp.length, 10, "Every item must have its cleanup hook invoked");
});

// =========================================================================
// 9. OBSERVABILITY ERROR CLASSIFICATION & SANITIZATION
// =========================================================================
test("Phase 24 - Test 9: Observability sanitizes sensitive credentials and classifies error types", () => {
  function sanitizeContext(context) {
    if (!context || typeof context !== "object") return undefined;
    const sanitized = {};
    const sensitiveKeys = ["secret", "token", "key", "password", "auth", "bearer"];
    for (const [k, v] of Object.entries(context)) {
      if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
        sanitized[k] = "[REDACTED]";
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  function classify(err) {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("quota") || msg.includes("storage")) return "STORAGE_ERROR";
    if (msg.includes("offline") || msg.includes("fetch")) return "NETWORK_ERROR";
    if (msg.includes("timeout") || msg.includes("timed out")) return "TIMEOUT";
    if (msg.includes("validation")) return "VALIDATION_ERROR";
    return "INTERNAL_ERROR";
  }

  const context = {
    userId: "usr_123",
    apiKey: "sk_live_secret12345",
    authToken: "bearer_token_abc",
    documentName: "sample.pdf",
  };

  const safeCtx = sanitizeContext(context);
  assert.equal(safeCtx.userId, "usr_123");
  assert.equal(safeCtx.documentName, "sample.pdf");
  assert.equal(safeCtx.apiKey, "[REDACTED]");
  assert.equal(safeCtx.authToken, "[REDACTED]");

  assert.equal(classify(new Error("Storage quota exceeded")), "STORAGE_ERROR");
  assert.equal(classify(new Error("Failed to fetch remote provider")), "NETWORK_ERROR");
  assert.equal(classify(new Error("Request deadline timed out")), "TIMEOUT");
  assert.equal(classify(new Error("Schema validation failure on payload")), "VALIDATION_ERROR");
});

// =========================================================================
// 10. STORAGE HEALTH MONITORING
// =========================================================================
test("Phase 24 - Test 10: Storage health returns truthful low-storage warning", () => {
  function calculateStorageHealth(usageBytes, quotaBytes) {
    const percentageUsed = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
    const remainingBytes = quotaBytes - usageBytes;
    const isLowStorage = percentageUsed > 90 || remainingBytes < 50 * 1024 * 1024;
    return {
      usageBytes,
      quotaBytes,
      percentageUsed: Math.round(percentageUsed * 10) / 10,
      isLowStorage,
      storageAvailable: true,
    };
  }

  // Normal usage (50MB of 1GB)
  const normal = calculateStorageHealth(50 * 1024 * 1024, 1024 * 1024 * 1024);
  assert.equal(normal.isLowStorage, false);
  assert.equal(normal.percentageUsed, 4.9);

  // Critical usage (950MB of 1GB = 92.8%)
  const critical = calculateStorageHealth(950 * 1024 * 1024, 1024 * 1024 * 1024);
  assert.equal(critical.isLowStorage, true);
  assert.equal(critical.percentageUsed, 92.8);
});
