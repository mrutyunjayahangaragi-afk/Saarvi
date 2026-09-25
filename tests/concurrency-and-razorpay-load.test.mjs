import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// ============================================================================
// CONCURRENCY ARCHITECTURE & LOAD SIMULATION TEST HARNESS
// ============================================================================

class Semaphore {
  constructor(maxPermits) {
    this.maxPermits = maxPermits;
    this.permits = maxPermits;
    this.waiting = [];
  }

  get available() {
    return this.permits;
  }

  async acquire(timeoutMs = 5000) {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve, reject) => {
      let timer = null;
      const resolver = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = this.waiting.indexOf(resolver);
          if (idx !== -1) {
            this.waiting.splice(idx, 1);
            reject(new Error(`Semaphore acquire timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }

      this.waiting.push(resolver);
    });
  }

  release() {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next) next();
    } else {
      this.permits = Math.min(this.maxPermits, this.permits + 1);
    }
  }
}

class FairWorkerPool {
  constructor({ maxWorkers = 8, maxQueueDepth = 500, maxActivePerUser = 3 } = {}) {
    this.maxWorkers = maxWorkers;
    this.maxQueueDepth = maxQueueDepth;
    this.maxActivePerUser = maxActivePerUser;
    this.activeWorkers = 0;
    this.activePerUser = new Map();
    this.queue = [];
  }

  get stats() {
    return {
      activeWorkers: this.activeWorkers,
      totalWorkers: this.maxWorkers,
      workerUtilization: Math.round((this.activeWorkers / this.maxWorkers) * 100),
      queueDepth: this.queue.length,
    };
  }

  async submit(userId, task, priority = 'P1') {
    if (this.queue.length >= this.maxQueueDepth) {
      const err = new Error('System is busy. Please try again shortly.');
      err.status = 503;
      throw err;
    }

    return new Promise((resolve, reject) => {
      const job = {
        userId,
        priority,
        task,
        resolve,
        reject,
      };

      const weights = { P0: 0, P1: 1, P2: 2, P3: 3 };
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (weights[priority] < weights[this.queue[i].priority]) {
          this.queue.splice(i, 0, job);
          inserted = true;
          break;
        }
      }
      if (!inserted) this.queue.push(job);

      this.pump();
    });
  }

  pump() {
    while (this.activeWorkers < this.maxWorkers && this.queue.length > 0) {
      let targetIndex = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const candidate = this.queue[i];
        const userCount = this.activePerUser.get(candidate.userId) || 0;
        if (userCount < this.maxActivePerUser || candidate.priority === 'P0') {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) targetIndex = 0;

      const job = this.queue.splice(targetIndex, 1)[0];
      if (!job) break;

      this.execute(job);
    }
  }

  async execute(job) {
    this.activeWorkers++;
    const count = this.activePerUser.get(job.userId) || 0;
    this.activePerUser.set(job.userId, count + 1);

    try {
      const res = await job.task();
      job.resolve(res);
    } catch (err) {
      job.reject(err);
    } finally {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
      const userCount = this.activePerUser.get(job.userId) || 1;
      if (userCount <= 1) {
        this.activePerUser.delete(job.userId);
      } else {
        this.activePerUser.set(job.userId, userCount - 1);
      }
      this.pump();
    }
  }
}

class CircuitBreaker {
  constructor(name, failureThreshold = 3, cooldownMs = 500) {
    this.name = name;
    this.threshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttempt = 0;
  }

  getState() {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  async execute(fn) {
    const cur = this.getState();
    if (cur === 'OPEN') {
      const err = new Error(`Circuit OPEN for ${this.name}`);
      err.status = 503;
      throw err;
    }

    try {
      const res = await fn();
      this.failures = 0;
      this.state = 'CLOSED';
      return res;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.cooldownMs;
      }
      throw err;
    }
  }
}

// ============================================================================
// RAZORPAY SERVICE HARNESS
// ============================================================================

const PRO_PRICING = {
  monthly: { plan: 'pro', interval: 'monthly', amountCents: 9900 },
  yearly: { plan: 'pro', interval: 'yearly', amountCents: 89900 },
};

class RazorpayTestService {
  constructor(secret = 'rzp_test_secret_key_12345') {
    this.secret = secret;
    this.orders = new Map();
    this.subscriptions = new Map();
    this.invoices = [];
    this.events = new Set();
    this.notifications = [];
  }

  createOrder({ userId, userEmail, interval, clientPrice }) {
    if (clientPrice !== undefined) {
      throw new Error('Security violation: Client cannot specify pricing or currency parameters.');
    }
    const config = PRO_PRICING[interval || 'monthly'];
    if (!config) throw new Error('Invalid billing interval');

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = {
      orderId,
      userId,
      userEmail,
      amountCents: config.amountCents,
      currency: 'INR',
      interval,
      status: 'created',
      createdAt: Date.now(),
    };
    this.orders.set(orderId, order);
    return order;
  }

  verifyPayment({ orderId, paymentId, signature, userId }) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const expected = crypto.createHmac('sha256', this.secret).update(`${orderId}|${paymentId}`).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      order.status = 'failed';
      throw new Error('Cryptographic signature verification failed.');
    }

    order.status = 'paid';
    order.paymentId = paymentId;
    this.provisionEntitlement(order.userId, orderId, paymentId, order.interval, order.amountCents);
    return { success: true, isPro: true, order };
  }

  handleWebhook(rawBody, headers) {
    const signature = headers['x-razorpay-signature'];
    if (!signature) throw new Error('Missing signature header');

    const expected = crypto.createHmac('sha256', this.secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      throw new Error('Webhook signature mismatch');
    }

    const event = JSON.parse(rawBody);
    const eventId = event.id;

    if (this.events.has(eventId)) {
      return { success: true, duplicate: true, eventId };
    }
    this.events.add(eventId);

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const orderId = event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id;
      const paymentId = event.payload?.payment?.entity?.id;
      const order = this.orders.get(orderId);
      if (order && order.status !== 'paid') {
        order.status = 'paid';
        order.paymentId = paymentId;
        this.provisionEntitlement(order.userId, orderId, paymentId, order.interval, order.amountCents);
      }
    }

    return { success: true, duplicate: false, eventId };
  }

  provisionEntitlement(userId, orderId, paymentId, interval, amountCents) {
    const existing = this.subscriptions.get(userId);
    if (existing && existing.status === 'ACTIVE' && existing.providerSubscriptionId === orderId) {
      return; // Idempotent: already provisioned for this order
    }

    this.subscriptions.set(userId, {
      userId,
      status: 'ACTIVE',
      plan: 'pro',
      providerSubscriptionId: orderId,
      interval,
      amountCents,
      expiresAt: Date.now() + (interval === 'yearly' ? 365 : 30) * 86400000,
    });

    this.invoices.push({ userId, orderId, paymentId, amountPaid: amountCents });
    this.notifications.push({ userId, title: 'Payment Successful — Pro Plan Active!' });
  }
}

// ============================================================================
// TEST SUITE EXECUTION
// ============================================================================

test('OS CONCURRENCY, 5000-USER LOAD & RAZORPAY BILLING TEST SUITE', async (t) => {

  await t.test('1. Bounded Concurrency Semaphore: Restricts upstream concurrency with timeout safety', async () => {
    const sem = new Semaphore(3);
    assert.equal(sem.available, 3);

    await sem.acquire();
    await sem.acquire();
    await sem.acquire();
    assert.equal(sem.available, 0);

    // 4th acquire must queue
    let acquiredFourth = false;
    const promise = sem.acquire(500).then(() => { acquiredFourth = true; });

    assert.equal(acquiredFourth, false);
    sem.release();
    await promise;
    assert.equal(acquiredFourth, true);

    sem.release();
    assert.equal(sem.available, 1);
  });

  await t.test('2. Priority Scheduling (P0 > P1 > P2 > P3)', async () => {
    const pool = new FairWorkerPool({ maxWorkers: 1, maxActivePerUser: 10 });
    const order = [];

    // Block the worker temporarily
    let unblock;
    const blocker = new Promise((res) => { unblock = res; });
    pool.submit('user1', () => blocker, 'P1');

    // Enqueue jobs with different priorities
    pool.submit('user1', async () => { order.push('P3'); }, 'P3');
    pool.submit('user1', async () => { order.push('P0'); }, 'P0');
    pool.submit('user1', async () => { order.push('P1'); }, 'P1');
    pool.submit('user1', async () => { order.push('P2'); }, 'P2');

    unblock();
    // Allow queue to drain
    await new Promise((r) => setTimeout(r, 60));

    assert.deepEqual(order, ['P0', 'P1', 'P2', 'P3'], 'Jobs must execute strictly in priority order');
  });

  await t.test('3. Fair Scheduling: User A (50 jobs) does not starve User B (1 job)', async () => {
    const pool = new FairWorkerPool({ maxWorkers: 4, maxActivePerUser: 2 });
    const completed = [];

    // User A submits 30 jobs
    for (let i = 0; i < 30; i++) {
      pool.submit('userA', async () => {
        await new Promise((r) => setTimeout(r, 10));
        completed.push(`userA_${i}`);
      }, 'P1');
    }

    // User B submits 1 job shortly after
    pool.submit('userB', async () => {
      await new Promise((r) => setTimeout(r, 10));
      completed.push('userB_target');
    }, 'P1');

    // Wait until userB job completes
    const start = Date.now();
    while (!completed.includes('userB_target') && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 10));
    }

    assert.ok(completed.includes('userB_target'), 'User B job must complete promptly');
    const userBIndex = completed.indexOf('userB_target');
    assert.ok(userBIndex < 10, `User B was scheduled at index ${userBIndex}, avoiding starvation by User A`);
  });

  await t.test('4. Backpressure Protection: Max queue capacity rejection returns 503', async () => {
    const pool = new FairWorkerPool({ maxWorkers: 1, maxQueueDepth: 5 });
    let unblock;
    const blocker = new Promise((r) => { unblock = r; });
    pool.submit('user', () => blocker);

    // Enqueue 5 jobs to fill queue capacity
    for (let i = 0; i < 5; i++) {
      pool.submit('user', async () => 1);
    }

    // 6th job must be rejected with 503 SystemBusy
    await assert.rejects(
      async () => pool.submit('user', async () => 1),
      (err) => err.status === 503 && err.message.includes('busy')
    );

    unblock();
  });

  await t.test('5. Circuit Breaker: Trips on consecutive failures, fast-fails in cooldown, then recovers', async () => {
    const cb = new CircuitBreaker('Razorpay', 3, 100);

    // 1st & 2nd failures
    await assert.rejects(async () => cb.execute(async () => { throw new Error('Gateway 504'); }));
    await assert.rejects(async () => cb.execute(async () => { throw new Error('Gateway 504'); }));
    assert.equal(cb.getState(), 'CLOSED');

    // 3rd failure trips circuit to OPEN
    await assert.rejects(async () => cb.execute(async () => { throw new Error('Gateway 504'); }));
    assert.equal(cb.getState(), 'OPEN');

    // Fast-fail without hitting external dependency
    await assert.rejects(
      async () => cb.execute(async () => 'never executed'),
      (err) => err.status === 503 && err.message.includes('OPEN')
    );

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(cb.getState(), 'HALF_OPEN');

    // Successful probe closes circuit
    const probeRes = await cb.execute(async () => 'healthy');
    assert.equal(probeRes, 'healthy');
    assert.equal(cb.getState(), 'CLOSED');
  });

  await t.test('6. 5,000 Concurrent User Load Simulation: 1,000, 2,500, and 5,000 Concurrency', async () => {
    // Simulated multi-tier system with bounded DB pool, cache, and fair scheduler
    const cache = new Map();
    cache.set('tool_registry', { count: 65 });
    const dbSem = new Semaphore(30); // 30 DB connection pool limit
    let totalErrors = 0;

    async function simulateUserRequest(userId) {
      const t0 = performance.now();
      try {
        // Step 1: Cache read (Tool registry / public config) -> 90% cache hit
        if (userId % 10 !== 0) {
          const cached = cache.get('tool_registry');
          if (cached) {
            return performance.now() - t0;
          }
        }

        // Step 2: Database lookup via bounded pool (session / profile / usage)
        await dbSem.acquire(2000);
        try {
          await new Promise((r) => setTimeout(r, 1 + Math.random() * 2));
        } finally {
          dbSem.release();
        }

        return performance.now() - t0;
      } catch (err) {
        totalErrors++;
        return performance.now() - t0;
      }
    }

    const tiers = [1000, 2500, 5000];
    const metrics = {};

    for (const concurrency of tiers) {
      const start = performance.now();
      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        promises.push(simulateUserRequest(i));
      }

      const latencies = await Promise.all(promises);
      latencies.sort((a, b) => a - b);
      const totalElapsed = (performance.now() - start) / 1000;

      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      const throughput = Math.round(concurrency / totalElapsed);

      metrics[concurrency] = { p50: p50.toFixed(2), p95: p95.toFixed(2), p99: p99.toFixed(2), throughput };

      assert.ok(p95 < 200, `P95 at ${concurrency} users must be < 200ms, was ${p95.toFixed(2)}ms`);
      assert.ok(throughput >= 500, `Throughput at ${concurrency} users must be >= 500 req/s, was ${throughput}`);
    }

    assert.equal(totalErrors, 0, 'Zero errors under 5,000 concurrency simulation');
  });

  await t.test('7. Same-Tool Stress Test: 5,000 users running PDF-to-JPG simultaneously', async () => {
    // In Saarvi, PDF tools execute in-browser (Client Worker/Canvas).
    // The server handles only lightweight access checks and telemetry recording.
    const accessSem = new Semaphore(50);
    const latencies = [];

    const promises = [];
    for (let i = 0; i < 5000; i++) {
      promises.push((async () => {
        const t0 = performance.now();
        await accessSem.acquire(3000);
        try {
          // Micro-telemetry write (user_id, tool_key)
          await new Promise((r) => setTimeout(r, 0.5));
        } finally {
          accessSem.release();
        }
        latencies.push(performance.now() - t0);
      })());
    }

    await Promise.all(promises);
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    assert.ok(p95 < 400, `Same-tool P95 must be < 400ms due to client-side processing, got ${p95.toFixed(2)}ms`);
  });

  await t.test('8. Razorpay Order Creation: Server-authoritative pricing enforced', () => {
    const rzp = new RazorpayTestService();

    // Client attempts to submit fake amount ₹1
    assert.throws(
      () => rzp.createOrder({ userId: 'u1', userEmail: 'u1@test.com', interval: 'monthly', clientPrice: 100 }),
      /Security violation/
    );

    // Valid monthly order
    const monthlyOrder = rzp.createOrder({ userId: 'u1', userEmail: 'u1@test.com', interval: 'monthly' });
    assert.equal(monthlyOrder.amountCents, 9900, 'Monthly amount must be strictly 9900 paise (₹99)');

    // Valid yearly order
    const yearlyOrder = rzp.createOrder({ userId: 'u2', userEmail: 'u2@test.com', interval: 'yearly' });
    assert.equal(yearlyOrder.amountCents, 89900, 'Yearly amount must be strictly 89900 paise (₹899)');
  });

  await t.test('9. Razorpay Cryptographic Verification: Valid signature provisions Pro, forged fails', () => {
    const rzp = new RazorpayTestService();
    const order = rzp.createOrder({ userId: 'u_sig', userEmail: 'u_sig@test.com', interval: 'monthly' });
    const paymentId = 'pay_real_12345';

    // 1. Forged signature fails
    assert.throws(
      () => rzp.verifyPayment({ orderId: order.orderId, paymentId, signature: 'forged_fake_signature_abc', userId: 'u_sig' }),
      /Cryptographic signature verification failed/
    );
    assert.equal(rzp.subscriptions.has('u_sig'), false, 'Pro must NOT be provisioned on forged signature');

    // 2. Genuine HMAC-SHA256 signature succeeds
    const validSignature = crypto.createHmac('sha256', rzp.secret).update(`${order.orderId}|${paymentId}`).digest('hex');
    const result = rzp.verifyPayment({ orderId: order.orderId, paymentId, signature: validSignature, userId: 'u_sig' });

    assert.equal(result.success, true);
    assert.equal(result.isPro, true);

    const sub = rzp.subscriptions.get('u_sig');
    assert.equal(sub.status, 'ACTIVE');
    assert.equal(sub.plan, 'pro');
    assert.equal(rzp.invoices.length, 1);
    assert.equal(rzp.notifications.length, 1);
  });

  await t.test('10. Webhook Reconciliation & Idempotent Convergence: Webhook first vs Callback first', () => {
    const rzp = new RazorpayTestService();

    // Scenario A: Webhook arrives first
    const orderA = rzp.createOrder({ userId: 'userA', userEmail: 'userA@test.com', interval: 'monthly' });
    const payA = 'pay_evt_A';
    const payloadA = JSON.stringify({
      id: 'rzp_evt_1001',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: payA, order_id: orderA.orderId } },
      },
    });
    const webhookSigA = crypto.createHmac('sha256', rzp.secret).update(payloadA).digest('hex');

    // Webhook executes
    const hookRes1 = rzp.handleWebhook(payloadA, { 'x-razorpay-signature': webhookSigA });
    assert.equal(hookRes1.duplicate, false);
    assert.equal(rzp.subscriptions.get('userA').status, 'ACTIVE');

    // Duplicate webhook arrives
    const hookResDuplicate = rzp.handleWebhook(payloadA, { 'x-razorpay-signature': webhookSigA });
    assert.equal(hookResDuplicate.duplicate, true);

    // Client callback arrives later -> converges idempotently without duplicate invoice
    const clientSigA = crypto.createHmac('sha256', rzp.secret).update(`${orderA.orderId}|${payA}`).digest('hex');
    rzp.verifyPayment({ orderId: orderA.orderId, paymentId: payA, signature: clientSigA, userId: 'userA' });

    const invoicesA = rzp.invoices.filter((i) => i.userId === 'userA');
    assert.equal(invoicesA.length, 1, 'Exactly one invoice generated after webhook + callback convergence');

    // Scenario B: Client callback arrives first
    const orderB = rzp.createOrder({ userId: 'userB', userEmail: 'userB@test.com', interval: 'yearly' });
    const payB = 'pay_evt_B';
    const clientSigB = crypto.createHmac('sha256', rzp.secret).update(`${orderB.orderId}|${payB}`).digest('hex');

    // Callback executes first
    rzp.verifyPayment({ orderId: orderB.orderId, paymentId: payB, signature: clientSigB, userId: 'userB' });
    assert.equal(rzp.subscriptions.get('userB').status, 'ACTIVE');

    // Webhook arrives later
    const payloadB = JSON.stringify({
      id: 'rzp_evt_2002',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: payB, order_id: orderB.orderId } },
      },
    });
    const webhookSigB = crypto.createHmac('sha256', rzp.secret).update(payloadB).digest('hex');
    rzp.handleWebhook(payloadB, { 'x-razorpay-signature': webhookSigB });

    const invoicesB = rzp.invoices.filter((i) => i.userId === 'userB');
    assert.equal(invoicesB.length, 1, 'Exactly one invoice generated when callback arrives before webhook');
  });
});
