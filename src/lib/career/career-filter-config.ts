/**
 * Saarvi Canonical Career Filter Intelligence & Intent Parsing System
 * Study. Work. Grow.
 *
 * Centralized, admin-controlled configuration for Career Search filters
 * across Opportunity Types (Job, Internship, Training).
 *
 * Provides:
 * 1. CareerFilterConfig schema & canonical filter definitions.
 * 2. Dynamic filter intelligence: returns only contextually relevant filters for current search.
 * 3. Deterministic natural-language intent parser (zero AI hallucinations).
 * 4. Authoritative live opportunity predicate integration.
 */

import { isJobLiveForUsers } from "../jobs/live-predicate.ts";

export type OpportunityScope = "any" | "job" | "internship" | "training";

export interface FilterOption {
  label: string;
  value: string;
}

export interface CareerFilterConfig {
  key: string;
  label: string;
  opportunityTypes: OpportunityScope[];
  categories: string[];
  enabled: boolean;
  priority: number; // 1 = Primary refinement (always shown if relevant), 2 = Secondary, 3 = Progressive disclosure ("More filters")
  searchable?: boolean;
  multiSelect?: boolean;
  userVisible: boolean;
  adminOnly?: boolean;
  sortOrder: number;
  options?: FilterOption[];
  placeholder?: string;
  description?: string;
}

/**
 * CANONICAL CAREER FILTER CONFIGURATIONS
 * Admin-controlled registry of filters for all career opportunity types.
 */
export const CAREER_FILTER_CONFIGS: CareerFilterConfig[] = [
  // 1. Work Mode (Relevant to Job, Internship, and Any)
  {
    key: "remote",
    label: "Work Mode",
    opportunityTypes: ["any", "job", "internship"],
    categories: ["all", "tech", "business", "design"],
    enabled: true,
    priority: 1,
    multiSelect: false,
    userVisible: true,
    sortOrder: 10,
    options: [
      { label: "All Work Modes", value: "all" },
      { label: "Remote Only", value: "remote" },
      { label: "Hybrid", value: "hybrid" },
      { label: "On-site", value: "onsite" },
    ],
  },

  // 2. Experience Level (Primary for Jobs, Secondary for Any)
  {
    key: "experience",
    label: "Experience",
    opportunityTypes: ["job", "any"],
    categories: ["all"],
    enabled: true,
    priority: 1,
    multiSelect: false,
    userVisible: true,
    sortOrder: 20,
    options: [
      { label: "All Experience", value: "all" },
      { label: "Fresher / 0 yrs", value: "fresher" },
      { label: "Entry Level (0-2 yrs)", value: "entry-level" },
      { label: "Mid Level (2-5 yrs)", value: "mid-level" },
      { label: "Senior (5+ yrs)", value: "senior" },
    ],
  },

  // 3. Internship Duration (Primary for Internships)
  {
    key: "duration",
    label: "Duration",
    opportunityTypes: ["internship", "training"],
    categories: ["all"],
    enabled: true,
    priority: 1,
    multiSelect: false,
    userVisible: true,
    sortOrder: 25,
    options: [
      { label: "Any Duration", value: "all" },
      { label: "1 - 2 Months", value: "1-2-months" },
      { label: "3 - 6 Months", value: "3-6-months" },
      { label: "6+ Months", value: "6-plus-months" },
    ],
  },

  // 4. Stipend / Compensation (Primary for Internships)
  {
    key: "stipend",
    label: "Stipend",
    opportunityTypes: ["internship"],
    categories: ["all"],
    enabled: true,
    priority: 2,
    multiSelect: false,
    userVisible: true,
    sortOrder: 30,
    options: [
      { label: "Any Stipend", value: "all" },
      { label: "₹10,000+ / mo", value: "10k_plus" },
      { label: "₹20,000+ / mo", value: "20k_plus" },
      { label: "₹30,000+ / mo", value: "30k_plus" },
      { label: "Paid Only", value: "paid" },
    ],
  },

  // 5. Salary Range (Secondary for Jobs under progressive disclosure)
  {
    key: "salary",
    label: "Salary Band",
    opportunityTypes: ["job"],
    categories: ["all"],
    enabled: true,
    priority: 3, // More filters
    multiSelect: false,
    userVisible: true,
    sortOrder: 35,
    options: [
      { label: "Any Salary", value: "all" },
      { label: "₹3 - 6 LPA", value: "3-6-lpa" },
      { label: "₹6 - 10 LPA", value: "6-10-lpa" },
      { label: "₹10 - 18 LPA", value: "10-18-lpa" },
      { label: "₹18+ LPA", value: "18-plus-lpa" },
    ],
  },

  // 6. Employment Type (Jobs)
  {
    key: "employmentType",
    label: "Employment Type",
    opportunityTypes: ["job"],
    categories: ["all"],
    enabled: true,
    priority: 3, // More filters
    multiSelect: false,
    userVisible: true,
    sortOrder: 40,
    options: [
      { label: "All Types", value: "all" },
      { label: "Full-time", value: "full-time" },
      { label: "Part-time", value: "part-time" },
      { label: "Contract", value: "contract" },
    ],
  },

  // 7. Training Delivery Mode (Training)
  {
    key: "deliveryMode",
    label: "Delivery Mode",
    opportunityTypes: ["training"],
    categories: ["all"],
    enabled: true,
    priority: 1,
    multiSelect: false,
    userVisible: true,
    sortOrder: 15,
    options: [
      { label: "All Modes", value: "all" },
      { label: "Online Live / Self-Paced", value: "online" },
      { label: "Classroom / Offline", value: "offline" },
      { label: "Hybrid", value: "hybrid" },
    ],
  },

  // 8. Training Certification & Fee (Training)
  {
    key: "feeType",
    label: "Fee & Certificate",
    opportunityTypes: ["training"],
    categories: ["all"],
    enabled: true,
    priority: 2,
    multiSelect: false,
    userVisible: true,
    sortOrder: 45,
    options: [
      { label: "All Training", value: "all" },
      { label: "Free / Sponsored", value: "free" },
      { label: "With Certificate", value: "certificate" },
      { label: "Placement Guaranteed / Assisted", value: "placement_assisted" },
    ],
  },

  // 9. Key Skills (Progressive disclosure for all opportunity types)
  {
    key: "skills",
    label: "Key Skills",
    opportunityTypes: ["any", "job", "internship", "training"],
    categories: ["all"],
    enabled: true,
    priority: 3, // More filters
    searchable: true,
    multiSelect: true,
    userVisible: true,
    sortOrder: 50,
    options: [
      { label: "React", value: "react" },
      { label: "Node.js", value: "nodejs" },
      { label: "Python", value: "python" },
      { label: "Java", value: "java" },
      { label: "TypeScript", value: "typescript" },
      { label: "SQL / PostgreSQL", value: "sql" },
      { label: "Machine Learning / AI", value: "ai_ml" },
      { label: "Data Structures", value: "dsa" },
      { label: "AWS / Cloud", value: "cloud" },
    ],
  },

  // 10. Start Date / Timeline (Progressive disclosure)
  {
    key: "startDate",
    label: "Start Date",
    opportunityTypes: ["internship", "training"],
    categories: ["all"],
    enabled: true,
    priority: 3, // More filters
    multiSelect: false,
    userVisible: true,
    sortOrder: 60,
    options: [
      { label: "Immediately", value: "immediate" },
      { label: "Within 2 Weeks", value: "2weeks" },
      { label: "Within 1 Month", value: "1month" },
      { label: "Flexible", value: "flexible" },
    ],
  },
];

/**
 * Returns dynamic filters for a given opportunity scope with progressive disclosure.
 * Primary filters are shown right below search; secondary/more filters appear under [More filters].
 */
export function getFiltersForOpportunity(
  type: OpportunityScope = "any"
): {
  primary: CareerFilterConfig[];
  more: CareerFilterConfig[];
} {
  const eligible = CAREER_FILTER_CONFIGS.filter(
    (f) =>
      f.enabled &&
      f.userVisible &&
      (f.opportunityTypes.includes("any") || f.opportunityTypes.includes(type))
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  const primary = eligible.filter((f) => f.priority <= 2);
  const more = eligible.filter((f) => f.priority > 2);

  return { primary, more };
}

/**
 * Deterministic Natural Search Intent Result
 */
export interface ParsedCareerIntent {
  rawQuery: string;
  cleanQuery: string;
  opportunityType: OpportunityScope;
  workMode?: "remote" | "hybrid" | "onsite";
  location?: string;
  experience?: "fresher" | "entry-level" | "mid-level" | "senior";
  domain?: string;
  matchedTokens: string[];
}

const KNOWN_LOCATIONS = [
  "bengaluru",
  "bangalore",
  "hyderabad",
  "pune",
  "mumbai",
  "delhi",
  "noida",
  "gurugram",
  "gurgaon",
  "chennai",
  "kolkata",
  "ahmedabad",
  "kochi",
  "india",
];

const KNOWN_DOMAINS = [
  { match: /\b(ai|artificial intelligence|ml|machine learning)\b/i, name: "AI / Machine Learning" },
  { match: /\b(frontend|react|vue|angular|nextjs|web)\b/i, name: "Frontend Development" },
  { match: /\b(backend|node|django|spring boot|fastapi|java|golang)\b/i, name: "Backend Development" },
  { match: /\b(full[- ]?stack)\b/i, name: "Full Stack" },
  { match: /\b(data science|data analyst|analytics)\b/i, name: "Data Science" },
  { match: /\b(devops|cloud|aws|kubernetes|docker)\b/i, name: "Cloud & DevOps" },
  { match: /\b(cybersecurity|security)\b/i, name: "Cybersecurity" },
];

/**
 * Deterministic Career Search Intent Parser
 *
 * Interprets queries like:
 * "React internship in Bengaluru" -> { opportunityType: 'internship', location: 'Bengaluru', cleanQuery: 'React' }
 * "Java fresher job" -> { opportunityType: 'job', experience: 'fresher', cleanQuery: 'Java' }
 * "AI internship remote" -> { opportunityType: 'internship', domain: 'AI / Machine Learning', workMode: 'remote', cleanQuery: 'AI' }
 * "Full-stack training" -> { opportunityType: 'training', domain: 'Full Stack', cleanQuery: 'Full-stack' }
 *
 * Uses deterministic normalization without artificial AI generation.
 */
export function parseCareerSearchIntent(rawQuery: string): ParsedCareerIntent {
  if (!rawQuery || !rawQuery.trim()) {
    return {
      rawQuery: "",
      cleanQuery: "",
      opportunityType: "any",
      matchedTokens: [],
    };
  }

  const query = rawQuery.trim();
  const lower = query.toLowerCase();
  const matchedTokens: string[] = [];

  let opportunityType: OpportunityScope = "any";
  let workMode: "remote" | "hybrid" | "onsite" | undefined;
  let location: string | undefined;
  let experience: "fresher" | "entry-level" | "mid-level" | "senior" | undefined;
  let domain: string | undefined;

  // 1. Detect Opportunity Type Intent
  if (/\b(internship|intern|interns|trainee)\b/i.test(lower)) {
    opportunityType = "internship";
    matchedTokens.push("Internship");
  } else if (/\b(training|course|bootcamp|certification|learn)\b/i.test(lower)) {
    opportunityType = "training";
    matchedTokens.push("Training");
  } else if (/\b(job|jobs|full-time|fulltime|fresher job|developer|engineer)\b/i.test(lower)) {
    opportunityType = "job";
    if (/\b(job|jobs)\b/i.test(lower)) {
      matchedTokens.push("Job");
    }
  }

  // 2. Detect Work Mode Intent
  if (/\b(remote|work from home|wfh)\b/i.test(lower)) {
    workMode = "remote";
    matchedTokens.push("Remote");
  } else if (/\b(hybrid)\b/i.test(lower)) {
    workMode = "hybrid";
    matchedTokens.push("Hybrid");
  } else if (/\b(onsite|on-site|in-office)\b/i.test(lower)) {
    workMode = "onsite";
    matchedTokens.push("On-site");
  }

  // 3. Detect Experience Intent
  if (/\b(fresher|freshers|2024|2025|2026|campus|graduate)\b/i.test(lower)) {
    experience = "fresher";
    matchedTokens.push("Fresher");
  } else if (/\b(entry level|entry-level|junior|0-1|0-2)\b/i.test(lower)) {
    experience = "entry-level";
    matchedTokens.push("Entry-Level");
  } else if (/\b(senior|lead|architect|5\+)\b/i.test(lower)) {
    experience = "senior";
    matchedTokens.push("Senior");
  }

  // 4. Detect Location Intent
  for (const loc of KNOWN_LOCATIONS) {
    const locRegex = new RegExp(`\\b${loc}\\b`, "i");
    if (locRegex.test(lower)) {
      // Capitalize properly
      location = loc === "bengaluru" || loc === "bangalore" ? "Bengaluru" : loc.charAt(0).toUpperCase() + loc.slice(1);
      matchedTokens.push(location);
      break;
    }
  }

  // 5. Detect Domain Intent
  for (const d of KNOWN_DOMAINS) {
    if (d.match.test(lower)) {
      domain = d.name;
      matchedTokens.push(d.name);
      break;
    }
  }

  // 6. Clean query by stripping structural intent words
  let cleanQuery = query
    .replace(/\b(in|at|for|near)\s+([a-zA-Z]+)\b/gi, (match, prep, place) => {
      if (KNOWN_LOCATIONS.includes(place.toLowerCase())) return "";
      return match;
    })
    .replace(/\b(internship|intern|interns|training|bootcamp|jobs?|full-time|fulltime|remote|hybrid|onsite|fresher|entry-level)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If the query was purely an intent word (e.g. "internship"), keep cleanQuery non-destructive
  if (!cleanQuery) {
    cleanQuery = query;
  }

  return {
    rawQuery: query,
    cleanQuery,
    opportunityType,
    workMode,
    location,
    experience,
    domain,
    matchedTokens,
  };
}

export { isJobLiveForUsers };
