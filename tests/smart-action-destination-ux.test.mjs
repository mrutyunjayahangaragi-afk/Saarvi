import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_DESTINATION_MAP,
  getStickyHeaderOffset,
  prefersReducedMotion,
  isElementInViewport,
  resolveTargetElement,
  revealDestination,
  ActionDestinationController,
  getActionDestinationHealthReport,
} from "../src/lib/ux/action-destination.ts";

test("SAARVI SMART ACTION → DESTINATION UX SYSTEM: Global Audit & Verification", async (t) => {
  await t.test("1. Central Action Destination Map integrity", () => {
    assert.ok(ACTION_DESTINATION_MAP, "Action destination map must exist");
    const actionKeys = Object.keys(ACTION_DESTINATION_MAP);
    assert.ok(actionKeys.length >= 10, `Expected at least 10 action mappings, found ${actionKeys.length}`);

    // Verify critical tool & calculator categories are mapped
    const requiredActions = [
      "sgpa.calculate",
      "cgpa.calculate",
      "marks.calculate",
      "percentage.calculate",
      "attendance.calculate",
      "tool.process.complete",
      "tool.process.error",
      "jobs.search",
      "resume.preview",
      "cover_letter.preview",
      "feedback.submit",
      "form.validation.error",
    ];

    for (const action of requiredActions) {
      assert.ok(ACTION_DESTINATION_MAP[action], `Missing required action configuration for "${action}"`);
      const cfg = ACTION_DESTINATION_MAP[action];
      assert.ok(cfg.primaryTarget, `Action "${action}" must define a primaryTarget`);
      assert.ok(cfg.type, `Action "${action}" must define a DestinationType`);
      assert.ok(cfg.mode, `Action "${action}" must define a RevealMode`);
      assert.strictEqual(typeof cfg.focus, "boolean", `Action "${action}" must define focus boolean`);
    }
  });

  await t.test("2. Sticky Header Offset Calculation", () => {
    // Default server/non-browser offset
    const offset = getStickyHeaderOffset();
    assert.ok(offset >= 64 && offset <= 96, `Sticky header offset should be around 84px, got ${offset}`);
  });

  await t.test("3. Viewport Visibility Detection (Avoid Unnecessary Scrolling)", () => {
    // Mock Element in viewport
    const visibleMockElement = {
      getBoundingClientRect: () => ({
        top: 120, // Below 84px header
        bottom: 400,
        left: 20,
        right: 800,
        height: 280,
        width: 780,
      }),
    };

    // Mock Off-screen Element
    const offscreenMockElement = {
      getBoundingClientRect: () => ({
        top: 1400, // Way below fold
        bottom: 1680,
        left: 20,
        right: 800,
        height: 280,
        width: 780,
      }),
    };

    // In node test environment without real window, mock global window
    globalThis.window = {
      innerHeight: 800,
      innerWidth: 1024,
      scrollY: 0,
      scrollTo: () => {},
    };
    globalThis.document = {
      documentElement: { clientHeight: 800, clientWidth: 1024, scrollHeight: 2500 },
      getElementById: () => null,
      querySelector: () => null,
    };

    const isVisible = isElementInViewport(visibleMockElement, { headerOffset: 84 });
    const isOffscreen = isElementInViewport(offscreenMockElement, { headerOffset: 84 });

    assert.strictEqual(isVisible, true, "Element below header within viewport must be detected as visible");
    assert.strictEqual(isOffscreen, false, "Element far below fold must be detected as not visible");
  });

  await t.test("4. StrictMode & Idempotency Protection (Prevent Double Scroll)", () => {
    let scrollCount = 0;
    const mockTarget = {
      id: "calculation-result",
      getBoundingClientRect: () => ({ top: 600, bottom: 900, left: 0, right: 800, height: 300, width: 800 }),
      querySelector: () => null,
      getAttribute: () => null,
      setAttribute: () => {},
      removeAttribute: () => {},
      addEventListener: () => {},
      focus: () => {},
    };

    globalThis.window.scrollTo = () => {
      scrollCount++;
    };

    const opId = "test_strict_mode_op_123";

    // First call: should execute reveal
    const firstCall = revealDestination({
      target: mockTarget,
      operationId: opId,
      force: true,
    });
    assert.strictEqual(firstCall, true, "First call with new operation ID should execute");
    assert.strictEqual(scrollCount, 1, "Should scroll on first call");

    // Second call with same operationId (as in React StrictMode double invocation): should NO-OP
    const secondCall = revealDestination({
      target: mockTarget,
      operationId: opId,
      force: true,
    });
    assert.strictEqual(secondCall, false, "Second call with identical operation ID must be ignored (idempotent)");
    assert.strictEqual(scrollCount, 1, "Scroll count must remain 1 (no double scroll jank)");
  });

  await t.test("5. Async Result Race Protection", () => {
    const controller = new ActionDestinationController();

    const opA = controller.startAction("tool.process.complete");
    assert.strictEqual(controller.getOperationState(opA), "PROCESSING");

    // Operation B starts before Operation A completes
    const opB = controller.startAction("tool.process.complete");
    assert.strictEqual(controller.getOperationState(opB), "PROCESSING");

    // Operation A attempts to complete after B started -> should be superseded (no stale reveal)
    const resultA = controller.completeAction(opA);
    assert.strictEqual(resultA.revealed, false, "Stale Operation A must not trigger destination reveal");

    // Operation B completes -> valid current operation
    const mockEl = {
      id: "tool-result",
      getBoundingClientRect: () => ({ top: 800, bottom: 1200, left: 0, right: 800, height: 400, width: 800 }),
      querySelector: () => null,
      getAttribute: () => null,
      setAttribute: () => {},
      removeAttribute: () => {},
      addEventListener: () => {},
      focus: () => {},
    };

    const resultB = controller.completeAction(opB, { target: mockEl, force: true });
    assert.strictEqual(resultB.revealed, true, "Current Operation B should successfully trigger reveal");
  });

  await t.test("6. User Manual Scroll Protection (Innovation 36-38 & 81: Offscreen Ready Banner)", () => {
    const controller = new ActionDestinationController();

    globalThis.window.scrollY = 100;
    const opId = controller.startAction("sgpa.calculate");

    // Simulate user scrolling far away (e.g. from 100 to 500 = delta 400px > threshold 160px)
    globalThis.window.scrollY = 500;

    const mockTarget = {
      id: "calculation-result",
      getBoundingClientRect: () => ({ top: 1200, bottom: 1500, left: 0, right: 800, height: 300, width: 800 }),
      querySelector: () => null,
      getAttribute: () => null,
      setAttribute: () => {},
      removeAttribute: () => {},
      addEventListener: () => {},
      focus: () => {},
    };

    const completion = controller.completeAction(opId, { target: mockTarget });
    assert.strictEqual(completion.revealed, false, "Should not hijack viewport when user scrolled away");
    assert.strictEqual(completion.offscreen, true, "Must flag offscreen: true to show Smart Result Banner");
    assert.strictEqual(controller.getOperationState(opId), "READY_OFFSCREEN");
  });

  await t.test("7. Reduced Motion Behavior", () => {
    // Mock prefers-reduced-motion media query
    globalThis.window.matchMedia = (query) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    assert.strictEqual(prefersReducedMotion(), true, "Should detect prefers-reduced-motion: reduce");

    let scrollBehaviorUsed = "";
    globalThis.window.scrollTo = (options) => {
      scrollBehaviorUsed = typeof options === "object" ? options.behavior : "numeric";
    };

    const mockTarget = {
      id: "calculation-result",
      getBoundingClientRect: () => ({ top: 600, bottom: 900, left: 0, right: 800, height: 300, width: 800 }),
      querySelector: () => null,
      getAttribute: () => null,
      setAttribute: () => {},
      removeAttribute: () => {},
      addEventListener: () => {},
      focus: () => {},
    };

    revealDestination({
      target: mockTarget,
      behavior: "smooth",
      force: true,
      operationId: "reduced_motion_test_op",
    });

    assert.strictEqual(scrollBehaviorUsed, "auto", "Must downgrade smooth scroll to auto when reduced motion is preferred");
  });

  await t.test("8. Automated Destination Health Report & Broken Destination Detection", () => {
    const report = getActionDestinationHealthReport();
    assert.ok(Array.isArray(report), "Health report must be an array");
    assert.ok(report.length >= 10, "Report must cover all mapped destinations");

    for (const item of report) {
      assert.ok(item.page, "Report item must declare page");
      assert.ok(item.action, "Report item must declare action");
      assert.ok(item.actionType, "Report item must declare actionType");
      assert.ok(item.destination, "Report item must declare destination");
      assert.ok(item.revealStrategy, "Report item must declare revealStrategy");
      assert.ok(item.focusStrategy, "Report item must declare focusStrategy");
      assert.ok(["PASS", "WARN_NO_FALLBACK", "BROKEN_DESTINATION"].includes(item.status));
    }
  });
});
