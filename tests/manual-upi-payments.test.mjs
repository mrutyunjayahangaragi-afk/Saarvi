import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Saarvi Pro Manual UPI Payments & 2-Hour Review SLA Behavioral Test Suite
// ============================================================================

// 1. UPI Intent & VPA Logic Under Test
function isValidUpiId(upiId) {
  if (!upiId || typeof upiId !== 'string') return false;
  const clean = upiId.trim();
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/;
  return upiRegex.test(clean);
}

function generatePaymentReference() {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SAARVI-UPI-${timestampPart}${randomPart}`;
}

function createUpiPaymentIntent(options) {
  const {
    provider,
    amount,
    currency = 'INR',
    payeeUpiId,
    payeeName = 'Saarvi',
    transactionReference,
  } = options;

  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  if (!isValidUpiId(payeeUpiId)) {
    throw new Error(`Invalid payee UPI ID format: "${payeeUpiId}".`);
  }

  const params = new URLSearchParams({
    pa: payeeUpiId.trim(),
    pn: payeeName.trim(),
    am: amount.toFixed(2),
    cu: currency.toUpperCase(),
    tn: transactionReference.trim(),
  });

  const queryString = params.toString();
  const universalUri = `upi://pay?${queryString}`;

  let intentUri = universalUri;
  switch (provider) {
    case 'PHONEPE':
      intentUri = `phonepe://pay?${queryString}`;
      break;
    case 'GOOGLE_PAY':
      intentUri = `gpay://upi/pay?${queryString}`;
      break;
    case 'PAYTM':
      intentUri = `paytmmp://pay?${queryString}`;
      break;
    default:
      intentUri = universalUri;
      break;
  }

  return {
    provider,
    intentUri,
    universalUri,
    payeeUpiId: payeeUpiId.trim(),
    amount,
    currency,
    transactionReference,
    formattedAmount: `₹${amount}`,
  };
}

// 2. In-Memory Authoritative Store Simulation for Testing
const DEFAULT_CONFIG = {
  id: 'default',
  upiId: 'saarvi@upi',
  payeeName: 'Saarvi Educational Services',
  amountMonthly: 49,
  amountYearly: 399,
  currency: 'INR',
  reviewSlaHours: 2,
  instructions: 'Pay via any UPI app and submit 12-digit UTR',
  supportEmail: 'payments@saarvi.app',
  status: 'ACTIVE',
};

class MockPaymentStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.config = { ...DEFAULT_CONFIG };
    this.requests = new Map();
    this.subscriptions = new Map();
    this.invoices = [];
    this.locks = new Map();
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates, admin) {
    this.config = {
      ...this.config,
      ...updates,
      updatedBy: admin.email,
    };
    return { ...this.config };
  }

  async acquireLock(key) {
    while (this.locks.get(key)) {
      await new Promise((r) => setTimeout(r, 10));
    }
    this.locks.set(key, true);
  }

  releaseLock(key) {
    this.locks.delete(key);
  }

  async createPaymentRequest(data) {
    const { userId, userEmail, planDuration, utrNumber, payerUpiId } = data;

    // Duplicate check
    for (const req of this.requests.values()) {
      if (req.userId === userId && req.status === 'PENDING') {
        throw new Error('You already have an active payment request in review.');
      }
    }

    const id = generatePaymentReference();
    const amount = planDuration === 'MONTHLY' ? this.config.amountMonthly : this.config.amountYearly;
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + this.config.reviewSlaHours * 60 * 60 * 1000).toISOString();

    const record = {
      id,
      userId,
      userEmail,
      planDuration,
      amount,
      currency: this.config.currency,
      payeeUpiId: this.config.upiId,
      utrNumber,
      payerUpiId,
      status: 'PENDING',
      slaDeadline,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.requests.set(id, record);
    return record;
  }

  calculateSlaStatus(req) {
    const deadline = new Date(req.slaDeadline).getTime();
    const now = Date.now();
    const remainingMinutes = Math.floor((deadline - now) / (1000 * 60));
    return {
      isOverdue: remainingMinutes < 0,
      remainingMinutes,
    };
  }

  async approveRequest(requestId, admin, reviewNotes) {
    const lockKey = `lock:approval:${requestId}`;
    await this.acquireLock(lockKey);
    try {
      const req = this.requests.get(requestId);
      if (!req) throw new Error('Payment request not found.');
      if (req.status !== 'PENDING') {
        throw new Error(`Payment request is already processed with status: ${req.status}`);
      }

      const now = new Date();
      const periodEnd = new Date(now);
      if (req.planDuration === 'MONTHLY') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      const subId = `sub_${Date.now()}`;
      const subscription = {
        id: subId,
        userId: req.userId,
        provider: 'manual_upi',
        plan: 'pro',
        status: 'ACTIVE',
        billingInterval: req.planDuration.toLowerCase(),
        amountCents: Math.round(req.amount * 100),
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      };
      this.subscriptions.set(req.userId, subscription);

      const invoiceId = `inv_${Date.now()}`;
      this.invoices.push({
        id: invoiceId,
        userId: req.userId,
        amountPaid: Math.round(req.amount * 100),
        currency: req.currency,
        status: 'paid',
        providerInvoiceId: req.utrNumber,
        paidAt: now.toISOString(),
      });

      req.status = 'APPROVED';
      req.reviewedAt = now.toISOString();
      req.reviewedBy = admin.email;
      req.reviewNotes = reviewNotes;
      req.subscriptionId = subId;
      req.updatedAt = now.toISOString();

      return req;
    } finally {
      this.releaseLock(lockKey);
    }
  }

  async rejectRequest(requestId, admin, reviewNotes) {
    const req = this.requests.get(requestId);
    if (!req) throw new Error('Payment request not found.');
    if (req.status !== 'PENDING') {
      throw new Error(`Payment request is already processed with status: ${req.status}`);
    }

    req.status = 'REJECTED';
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = admin.email;
    req.reviewNotes = reviewNotes;
    req.updatedAt = new Date().toISOString();

    return req;
  }
}

describe('Saarvi Pro Manual UPI Payments & SLA Testing', () => {
  let store;

  beforeEach(() => {
    store = new MockPaymentStore();
  });

  describe('UPI Intent & VPA Syntax Validation', () => {
    test('validates authentic UPI Virtual Payment Address (VPA)', () => {
      assert.strictEqual(isValidUpiId('saarvi@upi'), true);
      assert.strictEqual(isValidUpiId('admin.saarvi@okhdfcbank'), true);
      assert.strictEqual(isValidUpiId('student123@icici'), true);
      assert.strictEqual(isValidUpiId('invalid-upi'), false);
      assert.strictEqual(isValidUpiId(''), false);
      assert.strictEqual(isValidUpiId('user@'), false);
      assert.strictEqual(isValidUpiId('@bank'), false);
    });

    test('generates unique transaction reference', () => {
      const ref1 = generatePaymentReference();
      const ref2 = generatePaymentReference();
      assert.match(ref1, /^SAARVI-UPI-[A-Z0-9]+$/);
      assert.match(ref2, /^SAARVI-UPI-[A-Z0-9]+$/);
      assert.notStrictEqual(ref1, ref2);
    });

    test('generates compliant PhonePe deep-link URI', () => {
      const intent = createUpiPaymentIntent({
        provider: 'PHONEPE',
        plan: 'monthly',
        amount: 49,
        payeeUpiId: 'saarvi@upi',
        payeeName: 'Saarvi',
        transactionReference: 'SAARVI-UPI-TEST1',
      });

      assert.match(intent.intentUri, /^phonepe:\/\/pay\?/);
      assert.ok(intent.intentUri.includes('pa=saarvi%40upi'));
      assert.ok(intent.intentUri.includes('am=49.00'));
      assert.ok(intent.intentUri.includes('cu=INR'));
      assert.ok(intent.intentUri.includes('tn=SAARVI-UPI-TEST1'));
      assert.strictEqual(intent.universalUri.startsWith('upi://pay?'), true);
    });

    test('generates compliant Google Pay deep-link URI', () => {
      const intent = createUpiPaymentIntent({
        provider: 'GOOGLE_PAY',
        plan: 'yearly',
        amount: 399,
        payeeUpiId: 'saarvi@okhdfcbank',
        payeeName: 'Saarvi Education',
        transactionReference: 'SAARVI-UPI-GPAY1',
      });

      assert.match(intent.intentUri, /^gpay:\/\/upi\/pay\?/);
      assert.ok(intent.intentUri.includes('pa=saarvi%40okhdfcbank'));
      assert.ok(intent.intentUri.includes('am=399.00'));
    });

    test('generates compliant Paytm deep-link URI', () => {
      const intent = createUpiPaymentIntent({
        provider: 'PAYTM',
        plan: 'monthly',
        amount: 49,
        payeeUpiId: 'saarvi@paytm',
        payeeName: 'Saarvi',
        transactionReference: 'SAARVI-UPI-PAYTM1',
      });

      assert.match(intent.intentUri, /^paytmmp:\/\/pay\?/);
      assert.ok(intent.intentUri.includes('pa=saarvi%40paytm'));
    });

    test('rejects negative or zero payment amount', () => {
      assert.throws(() => {
        createUpiPaymentIntent({
          provider: 'PHONEPE',
          plan: 'monthly',
          amount: 0,
          payeeUpiId: 'saarvi@upi',
          transactionReference: 'TEST',
        });
      }, /Payment amount must be greater than zero/);
    });
  });

  describe('Payment Store & Server Authority', () => {
    test('initializes default payment configuration with ₹49/mo and ₹399/yr', () => {
      const config = store.getConfig();
      assert.strictEqual(config.amountMonthly, 49);
      assert.strictEqual(config.amountYearly, 399);
      assert.strictEqual(config.upiId, 'saarvi@upi');
      assert.strictEqual(config.currency, 'INR');
      assert.strictEqual(config.reviewSlaHours, 2);
    });

    test('super admin updates configuration securely', () => {
      const admin = { id: 'admin-1', email: 'admin@saarvi.app', role: 'SUPER_ADMIN' };
      const updated = store.updateConfig(
        { amountMonthly: 59, upiId: 'saarvi.pro@icici' },
        admin
      );
      assert.strictEqual(updated.amountMonthly, 59);
      assert.strictEqual(updated.upiId, 'saarvi.pro@icici');
      assert.strictEqual(updated.updatedBy, 'admin@saarvi.app');
    });

    test('creates payment request with server-authoritative snapshot and 2-hour SLA', async () => {
      const request = await store.createPaymentRequest({
        userId: 'student-101',
        userEmail: 'student@vtu.ac.in',
        planDuration: 'MONTHLY',
        utrNumber: 'UTR492819381290',
        payerUpiId: 'student@oksbi',
      });

      assert.strictEqual(request.userId, 'student-101');
      assert.strictEqual(request.userEmail, 'student@vtu.ac.in');
      assert.strictEqual(request.amount, 49);
      assert.strictEqual(request.payeeUpiId, 'saarvi@upi');
      assert.strictEqual(request.status, 'PENDING');
      assert.match(request.id, /^SAARVI-UPI-[A-Z0-9]+$/);

      // Verify 2-hour SLA deadline
      const createdTime = new Date(request.createdAt).getTime();
      const slaTime = new Date(request.slaDeadline).getTime();
      const diffHours = (slaTime - createdTime) / (1000 * 60 * 60);
      assert.strictEqual(Math.round(diffHours), 2);
    });

    test('prevents duplicate active payment requests for the same user', async () => {
      await store.createPaymentRequest({
        userId: 'student-dup',
        userEmail: 'dup@vtu.ac.in',
        planDuration: 'MONTHLY',
        utrNumber: 'UTR111222333444',
      });

      await assert.rejects(async () => {
        await store.createPaymentRequest({
          userId: 'student-dup',
          userEmail: 'dup@vtu.ac.in',
          planDuration: 'YEARLY',
          utrNumber: 'UTR555666777888',
        });
      }, /You already have an active payment request/);
    });

    test('correctly calculates SLA status and overdue flags', () => {
      const now = new Date();
      const futureDeadline = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

      const activeReq = {
        id: 'REQ-1',
        status: 'PENDING',
        slaDeadline: futureDeadline,
      };

      const overdueReq = {
        id: 'REQ-2',
        status: 'PENDING',
        slaDeadline: pastDeadline,
      };

      const slaActive = store.calculateSlaStatus(activeReq);
      assert.strictEqual(slaActive.isOverdue, false);
      assert.ok(slaActive.remainingMinutes > 0);

      const slaOverdue = store.calculateSlaStatus(overdueReq);
      assert.strictEqual(slaOverdue.isOverdue, true);
      assert.ok(slaOverdue.remainingMinutes < 0);
    });

    test('approves payment, activates Pro subscription and creates invoice', async () => {
      const admin = { id: 'admin-1', email: 'admin@saarvi.app', role: 'SUPER_ADMIN' };
      const req = await store.createPaymentRequest({
        userId: 'student-pro',
        userEmail: 'prostudent@vtu.ac.in',
        planDuration: 'YEARLY',
        utrNumber: 'UTR999888777666',
      });

      const approved = await store.approveRequest(req.id, admin, 'Verified on HDFC account');

      assert.strictEqual(approved.status, 'APPROVED');
      assert.strictEqual(approved.reviewedBy, 'admin@saarvi.app');
      assert.ok(approved.subscriptionId);

      // Verify user's subscription in authoritative store
      const sub = store.subscriptions.get('student-pro');
      assert.ok(sub);
      assert.strictEqual(sub.status, 'ACTIVE');
      assert.strictEqual(sub.billingInterval, 'yearly');
      assert.strictEqual(sub.provider, 'manual_upi');
    });

    test('rejects payment with reason and does NOT activate Pro', async () => {
      const admin = { id: 'admin-1', email: 'admin@saarvi.app', role: 'SUPER_ADMIN' };
      const req = await store.createPaymentRequest({
        userId: 'student-reject',
        userEmail: 'reject@vtu.ac.in',
        planDuration: 'MONTHLY',
        utrNumber: 'UTR000000000000',
      });

      const rejected = await store.rejectRequest(req.id, admin, 'UTR not found on bank statement');

      assert.strictEqual(rejected.status, 'REJECTED');
      assert.strictEqual(rejected.reviewNotes, 'UTR not found on bank statement');
      assert.strictEqual(rejected.subscriptionId, undefined);

      // Pro must NOT be active
      const sub = store.subscriptions.get('student-reject');
      assert.strictEqual(sub, undefined);
    });

    test('maintains concurrency mutex locking preventing double-approval', async () => {
      const admin = { id: 'admin-1', email: 'admin@saarvi.app', role: 'SUPER_ADMIN' };
      const req = await store.createPaymentRequest({
        userId: 'student-race',
        userEmail: 'race@vtu.ac.in',
        planDuration: 'MONTHLY',
        utrNumber: 'UTR123456789012',
      });

      // Fire 2 approvals concurrently
      const results = await Promise.allSettled([
        store.approveRequest(req.id, admin, 'First approval'),
        store.approveRequest(req.id, admin, 'Second approval'),
      ]);

      // Exactly one succeeds, the other fails with "is already processed"
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1);
      assert.strictEqual(rejected.length, 1);
      assert.match(rejected[0].reason.message, /already processed/);
    });
  });
});
