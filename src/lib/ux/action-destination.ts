/**
 * Saarvi Smart Action → Destination UX System
 * Global project-wide viewport, navigation, focus & result reveal engine
 * 
 * CORE PRINCIPLE:
 * Every meaningful user action maps deterministically to a destination.
 * Never generic scrollTo(bottom); never hijack viewport when user scrolled away.
 */

export type DestinationType =
  | "route"
  | "result"
  | "tool_completion"
  | "search_results"
  | "validation_error"
  | "success"
  | "tab"
  | "accordion"
  | "modal"
  | "upload"
  | "section";

export type RevealMode =
  | "result"
  | "section"
  | "error"
  | "success"
  | "navigation"
  | "minimal"
  | "upload"
  | "start"
  | "center"
  | "nearest";

export type ActionState =
  | "IDLE"
  | "STARTED"
  | "PROCESSING"
  | "SUCCESS"
  | "ERROR"
  | "REVEALED"
  | "READY_OFFSCREEN";

export interface RevealDestinationOptions {
  /** Target element, ID (#result), selector, or data-saarvi-target name */
  target: string | HTMLElement | null;
  /** Fallback target if primary does not exist */
  fallbackTarget?: string | HTMLElement | null;
  /** Visual presentation mode for scrolling alignment */
  mode?: RevealMode;
  /** Alignment alias: start | center | nearest */
  alignment?: "start" | "center" | "nearest" | RevealMode;
  /** Whether to set focus for keyboard and screen reader accessibility */
  focus?: boolean;
  /** 'smooth' or 'auto' (respects prefers-reduced-motion automatically) */
  behavior?: "smooth" | "auto";
  /** Pixel offset from top (navbar clearance). Default: 84px */
  offset?: number;
  /** Human readable reason for telemetry/diagnostics */
  reason?: string;
  /** Unique operation ID to prevent duplicate executions (e.g. React StrictMode) */
  operationId?: string;
  /** Force scroll even if user scrolled elsewhere */
  force?: boolean;
  /** Callback fired if result is ready but user is scrolled away */
  onOffscreenReady?: (detail: OffscreenReadyDetail) => void;
}

export interface OffscreenReadyDetail {
  operationId: string;
  targetId: string;
  label: string;
  scrollDelta: number;
}

export interface ActionDestinationConfig {
  primaryTarget: string;
  fallbackTarget?: string;
  type: DestinationType;
  mode: RevealMode;
  focus: boolean;
  label: string;
  page?: string;
}

export interface DestinationHealthItem {
  page: string;
  action: string;
  actionType: DestinationType;
  destination: string;
  exists: boolean | "DOM_DEPENDENT";
  revealStrategy: string;
  focusStrategy: string;
  status: "PASS" | "WARN_NO_FALLBACK" | "BROKEN_DESTINATION";
}

/**
 * Standard sticky header offset calculation
 * Default sticky navbar in Saarvi is 64px (h-16) + 20px breathing space = 84px.
 * On mobile (<640px), 76px.
 */
export function getStickyHeaderOffset(): number {
  if (typeof window === "undefined") return 84;
  try {
    const nav = document.querySelector("header, nav.sticky, nav.fixed, [data-saarvi-navbar]");
    if (nav) {
      const rect = nav.getBoundingClientRect();
      if (rect.height > 0) {
        return Math.round(rect.height + 16);
      }
    }
  } catch {}
  return window.innerWidth < 640 ? 76 : 84;
}

/**
 * Checks if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Checks whether an element is already comfortably visible within the viewport
 * taking into account sticky header offset at top and viewport bottom.
 */
export function isElementInViewport(
  element: HTMLElement | null,
  options: { headerOffset?: number; threshold?: number } = {}
): boolean {
  if (!element || typeof window === "undefined") return false;

  const headerOffset = options.headerOffset ?? getStickyHeaderOffset();
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  // Horizontal check
  if (rect.right < 0 || rect.left > windowWidth) {
    return false;
  }

  // Vertical check with sticky header clearance
  const visibleTop = Math.max(rect.top, headerOffset);
  const visibleBottom = Math.min(rect.bottom, windowHeight);
  const visibleHeight = visibleBottom - visibleTop;

  if (visibleHeight <= 0) {
    return false;
  }

  // If top of element is below header and visible within comfortable view (> 40px)
  const isTopVisible = rect.top >= headerOffset && rect.top < windowHeight * 0.85;
  const isSubstantiallyVisible = visibleHeight >= Math.min(rect.height * 0.5, 180);

  return isTopVisible || isSubstantiallyVisible;
}

/**
 * Resolves a target selector, data-attribute, ID, or element to a concrete HTMLElement
 */
export function resolveTargetElement(
  target: string | HTMLElement | null | undefined
): HTMLElement | null {
  if (!target || typeof document === "undefined") return null;
  if (typeof target !== "string") return target;

  const trimmed = target.trim();
  if (!trimmed) return null;

  // 1. Exact ID selector (#something)
  if (trimmed.startsWith("#")) {
    const el = document.getElementById(trimmed.slice(1));
    if (el) return el;
  }

  // 2. Direct ID without hash
  const byId = document.getElementById(trimmed);
  if (byId) return byId;

  // 3. data-saarvi-target attribute match
  try {
    const byDataSaarvi = document.querySelector(`[data-saarvi-target="${trimmed}"]`);
    if (byDataSaarvi instanceof HTMLElement) return byDataSaarvi;
  } catch {}

  // 4. data-reveal-target match
  try {
    const byDataReveal = document.querySelector(`[data-reveal-target="${trimmed}"]`);
    if (byDataReveal instanceof HTMLElement) return byDataReveal;
  } catch {}

  // 5. Standard CSS selector query
  try {
    const queryEl = document.querySelector(trimmed);
    if (queryEl instanceof HTMLElement) return queryEl;
  } catch {}

  return null;
}

// Global cache to prevent React StrictMode duplicate scrolls
const seenOperationIds = new Set<string>();
const MAX_SEEN_OPERATIONS = 1000;

function rememberOperation(opId: string): boolean {
  if (seenOperationIds.has(opId)) return false;
  if (seenOperationIds.size > MAX_SEEN_OPERATIONS) {
    const firstKey = seenOperationIds.values().next().value;
    if (firstKey) seenOperationIds.delete(firstKey);
  }
  seenOperationIds.add(opId);
  return true;
}

export interface OffscreenNotificationListener {
  (detail: OffscreenReadyDetail): void;
}

const offscreenListeners = new Set<OffscreenNotificationListener>();

export function subscribeToOffscreenResults(
  listener: OffscreenNotificationListener
): () => void {
  offscreenListeners.add(listener);
  return () => {
    offscreenListeners.delete(listener);
  };
}

export function notifyOffscreenResult(detail: OffscreenReadyDetail): void {
  offscreenListeners.forEach((listener) => {
    try {
      listener(detail);
    } catch (e) {
      console.error("[ActionDestination] Error in offscreen listener:", e);
    }
  });

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("saarvi:offscreen-result", { detail })
      );
    } catch {}
  }
}

/**
 * SMART REVEAL ALGORITHM
 * 
 * 1. Locate target element (with fallback support)
 * 2. Check StrictMode / idempotency guard
 * 3. Account for sticky header offset
 * 4. Determine if target is ALREADY sufficiently visible -> DO NOT SCROLL if visible
 * 5. Check user manual scrolling intent (avoid hijacking viewport if user navigated away)
 * 6. Calculate optimal scroll position
 * 7. Focus target if requested
 */
export function revealDestination(
  optionsOrTarget: RevealDestinationOptions | string,
  extraOptions?: Partial<RevealDestinationOptions>
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const rawOptions: RevealDestinationOptions =
    typeof optionsOrTarget === "string"
      ? {
          target: optionsOrTarget,
          ...extraOptions,
        }
      : {
          ...optionsOrTarget,
          ...extraOptions,
        };

  const effectiveMode: RevealMode =
    rawOptions.alignment || rawOptions.mode || "result";

  const {
    target,
    fallbackTarget,
    mode = effectiveMode,
    focus = true,
    behavior: requestedBehavior = "smooth",
    offset: customOffset,
    reason = "action_completed",
    operationId,
    force = false,
    onOffscreenReady,
  } = rawOptions;

  // 1. StrictMode & Idempotency Guard (Section 35)
  if (operationId) {
    if (!rememberOperation(operationId)) {
      // Already revealed this operation
      return false;
    }
  }

  // 2. Resolve target element
  let element = resolveTargetElement(target);
  if (!element && fallbackTarget) {
    element = resolveTargetElement(fallbackTarget);
  }

  if (!element) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[ActionDestination] Destination not found for target: "${target}" (fallback: "${fallbackTarget}"). Reason: ${reason}`
      );
    }
    return false;
  }

  const headerOffset = customOffset ?? getStickyHeaderOffset();

  // 3. Determine if target is ALREADY comfortably visible (Section 6)
  if (!force && isElementInViewport(element, { headerOffset })) {
    // Target is already visible in viewport! Do NOT scroll.
    if (focus) {
      setAccessibleFocus(element);
    }
    return true;
  }

  // 4. Reduced Motion check (Section 31)
  const isReduced = prefersReducedMotion();
  const scrollBehavior: ScrollBehavior = isReduced ? "auto" : requestedBehavior;

  // 5. Calculate optimal scroll position (Section 8)
  const rect = element.getBoundingClientRect();
  const currentScrollY = window.scrollY || window.pageYOffset;

  let targetScrollY: number;

  switch (mode) {
    case "error":
    case "start":
    case "section":
    case "navigation":
      // Align top below sticky header
      targetScrollY = currentScrollY + rect.top - headerOffset - 16;
      break;

    case "center":
      // Center in comfortable reading viewport
      targetScrollY =
        currentScrollY +
        rect.top -
        headerOffset -
        Math.max(16, (window.innerHeight - headerOffset - rect.height) / 2);
      break;

    case "nearest":
    case "minimal":
    case "upload":
      // Minimal adjustment to bring into view without excessive scrolling
      if (rect.top < headerOffset) {
        targetScrollY = currentScrollY + rect.top - headerOffset - 16;
      } else if (rect.bottom > window.innerHeight) {
        targetScrollY = currentScrollY + rect.bottom - window.innerHeight + 24;
      } else {
        targetScrollY = currentScrollY;
      }
      break;

    case "result":
    default:
      // Bring result into view below header with breathing room
      targetScrollY = currentScrollY + rect.top - headerOffset - 16;
  }

  // Ensure targetScrollY is within document bounds
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clampedScrollY = Math.max(0, Math.min(Math.round(targetScrollY), maxScroll));

  // Perform smooth/instant scroll
  try {
    window.scrollTo({
      top: clampedScrollY,
      behavior: scrollBehavior,
    });
  } catch {
    window.scrollTo(0, clampedScrollY);
  }

  // 6. Accessible Focus (Section 29)
  if (focus) {
    // If smooth scrolling, delay focus slightly so screen readers read from settled position
    if (scrollBehavior === "smooth") {
      setTimeout(() => {
        setAccessibleFocus(element);
      }, 350);
    } else {
      setAccessibleFocus(element);
    }
  }

  return true;
}

/**
 * Sets accessible focus on target element or its main heading without visual outline jank
 */
export function setAccessibleFocus(element: HTMLElement): void {
  if (!element) return;

  // Try finding primary heading inside element first
  const heading = element.querySelector("h1, h2, h3, h4, [role='heading']") as HTMLElement | null;
  const focusTarget = heading || element;

  const originalTabIndex = focusTarget.getAttribute("tabindex");
  if (originalTabIndex === null) {
    focusTarget.setAttribute("tabindex", "-1");
  }

  try {
    focusTarget.focus({ preventScroll: true });
  } catch {}

  // If we dynamically added tabindex="-1", clean it up on blur
  if (originalTabIndex === null) {
    const handleBlur = () => {
      focusTarget.removeAttribute("tabindex");
      focusTarget.removeEventListener("blur", handleBlur);
    };
    focusTarget.addEventListener("blur", handleBlur, { once: true });
  }
}

/**
 * CENTRAL ACTION DESTINATION MAP (Section 39)
 */
export const ACTION_DESTINATION_MAP: Record<string, ActionDestinationConfig> = {
  // Calculators (Section 12, 42, 46)
  "calculator.calculated": {
    page: "Student Calculators (/student/*)",
    primaryTarget: "#calculation-result",
    fallbackTarget: "[data-saarvi-target='calculation-result']",
    type: "result",
    mode: "center",
    focus: true,
    label: "Calculation Result",
  },
  "sgpa.calculate": {
    page: "SGPA Calculator (/student/sgpa-calculator)",
    primaryTarget: "#calculation-result",
    fallbackTarget: "[data-saarvi-target='calculation-result']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Semester SGPA Result",
  },
  "cgpa.calculate": {
    page: "CGPA Calculator (/student/cgpa-calculator)",
    primaryTarget: "#cgpa-result",
    fallbackTarget: "[data-saarvi-target='calculation-result']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Cumulative CGPA Result",
  },
  "marks.calculate": {
    page: "Marks Calculator (/student/marks-calculator)",
    primaryTarget: "#marks-result",
    fallbackTarget: "[data-saarvi-target='calculation-result']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Marks Score Result",
  },
  "percentage.calculate": {
    page: "Percentage Calculator (/student/percentage)",
    primaryTarget: "#percentage-result",
    fallbackTarget: "[data-saarvi-target='calculation-result']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Aggregate Percentage Result",
  },
  "attendance.calculate": {
    page: "Attendance Calculator (/student/attendance)",
    primaryTarget: "#attendance-result",
    fallbackTarget: "[data-saarvi-target='calculation-result']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Attendance Requirement Result",
  },

  // Tools & Converters (Section 10, 11, 47, 48)
  "tool.process.complete": {
    page: "Universal Tool Runner (/tools/[slug])",
    primaryTarget: "#tool-result",
    fallbackTarget: "[data-saarvi-target='tool-result']",
    type: "tool_completion",
    mode: "result",
    focus: true,
    label: "Tool Conversion & Download",
  },
  "tool.process.error": {
    page: "Universal Tool Runner (/tools/[slug])",
    primaryTarget: "#tool-error",
    fallbackTarget: "[data-saarvi-target='tool-error']",
    type: "tool_completion",
    mode: "error",
    focus: true,
    label: "Tool Processing Error",
  },
  "ai_tool.process.complete": {
    page: "AI Tool Runner (/tools/ai)",
    primaryTarget: "#ai-tool-result",
    fallbackTarget: "[data-saarvi-target='tool-result']",
    type: "tool_completion",
    mode: "result",
    focus: true,
    label: "AI Processing Result",
  },

  // Jobs & Opportunities (Section 15, 16, 44)
  "search.submitted": {
    page: "Opportunities Directory (/jobs)",
    primaryTarget: "#jobs-search-results",
    fallbackTarget: "[data-saarvi-target='search-results']",
    type: "search_results",
    mode: "section",
    focus: true,
    label: "Search Results",
  },
  "jobs.search": {
    page: "Opportunities Directory (/jobs)",
    primaryTarget: "#jobs-search-results",
    fallbackTarget: "[data-saarvi-target='search-results']",
    type: "search_results",
    mode: "section",
    focus: true,
    label: "Job & Internship Search Results",
  },
  "jobs.filter": {
    page: "Opportunities Directory (/jobs)",
    primaryTarget: "#jobs-search-results",
    fallbackTarget: "[data-saarvi-target='search-results']",
    type: "search_results",
    mode: "minimal",
    focus: false,
    label: "Filtered Opportunities List",
  },

  // Builders (Section 13, 14, 43, 49)
  "resume.template.selected": {
    page: "Resume Builder (/student/resume)",
    primaryTarget: "#resume-editor-section",
    fallbackTarget: "[data-saarvi-target='resume-editor']",
    type: "section",
    mode: "start",
    focus: true,
    label: "Resume Editor Section",
  },
  "resume.preview": {
    page: "Resume Builder (/student/resume)",
    primaryTarget: "#resume-preview-container",
    fallbackTarget: "[data-saarvi-target='preview']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Resume Live Preview",
  },
  "resume.generated": {
    page: "Resume Builder (/student/resume)",
    primaryTarget: "#resume-preview-panel",
    fallbackTarget: "[data-saarvi-target='preview']",
    type: "result",
    mode: "center",
    focus: true,
    label: "Generated Resume Preview",
  },
  "cover_letter.preview": {
    page: "Cover Letter Builder (/student/cover-letter)",
    primaryTarget: "#cover-letter-preview",
    fallbackTarget: "[data-saarvi-target='preview']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Cover Letter Live Preview",
  },
  "coverletter.generated": {
    page: "Cover Letter Builder (/student/cover-letter)",
    primaryTarget: "#cover-letter-preview",
    fallbackTarget: "[data-saarvi-target='preview']",
    type: "result",
    mode: "center",
    focus: true,
    label: "Generated Cover Letter Preview",
  },

  // Feedback & Validation (Section 20, 22)
  "feedback.submitted": {
    page: "User Feedback Modal",
    primaryTarget: "#feedback-status",
    fallbackTarget: "[data-saarvi-target='feedback-success']",
    type: "success",
    mode: "success",
    focus: true,
    label: "Feedback Submission Confirmation",
  },
  "feedback.submit": {
    page: "User Feedback Modal",
    primaryTarget: "#feedback-status",
    fallbackTarget: "[data-saarvi-target='feedback-success']",
    type: "success",
    mode: "success",
    focus: true,
    label: "Feedback Submission Confirmation",
  },
  "form.validation.error": {
    page: "Global Form Validation",
    primaryTarget: "#form-errors",
    fallbackTarget: "[data-saarvi-target='form-errors']",
    type: "validation_error",
    mode: "error",
    focus: true,
    label: "Actionable Form Error",
  },
  // File Uploads & Tools (Section 8, 40, 41)
  "tool.file.selected": {
    page: "Universal Tool Runner (/tools/[slug])",
    primaryTarget: "#selected-file-section",
    fallbackTarget: "[data-saarvi-target='selected-file']",
    type: "upload",
    mode: "nearest",
    focus: false,
    label: "Selected Files & Options",
  },
  "tool.options": {
    page: "Universal Tool Runner (/tools/[slug])",
    primaryTarget: "#tool-options",
    fallbackTarget: "[data-saarvi-target='tool-options']",
    type: "section",
    mode: "nearest",
    focus: false,
    label: "Conversion Options",
  },
  "tool.file.error": {
    page: "Universal Tool Runner (/tools/[slug])",
    primaryTarget: "#tool-error",
    fallbackTarget: "[data-saarvi-target='tool-error']",
    type: "validation_error",
    mode: "error",
    focus: true,
    label: "File Validation Error",
  },

  // Templates (Section 18)
  "template.preview": {
    page: "Template Studio (/templates)",
    primaryTarget: "#template-preview",
    fallbackTarget: "[data-saarvi-target='preview']",
    type: "result",
    mode: "result",
    focus: true,
    label: "Template Preview",
  },
  "template.import": {
    page: "Template Studio (/templates)",
    primaryTarget: "#import-status",
    fallbackTarget: "[data-saarvi-target='import-status']",
    type: "success",
    mode: "success",
    focus: true,
    label: "Template Import Status",
  },

  // Application Tracker (Section 21)
  "tracker.status": {
    page: "Job Application Tracker (/student/jobs)",
    primaryTarget: "#tracker-status",
    fallbackTarget: "[data-saarvi-target='tracker-status']",
    type: "success",
    mode: "nearest",
    focus: false,
    label: "Application Status Updated",
  },

  // Admin (Section 23)
  "admin.publish": {
    page: "Admin Control Center (/admin)",
    primaryTarget: "#admin-publish-result",
    fallbackTarget: "[data-saarvi-target='publish-result']",
    type: "success",
    mode: "result",
    focus: true,
    label: "Admin Operation Summary",
  },
};

/**
 * Controller class to manage active operations, state transitions,
 * user intent tracking, and off-screen banners.
 */
export class ActionDestinationController {
  private activeOperations = new Map<
    string,
    {
      actionKey: string;
      startTime: number;
      initialScrollY: number;
      state: ActionState;
    }
  >();

  private latestOpId: string | null = null;

  /**
   * Directly reveals any target selector, data-attribute, or element
   */
  reveal(target: string | HTMLElement, options?: Partial<RevealDestinationOptions>): boolean {
    return revealDestination({
      target,
      ...options,
    });
  }

  /**
   * Sets accessible focus on target element or its main heading
   */
  focus(target: string | HTMLElement): void {
    const el = resolveTargetElement(target);
    if (el) {
      setAccessibleFocus(el);
    }
  }

  /**
   * Specifically reveals uploaded files / options section
   */
  revealUpload(target?: string, options?: Partial<RevealDestinationOptions>): boolean {
    return revealDestination({
      target: target || "#selected-file-section",
      fallbackTarget: "[data-saarvi-target='selected-file']",
      mode: "nearest",
      focus: false,
      reason: "file_upload_auto_reveal",
      ...options,
    });
  }

  /**
   * Specifically reveals result output section
   */
  revealResult(target?: string, options?: Partial<RevealDestinationOptions>): boolean {
    return revealDestination({
      target: target || "#tool-result",
      fallbackTarget: "[data-saarvi-target='tool-result']",
      mode: "result",
      focus: true,
      reason: "result_auto_reveal",
      ...options,
    });
  }

  /**
   * Specifically reveals error banner/input
   */
  revealError(target?: string, options?: Partial<RevealDestinationOptions>): boolean {
    return revealDestination({
      target: target || "#tool-error",
      fallbackTarget: "[data-saarvi-target='tool-error']",
      mode: "error",
      focus: true,
      reason: "error_auto_reveal",
      ...options,
    });
  }

  /**
   * Specifically reveals search results section
   */
  revealSearch(target?: string, options?: Partial<RevealDestinationOptions>): boolean {
    return revealDestination({
      target: target || "#search-results",
      fallbackTarget: "[data-saarvi-target='search-results']",
      mode: "section",
      focus: true,
      reason: "search_results_auto_reveal",
      ...options,
    });
  }

  /**
   * Start tracking an action (records initial viewport state for user intent heuristic)
   */
  startAction(actionKey: string): string {
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const initialScrollY = typeof window !== "undefined" ? window.scrollY : 0;

    this.activeOperations.set(opId, {
      actionKey,
      startTime: Date.now(),
      initialScrollY,
      state: "PROCESSING",
    });

    this.latestOpId = opId;
    return opId;
  }

  /**
   * Complete action and deterministically reveal destination or trigger off-screen banner
   */
  completeAction(
    opId: string,
    customOptions?: Partial<RevealDestinationOptions>
  ): { revealed: boolean; offscreen: boolean } {
    const op = this.activeOperations.get(opId);
    const config = op ? ACTION_DESTINATION_MAP[op.actionKey] : null;

    // Check async race condition (Section 33, 75):
    // If a newer operation has already started, do not reveal stale result
    if (this.latestOpId && this.latestOpId !== opId) {
      if (op) op.state = "SUCCESS";
      return { revealed: false, offscreen: false };
    }

    const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const initialScrollY = op ? op.initialScrollY : currentScrollY;
    const scrollDelta = Math.abs(currentScrollY - initialScrollY);

    const target = customOptions?.target || config?.primaryTarget || "#tool-result";
    const fallbackTarget = customOptions?.fallbackTarget || config?.fallbackTarget;
    const targetEl = resolveTargetElement(target) || resolveTargetElement(fallbackTarget);

    // User Manual Scroll Protection (Section 36, 37, 38):
    // If the user actively scrolled away > 160px while waiting for the result,
    // DO NOT violently hijack their viewport! Show the Smart Result Ready Banner instead.
    const userScrolledAway = scrollDelta > 160 && !customOptions?.force;
    const isTargetVisible = targetEl
      ? isElementInViewport(targetEl, { headerOffset: getStickyHeaderOffset() })
      : false;

    if (userScrolledAway && !isTargetVisible) {
      if (op) op.state = "READY_OFFSCREEN";

      const targetIdStr = typeof target === "string" ? target : targetEl?.id || "result";
      const label = config?.label || "Operation Completed";

      notifyOffscreenResult({
        operationId: opId,
        targetId: targetIdStr,
        label,
        scrollDelta,
      });

      return { revealed: false, offscreen: true };
    }

    // Direct reveal
    const success = revealDestination({
      target,
      fallbackTarget,
      mode: customOptions?.mode || config?.mode || "result",
      focus: customOptions?.focus ?? config?.focus ?? true,
      behavior: customOptions?.behavior || "smooth",
      reason: customOptions?.reason || op?.actionKey || "action_completed",
      operationId: opId,
      force: customOptions?.force,
    });

    if (op) {
      op.state = success ? "REVEALED" : "SUCCESS";
    }

    return { revealed: success, offscreen: false };
  }

  /**
   * Mark operation as failed and reveal error destination
   */
  failAction(
    opId: string,
    errorTarget?: string,
    options?: Partial<RevealDestinationOptions>
  ): boolean {
    const op = this.activeOperations.get(opId);
    if (op) op.state = "ERROR";

    return revealDestination({
      target: errorTarget || "#tool-error",
      fallbackTarget: "[data-saarvi-target='tool-error']",
      mode: "error",
      focus: true,
      behavior: "smooth",
      reason: "operation_failed",
      operationId: `${opId}_err`,
      ...options,
    });
  }

  getOperationState(opId: string): ActionState {
    return this.activeOperations.get(opId)?.state || "IDLE";
  }
}

// Global Singleton Instance & Reusable Architectural Aliases (Section 3)
export const globalActionController = new ActionDestinationController();
export const SmartRevealController = globalActionController;
export const SaarviViewportManager = globalActionController;
export const ActionRevealManager = globalActionController;

/**
 * AUTOMATED DESTINATION AUDIT & HEALTH REPORT (Section 59, 60)
 */
export function getActionDestinationHealthReport(): DestinationHealthItem[] {
  const items: DestinationHealthItem[] = [];

  for (const [actionKey, config] of Object.entries(ACTION_DESTINATION_MAP)) {
    let exists: boolean | "DOM_DEPENDENT" = "DOM_DEPENDENT";
    let status: DestinationHealthItem["status"] = "PASS";

    if (typeof document !== "undefined") {
      const primaryExists = !!resolveTargetElement(config.primaryTarget);
      const fallbackExists = config.fallbackTarget ? !!resolveTargetElement(config.fallbackTarget) : false;

      exists = primaryExists || fallbackExists;

      if (!primaryExists && !fallbackExists) {
        status = "BROKEN_DESTINATION";
      } else if (!fallbackExists) {
        status = "WARN_NO_FALLBACK";
      }
    } else {
      if (!config.fallbackTarget) {
        status = "WARN_NO_FALLBACK";
      }
    }

    items.push({
      page: config.page || actionKey,
      action: actionKey,
      actionType: config.type,
      destination: config.primaryTarget,
      exists,
      revealStrategy: `AUTO_REVEAL (${config.mode.toUpperCase()})`,
      focusStrategy: config.focus ? "ACCESSIBLE_HEADING_FOCUS" : "PRESERVE_INPUT_FOCUS",
      status,
    });
  }

  return items;
}
