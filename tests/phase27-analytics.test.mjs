/**
 * DocEase Phase 27 — Privacy-Conscious Analytics Test Suite.
 *
 * Verifies:
 * 1. Event schema validation against centralized taxonomy
 * 2. Unknown event rejection
 * 3. Rejection and stripping of sensitive properties (passwords, tokens, marks, binary bytes, raw prompts)
 * 4. Pseudonymous session identifier generation without credentials
 * 5. User consent model: opt-out disables tracking cleanly without breaking core operations
 * 6. Fail-safe execution: tracking never throws or impacts callers
 * 7. Bounded string length caps and ring-buffer capacity eviction
 * 8. Search privacy: search analytics does not collect raw search query text
 */

import test from "node:test";
import assert from "node:assert/strict";

const VALID_EVENT_NAMES = new Set([
  "route_loaded",
  "tool_started",
  "tool_completed",
  "tool_failed",
  "download_started",
  "download_completed",
  "search_opened",
  "search_used",
  "ai_request_started",
  "ai_request_completed",
  "ai_request_failed",
  "notification_scheduled",
  "notification_sent",
  "notification_failed",
  "rate_limited",
]);

const PROHIBITED_KEYS = new Set([
  "password",
  "secret",
  "token",
  "auth",
  "bearer",
  "apikey",
  "api_key",
  "credit_card",
  "cvv",
  "cvc",
  "filebytes",
  "pdfbytes",
  "documentbytes",
  "buffer",
  "blob",
  "rawprompt",
  "prompt",
  "response",
  "rawresponse",
  "marks",
  "studentmarks",
  "sgpa",
  "cgpa",
  "email",
  "phonenumber",
  "phone",
  "query",
]);

class AnalyticsTracker {
  constructor() {
    this.events = [];
    this.MAX_EVENTS = 1000;
    this.currentSessionId = null;
    this.consentGranted = true;
  }

  getConsent() {
    return this.consentGranted;
  }

  setConsent(granted) {
    this.consentGranted = Boolean(granted);
  }

  getSessionId() {
    if (this.currentSessionId) return this.currentSessionId;
    const rand = Math.random().toString(36).substring(2, 10);
    const time = Date.now().toString(36);
    this.currentSessionId = `anon_${time}_${rand}`;
    return this.currentSessionId;
  }

  sanitizePayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const sanitized = {};

    for (const [key, value] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();

      if (
        PROHIBITED_KEYS.has(lowerKey) ||
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("filebyte") ||
        lowerKey.includes("buffer") ||
        lowerKey.includes("prompt")
      ) {
        continue;
      }

      if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
        continue;
      }

      if (typeof value === "string") {
        if (value.length > 300) {
          sanitized[key] = value.substring(0, 300) + "...";
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  trackEvent(rawEvent) {
    try {
      if (!this.getConsent()) {
        return false;
      }

      if (!rawEvent || !rawEvent.name || !VALID_EVENT_NAMES.has(rawEvent.name)) {
        return false;
      }

      const sanitized = this.sanitizePayload(rawEvent);
      const enrichedEvent = {
        ...sanitized,
        timestamp: rawEvent.timestamp || new Date().toISOString(),
        sessionId: rawEvent.sessionId || this.getSessionId(),
      };

      if (this.events.length >= this.MAX_EVENTS) {
        this.events.shift();
      }
      this.events.push(enrichedEvent);

      return true;
    } catch {
      return false;
    }
  }

  getRecentEvents() {
    return [...this.events];
  }

  getAnalyticsSummary() {
    const total = this.events.length;
    const byName = {};
    let toolCompletedCount = 0;
    let toolFailedCount = 0;

    for (const evt of this.events) {
      byName[evt.name] = (byName[evt.name] || 0) + 1;
      if (evt.name === "tool_completed") toolCompletedCount++;
      if (evt.name === "tool_failed") toolFailedCount++;
    }

    return {
      totalEvents: total,
      byEventName: byName,
      toolCompletedCount,
      toolFailedCount,
    };
  }

  clear() {
    this.events = [];
    this.currentSessionId = null;
  }
}

const analytics = new AnalyticsTracker();

test.beforeEach(() => {
  analytics.clear();
  analytics.setConsent(true);
});

// =========================================================================
// 1. EVENT SCHEMA VALIDATION & UNKNOWN EVENT REJECTION
// =========================================================================

test("Phase 27 - Analytics 1: Valid events in taxonomy are accepted and recorded in ring buffer", () => {
  const result = analytics.trackEvent({
    name: "route_loaded",
    route: "/tools/jpg-to-pdf",
    routeCategory: "tool",
    durationMs: 42,
  });

  assert.equal(result, true);
  const events = analytics.getRecentEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "route_loaded");
  assert.ok(events[0].sessionId);
  assert.ok(events[0].timestamp);
});

test("Phase 27 - Analytics 2: Unknown event names are strictly rejected", () => {
  const result = analytics.trackEvent({
    name: "unauthorized_tracking_event",
    someData: 123,
  });

  assert.equal(result, false);
  const events = analytics.getRecentEvents();
  assert.equal(events.length, 0);
});

// =========================================================================
// 2. SENSITIVE PROPERTY & PRIVATE DOCUMENT EXCLUSION
// =========================================================================

test("Phase 27 - Analytics 3: Prohibited sensitive keys (passwords, tokens, marks, prompts) are stripped", () => {
  const dirtyEvent = {
    name: "tool_completed",
    toolId: "vtu-sgpa",
    durationMs: 120,
    durationBucket: "<500ms",
    password: "supersecretpassword123",
    secret_token: "tok_live_12345",
    studentMarks: [95, 88, 72],
    rawPrompt: "System instruction with sensitive context",
    fileBytes: new Uint8Array([1, 2, 3, 4]),
  };

  const ok = analytics.trackEvent(dirtyEvent);
  assert.equal(ok, true);

  const recorded = analytics.getRecentEvents()[0];
  assert.equal(recorded.name, "tool_completed");
  assert.equal(recorded.toolId, "vtu-sgpa");
  assert.equal(recorded.password, undefined);
  assert.equal(recorded.secret_token, undefined);
  assert.equal(recorded.studentMarks, undefined);
  assert.equal(recorded.rawPrompt, undefined);
  assert.equal(recorded.fileBytes, undefined);
});

test("Phase 27 - Analytics 4: Search analytics strictly forbids collecting raw search query text", () => {
  const searchEvent = {
    name: "search_used",
    searchCategory: "academic",
    resultCountBucket: "1-5",
    durationMs: 15,
    query: "User private search keywords",
  };

  analytics.trackEvent(searchEvent);
  const recorded = analytics.getRecentEvents()[0];
  assert.equal(recorded.searchCategory, "academic");
  assert.equal(recorded.resultCountBucket, "1-5");
  assert.equal(recorded.query, undefined, "Search query text must NEVER be recorded");
});

test("Phase 27 - Analytics 5: Arbitrary large strings are bounded to prevent document text dumping", () => {
  const massiveString = "A".repeat(2000);
  const event = {
    name: "tool_failed",
    toolId: "compress-pdf",
    durationMs: 500,
    errorCategory: "VALIDATION_ERROR",
    sanitizedMessage: massiveString,
  };

  analytics.trackEvent(event);
  const recorded = analytics.getRecentEvents()[0];
  assert.ok(recorded.sanitizedMessage.length <= 305, "String length must be capped at 300 chars + suffix");
  assert.ok(recorded.sanitizedMessage.endsWith("..."));
});

// =========================================================================
// 3. CONSENT & FAIL-SAFE DESIGN
// =========================================================================

test("Phase 27 - Analytics 6: User opt-out (denied consent) cleanly skips tracking without errors", () => {
  analytics.setConsent(false);
  assert.equal(analytics.getConsent(), false);

  const tracked = analytics.trackEvent({
    name: "tool_started",
    toolId: "jpg-to-pdf",
    toolCategory: "image",
  });

  assert.equal(tracked, false);
  assert.equal(analytics.getRecentEvents().length, 0);

  // Restore consent
  analytics.setConsent(true);
  const trackedAfter = analytics.trackEvent({
    name: "tool_started",
    toolId: "jpg-to-pdf",
    toolCategory: "image",
  });
  assert.equal(trackedAfter, true);
  assert.equal(analytics.getRecentEvents().length, 1);
});

test("Phase 27 - Analytics 7: Tracking is fail-safe and never throws or breaks product execution", () => {
  const pathological = { name: "route_loaded" };
  pathological.self = pathological;

  assert.doesNotThrow(() => {
    const result = analytics.trackEvent(pathological);
    assert.equal(typeof result, "boolean");
  });
});

test("Phase 27 - Analytics 8: Session identifiers are pseudonymous and persist without PII", () => {
  const id1 = analytics.getSessionId();
  const id2 = analytics.getSessionId();
  assert.equal(id1, id2, "Session ID should remain stable for the current session");
  assert.ok(id1.startsWith("anon_"), "Session ID must follow pseudonymous format");
  assert.ok(!id1.includes("@"), "Session ID must not contain email characters");
});

test("Phase 27 - Analytics 9: Summary aggregations report accurate operational metrics", () => {
  analytics.trackEvent({
    name: "tool_completed",
    toolId: "jpg-to-pdf",
    durationMs: 120,
    durationBucket: "<500ms",
  });
  analytics.trackEvent({
    name: "tool_failed",
    toolId: "merge-pdf",
    durationMs: 250,
    errorCategory: "VALIDATION_ERROR",
    sanitizedMessage: "Corrupt header",
  });

  const summary = analytics.getAnalyticsSummary();
  assert.equal(summary.totalEvents, 2);
  assert.equal(summary.toolCompletedCount, 1);
  assert.equal(summary.toolFailedCount, 1);
  assert.equal(summary.byEventName["tool_completed"], 1);
  assert.equal(summary.byEventName["tool_failed"], 1);
});
