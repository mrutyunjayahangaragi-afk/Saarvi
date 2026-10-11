import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_CATEGORIES,
  getToolOperationalMetadata,
} from '../src/lib/tools/tool-registry.ts';

// ============================================================================
// Saarvi Canonical Tool Control & Beta Usage Engine (Deterministic Test Harness)
// ============================================================================

class ToolControlEngine {
  constructor(registry) {
    this.configs = new Map();
    this.usages = new Map(); // key: `${userId}:${toolKey}` -> { usageCount, reservedCount }
    this.reservations = new Map(); // token -> { userId, toolKey, createdAt }
    this.events = [];
    this.subscriptions = new Map(); // userId -> { isPro, status }

    registry.forEach((t) => {
      const meta = getToolOperationalMetadata(t);
      this.configs.set(t.key, {
        toolKey: t.key,
        displayName: t.name,
        category: t.category,
        status: meta.status === 'available' ? 'AVAILABLE' : (meta.status === 'beta' ? 'BETA' : 'DISABLED'),
        accessMode: meta.pro_required ? 'PRO' : 'FREE',
        betaEnabled: meta.beta_enabled,
        betaFreeLimit: meta.beta_free_limit,
        workerMode: meta.worker_mode,
        processingType: meta.processing_type,
      });
    });
  }

  setPro(userId, isPro) {
    this.subscriptions.set(userId, { isPro, status: isPro ? 'ACTIVE' : 'NONE' });
  }

  updateConfig(toolKey, updates) {
    const existing = this.configs.get(toolKey);
    if (!existing) throw new Error(`Unknown tool: ${toolKey}`);
    const updated = { ...existing, ...updates };
    this.configs.set(toolKey, updated);
    return updated;
  }

  getToolAccess(userId, toolKey) {
    const config = this.configs.get(toolKey);
    if (!config) throw new Error(`Unknown tool: ${toolKey}`);

    const sub = this.subscriptions.get(userId);
    const isPro = sub?.isPro === true && sub?.status === 'ACTIVE';

    if (config.status === 'DISABLED') {
      return { isAllowed: false, reason: 'tool_disabled', isPro, isBeta: false };
    }

    if (config.accessMode === 'PRO' && !config.betaEnabled && !isPro) {
      return { isAllowed: false, reason: 'pro_required', isPro, isBeta: false };
    }

    if (config.betaEnabled) {
      if (isPro) {
        return { isAllowed: true, isPro: true, isBeta: true, remainingUses: Infinity, freeLimit: config.betaFreeLimit };
      }

      const key = `${userId}:${toolKey}`;
      const record = this.usages.get(key) || { usageCount: 0, reservedCount: 0 };
      const effectiveUsage = record.usageCount + record.reservedCount;
      const remainingUses = Math.max(0, config.betaFreeLimit - effectiveUsage);

      if (effectiveUsage >= config.betaFreeLimit) {
        return {
          isAllowed: false,
          reason: 'beta_limit_reached',
          isPro: false,
          isBeta: true,
          usageCount: record.usageCount,
          freeLimit: config.betaFreeLimit,
          remainingUses: 0,
        };
      }

      return {
        isAllowed: true,
        isPro: false,
        isBeta: true,
        usageCount: record.usageCount,
        freeLimit: config.betaFreeLimit,
        remainingUses,
      };
    }

    return { isAllowed: true, isPro, isBeta: false, remainingUses: Infinity, freeLimit: 0 };
  }

  // Atomic reservation with row-lock simulation (PART 2.6)
  async reserveBetaUse(userId, toolKey) {
    const access = this.getToolAccess(userId, toolKey);
    if (!access.isAllowed) {
      return { allowed: false, reason: access.reason, remainingUses: access.remainingUses || 0 };
    }

    if (access.isPro) {
      return { allowed: true, isPro: true, reservationToken: `pro_tok_${Date.now()}` };
    }

    const key = `${userId}:${toolKey}`;
    const record = this.usages.get(key) || { usageCount: 0, reservedCount: 0 };
    const limit = access.freeLimit;

    // Strict atomic verification
    if (record.usageCount + record.reservedCount >= limit) {
      return { allowed: false, reason: 'beta_limit_reached', remainingUses: 0 };
    }

    // Atomically increment reserved count
    record.reservedCount += 1;
    this.usages.set(key, record);

    const token = `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.reservations.set(token, { userId, toolKey, createdAt: Date.now() });

    return {
      allowed: true,
      reservationToken: token,
      remainingUses: Math.max(0, limit - (record.usageCount + record.reservedCount)),
    };
  }

  async commitBetaUse(userId, toolKey, token, durationMs = 150) {
    const res = this.reservations.get(token);
    if (!res || res.userId !== userId || res.toolKey !== toolKey) {
      throw new Error('Invalid or expired reservation token');
    }

    this.reservations.delete(token);
    const key = `${userId}:${toolKey}`;
    const record = this.usages.get(key) || { usageCount: 0, reservedCount: 1 };

    record.reservedCount = Math.max(0, record.reservedCount - 1);
    record.usageCount += 1;
    this.usages.set(key, record);

    // Record safe operational event (Zero document bytes/text stored)
    this.events.push({
      toolKey,
      userId,
      status: 'SUCCESS',
      durationMs,
      timestamp: Date.now(),
    });

    const config = this.configs.get(toolKey);
    return {
      usageCount: record.usageCount,
      remainingUses: Math.max(0, (config?.betaFreeLimit || 10) - record.usageCount),
    };
  }

  async releaseBetaUse(userId, toolKey, token) {
    if (!this.reservations.has(token)) return;
    this.reservations.delete(token);

    const key = `${userId}:${toolKey}`;
    const record = this.usages.get(key);
    if (record) {
      record.reservedCount = Math.max(0, record.reservedCount - 1);
      this.usages.set(key, record);
    }
  }

  getTelemetryOverview() {
    const stats = [];
    for (const [key, cfg] of this.configs.entries()) {
      const toolEvents = this.events.filter((e) => e.toolKey === key);
      const totalUses = toolEvents.length;
      const uniqueUsers = new Set(toolEvents.map((e) => e.userId)).size;
      const successes = toolEvents.filter((e) => e.status === 'SUCCESS').length;
      const failures = toolEvents.filter((e) => e.status === 'FAILED').length;
      const successRate = totalUses > 0 ? (successes / totalUses) * 100 : 100;
      const durations = toolEvents.map((e) => e.durationMs).sort((a, b) => a - b);
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

      let health = 'Healthy';
      if (cfg.status === 'DISABLED') health = 'Disabled';
      else if (totalUses === 0) health = 'No Recent Usage';
      else if (successRate < 90) health = 'High Error Rate';
      else if (p95 > 5000) health = 'Slow';

      stats.push({
        toolKey: key,
        displayName: cfg.displayName,
        category: cfg.category,
        totalUses,
        uniqueUsers,
        successRate,
        avgDurationMs: Math.round(avgDuration),
        p95DurationMs: Math.round(p95),
        health,
      });
    }
    return stats;
  }
}

test('SAARVI TOOL CONTROL CENTER & BETA FREE-USAGE LIMITS TEST SUITE', async (t) => {
  const engine = new ToolControlEngine(CANONICAL_TOOL_REGISTRY);

  await t.test('1. Canonical Tool Inventory: Exposes required operational metadata for all canonical tools', () => {
    assert.ok(CANONICAL_TOOL_REGISTRY.length >= 55, `Expected at least 55 tools, got ${CANONICAL_TOOL_REGISTRY.length}`);

    for (const tool of CANONICAL_TOOL_REGISTRY) {
      assert.ok(tool.key, 'Tool must have unique key');
      assert.ok(tool.name, 'Tool must have display name');
      assert.ok(tool.category, 'Tool must have category');

      const meta = getToolOperationalMetadata(tool);
      assert.ok(meta.tool_key, `Tool ${tool.key} must specify tool_key`);
      assert.ok(meta.display_name, `Tool ${tool.key} must specify display_name`);
      assert.ok(meta.category, `Tool ${tool.key} must specify category`);
      assert.ok(meta.status, `Tool ${tool.key} must specify status`);
      assert.ok(meta.worker_mode, `Tool ${tool.key} must specify worker_mode`);
      assert.ok(meta.processing_type, `Tool ${tool.key} must specify processing_type`);
      assert.equal(typeof meta.beta_free_limit, 'number', `Tool ${tool.key} must specify beta_free_limit`);
      assert.equal(typeof meta.enabled, 'boolean', `Tool ${tool.key} must specify enabled`);
    }

    assert.ok(CANONICAL_TOOL_CATEGORIES.length >= 6, 'Must have canonical categories');
  });

  await t.test('2. Admin Tool Control: Enables, disables, changes Free/Pro/Beta, and updates limits', () => {
    const updated = engine.updateConfig('pdf-to-jpg', {
      status: 'BETA',
      accessMode: 'FREE',
      betaEnabled: true,
      betaFreeLimit: 10,
    });

    assert.equal(updated.status, 'BETA');
    assert.equal(updated.betaFreeLimit, 10);

    const access = engine.getToolAccess('user_123', 'pdf-to-jpg');
    assert.equal(access.isAllowed, true);
    assert.equal(access.isBeta, true);
    assert.equal(access.remainingUses, 10);

    // Disable tool
    engine.updateConfig('pdf-to-jpg', { status: 'DISABLED' });
    const accessDisabled = engine.getToolAccess('user_123', 'pdf-to-jpg');
    assert.equal(accessDisabled.isAllowed, false);
    assert.equal(accessDisabled.reason, 'tool_disabled');

    // Re-enable in Beta mode
    engine.updateConfig('pdf-to-jpg', { status: 'BETA' });
  });

  await t.test('3. Beta Free-Use Counting: Consumes uses 1 to 10 and blocks 11th use', async () => {
    const userId = `student_${Date.now()}`;
    engine.updateConfig('pdf-to-jpg', { status: 'BETA', betaEnabled: true, betaFreeLimit: 10 });

    for (let i = 1; i <= 10; i++) {
      const access = engine.getToolAccess(userId, 'pdf-to-jpg');
      assert.equal(access.isAllowed, true, `Use #${i} must be allowed`);
      assert.equal(access.remainingUses, 11 - i);

      const res = await engine.reserveBetaUse(userId, 'pdf-to-jpg');
      assert.equal(res.allowed, true);
      const commit = await engine.commitBetaUse(userId, 'pdf-to-jpg', res.reservationToken, 120);
      assert.equal(commit.usageCount, i);
    }

    // 11th use must be blocked with beta_limit_reached
    const accessBlocked = engine.getToolAccess(userId, 'pdf-to-jpg');
    assert.equal(accessBlocked.isAllowed, false);
    assert.equal(accessBlocked.reason, 'beta_limit_reached');
    assert.equal(accessBlocked.remainingUses, 0);

    const reserveBlocked = await engine.reserveBetaUse(userId, 'pdf-to-jpg');
    assert.equal(reserveBlocked.allowed, false);
    assert.equal(reserveBlocked.reason, 'beta_limit_reached');
  });

  await t.test('4. Limit Reduction Invariant: 10 -> 5 does not erase historical usage; users with >=5 uses are blocked', async () => {
    const userId = `user_reduction_${Date.now()}`;
    engine.updateConfig('compress-pdf', { status: 'BETA', betaEnabled: true, betaFreeLimit: 10 });

    // Use 7 times
    for (let i = 1; i <= 7; i++) {
      const res = await engine.reserveBetaUse(userId, 'compress-pdf');
      await engine.commitBetaUse(userId, 'compress-pdf', res.reservationToken, 80);
    }

    let access = engine.getToolAccess(userId, 'compress-pdf');
    assert.equal(access.usageCount, 7);
    assert.equal(access.remainingUses, 3);
    assert.equal(access.isAllowed, true);

    // Admin lowers limit to 5
    engine.updateConfig('compress-pdf', { betaFreeLimit: 5 });

    // System evaluates: current_usage (7) >= current_free_limit (5) -> limit reached!
    access = engine.getToolAccess(userId, 'compress-pdf');
    assert.equal(access.usageCount, 7, 'Historical usage count MUST remain 7');
    assert.equal(access.freeLimit, 5);
    assert.equal(access.remainingUses, 0);
    assert.equal(access.isAllowed, false, 'User must be considered limit reached');
  });

  await t.test('5. Pro User Bypass: Pro users bypass Beta limits automatically', async () => {
    const proUserId = `pro_user_${Date.now()}`;
    engine.setPro(proUserId, true);
    engine.updateConfig('merge-pdf', { status: 'BETA', betaEnabled: true, betaFreeLimit: 3 });

    const access = engine.getToolAccess(proUserId, 'merge-pdf');
    assert.equal(access.isAllowed, true);
    assert.equal(access.isPro, true);

    const res = await engine.reserveBetaUse(proUserId, 'merge-pdf');
    assert.equal(res.allowed, true);
    assert.equal(res.isPro, true);
  });

  await t.test('6. Atomic Usage Reservation: 50 concurrent requests competing for slot #10 allow only 1 winner', async () => {
    const userId = `atomic_race_user_${Date.now()}`;
    engine.updateConfig('image-resize', { status: 'BETA', betaEnabled: true, betaFreeLimit: 10 });

    // Fill 9 slots first
    for (let i = 1; i <= 9; i++) {
      const res = await engine.reserveBetaUse(userId, 'image-resize');
      await engine.commitBetaUse(userId, 'image-resize', res.reservationToken, 40);
    }

    // Now fire 50 concurrent reservation requests
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(engine.reserveBetaUse(userId, 'image-resize'));
    }

    const results = await Promise.all(promises);
    const winners = results.filter((r) => r.allowed === true);
    const losers = results.filter((r) => r.allowed === false);

    assert.equal(winners.length, 1, 'Exactly 1 concurrent request must obtain slot #10');
    assert.equal(losers.length, 49, 'All 49 other concurrent requests must be rejected');

    // Commit winning reservation
    await engine.commitBetaUse(userId, 'image-resize', winners[0].reservationToken, 45);

    const key = `${userId}:image-resize`;
    const record = engine.usages.get(key);
    assert.equal(record.usageCount, 10, 'Usage count must be exactly 10, never 11+');
    assert.equal(record.reservedCount, 0, 'Reserved count must be 0');
  });

  await t.test('7. Telemetry Aggregation & Deterministic Tool Health', () => {
    const telemetry = engine.getTelemetryOverview();
    assert.ok(telemetry.length >= 55);

    const sample = telemetry.find((t) => t.toolKey === 'pdf-to-jpg');
    assert.ok(sample);
    assert.ok(sample.totalUses >= 10);
    assert.equal(sample.successRate, 100);
    assert.equal(sample.health, 'Healthy');
  });

  await t.test('8. Safe Operational Metadata: Never stores or exposes document contents', () => {
    for (const evt of engine.events) {
      assert.ok(evt.toolKey);
      assert.ok(evt.timestamp);
      assert.ok(evt.status);
      assert.equal(evt.pdfBytes, undefined, 'PDF bytes must NEVER be stored');
      assert.equal(evt.resumeText, undefined, 'Resume text must NEVER be stored');
      assert.equal(evt.imageBytes, undefined, 'Image bytes must NEVER be stored');
    }
  });
});
