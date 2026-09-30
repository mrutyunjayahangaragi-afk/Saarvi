/**
 * Saarvi Career Intelligence — Canonical Search Intent
 * Study. Work. Grow.
 *
 * Core Principle:
 * THE USER DOES NOT NEED TO TYPE A SEARCH QUERY.
 * The selected requirements themselves become the search intent.
 *
 * Three valid search paths:
 * PATH A — Structured Requirements only (Role, Branch, Domain, Location, Type, etc.)
 * PATH B — Optional Free Text ("React internship Bengaluru") parsed into structured intent.
 * PATH C — Hybrid (Text + Structured Requirements combined, where structured selections
 *           are first-class and never overwritten by free text).
 *
 * Invariant: "Any" or null means NO RESTRICTION. Never treat "Any location",
 * "Any experience", or "Any work mode" as literal search keywords!
 */

import {
  CANONICAL_JOB_ROLES,
  CANONICAL_BRANCHES,
  CANONICAL_DOMAINS,
  CANONICAL_LOCATIONS,
  CANONICAL_EXPERIENCE_LEVELS,
} from "./career-taxonomy.ts";

export type OpportunityTypeEnum = "JOB" | "INTERNSHIP" | "TRAINING";

export interface TaxonomyEntity {
  id: string;
  label: string;
  category?: string;
  aliases?: string[];
}

export interface CareerSearchIntent {
  /** Optional free text (never mandatory) */
  freeTextQuery: string | null;

  /** Primary requirement: Job Role */
  role: TaxonomyEntity | null;

  /** Eligibility & relevance signal: Academic Branch / Discipline */
  branch: TaxonomyEntity | null;

  /** Industry domain / technical domain */
  domain: TaxonomyEntity | null;

  /** Location / Area (null if "Any location") */
  location: TaxonomyEntity | null;

  /** Target opportunity types. If empty or "any", searches all 3 */
  opportunityTypes: OpportunityTypeEnum[];

  /** Experience level constraint (null if "Any experience") */
  experience: {
    id: string;
    label: string;
    minYears: number;
    maxYears: number;
  } | null;

  /** Work mode constraint (null if "Any work mode") */
  workMode: "remote" | "hybrid" | "onsite" | null;

  /** Explicitly selected skills */
  skills: string[];

  /** Additional secondary filters (e.g. stipend, duration, deliveryMode) */
  additionalFilters: Record<string, string>;

  /** Bounded query expansion variants for external connectors */
  expandedQueryVariants: string[];

  /** Whether the search contains at least one meaningful requirement */
  isValid: boolean;

  /** Validation or guidance note */
  validationMessage?: string;
}

export interface RawSearchInput {
  q?: string | null;
  role?: string | null;
  branch?: string | null;
  domain?: string | null;
  location?: string | null;
  opportunityType?: string | null;
  experience?: string | null;
  workMode?: string | null;
  skills?: string[] | string | null;
  duration?: string | null;
  stipend?: string | null;
  salary?: string | null;
  deliveryMode?: string | null;
}

/**
 * Normalizes input strings by stripping leading/trailing whitespace.
 * Returns null if string is empty or matches canonical "any" / "all" representations.
 */
function cleanRequirement(val?: string | null): string | null {
  if (!val) return null;
  const s = val.trim();
  const lower = s.toLowerCase();
  if (
    lower === "" ||
    lower === "all" ||
    lower === "any" ||
    lower === "any opportunity" ||
    lower === "any location" ||
    lower === "any experience" ||
    lower === "any work mode" ||
    lower === "all job roles" ||
    lower === "all branches" ||
    lower === "all domains"
  ) {
    return null;
  }
  return s;
}

/**
 * Bounded Role Expansion:
 * Maps canonical role to bounded set of 2–4 high-precision variants.
 * Never causes uncontrolled query explosions.
 */
export function expandRoleAliases(roleLabel: string): string[] {
  const clean = roleLabel.trim();
  const variants = new Set<string>([clean]);
  const lower = clean.toLowerCase();

  // Find in canonical taxonomy
  const matched = CANONICAL_JOB_ROLES.find(
    (r) => r.name.toLowerCase() === lower || r.id.toLowerCase() === lower
  );

  if (matched?.aliases) {
    for (const alias of matched.aliases.slice(0, 3)) {
      variants.add(alias);
    }
  }

  // Common high-precision software synonyms
  if (lower.includes("frontend")) {
    variants.add("Frontend Engineer");
    variants.add("UI Developer");
  } else if (lower.includes("backend")) {
    variants.add("Backend Engineer");
    variants.add("API Developer");
  } else if (lower.includes("full stack") || lower.includes("full-stack")) {
    variants.add("Full Stack Engineer");
    variants.add("Software Engineer");
  } else if (lower.includes("ai engineer") || lower.includes("artificial intelligence")) {
    variants.add("Machine Learning Engineer");
    variants.add("AI/ML Engineer");
  } else if (lower.includes("data scientist")) {
    variants.add("Data Analyst");
    variants.add("Applied Scientist");
  }

  return Array.from(variants).slice(0, 4);
}

/**
 * Bounded Location Expansion:
 * Handles dual naming (e.g. Bengaluru / Bangalore) without expanding into every city.
 */
export function expandLocationAliases(locationLabel: string): string[] {
  const clean = locationLabel.trim();
  const lower = clean.toLowerCase();
  const variants = new Set<string>([clean]);

  if (lower.includes("bengaluru") || lower.includes("bangalore")) {
    variants.add("Bengaluru");
    variants.add("Bangalore");
  } else if (lower.includes("delhi") || lower.includes("ncr") || lower.includes("noida") || lower.includes("gurgaon")) {
    variants.add("Delhi");
    variants.add("Noida");
    variants.add("Gurugram");
  } else if (lower.includes("belagavi") || lower.includes("belgaum")) {
    variants.add("Belagavi");
    variants.add("Belgaum");
  } else if (lower.includes("mysuru") || lower.includes("mysore")) {
    variants.add("Mysuru");
    variants.add("Mysore");
  }

  return Array.from(variants);
}

/**
 * Central Builder: Transforms user inputs (Path A, Path B, or Path C)
 * into a single canonical CareerSearchIntent.
 */
export function buildCareerSearchIntent(input: RawSearchInput = {}): CareerSearchIntent {
  const freeText = input.q ? input.q.trim() : null;

  // 1. Role Resolution
  const rawRole = cleanRequirement(input.role);
  let role: TaxonomyEntity | null = null;
  if (rawRole) {
    const matched = CANONICAL_JOB_ROLES.find(
      (r) => r.name.toLowerCase() === rawRole.toLowerCase() || r.id === rawRole.toLowerCase()
    );
    role = matched
      ? { id: matched.id, label: matched.name, category: matched.category, aliases: matched.aliases }
      : { id: rawRole.toLowerCase().replace(/\s+/g, "-"), label: rawRole };
  }

  // 2. Branch Resolution (Eligibility / Relevance signal, not hard filter)
  const rawBranch = cleanRequirement(input.branch);
  let branch: TaxonomyEntity | null = null;
  if (rawBranch) {
    const matched = CANONICAL_BRANCHES.find(
      (b) => b.name.toLowerCase() === rawBranch.toLowerCase() || b.id === rawBranch.toLowerCase()
    );
    branch = matched
      ? { id: matched.id, label: matched.name, category: matched.category }
      : { id: rawBranch.toLowerCase().replace(/\s+/g, "-"), label: rawBranch };
  }

  // 3. Domain Resolution
  const rawDomain = cleanRequirement(input.domain);
  let domain: TaxonomyEntity | null = null;
  if (rawDomain) {
    const matched = CANONICAL_DOMAINS.find(
      (d) => d.name.toLowerCase() === rawDomain.toLowerCase() || d.id === rawDomain.toLowerCase()
    );
    domain = matched
      ? { id: matched.id, label: matched.name, category: matched.category }
      : { id: rawDomain.toLowerCase().replace(/\s+/g, "-"), label: rawDomain };
  }

  // 4. Location Resolution
  const rawLoc = cleanRequirement(input.location);
  let location: TaxonomyEntity | null = null;
  if (rawLoc) {
    const matched = CANONICAL_LOCATIONS.find(
      (l) => l.name.toLowerCase() === rawLoc.toLowerCase() || l.id === rawLoc.toLowerCase()
    );
    location = matched
      ? { id: matched.id, label: matched.name, category: matched.category, aliases: matched.aliases }
      : { id: rawLoc.toLowerCase().replace(/\s+/g, "-"), label: rawLoc };
  }

  // 5. Opportunity Types Resolution
  // "Any" or null -> all 3 opportunity types [JOB, INTERNSHIP, TRAINING]
  const rawType = cleanRequirement(input.opportunityType);
  let opportunityTypes: OpportunityTypeEnum[] = ["JOB", "INTERNSHIP", "TRAINING"];
  if (rawType) {
    const lower = rawType.toLowerCase();
    if (lower === "job" || lower === "full-time" || lower === "jobs") {
      opportunityTypes = ["JOB"];
    } else if (lower === "internship" || lower === "internships" || lower === "intern") {
      opportunityTypes = ["INTERNSHIP"];
    } else if (lower === "training" || lower === "bootcamp" || lower === "courses") {
      opportunityTypes = ["TRAINING"];
    }
  }

  // 6. Experience Resolution
  const rawExp = cleanRequirement(input.experience);
  let experience: CareerSearchIntent["experience"] = null;
  if (rawExp) {
    const matched = CANONICAL_EXPERIENCE_LEVELS.find(
      (e) => e.id.toLowerCase() === rawExp.toLowerCase() || e.label.toLowerCase().includes(rawExp.toLowerCase())
    );
    if (matched && matched.id !== "all") {
      experience = {
        id: matched.id,
        label: matched.label,
        minYears: matched.minYears,
        maxYears: matched.maxYears,
      };
    }
  }

  // 7. Work Mode Resolution
  const rawMode = cleanRequirement(input.workMode);
  let workMode: CareerSearchIntent["workMode"] = null;
  if (rawMode) {
    const lower = rawMode.toLowerCase();
    if (lower.includes("remote")) workMode = "remote";
    else if (lower.includes("hybrid")) workMode = "hybrid";
    else if (lower.includes("onsite") || lower.includes("on-site")) workMode = "onsite";
  }

  // 8. Skills Resolution
  let skills: string[] = [];
  if (Array.isArray(input.skills)) {
    skills = input.skills.filter(Boolean);
  } else if (typeof input.skills === "string") {
    skills = input.skills.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // 9. Additional Filters
  const additionalFilters: Record<string, string> = {};
  if (cleanRequirement(input.duration)) additionalFilters.duration = input.duration!.trim();
  if (cleanRequirement(input.stipend)) additionalFilters.stipend = input.stipend!.trim();
  if (cleanRequirement(input.salary)) additionalFilters.salary = input.salary!.trim();
  if (cleanRequirement(input.deliveryMode)) additionalFilters.deliveryMode = input.deliveryMode!.trim();

  // 10. Generate Bounded Query Expansion Variants
  const expandedVariants = new Set<string>();

  // If free text exists, it leads the variants
  if (freeText) {
    expandedVariants.add(freeText);
  }

  // Role variants
  if (role) {
    const roleAliases = expandRoleAliases(role.label);
    for (const r of roleAliases) {
      if (opportunityTypes.length === 1 && opportunityTypes[0] === "INTERNSHIP") {
        expandedVariants.add(`${r} Intern`);
        expandedVariants.add(`${r} Internship`);
      } else {
        expandedVariants.add(r);
      }
    }
  } else if (domain) {
    expandedVariants.add(domain.label);
  }

  // 11. Validation Check:
  // Is at least one meaningful search requirement provided?
  const hasMeaningfulRequirement = Boolean(
    freeText ||
    role ||
    branch ||
    domain ||
    location ||
    experience ||
    workMode ||
    skills.length > 0 ||
    (rawType && rawType.toLowerCase() !== "any")
  );

  return {
    freeTextQuery: freeText,
    role,
    branch,
    domain,
    location,
    opportunityTypes,
    experience,
    workMode,
    skills,
    additionalFilters,
    expandedQueryVariants: Array.from(expandedVariants).slice(0, 4),
    isValid: hasMeaningfulRequirement,
    validationMessage: hasMeaningfulRequirement
      ? undefined
      : "Choose a role, opportunity type, location, domain, or enter a search.",
  };
}

/**
 * Deterministic fingerprint used for deduplicating queries in the cache.
 */
export function computeQueryFingerprint(intent: CareerSearchIntent): string {
  const parts = [
    intent.freeTextQuery?.toLowerCase().trim() || "_",
    intent.role?.id || "_",
    intent.branch?.id || "_",
    intent.domain?.id || "_",
    intent.location?.id || "_",
    intent.opportunityTypes.slice().sort().join("-"),
    intent.experience?.id || "_",
    intent.workMode || "_",
    intent.skills.slice().sort().join("-") || "_",
  ];
  return `intent_v7:${parts.join(":")}`;
}
