/**
 * SaarviActionOrchestrator
 * Central orchestrator for platform-wide conversational intelligence, consent-based automation,
 * and multi-step workflow execution.
 *
 * Responsibilities:
 * 1. Understand user intent and secondary intents.
 * 2. Select allowlisted Saarvi capabilities via ActionRegistry.
 * 3. Enforce data minimization, privacy levels, and required consents.
 * 4. Coordinate multi-step workflows without questionnaire fatigue.
 * 5. Safely invoke deterministic adapters and present actionable results.
 */

import { ActionIntentResultSchema } from './types.ts';
import type { ActionIntentResult, SaarviProposedAction } from './types.ts';
import { ActionIntentParser } from './intent-parser.ts';
import { ActionRegistry } from '../../tools/action-registry.ts';
import { HealthLetterWorkflow } from '../workflows/health-letter-workflow.ts';
import { CareerSearchWorkflow } from '../workflows/career-search-workflow.ts';
import { AcademicWorkflow } from '../workflows/academic-workflow.ts';
import { WorkflowEngine } from '../workflow/workflow-engine.ts';
import { WorkflowStateStore } from '../workflow/workflow-state.ts';
import { PrivacyGuard } from '../security/privacy-guard.ts';

export interface OrchestrationRequest {
  message: string;
  workflowAction?: 'start' | 'advance' | 'step_back' | 'cancel' | 'edit';
  workflowType?: string;
  stepAnswer?: unknown;
  fieldKey?: string;
  confirmedActionId?: string;
  hasExternalConsent?: boolean;
}

export class SaarviActionOrchestrator {
  /**
   * Main entrypoint for processing any user message or workflow action.
   */
  public static async process(request: OrchestrationRequest): Promise<ActionIntentResult> {
    const rawMessage = (request.message || '').trim();

    // 1. Safety & Injection Filter
    const safety = PrivacyGuard.inspectInputSafety(rawMessage);
    if (!safety.allowed) {
      return ActionIntentResultSchema.parse({
        intent: 'UNKNOWN',
        secondaryIntents: [],
        selectedToolIds: [],
        requiredInformation: {},
        optionalInformation: {},
        extractedConstraints: {},
        missingInformation: [],
        sensitivityLevel: 'public',
        requiredConsent: [],
        proposedActions: [],
        confirmationRequired: false,
        explanation: safety.reason || 'Input rejected by security policy.',
        workflowStatus: 'cancelled',
      });
    }

    // 2. Active Multi-Step Workflow Handling
    if (request.workflowType) {
      const existingSession = WorkflowStateStore.getSession(request.workflowType);

      if (request.workflowAction === 'cancel' && existingSession) {
        WorkflowEngine.cancelWorkflow(existingSession);
        return ActionIntentResultSchema.parse({
          intent: 'UNKNOWN',
          secondaryIntents: [],
          selectedToolIds: [],
          requiredInformation: {},
          optionalInformation: {},
          extractedConstraints: {},
          missingInformation: [],
          sensitivityLevel: 'public',
          requiredConsent: [],
          proposedActions: [],
          confirmationRequired: false,
          explanation: 'Workflow cancelled. No data or draft was saved.',
          workflowStatus: 'cancelled',
          suggestedChips: ['Start New Task', 'Browse Tools'],
        });
      }

      if (request.workflowAction === 'step_back' && existingSession) {
        const transition = WorkflowEngine.stepBack(existingSession);
        return ActionIntentResultSchema.parse({
          intent: 'HEALTH_LEAVE_LETTER',
          secondaryIntents: [],
          selectedToolIds: ['cover-letter'],
          requiredInformation: transition.session.collectedData,
          optionalInformation: {},
          extractedConstraints: {},
          missingInformation: [],
          sensitivityLevel: 'health',
          requiredConsent: [],
          proposedActions: [],
          confirmationRequired: false,
          explanation: `Returned to previous step. ${transition.currentQuestion}`,
          workflowStatus: 'needs_clarification',
          currentQuestion: transition.currentQuestion,
          suggestedChips: transition.suggestedChips,
        });
      }

      if (request.workflowAction === 'edit' && existingSession && request.fieldKey) {
        const transition = WorkflowEngine.editField(
          existingSession,
          request.fieldKey,
          request.stepAnswer
        );
        return ActionIntentResultSchema.parse({
          intent: 'HEALTH_LEAVE_LETTER',
          secondaryIntents: [],
          selectedToolIds: ['cover-letter'],
          requiredInformation: transition.session.collectedData,
          optionalInformation: {},
          extractedConstraints: {},
          missingInformation: [],
          sensitivityLevel: 'health',
          requiredConsent: [],
          proposedActions: [],
          confirmationRequired: false,
          explanation: `Field updated. ${transition.currentQuestion || 'Ready.'}`,
          workflowStatus: transition.isCompleted ? 'ready' : 'needs_clarification',
          currentQuestion: transition.currentQuestion,
          suggestedChips: transition.suggestedChips,
        });
      }

      if (request.workflowAction === 'advance' && existingSession) {
        const transition = WorkflowEngine.submitAnswer(existingSession, request.stepAnswer);

        if (transition.isCompleted && request.workflowType === 'health_leave_letter') {
          const draftText = HealthLetterWorkflow.generateTruthfulDraft({
            recipient: (transition.session.collectedData.recipient as string) || 'Department Head',
            purpose: (transition.session.collectedData.purpose as string) || 'Medical Leave',
            startDate: (transition.session.collectedData.dates as string) || undefined,
            tone: (transition.session.collectedData.tone as any) || 'formal',
            authorizedStatement: (transition.session.collectedData.statement as string) || undefined,
          });

          return ActionIntentResultSchema.parse({
            intent: 'HEALTH_LEAVE_LETTER',
            secondaryIntents: ['LETTER_DRAFT'],
            selectedToolIds: ['cover-letter'],
            requiredInformation: transition.session.collectedData,
            optionalInformation: {},
            extractedConstraints: {},
            missingInformation: [],
            sensitivityLevel: 'health',
            requiredConsent: [],
            proposedActions: [
              {
                id: `act_download_${Date.now()}`,
                type: 'download_draft_pdf',
                toolId: 'cover-letter',
                title: 'Download Draft PDF',
                description: 'Download the prepared truthful leave letter locally.',
                parameters: { draftText },
                isConsequential: false,
                requiresConfirmation: false,
                requiresConsent: false,
                sensitivityLevel: 'health',
                status: 'proposed',
              },
            ],
            confirmationRequired: true,
            explanation:
              'Here is your prepared truthful leave letter draft. Please review the details below. ' +
              'You can edit any section or download it as a PDF.',
            workflowStatus: 'completed',
            draftContent: { draftText, ...transition.session.collectedData },
            suggestedChips: ['Download PDF', 'Edit Recipient', 'Cancel'],
          });
        }

        return ActionIntentResultSchema.parse({
          intent: 'HEALTH_LEAVE_LETTER',
          secondaryIntents: [],
          selectedToolIds: ['cover-letter'],
          requiredInformation: transition.session.collectedData,
          optionalInformation: {},
          extractedConstraints: {},
          missingInformation: [],
          sensitivityLevel: 'health',
          requiredConsent: [],
          proposedActions: [],
          confirmationRequired: false,
          explanation: transition.currentQuestion || 'Next question:',
          workflowStatus: 'needs_clarification',
          currentQuestion: transition.currentQuestion,
          suggestedChips: transition.suggestedChips,
        });
      }
    }

    // 3. Parse Intent & Constraints
    const parsed = ActionIntentParser.parse(rawMessage);

    // 4. Specialized Action Handlers
    // 4a. Health Emergency Handling
    if (parsed.intent === 'HEALTH_ASSISTANCE' && parsed.secondaryIntents.includes('EMERGENCY_TRIAGE')) {
      return ActionIntentResultSchema.parse(parsed);
    }

    // 4b. Career Search Direct Execution (if requirements are already complete)
    if (parsed.intent === 'CAREER_SEARCH' && parsed.workflowStatus === 'ready') {
      try {
        const oppType = parsed.extractedConstraints.opportunityType as any;
        const searchResult = await CareerSearchWorkflow.executeSearch({
          query: rawMessage,
          role: parsed.extractedConstraints.role as string,
          location: parsed.extractedConstraints.location as string,
          opportunityType: oppType,
        });

        return ActionIntentResultSchema.parse({
          ...parsed,
          explanation: searchResult.explanationText,
          draftContent: { opportunities: searchResult.opportunities },
          suggestedChips: CareerSearchWorkflow.getOpportunityFollowUpChips(searchResult.total > 0),
        });
      } catch (err) {
        console.warn('[SaarviActionOrchestrator] Career search adapter error:', err);
      }
    }

    // 4c. Academic SGPA Direct Calculation (if course marks detected)
    if (parsed.intent === 'ACADEMIC_CALCULATION') {
      const courseRegex = /([a-zA-Z\s]+?)\s*[:=]\s*(\d+)\s*(?:credits?|creds?)\s*[,;]?\s*(\d+)\s*(?:marks?)?/gi;
      const parsedCourses: Array<{ title: string; credits: number; marks?: number }> = [];
      let match: RegExpExecArray | null;

      while ((match = courseRegex.exec(rawMessage)) !== null) {
        parsedCourses.push({
          title: match[1].trim(),
          credits: Number(match[2]),
          marks: match[3] ? Number(match[3]) : 85,
        });
      }

      if (parsedCourses.length > 0) {
        const calcResult = AcademicWorkflow.calculateSGPA({ courses: parsedCourses });
        if (calcResult.success) {
          return ActionIntentResultSchema.parse({
            ...parsed,
            explanation: calcResult.explanation,
            workflowStatus: 'completed',
            draftContent: { breakdown: calcResult.breakdown, sgpa: calcResult.sgpa },
            suggestedChips: ['Calculate Another Semester', 'Calculate CGPA', 'Explain VTU Scheme'],
          });
        }
      }
    }

    // 4d. Tool Availability Verification
    if (parsed.selectedToolIds.length > 0) {
      for (const toolId of parsed.selectedToolIds) {
        const isAvail = ActionRegistry.isToolAvailable(toolId);
        if (!isAvail) {
          return ActionIntentResultSchema.parse({
            ...parsed,
            workflowStatus: 'cancelled',
            explanation: `The tool '${toolId}' is currently coming soon or disabled. Let me offer a functional alternative.`,
            suggestedChips: ['Browse Available Tools', 'Student Portal'],
          });
        }
      }
    }

    return ActionIntentResultSchema.parse(parsed);
  }
}
