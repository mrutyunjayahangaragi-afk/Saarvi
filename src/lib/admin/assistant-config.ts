/**
 * Saarvi AI Assistant Admin Configuration
 * Manages admin controls for tool discoverability, workflow policies,
 * and rate limits while strictly preventing admin access to user private documents or health data.
 */

import { ActionRegistry, type ActionAwareTool } from '../tools/action-registry.ts';

export interface AssistantAdminConfig {
  version: string;
  updatedAt: string;
  updatedBy: string;
  enabledToolIds: string[];
  maxWorkflowTurns: number;
  rateLimitPerMinute: number;
  healthAssistanceEnabled: boolean;
  careerSearchEnabled: boolean;
  academicCalculationsEnabled: boolean;
}

const DEFAULT_ADMIN_CONFIG: AssistantAdminConfig = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
  enabledToolIds: ActionRegistry.getAllTools().map((t) => t.toolId),
  maxWorkflowTurns: 10,
  rateLimitPerMinute: 60,
  healthAssistanceEnabled: true,
  careerSearchEnabled: true,
  academicCalculationsEnabled: true,
};

let currentConfig = { ...DEFAULT_ADMIN_CONFIG };
const configHistory: AssistantAdminConfig[] = [{ ...DEFAULT_ADMIN_CONFIG }];

export class AssistantConfigService {
  public static getConfig(): AssistantAdminConfig {
    return { ...currentConfig };
  }

  public static updateConfig(
    updates: Partial<AssistantAdminConfig>,
    adminEmail: string
  ): AssistantAdminConfig {
    const updated: AssistantAdminConfig = {
      ...currentConfig,
      ...updates,
      version: `1.${configHistory.length}.0`,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };

    configHistory.push(updated);
    currentConfig = updated;
    return { ...currentConfig };
  }

  public static rollbackToVersion(version: string): AssistantAdminConfig | null {
    const found = configHistory.find((c) => c.version === version);
    if (!found) return null;

    currentConfig = { ...found, updatedAt: new Date().toISOString() };
    return { ...currentConfig };
  }

  public static getHistory(): AssistantAdminConfig[] {
    return [...configHistory];
  }

  public static isToolDiscoverable(toolId: string): boolean {
    return currentConfig.enabledToolIds.includes(toolId);
  }
}
