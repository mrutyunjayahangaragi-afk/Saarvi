/**
 * Saarvi Opportunity Change Detection & Announcement Engine
 *
 * Compares normalized attributes and content hashes to detect meaningful updates:
 * 1. Deadline extensions / changes
 * 2. Requirements and skill updates
 * 3. Status changes (Application Open / Closed)
 *
 * Produces exact, explainable change diff descriptions instead of generic alerts.
 */

import type { Opportunity } from "./types.ts";

export interface OpportunityFieldDiff {
  fieldName: "deadline" | "skills" | "title" | "location" | "status" | "applyUrl";
  oldValue: string;
  newValue: string;
  description: string;
}

export interface OpportunityChangeDetectionResult {
  hasMeaningfulChange: boolean;
  opportunityId: string;
  diffs: OpportunityFieldDiff[];
  summaryMessage: string;
}

export function detectOpportunityChanges(
  previous: Opportunity,
  current: Opportunity
): OpportunityChangeDetectionResult {
  const diffs: OpportunityFieldDiff[] = [];

  // 1. Deadline Changed
  if (previous.applicationDeadline !== current.applicationDeadline) {
    const oldD = previous.applicationDeadline || "Not specified";
    const newD = current.applicationDeadline || "Not specified";
    diffs.push({
      fieldName: "deadline",
      oldValue: oldD,
      newValue: newD,
      description: `Application deadline changed from ${oldD} to ${newD}.`,
    });
  }

  // 2. Status Changed
  if (previous.status !== current.status) {
    diffs.push({
      fieldName: "status",
      oldValue: previous.status,
      newValue: current.status,
      description: `Opportunity status changed from ${previous.status} to ${current.status}.`,
    });
  }

  // 3. Location Changed
  if (previous.location.trim().toLowerCase() !== current.location.trim().toLowerCase()) {
    diffs.push({
      fieldName: "location",
      oldValue: previous.location,
      newValue: current.location,
      description: `Role location updated to ${current.location}.`,
    });
  }

  // 4. Skills / Requirements Changed
  const oldSkillsSet = new Set(previous.skills.map((s) => s.toLowerCase()));
  const newSkillsSet = new Set(current.skills.map((s) => s.toLowerCase()));
  const addedSkills = current.skills.filter((s) => !oldSkillsSet.has(s.toLowerCase()));

  if (addedSkills.length > 0) {
    diffs.push({
      fieldName: "skills",
      oldValue: previous.skills.join(", "),
      newValue: current.skills.join(", "),
      description: `New skill requirements added: ${addedSkills.join(", ")}.`,
    });
  }

  const hasMeaningfulChange = diffs.length > 0;
  let summaryMessage = "No changes detected.";

  if (hasMeaningfulChange) {
    summaryMessage = diffs.map((d) => d.description).join(" ");
  }

  return {
    hasMeaningfulChange,
    opportunityId: current.id,
    diffs,
    summaryMessage,
  };
}
