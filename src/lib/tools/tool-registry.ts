/**
 * Canonical Saarvi Tool Registry
 * Single authoritative source of truth for tool definitions, categories,
 * navigation metadata, routes, icons, and feature flag linkages.
 *
 * Consumed uniformly by:
 * - Navbar (Desktop Mega Menu + Mobile Accordion)
 * - Homepage (Popular Tools, Category Explorer, Student Section)
 * - Global Search (Cmd+K modal)
 * - Tool Catalog (/tools)
 * - Admin Feature Flags & Tools management
 */

import type { FeatureAccessMode, FeatureFlag, FeatureFlagStatus } from '../../types/admin.ts';

export type CanonicalToolCategory = 'pdf' | 'image' | 'student' | 'academic' | 'career' | 'ai';

export const CANONICAL_TOOL_CATEGORIES: Array<{ id: CanonicalToolCategory; name: string; description: string }> = [
  { id: 'pdf', name: 'PDF Tools', description: 'Merge, split, compress, and organize documents' },
  { id: 'image', name: 'Image Tools', description: 'Convert, compress, crop, and resize images' },
  { id: 'student', name: 'Student Tools', description: 'Timetable, assignments, exams, and attendance' },
  { id: 'academic', name: 'Academic Tools', description: 'Multi-university SGPA, CGPA, and goals' },
  { id: 'career', name: 'Career Tools', description: 'ATS resume builder, cover letters, and job tracking' },
  { id: 'ai', name: 'AI Tools', description: 'AI Student Copilot, study assistance, and OCR' },
];

export interface CanonicalTool {
  key: string;               // Unique slug identifier, e.g. "sgpa-calculator", "resume-builder"
  name: string;              // Human-readable title
  description: string;       // Concise one-line description
  category: CanonicalToolCategory;
  subcategory?: string;
  route: string;             // Direct URL route
  icon: string;              // Lucide icon name
  featureFlagKey: string;    // Corresponding feature flag key in authoritative store
  defaultAccess: FeatureAccessMode; // "FREE" | "SUBSCRIPTION"
  status: 'available' | 'coming_soon' | 'beta';
  badge?: string;
  popular?: boolean;
  keywords?: string[];
  workerMode?: 'client' | 'server' | 'hybrid';
  processingType?: 'local' | 'server' | 'mixed';
  betaFreeLimit?: number;
  version?: string;
}

export function getToolOperationalMetadata(tool: CanonicalTool) {
  const isAi = tool.category === 'ai';
  const workerMode: 'client' | 'server' | 'hybrid' = tool.workerMode || (isAi ? 'hybrid' : 'client');
  const processingType: 'local' | 'server' | 'mixed' = tool.processingType || (isAi ? 'mixed' : 'local');
  const betaFreeLimit = tool.betaFreeLimit || 10;
  const version = tool.version || '1.0.0';
  const proRequired = tool.defaultAccess === 'SUBSCRIPTION';

  return {
    tool_key: tool.key,
    display_name: tool.name,
    category: tool.category,
    description: tool.description,
    status: tool.status,
    access_mode: tool.defaultAccess === 'SUBSCRIPTION' ? 'PRO' : (tool.status === 'beta' ? 'BETA' : 'FREE'),
    beta_enabled: tool.status === 'beta',
    beta_free_limit: betaFreeLimit,
    pro_required: proRequired,
    version,
    enabled: tool.status !== 'coming_soon',
    worker_mode: workerMode,
    processing_type: processingType,
  };
}

export const CANONICAL_TOOL_REGISTRY: CanonicalTool[] = [
  // =========================================================================
  // 1. PDF TOOLS
  // =========================================================================
  {
    key: 'pdf-to-excel',
    name: 'PDF to Excel',
    description: 'Convert PDF tables and documents into editable Microsoft Excel spreadsheets.',
    category: 'pdf',
    route: '/tools/pdf-to-excel',
    icon: 'FileSpreadsheet',
    featureFlagKey: 'pdf-to-excel',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: [
      'pdf to excel',
      'pdf to xlsx',
      'convert pdf to excel',
      'make spreadsheet from pdf',
      'extract table from pdf',
      'pdf spreadsheet',
    ],
  },
  {
    key: 'excel-to-pdf',
    name: 'Excel to PDF',
    description: 'Convert Microsoft Excel spreadsheets into clean, print-ready PDF documents.',
    category: 'pdf',
    route: '/tools/excel-to-pdf',
    icon: 'FileSpreadsheet',
    featureFlagKey: 'excel-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: [
      'excel to pdf',
      'xlsx to pdf',
      'convert excel to pdf',
      'spreadsheet to pdf',
      'sheet to pdf',
      'excel converter',
    ],
  },
  {
    key: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    description: 'Convert PDF document pages into editable Microsoft PowerPoint presentation slides.',
    category: 'pdf',
    route: '/tools/pdf-to-powerpoint',
    icon: 'Presentation',
    featureFlagKey: 'pdf-to-powerpoint',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: [
      'pdf to powerpoint',
      'pdf to pptx',
      'convert pdf to powerpoint',
      'pdf to slides',
      'pdf to presentation',
    ],
  },
  {
    key: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    description: 'Convert Microsoft PowerPoint presentation slide decks into standard PDF documents.',
    category: 'pdf',
    route: '/tools/powerpoint-to-pdf',
    icon: 'Presentation',
    featureFlagKey: 'powerpoint-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: [
      'powerpoint to pdf',
      'turn powerpoint into pdf',
      'pptx to pdf',
      'convert powerpoint to pdf',
      'slides to pdf',
      'presentation to pdf',
    ],
  },
  {
    key: 'txt-to-pdf',
    name: 'TXT to PDF',
    description: 'Convert plain text documents into beautifully formatted and paginated PDF files.',
    category: 'pdf',
    route: '/tools/txt-to-pdf',
    icon: 'FileText',
    featureFlagKey: 'txt-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    keywords: [
      'txt to pdf',
      'convert txt to pdf',
      'text to pdf',
      'plain text to pdf',
      'notepad to pdf',
      'notes to pdf',
      'notes',
    ],
  },
  {
    key: 'csv-to-pdf',
    name: 'CSV to PDF',
    description: 'Convert raw CSV tabular data into structured, cleanly styled PDF documents with auto-landscape.',
    category: 'pdf',
    route: '/tools/csv-to-pdf',
    icon: 'Table',
    featureFlagKey: 'csv-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    keywords: [
      'csv to pdf',
      'convert csv to pdf',
      'csv to table pdf',
      'tabular data to pdf',
      'tabular',
      'data to pdf',
      'comma separated to pdf',
    ],
  },
  {
    key: 'html-to-pdf',
    name: 'HTML to PDF',
    description: 'Convert HTML files and web documents into clean, secure PDF documents locally.',
    category: 'pdf',
    route: '/tools/html-to-pdf',
    icon: 'FileCode',
    featureFlagKey: 'html-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    keywords: [
      'html to pdf',
      'convert html to pdf',
      'webpage to pdf',
      'html document to pdf',
      'save html as pdf',
      'code to pdf',
      'html code to pdf',
      'markup to pdf',
    ],
  },
  {
    key: 'pdf-to-word',
    name: 'PDF to Word',
    description: 'Convert PDF documents into editable Microsoft Word documents.',
    category: 'pdf',
    route: '/tools/pdf-to-word',
    icon: 'FileType',
    featureFlagKey: 'pdf-to-word',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: [
      'pdf to word',
      'pdf to docx',
      'convert pdf to word',
      'pdf converter',
      'editable word document',
      'pdf document',
    ],
  },
  {
    key: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Convert Microsoft Word documents into PDF files.',
    category: 'pdf',
    route: '/tools/word-to-pdf',
    icon: 'FileType',
    featureFlagKey: 'word-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: [
      'word to pdf',
      'docx to pdf',
      'convert word to pdf',
      'word converter',
      'document to pdf',
      'docx converter',
    ],
  },
  {
    key: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF files into one structured document in seconds.',
    category: 'pdf',
    route: '/tools/merge-pdf',
    icon: 'Combine',
    featureFlagKey: 'merge-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['merge pdf', 'combine pdf', 'join pdf', 'concatenate pdf'],
  },
  {
    key: 'split-pdf',
    name: 'Split PDF',
    description: 'Extract specific pages or page ranges into individual PDF documents.',
    category: 'pdf',
    route: '/tools/split-pdf',
    icon: 'Scissors',
    featureFlagKey: 'split-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['split pdf', 'extract pages', 'separate pdf', 'cut pdf'],
  },
  {
    key: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Reduce PDF file size while preserving high text and graphic clarity.',
    category: 'pdf',
    route: '/tools/compress-pdf',
    icon: 'Minimize2',
    featureFlagKey: 'compress-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['compress pdf', 'reduce pdf size', 'shrink pdf', 'optimize pdf'],
  },
  {
    key: 'protect-pdf',
    name: 'Protect PDF',
    description: 'Encrypt sensitive PDF documents with custom open and owner passwords.',
    category: 'pdf',
    route: '/tools/protect-pdf',
    icon: 'Lock',
    featureFlagKey: 'protect-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['protect pdf', 'encrypt pdf', 'lock pdf', 'pdf password', 'secure pdf'],
  },
  {
    key: 'unlock-pdf',
    name: 'Unlock PDF',
    description: 'Remove password protection and printing restrictions from accessible PDFs.',
    category: 'pdf',
    route: '/tools/unlock-pdf',
    icon: 'Unlock',
    featureFlagKey: 'unlock-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['unlock pdf', 'remove pdf password', 'decrypt pdf', 'unprotect pdf', 'pdf restrictions'],
  },
  {
    key: 'watermark-pdf',
    name: 'Watermark PDF',
    description: 'Add custom text watermarks to your PDF documents with custom opacity and rotation.',
    category: 'pdf',
    route: '/tools/watermark-pdf',
    icon: 'Stamp',
    featureFlagKey: 'watermark-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['watermark pdf', 'add watermark', 'stamp pdf', 'confidential watermark', 'pdf watermark'],
  },
  {
    key: 'page-numbers-pdf',
    name: 'Add Page Numbers',
    description: 'Insert clean, customizable page numbers into your PDF with custom formats and positions.',
    category: 'pdf',
    route: '/tools/page-numbers-pdf',
    icon: 'ListOrdered',
    featureFlagKey: 'page-numbers-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['page numbers pdf', 'number pdf', 'add page numbers', 'pdf pagination', 'page x of y'],
  },
  {
    key: 'pdf-header-footer',
    name: 'PDF Header & Footer',
    description: 'Add custom headers, footers, dates, and dynamic page counts to PDFs.',
    category: 'pdf',
    route: '/tools/pdf-header-footer',
    icon: 'Heading',
    featureFlagKey: 'pdf-header-footer',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['pdf header footer', 'add header to pdf', 'add footer to pdf', 'running header pdf', 'pdf header'],
  },
  {
    key: 'pdf-metadata',
    name: 'PDF Metadata Editor',
    description: 'View, edit, or strip PDF metadata properties, author details, and title tags.',
    category: 'pdf',
    route: '/tools/pdf-metadata',
    icon: 'Tags',
    featureFlagKey: 'pdf-metadata',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['pdf metadata', 'edit pdf metadata', 'remove author pdf', 'clean pdf metadata', 'pdf properties'],
  },
  {
    key: 'flatten-pdf',
    name: 'Flatten PDF',
    description: 'Flatten interactive fillable forms and annotations into permanent non-editable page graphics.',
    category: 'pdf',
    route: '/tools/flatten-pdf',
    icon: 'Layers',
    featureFlagKey: 'flatten-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['flatten pdf', 'flatten form fields', 'lock pdf form', 'make pdf non editable', 'flatten acroform'],
  },
  {
    key: 'pdf-info',
    name: 'PDF Info & Inspection',
    description: 'Inspect PDF properties, page dimensions, encryption status, and metadata locally.',
    category: 'pdf',
    route: '/tools/pdf-info',
    icon: 'Info',
    featureFlagKey: 'pdf-info',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['pdf info', 'pdf inspector', 'check pdf pages', 'pdf dimensions', 'pdf metadata viewer', 'pdf details'],
  },
  {
    key: 'pdf-to-jpg',
    name: 'PDF to JPG',
    description: 'Render and extract high-resolution JPG images from PDF pages locally.',
    category: 'pdf',
    route: '/tools/pdf-to-jpg',
    icon: 'FileDown',
    featureFlagKey: 'pdf-to-jpg',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['pdf to jpg', 'pdf to image', 'convert pdf to photo', 'extract images'],
  },
  {
    key: 'pdf-to-png',
    name: 'PDF to PNG',
    description: 'Export PDF pages as crisp, lossless PNG graphics with transparent support.',
    category: 'pdf',
    route: '/tools/pdf-to-png',
    icon: 'FileImage',
    featureFlagKey: 'pdf-to-png',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['pdf to png', 'lossless pdf to image', 'crisp pdf export'],
  },
  {
    key: 'reorder-pdf',
    name: 'Reorder PDF Pages',
    description: 'Rearrange and sort PDF pages with intuitive visual controls.',
    category: 'pdf',
    route: '/tools/reorder-pdf',
    icon: 'GripVertical',
    featureFlagKey: 'organize-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['reorder pdf', 'sort pages', 'move pdf pages', 'reorganize pdf'],
  },
  {
    key: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate upside-down or sideways PDF pages by 90, 180, or 270 degrees.',
    category: 'pdf',
    route: '/tools/rotate-pdf',
    icon: 'RefreshCw',
    featureFlagKey: 'organize-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['rotate pdf', 'turn pdf pages', 'orient pdf', 'portrait to landscape'],
  },
  {
    key: 'delete-pdf-pages',
    name: 'Delete PDF Pages',
    description: 'Remove blank or unnecessary pages from your PDF file permanently.',
    category: 'pdf',
    route: '/tools/delete-pdf-pages',
    icon: 'Trash2',
    featureFlagKey: 'organize-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['delete pdf pages', 'remove pages', 'discard pages from pdf'],
  },
  {
    key: 'extract-pdf-pages',
    name: 'Extract PDF Pages',
    description: 'Extract selected pages from a large document into a new standalone PDF.',
    category: 'pdf',
    route: '/tools/extract-pdf-pages',
    icon: 'Scissors',
    featureFlagKey: 'organize-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['extract pdf pages', 'cherry pick pages', 'export page range'],
  },

  // =========================================================================
  // 2. IMAGE & SCAN TOOLS
  // =========================================================================
  {
    key: 'document-scanner',
    name: 'Document Scanner',
    description: 'Capture, crop, deskew, and enhance physical documents into crisp PDF or images.',
    category: 'image',
    route: '/tools/document-scanner',
    icon: 'Scan',
    featureFlagKey: 'document-scanner',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['document scanner', 'scan document', 'camera scan', 'mobile scanner', 'pdf scanner'],
  },
  {
    key: 'jpg-to-pdf',
    name: 'JPG to PDF',
    description: 'Convert JPG photographs into standard, printable PDF documents.',
    category: 'image',
    route: '/tools/jpg-to-pdf',
    icon: 'FileImage',
    featureFlagKey: 'jpg-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['jpg to pdf', 'image to pdf', 'photo to pdf', 'convert jpg'],
  },
  {
    key: 'png-to-jpg',
    name: 'PNG to JPG',
    description: 'Transform PNG images into lightweight JPG format with clean white background.',
    category: 'image',
    route: '/tools/png-to-jpg',
    icon: 'RefreshCw',
    featureFlagKey: 'png-to-jpg',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['png to jpg', 'convert transparent png', 'png to jpeg'],
  },
  {
    key: 'jpg-to-png',
    name: 'JPG to PNG',
    description: 'Convert compressed JPG images into lossless, high-fidelity PNG format.',
    category: 'image',
    route: '/tools/jpg-to-png',
    icon: 'Repeat',
    featureFlagKey: 'jpg-to-png',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['jpg to png', 'jpeg to png', 'convert to lossless png'],
  },
  {
    key: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Convert any image format (JPG, PNG, WebP) into an aligned PDF.',
    category: 'image',
    route: '/tools/image-to-pdf',
    icon: 'FileImage',
    featureFlagKey: 'image-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['image to pdf', 'picture to pdf', 'universal image converter'],
  },
  {
    key: 'multiple-images-to-pdf',
    name: 'Multiple Images to PDF',
    description: 'Bundle multiple photos and document scans into a single cohesive PDF.',
    category: 'image',
    route: '/tools/multiple-images-to-pdf',
    icon: 'Layers',
    featureFlagKey: 'image-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['multiple images to pdf', 'batch photos to pdf', 'album to pdf'],
  },
  {
    key: 'image-resize',
    name: 'Resize Image',
    description: 'Scale image dimensions accurately with custom width, height, and aspect ratio.',
    category: 'image',
    route: '/tools/image-resize',
    icon: 'Maximize2',
    featureFlagKey: 'resize-image',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['resize image', 'image dimensions', 'scale photo', 'shrink image resolution'],
  },
  {
    key: 'crop-image',
    name: 'Crop Image',
    description: 'Reframe and crop photos with freehand or standardized aspect ratio presets.',
    category: 'image',
    route: '/tools/crop-image',
    icon: 'Scissors',
    featureFlagKey: 'crop-image',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['crop image', 'crop photo', 'square crop', 'aspect ratio crop'],
  },
  {
    key: 'compress-image',
    name: 'Compress Image',
    description: 'Reduce image file size with intelligent client-side quality compression.',
    category: 'image',
    route: '/tools/compress-image',
    icon: 'Minimize2',
    featureFlagKey: 'compress-image',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['compress image', 'reduce photo size', 'shrink jpeg size', 'image optimizer'],
  },

  // =========================================================================
  // 3. ACADEMIC TOOLS
  // =========================================================================
  {
    key: 'sgpa-calculator',
    name: 'SGPA Calculator',
    description: 'Calculate semester SGPA across VTU and supported university curriculum schemes.',
    category: 'academic',
    route: '/student/sgpa-calculator',
    icon: 'GraduationCap',
    featureFlagKey: 'sgpa-calculator',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['sgpa calculator', 'semester gpa', 'university sgpa', 'grade point average'],
  },
  {
    key: 'cgpa-calculator',
    name: 'CGPA Calculator',
    description: 'Deterministic Cumulative Grade Point Average engine with official percentage conversion.',
    category: 'academic',
    route: '/student/cgpa-calculator',
    icon: 'Award',
    featureFlagKey: 'cgpa-calculator',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['cgpa calculator', 'cumulative gpa', 'cgpa to percentage', 'degree classification'],
  },
  {
    key: 'attendance-tracker',
    name: 'Attendance Planner',
    description: 'Track class attendance, calculate safety margins, and plan recovery classes.',
    category: 'academic',
    route: '/student/attendance',
    icon: 'Percent',
    featureFlagKey: 'attendance',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['attendance calculator', 'bunk calculator', 'attendance tracker', 'minimum 75 attendance'],
  },
  {
    key: 'exam-marks-analyzer',
    name: 'Marks Calculator',
    description: 'Analyze CIE internals and SEE exam scores against minimum passing thresholds.',
    category: 'academic',
    route: '/student/calculator',
    icon: 'Calculator',
    featureFlagKey: 'marks-calculator',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['marks calculator', 'cie marks', 'see marks', 'passing marks calculation'],
  },

  // =========================================================================
  // 4. STUDENT TOOLS (Productivity & Organization)
  // =========================================================================
  {
    key: 'timetable-generator',
    name: 'Timetable Generator',
    description: 'Weekly schedule planner with conflict detection and color-coded course slots.',
    category: 'student',
    route: '/student/timetable',
    icon: 'Calendar',
    featureFlagKey: 'timetable',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['timetable', 'class schedule', 'weekly routine', 'lecture planner'],
  },
  {
    key: 'study-planner',
    name: 'Study Planner',
    description: 'Organize study sessions, revision milestones, and syllabus topic coverage.',
    category: 'student',
    route: '/student/study-planner',
    icon: 'Clock',
    featureFlagKey: 'study-planner',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['study planner', 'revision timetable', 'study schedule', 'exam prep'],
  },
  {
    key: 'exam-tracker',
    name: 'Exam Schedule Tracker',
    description: 'Countdown to mid-terms and finals with venue notes and preparation status.',
    category: 'student',
    route: '/student/exams',
    icon: 'CalendarDays',
    featureFlagKey: 'study-planner',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['exam tracker', 'exam countdown', 'exam dates', 'finals schedule'],
  },
  {
    key: 'internship-tracker',
    name: 'Internship Tracker',
    description: 'Track internship applications, interview rounds, and offer deadlines.',
    category: 'student',
    route: '/student/internships',
    icon: 'Briefcase',
    featureFlagKey: 'internships',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['internship tracker', 'internship applications', 'summer intern status'],
  },
  {
    key: 'hackathon-tracker',
    name: 'Hackathon Tracker',
    description: 'Monitor hackathon registrations, team members, project briefs, and results.',
    category: 'student',
    route: '/student/hackathons',
    icon: 'Trophy',
    featureFlagKey: 'hackathons',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['hackathons', 'coding competitions', 'hackathon submissions'],
  },
  {
    key: 'notes-to-pdf',
    name: 'Notes to PDF',
    description: 'Compile notebook snapshots and whiteboard photos into structured study PDFs.',
    category: 'student',
    route: '/tools/multiple-images-to-pdf',
    icon: 'Layers',
    featureFlagKey: 'image-to-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['notes to pdf', 'notebook scan', 'lecture slides to pdf'],
  },

  // =========================================================================
  // 5. CAREER TOOLS
  // =========================================================================
  {
    key: 'resume-builder',
    name: 'Resume Builder',
    description: 'ATS-friendly resume generator with live paper preview and vector PDF export.',
    category: 'career',
    route: '/student/resume',
    icon: 'FileText',
    featureFlagKey: 'resume-builder',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['resume builder', 'cv maker', 'ats resume', 'student resume', 'resume live preview'],
  },
  {
    key: 'cover-letter',
    name: 'Cover Letter Builder',
    description: 'Tailor professional job application cover letters with formatted PDF export.',
    category: 'career',
    route: '/student/cover-letter',
    icon: 'FileText',
    featureFlagKey: 'cover-letter',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    keywords: ['cover letter builder', 'job application letter', 'internship cover letter'],
  },
  {
    key: 'job-tracker',
    name: 'Job Application Tracker',
    description: 'Kanban board for job search pipeline from applied to interview and offer.',
    category: 'career',
    route: '/student/jobs',
    icon: 'Briefcase',
    featureFlagKey: 'internships',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['job tracker', 'application tracking', 'job search kanban'],
  },
  {
    key: 'interview-prep',
    name: 'Interview Preparation Hub',
    description: 'Question bank and practice guidelines for behavioral and technical interviews.',
    category: 'career',
    route: '/student/interviews',
    icon: 'Briefcase',
    featureFlagKey: 'ai-copilot',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['interview prep', 'technical questions', 'behavioral interview'],
  },
  {
    key: 'skill-gap-analyzer',
    name: 'Skill Gap Analysis',
    description: 'Compare your career profile skills against target job description requirements.',
    category: 'career',
    route: '/student/skills',
    icon: 'Sliders',
    featureFlagKey: 'ai-copilot',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['skill gap', 'career skills', 'job requirements match'],
  },
  {
    key: 'ats-analyzer',
    name: 'ATS Keyword Scanner',
    description: 'Audit resume keyword density and formatting compatibility for ATS filters.',
    category: 'career',
    route: '/student/ats',
    icon: 'Search',
    featureFlagKey: 'resume-builder',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['ats analyzer', 'resume score', 'applicant tracking system keywords'],
  },

  // =========================================================================
  // 6. AI & OCR TOOLS
  // =========================================================================
  {
    key: 'student-copilot',
    name: 'AI Student Copilot',
    description: 'Intelligent assistant grounded in your academic records with deterministic facts.',
    category: 'ai',
    route: '/student/copilot',
    icon: 'Sparkles',
    featureFlagKey: 'ai-copilot',
    defaultAccess: 'SUBSCRIPTION',
    status: 'available',
    popular: true,
    badge: 'AI',
    keywords: ['ai copilot', 'student ai', 'study assistant ai', 'academic copilot'],
  },
  {
    key: 'copilot-interview',
    name: 'AI Mock Interview Coach',
    description: 'Role-specific simulated interview practice with instant constructive feedback.',
    category: 'ai',
    route: '/student/copilot/interview',
    icon: 'Briefcase',
    featureFlagKey: 'ai-copilot',
    defaultAccess: 'SUBSCRIPTION',
    status: 'available',
    popular: true,
    badge: 'AI',
    keywords: ['mock interview ai', 'interview coach', 'ai interview simulation'],
  },
  {
    key: 'ocr-image',
    name: 'Image to Text (OCR)',
    description: 'Extract editable text from document photos, scans, and screenshots with high accuracy.',
    category: 'ai',
    route: '/tools/ocr-image',
    icon: 'FileText',
    featureFlagKey: 'ocr-image',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    badge: 'OCR',
    keywords: ['ocr image', 'extract text from image', 'photo to text', 'scan to text'],
  },
  {
    key: 'ocr-pdf',
    name: 'Scanned PDF to Text (OCR)',
    description: 'Extract text from scanned PDF documents or generate searchable PDF files.',
    category: 'ai',
    route: '/tools/ocr-pdf',
    icon: 'FileSearch',
    featureFlagKey: 'ocr-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: true,
    badge: 'OCR',
    keywords: ['ocr pdf', 'scanned pdf to text', 'searchable pdf', 'extract pdf text'],
  },
  {
    key: 'document-summary',
    name: 'Document Summarizer',
    description: 'Generate concise executive summaries and bullet points from long study texts.',
    category: 'ai',
    route: '/tools/document-summary',
    icon: 'Sparkles',
    featureFlagKey: 'ai-copilot',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    badge: 'AI',
    keywords: ['document summary', 'summarize pdf', 'notes summary', 'ai tldr'],
  },
  {
    key: 'document-qa',
    name: 'Ask This Document',
    description: 'Ask questions and receive instant answers with citations from your uploaded text.',
    category: 'ai',
    route: '/tools/document-qa',
    icon: 'MessageSquare',
    featureFlagKey: 'ai-copilot',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    badge: 'AI Q&A',
    keywords: ['ask document', 'chat with pdf', 'document qa', 'query document'],
  },
];

// Pre-indexed lookup maps for instant O(1) queries without main-thread linear scans
export const CANONICAL_TOOL_MAP = new Map<string, CanonicalTool>();

// Aliases for common tool key variants
const TOOL_KEY_ALIASES: Record<string, string> = {
  pdf_compress: 'compress-pdf',
  compress_pdf: 'compress-pdf',
  pdf_merge: 'merge-pdf',
  merge_pdf: 'merge-pdf',
  pdf_split: 'split-pdf',
  split_pdf: 'split-pdf',
  pdf_protect: 'protect-pdf',
  protect_pdf: 'protect-pdf',
  pdf_unlock: 'unlock-pdf',
  unlock_pdf: 'unlock-pdf',
  sgpa_calc: 'sgpa-calculator',
  cgpa_calc: 'cgpa-calculator',
};

for (const tool of CANONICAL_TOOL_REGISTRY) {
  CANONICAL_TOOL_MAP.set(tool.key, tool);
  // Also index snake_case version
  const snakeKey = tool.key.replace(/-/g, '_');
  CANONICAL_TOOL_MAP.set(snakeKey, tool);

  if (tool.featureFlagKey && !CANONICAL_TOOL_MAP.has(tool.featureFlagKey)) {
    CANONICAL_TOOL_MAP.set(tool.featureFlagKey, tool);
    CANONICAL_TOOL_MAP.set(tool.featureFlagKey.replace(/-/g, '_'), tool);
  }
}

// Index aliases
for (const [alias, canonicalKey] of Object.entries(TOOL_KEY_ALIASES)) {
  const tool = CANONICAL_TOOL_MAP.get(canonicalKey);
  if (tool) {
    CANONICAL_TOOL_MAP.set(alias, tool);
    CANONICAL_TOOL_MAP.set(alias.replace(/_/g, '-'), tool);
  }
}

const CATEGORY_TOOLS_CACHE = new Map<CanonicalToolCategory, CanonicalTool[]>();
for (const cat of CANONICAL_TOOL_CATEGORIES) {
  CATEGORY_TOOLS_CACHE.set(
    cat.id,
    Object.freeze(CANONICAL_TOOL_REGISTRY.filter((t) => t.category === cat.id)) as CanonicalTool[]
  );
}

const ROUTE_TOOLS_CACHE = new Map<string, CanonicalTool>();
for (const tool of CANONICAL_TOOL_REGISTRY) {
  ROUTE_TOOLS_CACHE.set(tool.route, tool);
}

/**
 * Normalizes any tool key variant to its canonical snake_case tool_key.
 * E.g. "pdf-to-jpg" -> "pdf_to_jpg", "compress-pdf" -> "pdf_compress" or canonical form.
 */
export function normalizeToolKey(rawKey: string): string {
  if (!rawKey) return '';
  const trimmed = rawKey.trim().toLowerCase();
  const matched = CANONICAL_TOOL_MAP.get(trimmed);
  if (matched) {
    return matched.key.replace(/-/g, '_');
  }
  return trimmed.replace(/-/g, '_');
}

/**
 * Returns canonical tool definition for any valid key (kebab, snake, route, flag).
 */
export function getCanonicalToolByKey(key: string): CanonicalTool | undefined {
  if (!key) return undefined;
  const clean = key.trim().toLowerCase();
  return CANONICAL_TOOL_MAP.get(clean) || CANONICAL_TOOL_MAP.get(clean.replace(/-/g, '_')) || CANONICAL_TOOL_MAP.get(clean.replace(/_/g, '-'));
}

export function getAllCanonicalTools(): CanonicalTool[] {
  return CANONICAL_TOOL_REGISTRY;
}

export function getCanonicalToolByRoute(route: string): CanonicalTool | undefined {
  return ROUTE_TOOLS_CACHE.get(route);
}

export function getCanonicalToolsByCategory(category: CanonicalToolCategory): CanonicalTool[] {
  return CATEGORY_TOOLS_CACHE.get(category) || [];
}

export interface ResolvedToolState {
  tool: CanonicalTool;
  isEnabled: boolean;
  status: FeatureFlagStatus;
  accessMode: FeatureAccessMode;
  isSubscription: boolean;
}

/**
 * Resolves a canonical tool against runtime feature flag configuration.
 * If feature flag is disabled, isEnabled = false.
 * If feature flag accessMode is SUBSCRIPTION, isSubscription = true.
 */
export function resolveToolState(
  tool: CanonicalTool,
  flag?: FeatureFlag | null
): ResolvedToolState {
  if (!flag) {
    return {
      tool,
      isEnabled: tool.status === 'available' || tool.status === 'beta',
      status: 'ENABLED',
      accessMode: tool.defaultAccess,
      isSubscription: tool.defaultAccess === 'SUBSCRIPTION',
    };
  }

  const isEnabled = flag.status === 'ENABLED' || flag.status === 'BETA';
  const accessMode = flag.accessMode || tool.defaultAccess;

  return {
    tool,
    isEnabled,
    status: flag.status,
    accessMode,
    isSubscription: accessMode === 'SUBSCRIPTION',
  };
}

/**
 * Filter tools that are actively enabled for display across Navbar, Search, and Catalog.
 */
export function getActiveTools(
  category?: CanonicalToolCategory,
  featureMap?: Record<string, FeatureFlag>
): CanonicalTool[] {
  const list = category ? getCanonicalToolsByCategory(category) : CANONICAL_TOOL_REGISTRY;

  if (!featureMap) return list;

  return list.filter((tool) => {
    const flag = featureMap[tool.featureFlagKey] || featureMap[tool.key];
    if (!flag) return true;
    return flag.status !== 'DISABLED';
  });
}
