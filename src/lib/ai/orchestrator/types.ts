import { z } from 'zod';

export type SensitivityLevel = 'public' | 'internal' | 'academic' | 'career' | 'personal' | 'health';

export type WorkflowStatus =
  | 'ready'
  | 'needs_clarification'
  | 'awaiting_consent'
  | 'awaiting_confirmation'
  | 'executing'
  | 'completed'
  | 'cancelled';

export type PrimaryIntent =
  | 'HEALTH_ASSISTANCE'
  | 'HEALTH_LEAVE_LETTER'
  | 'LETTER_DRAFT'
  | 'CAREER_SEARCH'
  | 'ACADEMIC_CALCULATION'
  | 'DOCUMENT_TRANSFORM'
  | 'RESUME_WORKFLOW'
  | 'TOOL_DISCOVERY'
  | 'GENERAL_QA'
  | 'UNKNOWN';

export interface SaarviProposedAction {
  id: string;
  type: string;
  toolId?: string;
  title: string;
  description: string;
  parameters: Record<string, unknown>;
  isConsequential: boolean;
  requiresConfirmation: boolean;
  requiresConsent: boolean;
  sensitivityLevel: SensitivityLevel;
  status: 'proposed' | 'confirmed' | 'cancelled' | 'executed';
}

export interface ActionIntentResult {
  intent: PrimaryIntent;
  secondaryIntents: string[];
  selectedToolIds: string[];
  requiredInformation: Record<string, unknown>;
  optionalInformation: Record<string, unknown>;
  extractedConstraints: Record<string, unknown>;
  missingInformation: string[];
  sensitivityLevel: SensitivityLevel;
  requiredConsent: string[];
  proposedActions: SaarviProposedAction[];
  confirmationRequired: boolean;
  explanation: string;
  workflowStatus: WorkflowStatus;
  suggestedChips?: string[];
  currentQuestion?: string;
  draftContent?: Record<string, unknown>;
}

export const ActionIntentResultSchema = z.object({
  intent: z.enum([
    'HEALTH_ASSISTANCE',
    'HEALTH_LEAVE_LETTER',
    'LETTER_DRAFT',
    'CAREER_SEARCH',
    'ACADEMIC_CALCULATION',
    'DOCUMENT_TRANSFORM',
    'RESUME_WORKFLOW',
    'TOOL_DISCOVERY',
    'GENERAL_QA',
    'UNKNOWN',
  ]),
  secondaryIntents: z.array(z.string()).default([]),
  selectedToolIds: z.array(z.string()).default([]),
  requiredInformation: z.record(z.string(), z.unknown()).default({}),
  optionalInformation: z.record(z.string(), z.unknown()).default({}),
  extractedConstraints: z.record(z.string(), z.unknown()).default({}),
  missingInformation: z.array(z.string()).default([]),
  sensitivityLevel: z.enum(['public', 'internal', 'academic', 'career', 'personal', 'health']).default('public'),
  requiredConsent: z.array(z.string()).default([]),
  proposedActions: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      toolId: z.string().optional(),
      title: z.string(),
      description: z.string(),
      parameters: z.record(z.string(), z.unknown()).default({}),
      isConsequential: z.boolean().default(false),
      requiresConfirmation: z.boolean().default(false),
      requiresConsent: z.boolean().default(false),
      sensitivityLevel: z.enum(['public', 'internal', 'academic', 'career', 'personal', 'health']).default('public'),
      status: z.enum(['proposed', 'confirmed', 'cancelled', 'executed']).default('proposed'),
    })
  ).default([]),
  confirmationRequired: z.boolean().default(false),
  explanation: z.string(),
  workflowStatus: z.enum([
    'ready',
    'needs_clarification',
    'awaiting_consent',
    'awaiting_confirmation',
    'executing',
    'completed',
    'cancelled',
  ]),
  suggestedChips: z.array(z.string()).optional(),
  currentQuestion: z.string().optional(),
  draftContent: z.record(z.string(), z.unknown()).optional(),
});
