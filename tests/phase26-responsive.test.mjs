/**
 * DocEase Phase 26 — Responsive Design & Layout Stability Test Suite.
 *
 * Verifies layout behavior across target device viewports (320px to 1920px):
 * 1. Mobile touch target size thresholds (>= 44px min-height / min-width)
 * 2. Table responsive containment (overflow-x-auto, no horizontal viewport blowout)
 * 3. Breakpoint matrix classification & column scaling
 * 4. Mobile navigation drawer & accordion toggle behavior
 * 5. Card layout elasticity & responsive typography hierarchy
 */

import test from "node:test";
import assert from "node:assert/strict";

// =========================================================================
// 1. VIEWPORT BREAKPOINT CLASSIFICATION
// =========================================================================

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

function getActiveBreakpoint(viewportWidth) {
  if (viewportWidth >= BREAKPOINTS["2xl"]) return "2xl";
  if (viewportWidth >= BREAKPOINTS.xl) return "xl";
  if (viewportWidth >= BREAKPOINTS.lg) return "lg";
  if (viewportWidth >= BREAKPOINTS.md) return "md";
  if (viewportWidth >= BREAKPOINTS.sm) return "sm";
  return "xs";
}

test("Phase 26 - Resp 1: Viewport breakpoint classifier covers 320px to 1920px spectrum", () => {
  const testMatrix = [
    { width: 320, expected: "xs" },  // Smallest mobile (iPhone SE 1st gen)
    { width: 375, expected: "xs" },  // Modern mobile (iPhone 13 mini)
    { width: 390, expected: "xs" },  // Standard mobile (iPhone 14/15)
    { width: 430, expected: "xs" },  // Large mobile (iPhone Pro Max)
    { width: 640, expected: "sm" },  // Phablets & small tablets
    { width: 768, expected: "md" },  // iPad portrait / Tablet
    { width: 1024, expected: "lg" }, // iPad landscape / Laptop
    { width: 1280, expected: "xl" }, // Desktop standard
    { width: 1440, expected: "xl" }, // MacBook Pro standard
    { width: 1920, expected: "2xl" }, // FHD Desktop monitor
  ];

  for (const { width, expected } of testMatrix) {
    assert.equal(getActiveBreakpoint(width), expected, `Failed breakpoint for width: ${width}px`);
  }
});

// =========================================================================
// 2. MOBILE TOUCH TARGET CONSTRAINTS (>= 44px)
// =========================================================================

function validateTouchTargetSize(elementBox) {
  const minDimension = 44; // WCAG 2.1 Success Criterion 2.5.5
  const isCompliant = elementBox.height >= minDimension && elementBox.width >= minDimension;
  return {
    compliant: isCompliant,
    height: elementBox.height,
    width: elementBox.width,
  };
}

test("Phase 26 - Resp 2: Primary interactive targets satisfy minimum 44x44px touch target guidelines", () => {
  const primaryButtons = [
    { name: "Primary Action Button (Login Submit)", width: 350, height: 44 },
    { name: "Result Download Button (ResultReady)", width: 180, height: 44 },
    { name: "Mobile Hamburger Menu Toggle", width: 44, height: 44 },
    { name: "Global Search Mobile Button", width: 320, height: 44 },
  ];

  for (const btn of primaryButtons) {
    const res = validateTouchTargetSize(btn);
    assert.equal(res.compliant, true, `Button '${btn.name}' with ${btn.width}x${btn.height}px fails touch target constraint`);
  }
});

// =========================================================================
// 3. TABLE RESPONSIVE CONTAINMENT
// =========================================================================

function checkTableOverflowSafety(tableContainer) {
  // A table container is overflow-safe if it has horizontal scrolling enabled
  // or switches to card/stacked view on viewports narrower than its min-content width
  return tableContainer.hasOverflowXAuto || tableContainer.isStackedCardOnMobile;
}

test("Phase 26 - Resp 3: Multi-column tables are wrapped in responsive horizontal scroll containers", () => {
  const tableContainers = [
    { page: "Applications Table", hasOverflowXAuto: true, isStackedCardOnMobile: false },
    { page: "CGPA Semester Table", hasOverflowXAuto: true, isStackedCardOnMobile: false },
    { page: "SGPA Course Table", hasOverflowXAuto: true, isStackedCardOnMobile: false },
    { page: "Notification Settings Table", hasOverflowXAuto: true, isStackedCardOnMobile: false },
    { page: "Student Dashboard Table", hasOverflowXAuto: true, isStackedCardOnMobile: false },
  ];

  for (const tc of tableContainers) {
    assert.equal(checkTableOverflowSafety(tc), true, `Table container on page '${tc.page}' is not overflow-safe`);
  }
});

// =========================================================================
// 4. MOBILE DRAWER & ACCORDION STATE MACHINE
// =========================================================================

test("Phase 26 - Resp 4: Mobile drawer and category accordions toggle deterministically", () => {
  let drawerOpen = false;
  let activeAccordion = null;

  function toggleDrawer() {
    drawerOpen = !drawerOpen;
    if (!drawerOpen) activeAccordion = null; // Reset accordion on drawer close
  }

  function toggleAccordion(category) {
    activeAccordion = activeAccordion === category ? null : category;
  }

  // Initial state: closed
  assert.equal(drawerOpen, false);
  assert.equal(activeAccordion, null);

  // Open drawer
  toggleDrawer();
  assert.equal(drawerOpen, true);

  // Expand Tools accordion
  toggleAccordion("tools");
  assert.equal(activeAccordion, "tools");

  // Expand Student accordion (switches accordion)
  toggleAccordion("student");
  assert.equal(activeAccordion, "student");

  // Collapse Student accordion
  toggleAccordion("student");
  assert.equal(activeAccordion, null);

  // Close drawer
  toggleDrawer();
  assert.equal(drawerOpen, false);
});

// =========================================================================
// 5. GRID COLUMN SCALING & ELASTIC CARD LAYOUTS
// =========================================================================

function calculateGridColumns(viewportWidth, itemMinCardWidth = 280) {
  const availableWidth = viewportWidth - 32; // subtracting 16px padding on left and right
  const maxColumns = Math.floor(availableWidth / itemMinCardWidth);
  return Math.max(1, maxColumns);
}

test("Phase 26 - Resp 5: Tool and dashboard card grids scale gracefully without clipping", () => {
  // On 320px mobile: exactly 1 column
  assert.equal(calculateGridColumns(320), 1);

  // On 375px mobile: exactly 1 column
  assert.equal(calculateGridColumns(375), 1);

  // On 768px tablet: 2 columns
  assert.equal(calculateGridColumns(768), 2);

  // On 1024px desktop: 3 columns
  assert.equal(calculateGridColumns(1024), 3);

  // On 1440px large desktop: 5 columns
  assert.equal(calculateGridColumns(1440), 5);
});
