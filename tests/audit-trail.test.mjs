import test from 'node:test';
import assert from 'node:assert/strict';

class AppendOnlyAuditLedger {
  #logs = [];

  append(entry) {
    // Validate required fields
    if (!entry.adminUserId || !entry.adminEmail || !entry.action || !entry.targetType || !entry.targetId) {
      throw new Error('Audit entry missing mandatory structural fields.');
    }

    // Privacy & Security Assertion: Section 51 & 59 (Never store credentials or document content)
    const rawMetadataStr = JSON.stringify(entry.metadata || {});
    const forbiddenKeywords = ['password', 'passwordHash', 'token', 'pdfBytes', 'documentContent', 'resumeText'];
    for (const forbidden of forbiddenKeywords) {
      if (rawMetadataStr.toLowerCase().includes(forbidden.toLowerCase())) {
        throw new Error(`Security Violation: Audit record metadata must never contain "${forbidden}".`);
      }
    }

    const immutableRecord = Object.freeze({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      adminUserId: entry.adminUserId,
      adminEmail: entry.adminEmail,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: Object.freeze({ ...(entry.metadata || {}) }),
      timestamp: new Date().toISOString(),
    });

    this.#logs.push(immutableRecord);
    return immutableRecord;
  }

  getAll() {
    // Return frozen shallow copies to prevent tampering
    return [...this.#logs];
  }
}

test('Section 58 & 59: Audit Log Structure & Validation', () => {
  const ledger = new AppendOnlyAuditLedger();

  const record = ledger.append({
    adminUserId: 'admin_123',
    adminEmail: 'admin@docease.com',
    action: 'TOOL_DISABLED',
    targetType: 'TOOL',
    targetId: 'compress-pdf',
    metadata: { reason: 'Scheduled worker memory upgrade' },
  });

  assert.ok(record.id.startsWith('audit_'));
  assert.equal(record.adminUserId, 'admin_123');
  assert.equal(record.adminEmail, 'admin@docease.com');
  assert.equal(record.action, 'TOOL_DISABLED');
  assert.equal(record.targetType, 'TOOL');
  assert.equal(record.targetId, 'compress-pdf');
  assert.ok(record.timestamp);
});

test('Section 51 & 59: Privacy & Security — Rejects Passwords, Tokens, or Document Content', () => {
  const ledger = new AppendOnlyAuditLedger();

  // Attempting to log a password
  assert.throws(() => {
    ledger.append({
      adminUserId: 'admin_123',
      adminEmail: 'admin@docease.com',
      action: 'USER_LOGIN',
      targetType: 'USER',
      targetId: 'user_456',
      metadata: { password: 'secretPassword123' },
    });
  }, /Security Violation/);

  // Attempting to log document content
  assert.throws(() => {
    ledger.append({
      adminUserId: 'admin_123',
      adminEmail: 'admin@docease.com',
      action: 'TOOL_USED',
      targetType: 'TOOL',
      targetId: 'jpg-to-pdf',
      metadata: { documentContent: 'base64...' },
    });
  }, /Security Violation/);
});

test('Section 60: Audit Log Immutability (Append-only records cannot be silently mutated)', () => {
  const ledger = new AppendOnlyAuditLedger();

  const record = ledger.append({
    adminUserId: 'admin_123',
    adminEmail: 'admin@docease.com',
    action: 'CURRICULUM_ACTIVATED',
    targetType: 'CURRICULUM',
    targetId: 'vtu-2022-cse-s3',
    metadata: { scheme: '2022', branch: 'CSE' },
  });

  // Attempt to mutate record properties throws in strict mode
  assert.throws(() => {
    record.action = 'TAMPERED_ACTION';
  }, TypeError);

  assert.throws(() => {
    record.metadata.tampered = true;
  }, TypeError);
});
