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
  route: string;             // Direct URL route
  icon: string;              // Lucide icon name
  featureFlagKey: string;    // Corresponding feature flag key in authoritative store
  defaultAccess: FeatureAccessMode; // "FREE" | "SUBSCRIPTION"
  status: 'available' | 'coming_soon' | 'beta';
  badge?: string;
  popular?: boolean;
  keywords?: string[];
}

export const CANONICAL_TOOL_REGISTRY: CanonicalTool[] = [
  // =========================================================================
  // 1. PDF TOOLS
  // =========================================================================
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
  {
    key: 'watermark-pdf',
    name: 'Watermark PDF',
    description: 'Apply custom text watermarks, confidential stamps, or draft marks on PDFs.',
    category: 'pdf',
    route: '/tools/watermark-pdf',
    icon: 'FileText',
    featureFlagKey: 'organize-pdf',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['watermark pdf', 'confidential stamp', 'branding on pdf'],
  },

  // =========================================================================
  // 2. IMAGE TOOLS
  // =========================================================================
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
  {
    key: 'svg-to-png',
    name: 'SVG to PNG',
    description: 'Rasterize vector SVG files into crisp PNG images at any desired resolution.',
    category: 'image',
    route: '/tools/svg-to-png',
    icon: 'FileType',
    featureFlagKey: 'jpg-to-png',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['svg to png', 'vector to raster', 'convert svg graphic'],
  },
  {
    key: 'heic-to-jpg',
    name: 'HEIC to JPG',
    description: 'Convert iPhone HEIC photos into widely compatible JPG images.',
    category: 'image',
    route: '/tools/heic-to-jpg',
    icon: 'Camera',
    featureFlagKey: 'png-to-jpg',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['heic to jpg', 'apple photo convert', 'iphone picture to jpeg'],
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
  {
    key: 'academic-goals',
    name: 'Academic Goals',
    description: 'Set target CGPAs and calculate exact required SGPAs for remaining semesters.',
    category: 'academic',
    route: '/student/goals',
    icon: 'Trophy',
    featureFlagKey: 'sgpa-calculator',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['academic goals', 'target cgpa', 'cgpa planner', 'semester targets'],
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
    key: 'assignment-tracker',
    name: 'Assignment Tracker',
    description: 'Manage coursework submissions, priority deadlines, and completion states.',
    category: 'student',
    route: '/student/assignments',
    icon: 'FileCheck2',
    featureFlagKey: 'assignment-planner',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['assignment tracker', 'homework deadlines', 'project submissions'],
  },
  {
    key: 'certificate-manager',
    name: 'Certificate Locker',
    description: 'Store, categorize, and tag academic and extracurricular credentials locally.',
    category: 'student',
    route: '/student/certificates',
    icon: 'Award',
    featureFlagKey: 'certificates',
    defaultAccess: 'FREE',
    status: 'available',
    popular: false,
    keywords: ['certificate locker', 'diplomas', 'course certificates', 'credentials vault'],
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

// Helper query functions
export function getAllCanonicalTools(): CanonicalTool[] {
  return CANONICAL_TOOL_REGISTRY;
}

export function getCanonicalToolByKey(key: string): CanonicalTool | undefined {
  return CANONICAL_TOOL_REGISTRY.find((t) => t.key === key || t.featureFlagKey === key);
}

export function getCanonicalToolByRoute(route: string): CanonicalTool | undefined {
  return CANONICAL_TOOL_REGISTRY.find((t) => t.route === route);
}

export function getCanonicalToolsByCategory(category: CanonicalToolCategory): CanonicalTool[] {
  return CANONICAL_TOOL_REGISTRY.filter((t) => t.category === category);
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
