/**
 * Saarvi Career Intelligence — Search Source Planner
 * Study. Work. Grow.
 *
 * Implements CareerSourcePlanner (Requirements 25, 51):
 * Dynamically plans which connectors to execute based on CareerSearchIntent.
 * Prevents blind queries to all sources when intent targets a specific opportunity type.
 */

import type { CareerSearchIntent } from "./career-search-intent.ts";
import type { CareerSourceConnector } from "./career-source-connector.ts";
import {
  SaarviDbSourceConnector,
  GoogleJobsSourceConnector,
  AtsPublicFeedConnector,
  TrainingSourceConnector,
  LinkedInSourceConnector,
  NaukriApnaSourceConnector,
} from "./career-source-connector.ts";

export interface SourceExecutionPlan {
  primaryConnectors: CareerSourceConnector[];
  secondaryConnectors: CareerSourceConnector[];
  outboundOnlyConnectors: CareerSourceConnector[];
  estimatedTargetTypes: string[];
}

export class CareerSourcePlanner {
  private static registeredConnectors: CareerSourceConnector[] = [
    new SaarviDbSourceConnector(),
    new GoogleJobsSourceConnector(),
    new AtsPublicFeedConnector(),
    new TrainingSourceConnector(),
    new LinkedInSourceConnector(),
    new NaukriApnaSourceConnector(),
  ];

  /**
   * Returns all connectors registered in the platform.
   */
  public static getAllConnectors(): CareerSourceConnector[] {
    return this.registeredConnectors;
  }

  /**
   * Plans source execution based on user intent.
   *
   * Rules:
   * 1. Saarvi DB is ALWAYS queried as the fast, authoritative Tier A anchor.
   * 2. If opportunityTypes is exclusively ["TRAINING"]:
   *    - Queries DB + Training Programs.
   *    - Does NOT query Google Jobs or ATS job feeds.
   * 3. If opportunityTypes is exclusively ["JOB"] or ["INTERNSHIP"]:
   *    - Queries DB + Google Jobs + Company ATS feeds.
   *    - Does NOT query Training Programs.
   * 4. If opportunityTypes includes ["JOB", "INTERNSHIP", "TRAINING"] (or "Any"):
   *    - Queries all active opportunity sources in parallel.
   */
  public static planSources(intent: CareerSearchIntent): SourceExecutionPlan {
    const types = intent.opportunityTypes;
    const isTrainingOnly = types.length === 1 && types[0] === "TRAINING";
    const isJobOrInternOnly =
      types.every((t) => t === "JOB" || t === "INTERNSHIP") && types.length > 0;

    const primary: CareerSourceConnector[] = [];
    const secondary: CareerSourceConnector[] = [];
    const outbound: CareerSourceConnector[] = [];

    for (const connector of this.registeredConnectors) {
      // Outbound or not enabled
      if (!connector.isEnabled) {
        outbound.push(connector);
        continue;
      }

      // 1. DB is always primary
      if (connector.sourceKey === "saarvi-db") {
        primary.push(connector);
        continue;
      }

      // 2. Training scope
      if (connector.sourceKey === "training-programs") {
        if (!isJobOrInternOnly) {
          if (isTrainingOnly) primary.push(connector);
          else secondary.push(connector);
        }
        continue;
      }

      // 3. Employment / Job / Internship scope
      if (connector.sourceKey === "google-jobs" || connector.sourceKey === "ats-company-feeds") {
        if (!isTrainingOnly) {
          primary.push(connector);
        }
        continue;
      }

      secondary.push(connector);
    }

    return {
      primaryConnectors: primary,
      secondaryConnectors: secondary,
      outboundOnlyConnectors: outbound,
      estimatedTargetTypes: types,
    };
  }
}
