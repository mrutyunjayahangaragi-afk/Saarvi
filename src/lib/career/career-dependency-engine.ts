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
  CANONICAL_JOB_ROLES,
  CANONICAL_DOMAINS,
  CANONICAL_SKILLS,
} from "./career-taxonomy.ts";
import type { TaxonomyItem } from "./career-taxonomy.ts";

export interface DependentSuggestions {
  recommendedRoleIds: string[];
  recommendedDomainIds: string[];
  recommendedSkills: string[];
  exposedSecondaryFilters: string[]; // e.g., ['duration', 'stipend'] for internship
}

export class CareerFilterDependencyEngine {
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
      return ["deliveryMode", "duration", "feeType", "certificate", "skills"];
    }
    // General Job
    return ["salary", "employmentType", "skills", "startDate"];
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
}
