/**
 * Saarvi Opportunity Deadline Intelligence Engine
 *
 * Implements deterministic deadline monitoring, closing tiers,
 * and reminder threshold evaluation.
 */

export type DeadlineState = "OPEN" | "CLOSING_SOON" | "CLOSED" | "UNKNOWN";

export interface DeadlineEvaluation {
  state: DeadlineState;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  humanCountdownText: string;
  isExpired: boolean;
  triggersNotice: boolean;
  triggerTier?: "7_DAYS" | "3_DAYS" | "1_DAY" | "24_HOURS" | "6_HOURS";
}

export function evaluateOpportunityDeadline(
  deadlineDateStr?: string | null,
  baseDate = new Date()
): DeadlineEvaluation {
  if (!deadlineDateStr) {
    return {
      state: "UNKNOWN",
      daysRemaining: null,
      hoursRemaining: null,
      humanCountdownText: "No deadline specified",
      isExpired: false,
      triggersNotice: false,
    };
  }

  const targetDate = new Date(deadlineDateStr);
  const diffMs = targetDate.getTime() - baseDate.getTime();

  if (diffMs <= 0) {
    return {
      state: "CLOSED",
      daysRemaining: 0,
      hoursRemaining: 0,
      humanCountdownText: "Application closed",
      isExpired: true,
      triggersNotice: false,
    };
  }

  const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));
  const daysRemaining = Math.floor(hoursRemaining / 24);

  let state: DeadlineState = "OPEN";
  if (daysRemaining <= 3) {
    state = "CLOSING_SOON";
  }

  let humanCountdownText = `${daysRemaining} days remaining`;
  let triggerTier: DeadlineEvaluation["triggerTier"] = undefined;
  let triggersNotice = false;

  if (hoursRemaining <= 6) {
    humanCountdownText = `${hoursRemaining} hours remaining!`;
    triggerTier = "6_HOURS";
    triggersNotice = true;
  } else if (hoursRemaining <= 24) {
    humanCountdownText = `Closes in ${hoursRemaining} hours`;
    triggerTier = "24_HOURS";
    triggersNotice = true;
  } else if (daysRemaining === 1) {
    humanCountdownText = "Closes tomorrow";
    triggerTier = "1_DAY";
    triggersNotice = true;
  } else if (daysRemaining <= 3) {
    humanCountdownText = `Closes in ${daysRemaining} days`;
    triggerTier = "3_DAYS";
    triggersNotice = true;
  } else if (daysRemaining === 7) {
    humanCountdownText = "Closes in 7 days";
    triggerTier = "7_DAYS";
    triggersNotice = true;
  }

  return {
    state,
    daysRemaining,
    hoursRemaining,
    humanCountdownText,
    isExpired: false,
    triggersNotice,
    triggerTier,
  };
}
