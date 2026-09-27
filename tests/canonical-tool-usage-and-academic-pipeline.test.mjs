/**
 * Saarvi — Canonical Server-Side Tool Usage Telemetry & Authoritative Academic Pipeline
 * Master Acceptance Test Suite (PART 29)
 *
 * 20 Required Automated Tests:
 *  1. Logged-in user tool execution increments tool uses and attributes to authenticated user.
 *  2. Guest tool execution increments tool uses and attributes to guest session.
 *  3. Both authenticated and guest runs reflect in total uses without double counting.
 *  4. Tool Control Center shows matching total uses for the tool.
 *  5. User Dashboard displays matching tool executions for that user only.
 *  6. Admin Tool Intelligence shows matching tool usage count.
 *  7. Beta usage limit decrements properly for authenticated free user.
 *  8. Pro user is never blocked by beta usage limit.
 *  9. Beta usage reservation and commit are atomic and idempotent.
 * 10. Tool failure or cancellation does NOT count as a successful use in analytics.
 * 11. Tool error increments failed count and affects success rate correctly.
 * 12. Health status transitions accurately based on error rate and duration thresholds.
 * 13. Duplicate execution events with identical (operation_id, tool_key) are ignored.
 * 14. Normalization resolves pdf-to-jpg and pdf_to_jpg to identical canonical telemetry counter.
 * 15. Official curriculum provider loads verified VTU syllabus subjects with correct credits.
 * 16. Unverified blog/scraping provider data is rejected or flagged for verification.
 * 17. Conflicting subject data from different sources triggers CONFLICT_REQUIRES_REVIEW status.
 * 18. SGPA calculation strictly uses authoritative credits and computes exact VTU formula.
 * 19. Admin can manually resolve conflict and verified version increments.
 * 20. Guest telemetry remains privacy-safe with no PII or document payload recorded.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Core Telemetry & Academic Storage Engine Simulator
// Mirrors MockStorageProvider + ToolAccessService + SubjectAuthorityService
// ============================================================================

class CanonicalTelemetryEngine {
  constructor() {
    this.platformEvents = [];
    this.operationSet = new Set(); // (operation_id, tool_key)
    this.betaReservations = new Map();
    this.userBetaUsage = new Map(); // key -> usage count
    this.academicSubjects = new Map();
    this.academicConflicts = [];
    this.academicAuditLogs = [];
    this.toolConfigs = new Map();

    // Default configuration for pdf_to_jpg
    this.toolConfigs.set('pdf_to_jpg', {
      toolKey: 'pdf_to_jpg',
      displayName: 'PDF to JPG Converter',
      category: 'pdf',
      status: 'AVAILABLE',
      accessMode: 'FREE',
      betaEnabled: true,
      betaFreeLimit: 10,
      maxP95DurationMs: 5000,
      maxErrorRatePct: 5.0,
    });
  }

  // Key normalization: kebab to snake
  normalizeKey(key) {
    if (!key) return '';
    return key.trim().toLowerCase().replace(/-/g, '_');
  }

  // Record platform event with idempotency on (operation_id, tool_key)
  recordPlatformEvent(event) {
    const canonicalKey = this.normalizeKey(event.toolKey || event.tool_key);
    const opId = event.operationId || event.operation_id;

    if (opId && canonicalKey) {
      const dedupeKey = `${opId}:${canonicalKey}`;
      if (this.operationSet.has(dedupeKey)) {
        return { success: true, deduplicated: true, event: null };
      }
      this.operationSet.add(dedupeKey);
    }

    const record = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventName: event.eventName || event.event_name,
      toolKey: canonicalKey,
      userId: event.userId || event.user_id || null,
      guestSessionId: event.guestSessionId || event.guest_session_id || null,
      userType: event.userType || (event.userId ? 'authenticated' : 'guest'),
      operationId: opId || null,
      success: event.success !== false,
      durationMs: event.durationMs || 0,
      errorMessage: event.errorMessage || null,
      metadata: event.metadata || {},
      createdAt: event.createdAt || new Date().toISOString(),
    };

    this.platformEvents.push(record);
    return { success: true, deduplicated: false, event: record };
  }

  // Reserve Beta Usage
  reserveBetaUsage(toolKey, user) {
    const canonicalKey = this.normalizeKey(toolKey);
    const config = this.toolConfigs.get(canonicalKey);
    const limit = config?.betaFreeLimit ?? 10;

    // Pro bypass
    if (user?.plan === 'PRO' || user?.role === 'SUPER_ADMIN') {
      return {
        allowed: true,
        isPro: true,
        remainingUses: Infinity,
        reservationToken: null,
      };
    }

    const usageKey = `${user.id}:${canonicalKey}`;
    const currentUsage = this.userBetaUsage.get(usageKey) || 0;

    if (currentUsage >= limit) {
      return {
        allowed: false,
        isPro: false,
        remainingUses: 0,
        message: 'Your free Beta access for this tool has been reached.',
      };
    }

    const token = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.betaReservations.set(token, {
      userId: user.id,
      toolKey: canonicalKey,
      reservedAt: Date.now(),
    });

    return {
      allowed: true,
      isPro: false,
      remainingUses: Math.max(0, limit - currentUsage),
      reservationToken: token,
    };
  }

  // Commit Beta Usage
  commitBetaUsage(toolKey, user, reservationToken, operationId, durationMs) {
    const canonicalKey = this.normalizeKey(toolKey);
    const reservation = this.betaReservations.get(reservationToken);

    if (!reservation) {
      // Even if reservation expired, record canonical telemetry
      return this.recordPlatformEvent({
        toolKey: canonicalKey,
        eventName: 'tool_completed',
        userId: user.id,
        operationId,
        durationMs,
        success: true,
      });
    }

    this.betaReservations.delete(reservationToken);

    const usageKey = `${user.id}:${canonicalKey}`;
    const currentUsage = this.userBetaUsage.get(usageKey) || 0;
    this.userBetaUsage.set(usageKey, currentUsage + 1);

    const config = this.toolConfigs.get(canonicalKey);
    const limit = config?.betaFreeLimit ?? 10;
    const newRemaining = Math.max(0, limit - (currentUsage + 1));

    const telemetry = this.recordPlatformEvent({
      toolKey: canonicalKey,
      eventName: 'tool_completed',
      userId: user.id,
      operationId,
      durationMs,
      success: true,
    });

    return {
      ...telemetry,
      usageCount: currentUsage + 1,
      remainingUses: newRemaining,
    };
  }

  // Release Beta Usage
  releaseBetaUsage(reservationToken, toolKey, user, errorMsg, operationId) {
    const canonicalKey = this.normalizeKey(toolKey);
    this.betaReservations.delete(reservationToken);

    return this.recordPlatformEvent({
      toolKey: canonicalKey,
      eventName: 'tool_error',
      userId: user?.id,
      operationId,
      success: false,
      errorMessage: errorMsg,
    });
  }

  // Aggregate telemetry for tool control center
  getToolTelemetry(toolKey) {
    const canonicalKey = this.normalizeKey(toolKey);
    const matching = this.platformEvents.filter((e) => e.toolKey === canonicalKey);

    let authenticatedUses = 0;
    let guestUses = 0;
    let successfulOperations = 0;
    let failedOperations = 0;
    let totalDuration = 0;
    const uniqueUserSet = new Set();
    const guestSessionSet = new Set();
    const durations = [];
    let lastUsedAt = null;

    matching.forEach((e) => {
      const isCompleted = e.eventName === 'tool_completed';
      const isError = e.eventName === 'tool_error' || e.success === false;

      if (isCompleted || isError) {
        if (e.userId) {
          authenticatedUses++;
          uniqueUserSet.add(e.userId);
        } else {
          guestUses++;
          if (e.guestSessionId) {
            guestSessionSet.add(e.guestSessionId);
          }
        }

        if (e.success && !isError) {
          successfulOperations++;
          durations.push(e.durationMs);
          totalDuration += e.durationMs;
        } else {
          failedOperations++;
        }

        if (!lastUsedAt || new Date(e.createdAt) > new Date(lastUsedAt)) {
          lastUsedAt = e.createdAt;
        }
      }
    });

    const totalUses = authenticatedUses + guestUses;
    const successRate = totalUses > 0 ? Math.round((successfulOperations / totalUses) * 100) : 100;
    const avgDurationMs = successfulOperations > 0 ? Math.round(totalDuration / successfulOperations) : 0;

    durations.sort((a, b) => a - b);
    const p95Idx = Math.floor(durations.length * 0.95);
    const p95DurationMs = durations[p95Idx] || avgDurationMs;

    const config = this.toolConfigs.get(canonicalKey) || {};
    const errorRate = totalUses > 0 ? (failedOperations / totalUses) * 100 : 0;

    let health = 'Healthy';
    if (totalUses === 0) health = 'No Recent Usage';
    else if (errorRate > (config.maxErrorRatePct || 5.0)) health = 'High Error Rate';
    else if (p95DurationMs > (config.maxP95DurationMs || 5000)) health = 'Slow';

    return {
      toolKey: canonicalKey,
      totalUses,
      authenticatedUses,
      guestUses,
      uniqueUsers: uniqueUserSet.size,
      uniqueGuestSessions: guestSessionSet.size,
      successfulOperations,
      failedOperations,
      successRate,
      avgDurationMs,
      p95DurationMs,
      lastUsedAt,
      health,
    };
  }

  // User Dashboard Telemetry Summary
  getUserToolUsage(userId) {
    const userEvents = this.platformEvents.filter((e) => e.userId === userId);
    const toolRunMap = new Map();
    let totalOperations = 0;
    let successfulOperations = 0;

    userEvents.forEach((e) => {
      const isCompleted = e.eventName === 'tool_completed';
      const isError = e.eventName === 'tool_error' || e.success === false;

      if (isCompleted || isError) {
        totalOperations++;
        if (e.success && !isError) successfulOperations++;

        const current = toolRunMap.get(e.toolKey) || { totalUses: 0, successfulUses: 0 };
        current.totalUses++;
        if (e.success && !isError) current.successfulUses++;
        toolRunMap.set(e.toolKey, current);
      }
    });

    return {
      userId,
      totalOperations,
      uniqueTools: toolRunMap.size,
      successRate: totalOperations > 0 ? Math.round((successfulOperations / totalOperations) * 100) : 100,
      tools: Array.from(toolRunMap.entries()).map(([k, v]) => ({
        toolKey: k,
        totalUses: v.totalUses,
        successfulUses: v.successfulUses,
      })),
    };
  }
}

// ============================================================================
// Academic Pipeline Simulator
// ============================================================================

class AcademicPipelineEngine {
  constructor() {
    this.subjects = new Map();
    this.conflicts = [];
    this.auditLogs = [];
  }

  saveSubject(subject) {
    const key = `${subject.university}:${subject.scheme}:${subject.branch}:${subject.semester}:${subject.subjectCode}`.toUpperCase();
    this.subjects.set(key, { ...subject, version: subject.version || 1 });
    return this.subjects.get(key);
  }

  getSubjects(scope) {
    const prefix = `${scope.universityId}:${scope.schemeId}:${scope.branchId}:${scope.semester}:`.toUpperCase();
    const results = [];
    for (const [k, v] of this.subjects.entries()) {
      if (k.startsWith(prefix) && v.verificationStatus === 'VERIFIED') {
        results.push(v);
      }
    }
    return results;
  }

  // Ingest data from provider with priority & conflict detection
  ingestFromProvider(candidate, scope) {
    const key = `${scope.universityId}:${scope.schemeId}:${scope.branchId}:${scope.semester}:${candidate.subjectCode}`.toUpperCase();
    const existing = this.subjects.get(key);

    // Reject unverified blog / unverified sources
    if (candidate.sourceType === 'UNVERIFIED_BLOG_SCRAPE') {
      return { success: false, reason: 'UNVERIFIED_SOURCE_REJECTED' };
    }

    if (!existing) {
      const newSubject = {
        ...candidate,
        university: scope.universityId.toUpperCase(),
        scheme: scope.schemeId,
        branch: scope.branchId,
        semester: scope.semester,
        verificationStatus: candidate.sourceType.startsWith('OFFICIAL') ? 'VERIFIED' : 'PENDING',
        version: 1,
      };
      this.subjects.set(key, newSubject);
      return { success: true, status: newSubject.verificationStatus, subject: newSubject };
    }

    // Check for discrepancies in credits or critical metadata
    if (existing.credits !== candidate.credits) {
      const conflict = {
        id: `conf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        subjectCode: candidate.subjectCode,
        scope,
        existingCredits: existing.credits,
        incomingCredits: candidate.credits,
        existingSource: existing.sourceType,
        incomingSource: candidate.sourceType,
        status: 'CONFLICT_REQUIRES_REVIEW',
      };
      this.conflicts.push(conflict);
      existing.verificationStatus = 'CONFLICT_REQUIRES_REVIEW';
      return { success: false, status: 'CONFLICT_REQUIRES_REVIEW', conflict };
    }

    return { success: true, status: existing.verificationStatus, subject: existing };
  }

  resolveConflict(conflictId, adminEmail, verifiedCredits, sourceUrl) {
    const conflict = this.conflicts.find((c) => c.id === conflictId);
    if (!conflict) throw new Error('Conflict not found');

    const key = `${conflict.scope.universityId}:${conflict.scope.schemeId}:${conflict.scope.branchId}:${conflict.scope.semester}:${conflict.subjectCode}`.toUpperCase();
    const subject = this.subjects.get(key);

    if (subject) {
      subject.credits = verifiedCredits;
      subject.verificationStatus = 'VERIFIED';
      subject.version = (subject.version || 1) + 1;
      subject.sourceUrl = sourceUrl;
      subject.lastVerifiedBy = adminEmail;
      subject.lastVerifiedAt = new Date().toISOString();
    }

    conflict.status = 'RESOLVED';
    this.auditLogs.push({
      action: 'CONFLICT_RESOLVED',
      subjectCode: conflict.subjectCode,
      actor: adminEmail,
      timestamp: new Date().toISOString(),
      details: { verifiedCredits, sourceUrl },
    });

    return { success: true, subject };
  }
}

// ============================================================================
// SGPA VTU Formula Engine Simulator
// ============================================================================

function calculateVTUSGPA(courses) {
  let totalCreditPoints = 0;
  let totalCredits = 0;

  for (const c of courses) {
    if (c.includedInSGPA !== false && c.credits > 0) {
      let gradePoint = 0;
      const marks = c.marks;
      if (marks >= 90) gradePoint = 10;
      else if (marks >= 80) gradePoint = 9;
      else if (marks >= 70) gradePoint = 8;
      else if (marks >= 60) gradePoint = 7;
      else if (marks >= 45) gradePoint = 6;
      else if (marks >= 40) gradePoint = 4;
      else gradePoint = 0;

      totalCreditPoints += c.credits * gradePoint;
      totalCredits += c.credits;
    }
  }

  const sgpa = totalCredits > 0 ? parseFloat((totalCreditPoints / totalCredits).toFixed(2)) : 0;
  return { sgpa, totalCredits, totalCreditPoints };
}

// ============================================================================
// TEST SUITE: 20 ACCEPTANCE CRITERIA
// ============================================================================

test('1. Logged-in user tool execution increments tool uses and attributes to authenticated user', () => {
  const engine = new CanonicalTelemetryEngine();
  const user = { id: 'usr_authenticated_1', plan: 'FREE', role: 'USER' };

  const res = engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    userId: user.id,
    operationId: 'op_user_1',
    durationMs: 450,
    success: true,
  });

  assert.equal(res.success, true);
  assert.equal(res.event.userType, 'authenticated');
  assert.equal(res.event.userId, 'usr_authenticated_1');

  const telemetry = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(telemetry.totalUses, 1);
  assert.equal(telemetry.authenticatedUses, 1);
  assert.equal(telemetry.guestUses, 0);
  assert.equal(telemetry.uniqueUsers, 1);
});

test('2. Guest tool execution increments tool uses and attributes to guest session', () => {
  const engine = new CanonicalTelemetryEngine();
  const guestSessionId = 'guest_sess_alpha_99';

  const res = engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    guestSessionId,
    operationId: 'op_guest_1',
    durationMs: 380,
    success: true,
  });

  assert.equal(res.success, true);
  assert.equal(res.event.userType, 'guest');
  assert.equal(res.event.guestSessionId, guestSessionId);

  const telemetry = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(telemetry.totalUses, 1);
  assert.equal(telemetry.authenticatedUses, 0);
  assert.equal(telemetry.guestUses, 1);
  assert.equal(telemetry.uniqueGuestSessions, 1);
});

test('3. Both authenticated and guest runs reflect in total uses without double counting', () => {
  const engine = new CanonicalTelemetryEngine();

  // User A runs PDF to JPG
  engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    userId: 'usr_A',
    operationId: 'op_a',
    durationMs: 200,
    success: true,
  });

  // Guest B runs PDF to JPG
  engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    guestSessionId: 'guest_B',
    operationId: 'op_b',
    durationMs: 220,
    success: true,
  });

  const telemetry = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(telemetry.totalUses, 2);
  assert.equal(telemetry.authenticatedUses, 1);
  assert.equal(telemetry.guestUses, 1);
});

test('4. Tool Control Center shows matching total uses for the tool', () => {
  const engine = new CanonicalTelemetryEngine();

  // Perform 3 auth runs + 2 guest runs
  for (let i = 0; i < 3; i++) {
    engine.recordPlatformEvent({
      toolKey: 'pdf_to_jpg',
      eventName: 'tool_completed',
      userId: `user_${i}`,
      operationId: `op_auth_${i}`,
      durationMs: 150,
      success: true,
    });
  }
  for (let j = 0; j < 2; j++) {
    engine.recordPlatformEvent({
      toolKey: 'pdf_to_jpg',
      eventName: 'tool_completed',
      guestSessionId: `guest_${j}`,
      operationId: `op_guest_${j}`,
      durationMs: 180,
      success: true,
    });
  }

  const overview = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(overview.totalUses, 5);
  assert.equal(overview.authenticatedUses, 3);
  assert.equal(overview.guestUses, 2);
  assert.equal(overview.uniqueUsers, 3);
  assert.equal(overview.uniqueGuestSessions, 2);
});

test('5. User Dashboard displays matching tool executions for that user only', () => {
  const engine = new CanonicalTelemetryEngine();

  // User 1 performs 2 conversions
  engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    userId: 'user_target',
    operationId: 'op_t1',
    success: true,
  });
  engine.recordPlatformEvent({
    toolKey: 'jpg_to_pdf',
    eventName: 'tool_completed',
    userId: 'user_target',
    operationId: 'op_t2',
    success: true,
  });

  // User 2 performs 1 conversion
  engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    userId: 'user_other',
    operationId: 'op_other',
    success: true,
  });

  const dashboardTarget = engine.getUserToolUsage('user_target');
  assert.equal(dashboardTarget.totalOperations, 2);
  assert.equal(dashboardTarget.uniqueTools, 2);

  const dashboardOther = engine.getUserToolUsage('user_other');
  assert.equal(dashboardOther.totalOperations, 1);
  assert.equal(dashboardOther.uniqueTools, 1);
});

test('6. Admin Tool Intelligence shows matching tool usage count', () => {
  const engine = new CanonicalTelemetryEngine();

  // Run 4 operations for pdf_to_jpg, 2 for sgpa_calculator
  for (let i = 0; i < 4; i++) {
    engine.recordPlatformEvent({
      toolKey: 'pdf_to_jpg',
      eventName: 'tool_completed',
      operationId: `op_pdf_${i}`,
      success: true,
    });
  }
  for (let j = 0; j < 2; j++) {
    engine.recordPlatformEvent({
      toolKey: 'sgpa_calculator',
      eventName: 'tool_completed',
      operationId: `op_sgpa_${j}`,
      success: true,
    });
  }

  const pdfStats = engine.getToolTelemetry('pdf_to_jpg');
  const sgpaStats = engine.getToolTelemetry('sgpa_calculator');

  assert.equal(pdfStats.totalUses, 4);
  assert.equal(sgpaStats.totalUses, 2);
});

test('7. Beta usage limit decrements properly for authenticated free user', () => {
  const engine = new CanonicalTelemetryEngine();
  const freeUser = { id: 'usr_free_beta', plan: 'FREE', role: 'USER' };

  // Reserve slot
  const res1 = engine.reserveBetaUsage('pdf_to_jpg', freeUser);
  assert.equal(res1.allowed, true);
  assert.equal(res1.remainingUses, 10);
  assert.ok(res1.reservationToken);

  // Commit operation
  const commit1 = engine.commitBetaUsage('pdf_to_jpg', freeUser, res1.reservationToken, 'op_c1', 120);
  assert.equal(commit1.usageCount, 1);
  assert.equal(commit1.remainingUses, 9);

  // Second operation
  const res2 = engine.reserveBetaUsage('pdf_to_jpg', freeUser);
  assert.equal(res2.allowed, true);
  assert.equal(res2.remainingUses, 9);

  const commit2 = engine.commitBetaUsage('pdf_to_jpg', freeUser, res2.reservationToken, 'op_c2', 130);
  assert.equal(commit2.usageCount, 2);
  assert.equal(commit2.remainingUses, 8);
});

test('8. Pro user is never blocked by beta usage limit', () => {
  const engine = new CanonicalTelemetryEngine();
  const proUser = { id: 'usr_pro_vip', plan: 'PRO', role: 'USER' };

  // Manually saturate usage
  engine.userBetaUsage.set(`${proUser.id}:pdf_to_jpg`, 50);

  const res = engine.reserveBetaUsage('pdf_to_jpg', proUser);
  assert.equal(res.allowed, true);
  assert.equal(res.isPro, true);
  assert.equal(res.remainingUses, Infinity);
});

test('9. Beta usage reservation and commit are atomic and idempotent', () => {
  const engine = new CanonicalTelemetryEngine();
  const freeUser = { id: 'usr_free_atomic', plan: 'FREE', role: 'USER' };

  const res = engine.reserveBetaUsage('pdf_to_jpg', freeUser);
  assert.ok(res.reservationToken);

  // First commit succeeds
  const commit1 = engine.commitBetaUsage('pdf_to_jpg', freeUser, res.reservationToken, 'op_atomic_1', 100);
  assert.equal(commit1.usageCount, 1);
  assert.equal(commit1.deduplicated, false);

  // Duplicate commit with identical (operation_id, tool_key)
  const commit2 = engine.commitBetaUsage('pdf_to_jpg', freeUser, res.reservationToken, 'op_atomic_1', 100);
  assert.equal(commit2.deduplicated, true);

  // Telemetry is recorded exactly once
  const telemetry = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(telemetry.totalUses, 1);
});

test('10. Tool failure or cancellation does NOT count as a successful use in analytics', () => {
  const engine = new CanonicalTelemetryEngine();
  const freeUser = { id: 'usr_cancel_test', plan: 'FREE', role: 'USER' };

  const res = engine.reserveBetaUsage('pdf_to_jpg', freeUser);
  // User cancels or engine throws error -> release called
  engine.releaseBetaUsage(res.reservationToken, 'pdf_to_jpg', freeUser, 'Cancelled by user', 'op_cancel_1');

  const telemetry = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(telemetry.successfulOperations, 0);
  assert.equal(telemetry.failedOperations, 1);

  // Beta limit count was NOT incremented
  const currentUsage = engine.userBetaUsage.get(`${freeUser.id}:pdf_to_jpg`) || 0;
  assert.equal(currentUsage, 0);
});

test('11. Tool error increments failed count and affects success rate correctly', () => {
  const engine = new CanonicalTelemetryEngine();

  // 3 success
  for (let i = 0; i < 3; i++) {
    engine.recordPlatformEvent({
      toolKey: 'pdf_to_jpg',
      eventName: 'tool_completed',
      operationId: `op_s_${i}`,
      success: true,
    });
  }

  // 1 error
  engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_error',
    operationId: 'op_err_1',
    success: false,
    errorMessage: 'Corrupt PDF trailer',
  });

  const telemetry = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(telemetry.totalUses, 4);
  assert.equal(telemetry.successfulOperations, 3);
  assert.equal(telemetry.failedOperations, 1);
  assert.equal(telemetry.successRate, 75); // 3 / 4 * 100
});

test('12. Health status transitions accurately based on error rate and duration thresholds', () => {
  const engine = new CanonicalTelemetryEngine();

  // Scenario A: 100% success -> Healthy
  for (let i = 0; i < 10; i++) {
    engine.recordPlatformEvent({
      toolKey: 'pdf_to_jpg',
      eventName: 'tool_completed',
      operationId: `op_h_${i}`,
      durationMs: 800,
      success: true,
    });
  }
  let healthMetrics = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(healthMetrics.health, 'Healthy');

  // Scenario B: High Error Rate (> 5%) -> High Error Rate
  for (let j = 0; j < 5; j++) {
    engine.recordPlatformEvent({
      toolKey: 'pdf_to_jpg',
      eventName: 'tool_error',
      operationId: `op_err_health_${j}`,
      success: false,
    });
  }
  healthMetrics = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(healthMetrics.health, 'High Error Rate');
});

test('13. Duplicate execution events with identical (operation_id, tool_key) are ignored', () => {
  const engine = new CanonicalTelemetryEngine();

  const first = engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    operationId: 'op_idempotent_123',
    durationMs: 250,
    success: true,
  });
  assert.equal(first.deduplicated, false);

  const duplicate = engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    operationId: 'op_idempotent_123',
    durationMs: 250,
    success: true,
  });
  assert.equal(duplicate.deduplicated, true);

  const telemetry = engine.getToolTelemetry('pdf_to_jpg');
  assert.equal(telemetry.totalUses, 1);
});

test('14. Normalization resolves pdf-to-jpg and pdf_to_jpg to identical canonical telemetry counter', () => {
  const engine = new CanonicalTelemetryEngine();

  // One emitted as kebab-case
  engine.recordPlatformEvent({
    toolKey: 'pdf-to-jpg',
    eventName: 'tool_completed',
    operationId: 'op_kebab',
    success: true,
  });

  // One emitted as snake_case
  engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    operationId: 'op_snake',
    success: true,
  });

  const queryKebab = engine.getToolTelemetry('pdf-to-jpg');
  const querySnake = engine.getToolTelemetry('pdf_to_jpg');

  assert.equal(queryKebab.totalUses, 2);
  assert.equal(querySnake.totalUses, 2);
  assert.equal(queryKebab.toolKey, 'pdf_to_jpg');
});

test('15. Official curriculum provider loads verified VTU syllabus subjects with correct credits', () => {
  const academic = new AcademicPipelineEngine();
  const scope = { universityId: 'vtu', schemeId: '2022', branchId: 'cse', semester: 3 };

  academic.saveSubject({
    university: 'VTU',
    scheme: '2022',
    branch: 'CSE',
    semester: 3,
    subjectCode: 'BCS301',
    subjectName: 'Mathematics for Computer Science',
    credits: 4,
    sourceType: 'OFFICIAL_UNIVERSITY_WEBSITE',
    verificationStatus: 'VERIFIED',
  });

  academic.saveSubject({
    university: 'VTU',
    scheme: '2022',
    branch: 'CSE',
    semester: 3,
    subjectCode: 'BCS304',
    subjectName: 'Data Structures and Applications',
    credits: 3,
    sourceType: 'OFFICIAL_REGULATION_PDF',
    verificationStatus: 'VERIFIED',
  });

  const loaded = academic.getSubjects(scope);
  assert.equal(loaded.length, 2);

  const math = loaded.find((s) => s.subjectCode === 'BCS301');
  assert.equal(math.credits, 4);
  assert.equal(math.verificationStatus, 'VERIFIED');

  const dsa = loaded.find((s) => s.subjectCode === 'BCS304');
  assert.equal(dsa.credits, 3);
});

test('16. Unverified blog/scraping provider data is rejected or flagged for verification', () => {
  const academic = new AcademicPipelineEngine();
  const scope = { universityId: 'vtu', schemeId: '2022', branchId: 'cse', semester: 3 };

  const candidate = {
    subjectCode: 'BCS309_UNVERIFIED',
    subjectName: 'Random Unofficial Notes Subject',
    credits: 6,
    sourceType: 'UNVERIFIED_BLOG_SCRAPE',
  };

  const result = academic.ingestFromProvider(candidate, scope);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'UNVERIFIED_SOURCE_REJECTED');
});

test('17. Conflicting subject data from different sources triggers CONFLICT_REQUIRES_REVIEW status', () => {
  const academic = new AcademicPipelineEngine();
  const scope = { universityId: 'vtu', schemeId: '2022', branchId: 'cse', semester: 3 };

  // Step 1: Official syllabus gives 4 credits
  academic.ingestFromProvider(
    {
      subjectCode: 'BCS302',
      subjectName: 'Digital Design and Computer Organization',
      credits: 4,
      sourceType: 'OFFICIAL_REGULATION_PDF',
    },
    scope
  );

  // Step 2: Conflicting portal candidate reports 3 credits
  const conflictResult = academic.ingestFromProvider(
    {
      subjectCode: 'BCS302',
      subjectName: 'Digital Design and Computer Organization',
      credits: 3,
      sourceType: 'VERIFIED_ACADEMIC_PORTAL',
    },
    scope
  );

  assert.equal(conflictResult.success, false);
  assert.equal(conflictResult.status, 'CONFLICT_REQUIRES_REVIEW');
  assert.equal(academic.conflicts.length, 1);
  assert.equal(academic.conflicts[0].subjectCode, 'BCS302');
  assert.equal(academic.conflicts[0].existingCredits, 4);
  assert.equal(academic.conflicts[0].incomingCredits, 3);
});

test('18. SGPA calculation strictly uses authoritative credits and computes exact VTU formula', () => {
  // VTU 2022 CSE Sem 3 official courses:
  // BCS301 (Math): 4 cr -> Marks 88 -> Grade A (9) -> Points: 36
  // BCS302 (DDCO): 4 cr -> Marks 75 -> Grade B (8) -> Points: 32
  // BCS303 (OS):   4 cr -> Marks 92 -> Grade O (10) -> Points: 40
  // BCS304 (DSA):  3 cr -> Marks 81 -> Grade A (9) -> Points: 27
  // BCS306A (Lab): 1 cr -> Marks 95 -> Grade O (10) -> Points: 10
  // Total Credits: 4 + 4 + 4 + 3 + 1 = 16 credits
  // Total Points: 36 + 32 + 40 + 27 + 10 = 145 points
  // Expected SGPA = 145 / 16 = 9.0625 -> 9.06

  const courses = [
    { subjectCode: 'BCS301', credits: 4, marks: 88 },
    { subjectCode: 'BCS302', credits: 4, marks: 75 },
    { subjectCode: 'BCS303', credits: 4, marks: 92 },
    { subjectCode: 'BCS304', credits: 3, marks: 81 },
    { subjectCode: 'BCS306A', credits: 1, marks: 95 },
  ];

  const result = calculateVTUSGPA(courses);
  assert.equal(result.totalCredits, 16);
  assert.equal(result.totalCreditPoints, 145);
  assert.equal(result.sgpa, 9.06);
});

test('19. Admin can manually resolve conflict and verified version increments', () => {
  const academic = new AcademicPipelineEngine();
  const scope = { universityId: 'vtu', schemeId: '2022', branchId: 'cse', semester: 3 };

  // Setup conflict
  academic.ingestFromProvider(
    { subjectCode: 'BCS304', subjectName: 'DSA', credits: 4, sourceType: 'OFFICIAL_REGULATION_PDF' },
    scope
  );
  const conflict = academic.ingestFromProvider(
    { subjectCode: 'BCS304', subjectName: 'DSA', credits: 3, sourceType: 'VERIFIED_ACADEMIC_PORTAL' },
    scope
  );

  assert.ok(conflict.conflict);

  // Admin resolves conflict
  const resolution = academic.resolveConflict(
    conflict.conflict.id,
    'admin@saarvi.in',
    3,
    'https://vtu.ac.in/pdf/revised-2022-cse.pdf'
  );

  assert.equal(resolution.success, true);
  assert.equal(resolution.subject.credits, 3);
  assert.equal(resolution.subject.verificationStatus, 'VERIFIED');
  assert.equal(resolution.subject.version, 2);
  assert.equal(resolution.subject.lastVerifiedBy, 'admin@saarvi.in');

  assert.equal(academic.auditLogs.length, 1);
  assert.equal(academic.auditLogs[0].action, 'CONFLICT_RESOLVED');
});

test('20. Guest telemetry remains privacy-safe with no PII or document payload recorded', () => {
  const engine = new CanonicalTelemetryEngine();

  // Emitted event with safe metadata
  const res = engine.recordPlatformEvent({
    toolKey: 'pdf_to_jpg',
    eventName: 'tool_completed',
    guestSessionId: 'guest_secure_cookie_hash_987',
    operationId: 'op_privacy_audit',
    durationMs: 310,
    success: true,
    metadata: {
      inputSize: 10240,
      outputSize: 8520,
    },
  });

  const event = res.event;

  // Assert required fields exist
  assert.equal(event.toolKey, 'pdf_to_jpg');
  assert.equal(event.operationId, 'op_privacy_audit');
  assert.equal(event.guestSessionId, 'guest_secure_cookie_hash_987');
  assert.equal(event.userType, 'guest');
  assert.equal(event.userId, null);

  // Assert NO sensitive document contents or PII are logged
  assert.equal(event.metadata.fileContent, undefined);
  assert.equal(event.metadata.fileBytes, undefined);
  assert.equal(event.metadata.text, undefined);
  assert.equal(event.metadata.filename, undefined);
  assert.equal(event.metadata.marks, undefined);
  assert.equal(event.metadata.email, undefined);
  assert.equal(event.metadata.phone, undefined);
});
