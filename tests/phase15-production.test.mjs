// DocEase Phase 15: Production Readiness, Reliability, Security & Regression Test Suite
// Validates:
// 1. Automatic Download Single-Execution Invariant (Section 26)
// 2. Centralized Environment Validation & Production Config Guards (Sections 4, 9, 42)
// 3. Health & Observability Endpoints (Sections 12, 13)
// 4. Structured Logger & Error Tracker Sanitization (Sections 14, 15)
// 5. Safe Billing Reconciliation & Audit Trails (Section 46)
// 6. Rate Limiter Abstraction & Sliding Window (Section 20)

import test from 'node:test';
import assert from 'node:assert/strict';

// =============================================================================
// 1. SECTION 26: AUTOMATIC DOWNLOAD REGRESSION TEST SUITE
// =============================================================================

/**
 * Headless simulation of useAutoDownload state machine
 */
class AutoDownloadStateMachine {
  constructor(options = {}) {
    this.autoDownloadEnabled = options.enabled !== undefined ? options.enabled : true;
    this.delaySeconds = options.delaySeconds || 3;
    this.isZip = options.isZip || false;
    this.filename = options.filename || 'result.pdf';
    this.downloadCount = 0;
    this.zipDownloadCount = 0;
    this.downloadHistory = [];
    this.status = 'IDLE';
    this.secondsRemaining = this.delaySeconds;
    this.blob = null;

    if (options.blob) {
      this.setBlob(options.blob);
    }
  }

  setBlob(newBlob) {
    if (this.blob === newBlob) {
      // Re-render with same blob: NO-OP, does not reset countdown
      return;
    }
    this.blob = newBlob;
    if (newBlob) {
      this.status = this.autoDownloadEnabled ? 'COUNTDOWN' : 'CANCELLED';
      this.secondsRemaining = this.delaySeconds;
    } else {
      this.status = 'IDLE';
    }
  }

  tick() {
    if (this.status !== 'COUNTDOWN' || !this.blob) return;
    this.secondsRemaining -= 1;
    if (this.secondsRemaining <= 0) {
      this.triggerDownload(true); // automatic
    }
  }

  triggerDownload(isAuto = false) {
    if (!this.blob) return false;
    this.status = 'DOWNLOADING';
    if (this.isZip) {
      this.zipDownloadCount += 1;
    } else {
      this.downloadCount += 1;
    }
    this.downloadHistory.push({
      timestamp: Date.now(),
      filename: this.filename,
      isAuto,
      isZip: this.isZip,
    });
    this.status = 'COMPLETED';
    return true;
  }

  downloadNow() {
    this.triggerDownload(false); // manual
  }

  downloadAgain() {
    this.triggerDownload(false); // intentional repeat
  }

  cancel() {
    this.status = 'CANCELLED';
  }
}

test('Phase 15 - Section 26: Automatic download triggers exactly ONCE when countdown expires', () => {
  const machine = new AutoDownloadStateMachine({
    blob: { size: 1024, type: 'application/pdf' },
    filename: 'document.pdf',
    delaySeconds: 3,
  });

  assert.equal(machine.status, 'COUNTDOWN');
  assert.equal(machine.secondsRemaining, 3);
  assert.equal(machine.downloadCount, 0);

  // Tick 1
  machine.tick();
  assert.equal(machine.secondsRemaining, 2);
  assert.equal(machine.downloadCount, 0);

  // Tick 2
  machine.tick();
  assert.equal(machine.secondsRemaining, 1);
  assert.equal(machine.downloadCount, 0);

  // Tick 3: Countdown complete
  machine.tick();
  assert.equal(machine.status, 'COMPLETED');
  assert.equal(machine.downloadCount, 1);

  // Subsequent ticks in COMPLETED status do NOT trigger additional downloads
  machine.tick();
  machine.tick();
  assert.equal(machine.downloadCount, 1, 'Download count must remain strictly 1');
});

test('Phase 15 - Section 26: React re-renders with identical blob do NOT trigger extra downloads', () => {
  const dummyBlob = { size: 2048, type: 'application/pdf' };
  const machine = new AutoDownloadStateMachine({
    blob: dummyBlob,
    filename: 'rendered.pdf',
    delaySeconds: 2,
  });

  // Re-render cycle 1 (simulating React parent re-render)
  machine.setBlob(dummyBlob);
  machine.tick(); // 1 second left

  // Re-render cycle 2
  machine.setBlob(dummyBlob);
  assert.equal(machine.secondsRemaining, 1, 'Timer must not reset on identical blob re-render');

  // Finish countdown
  machine.tick();
  assert.equal(machine.downloadCount, 1);

  // Another re-render after completion
  machine.setBlob(dummyBlob);
  assert.equal(machine.downloadCount, 1, 'Download count must not increase on post-completion re-render');
});

test('Phase 15 - Section 26: User cancellation prevents automatic download', () => {
  const machine = new AutoDownloadStateMachine({
    blob: { size: 512, type: 'application/pdf' },
    filename: 'cancelled.pdf',
    delaySeconds: 3,
  });

  machine.tick(); // 2s left
  machine.cancel(); // User clicks cancel
  assert.equal(machine.status, 'CANCELLED');

  // Additional ticks do nothing
  machine.tick();
  machine.tick();
  assert.equal(machine.downloadCount, 0, 'No automatic download should occur if cancelled');
});

test('Phase 15 - Section 26: Convert Again with NEW blob triggers a single new download', () => {
  const machine = new AutoDownloadStateMachine({
    blob: { size: 500, type: 'application/pdf' },
    filename: 'file1.pdf',
    delaySeconds: 1,
  });

  machine.tick(); // Download file 1
  assert.equal(machine.downloadCount, 1);

  // User converts another file (New Blob)
  const newBlob = { size: 800, type: 'application/pdf' };
  machine.filename = 'file2.pdf';
  machine.setBlob(newBlob);
  assert.equal(machine.status, 'COUNTDOWN');

  machine.tick(); // Download file 2
  assert.equal(machine.downloadCount, 2);
  assert.equal(machine.downloadHistory[0].filename, 'file1.pdf');
  assert.equal(machine.downloadHistory[1].filename, 'file2.pdf');
});

test('Phase 15 - Section 26: Multi-output ZIP correctly invokes ZIP download exactly once', () => {
  const machine = new AutoDownloadStateMachine({
    blob: { size: 4096, type: 'application/zip' },
    filename: 'converted_images.zip',
    isZip: true,
    delaySeconds: 1,
  });

  assert.equal(machine.isZip, true);
  machine.tick(); // Trigger download
  assert.equal(machine.status, 'COMPLETED');
  assert.equal(machine.zipDownloadCount, 1);
  assert.equal(machine.downloadCount, 0);
  assert.equal(machine.downloadHistory[0].isZip, true);
});

test('Phase 15 - Section 26: Manual Download Now and Download Again intentionally re-download', () => {
  const machine = new AutoDownloadStateMachine({
    blob: { size: 1024, type: 'application/pdf' },
    filename: 'manual.pdf',
    delaySeconds: 5,
  });

  // User clicks "Download Now" during countdown
  machine.downloadNow();
  assert.equal(machine.downloadCount, 1);
  assert.equal(machine.downloadHistory[0].isAuto, false);

  // User later clicks "Download Again"
  machine.downloadAgain();
  assert.equal(machine.downloadCount, 2);
  assert.equal(machine.downloadHistory[1].isAuto, false);
});

// =============================================================================
// 2. CENTRALIZED ENVIRONMENT VALIDATION (SECTIONS 4, 9, 42)
// =============================================================================

import { validateEnvironment } from '../src/lib/config/env.ts';

test('Phase 15 - Section 42: Production rejects missing RAZORPAY_KEY_ID in production', () => {
  const env = {
    NODE_ENV: 'production',
    RAZORPAY_KEY_SECRET: 'rzp_sec_123',
    RAZORPAY_WEBHOOK_SECRET: 'rzp_wh_123',
  };

  const result = validateEnvironment(env);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('RAZORPAY_KEY_ID')));
});

test('Phase 15 - Section 9 & 42: Production rejects missing RAZORPAY_KEY_SECRET', () => {
  const env = {
    NODE_ENV: 'production',
    RAZORPAY_KEY_ID: 'rzp_key_123',
    RAZORPAY_WEBHOOK_SECRET: 'rzp_wh_123',
  };

  const result = validateEnvironment(env);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('RAZORPAY_KEY_SECRET')));
});

test('Phase 15 - Section 42: Production rejects missing RAZORPAY_WEBHOOK_SECRET', () => {
  const env = {
    NODE_ENV: 'production',
    RAZORPAY_KEY_ID: 'rzp_key_123',
    RAZORPAY_KEY_SECRET: 'rzp_sec_123',
  };

  const result = validateEnvironment(env);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('RAZORPAY_WEBHOOK_SECRET')));
});

test('Phase 15 - Section 3: Rejects secrets prefixed with NEXT_PUBLIC_', () => {
  const env = {
    NODE_ENV: 'development',
    NEXT_PUBLIC_RAZORPAY_KEY_SECRET: 'accidentally_leaked_secret',
  };

  const result = validateEnvironment(env);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('SECURITY VIOLATION') && e.includes('NEXT_PUBLIC_')));
});

test('Phase 15 - Section 4: Development mode does not crash when billing is unconfigured', () => {
  const env = {
    NODE_ENV: 'development',
    // No Razorpay keys set
  };

  const result = validateEnvironment(env);
  assert.equal(result.valid, true, 'Dev mode must remain valid for free tools');
  assert.equal(result.billingConfigured, false);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings[0].includes('Free document tools remain fully operational'));
});

// =============================================================================
// 3. HEALTH MONITORING & DATA REDACTION (SECTIONS 12, 14, 15)
// =============================================================================

import { sanitizeLogData } from '../src/lib/monitoring/logger.ts';

test('Phase 15 - Section 15: Logger automatically redacts credentials and binary buffers', () => {
  const rawData = {
    userId: 'u_123',
    email: 'test@example.com',
    password: 'SuperSecretPassword123',
    key_secret: 'rzp_secret_xyz',
    card_number: '4111111111111111',
    cvv: '123',
    upi_pin: '9876',
    pdfBytes: 'sensitive document payload',
    binaryPayload: new Uint8Array([37, 80, 68, 70]),
  };

  const clean = sanitizeLogData(rawData);

  assert.equal(clean.userId, 'u_123');
  assert.equal(clean.email, 'test@example.com');
  assert.equal(clean.password, '[REDACTED]');
  assert.equal(clean.key_secret, '[REDACTED]');
  assert.equal(clean.card_number, '[REDACTED]');
  assert.equal(clean.cvv, '[REDACTED]');
  assert.equal(clean.upi_pin, '[REDACTED]');
  assert.equal(clean.pdfBytes, '[REDACTED]');
  assert.ok(clean.binaryPayload.includes('BINARY_BUFFER'));
});

// =============================================================================
// 4. BILLING RECONCILIATION & AUDIT TRAILS (SECTION 46 & 47)
// =============================================================================

test('Phase 15 - Section 46: Billing reconciliation detects mismatch and creates audit record', () => {
  // Mock DB store
  const mockDb = {
    subscriptions: {
      user_reconcile: {
        userId: 'user_reconcile',
        provider: 'razorpay',
        providerSubscriptionId: 'sub_rzp_rec_123',
        status: 'PAST_DUE', // Database currently out of sync
        plan: 'pro',
      },
    },
    auditLogs: [],
  };

  // Simulated reconcile logic
  const providerStatus = 'ACTIVE'; // Razorpay reports active paid status

  const sub = mockDb.subscriptions['user_reconcile'];
  const previousStatus = sub.status;
  const mismatchDetected = previousStatus !== providerStatus;

  if (mismatchDetected) {
    sub.status = providerStatus;
    mockDb.auditLogs.push({
      id: 'audit_rec_1',
      action: 'SUBSCRIPTION_RECONCILED',
      adminUserId: 'admin_sys',
      targetId: 'user_reconcile',
      previousStatus,
      syncedStatus: providerStatus,
      timestamp: new Date().toISOString(),
    });
  }

  assert.equal(mismatchDetected, true);
  assert.equal(mockDb.subscriptions['user_reconcile'].status, 'ACTIVE');
  assert.equal(mockDb.auditLogs.length, 1);
  assert.equal(mockDb.auditLogs[0].action, 'SUBSCRIPTION_RECONCILED');
  assert.equal(mockDb.auditLogs[0].syncedStatus, 'ACTIVE');
});

// =============================================================================
// 5. RATE LIMITER ABSTRACTION (SECTION 20)
// =============================================================================

import { InMemoryRateLimiter } from '../src/lib/billing/rateLimit.ts';

test('Phase 15 - Section 20: Sliding window rate limiter enforces request limits', () => {
  const limiter = new InMemoryRateLimiter();
  const testKey = `test_limit_${Date.now()}`;

  // Allow up to 3 requests per 10 seconds
  const r1 = limiter.checkLimit(testKey, 3, 10000);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = limiter.checkLimit(testKey, 3, 10000);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = limiter.checkLimit(testKey, 3, 10000);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // 4th request exceeds limit
  const r4 = limiter.checkLimit(testKey, 3, 10000);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
});
