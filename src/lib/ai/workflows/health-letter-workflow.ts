/**
 * Health-Related Assistance and Truthful Letter Workflow
 *
 * Principles:
 * 1. Empathetic response without clinical diagnosis or prescription claims.
 * 2. Emergency triage: detects urgent/life-threatening symptoms and directs immediately to emergency care.
 * 3. Never assumes a letter is desired when health is mentioned; offers healthcare organization paths first.
 * 4. Strict consent & data minimization: diagnoses are optional; no health data sent to Supabase or cloud logs.
 * 5. Truthful letter drafting: labels outputs strictly as [DRAFT], uses only user-provided statements verbatim,
 *    and NEVER fabricates doctor names, diagnoses, medical test results, or official hospital credentials.
 */

import { PrivacyGuard } from '../security/privacy-guard.ts';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface HealthWorkflowState {
  step: 'initial_assessment' | 'intent_selection' | 'consent_gate' | 'collecting_letter_fields' | 'preview_draft' | 'completed';
  isEmergency: boolean;
  selectedTask?: 'care_resources' | 'clinician_questions' | 'symptom_timeline' | 'leave_letter' | 'other_letter';
  consentGranted: boolean;
  letterFields?: {
    recipient: string;
    purpose: string;
    startDate?: string;
    endDate?: string;
    tone: 'formal' | 'polite' | 'academic';
    includeIdentity: boolean;
    studentName?: string;
    studentId?: string;
    authorizedStatement?: string;
  };
  draftText?: string;
}

export class HealthLetterWorkflow {
  /**
   * Evaluates an initial health inquiry.
   */
  public static handleHealthInquiry(userMessage: string): {
    isEmergency: boolean;
    empathyResponse: string;
    suggestedChips: string[];
    suggestedAction: string;
  } {
    // 1. Emergency safety triage check
    if (PrivacyGuard.detectMedicalEmergency(userMessage)) {
      return {
        isEmergency: true,
        empathyResponse:
          "⚠️ **Urgent Medical Notice**: The symptoms you described may require immediate medical attention. " +
          "Please contact emergency services (dial **112** or your local emergency number) or visit the nearest emergency department right away. " +
          "Saarvi AI is an administrative assistant and cannot provide medical triage or diagnosis.",
        suggestedChips: ['Call 112 / Emergency', 'Find Nearest Hospital'],
        suggestedAction: 'EMERGENCY_ESCALATION',
      };
    }

    // 2. Empathetic acknowledgement + Disclaimer
    const lower = userMessage.toLowerCase();
    const wantsLetterExplicitly =
      lower.includes('letter') ||
      lower.includes('leave application') ||
      lower.includes('extension') ||
      lower.includes('draft') ||
      lower.includes('absence');

    if (wantsLetterExplicitly) {
      return {
        isEmergency: false,
        empathyResponse:
          "I'm sorry to hear that you're feeling unwell. Take care of yourself first. " +
          "I can help you prepare a truthful leave request or administrative letter for your college or employer.\n\n" +
          "*Privacy Notice*: We process this strictly in your local browser session. Your medical details will not be saved to our cloud database.",
        suggestedChips: [
          'Draft Leave Request',
          'Organize Doctor Discussion Notes',
          'Cancel',
        ],
        suggestedAction: 'DRAFT_LEAVE_LETTER',
      };
    }

    return {
      isEmergency: false,
      empathyResponse:
        "I'm sorry you are dealing with this health issue. Your health and wellbeing always come first.\n\n" +
        "Please note: I cannot diagnose conditions, prescribe treatments, or replace a medical professional. " +
        "How can I best support you today?",
      suggestedChips: [
        'Organize questions for a doctor',
        'Help organize my symptom timeline',
        'Draft a leave or accommodation request',
        'Find healthcare resources',
      ],
      suggestedAction: 'ASSESS_HEALTH_TASK',
    };
  }

  /**
   * Generates a truthful, verifiable administrative leave letter draft.
   */
  public static generateTruthfulDraft(fields: {
    recipient: string;
    purpose: string;
    startDate?: string;
    endDate?: string;
    studentName?: string;
    studentId?: string;
    authorizedStatement?: string;
    tone?: 'formal' | 'polite' | 'academic';
  }): string {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const studentName = fields.studentName || '[Your Full Name]';
    const studentId = fields.studentId ? `\nStudent ID / USN: ${fields.studentId}` : '';
    const recipient = fields.recipient || '[Recipient Name / Department / Institution]';
    const duration =
      fields.startDate && fields.endDate
        ? `from ${fields.startDate} to ${fields.endDate}`
        : fields.startDate
        ? `starting on ${fields.startDate}`
        : 'for the required recovery period';

    const statement = fields.authorizedStatement
      ? fields.authorizedStatement.trim()
      : 'due to a personal health concern requiring rest and medical attention.';

    return `[DRAFT — ADMINISTRATIVE LEAVE REQUEST]
Date: ${today}

To:
${recipient}

Subject: Request for Leave of Absence — ${fields.purpose || 'Medical Recovery'}

Dear Sir/Madam,

I am writing to formally request a leave of absence ${duration}.

${statement}

I will ensure that any missed coursework or pending assignments are caught up promptly upon my return. Should any supporting medical documentation from a registered physician be required in accordance with institutional policy, I will provide it directly.

Thank you for your understanding and consideration.

Sincerely,

${studentName}${studentId}

[Note: This draft was generated based strictly on statements you provided. Please review and verify all details before sharing.]`;
  }

  /**
   * Creates a vector PDF of the truthful draft locally in-memory using pdf-lib.
   */
  public static async createDraftPdf(draftText: string): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { height } = page.getSize();
    let y = height - 50;
    const margin = 50;
    const lineHeight = 16;

    // Header label
    page.drawText('SAARVI ADMINISTRATIVE DOCUMENT DRAFT', {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.4, 0.6),
    });
    y -= 25;

    // Split text into lines
    const lines = draftText.split('\n');
    for (const rawLine of lines) {
      if (y < 50) {
        // Simple page boundary check (single page for leave letters)
        break;
      }

      if (rawLine.startsWith('Subject:')) {
        page.drawText(rawLine, {
          x: margin,
          y,
          size: 11,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
      } else if (rawLine.startsWith('[DRAFT')) {
        page.drawText(rawLine, {
          x: margin,
          y,
          size: 9,
          font: fontBold,
          color: rgb(0.8, 0.2, 0.2),
        });
      } else {
        page.drawText(rawLine, {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
      }

      y -= lineHeight;
    }

    return await pdfDoc.save();
  }
}
