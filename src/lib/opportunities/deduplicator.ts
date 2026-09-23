/**
 * Saarvi Opportunity Deduplication Engine
 *
 * Implements deterministic multi-tier deduplication:
 * 1. Canonical Composite Key: normalizedCompany + normalizedTitle + normalizedLocation
 * 2. Canonical Application URL (stripping tracking query params)
 * 3. Content Hash matching
 *
 * Merges duplicate sources into unified opportunities without displaying duplicate listings.
 */

import type { Opportunity } from "./types.ts";
import { normalizeCompanyName, normalizeJobTitle } from "./normalizer.ts";

export function getCanonicalJobUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    // Strip common analytics tracking params
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "fbclid", "gclid", "source", "trk", "trackingId",
    ];
    for (const p of trackingParams) {
      parsed.searchParams.delete(p);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function generateOpportunityCompositeKey(company: string, title: string, location: string): string {
  const normComp = normalizeCompanyName(company);
  const normTitle = normalizeJobTitle(title);
  const normLoc = location.trim().toLowerCase().split(",")[0].trim();
  return `${normComp}:${normTitle}:${normLoc}`;
}

export interface DeduplicationResult {
  uniqueOpportunities: Opportunity[];
  duplicatesMergedCount: number;
}

export function deduplicateOpportunities(opportunities: Opportunity[]): DeduplicationResult {
  const keyMap = new Map<string, Opportunity>();
  const urlMap = new Map<string, Opportunity>();
  const hashSet = new Set<string>();
  let duplicatesMergedCount = 0;

  for (const opp of opportunities) {
    const compKey = generateOpportunityCompositeKey(opp.companyName, opp.title, opp.location);
    const canonicalUrl = getCanonicalJobUrl(opp.applyUrl);

    // Check if this opportunity matches an existing one by composite key, URL, or content hash
    const existing = keyMap.get(compKey) || urlMap.get(canonicalUrl);

    if (existing) {
      duplicatesMergedCount++;
      // Merge source information and skills
      const existingSources = new Set(existing.duplicateSources || [existing.source]);
      existingSources.add(opp.source);
      existing.duplicateSources = Array.from(existingSources);

      // Merge any newly discovered skills
      const combinedSkills = new Set([...existing.skills, ...opp.skills]);
      existing.skills = Array.from(combinedSkills).sort();

      // If existing had no direct apply URL but new one does, upgrade apply URL
      if (!existing.directApplyUrl && opp.directApplyUrl) {
        existing.directApplyUrl = opp.directApplyUrl;
        existing.applyUrl = opp.applyUrl;
      }
    } else {
      keyMap.set(compKey, opp);
      urlMap.set(canonicalUrl, opp);
      hashSet.add(opp.contentHash);
    }
  }

  return {
    uniqueOpportunities: Array.from(keyMap.values()),
    duplicatesMergedCount,
  };
}
