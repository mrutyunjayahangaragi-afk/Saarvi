/**
 * Saarvi Career Template Studio 4.0 — Canonical Type Definitions
 * Supports Database-First Templates, Batch Import, PDF Layout Compiling,
 * Repeatable Sections, Sample Data, Quality Checks, and Versioning.
 */

export type DocumentType = 'RESUME' | 'COVER_LETTER';

export type TemplateStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'DISABLED'
  | 'ARCHIVED';

export type TemplateCategory =
  | 'STANDARD'
  | 'TECHNICAL'
  | 'ACADEMIC'
  | 'CREATIVE'
  | 'EXECUTIVE'
  | 'ATS_FRIENDLY'
  | 'MINIMAL';

export type TemplateLayout =
  | 'single-column'
  | 'two-column-left'
  | 'two-column-right'
  | 'compact-grid'
  | 'executive-serif';

export type TemplatePageSize = 'A4' | 'LETTER';

export type TemplateSource =
  | 'Saarvi Original'
  | 'Licensed'
  | 'Public Domain'
  | 'CC0'
  | 'Creative Commons'
  | 'Permission Granted'
  | 'Reference Recreation';

export interface TemplateMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TemplateFieldMapping {
  pdfText?: string;
  field: string;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  sampleValue?: string;
}

export interface RepeatableBlockDefinition {
  id: string;
  name: string;
  source: 'experience' | 'education' | 'projects' | 'skills' | 'certifications' | 'languages' | 'references' | 'achievements';
  itemFields: {
    titleField: string;
    subtitleField?: string;
    dateField?: string;
    locationField?: string;
    bulletsField?: string;
    tagsField?: string;
  };
  sampleEntriesCount?: number;
}

export interface CompiledTemplateSchema {
  templateId: string;
  version: number;
  documentType: DocumentType;
  pageSize: TemplatePageSize;
  margins: TemplateMargins;
  fontFamily: string;
  primaryColor: string;
  accentColor: string;
  layout: TemplateLayout;
  mode: 'COMPILED' | 'BACKGROUND_OVERLAY';
  header: {
    fullNameField: string;
    headlineField?: string;
    emailField: string;
    phoneField: string;
    locationField?: string;
    linksFields?: string[];
  };
  sections: Array<{
    id: string;
    title: string;
    type: 'text' | 'repeat' | 'skills-tags' | 'columns';
    sourceKey?: string;
    repeatConfig?: RepeatableBlockDefinition;
  }>;
  customStyles?: Record<string, string>;
}

export interface TemplateQualityReport {
  textExtraction: 'PASS' | 'FAIL';
  layoutDetection: 'PASS' | 'FAIL';
  fieldMapping: 'PASS' | 'REVIEW' | 'FAIL';
  samplePreview: 'PASS' | 'FAIL';
  pdfExport: 'PASS' | 'FAIL';
  overflowTest: 'PASS' | 'FAIL';
  license: 'VERIFIED' | 'REVIEW' | 'UNKNOWN';
  issues: string[];
}

export interface CareerTemplate {
  id: string;
  documentType: DocumentType;
  name: string;
  description: string;
  category: TemplateCategory;
  version: number;
  status: TemplateStatus;
  isActive: boolean;
  isPro: boolean;
  isFeatured: boolean;
  sortOrder: number;
  primaryColor: string;
  fontFamily: string;
  layout: TemplateLayout;
  pageSize: TemplatePageSize;
  margins: TemplateMargins;
  schema: CompiledTemplateSchema;
  sampleData?: Record<string, any>;
  thumbnailUrl?: string;
  sourceFileUrl?: string;
  fileHash?: string;
  source: TemplateSource;
  sourceUrl?: string;
  license: string;
  licenseUrl?: string;
  rightsVerified: boolean;
  rightsNotes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Metrics (joined or computed)
  usageCount?: number;
  exportCount?: number;
  rating?: number;
  feedbackCount?: number;
}

export interface TemplateImportTask {
  id: string;
  filename: string;
  fileSize: number;
  fileHash: string;
  documentType: DocumentType;
  status:
    | 'QUEUED'
    | 'PROCESSING'
    | 'ANALYZING'
    | 'NEEDS_REVIEW'
    | 'READY'
    | 'PUBLISHED'
    | 'FAILED'
    | 'ARCHIVED';
  errorReason?: string;
  detectedTextSnippets?: string[];
  detectedSections?: string[];
  detectedFields?: Record<string, string>;
  qualityReport?: TemplateQualityReport;
  candidateSchema?: CompiledTemplateSchema;
  sampleData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateImportBatch {
  id: string;
  batchName: string;
  documentType: DocumentType;
  totalFiles: number;
  processedCount: number;
  needsReviewCount: number;
  readyCount: number;
  failedCount: number;
  publishedCount: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL_SUCCESS';
  tasks: TemplateImportTask[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
