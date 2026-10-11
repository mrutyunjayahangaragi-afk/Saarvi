/**
 * Action-Aware Tool Registry
 * Extends the existing Canonical Saarvi Tool Registry with execution metadata,
 * schema validation, required fields, sensitivity ratings, and safety confirmation policies.
 *
 * Reuses CANONICAL_TOOL_REGISTRY as the single authoritative source of truth.
 */

import { z } from 'zod';
import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_MAP,
  type CanonicalTool,
} from './tool-registry.ts';
import type { SensitivityLevel } from '../ai/orchestrator/types.ts';

export type ToolOutputType =
  | 'file_download'
  | 'calculation_result'
  | 'opportunity_list'
  | 'document_preview'
  | 'navigation'
  | 'educational_guidance';

export type ConfirmationPolicy = 'never' | 'on_external_call' | 'always';

export interface ActionFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  suggestedValues?: string[];
}

export interface ActionAwareTool {
  toolId: string;
  name: string;
  description: string;
  category: string;
  route: string;
  supportedIntents: string[];
  inputSchema: z.ZodTypeAny;
  requiredFields: ActionFieldDefinition[];
  optionalFields: ActionFieldDefinition[];
  outputType: ToolOutputType;
  executionLocation: 'client' | 'server' | 'hybrid';
  sensitivity: SensitivityLevel;
  authenticationRequirements: 'none' | 'user' | 'admin';
  permissionRequirements: string[];
  confirmationPolicy: ConfirmationPolicy;
  availability: 'available' | 'coming_soon' | 'beta';
  capabilityStatus: 'available' | 'disabled' | 'requires_pro';
}

// Action metadata overrides layered over canonical tools
const ACTION_METADATA_EXTENSIONS: Record<
  string,
  {
    supportedIntents: string[];
    requiredFields: ActionFieldDefinition[];
    optionalFields: ActionFieldDefinition[];
    outputType: ToolOutputType;
    executionLocation: 'client' | 'server' | 'hybrid';
    sensitivity: SensitivityLevel;
    confirmationPolicy: ConfirmationPolicy;
    inputSchema?: z.ZodTypeAny;
  }
> = {
  'sgpa-calculator': {
    supportedIntents: ['ACADEMIC_CALCULATION', 'SGPA_CALCULATION'],
    requiredFields: [
      {
        name: 'courses',
        label: 'Course Grades and Credits',
        type: 'array',
        description: 'List of subjects with marks/grade and credits',
        required: true,
      },
    ],
    optionalFields: [
      {
        name: 'scheme',
        label: 'Academic Scheme / University',
        type: 'string',
        description: 'e.g. VTU 2022, Autonomous, or standard 10-point scale',
        required: false,
        suggestedValues: ['VTU 2022 Scheme', 'VTU 2021 Scheme', 'Standard 10-point'],
      },
      {
        name: 'semesterNumber',
        label: 'Semester Number',
        type: 'number',
        description: 'Semester number (1-8)',
        required: false,
      },
    ],
    outputType: 'calculation_result',
    executionLocation: 'client',
    sensitivity: 'academic',
    confirmationPolicy: 'never',
    inputSchema: z.object({
      courses: z.array(
        z.object({
          code: z.string().optional(),
          title: z.string().optional(),
          credits: z.number().min(0.5).max(12),
          grade: z.string().optional(),
          marks: z.number().min(0).max(100).optional(),
        })
      ).min(1),
      scheme: z.string().optional(),
      semesterNumber: z.number().optional(),
    }),
  },

  'cgpa-calculator': {
    supportedIntents: ['ACADEMIC_CALCULATION', 'CGPA_CALCULATION'],
    requiredFields: [
      {
        name: 'semesters',
        label: 'Semester SGPA & Credits',
        type: 'array',
        description: 'List of completed semesters with SGPA and credit totals',
        required: true,
      },
    ],
    optionalFields: [],
    outputType: 'calculation_result',
    executionLocation: 'client',
    sensitivity: 'academic',
    confirmationPolicy: 'never',
    inputSchema: z.object({
      semesters: z.array(
        z.object({
          semester: z.number(),
          sgpa: z.number().min(0).max(10),
          credits: z.number().min(1),
        })
      ).min(1),
    }),
  },

  'attendance-tracker': {
    supportedIntents: ['ACADEMIC_CALCULATION', 'ATTENDANCE_ANALYSIS'],
    requiredFields: [
      {
        name: 'attended',
        label: 'Classes Attended',
        type: 'number',
        description: 'Number of classes attended',
        required: true,
      },
      {
        name: 'total',
        label: 'Total Classes Conducted',
        type: 'number',
        description: 'Total number of classes conducted to date',
        required: true,
      },
    ],
    optionalFields: [
      {
        name: 'targetPercentage',
        label: 'Target Attendance %',
        type: 'number',
        description: 'Target threshold percentage (default 75% or 85%)',
        required: false,
        defaultValue: 75,
      },
    ],
    outputType: 'calculation_result',
    executionLocation: 'client',
    sensitivity: 'academic',
    confirmationPolicy: 'never',
    inputSchema: z.object({
      attended: z.number().min(0),
      total: z.number().min(1),
      targetPercentage: z.number().min(50).max(100).default(75),
    }),
  },

  'resume-builder': {
    supportedIntents: ['RESUME_WORKFLOW', 'RESUME_IMPROVEMENT', 'RESUME_BUILD'],
    requiredFields: [
      {
        name: 'fullName',
        label: 'Full Name',
        type: 'string',
        description: 'Candidate full name',
        required: true,
      },
    ],
    optionalFields: [
      {
        name: 'targetRole',
        label: 'Target Job Role',
        type: 'string',
        description: 'Target role for ATS tailoring',
        required: false,
      },
      {
        name: 'skills',
        label: 'Key Skills',
        type: 'array',
        description: 'List of technical and interpersonal skills',
        required: false,
      },
    ],
    outputType: 'document_preview',
    executionLocation: 'client',
    sensitivity: 'personal',
    confirmationPolicy: 'never',
    inputSchema: z.object({
      fullName: z.string().min(1),
      targetRole: z.string().optional(),
      skills: z.array(z.string()).optional(),
    }),
  },

  'cover-letter': {
    supportedIntents: ['LETTER_DRAFT', 'HEALTH_LEAVE_LETTER', 'COVER_LETTER'],
    requiredFields: [
      {
        name: 'recipient',
        label: 'Recipient / Organization',
        type: 'string',
        description: 'Name of institution, professor, manager, or recruiter',
        required: true,
      },
      {
        name: 'purpose',
        label: 'Letter Purpose',
        type: 'string',
        description: 'Reason for letter (e.g. medical leave, accommodation, job application)',
        required: true,
      },
    ],
    optionalFields: [
      {
        name: 'dates',
        label: 'Applicable Dates / Period',
        type: 'string',
        description: 'Dates or leave duration requested',
        required: false,
      },
      {
        name: 'tone',
        label: 'Tone',
        type: 'string',
        description: 'Formal, polite, or academic tone',
        required: false,
        defaultValue: 'formal',
      },
      {
        name: 'userStatements',
        label: 'User Statements to Include',
        type: 'string',
        description: 'Truthful factual details authorized by the user',
        required: false,
      },
    ],
    outputType: 'document_preview',
    executionLocation: 'client',
    sensitivity: 'personal',
    confirmationPolicy: 'always',
    inputSchema: z.object({
      recipient: z.string().min(1),
      purpose: z.string().min(1),
      dates: z.string().optional(),
      tone: z.string().default('formal'),
      userStatements: z.string().optional(),
    }),
  },

  'jpg-to-pdf': {
    supportedIntents: ['DOCUMENT_TRANSFORM', 'IMAGE_TO_PDF'],
    requiredFields: [
      {
        name: 'files',
        label: 'Image Files',
        type: 'array',
        description: 'One or more JPG or PNG images to combine into PDF',
        required: true,
      },
    ],
    optionalFields: [
      {
        name: 'pageSize',
        label: 'Page Size',
        type: 'string',
        description: 'Target paper size (A4, Fit to Image, Letter)',
        required: false,
        defaultValue: 'A4',
      },
    ],
    outputType: 'file_download',
    executionLocation: 'client',
    sensitivity: 'personal',
    confirmationPolicy: 'never',
    inputSchema: z.object({
      files: z.array(z.any()).min(1),
      pageSize: z.string().default('A4'),
    }),
  },

  'merge-pdf': {
    supportedIntents: ['DOCUMENT_TRANSFORM', 'MERGE_PDF'],
    requiredFields: [
      {
        name: 'files',
        label: 'PDF Files to Merge',
        type: 'array',
        description: 'Two or more PDF files',
        required: true,
      },
    ],
    optionalFields: [],
    outputType: 'file_download',
    executionLocation: 'client',
    sensitivity: 'personal',
    confirmationPolicy: 'never',
    inputSchema: z.object({
      files: z.array(z.any()).min(2),
    }),
  },

  'compress-pdf': {
    supportedIntents: ['DOCUMENT_TRANSFORM', 'COMPRESS_PDF'],
    requiredFields: [
      {
        name: 'file',
        label: 'PDF File',
        type: 'file',
        description: 'PDF document to compress',
        required: true,
      },
    ],
    optionalFields: [
      {
        name: 'compressionLevel',
        label: 'Compression Level',
        type: 'string',
        description: 'recommended, extreme, or minimal',
        required: false,
        defaultValue: 'recommended',
      },
    ],
    outputType: 'file_download',
    executionLocation: 'client',
    sensitivity: 'personal',
    confirmationPolicy: 'never',
    inputSchema: z.object({
      file: z.any(),
      compressionLevel: z.string().default('recommended'),
    }),
  },

  'job-tracker': {
    supportedIntents: ['CAREER_SEARCH', 'APPLICATION_TRACKING'],
    requiredFields: [],
    optionalFields: [],
    outputType: 'navigation',
    executionLocation: 'client',
    sensitivity: 'career',
    confirmationPolicy: 'never',
  },

  'document-summary': {
    supportedIntents: ['DOCUMENT_TRANSFORM', 'SUMMARIZE_DOCUMENT'],
    requiredFields: [
      {
        name: 'text',
        label: 'Document Content',
        type: 'string',
        description: 'Document text or notes to summarize',
        required: true,
      },
    ],
    optionalFields: [
      {
        name: 'format',
        label: 'Summary Format',
        type: 'string',
        description: 'bullets or executive overview',
        required: false,
      },
    ],
    outputType: 'educational_guidance',
    executionLocation: 'hybrid',
    sensitivity: 'personal',
    confirmationPolicy: 'on_external_call',
    inputSchema: z.object({
      text: z.string().min(10),
      format: z.string().optional(),
    }),
  },
};

export class ActionRegistry {
  private static actionToolsMap = new Map<string, ActionAwareTool>();
  private static intentToolsMap = new Map<string, ActionAwareTool[]>();

  static {
    this.initialize();
  }

  private static initialize() {
    this.actionToolsMap.clear();
    this.intentToolsMap.clear();

    for (const canonical of CANONICAL_TOOL_REGISTRY) {
      const ext = ACTION_METADATA_EXTENSIONS[canonical.key];

      const supportedIntents = ext?.supportedIntents || [
        canonical.category.toUpperCase(),
        canonical.key.toUpperCase().replace(/-/g, '_'),
      ];

      const actionTool: ActionAwareTool = {
        toolId: canonical.key,
        name: canonical.name,
        description: canonical.description,
        category: canonical.category,
        route: canonical.route,
        supportedIntents,
        inputSchema: ext?.inputSchema || z.record(z.string(), z.unknown()),
        requiredFields: ext?.requiredFields || [],
        optionalFields: ext?.optionalFields || [],
        outputType: ext?.outputType || 'navigation',
        executionLocation: ext?.executionLocation || (canonical.category === 'ai' ? 'hybrid' : 'client'),
        sensitivity: ext?.sensitivity || 'public',
        authenticationRequirements: 'none',
        permissionRequirements: [],
        confirmationPolicy: ext?.confirmationPolicy || 'never',
        availability: canonical.status,
        capabilityStatus:
          canonical.status === 'coming_soon'
            ? 'disabled'
            : canonical.defaultAccess === 'SUBSCRIPTION'
            ? 'requires_pro'
            : 'available',
      };

      this.actionToolsMap.set(canonical.key, actionTool);

      for (const intent of supportedIntents) {
        const existing = this.intentToolsMap.get(intent) || [];
        existing.push(actionTool);
        this.intentToolsMap.set(intent, existing);
      }
    }
  }

  public static getTool(toolId: string): ActionAwareTool | undefined {
    return this.actionToolsMap.get(toolId);
  }

  public static getToolsForIntent(intent: string): ActionAwareTool[] {
    return this.intentToolsMap.get(intent) || [];
  }

  public static getAllTools(): ActionAwareTool[] {
    return Array.from(this.actionToolsMap.values());
  }

  public static isToolAvailable(toolId: string): boolean {
    const tool = this.actionToolsMap.get(toolId);
    return tool ? tool.capabilityStatus !== 'disabled' : false;
  }
}
