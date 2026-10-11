/**
 * Saarvi Action Orchestrator — Intent & Constraint Parser
 * Parses natural language input into structured ActionIntentResult using
 * deterministic rules, taxonomy matching, and schema validation.
 */

import type { ActionIntentResult, PrimaryIntent, SensitivityLevel, SaarviProposedAction } from './types.ts';
import { ActionRegistry } from '../../tools/action-registry.ts';
import { PrivacyGuard } from '../security/privacy-guard.ts';

export class ActionIntentParser {
  /**
   * Parses user input and context into a validated ActionIntentResult.
   */
  public static parse(
    input: string,
    context?: {
      conversationHistory?: Array<{ sender: 'user' | 'assistant'; text: string }>;
      activeWorkflowType?: string;
    }
  ): ActionIntentResult {
    const trimmed = (input || '').trim();

    // 1. Security & Safety Inspection
    const safety = PrivacyGuard.inspectInputSafety(trimmed);
    if (!safety.allowed) {
      return {
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
      };
    }

    const lower = trimmed.toLowerCase();

    // 2. Health & Medical Evaluation
    const isHealthEmergency = PrivacyGuard.detectMedicalEmergency(trimmed);
    const mentionsHealth =
      isHealthEmergency ||
      lower.includes('fever') ||
      lower.includes('headache') ||
      lower.includes('sick') ||
      lower.includes('unwell') ||
      lower.includes('doctor') ||
      lower.includes('hospital') ||
      lower.includes('pain') ||
      lower.includes('cough') ||
      lower.includes('medical') ||
      lower.includes('leave application') ||
      lower.includes('leave letter');

    if (mentionsHealth) {
      const wantsLetter =
        lower.includes('letter') ||
        lower.includes('leave') ||
        lower.includes('draft') ||
        lower.includes('absence') ||
        lower.includes('application');

      if (isHealthEmergency) {
        return {
          intent: 'HEALTH_ASSISTANCE',
          secondaryIntents: ['EMERGENCY_TRIAGE'],
          selectedToolIds: [],
          requiredInformation: {},
          optionalInformation: {},
          extractedConstraints: {},
          missingInformation: [],
          sensitivityLevel: 'health',
          requiredConsent: [],
          proposedActions: [],
          confirmationRequired: false,
          explanation:
            '⚠️ **Urgent Medical Notice**: The symptoms described may require emergency medical attention. Please dial **112** or go to the nearest emergency room immediately.',
          workflowStatus: 'needs_clarification',
          suggestedChips: ['Call 112 / Emergency', 'Find Nearest Hospital'],
        };
      }

      if (wantsLetter) {
        const proposedAction: SaarviProposedAction = {
          id: `act_${Date.now()}`,
          type: 'draft_health_letter',
          toolId: 'cover-letter',
          title: 'Draft Health-Related Leave Letter',
          description: 'Draft a truthful administrative leave request locally.',
          parameters: { purpose: 'Medical Leave' },
          isConsequential: false,
          requiresConfirmation: true,
          requiresConsent: true,
          sensitivityLevel: 'health',
          status: 'proposed',
        };

        return {
          intent: 'HEALTH_LEAVE_LETTER',
          secondaryIntents: ['HEALTH_ASSISTANCE', 'LETTER_DRAFT'],
          selectedToolIds: ['cover-letter'],
          requiredInformation: { recipient: null, purpose: 'Medical Leave' },
          optionalInformation: { dates: null, tone: 'formal' },
          extractedConstraints: {},
          missingInformation: ['recipient'],
          sensitivityLevel: 'health',
          requiredConsent: ['local_processing_consent'],
          proposedActions: [proposedAction],
          confirmationRequired: true,
          explanation:
            "I'm sorry to hear that you are unwell. Take care of yourself. I can help prepare a truthful administrative leave letter for your institution. To draft this, who should the letter be addressed to?",
          workflowStatus: 'needs_clarification',
          currentQuestion: 'Who should this leave letter be addressed to? (e.g. Principal, Department Head, HR)',
          suggestedChips: ['Head of Department', 'College Principal', 'HR Manager', 'Cancel'],
        };
      }

      // General health assistance (not a letter)
      return {
        intent: 'HEALTH_ASSISTANCE',
        secondaryIntents: [],
        selectedToolIds: [],
        requiredInformation: {},
        optionalInformation: {},
        extractedConstraints: {},
        missingInformation: [],
        sensitivityLevel: 'health',
        requiredConsent: [],
        proposedActions: [],
        confirmationRequired: false,
        explanation:
          "I'm sorry you are feeling unwell. I cannot provide medical diagnosis or treatment advice, but I can help organize notes for your doctor or prepare a leave request.",
        workflowStatus: 'ready',
        suggestedChips: [
          'Organize questions for a doctor',
          'Help organize my symptom timeline',
          'Draft a leave or accommodation request',
        ],
      };
    }

    // 3. Resume, Cover Letter & Interview Preparation
    const isResumeOrLetter =
      lower.includes('cover letter') ||
      lower.includes('resume') ||
      lower.includes('cv') ||
      lower.includes('write a letter') ||
      lower.includes('draft a letter');

    if (isResumeOrLetter) {
      const toolId = lower.includes('cover letter') || lower.includes('letter') ? 'cover-letter' : 'resume-builder';
      const proposedAction: SaarviProposedAction = {
        id: `act_${Date.now()}`,
        type: 'resume_action',
        toolId,
        title: toolId === 'cover-letter' ? 'Cover Letter Builder' : 'Resume Builder',
        description: 'Prepare personalized application documents and ATS resume tailoring.',
        parameters: {},
        isConsequential: false,
        requiresConfirmation: false,
        requiresConsent: false,
        sensitivityLevel: 'career',
        status: 'proposed',
      };

      return {
        intent: 'RESUME_WORKFLOW',
        secondaryIntents: [],
        selectedToolIds: [toolId],
        requiredInformation: {},
        optionalInformation: {},
        extractedConstraints: {},
        missingInformation: [],
        sensitivityLevel: 'career',
        requiredConsent: [],
        proposedActions: [proposedAction],
        confirmationRequired: false,
        explanation: `Ready to open ${toolId === 'cover-letter' ? 'Cover Letter Builder' : 'Resume Builder'}. You can tailor and export to PDF.`,
        workflowStatus: 'ready',
        suggestedChips: ['Open Tool', 'Tailor for Job Description'],
      };
    }

    // 4. Career & Opportunity Search
    const isCareerSearch =
      lower.includes('internship') ||
      lower.includes('job') ||
      lower.includes('training') ||
      lower.includes('opportunit') ||
      lower.includes('hiring') ||
      lower.includes('vacancy');

    if (isCareerSearch) {
      let oppType: 'JOB' | 'INTERNSHIP' | 'TRAINING' | 'any' = 'any';
      if (lower.includes('internship')) oppType = 'INTERNSHIP';
      else if (lower.includes('training')) oppType = 'TRAINING';
      else if (lower.includes('job')) oppType = 'JOB';

      const extractedRole = lower.includes('software')
        ? 'Software Engineer'
        : lower.includes('react')
        ? 'React Developer'
        : lower.includes('data')
        ? 'Data Analyst'
        : lower.includes('frontend')
        ? 'Frontend Developer'
        : undefined;

      const extractedLoc = lower.includes('remote')
        ? 'Remote'
        : lower.includes('bengaluru') || lower.includes('bangalore')
        ? 'Bengaluru'
        : lower.includes('hyderabad')
        ? 'Hyderabad'
        : undefined;

      const hasSufficientRequirements = Boolean(extractedRole || (extractedLoc && oppType !== 'any'));

      const proposedAction: SaarviProposedAction = {
        id: `act_${Date.now()}`,
        type: 'search_opportunities',
        toolId: 'job-tracker',
        title: 'Search Opportunities',
        description: 'Query verified Saarvi career sources with structured parameters.',
        parameters: {
          opportunityType: oppType,
          role: extractedRole,
          location: extractedLoc,
        },
        isConsequential: false,
        requiresConfirmation: false,
        requiresConsent: false,
        sensitivityLevel: 'career',
        status: 'proposed',
      };

      if (!hasSufficientRequirements && (oppType === 'any' || !extractedRole)) {
        return {
          intent: 'CAREER_SEARCH',
          secondaryIntents: [],
          selectedToolIds: ['job-tracker'],
          requiredInformation: { opportunityType: null },
          optionalInformation: { role: null, location: null },
          extractedConstraints: {},
          missingInformation: ['opportunityType'],
          sensitivityLevel: 'career',
          requiredConsent: [],
          proposedActions: [proposedAction],
          confirmationRequired: false,
          explanation: 'What type of opportunity are you looking for? (Full-time job, internship, training, or any opportunity)',
          workflowStatus: 'needs_clarification',
          currentQuestion: 'What type of opportunity are you looking for? (Full-time job, internship, training, or any opportunity)',
          suggestedChips: ['Full-time Job', 'Internship', 'Training', 'Any suitable opportunity'],
        };
      }

      return {
        intent: 'CAREER_SEARCH',
        secondaryIntents: [],
        selectedToolIds: ['job-tracker'],
        requiredInformation: { opportunityType: oppType },
        optionalInformation: { role: extractedRole, location: extractedLoc },
        extractedConstraints: {
          opportunityType: oppType,
          role: extractedRole,
          location: extractedLoc,
        },
        missingInformation: [],
        sensitivityLevel: 'career',
        requiredConsent: [],
        proposedActions: [proposedAction],
        confirmationRequired: false,
        explanation: `Ready to search for ${oppType.toLowerCase()} opportunities${
          extractedRole ? ` in ${extractedRole}` : ''
        }${extractedLoc ? ` in ${extractedLoc}` : ''}.`,
        workflowStatus: 'ready',
        suggestedChips: ['Search Now', 'Filter Remote Only', 'Change Role'],
      };
    }

    // 4. Academic SGPA / CGPA Calculations
    const isAcademic =
      lower.includes('sgpa') ||
      lower.includes('cgpa') ||
      lower.includes('gpa') ||
      lower.includes('calculate marks') ||
      lower.includes('attendance calculation') ||
      lower.includes('attendance percentage');

    if (isAcademic) {
      const toolId = lower.includes('attendance')
        ? 'attendance-tracker'
        : lower.includes('cgpa')
        ? 'cgpa-calculator'
        : 'sgpa-calculator';

      const proposedAction: SaarviProposedAction = {
        id: `act_${Date.now()}`,
        type: 'calculate_academic',
        toolId,
        title: toolId === 'sgpa-calculator' ? 'Calculate SGPA' : toolId === 'cgpa-calculator' ? 'Calculate CGPA' : 'Calculate Attendance',
        description: 'Execute deterministic academic calculation without LLM arithmetic estimation.',
        parameters: {},
        isConsequential: false,
        requiresConfirmation: false,
        requiresConsent: false,
        sensitivityLevel: 'academic',
        status: 'proposed',
      };

      // Check if user provided concrete marks/credits directly in message
      const courseMatch = lower.match(/(\d+)\s*(?:credits?|creds?)/);
      if (!courseMatch && toolId === 'sgpa-calculator') {
        return {
          intent: 'ACADEMIC_CALCULATION',
          secondaryIntents: [],
          selectedToolIds: [toolId],
          requiredInformation: { courses: null },
          optionalInformation: { scheme: 'VTU 2022' },
          extractedConstraints: {},
          missingInformation: ['courses'],
          sensitivityLevel: 'academic',
          requiredConsent: [],
          proposedActions: [proposedAction],
          confirmationRequired: false,
          explanation: 'To calculate your SGPA, please enter your subjects, credit values, and marks or grades.',
          workflowStatus: 'needs_clarification',
          currentQuestion: 'Please enter your subjects with their credits and marks (e.g., Math: 4 credits, 85 marks; OS: 3 credits, 78 marks).',
          suggestedChips: ['Open SGPA Calculator', 'Explain SGPA Formula'],
        };
      }

      return {
        intent: 'ACADEMIC_CALCULATION',
        secondaryIntents: [],
        selectedToolIds: [toolId],
        requiredInformation: {},
        optionalInformation: {},
        extractedConstraints: {},
        missingInformation: [],
        sensitivityLevel: 'academic',
        requiredConsent: [],
        proposedActions: [proposedAction],
        confirmationRequired: false,
        explanation: 'Ready to calculate academic metrics using verified deterministic formulas.',
        workflowStatus: 'ready',
        suggestedChips: ['Calculate Now', 'View Grading Scheme'],
      };
    }

    // 5. Document Transformations
    const isDocTransform =
      lower.includes('convert') ||
      lower.includes('merge') ||
      lower.includes('compress') ||
      lower.includes('pdf') ||
      lower.includes('image to') ||
      lower.includes('word to');

    if (isDocTransform) {
      let toolId = 'jpg-to-pdf';
      if (lower.includes('compress')) toolId = 'compress-pdf';
      else if (lower.includes('merge')) toolId = 'merge-pdf';
      else if (lower.includes('word')) toolId = 'pdf-to-word';
      else if (lower.includes('excel')) toolId = 'pdf-to-excel';

      const proposedAction: SaarviProposedAction = {
        id: `act_${Date.now()}`,
        type: 'transform_document',
        toolId,
        title: 'Document Transformation',
        description: 'Process files locally in browser via local Web Worker / pdf-lib.',
        parameters: { toolId },
        isConsequential: false,
        requiresConfirmation: false,
        requiresConsent: false,
        sensitivityLevel: 'personal',
        status: 'proposed',
      };

      return {
        intent: 'DOCUMENT_TRANSFORM',
        secondaryIntents: [],
        selectedToolIds: [toolId],
        requiredInformation: { files: null },
        optionalInformation: {},
        extractedConstraints: {},
        missingInformation: ['files'],
        sensitivityLevel: 'personal',
        requiredConsent: [],
        proposedActions: [proposedAction],
        confirmationRequired: false,
        explanation: `Ready to process with ${toolId}. All file operations execute 100% locally in your browser.`,
        workflowStatus: 'ready',
        suggestedChips: ['Open Tool', 'Upload Files Locally'],
      };
    }

    // 6. Resume & Career Prep
    const isResume =
      lower.includes('resume') ||
      lower.includes('cv') ||
      lower.includes('cover letter') ||
      lower.includes('interview');

    if (isResume) {
      const toolId = lower.includes('cover letter') ? 'cover-letter' : 'resume-builder';
      const proposedAction: SaarviProposedAction = {
        id: `act_${Date.now()}`,
        type: 'resume_action',
        toolId,
        title: 'Resume & Career Preparation',
        description: 'ATS resume builder and career tailoring.',
        parameters: {},
        isConsequential: false,
        requiresConfirmation: false,
        requiresConsent: false,
        sensitivityLevel: 'career',
        status: 'proposed',
      };

      return {
        intent: 'RESUME_WORKFLOW',
        secondaryIntents: [],
        selectedToolIds: [toolId],
        requiredInformation: {},
        optionalInformation: {},
        extractedConstraints: {},
        missingInformation: [],
        sensitivityLevel: 'career',
        requiredConsent: [],
        proposedActions: [proposedAction],
        confirmationRequired: false,
        explanation: 'Ready to build or tailor your resume with live preview and vector PDF export.',
        workflowStatus: 'ready',
        suggestedChips: ['Open Resume Builder', 'Tailor for Job Description', 'ATS Keyword Check'],
      };
    }

    // 7. General Tool Discovery / Q&A Fallback
    return {
      intent: 'GENERAL_QA',
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
      explanation: 'How can Saarvi assist you today? You can ask for document conversion, academic calculations, career opportunities, or truthful letter drafts.',
      workflowStatus: 'ready',
      suggestedChips: ['Convert PDF', 'Calculate SGPA', 'Find Internships', 'Draft Leave Letter'],
    };
  }
}
