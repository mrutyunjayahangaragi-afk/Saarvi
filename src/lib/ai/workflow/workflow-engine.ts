/**
 * Conversational Workflow Engine
 * State machine managing multi-step tasks across Saarvi.
 *
 * Rules:
 * - Ask one clear question at a time.
 * - Accept free-text or suggested chips.
 * - Skip optional questions.
 * - Go back to earlier steps or edit previous answers.
 * - Cancel or resume without losing progress.
 */

import type {
  ActiveWorkflowSession,
  WorkflowQuestionStep,
} from './workflow-state.ts';
import {
  WorkflowStateStore,
} from './workflow-state.ts';

export interface WorkflowTransitionResult {
  session: ActiveWorkflowSession;
  currentQuestion?: string;
  suggestedChips?: string[];
  isCompleted: boolean;
  isCancelled: boolean;
  outputSummary?: string;
  draftContent?: Record<string, unknown>;
}

export class WorkflowEngine {
  /**
   * Initializes a workflow session based on workflow type.
   */
  public static startWorkflow(
    workflowType: string,
    initialData: Record<string, unknown> = {}
  ): WorkflowTransitionResult {
    const steps = this.getStepsForWorkflow(workflowType);
    const session: ActiveWorkflowSession = {
      workflowId: `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workflowType,
      currentStepIndex: 0,
      totalSteps: steps.length,
      steps,
      collectedData: { ...initialData },
      isCompleted: false,
      isCancelled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Fast-forward through any steps already satisfied by initialData
    while (
      session.currentStepIndex < session.totalSteps &&
      session.collectedData[session.steps[session.currentStepIndex].fieldKey] !== undefined
    ) {
      session.currentStepIndex++;
    }

    if (session.currentStepIndex >= session.totalSteps) {
      session.isCompleted = true;
    }

    WorkflowStateStore.saveSession(session);

    const currentStep = session.steps[session.currentStepIndex];
    return {
      session,
      currentQuestion: currentStep?.question,
      suggestedChips: currentStep?.suggestedChips,
      isCompleted: session.isCompleted,
      isCancelled: false,
    };
  }

  /**
   * Advances the current workflow by recording the user's answer.
   */
  public static submitAnswer(
    session: ActiveWorkflowSession,
    answer: unknown
  ): WorkflowTransitionResult {
    if (session.isCompleted || session.isCancelled) {
      return {
        session,
        isCompleted: session.isCompleted,
        isCancelled: session.isCancelled,
      };
    }

    const currentStep = session.steps[session.currentStepIndex];
    if (currentStep) {
      session.collectedData[currentStep.fieldKey] = answer;
    }

    session.currentStepIndex++;
    session.updatedAt = Date.now();

    if (session.currentStepIndex >= session.totalSteps) {
      session.isCompleted = true;
      WorkflowStateStore.clearSession(session.workflowType);

      return {
        session,
        isCompleted: true,
        isCancelled: false,
        draftContent: session.collectedData,
        outputSummary: `All required information collected for ${session.workflowType}. Ready to generate or execute.`,
      };
    }

    WorkflowStateStore.saveSession(session);
    const nextStep = session.steps[session.currentStepIndex];

    return {
      session,
      currentQuestion: nextStep.question,
      suggestedChips: nextStep.suggestedChips,
      isCompleted: false,
      isCancelled: false,
    };
  }

  /**
   * Goes back to the previous question step.
   */
  public static stepBack(session: ActiveWorkflowSession): WorkflowTransitionResult {
    if (session.currentStepIndex > 0) {
      session.currentStepIndex--;
      session.updatedAt = Date.now();
      session.isCompleted = false;
      WorkflowStateStore.saveSession(session);
    }

    const currentStep = session.steps[session.currentStepIndex];
    return {
      session,
      currentQuestion: currentStep?.question,
      suggestedChips: currentStep?.suggestedChips,
      isCompleted: false,
      isCancelled: false,
    };
  }

  /**
   * Edits a specific previously collected field.
   */
  public static editField(
    session: ActiveWorkflowSession,
    fieldKey: string,
    newValue: unknown
  ): WorkflowTransitionResult {
    session.collectedData[fieldKey] = newValue;
    session.updatedAt = Date.now();
    WorkflowStateStore.saveSession(session);

    const currentStep = session.steps[session.currentStepIndex];
    return {
      session,
      currentQuestion: currentStep?.question,
      suggestedChips: currentStep?.suggestedChips,
      isCompleted: session.isCompleted,
      isCancelled: session.isCancelled,
    };
  }

  /**
   * Cancels the active workflow.
   */
  public static cancelWorkflow(session: ActiveWorkflowSession): WorkflowTransitionResult {
    session.isCancelled = true;
    WorkflowStateStore.clearSession(session.workflowType);
    return {
      session,
      isCompleted: false,
      isCancelled: true,
      outputSummary: 'Workflow cancelled. No data or draft was saved.',
    };
  }

  /**
   * Defines step sequences for supported workflows.
   */
  private static getStepsForWorkflow(type: string): WorkflowQuestionStep[] {
    switch (type) {
      case 'health_leave_letter':
        return [
          {
            stepId: 'hll_1',
            fieldKey: 'recipient',
            question: 'Who should this leave letter be addressed to? (e.g. Principal, Department Head, HR Manager)',
            type: 'text',
            isOptional: false,
            suggestedChips: ['Head of Department', 'College Principal', 'HR Manager', 'Project Mentor'],
          },
          {
            stepId: 'hll_2',
            fieldKey: 'purpose',
            question: 'What is the primary reason or title for this leave request?',
            type: 'text',
            isOptional: false,
            suggestedChips: ['Medical Leave', 'Health Recovery Leave', 'Medical Appointment Absence', 'Exam Rescheduling'],
          },
          {
            stepId: 'hll_3',
            fieldKey: 'dates',
            question: 'What dates or timeframe are you requesting off? (e.g. October 12 to October 15)',
            type: 'text',
            isOptional: true,
            suggestedChips: ['Today only', 'Next 3 days', 'Next week', 'To be decided by doctor'],
          },
          {
            stepId: 'hll_4',
            fieldKey: 'tone',
            question: 'What tone would you prefer for the letter?',
            type: 'choice',
            isOptional: true,
            suggestedChips: ['Formal', 'Polite', 'Academic'],
          },
        ];

      case 'career_search':
        return [
          {
            stepId: 'cs_1',
            fieldKey: 'opportunityType',
            question: 'What type of opportunity are you looking for?',
            type: 'choice',
            isOptional: false,
            suggestedChips: ['Internship', 'Full-time Job', 'Training Program', 'Any Opportunity'],
          },
          {
            stepId: 'cs_2',
            fieldKey: 'role',
            question: 'What is your preferred role or domain? (e.g. Software Engineer, React Developer, Data Analyst)',
            type: 'text',
            isOptional: false,
            suggestedChips: ['Software Engineer', 'Full Stack Developer', 'Data Analyst', 'Frontend Developer'],
          },
          {
            stepId: 'cs_3',
            fieldKey: 'location',
            question: 'What is your location or work mode preference?',
            type: 'choice',
            isOptional: true,
            suggestedChips: ['Remote Only', 'Bengaluru', 'Hyderabad', 'Any Location'],
          },
        ];

      default:
        return [
          {
            stepId: 'gen_1',
            fieldKey: 'query',
            question: 'How can Saarvi AI assist you with this task?',
            type: 'text',
            isOptional: false,
          },
        ];
    }
  }
}
