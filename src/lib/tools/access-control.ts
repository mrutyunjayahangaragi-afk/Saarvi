/**
 * Saarvi Server-Authoritative Tool & Feature Access Control
 *
 * Single centralized source of truth for tool access modes and runtime permission checks.
 * Never trusts client claims (isPro, plan, role).
 */

import { CANONICAL_TOOL_REGISTRY, CanonicalTool } from './tool-registry';
import type { AuthSessionUser } from '@/types/auth';
import type { SubscriptionRecord } from '@/types/plan';

export type ToolAccessMode =
  | 'PUBLIC_FREE'
  | 'AUTH_REQUIRED'
  | 'PRO'
  | 'ADMIN_ONLY'
  | 'DISABLED';

export interface ToolAccessDecision {
  allowed: boolean;
  reason?: 'AUTH_REQUIRED' | 'PRO_REQUIRED' | 'TOOL_DISABLED' | 'ADMIN_ONLY' | 'NOT_FOUND';
  accessMode: ToolAccessMode;
  toolName?: string;
}

/**
 * Authoritative default access mapping for tools.
 * Invariants:
 * - PDF and Image conversion tools: PUBLIC_FREE (client-side WebAssembly)
 * - Academic calculators: PUBLIC_FREE
 * - Student productivity tools: PUBLIC_FREE (local-first IndexedDB)
 * - Career Suite (Resume Builder, ATS Analyzer, Cover Letter): AUTH_REQUIRED
 * - Advanced AI tools (Copilot): PRO
 */
export const DEFAULT_TOOL_ACCESS_MODES: Record<string, ToolAccessMode> = {
  // Career Tools
  'resume-builder': 'AUTH_REQUIRED',
  'ats-analyzer': 'AUTH_REQUIRED',
  'cover-letter': 'AUTH_REQUIRED',
  'job-tracker': 'AUTH_REQUIRED',
  'interview-prep': 'AUTH_REQUIRED',
  'skill-gap-analyzer': 'AUTH_REQUIRED',

  // Advanced AI Tools
  'ai-copilot': 'PRO',
  'student-copilot': 'PRO',
  'copilot-interview': 'PRO',

  // AI OCR / Utilities
  'ocr-image': 'PUBLIC_FREE',
  'ocr-pdf': 'PUBLIC_FREE',
  'document-summary': 'PUBLIC_FREE',
  'document-qa': 'PUBLIC_FREE',
};

/**
 * Resolves the default access mode for any tool key.
 */
export function getDefaultToolAccessMode(toolKeyOrSlug: string): ToolAccessMode {
  const normalized = toolKeyOrSlug.toLowerCase().trim();
  if (DEFAULT_TOOL_ACCESS_MODES[normalized]) {
    return DEFAULT_TOOL_ACCESS_MODES[normalized];
  }

  // Look up in canonical registry
  const match = CANONICAL_TOOL_REGISTRY.find(
    (t) => t.key === normalized || t.featureFlagKey === normalized || t.route.endsWith(normalized)
  );

  if (match) {
    if (match.status === 'coming_soon') return 'DISABLED';
    if (match.defaultAccess === 'SUBSCRIPTION') return 'PRO';
    if (match.category === 'career') return 'AUTH_REQUIRED';
    return 'PUBLIC_FREE';
  }

  return 'PUBLIC_FREE';
}

/**
 * Evaluates whether a user can access a specific tool.
 * Evaluated server-side using authenticated session and active subscription records.
 */
export function canAccessTool(
  user: AuthSessionUser | null | undefined,
  toolId: string,
  options?: {
    subscription?: SubscriptionRecord | null;
    isPro?: boolean;
    override?: {
      accessMode?: ToolAccessMode;
      status?: string;
      requiresAuth?: boolean;
      requiresPro?: boolean;
    } | null;
  }
): ToolAccessDecision {
  const normalizedId = toolId.toLowerCase().trim();
  const canonicalTool = CANONICAL_TOOL_REGISTRY.find(
    (t) => t.key === normalizedId || t.featureFlagKey === normalizedId || t.route === `/tools/${normalizedId}` || t.route === `/student/${normalizedId}`
  );

  const toolName = canonicalTool?.name || toolId;

  // 1. Check override status
  const override = options?.override;
  if (override?.status) {
    const statusUpper = override.status.toUpperCase();
    if (statusUpper === 'DISABLED' || statusUpper === 'MAINTENANCE') {
      return {
        allowed: false,
        reason: 'TOOL_DISABLED',
        accessMode: 'DISABLED',
        toolName,
      };
    }
  }

  // 2. Determine effective access mode
  let effectiveMode: ToolAccessMode = override?.accessMode || getDefaultToolAccessMode(normalizedId);

  if (override?.requiresPro || override?.accessMode === 'PRO') {
    effectiveMode = 'PRO';
  } else if (override?.requiresAuth && effectiveMode === 'PUBLIC_FREE') {
    effectiveMode = 'AUTH_REQUIRED';
  }

  // 3. Evaluate by access mode
  switch (effectiveMode) {
    case 'DISABLED':
      return { allowed: false, reason: 'TOOL_DISABLED', accessMode: 'DISABLED', toolName };

    case 'ADMIN_ONLY': {
      const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
      if (!isAdmin) {
        return { allowed: false, reason: 'ADMIN_ONLY', accessMode: 'ADMIN_ONLY', toolName };
      }
      return { allowed: true, accessMode: 'ADMIN_ONLY', toolName };
    }

    case 'PRO': {
      if (!user) {
        return { allowed: false, reason: 'AUTH_REQUIRED', accessMode: 'PRO', toolName };
      }
      const hasPro = Boolean(
        options?.isPro ||
        options?.subscription?.status === 'ACTIVE' ||
        options?.subscription?.status === 'TRIALING' ||
        user.role === 'ADMIN' ||
        user.role === 'SUPER_ADMIN'
      );
      if (!hasPro) {
        return { allowed: false, reason: 'PRO_REQUIRED', accessMode: 'PRO', toolName };
      }
      return { allowed: true, accessMode: 'PRO', toolName };
    }

    case 'AUTH_REQUIRED': {
      if (!user) {
        return { allowed: false, reason: 'AUTH_REQUIRED', accessMode: 'AUTH_REQUIRED', toolName };
      }
      return { allowed: true, accessMode: 'AUTH_REQUIRED', toolName };
    }

    case 'PUBLIC_FREE':
    default:
      return { allowed: true, accessMode: 'PUBLIC_FREE', toolName };
  }
}
