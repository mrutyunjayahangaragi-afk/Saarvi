/**
 * Saarvi Canonical Tool Control Center & Telemetry Types
 * Phase 41: Unified Admin Control Center, Beta Usage Limits & Observability
 */

export type ToolOperationalStatus =
  | 'AVAILABLE'
  | 'BETA'
  | 'COMING_SOON'
  | 'DISABLED'
  | 'MAINTENANCE';

export type ToolAccessTier = 'FREE' | 'PRO';

export type ToolWorkerMode = 'client' | 'server' | 'hybrid';

export type ToolProcessingType = 'local' | 'server' | 'mixed';

export type ToolHealthStatus =
  | 'Healthy'
  | 'Degraded'
  | 'High Error Rate'
  | 'Slow'
  | 'Disabled'
  | 'No Recent Usage';

export interface ToolControlConfig {
  toolKey: string;
  displayName: string;
  category: string;
  description: string;
  status: ToolOperationalStatus;
  accessMode: ToolAccessTier;
  betaEnabled: boolean;
  betaFreeLimit: number;
  proRequired: boolean;
  maintenanceMessage?: string;
  rolloutPercentage?: number;
  maxP95DurationMs?: number;
  maxErrorRatePct?: number;
  workerMode: ToolWorkerMode;
  processingType: ToolProcessingType;
  updatedAt: string;
  updatedBy: string;
}

export interface ToolTelemetryMetric {
  toolKey: string;
  displayName: string;
  category: string;
  status: ToolOperationalStatus;
  accessMode: ToolAccessTier;
  betaEnabled: boolean;
  betaFreeLimit: number;
  totalUses: number;
  uniqueUsers: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  lastUsedAt?: string | null;
  health: ToolHealthStatus;
  workerMode: ToolWorkerMode;
  processingType: ToolProcessingType;
  conversionsCount?: number;
  limitReachedUsers?: number;
}

export interface ToolActivityEvent {
  id: string;
  timestamp: string;
  userEmail?: string;
  userId?: string;
  toolKey: string;
  toolName: string;
  action: string;
  status: 'SUCCESS' | 'FAILED';
  durationMs?: number;
  category: string;
}

export interface UserToolUsageItem {
  toolKey: string;
  toolName: string;
  category: string;
  totalUses: number;
  successfulUses: number;
  failedUses: number;
  lastUsedAt?: string | null;
}

export interface UserToolUsageSummary {
  userId: string;
  userEmail?: string;
  totalOperations: number;
  uniqueTools: number;
  mostUsedTool: string;
  lastUsedTool: string;
  lastActivity?: string | null;
  successRate: number;
  tools: UserToolUsageItem[];
}

export interface ToolAccessResult {
  toolKey: string;
  enabled: boolean;
  status: ToolOperationalStatus;
  accessMode: ToolAccessTier;
  isAllowed: boolean;
  isPro: boolean;
  isBeta: boolean;
  usageCount: number;
  freeLimit: number;
  remainingUses: number;
  requiresPro: boolean;
  reason?: 'pro_required' | 'beta_limit_reached' | 'tool_disabled' | 'allowed';
  message?: string;
  maintenanceMessage?: string;
}
