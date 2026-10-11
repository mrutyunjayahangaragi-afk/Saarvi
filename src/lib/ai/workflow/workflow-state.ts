/**
 * Conversational Workflow State Store
 * Manages active multi-step workflow sessions with local persistence,
 * history tracking, and step-back / edit capabilities.
 */

export interface WorkflowQuestionStep {
  stepId: string;
  fieldKey: string;
  question: string;
  type: 'text' | 'choice' | 'number' | 'confirmation';
  isOptional: boolean;
  suggestedChips?: string[];
  explanation?: string;
}

export interface ActiveWorkflowSession {
  workflowId: string;
  workflowType: string;
  toolId?: string;
  currentStepIndex: number;
  totalSteps: number;
  steps: WorkflowQuestionStep[];
  collectedData: Record<string, unknown>;
  isCompleted: boolean;
  isCancelled: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_PREFIX = 'saarvi_active_workflow_';

export class WorkflowStateStore {
  /**
   * Saves active workflow state into local session.
   */
  public static saveSession(session: ActiveWorkflowSession): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.setItem(
        `${STORAGE_PREFIX}${session.workflowType}`,
        JSON.stringify(session)
      );
    } catch {
      // Storage quota or unavailable
    }
  }

  /**
   * Retrieves active workflow session by type.
   */
  public static getSession(workflowType: string): ActiveWorkflowSession | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
      const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${workflowType}`);
      if (!raw) return null;
      return JSON.parse(raw) as ActiveWorkflowSession;
    } catch {
      return null;
    }
  }

  /**
   * Clears an active workflow session upon completion or cancellation.
   */
  public static clearSession(workflowType: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.removeItem(`${STORAGE_PREFIX}${workflowType}`);
    } catch {}
  }
}
