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

export type FilterCategory = "shared" | "contextual";

export interface FilterOption {
  label: string;
  value: string;
}

export interface CareerFilterConfig {
  key: string;
  label: string;
  category: FilterCategory;
  categories: string[];
  opportunityTypes: OpportunityScope[];
  enabled: boolean;
  required: boolean;
  priority: number; // 1 = Primary refinement (always shown if relevant), 2 = Secondary, 3 = Progressive disclosure ("More filters")
  searchable?: boolean;
  multiSelect?: boolean;
  userVisible: boolean;
  adminOnly?: boolean;
  sortOrder: number;
  dependencies?: string[];
  options?: FilterOption[];
  placeholder?: string;
  description?: string;
}

/**
 * CANONICAL CAREER FILTER CONFIGURATIONS
 * Admin-controlled registry of filters for all career opportunity types.
 * Categorized into SHARED and CONTEXTUAL filters.
 */
export const CAREER_FILTER_CONFIGS: CareerFilterConfig[] = [
  // 1. Role (Shared: Job Role / Internship Role / Area of Interest)
  {
    key: "role",
    label: "Role",
    category: "shared",
    opportunityTypes: ["any", "job", "internship"],
    categories: ["all", "tech", "business", "design"],
    enabled: true,
    required: false,
    priority: 1,
    searchable: true,
    userVisible: true,
    sortOrder: 1,
    placeholder: "All Roles",
    dependencies: ["branch", "domain"],
  },

  // 2. Branch / Discipline (Shared)
  {
    key: "branch",
    label: "Branch / Discipline",
    category: "shared",
    opportunityTypes: ["any", "job", "internship"],
    categories: ["all", "engineering", "academic"],
    enabled: true,
    required: false,
    priority: 1,
    searchable: true,
    userVisible: true,
    sortOrder: 2,
    placeholder: "All Branches",
  },

  // 3. Domain / Industry (Shared across all opportunity types including Training)
  {
    key: "domain",
    label: "Domain / Industry",
    category: "shared",
    opportunityTypes: ["any", "job", "internship", "training"],
    categories: ["all", "tech", "business", "core"],
    enabled: true,
    required: false,
    priority: 1,
    searchable: true,
    userVisible: true,
    sortOrder: 3,
    placeholder: "All Domains",
    dependencies: ["branch"],
  },

  // 4. Area / Location (Shared)
  {
    key: "location",
    label: "Area / Location",
    category: "shared",
    opportunityTypes: ["any", "job", "internship", "training"],
    categories: ["all", "metro", "tier2"],
    enabled: true,
    required: false,
    priority: 1,
    searchable: true,
    userVisible: true,
    sortOrder: 4,
    placeholder: "Any location",
  },

  // 5. Work Mode (Shared: Remote, Hybrid, On-site)
  {
    key: "remote",
    label: "Work Mode",
    category: "shared",
    opportunityTypes: ["any", "job", "internship"],
    categories: ["all", "tech", "business", "design"],
    enabled: true,
    required: false,
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

  // 6. Experience Level (Shared: Primary for Jobs, Secondary for Any)
  {
    key: "experience",
    label: "Experience",
    category: "shared",
    opportunityTypes: ["job", "any"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 7. Internship Duration (Contextual: Primary for Internships & Training)
  {
    key: "duration",
    label: "Duration",
    category: "contextual",
    opportunityTypes: ["internship", "training"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 8. Stipend / Compensation (Contextual: Internship)
  {
    key: "stipend",
    label: "Stipend",
    category: "contextual",
    opportunityTypes: ["internship"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 9. Salary Range (Contextual: Job under progressive disclosure)
  {
    key: "salary",
    label: "Salary Band",
    category: "contextual",
    opportunityTypes: ["job"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 10. Employment Type (Contextual: Job)
  {
    key: "employmentType",
    label: "Employment Type",
    category: "contextual",
    opportunityTypes: ["job"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 11. Company (Contextual: Job)
  {
    key: "company",
    label: "Company",
    category: "contextual",
    opportunityTypes: ["job"],
    categories: ["all"],
    enabled: true,
    required: false,
    priority: 3, // More filters
    searchable: true,
    userVisible: true,
    sortOrder: 42,
    placeholder: "Company name",
  },

  // 12. Training Delivery Mode (Contextual: Training)
  {
    key: "deliveryMode",
    label: "Delivery Mode",
    category: "contextual",
    opportunityTypes: ["training"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 13. Training Certification & Fee (Contextual: Training)
  {
    key: "feeType",
    label: "Fee & Certificate",
    category: "contextual",
    opportunityTypes: ["training"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 13b. Certificate (Contextual: Training)
  {
    key: "certificate",
    label: "Certificate Offered",
    category: "contextual",
    opportunityTypes: ["training"],
    categories: ["all"],
    enabled: true,
    required: false,
    priority: 3,
    multiSelect: false,
    userVisible: true,
    sortOrder: 45.5,
    options: [
      { label: "Any", value: "all" },
      { label: "Yes (Certificate included)", value: "yes" },
      { label: "Industry Recognized Certificate", value: "industry_recognized" },
    ],
  },

  // 14. Provider / Institution (Contextual: Training)
  {
    key: "provider",
    label: "Training Provider",
    category: "contextual",
    opportunityTypes: ["training"],
    categories: ["all"],
    enabled: true,
    required: false,
    priority: 3,
    userVisible: true,
    sortOrder: 46,
    placeholder: "Institution / Provider",
  },

  // 15. Key Skills (Shared across all opportunity types under progressive disclosure)
  {
    key: "skills",
    label: "Key Skills",
    category: "shared",
    opportunityTypes: ["any", "job", "internship", "training"],
    categories: ["all"],
    enabled: true,
    required: false,
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

  // 16. Eligibility (Contextual: Internship & Training)
  {
    key: "eligibility",
    label: "Eligibility",
    category: "contextual",
    opportunityTypes: ["internship", "training"],
    categories: ["all"],
    enabled: true,
    required: false,
    priority: 3, // More filters
    multiSelect: false,
    userVisible: true,
    sortOrder: 55,
    options: [
      { label: "All Students & Graduates", value: "all" },
      { label: "Current Students Only", value: "students" },
      { label: "2025 / 2026 Batch", value: "batch_2025_2026" },
      { label: "Graduates", value: "graduates" },
    ],
  },

  // 17. Start Date / Timeline (Contextual: Internship & Training)
  {
    key: "startDate",
    label: "Start Date",
    category: "contextual",
    opportunityTypes: ["internship", "training"],
    categories: ["all"],
    enabled: true,
    required: false,
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
 * Dynamic Filter Resolution by Opportunity Scope.
 * - When type is 'any': returns ONLY SHARED filters; contextual filters remain hidden.
 * - When type is 'job': returns job-relevant shared filters + job contextual filters.
 * - When type is 'internship': returns internship-relevant shared filters + internship contextual filters.
 * - When type is 'training': returns training-relevant shared filters + training contextual filters.
 */
export function getFiltersForOpportunity(
  type: OpportunityScope = "any"
): {
  primary: CareerFilterConfig[];
  more: CareerFilterConfig[];
  shared: CareerFilterConfig[];
  contextual: CareerFilterConfig[];
} {
  const eligible = CAREER_FILTER_CONFIGS.filter((f) => {
    if (!f.enabled || !f.userVisible) return false;

    if (type === "any") {
      // In "any" mode: show ONLY shared filters that apply to "any"
      return f.category === "shared" && f.opportunityTypes.includes("any");
    }

    // Specific opportunity type: include if filter explicitly supports it
    return f.opportunityTypes.includes(type);
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  const primary = eligible.filter((f) => f.priority <= 2);
  const more = eligible.filter((f) => f.priority > 2);
  const shared = eligible.filter((f) => f.category === "shared");
  const contextual = eligible.filter((f) => f.category === "contextual");

  return { primary, more, shared, contextual };
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
