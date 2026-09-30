/**
 * Saarvi Career Filter Dependency Engine (CareerFilterDependencyEngine)
 * Study. Work. Grow.
 *
 * Provides intelligent, context-aware suggestions and refinements based on
 * the user's selected Branch, Job Role, and Opportunity Type.
 *
 * Key Invariant:
 * Guiding principle: NEVER secretly restrict results.
 * Dependencies only HIGHLIGHT or REORDER relevant options for guidance.
 */

import {
  CAREER_FILTER_CONFIGS,
  type CareerFilterConfig,
  type OpportunityScope,
} from "./career-filter-config.ts";
import { CANONICAL_JOB_ROLES } from "./career-taxonomy.ts";

export interface CareerSearchIntentInput {
  opportunityType?: string;
  role?: string;
  branch?: string;
  domain?: string;
  location?: string;
  experience?: string;
  workMode?: string;
  skills?: string[];
  query?: string;
}

export interface CareerSearchIntentResult {
  opportunityTypes: string[];
  role?: string;
  branch?: string;
  domain?: string;
  location?: string;
  locationAliases?: string[];
  experience?: string;
  workMode?: string;
  skills: string[];
  query?: string;
  sourceQuery: string;
  searchVariants: string[];
  isValid: boolean;
}

export interface DependentSuggestions {
  recommendedRoleIds: string[];
  recommendedDomainIds: string[];
  recommendedSkills: string[];
  exposedSecondaryFilters: string[]; // e.g., ['duration', 'stipend'] for internship
}

export interface ContextualSearchPresentation {
  headline: string;
  subtitle: string;
  searchPlaceholder: string;
  typePlaceholder: string;
}

export class CareerFilterDependencyEngine {
  private static filterOverrides = new Map<string, Partial<CareerFilterConfig>>();

  /**
   * Set dynamic admin configuration overrides for any filter.
   */
  public static setFilterOverride(key: string, override: Partial<CareerFilterConfig>): void {
    this.filterOverrides.set(key, override);
  }

  /**
   * Retrieve active admin override for a specific filter.
   */
  public static getFilterOverride(key: string): Partial<CareerFilterConfig> | undefined {
    return this.filterOverrides.get(key);
  }

  /**
   * Reset all dynamic filter overrides back to static canonical defaults.
   */
  public static resetFilterOverrides(): void {
    this.filterOverrides.clear();
  }

  /**
   * Returns all canonical filter configs with active overrides applied.
   */
  public static getAllFilters(): CareerFilterConfig[] {
    return CAREER_FILTER_CONFIGS.map((cfg) => {
      const override = this.filterOverrides.get(cfg.key);
      return override ? { ...cfg, ...override } : { ...cfg };
    });
  }

  /**
   * Returns single filter configuration with active override applied.
   */
  public static getFilterConfig(key: string): CareerFilterConfig | undefined {
    const base = CAREER_FILTER_CONFIGS.find((f) => f.key === key);
    if (!base) return undefined;
    const override = this.filterOverrides.get(key);
    return override ? { ...base, ...override } : { ...base };
  }

  /**
   * Resolves active filters for the given opportunity type.
   * - Shared filters apply across opportunities.
   * - Contextual filters are revealed ONLY when relevant.
   * - 'any' mode shows ONLY shared filters.
   */
  public static getFiltersForOpportunity(type: OpportunityScope = "any"): CareerFilterConfig[] & {
    primary: CareerFilterConfig[];
    more: CareerFilterConfig[];
    shared: CareerFilterConfig[];
    contextual: CareerFilterConfig[];
  } {
    const all = this.getAllFilters();
    const eligible = all.filter((f) => {
      if (!f.enabled || !f.userVisible) return false;

      if (type === "any") {
        return f.category === "shared" && f.opportunityTypes.includes("any");
      }

      return f.opportunityTypes.includes(type);
    }).sort((a, b) => a.sortOrder - b.sortOrder);

    const primary = eligible.filter((f) => f.priority <= 2);
    const more = eligible.filter((f) => f.priority > 2);
    const shared = eligible.filter((f) => f.category === "shared");
    const contextual = eligible.filter((f) => f.category === "contextual");

    const result = Object.assign([...eligible], {
      primary,
      more,
      shared,
      contextual,
    });

    return result as CareerFilterConfig[] & {
      primary: CareerFilterConfig[];
      more: CareerFilterConfig[];
      shared: CareerFilterConfig[];
      contextual: CareerFilterConfig[];
    };
  }

  /**
   * Context-adaptive presentation copy (Headlines, Subtitles, Placeholders).
   */
  public static getContextualHeadings(opportunityType: string): ContextualSearchPresentation {
    const opp = (opportunityType || "").toLowerCase().trim();

    if (!opp || opp === "none") {
      return {
        headline: "What are you looking for?",
        subtitle: "Choose an opportunity type to get started. Saarvi will adapt the filters to match your goal.",
        searchPlaceholder: "Search jobs, internships, and training (or select requirements below)...",
        typePlaceholder: "Choose an opportunity type",
      };
    }

    if (opp === "job") {
      return {
        headline: "Find a job that fits",
        subtitle: "You can now refine your job search",
        searchPlaceholder: "Search by role, skill, company, or keyword...",
        typePlaceholder: "Job",
      };
    }

    if (opp === "internship") {
      return {
        headline: "Find an internship that fits",
        subtitle: "You can now refine your internship search",
        searchPlaceholder: "Search by role, skill, company, or keyword...",
        typePlaceholder: "Internship",
      };
    }

    if (opp === "training") {
      return {
        headline: "Find training programs that fit",
        subtitle: "You can now refine your training search",
        searchPlaceholder: "Search by role, skill, company, or keyword...",
        typePlaceholder: "Training",
      };
    }

    // "any"
    return {
      headline: "Find opportunities that fit",
      subtitle: "You can now refine your search across all opportunities",
      searchPlaceholder: "Search by role, skill, company, or keyword...",
      typePlaceholder: "Any opportunity",
    };
  }

  /**
   * Adaptive label for Role selector based on opportunity context.
   */
  public static getRoleLabel(opportunityType: string): string {
    const opp = (opportunityType || "").toLowerCase();
    if (opp === "internship") return "Internship Role";
    if (opp === "job") return "Job Role";
    if (opp === "any") return "Job Role / Area of Interest";
    return "Role / Title";
  }

  /**
   * Adaptive label for Domain selector based on opportunity context.
   */
  public static getDomainLabel(opportunityType: string): string {
    const opp = (opportunityType || "").toLowerCase();
    if (opp === "training") return "Training Domain";
    return "Domain / Industry";
  }

  /**
   * Adaptive Search Button Label & State.
   * Invariant: ONLY display counts from real indexed data. Never fabricate counts.
   */
  public static getSearchButtonLabel(params: {
    opportunityType?: string;
    role?: string;
    branch?: string;
    domain?: string;
    location?: string;
    q?: string;
    skills?: string[];
    liveCount?: number | null;
  }): { label: string; enabled: boolean } {
    const opp = (params.opportunityType || "").toLowerCase();
    const hasOpp = Boolean(opp && opp !== "none");
    const hasRole = Boolean(params.role && params.role !== "all");
    const hasBranch = Boolean(params.branch && params.branch !== "all");
    const hasDomain = Boolean(params.domain && params.domain !== "all");
    const hasLocation = Boolean(params.location && params.location !== "all" && params.location !== "any-location");
    const hasQuery = Boolean(params.q && params.q.trim().length > 0);
    const hasSkills = Boolean(params.skills && params.skills.length > 0);

    const hasMeaningfulRequirement = hasOpp || hasRole || hasBranch || hasDomain || hasLocation || hasQuery || hasSkills;

    if (!hasMeaningfulRequirement) {
      return {
        label: "Choose requirements",
        enabled: false,
      };
    }

    if (typeof params.liveCount === "number" && params.liveCount > 0) {
      return {
        label: `Search ${params.liveCount} opportunities`,
        enabled: true,
      };
    }

    return {
      label: "Search Opportunities",
      enabled: true,
    };
  }

  /**
   * Recommends domains based on selected branch.
   */
  public static getRecommendedDomainsForBranch(branchId: string): string[] {
    const id = branchId.toLowerCase();
    if (id.includes("cse") || id.includes("ise") || id.includes("computer")) {
      return ["software-saas", "ai-ml", "cloud-devops", "web-mobile", "cybersecurity", "data-science"];
    }
    if (id.includes("aiml") || id.includes("data") || id.includes("aids")) {
      return ["ai-ml", "data-science", "software-saas", "cloud-devops"];
    }
    if (id.includes("ece") || id.includes("electronics")) {
      return ["software-saas", "automotive-ev", "manufacturing-robotics", "cleantech"];
    }
    if (id.includes("mech") || id.includes("mechanical")) {
      return ["automotive-ev", "manufacturing-robotics", "cleantech", "infrastructure"];
    }
    if (id.includes("civil")) {
      return ["infrastructure", "manufacturing-robotics"];
    }
    if (id.includes("commerce") || id.includes("management") || id.includes("bba") || id.includes("mba")) {
      return ["fintech", "edtech", "software-saas", "design-media"];
    }
    return ["software-saas", "ai-ml", "web-mobile"];
  }

  /**
   * Recommends roles based on selected branch and domain.
   */
  public static getRecommendedRoles(branchId?: string, domainId?: string): string[] {
    const roles: string[] = [];

    if (domainId) {
      const d = domainId.toLowerCase();
      if (d.includes("ai") || d.includes("data")) {
        roles.push("ai-engineer", "ml-engineer", "data-scientist", "data-analyst");
      } else if (d.includes("web") || d.includes("software")) {
        roles.push("software-developer", "frontend-developer", "backend-developer", "full-stack-developer");
      } else if (d.includes("cloud") || d.includes("cyber")) {
        roles.push("cloud-engineer", "devops-engineer", "cybersecurity-analyst");
      } else if (d.includes("automotive") || d.includes("manufacturing")) {
        roles.push("mechanical-design-engineer", "embedded-systems-engineer");
      } else if (d.includes("fintech") || d.includes("business")) {
        roles.push("business-analyst", "financial-analyst", "product-manager");
      }
    }

    if (branchId && roles.length === 0) {
      const b = branchId.toLowerCase();
      if (b.includes("cse") || b.includes("ise")) {
        roles.push("software-developer", "frontend-developer", "backend-developer", "full-stack-developer");
      } else if (b.includes("aiml") || b.includes("data")) {
        roles.push("ai-engineer", "ml-engineer", "data-scientist");
      } else if (b.includes("ece")) {
        roles.push("embedded-systems-engineer", "vlsi-design-engineer", "software-developer");
      } else if (b.includes("mech")) {
        roles.push("mechanical-design-engineer");
      } else if (b.includes("civil")) {
        roles.push("civil-structural-engineer");
      }
    }

    return roles;
  }

  /**
   * Recommends skills based on selected role and domain.
   */
  public static getRecommendedSkills(roleId?: string, domainId?: string): string[] {
    const skills = new Set<string>();

    if (roleId) {
      const r = roleId.toLowerCase();
      if (r.includes("frontend")) {
        skills.add("React");
        skills.add("JavaScript");
        skills.add("TypeScript");
        skills.add("Next.js");
        skills.add("Tailwind CSS");
      } else if (r.includes("backend")) {
        skills.add("Node.js");
        skills.add("Java");
        skills.add("Python");
        skills.add("SQL");
        skills.add("PostgreSQL");
      } else if (r.includes("full-stack")) {
        skills.add("React");
        skills.add("Node.js");
        skills.add("TypeScript");
        skills.add("PostgreSQL");
      } else if (r.includes("ai") || r.includes("ml") || r.includes("data")) {
        skills.add("Python");
        skills.add("Machine Learning");
        skills.add("SQL");
        skills.add("Data Structures (DSA)");
      } else if (r.includes("devops") || r.includes("cloud")) {
        skills.add("AWS");
        skills.add("Docker");
        skills.add("Kubernetes");
        skills.add("Linux");
      }
    }

    if (domainId && skills.size === 0) {
      const d = domainId.toLowerCase();
      if (d.includes("ai")) {
        skills.add("Python");
        skills.add("Machine Learning");
      } else if (d.includes("cloud")) {
        skills.add("AWS");
        skills.add("Docker");
      }
    }

    // Default high-value tech skills if none specifically matched
    if (skills.size === 0) {
      return ["React", "Python", "Java", "SQL", "JavaScript", "AWS"];
    }

    return Array.from(skills);
  }

  /**
   * Identifies which secondary filters are contextually relevant to reveal.
   */
  public static getRelevantRefinements(opportunityType: string): string[] {
    const opp = (opportunityType || "").toLowerCase();
    if (opp === "internship") {
      return ["duration", "stipend", "startDate", "eligibility", "skills"];
    }
    if (opp === "training") {
      return ["deliveryMode", "duration", "feeType", "certificate", "skills", "provider"];
    }
    // General Job
    return ["salary", "employmentType", "skills", "company"];
  }

  /**
   * Evaluates all dependencies for current selection state.
   */
  public static evaluateDependencies(params: {
    branch?: string;
    role?: string;
    domain?: string;
    opportunityType?: string;
  }): DependentSuggestions {
    const branchId = params.branch || "";
    const roleId = params.role || "";
    const domainId = params.domain || "";
    const oppType = params.opportunityType || "any";

    const recommendedDomainIds = this.getRecommendedDomainsForBranch(branchId);
    const recommendedRoleIds = this.getRecommendedRoles(branchId, domainId);
    const recommendedSkills = this.getRecommendedSkills(roleId, domainId);
    const exposedSecondaryFilters = this.getRelevantRefinements(oppType);

    return {
      recommendedDomainIds,
      recommendedRoleIds,
      recommendedSkills,
      exposedSecondaryFilters,
    };
  }

  /**
   * Constructs a structured, intelligent CareerSearchIntent from selections.
   * Key UX Rule: The user does NOT need to enter a text query.
   * Structured requirements alone form a valid, rich search intent.
   * Crucial rule: Never make opportunity type ("Internship") a literal keyword query.
   */
  public static buildSearchIntent(input: CareerSearchIntentInput): CareerSearchIntentResult {
    const oppRaw = (input.opportunityType || "").toLowerCase().trim();
    const opportunityTypes: string[] = [];
    if (oppRaw === "job") opportunityTypes.push("JOB");
    else if (oppRaw === "internship") opportunityTypes.push("INTERNSHIP");
    else if (oppRaw === "training") opportunityTypes.push("TRAINING");
    else if (oppRaw === "any") opportunityTypes.push("JOB", "INTERNSHIP", "TRAINING");

    const role = (input.role || "").trim();
    const branch = (input.branch || "").trim();
    const domain = (input.domain || "").trim();
    const rawLoc = (input.location || "").trim();
    const isAnyLoc = !rawLoc || rawLoc.toLowerCase() === "all" || rawLoc.toLowerCase() === "any" || rawLoc.toLowerCase() === "any-location";
    const location = isAnyLoc ? undefined : rawLoc;

    const locationAliases: string[] = [];
    if (location) {
      locationAliases.push(location);
      if (location.toLowerCase() === "bengaluru" || location.toLowerCase() === "bangalore") {
        locationAliases.push("Bengaluru", "Bangalore");
      }
    }

    const expRaw = (input.experience || "").trim();
    const isAnyExp = !expRaw || expRaw.toLowerCase() === "all" || expRaw.toLowerCase() === "any";
    const experience = isAnyExp ? undefined : expRaw;

    const wmRaw = (input.workMode || "").trim();
    const isAnyWm = !wmRaw || wmRaw.toLowerCase() === "all" || wmRaw.toLowerCase() === "any";
    const workMode = isAnyWm ? undefined : wmRaw;

    const skills = input.skills || [];
    const query = (input.query || "").trim();

    // Intelligent role & variants resolution
    let roleName = role;
    const canonicalRoleObj = CANONICAL_JOB_ROLES.find(
      (r) => r.id === role || r.name.toLowerCase() === role.toLowerCase()
    );
    if (canonicalRoleObj) {
      roleName = canonicalRoleObj.name;
    } else if (role) {
      roleName = role.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }

    const searchVariants: string[] = [];
    let sourceQuery = "";

    if (oppRaw === "internship") {
      if (roleName) {
        sourceQuery = `${roleName} Internship`;
        searchVariants.push(
          `${roleName} Intern`,
          `${roleName} Internship`,
          `${roleName.replace("Developer", "Engineer")} Intern`,
          `${roleName.replace("Developer", "Engineering")} Intern`
        );
        if (canonicalRoleObj?.aliases) {
          for (const alias of canonicalRoleObj.aliases) {
            searchVariants.push(alias.replace(/Developer|Engineer/, "Intern"));
          }
        }
      } else if (query) {
        sourceQuery = `${query} Internship`;
        searchVariants.push(`${query} Intern`, `${query} Internship`);
      }
    } else if (oppRaw === "job") {
      if (roleName) {
        sourceQuery = roleName;
        searchVariants.push(
          roleName,
          roleName.replace("Developer", "Engineer"),
          roleName.replace("Engineer", "Developer")
        );
        if (canonicalRoleObj?.aliases) {
          searchVariants.push(...canonicalRoleObj.aliases);
        }
      } else if (query) {
        sourceQuery = query;
      }
    } else {
      if (roleName) {
        sourceQuery = roleName;
        searchVariants.push(roleName);
      } else if (query) {
        sourceQuery = query;
      }
    }

    const hasStructured = Boolean(
      (oppRaw && oppRaw !== "none") ||
      role ||
      branch ||
      domain ||
      location ||
      experience ||
      workMode ||
      skills.length > 0
    );

    const isValid = Boolean(query || hasStructured);

    return {
      opportunityTypes,
      role: role || undefined,
      branch: branch || undefined,
      domain: domain || undefined,
      location,
      locationAliases: locationAliases.length > 0 ? Array.from(new Set(locationAliases)) : undefined,
      experience,
      workMode,
      skills,
      query: query || undefined,
      sourceQuery,
      searchVariants: Array.from(new Set(searchVariants)),
      isValid,
    };
  }
}
