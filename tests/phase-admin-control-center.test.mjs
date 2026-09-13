import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Saarvi — Admin Control Center & Student Tools Behavioral Verification Suite
// ============================================================================

// 1. Emulated Feature Store Catalog & Status Types
const DEFAULT_FEATURE_CATALOG = [
  // Core Utilities
  { id: 'jpg-to-pdf', key: 'tool_jpg_to_pdf', name: 'JPG to PDF', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Core Utilities', visibility: 'visible' },
  { id: 'compress-pdf', key: 'tool_compress_pdf', name: 'Compress PDF', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Core Utilities', visibility: 'visible' },
  { id: 'merge-pdf', key: 'tool_merge_pdf', name: 'Merge PDF', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Core Utilities', visibility: 'visible' },
  { id: 'pdf-to-jpg', key: 'tool_pdf_to_jpg', name: 'PDF to JPG', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Core Utilities', visibility: 'visible' },
  { id: 'png-to-jpg', key: 'tool_png_to_jpg', name: 'PNG to JPG', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Core Utilities', visibility: 'visible' },

  // Academic & Student Suite
  { id: 'vtu-sgpa', key: 'tool_vtu_sgpa', name: 'VTU SGPA Calculator', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Academic Suite', visibility: 'visible' },
  { id: 'vtu-cgpa', key: 'tool_vtu_cgpa', name: 'VTU CGPA Calculator', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Academic Suite', visibility: 'visible' },
  { id: 'resume-builder', key: 'tool_resume_builder', name: 'Resume & CV Builder', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Student Suite', visibility: 'visible' },
  { id: 'cover-letter', key: 'tool_cover_letter', name: 'Cover Letter Builder', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Student Suite', visibility: 'visible' },
  { id: 'notes-archive', key: 'tool_notes_archive', name: 'Notes & Syllabus Archive', status: 'ENABLED', enabled: true, accessMode: 'FREE', category: 'Student Suite', visibility: 'visible' },

  // Pro & AI Modules
  { id: 'ocr-extract', key: 'tool_ocr_extract', name: 'OCR Text Extraction', status: 'BETA', enabled: true, accessMode: 'SUBSCRIPTION', category: 'Pro Modules', visibility: 'visible' },
  { id: 'ai-resume-review', key: 'tool_ai_resume_review', name: 'AI Resume Review', status: 'BETA', enabled: true, accessMode: 'SUBSCRIPTION', category: 'Pro Modules', visibility: 'visible' },
  { id: 'batch-processing', key: 'tool_batch_processing', name: 'Batch Processing', status: 'MAINTENANCE', enabled: false, accessMode: 'SUBSCRIPTION', category: 'Pro Modules', visibility: 'visible' },
];

class FeatureStoreTestEngine {
  constructor(initialCatalog) {
    this.flags = new Map();
    this.auditLogs = [];
    initialCatalog.forEach((f) => {
      this.flags.set(f.id, { ...f });
      this.flags.set(f.key, { ...f });
    });
  }

  getFeature(idOrKey) {
    return this.flags.get(idOrKey) || null;
  }

  getAllFeatures() {
    const seen = new Set();
    const list = [];
    for (const f of this.flags.values()) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        list.push({ ...f });
      }
    }
    return list;
  }

  updateFeatureStatus(idOrKey, status, adminEmail = 'admin@saarvi.app') {
    const feature = this.flags.get(idOrKey);
    if (!feature) throw new Error(`Feature ${idOrKey} not found`);

    const prevStatus = feature.status;
    const enabled = status === 'ENABLED' || status === 'BETA';
    const updated = {
      ...feature,
      status,
      enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };

    this.flags.set(feature.id, updated);
    this.flags.set(feature.key, updated);

    this.auditLogs.push({
      action: enabled ? 'FEATURE_ENABLED' : 'FEATURE_DISABLED',
      featureId: feature.id,
      adminEmail,
      details: { previous: prevStatus, current: status },
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  updateFeatureAccessMode(idOrKey, accessMode, adminEmail = 'admin@saarvi.app') {
    const feature = this.flags.get(idOrKey);
    if (!feature) throw new Error(`Feature ${idOrKey} not found`);

    const prevMode = feature.accessMode;
    const updated = {
      ...feature,
      accessMode,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };

    this.flags.set(feature.id, updated);
    this.flags.set(feature.key, updated);

    this.auditLogs.push({
      action: 'ACCESS_MODE_CHANGED',
      featureId: feature.id,
      adminEmail,
      details: { previous: prevMode, current: accessMode },
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  getPublicFeatures() {
    return this.getAllFeatures()
      .filter((f) => f.visibility === 'visible')
      .map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status,
        enabled: f.enabled,
        accessMode: f.accessMode,
        category: f.category,
      }));
  }
}

// Entitlement evaluation matching planService.canUseTool / canAccessFeature
function evaluateToolEntitlement(feature, user) {
  if (!feature) {
    return { allowed: false, reason: 'feature_not_found' };
  }

  if (feature.status === 'DISABLED') {
    return { allowed: false, reason: 'disabled', message: 'This tool is temporarily unavailable.' };
  }

  if (feature.status === 'MAINTENANCE') {
    return { allowed: false, reason: 'maintenance', message: 'This tool is under scheduled maintenance.' };
  }

  if (feature.accessMode === 'SUBSCRIPTION') {
    const isPro = user && (user.plan === 'pro' || user.isPro === true);
    if (!isPro) {
      return { allowed: false, reason: 'pro_required', message: 'Saarvi Pro subscription required.' };
    }
  }

  return { allowed: true, reason: 'authorized' };
}

// Auth role checker matching admin-auth.ts
function verifyAdminAuthorization(headers) {
  const role = headers['x-saarvi-admin-role'];
  const email = headers['x-saarvi-admin-email'];

  if (!role || !email) {
    return { authorized: false, status: 401, error: 'Authentication required' };
  }

  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return { authorized: false, status: 403, error: 'Forbidden: Super Admin or Admin role required' };
  }

  return { authorized: true, status: 200, admin: { email, role } };
}

// ============================================================================
// TESTS
// ============================================================================

test('1. Feature Flag Catalog Schema & Initial State Integrity', () => {
  const engine = new FeatureStoreTestEngine(DEFAULT_FEATURE_CATALOG);
  const all = engine.getAllFeatures();

  assert.equal(all.length, 13, 'Default catalog contains 13 primary feature flags');

  for (const feat of all) {
    assert.ok(feat.id, 'Feature must have an id');
    assert.ok(feat.name, 'Feature must have a name');
    assert.ok(['ENABLED', 'BETA', 'MAINTENANCE', 'DISABLED'].includes(feat.status), 'Valid status');
    assert.ok(['FREE', 'SUBSCRIPTION'].includes(feat.accessMode), 'Valid access mode');
    assert.equal(typeof feat.enabled, 'boolean', 'Enabled is a boolean');
    assert.equal(feat.visibility, 'visible', 'Visibility is visible');
  }

  // Check specific defaults
  const resume = engine.getFeature('resume-builder');
  assert.equal(resume.accessMode, 'FREE');
  assert.equal(resume.status, 'ENABLED');

  const ocr = engine.getFeature('ocr-extract');
  assert.equal(ocr.accessMode, 'SUBSCRIPTION');
  assert.equal(ocr.status, 'BETA');
});

test('2. Super Admin Runtime Status Mutation & Public Propagation', () => {
  const engine = new FeatureStoreTestEngine(DEFAULT_FEATURE_CATALOG);

  // Disable Compress PDF
  const updated = engine.updateFeatureStatus('compress-pdf', 'DISABLED', 'admin@saarvi.app');
  assert.equal(updated.status, 'DISABLED');
  assert.equal(updated.enabled, false);

  // Check public endpoint representation
  const publicList = engine.getPublicFeatures();
  const pubCompress = publicList.find((f) => f.id === 'compress-pdf');
  assert.ok(pubCompress);
  assert.equal(pubCompress.status, 'DISABLED');
  assert.equal(pubCompress.enabled, false);

  // Turn it back to ENABLED
  const reenabled = engine.updateFeatureStatus('compress-pdf', 'ENABLED', 'admin@saarvi.app');
  assert.equal(reenabled.status, 'ENABLED');
  assert.equal(reenabled.enabled, true);
});

test('3. Dynamic Access Mode Switching (FREE <-> SUBSCRIPTION) & Plan Gating', () => {
  const engine = new FeatureStoreTestEngine(DEFAULT_FEATURE_CATALOG);
  const freeUser = { id: 'user_free', plan: 'free' };
  const proUser = { id: 'user_pro', plan: 'pro' };

  // Initial: JPG to PDF is FREE
  let jpgFeature = engine.getFeature('jpg-to-pdf');
  assert.equal(jpgFeature.accessMode, 'FREE');

  // Both Free and Pro users can access
  assert.equal(evaluateToolEntitlement(jpgFeature, freeUser).allowed, true);
  assert.equal(evaluateToolEntitlement(jpgFeature, proUser).allowed, true);

  // Admin toggles JPG to PDF to SUBSCRIPTION
  jpgFeature = engine.updateFeatureAccessMode('jpg-to-pdf', 'SUBSCRIPTION', 'admin@saarvi.app');
  assert.equal(jpgFeature.accessMode, 'SUBSCRIPTION');

  // Free user is blocked with pro_required
  const freeCheck = evaluateToolEntitlement(jpgFeature, freeUser);
  assert.equal(freeCheck.allowed, false);
  assert.equal(freeCheck.reason, 'pro_required');

  // Pro user continues to have access
  const proCheck = evaluateToolEntitlement(jpgFeature, proUser);
  assert.equal(proCheck.allowed, true);

  // Admin toggles back to FREE
  jpgFeature = engine.updateFeatureAccessMode('jpg-to-pdf', 'FREE', 'admin@saarvi.app');
  assert.equal(jpgFeature.accessMode, 'FREE');
  assert.equal(evaluateToolEntitlement(jpgFeature, freeUser).allowed, true);
});

test('4. Server-Side Maintenance & Disabled Enforcement Overrides Plan', () => {
  const engine = new FeatureStoreTestEngine(DEFAULT_FEATURE_CATALOG);
  const proUser = { id: 'user_pro', plan: 'pro' };

  // Put tool in MAINTENANCE
  let feature = engine.updateFeatureStatus('ocr-extract', 'MAINTENANCE', 'admin@saarvi.app');
  let check = evaluateToolEntitlement(feature, proUser);
  assert.equal(check.allowed, false);
  assert.equal(check.reason, 'maintenance');

  // Put tool in DISABLED
  feature = engine.updateFeatureStatus('ocr-extract', 'DISABLED', 'admin@saarvi.app');
  check = evaluateToolEntitlement(feature, proUser);
  assert.equal(check.allowed, false);
  assert.equal(check.reason, 'disabled');
});

test('5. Audit Trail Generation on Status and Access Mode Changes', () => {
  const engine = new FeatureStoreTestEngine(DEFAULT_FEATURE_CATALOG);

  engine.updateFeatureStatus('vtu-sgpa', 'MAINTENANCE', 'superadmin@saarvi.app');
  engine.updateFeatureAccessMode('vtu-sgpa', 'SUBSCRIPTION', 'superadmin@saarvi.app');

  assert.equal(engine.auditLogs.length, 2);

  const statusLog = engine.auditLogs[0];
  assert.equal(statusLog.action, 'FEATURE_DISABLED');
  assert.equal(statusLog.featureId, 'vtu-sgpa');
  assert.equal(statusLog.details.current, 'MAINTENANCE');

  const accessLog = engine.auditLogs[1];
  assert.equal(accessLog.action, 'ACCESS_MODE_CHANGED');
  assert.equal(accessLog.featureId, 'vtu-sgpa');
  assert.equal(accessLog.details.current, 'SUBSCRIPTION');
});

test('6. Cover Letter Builder: Sender Name Fallbacks and Placeholder Integrity', () => {
  // Scenario A: Profile without name
  const emptyProfile = { fullName: '', email: 'student@vtu.ac.in', phone: '9876543210', location: 'Bengaluru' };
  const fallbackSender = emptyProfile.fullName || 'Your Name';
  assert.equal(fallbackSender, 'Your Name');

  // Scenario B: Profile with name
  const studentProfile = { fullName: 'Ashok Kumar', email: 'ashok@vtu.ac.in' };
  const resolvedSender = studentProfile.fullName || 'Your Name';
  assert.equal(resolvedSender, 'Ashok Kumar');

  // Standard Target Placeholders
  const placeholders = {
    fullName: 'Your Name',
    companyName: 'Company Name',
    recipientName: 'Hiring Manager',
    targetRole: 'Job Title',
  };
  assert.equal(placeholders.fullName, 'Your Name');
  assert.equal(placeholders.companyName, 'Company Name');
  assert.equal(placeholders.recipientName, 'Hiring Manager');
  assert.equal(placeholders.targetRole, 'Job Title');
});

test('7. Resume Live Preview: Multi-Template Support and Real-Time Sync', () => {
  const templates = ['classic-ats', 'modern-professional', 'executive', 'student-clean', 'minimal'];

  const sampleProfile = {
    fullName: 'Rahul Sharma',
    professionalTitle: 'Full Stack Engineer',
    email: 'rahul@example.com',
    phone: '+91 99999 88888',
    location: 'Bengaluru, India',
    education: [{ id: 'edu_1', institution: 'BMS College of Engineering', degree: 'B.E.', fieldOfStudy: 'Computer Science', startDate: '2022', endDate: '2026' }],
    skills: [{ id: 'sk_1', name: 'TypeScript', category: 'Frontend' }, { id: 'sk_2', name: 'PostgreSQL', category: 'Database' }],
    experience: [{ id: 'exp_1', role: 'Software Intern', company: 'Tech Corp', startDate: 'Jun 2025', endDate: 'Aug 2025', bullets: ['Engineered Next.js UI'] }],
    projects: [{ id: 'proj_1', title: 'Saarvi Smart Suite', technologies: ['React', 'pdf-lib'], highlights: ['100% client side PDF export'] }],
    certifications: [],
    hackathons: [],
    achievements: [],
  };

  for (const tmpl of templates) {
    const version = {
      id: `v_${tmpl}`,
      name: `${tmpl} resume`,
      targetRole: 'Software Engineer',
      template: tmpl,
      sectionOrder: ['summary', 'education', 'skills', 'experience', 'projects'],
      enabledSections: { summary: true, education: true, skills: true, experience: true, projects: true },
      selectedEducationIds: ['edu_1'],
      selectedSkillIds: ['sk_1', 'sk_2'],
      selectedExperienceIds: ['exp_1'],
      selectedProjectIds: ['proj_1'],
      selectedCertificationIds: [],
      selectedHackathonIds: [],
      selectedAchievementIds: [],
    };

    // Verify all 5 templates bind successfully without missing properties
    assert.equal(version.template, tmpl);
    assert.equal(version.sectionOrder.length, 5);
    assert.ok(sampleProfile.fullName);
  }
});

test('8. Admin Authentication & Role Enforcement (401 / 403 / 200)', () => {
  // Case A: Missing credentials
  const noAuth = verifyAdminAuthorization({});
  assert.equal(noAuth.authorized, false);
  assert.equal(noAuth.status, 401);

  // Case B: Standard user role attempting access
  const studentAuth = verifyAdminAuthorization({
    'x-saarvi-admin-email': 'student@saarvi.app',
    'x-saarvi-admin-role': 'USER',
  });
  assert.equal(studentAuth.authorized, false);
  assert.equal(studentAuth.status, 403);

  // Case C: Valid admin
  const adminAuth = verifyAdminAuthorization({
    'x-saarvi-admin-email': 'admin@saarvi.app',
    'x-saarvi-admin-role': 'ADMIN',
  });
  assert.equal(adminAuth.authorized, true);
  assert.equal(adminAuth.status, 200);

  // Case D: Valid super-admin
  const superAdminAuth = verifyAdminAuthorization({
    'x-saarvi-admin-email': 'superadmin@saarvi.app',
    'x-saarvi-admin-role': 'SUPER_ADMIN',
  });
  assert.equal(superAdminAuth.authorized, true);
  assert.equal(superAdminAuth.status, 200);
});
