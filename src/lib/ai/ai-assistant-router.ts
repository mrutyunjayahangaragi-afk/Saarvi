/**
 * Saarvi AI Assistant 2.0 Router
 *
 * Guarantees:
 * 1. Deterministic canonical tool lookup FIRST before any LLM evaluation.
 * 2. Strict route validation against CANONICAL_TOOL_REGISTRY (blocks arbitrary URL navigation).
 * 3. Feature Flag & Pro entitlement aware.
 * 4. Zero document contents leakage (private data stays local-first).
 */

import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_CATEGORIES,
} from '../tools/tool-registry';
import type { CanonicalTool } from '../tools/tool-registry';
import {
  resolveToolQuery,
} from './tool-discovery-engine';
import type {
  ToolDiscoveryResult,
  DiscoveredToolItem,
} from './tool-discovery-engine';
import { featureServerStore } from '../features/feature-store';

export interface AssistantRouteResolution {
  success: boolean;
  query: string;
  result: ToolDiscoveryResult;
  verifiedRoute?: string;
  requiresPro: boolean;
  isDisabled: boolean;
  isExternalOrArbitraryBlocked: boolean;
}

/**
 * Validates whether a candidate route strictly matches a verified canonical tool
 * or an authorized category route in Saarvi. Prevents open redirect or arbitrary routing.
 */
export function isValidCanonicalRoute(route: string): boolean {
  if (!route || typeof route !== 'string') return false;

  // Clean trailing slashes for exact check
  const cleanRoute = route.split('?')[0].replace(/\/$/, '') || '/';

  // Check known canonical tool routes
  const toolRouteMatches = CANONICAL_TOOL_REGISTRY.some(
    (tool) => tool.route.replace(/\/$/, '') === cleanRoute
  );
  if (toolRouteMatches) return true;

  // Check known top-level category routes
  const validCategoryRoutes = [
    '/',
    '/tools',
    '/student',
    '/student/timetable',
    '/student/assignments',
    '/student/study-planner',
    '/student/exams',
    '/student/notes',
    '/student/academic',
    '/student/career',
    '/career/resume-builder',
    '/career/cover-letter',
    '/career/job-tracker',
    '/career/interview-prep',
    '/career/skill-gap',
    '/pricing',
    '/admin',
  ];

  return validCategoryRoutes.some((r) => r.replace(/\/$/, '') === cleanRoute);
}

/**
 * Core assistant routing engine:
 * Evaluates the query deterministically first against the canonical tool registry.
 */
export function resolveAssistantRoute(
  query: string,
  options?: {
    userIsPro?: boolean;
    featureMap?: Record<string, { status?: string; accessMode?: string }>;
  }
): AssistantRouteResolution {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return {
      success: false,
      query: '',
      result: {
        type: 'NO_MATCH',
        reply: 'Please provide a question or tool name.',
      },
      requiresPro: false,
      isDisabled: false,
      isExternalOrArbitraryBlocked: false,
    };
  }

  // 1. Deterministic tool discovery
  const discoveryResult = resolveToolQuery(trimmed, options?.featureMap);

  // 2. Identify top matched route
  let candidateRoute: string | undefined;
  let requiresPro = false;
  let isDisabled = false;

  if (discoveryResult.tools && discoveryResult.tools.length > 0) {
    const topTool = discoveryResult.tools[0];
    candidateRoute = topTool.route;
    requiresPro = topTool.requiresPro;
    isDisabled = topTool.isDisabled;
  } else if (discoveryResult.categoryRoute) {
    candidateRoute = discoveryResult.categoryRoute;
  }

  // 3. Route verification & anti-arbitrary url validation
  let verifiedRoute: string | undefined;
  let isExternalOrArbitraryBlocked = false;

  if (candidateRoute) {
    if (isValidCanonicalRoute(candidateRoute)) {
      verifiedRoute = candidateRoute;
    } else {
      isExternalOrArbitraryBlocked = true;
    }
  }

  return {
    success: discoveryResult.type !== 'NO_MATCH',
    query: trimmed,
    result: discoveryResult,
    verifiedRoute,
    requiresPro,
    isDisabled,
    isExternalOrArbitraryBlocked,
  };
}
