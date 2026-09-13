import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Saarvi — Phase 30E Security Fortress & OS Concepts Behavioral Test Suite
// ============================================================================

// --- 1. RBAC & Granular Admin Permissions ---
const ADMIN_PERMISSIONS = {
  SUPER_ADMIN: ['VIEW', 'MANAGE', 'PUBLISH', 'BILLING', 'SECURITY', 'SUPER_ADMIN'],
  ADMIN: ['VIEW', 'MANAGE', 'PUBLISH', 'BILLING'],
};

function checkPermission(role, permission) {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'ADMIN') {
    return ADMIN_PERMISSIONS.ADMIN.includes(permission);
  }
  return false;
}

test('1.1 RBAC: Least privilege permission matrix enforcement', () => {
  // Super Admin has all permissions
  assert.equal(checkPermission('SUPER_ADMIN', 'VIEW'), true);
  assert.equal(checkPermission('SUPER_ADMIN', 'MANAGE'), true);
  assert.equal(checkPermission('SUPER_ADMIN', 'PUBLISH'), true);
  assert.equal(checkPermission('SUPER_ADMIN', 'BILLING'), true);
  assert.equal(checkPermission('SUPER_ADMIN', 'SECURITY'), true);
  assert.equal(checkPermission('SUPER_ADMIN', 'SUPER_ADMIN'), true);

  // Admin has operational permissions, but NOT security or super-admin management
  assert.equal(checkPermission('ADMIN', 'VIEW'), true);
  assert.equal(checkPermission('ADMIN', 'MANAGE'), true);
  assert.equal(checkPermission('ADMIN', 'PUBLISH'), true);
  assert.equal(checkPermission('ADMIN', 'BILLING'), true);
  assert.equal(checkPermission('ADMIN', 'SECURITY'), false);
  assert.equal(checkPermission('ADMIN', 'SUPER_ADMIN'), false);

  // Normal users and guests have NO admin permissions
  assert.equal(checkPermission('USER', 'VIEW'), false);
  assert.equal(checkPermission('USER', 'MANAGE'), false);
  assert.equal(checkPermission(undefined, 'VIEW'), false);
});

// --- 2. SSRF & URL Security Tests ---
function validateRemoteUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return { safe: false, error: 'Empty URL' };
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'Invalid scheme' };
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Loopback / Localhost
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.startsWith('fc00:') ||
      host.startsWith('fe80:')
    ) {
      return { safe: false, error: 'Loopback / private network address blocked' };
    }

    // Cloud Metadata
    if (
      host === '169.254.169.254' ||
      host.startsWith('169.254.') ||
      host === 'metadata.google.internal' ||
      host.includes('metadata.google')
    ) {
      return { safe: false, error: 'Cloud metadata service blocked' };
    }

    // RFC 1918 Private IPv4
    const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (match) {
      const o1 = parseInt(match[1], 10);
      const o2 = parseInt(match[2], 10);
      if (o1 === 10) return { safe: false, error: 'Private 10.0.0.0/8 blocked' };
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return { safe: false, error: 'Private 172.16.0.0/12 blocked' };
      if (o1 === 192 && o2 === 168) return { safe: false, error: 'Private 192.168.0.0/16 blocked' };
      if (o1 === 127) return { safe: false, error: 'Loopback 127.0.0.0/8 blocked' };
    }

    return { safe: true };
  } catch {
    return { safe: false, error: 'Malformed URL' };
  }
}

test('2.1 SSRF: Blocks loopback, private RFC 1918 subnets, and cloud metadata', () => {
  // Loopback attacks
  assert.equal(validateRemoteUrl('http://127.0.0.1:8080/admin').safe, false);
  assert.equal(validateRemoteUrl('http://localhost:3000/api/secret').safe, false);
  assert.equal(validateRemoteUrl('http://127.0.0.2/status').safe, false);
  assert.equal(validateRemoteUrl('http://[::1]/internal').safe, false);

  // Cloud metadata attacks (AWS, GCP, Azure, Vercel)
  assert.equal(validateRemoteUrl('http://169.254.169.254/latest/meta-data/').safe, false);
  assert.equal(validateRemoteUrl('http://metadata.google.internal/computeMetadata/v1/').safe, false);
  assert.equal(validateRemoteUrl('http://169.254.1.1/creds').safe, false);

  // RFC 1918 Private Subnets
  assert.equal(validateRemoteUrl('http://10.0.0.1/db').safe, false);
  assert.equal(validateRemoteUrl('http://172.20.10.5/api').safe, false);
  assert.equal(validateRemoteUrl('http://192.168.1.100/router').safe, false);

  // Non-HTTP schemes
  assert.equal(validateRemoteUrl('file:///etc/passwd').safe, false);
  assert.equal(validateRemoteUrl('gopher://127.0.0.1:70/').safe, false);

  // Valid legitimate public URLs
  assert.equal(validateRemoteUrl('https://api.razorpay.com/v1/orders').safe, true);
  assert.equal(validateRemoteUrl('https://vtu.ac.in/syllabus').safe, true);
  assert.equal(validateRemoteUrl('https://generativelanguage.googleapis.com/v1/models').safe, true);
});

// --- 3. Open Redirect & XSS URL Sanitization ---
function sanitizeRedirect(rawUrl, fallback = '/dashboard') {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes('\\')) {
    return fallback;
  }
  const dangerous = ['javascript:', 'data:', 'vbscript:'];
  if (dangerous.some((p) => trimmed.toLowerCase().includes(p))) {
    return fallback;
  }
  return trimmed;
}

test('3.1 Open Redirect & XSS URL Sanitization', () => {
  assert.equal(sanitizeRedirect('https://evil.com'), '/dashboard');
  assert.equal(sanitizeRedirect('//evil.com/phish'), '/dashboard');
  assert.equal(sanitizeRedirect('/\\evil.com'), '/dashboard');
  assert.equal(sanitizeRedirect('/dashboard?next=javascript:alert(1)'), '/dashboard');
  assert.equal(sanitizeRedirect('/student/resume'), '/student/resume');
  assert.equal(sanitizeRedirect('/admin/curriculum?univ=VTU'), '/admin/curriculum?univ=VTU');
});

// --- 4. File Security & Magic Bytes Detection ---
function detectFileSignature(bytes) {
  if (bytes.length < 4) return 'UNKNOWN';

  // Windows PE (.exe, .dll)
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return 'EXECUTABLE_PE';
  // Linux ELF
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return 'EXECUTABLE_ELF';
  // Mach-O
  if (
    (bytes[0] === 0xfe && bytes[1] === 0xed && bytes[2] === 0xfa && (bytes[3] === 0xce || bytes[3] === 0xcf)) ||
    (bytes[0] === 0xcf && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe)
  ) return 'EXECUTABLE_MACHO';

  // PDF (%PDF)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'PDF';
  // PNG (\x89PNG)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'PNG';
  // JPEG (\xFF\xD8\xFF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'JPEG';

  return 'OTHER';
}

function sanitizeFilename(raw, fallback = 'file') {
  if (!raw || typeof raw !== 'string') return fallback;
  let name = raw.replace(/\.\.+[/\\?]*/g, '');
  name = name.replace(/[/\\?%*:|"<>]/g, '_');
  name = name.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  const base = name.split('.')[0]?.toUpperCase();
  if (['CON', 'PRN', 'AUX', 'NUL', 'COM1'].includes(base)) {
    name = `safe_${name}`;
  }
  return name.trim() || fallback;
}

test('4.1 File Security: Magic bytes inspect binary types and reject executables', () => {
  // Executable PE (MZ)
  const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  assert.equal(detectFileSignature(exeBytes), 'EXECUTABLE_PE');

  // Linux ELF
  const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46]);
  assert.equal(detectFileSignature(elfBytes), 'EXECUTABLE_ELF');

  // PDF
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  assert.equal(detectFileSignature(pdfBytes), 'PDF');

  // PNG
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  assert.equal(detectFileSignature(pngBytes), 'PNG');

  // Directory traversal filename sanitization
  assert.equal(sanitizeFilename('../../../etc/passwd.pdf'), 'etc_passwd.pdf');
  assert.equal(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe'), 'windows_system32_cmd.exe');
  assert.equal(sanitizeFilename('CON.txt'), 'safe_CON.txt');
});

// --- 5. OS Concept: Counting Semaphore & Concurrency Bounding ---
class TestSemaphore {
  constructor(permits, maxQueue = 10) {
    this.permits = permits;
    this.maxPermits = permits;
    this.maxQueue = maxQueue;
    this.queue = [];
  }

  async acquire() {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }
    if (this.queue.length >= this.maxQueue) {
      throw new Error('Backpressure: Queue full');
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        resolve(() => this.release());
      });
    });
  }

  release() {
    if (this.queue.length > 0) {
      const grant = this.queue.shift();
      grant();
    } else {
      if (this.permits < this.maxPermits) this.permits++;
    }
  }

  async withPermit(fn) {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

test('5.1 OS Concept: Semaphore strictly limits active concurrency and enforces FIFO queueing', async () => {
  const sem = new TestSemaphore(2, 5); // Max 2 concurrent, max 5 queued
  let activeWorkers = 0;
  let peakWorkers = 0;

  const task = async (durationMs) => {
    return sem.withPermit(async () => {
      activeWorkers++;
      if (activeWorkers > peakWorkers) peakWorkers = activeWorkers;
      await new Promise((r) => setTimeout(r, durationMs));
      activeWorkers--;
      return true;
    });
  };

  // Launch 4 concurrent tasks with permits=2
  const p1 = task(15);
  const p2 = task(15);
  const p3 = task(15);
  const p4 = task(15);

  await Promise.all([p1, p2, p3, p4]);

  // Peak active concurrency must never exceed 2
  assert.equal(peakWorkers, 2);
  assert.equal(activeWorkers, 0);

  // Test backpressure queue limit
  const fillSem = new TestSemaphore(1, 2); // permits=1, queue=2
  const longTask = fillSem.acquire(); // takes permit 1
  const wait1 = fillSem.acquire();     // queues 1
  const wait2 = fillSem.acquire();     // queues 2

  // 4th request must be rejected with backpressure error
  await assert.rejects(async () => {
    await fillSem.acquire();
  }, /Backpressure: Queue full/);

  const release = await longTask;
  release();
  const rel1 = await wait1;
  rel1();
  const rel2 = await wait2;
  rel2();
});

// --- 6. OS Concept: Key-Scoped Mutex Lock ---
class TestAsyncLock {
  constructor() {
    this.locks = new Map();
  }

  async acquire(key) {
    const current = this.locks.get(key) || Promise.resolve();
    let release;
    const next = new Promise((res) => {
      release = res;
    });
    this.locks.set(key, next);

    return current.then(() => () => {
      if (this.locks.get(key) === next) {
        this.locks.delete(key);
      }
      release();
    });
  }

  async withLock(key, fn) {
    const release = await this.acquire(key);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

test('6.1 OS Concept: Mutex lock serializes operations on same key without blocking independent keys', async () => {
  const lock = new TestAsyncLock();
  const order = [];

  // Key A: two competing operations
  const taskA1 = lock.withLock('user_123', async () => {
    await new Promise((r) => setTimeout(r, 20));
    order.push('A1');
  });
  const taskA2 = lock.withLock('user_123', async () => {
    order.push('A2');
  });

  // Key B: independent operation, should not wait for Key A
  const taskB1 = lock.withLock('user_456', async () => {
    order.push('B1');
  });

  await Promise.all([taskA1, taskA2, taskB1]);

  // B1 must finish before A1/A2, and A1 must finish strictly before A2
  assert.equal(order[0], 'B1');
  assert.equal(order[1], 'A1');
  assert.equal(order[2], 'A2');
});

// --- 7. OS Concept: Idempotency & Replay Protection ---
class TestIdempotency {
  constructor() {
    this.store = new Map();
  }

  start(key) {
    const existing = this.store.get(key);
    if (existing) {
      return { isDuplicate: true, status: existing.status, response: existing.response };
    }
    this.store.set(key, { status: 'IN_PROGRESS' });
    return { isDuplicate: false };
  }

  complete(key, response) {
    const rec = this.store.get(key);
    if (rec) {
      rec.status = 'COMPLETED';
      rec.response = response;
    }
  }
}

test('7.1 OS Concept: Idempotency deduplicates requests and protects against double payments/emails', () => {
  const idem = new TestIdempotency();

  // First request
  const check1 = idem.start('order_pay_789');
  assert.equal(check1.isDuplicate, false);

  // Concurrent request while in progress
  const check2 = idem.start('order_pay_789');
  assert.equal(check2.isDuplicate, true);
  assert.equal(check2.status, 'IN_PROGRESS');

  // Complete operation
  idem.complete('order_pay_789', { orderId: '789', status: 'PAID' });

  // Replay request after completion
  const check3 = idem.start('order_pay_789');
  assert.equal(check3.isDuplicate, true);
  assert.equal(check3.status, 'COMPLETED');
  assert.deepEqual(check3.response, { orderId: '789', status: 'PAID' });
});

// --- 8. OS Concept: Priority Job Queue & Dead-Letter Queue (DLQ) ---
class TestJobQueue {
  constructor(maxPerUser = 2) {
    this.jobs = [];
    this.maxPerUser = maxPerUser;
  }

  submit(userId, priority, maxRetries = 2) {
    const active = this.jobs.filter((j) => j.userId === userId && ['PENDING', 'RUNNING'].includes(j.state)).length;
    if (active >= this.maxPerUser) throw new Error('User quota exceeded');

    const job = {
      id: `j_${this.jobs.length + 1}`,
      userId,
      priority,
      state: 'PENDING',
      attempts: 0,
      maxRetries,
      createdAt: Date.now(),
    };
    this.jobs.push(job);
    return job;
  }

  getNext() {
    const priorities = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const pending = this.jobs.filter((j) => j.state === 'PENDING');
    if (pending.length === 0) return null;

    pending.sort((a, b) => {
      const pdiff = priorities[a.priority] - priorities[b.priority];
      if (pdiff !== 0) return pdiff;
      return a.createdAt - b.createdAt;
    });

    const next = pending[0];
    next.state = 'RUNNING';
    next.attempts++;
    return next;
  }

  fail(jobId, error) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return;
    job.error = error;
    if (job.attempts <= job.maxRetries) {
      job.state = 'PENDING'; // Retry
    } else {
      job.state = 'DEAD_LETTER'; // Moved to DLQ
    }
  }

  complete(jobId) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) job.state = 'SUCCEEDED';
  }
}

test('8.1 OS Concept: Priority Job Queue orders by priority and sends poisoned jobs to DLQ', () => {
  const q = new TestJobQueue(5);

  // Submit in reverse order
  q.submit('u1', 'LOW');
  q.submit('u1', 'NORMAL');
  q.submit('u1', 'CRITICAL');
  q.submit('u1', 'HIGH');

  // Should fetch CRITICAL first
  const j1 = q.getNext();
  assert.equal(j1.priority, 'CRITICAL');

  // Next is HIGH
  const j2 = q.getNext();
  assert.equal(j2.priority, 'HIGH');

  // Next is NORMAL
  const j3 = q.getNext();
  assert.equal(j3.priority, 'NORMAL');

  // Next is LOW
  const j4 = q.getNext();
  assert.equal(j4.priority, 'LOW');

  // Test Dead-Letter Queue (DLQ): Max 2 retries
  const dlqJob = q.submit('u2', 'NORMAL', 2);
  const picked = q.getNext();
  assert.equal(picked.id, dlqJob.id);

  // Attempt 1 fails -> retries
  q.fail(picked.id, 'Timeout 1');
  assert.equal(picked.state, 'PENDING');

  // Attempt 2 fails -> retries
  const picked2 = q.getNext();
  q.fail(picked2.id, 'Timeout 2');
  assert.equal(picked2.state, 'PENDING');

  // Attempt 3 fails (exceeded maxRetries=2) -> DEAD_LETTER
  const picked3 = q.getNext();
  q.fail(picked3.id, 'Permanent DB error');
  assert.equal(picked3.state, 'DEAD_LETTER');
});

// --- 9. OS Concept: Circuit Breaker & Graceful Degradation ---
class TestCircuitBreaker {
  constructor(threshold = 3, cooldownMs = 30) {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.nextAttemptAt = 0;
  }

  getState() {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
    return this.state;
  }

  async execute(fn, fallback) {
    const s = this.getState();
    if (s === 'OPEN') {
      if (fallback) return fallback();
      throw new Error('Circuit OPEN');
    }
    try {
      const res = await fn();
      this.onSuccess();
      return res;
    } catch (e) {
      this.onFailure();
      if (fallback) return fallback();
      throw e;
    }
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  onFailure() {
    this.failureCount++;
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + this.cooldownMs;
    }
  }
}

test('9.1 OS Concept: Circuit Breaker trips to OPEN on failure and recovers via HALF_OPEN', async () => {
  const cb = new TestCircuitBreaker(3, 20); // 3 failures, 20ms cooldown

  assert.equal(cb.getState(), 'CLOSED');

  // 3 consecutive failures
  await cb.execute(async () => { throw new Error('Downstream error 1'); }, () => 'fallback');
  await cb.execute(async () => { throw new Error('Downstream error 2'); }, () => 'fallback');
  await cb.execute(async () => { throw new Error('Downstream error 3'); }, () => 'fallback');

  // State must now be OPEN
  assert.equal(cb.getState(), 'OPEN');

  // Calls during OPEN immediately return fallback without executing the failing function
  let called = false;
  const val = await cb.execute(async () => { called = true; }, () => 'degraded_response');
  assert.equal(called, false);
  assert.equal(val, 'degraded_response');

  // Wait for cooldown
  await new Promise((r) => setTimeout(r, 25));

  // Should transition to HALF_OPEN
  assert.equal(cb.getState(), 'HALF_OPEN');

  // 2 successful probe calls close the circuit
  await cb.execute(async () => 'ok1');
  await cb.execute(async () => 'ok2');

  assert.equal(cb.getState(), 'CLOSED');
});

// --- 10. OS Concept: Scoped Caching & Invalidation ---
class TestScopedCache {
  constructor() {
    this.map = new Map();
  }

  get(k) { return this.map.get(k) || null; }
  set(k, v) { this.map.set(k, v); }
  invalidatePrefix(p) {
    for (const k of this.map.keys()) {
      if (k.startsWith(p)) this.map.delete(k);
    }
  }
}

test('10.1 OS Concept: Scoped caching prevents cross-university leakage and invalidates by prefix', () => {
  const cache = new TestScopedCache();

  // Scoped key 1: VTU 2022 CSE Sem 3
  const keyVTU = 'academic:univ-vtu:scheme-2022:branch-cse:3';
  cache.set(keyVTU, [{ code: 'BCS301', credits: 4 }]);

  // Scoped key 2: BMSCE 2024 CSE Sem 3
  const keyBMSCE = 'academic:univ-bmsce:scheme-2024:branch-cse:3';
  cache.set(keyBMSCE, [{ code: '24CS301', credits: 4 }]);

  // Isolated reads
  assert.equal(cache.get(keyVTU)[0].code, 'BCS301');
  assert.equal(cache.get(keyBMSCE)[0].code, '24CS301');

  // Invalidate only VTU
  cache.invalidatePrefix('academic:univ-vtu');

  assert.equal(cache.get(keyVTU), null);
  assert.notEqual(cache.get(keyBMSCE), null); // BMSCE remains intact
});
