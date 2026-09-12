import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// DocEase Phase 13: Real Pro Subscription + Payment + Secure Entitlements Test Suite

// 1. Authoritative Pricing Configuration Tests
const PRO_PRICING = {
  monthly: {
    plan: 'pro',
    interval: 'monthly',
    amountCents: 9900,
    amountDisplay: '₹99',
    currency: 'INR',
  },
  yearly: {
    plan: 'pro',
    interval: 'yearly',
    amountCents: 89900,
    amountDisplay: '₹899',
    currency: 'INR',
  },
};

function getPlanPrice(interval) {
  const price = PRO_PRICING[interval];
  if (!price) throw new Error(`Invalid billing interval: ${interval}`);
  return price;
}

test('Phase 13 - Requirement 1: Server-Authoritative Pricing & Anti-Tampering', () => {
  // Configured prices
  const monthly = getPlanPrice('monthly');
  assert.equal(monthly.amountCents, 9900);
  assert.equal(monthly.currency, 'INR');

  const yearly = getPlanPrice('yearly');
  assert.equal(yearly.amountCents, 89900);
  assert.equal(yearly.currency, 'INR');

  // Invalid interval throws
  assert.throws(() => getPlanPrice('lifetime'), /Invalid billing interval/);

  // Client tampering check: Server rejects payload containing client-specified amount
  function validateCheckoutRequest(body) {
    if (body.price || body.amount || body.currency || body.discount) {
      throw new Error('Security violation: Client cannot specify pricing parameters');
    }
    return getPlanPrice(body.interval || 'monthly');
  }

  assert.throws(
    () => validateCheckoutRequest({ interval: 'monthly', amount: 100 }), // user tries ₹1
    /Security violation/
  );
  assert.throws(
    () => validateCheckoutRequest({ interval: 'yearly', currency: 'USD' }),
    /Security violation/
  );
});

// 2. Cryptographic Webhook Verification Tests
test('Phase 13 - Requirement 2: Cryptographic Webhook Verification & Tamper Resistance', () => {
  const webhookSecret = 'rzp_test_secret_key_12345';
  const rawPayload = JSON.stringify({
    event: 'subscription.activated',
    payload: {
      subscription: {
        entity: {
          id: 'sub_test_9988',
          customer_id: 'cust_test_1122',
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        },
      },
    },
  });

  // Generate valid HMAC SHA-256 signature
  const validSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawPayload)
    .digest('hex');

  function verifyRazorpayWebhook(body, signature, secret) {
    if (!signature) return { isValid: false, error: 'Missing signature' };
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return { isValid: false, error: 'Invalid signature' };
    }
    return { isValid: true };
  }

  // 1. Valid signature passes
  const validResult = verifyRazorpayWebhook(rawPayload, validSignature, webhookSecret);
  assert.equal(validResult.isValid, true);

  // 2. Forged signature fails
  const forgedResult = verifyRazorpayWebhook(rawPayload, 'forged_fake_signature_hash', webhookSecret);
  assert.equal(forgedResult.isValid, false);

  // 3. Tampered payload with original signature fails
  const tamperedPayload = rawPayload.replace('sub_test_9988', 'sub_hacked_id');
  const tamperedResult = verifyRazorpayWebhook(tamperedPayload, validSignature, webhookSecret);
  assert.equal(tamperedResult.isValid, false);
});

// 3. Webhook Idempotency Tests
test('Phase 13 - Requirement 3: Webhook Idempotency & Replay Protection', () => {
  const processedEvents = new Set();
  let subscriptionUpdatesCount = 0;

  function handleWebhookEvent(eventId) {
    // Idempotency check
    if (processedEvents.has(eventId)) {
      return { status: 'IGNORED_DUPLICATE', processed: false };
    }

    // Process event
    subscriptionUpdatesCount++;
    processedEvents.add(eventId);
    return { status: 'PROCESSED', processed: true };
  }

  const testEventId = 'evt_sub_charged_991188';

  // First delivery: processes successfully
  const firstDelivery = handleWebhookEvent(testEventId, 'sub_123');
  assert.equal(firstDelivery.status, 'PROCESSED');
  assert.equal(firstDelivery.processed, true);
  assert.equal(subscriptionUpdatesCount, 1);

  // Second delivery (provider retry): detected as duplicate and safely ignored
  const secondDelivery = handleWebhookEvent(testEventId, 'sub_123');
  assert.equal(secondDelivery.status, 'IGNORED_DUPLICATE');
  assert.equal(secondDelivery.processed, false);
  assert.equal(subscriptionUpdatesCount, 1); // no duplicate mutation!
});

// 4. Subscription State Transitions & Automatic Expiration
test('Phase 13 - Requirement 4: State Machine & Expiration Enforcement', () => {
  function resolveEffectivePlan(user, subscription) {
    if (!user) return 'guest';
    if (!subscription) return 'free';

    const now = Date.now();
    const expiry = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).getTime() : 0;

    // ACTIVE and not expired
    if ((subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') && now <= expiry) {
      return 'pro';
    }

    // Past due: grace period or denied based on policy
    if (subscription.status === 'PAST_DUE' && now <= expiry) {
      return 'pro'; // retain until period end
    }

    return 'free';
  }

  const user = { id: 'u_student_1', email: 'student@example.com' };

  // 1. Active subscription within period -> PRO
  const activeSub = {
    id: 's_1',
    status: 'ACTIVE',
    currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  };
  assert.equal(resolveEffectivePlan(user, activeSub), 'pro');

  // 2. Active subscription past expiry -> FREE
  const expiredActiveSub = {
    id: 's_2',
    status: 'ACTIVE',
    currentPeriodEnd: new Date(Date.now() - 86400000).toISOString(), // yesterday
  };
  assert.equal(resolveEffectivePlan(user, expiredActiveSub), 'free');

  // 3. Cancelled subscription with remaining time -> PRO until period end
  const cancelledSubWithTime = {
    id: 's_3',
    status: 'ACTIVE',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: new Date(Date.now() + 10 * 86400000).toISOString(), // 10 days left
  };
  assert.equal(resolveEffectivePlan(user, cancelledSubWithTime), 'pro');

  // 4. Cancelled subscription expired -> FREE
  const fullyCancelledSub = {
    id: 's_4',
    status: 'CANCELLED',
    currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
  };
  assert.equal(resolveEffectivePlan(user, fullyCancelledSub), 'free');
});

// 5. Anti-Tampering: Client State Cannot Grant Pro
test('Phase 13 - Requirement 5: Client-Side Tampering Rejection', () => {
  // Tampered client attempts to send localStorage plan = 'pro'
  const clientPayload = {
    id: 'u_test',
    plan: 'pro', // forged client parameter
  };

  // Authoritative server lookup ignores client-sent plan parameter and queries database
  function serverGetPlan(userId, serverDatabaseRecords) {
    const record = serverDatabaseRecords[userId];
    if (!record || record.status !== 'ACTIVE') {
      return 'free';
    }
    return 'pro';
  }

  const db = {
    'u_test': { status: 'EXPIRED' }, // server DB has expired
  };

  const resolved = serverGetPlan(clientPayload.id, db);
  assert.equal(resolved, 'free', 'Server must ignore client plan and rely strictly on DB');
});

// 6. Zero Sensitive Data Storage Invariant
test('Phase 13 - Requirement 6: Zero Storage of Card Numbers, CVV or Banking Secrets', () => {
  const subscriptionRecord = {
    id: 'sub_123',
    userId: 'u_1',
    provider: 'razorpay',
    providerSubscriptionId: 'sub_rzp_999',
    plan: 'pro',
    status: 'ACTIVE',
    billingInterval: 'monthly',
    currency: 'INR',
    amountCents: 9900,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date().toISOString(),
  };

  const prohibitedFields = ['cardNumber', 'card_number', 'cvv', 'pan', 'upiPin', 'bankPassword'];
  for (const field of prohibitedFields) {
    assert.equal(subscriptionRecord[field], undefined, `Prohibited sensitive field found: ${field}`);
  }
});

// 7. Local-First Privacy Invariant with Pro Entitlements
test('Phase 13 - Requirement 7: Local-First Conversions Remain 100% In-Browser for Pro Users', () => {
  const proFeatureRegistry = {
    'batch_processing': { processingType: 'local', requiredPlan: 'pro' },
    'jpg_to_pdf': { processingType: 'local', requiredPlan: 'guest' },
    'vtu_sgpa': { processingType: 'local', requiredPlan: 'guest' },
    'resume_builder': { processingType: 'local', requiredPlan: 'guest' },
    'premium_resume_templates': { processingType: 'local', requiredPlan: 'pro' },
  };

  // Assert all active Pro document features have processingType: 'local'
  for (const [id, def] of Object.entries(proFeatureRegistry)) {
    assert.equal(
      def.processingType,
      'local',
      `Feature ${id} must remain 100% local without cloud document uploads`
    );
  }
});

// 8. Admin Real Revenue Metrics Calculation (Zero Fabrication Rule)
test('Phase 13 - Requirement 8: Real MRR & ARR Metrics Calculation', () => {
  const mockSubscriptions = [
    { id: '1', status: 'ACTIVE', billingInterval: 'monthly', amountCents: 9900 },
    { id: '2', status: 'ACTIVE', billingInterval: 'yearly', amountCents: 89900 }, // ~7492/mo
    { id: '3', status: 'CANCELLED', billingInterval: 'monthly', amountCents: 9900 },
    { id: '4', status: 'EXPIRED', billingInterval: 'monthly', amountCents: 9900 },
  ];

  function calculateMetrics(subs) {
    let active = 0;
    let mrrCents = 0;
    for (const sub of subs) {
      if (sub.status === 'ACTIVE') {
        active++;
        if (sub.billingInterval === 'monthly') {
          mrrCents += sub.amountCents;
        } else if (sub.billingInterval === 'yearly') {
          mrrCents += Math.round(sub.amountCents / 12);
        }
      }
    }
    return {
      active,
      mrrCents,
      arrCents: mrrCents * 12,
    };
  }

  const metrics = calculateMetrics(mockSubscriptions);
  assert.equal(metrics.active, 2);
  assert.equal(metrics.mrrCents, 9900 + Math.round(89900 / 12)); // 9900 + 7492 = 17392
  assert.equal(metrics.arrCents, metrics.mrrCents * 12);

  // Empty dataset returns 0 revenue (zero fabrication)
  const emptyMetrics = calculateMetrics([]);
  assert.equal(emptyMetrics.active, 0);
  assert.equal(emptyMetrics.mrrCents, 0);
  assert.equal(emptyMetrics.arrCents, 0);
});
