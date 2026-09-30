/**
 * Saarvi Career Intelligence — Search Orchestrator
 * Study. Work. Grow.
 *
 * Implements:
 * 1. executeCareerSearch(intent, options) (Requirements 18, 44, 45, 49, 50)
 *    - Flow: Intent -> Source Planning -> Parallel Connector Search (with timeouts)
 *      -> Partial Failure Handling -> Normalization -> Deduplication -> Relevance Ranking
 *      -> Persistence -> SmartReveal-ready Response
 * 2. Partial Failure Tolerance (Requirement 44):
 *    - One slow or failing source never breaks the search.
 *    - Healthy results return immediately with a transparent user notice:
 *      "Some career sources are temporarily unavailable. Showing available opportunities."
 * 3. In-flight caching with deterministic query fingerprints.
 */

import {
  type CareerSearchIntent,
  type RawSearchInput,
  buildCareerSearchIntent,
  computeQueryFingerprint,
} from "./career-search-intent.ts";
import {
  type CanonicalJobRecord,
} from "./career-source-connector.ts";
import { CareerSourcePlanner } from "./career-source-planner.ts";
import { CanonicalJobDeduplicationEngine } from "./career-dedupe-engine.ts";
import { CareerRelevanceEngine } from "./career-relevance-engine.ts";
import { jobRepository } from "../jobs/repository.ts";

export interface CareerSearchExecutionResult {
  items: CanonicalJobRecord[];
  total: number;
  intent: CareerSearchIntent;
  sourcesSearched: string[];
  failedSources: string[];
  partialFailureMessage?: string;
  relaxationExplanation?: string;
  isRelaxed: boolean;
  cached: boolean;
  cacheTimestamp: string;
  duplicatesMergedCount: number;
  executionTimeMs: number;
}

interface CacheItem {
  result: CareerSearchExecutionResult;
  timestamp: number;
}

export class CareerSearchOrchestrator {
  private static cache = new Map<string, CacheItem>();
  private static CACHE_TTL_MS = 60 * 1000; // 60s cache

  public static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Helper that executes a connector with an explicit timeout.
   */
  private static async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  }

  /**
   * Main Search Execution Function.
   */
  public static async search(
    input: RawSearchInput,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      skipCache?: boolean;
    } = {}
  ): Promise<CareerSearchExecutionResult> {
    const startTime = Date.now();

    // 1. Build canonical intent
    const intent = buildCareerSearchIntent(input);

    // 2. Cache evaluation
    const fingerprint = computeQueryFingerprint(intent);
    if (!options.skipCache) {
      const cached = this.cache.get(fingerprint);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return {
          ...cached.result,
          cached: true,
          executionTimeMs: Date.now() - startTime,
        };
      }
    }

    // 3. Plan sources
    const plan = CareerSourcePlanner.planSources(intent);
    const connectorsToRun = [...plan.primaryConnectors, ...plan.secondaryConnectors];

    // 4. Parallel execution with timeout and partial failure tolerance
    const sourcesSearched: string[] = [];
    const failedSources: string[] = [];
    const collectedJobs: CanonicalJobRecord[] = [];

    const connectorPromises = connectorsToRun.map(async (connector) => {
      sourcesSearched.push(connector.sourceKey);
      try {
        const result = await this.executeWithTimeout(
          connector.search(intent, { limit: options.limit || 30 }),
          connector.timeoutMs,
          {
            sourceKey: connector.sourceKey,
            items: [],
            totalDiscovered: 0,
            latencyMs: connector.timeoutMs,
            error: "Source timeout",
          }
        );

        if (result.error && result.items.length === 0) {
          failedSources.push(connector.sourceKey);
        } else {
          collectedJobs.push(...result.items);
        }
      } catch (err: any) {
        failedSources.push(connector.sourceKey);
      }
    });

    await Promise.allSettled(connectorPromises);

    // 5. Deduplicate and merge across sources
    const { uniqueJobs, duplicatesMergedCount } =
      CanonicalJobDeduplicationEngine.deduplicateAndMerge(collectedJobs);

    // 6. Asynchronous persistence of newly discovered source listings
    try {
      const newExternal = uniqueJobs.filter(
        (j) => j.sourceKey !== "saarvi-db" && j.verificationTier !== "SAARVI_VERIFIED"
      );
      if (newExternal.length > 0) {
        jobRepository.bulkUpsertOpportunities(newExternal as any, {
          query: intent.role?.label || intent.freeTextQuery || "Opportunity",
          location: intent.location?.label || "India",
          provider: "career_intelligence_orchestrator",
          tier: "SOURCE_DISCOVERY",
        }).catch(() => {});
      }
    } catch {}

    // 7. Relevance ranking & soft constraint relaxation
    const { rankedJobs, isRelaxed, relaxationExplanation } =
      CareerRelevanceEngine.rankAndFilter(uniqueJobs, intent, { sortBy: options.sortBy });

    // 8. Pagination
    const page = options.page || 1;
    const limit = options.limit || 20;
    const paginated = rankedJobs.slice((page - 1) * limit, page * limit);

    // 9. Partial failure notice
    let partialFailureMessage: string | undefined;
    if (failedSources.length > 0 && paginated.length > 0) {
      partialFailureMessage =
        "Some career sources are temporarily unavailable. Showing available opportunities.";
    }

    const executionResult: CareerSearchExecutionResult = {
      items: paginated,
      total: rankedJobs.length,
      intent,
      sourcesSearched,
      failedSources,
      partialFailureMessage,
      relaxationExplanation,
      isRelaxed,
      cached: false,
      cacheTimestamp: new Date().toISOString(),
      duplicatesMergedCount,
      executionTimeMs: Date.now() - startTime,
    };

    // 10. Store in cache
    this.cache.set(fingerprint, {
      result: executionResult,
      timestamp: Date.now(),
    });

    return executionResult;
  }
}
