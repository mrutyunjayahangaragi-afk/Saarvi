// Authoritative Server Feature Flag & Access Control Store
// Single source of truth for platform feature availability, accessMode (FREE vs SUBSCRIPTION), and runtime gating.

import { FeatureFlag, FeatureFlagStatus, FeatureAccessMode } from '@/types/admin';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  // =========================================================================
  // 1. CORE DOCUMENT UTILITIES (Image & PDF)
  // =========================================================================
  {
    id: 'jpg-to-pdf',
    key: 'jpg_to_pdf',
    name: 'JPG to PDF',
    description: 'Convert JPG photos into standard PDF documents entirely in browser.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/jpg-to-pdf',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'pdf-to-jpg',
    key: 'pdf_to_jpg',
    name: 'PDF to JPG',
    description: 'Render and extract high-resolution JPG images from PDF pages locally.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/pdf-to-jpg',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'png-to-jpg',
    key: 'png_to_jpg',
    name: 'PNG to JPG',
    description: 'Convert transparent PNG graphics into lightweight JPG images.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/png-to-jpg',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'jpg-to-png',
    key: 'jpg_to_png',
    name: 'JPG to PNG',
    description: 'Convert compressed JPG files into lossless PNG format.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/jpg-to-png',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'image-to-pdf',
    key: 'image_to_pdf',
    name: 'Image to PDF',
    description: 'Combine multiple image formats into a single organized PDF.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/image-to-pdf',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'pdf-to-png',
    key: 'pdf_to_png',
    name: 'PDF to PNG',
    description: 'Render high-definition lossless PNG graphics from PDF pages.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/pdf-to-png',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'merge-pdf',
    key: 'merge_pdf',
    name: 'Merge PDF',
    description: 'Concatenate multiple PDF documents in client browser memory.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/merge-pdf',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'split-pdf',
    key: 'split_pdf',
    name: 'Split PDF',
    description: 'Extract specific pages or page ranges into separate files.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/split-pdf',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'compress-pdf',
    key: 'compress_pdf',
    name: 'Compress PDF',
    description: 'Optimize PDF file size without sacrificing readability.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/compress-pdf',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'compress-image',
    key: 'compress_image',
    name: 'Compress Image',
    description: 'Reduce image file size with intelligent client-side compression.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/compress-image',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'resize-image',
    key: 'resize_image',
    name: 'Resize Image',
    description: 'Scale image dimensions with precise width and height controls.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/resize-image',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'crop-image',
    key: 'crop_image',
    name: 'Crop Image',
    description: 'Crop and reframe photos with preset aspect ratios.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/crop-image',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'organize-pdf',
    key: 'organize_pdf',
    name: 'Organize PDF',
    description: 'Reorder, rotate, or delete individual pages visually.',
    category: 'tools',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/tools/organize-pdf',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },

  // =========================================================================
  // 2. STUDENT ACADEMIC & PRODUCTIVITY UTILITIES
  // =========================================================================
  {
    id: 'sgpa-calculator',
    key: 'sgpa_calculator',
    name: 'SGPA Calculator',
    description: 'Deterministic semester SGPA calculation for VTU and supported universities.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/sgpa-calculator',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'cgpa-calculator',
    key: 'cgpa_calculator',
    name: 'CGPA Calculator',
    description: 'Cumulative Grade Point Average engine with official percentage conversion.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/cgpa-calculator',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'marks-calculator',
    key: 'marks_calculator',
    name: 'Marks Calculator',
    description: 'Internal CIE & SEE marks analyzer with pass/fail threshold breakdown.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/marks-calculator',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'attendance',
    key: 'attendance',
    name: 'Attendance Planner',
    description: 'Target attendance tracker with class margin safety forecasts.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/attendance',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'timetable',
    key: 'timetable',
    name: 'Smart Timetable',
    description: 'Weekly schedule planner with conflict detection and subject slots.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/timetable',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'assignment-planner',
    key: 'assignment_planner',
    name: 'Assignment Planner',
    description: 'Priority-based assignment submission organizer with deadline tracking.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/assignment-planner',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'study-planner',
    key: 'study_planner',
    name: 'Study Planner',
    description: 'Exam preparation timeline with task milestone management.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/study-planner',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'certificates',
    key: 'certificates',
    name: 'Certificate Vault',
    description: 'Secure local storage and categorization for academic credentials.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/certificates',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'internships',
    key: 'internships',
    name: 'Internship Tracker',
    description: 'Application funnel tracking and interview milestone registry.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/internships',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'hackathons',
    key: 'hackathons',
    name: 'Hackathon Tracker',
    description: 'Team formation, submission deadlines, and project registry.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/hackathons',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'resume-builder',
    key: 'resume_builder',
    name: 'ATS Resume Builder',
    description: 'Local-first ATS resume creator with real-time live preview.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/resume',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'cover-letter',
    key: 'cover_letter',
    name: 'Cover Letter Builder',
    description: 'Role-targeted professional cover letter creator with PDF export.',
    category: 'student',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/student/cover-letter',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },

  // =========================================================================
  // 3. PRO / FUTURE / AI & OCR MODULES
  // =========================================================================
  {
    id: 'pro-tier',
    key: 'pro_tier',
    name: 'Saarvi Pro Subscriptions',
    description: 'Premium subscription tier with elevated batch and processing limits.',
    category: 'future',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'SUBSCRIPTION',
    route: '/pricing',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'ocr-image',
    key: 'ocr_image',
    name: 'OCR Image Text Extractor',
    description: 'High-accuracy OCR text extraction from document images.',
    category: 'future',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'SUBSCRIPTION',
    route: '/tools/ocr-image',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'ocr-pdf',
    key: 'ocr_pdf',
    name: 'OCR PDF Text Extractor',
    description: 'High-accuracy OCR text extraction from scanned multi-page PDFs.',
    category: 'future',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'SUBSCRIPTION',
    route: '/tools/ocr-pdf',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'ai-copilot',
    key: 'ai_copilot',
    name: 'AI Document & Academic Copilot',
    description: 'Decoupled intelligent assistant for document summarization and study explain.',
    category: 'future',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'SUBSCRIPTION',
    route: '/student/copilot',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },

  // =========================================================================
  // 4. BILLING & MONETIZATION
  // =========================================================================
  {
    id: 'manual-upi',
    key: 'manual_upi',
    name: 'Manual UPI Pro Payments',
    description: 'Direct UPI payments via PhonePe, Google Pay, Paytm, QR scan with authoritative verification.',
    category: 'billing',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/pricing',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'razorpay-gateway',
    key: 'razorpay_gateway',
    name: 'Razorpay Payment Gateway (Coming Soon)',
    description: 'Automated card, netbanking, and recurring subscription gateway integration (Coming Soon).',
    category: 'billing',
    status: 'DISABLED',
    enabled: false,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/pricing',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },

  // =========================================================================
  // 5. GLOBAL PLATFORM CAPABILITIES
  // =========================================================================
  {
    id: 'advertising-enabled',
    key: 'advertising_enabled',
    name: 'Admin-Controlled Promotional Gate',
    description: 'Enables promotional advertisement gate for non-paying visitors before entering Saarvi.',
    category: 'advertising',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/admin/advertising',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'ai-assistant-enabled',
    key: 'ai_assistant_enabled',
    name: 'Global AI Tool Discovery Assistant',
    description: 'Floating Saarvi AI assistant for canonical tool lookup and quick navigation.',
    category: 'ai',
    status: 'ENABLED',
    enabled: true,
    visibility: 'visible',
    accessMode: 'FREE',
    route: '/',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
];

// In-memory runtime cache for server-side execution
const runtimeFlags: Map<string, FeatureFlag> = new Map();

function initRuntimeFlags(): void {
  if (runtimeFlags.size === 0) {
    DEFAULT_FEATURE_FLAGS.forEach((f) => {
      runtimeFlags.set(f.id, { ...f });
      if (f.key) {
        runtimeFlags.set(f.key, { ...f });
      }
    });

    // Merge persistent tool overrides from storage if available
    try {
      const overrides = MockStorageProvider.getToolOverrides();
      Object.entries(overrides).forEach(([slug, override]) => {
        const existing = runtimeFlags.get(slug);
        if (existing) {
          const status = override.status as FeatureFlagStatus;
          const accessMode: FeatureAccessMode = override.requiresPro
            ? 'SUBSCRIPTION'
            : override.accessMode || existing.accessMode || 'FREE';
          const updated: FeatureFlag = {
            ...existing,
            status: status || existing.status,
            enabled: status !== 'DISABLED' && status !== 'MAINTENANCE',
            accessMode,
            visibility: override.hidden ? 'hidden' : 'visible',
            updatedAt: override.updatedAt || existing.updatedAt,
            updatedBy: override.updatedBy || existing.updatedBy,
          };
          runtimeFlags.set(slug, updated);
          if (existing.key) runtimeFlags.set(existing.key, updated);
        }
      });
    } catch {
      // Storage unavailable in isolated test runs, fallback to defaults
    }
  }
}

export const featureServerStore = {
  getAllFeatures(): FeatureFlag[] {
    initRuntimeFlags();
    const uniqueMap = new Map<string, FeatureFlag>();
    runtimeFlags.forEach((flag) => {
      uniqueMap.set(flag.id, flag);
    });
    return Array.from(uniqueMap.values());
  },

  getFeature(idOrKey: string): FeatureFlag | undefined {
    initRuntimeFlags();
    const normalized = idOrKey.toLowerCase().trim();
    const direct = runtimeFlags.get(normalized);
    if (direct) return direct;

    const altKey = normalized.replace(/-/g, '_');
    const byAlt = runtimeFlags.get(altKey);
    if (byAlt) return byAlt;

    const hyphenated = normalized.replace(/_/g, '-');
    return runtimeFlags.get(hyphenated);
  },

  isFeatureEnabled(idOrKey: string): boolean {
    const feature = this.getFeature(idOrKey);
    if (!feature) return false;
    return feature.status === 'ENABLED' || feature.status === 'BETA';
  },

  getFeatureAccessMode(idOrKey: string): FeatureAccessMode {
    const feature = this.getFeature(idOrKey);
    return feature?.accessMode || 'FREE';
  },

  updateFeature(
    id: string,
    updates: Partial<Pick<FeatureFlag, 'status' | 'accessMode' | 'visibility' | 'name' | 'description'>>,
    actor: { id: string; email: string; role: string }
  ): FeatureFlag {
    initRuntimeFlags();
    const existing = this.getFeature(id);
    if (!existing) {
      throw new Error(`Feature flag "${id}" not found.`);
    }

    const previousStatus = existing.status;
    const previousAccessMode = existing.accessMode || 'FREE';

    const newStatus = updates.status !== undefined ? updates.status : existing.status;
    const newAccessMode = updates.accessMode !== undefined ? updates.accessMode : previousAccessMode;
    const newVisibility = updates.visibility !== undefined ? updates.visibility : existing.visibility || 'visible';

    const isNowEnabled = newStatus === 'ENABLED' || newStatus === 'BETA';

    const updated: FeatureFlag = {
      ...existing,
      ...updates,
      status: newStatus,
      enabled: isNowEnabled,
      accessMode: newAccessMode,
      visibility: newVisibility,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email,
    };

    // Update in-memory cache
    runtimeFlags.set(existing.id, updated);
    if (existing.key) runtimeFlags.set(existing.key, updated);

    // Sync to tool overrides in resilient storage
    try {
      MockStorageProvider.saveToolOverride({
        id: existing.id,
        name: updated.name,
        status: newStatus === 'ENABLED' ? 'AVAILABLE' : (newStatus as any),
        requiresPro: newAccessMode === 'SUBSCRIPTION',
        accessMode: newAccessMode,
        hidden: newVisibility === 'hidden',
        updatedAt: updated.updatedAt,
        updatedBy: actor.email,
      });
    } catch {
      // Storage sync safe fallback
    }

    // Safe Audit Logging
    try {
      let action = 'FEATURE_UPDATED';
      if (previousStatus !== newStatus) {
        action = newStatus === 'DISABLED' ? 'FEATURE_DISABLED' : 'FEATURE_ENABLED';
      } else if (previousAccessMode !== newAccessMode) {
        action = 'ACCESS_MODE_CHANGED';
      }

      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action,
        targetType: 'FEATURE',
        targetId: existing.id,
        metadata: {
          featureName: existing.name,
          previousStatus,
          newStatus,
          previousAccessMode,
          newAccessMode,
          visibility: newVisibility,
        },
      });
    } catch {
      // Audit log fallback
    }

    return updated;
  },

  resetToDefaults(actor: { id: string; email: string; role: string }): FeatureFlag[] {
    runtimeFlags.clear();
    DEFAULT_FEATURE_FLAGS.forEach((f) => {
      runtimeFlags.set(f.id, { ...f });
      if (f.key) runtimeFlags.set(f.key, { ...f });
    });

    try {
      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action: 'FEATURE_FLAGS_RESET_DEFAULT',
        targetType: 'FEATURE',
        targetId: 'all',
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch {}

    return this.getAllFeatures();
  },

  getAggregateMetrics() {
    const all = this.getAllFeatures();
    const active = all.filter((f) => f.status === 'ENABLED' || f.status === 'BETA').length;
    const disabled = all.filter((f) => f.status === 'DISABLED').length;
    const maintenance = all.filter((f) => f.status === 'MAINTENANCE').length;
    const free = all.filter((f) => f.accessMode === 'FREE').length;
    const subscription = all.filter((f) => f.accessMode === 'SUBSCRIPTION').length;
    const toolsCount = all.filter((f) => f.category === 'tools').length;
    const studentToolsCount = all.filter((f) => f.category === 'student').length;

    return {
      total: all.length,
      active,
      disabled,
      maintenance,
      free,
      subscription,
      toolsCount,
      studentToolsCount,
    };
  },
};
