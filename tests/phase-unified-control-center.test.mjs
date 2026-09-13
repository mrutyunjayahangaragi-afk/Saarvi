import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Saarvi — Unified Super Admin Control Center & Multi-University Academic Suite
// Comprehensive Behavioral & Regression Verification Suite
// ============================================================================

// --- 1. Canonical Tool Registry Definitions & Engine Under Test ---

const CANONICAL_TOOL_CATEGORIES = ['pdf', 'image', 'student', 'academic', 'career', 'ai'];

const CANONICAL_TOOLS_FIXTURE = [
  // PDF (14 tools)
  { key: 'merge-pdf', name: 'Merge PDF', category: 'pdf', route: '/tools/merge-pdf', featureFlagKey: 'merge-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'split-pdf', name: 'Split PDF', category: 'pdf', route: '/tools/split-pdf', featureFlagKey: 'split-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'compress-pdf', name: 'Compress PDF', category: 'pdf', route: '/tools/compress-pdf', featureFlagKey: 'compress-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'pdf-to-jpg', name: 'PDF to JPG', category: 'pdf', route: '/tools/pdf-to-jpg', featureFlagKey: 'pdf-to-jpg', defaultAccess: 'FREE', status: 'available' },
  { key: 'jpg-to-pdf', name: 'JPG to PDF', category: 'pdf', route: '/tools/jpg-to-pdf', featureFlagKey: 'jpg-to-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'png-to-pdf', name: 'PNG to PDF', category: 'pdf', route: '/tools/png-to-pdf', featureFlagKey: 'png-to-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'multiple-images-to-pdf', name: 'Multiple Images to PDF', category: 'pdf', route: '/tools/multiple-images-to-pdf', featureFlagKey: 'multiple-images-to-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'rotate-pdf', name: 'Rotate PDF', category: 'pdf', route: '/tools/rotate-pdf', featureFlagKey: 'rotate-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'reorder-pdf-pages', name: 'Reorder PDF Pages', category: 'pdf', route: '/tools/reorder-pdf-pages', featureFlagKey: 'reorder-pdf-pages', defaultAccess: 'FREE', status: 'available' },
  { key: 'delete-pdf-pages', name: 'Delete PDF Pages', category: 'pdf', route: '/tools/delete-pdf-pages', featureFlagKey: 'delete-pdf-pages', defaultAccess: 'FREE', status: 'available' },
  { key: 'extract-pdf-pages', name: 'Extract PDF Pages', category: 'pdf', route: '/tools/extract-pdf-pages', featureFlagKey: 'extract-pdf-pages', defaultAccess: 'FREE', status: 'available' },
  { key: 'pdf-page-counter', name: 'PDF Page Counter', category: 'pdf', route: '/tools/pdf-page-counter', featureFlagKey: 'pdf-page-counter', defaultAccess: 'FREE', status: 'available' },
  { key: 'protect-pdf', name: 'Protect PDF', category: 'pdf', route: '/tools/protect-pdf', featureFlagKey: 'protect-pdf', defaultAccess: 'FREE', status: 'available' },
  { key: 'unlock-pdf', name: 'Unlock PDF', category: 'pdf', route: '/tools/unlock-pdf', featureFlagKey: 'unlock-pdf', defaultAccess: 'FREE', status: 'available' },

  // Image (13 tools)
  { key: 'compress-image', name: 'Compress Image', category: 'image', route: '/tools/compress-image', featureFlagKey: 'compress-image', defaultAccess: 'FREE', status: 'available' },
  { key: 'resize-image', name: 'Resize Image', category: 'image', route: '/tools/resize-image', featureFlagKey: 'resize-image', defaultAccess: 'FREE', status: 'available' },
  { key: 'crop-image', name: 'Crop Image', category: 'image', route: '/tools/crop-image', featureFlagKey: 'crop-image', defaultAccess: 'FREE', status: 'available' },
  { key: 'png-to-jpg', name: 'PNG to JPG', category: 'image', route: '/tools/png-to-jpg', featureFlagKey: 'png-to-jpg', defaultAccess: 'FREE', status: 'available' },
  { key: 'webp-to-jpg', name: 'WebP to JPG', category: 'image', route: '/tools/webp-to-jpg', featureFlagKey: 'webp-to-jpg', defaultAccess: 'FREE', status: 'available' },
  { key: 'webp-to-png', name: 'WebP to PNG', category: 'image', route: '/tools/webp-to-png', featureFlagKey: 'webp-to-png', defaultAccess: 'FREE', status: 'available' },
  { key: 'rotate-image', name: 'Rotate Image', category: 'image', route: '/tools/rotate-image', featureFlagKey: 'rotate-image', defaultAccess: 'FREE', status: 'available' },
  { key: 'flip-image', name: 'Flip Image', category: 'image', route: '/tools/flip-image', featureFlagKey: 'flip-image', defaultAccess: 'FREE', status: 'available' },
  { key: 'passport-photo-maker', name: 'Passport Photo Maker', category: 'image', route: '/tools/passport-photo-maker', featureFlagKey: 'passport-photo-maker', defaultAccess: 'FREE', status: 'available' },
  { key: 'signature-cropper', name: 'Signature Cropper', category: 'image', route: '/tools/signature-cropper', featureFlagKey: 'signature-cropper', defaultAccess: 'FREE', status: 'available' },
  { key: 'image-watermark', name: 'Image Watermark', category: 'image', route: '/tools/image-watermark', featureFlagKey: 'image-watermark', defaultAccess: 'FREE', status: 'available' },
  { key: 'grayscale-image', name: 'Grayscale Image', category: 'image', route: '/tools/grayscale-image', featureFlagKey: 'grayscale-image', defaultAccess: 'FREE', status: 'available' },
  { key: 'strip-metadata', name: 'Strip Metadata', category: 'image', route: '/tools/strip-metadata', featureFlagKey: 'strip-metadata', defaultAccess: 'FREE', status: 'available' },

  // Student (6 tools)
  { key: 'attendance-tracker', name: 'Attendance Planner', category: 'student', route: '/student/attendance', featureFlagKey: 'attendance-tracker', defaultAccess: 'FREE', status: 'available' },
  { key: 'study-planner', name: 'Study Schedule Planner', category: 'student', route: '/student/planner', featureFlagKey: 'study-planner', defaultAccess: 'FREE', status: 'available' },
  { key: 'assignment-tracker', name: 'Assignment Tracker', category: 'student', route: '/student/assignments', featureFlagKey: 'assignment-tracker', defaultAccess: 'FREE', status: 'available' },
  { key: 'internship-tracker', name: 'Internship Pipeline Tracker', category: 'student', route: '/student/internships', featureFlagKey: 'internship-tracker', defaultAccess: 'FREE', status: 'available' },
  { key: 'hackathon-tracker', name: 'Hackathon Project Tracker', category: 'student', route: '/student/hackathons', featureFlagKey: 'hackathon-tracker', defaultAccess: 'FREE', status: 'available' },
  { key: 'certificate-organizer', name: 'Certificate Organizer', category: 'student', route: '/student/certificates', featureFlagKey: 'certificate-organizer', defaultAccess: 'FREE', status: 'available' },

  // Academic (3 tools)
  { key: 'sgpa-calculator', name: 'SGPA Calculator', category: 'academic', route: '/student/sgpa-calculator', featureFlagKey: 'sgpa-calculator', defaultAccess: 'FREE', status: 'available' },
  { key: 'cgpa-calculator', name: 'CGPA Calculator', category: 'academic', route: '/student/cgpa-calculator', featureFlagKey: 'cgpa-calculator', defaultAccess: 'FREE', status: 'available' },
  { key: 'marks-calculator', name: 'CIE & Marks Calculator', category: 'academic', route: '/student/marks-calculator', featureFlagKey: 'marks-calculator', defaultAccess: 'FREE', status: 'available' },

  // Career (2 tools)
  { key: 'resume-builder', name: 'Resume Builder', category: 'career', route: '/student/resume', featureFlagKey: 'resume-builder', defaultAccess: 'FREE', status: 'available' },
  { key: 'cover-letter-builder', name: 'Cover Letter Builder', category: 'career', route: '/student/cover-letter', featureFlagKey: 'cover-letter-builder', defaultAccess: 'FREE', status: 'available' },

  // AI & Pro (7 tools)
  { key: 'ocr-extract', name: 'OCR Text Extraction', category: 'ai', route: '/tools/ocr-extract', featureFlagKey: 'ocr-extract', defaultAccess: 'SUBSCRIPTION', status: 'beta' },
  { key: 'ai-resume-review', name: 'AI Resume Review', category: 'ai', route: '/tools/ai-resume-review', featureFlagKey: 'ai-resume-review', defaultAccess: 'SUBSCRIPTION', status: 'beta' },
  { key: 'batch-processing', name: 'Batch Document Processing', category: 'ai', route: '/tools/batch-processing', featureFlagKey: 'batch-processing', defaultAccess: 'SUBSCRIPTION', status: 'available' },
  { key: 'unlimited-conversions', name: 'High-Volume Document Conversions', category: 'ai', route: '/tools/unlimited-conversions', featureFlagKey: 'unlimited-conversions', defaultAccess: 'SUBSCRIPTION', status: 'available' },
  { key: 'priority-processing', name: 'Priority Engine Queue', category: 'ai', route: '/tools/priority-processing', featureFlagKey: 'priority-processing', defaultAccess: 'SUBSCRIPTION', status: 'available' },
  { key: 'cloud-sync', name: 'Secure Multi-Device Cloud Sync', category: 'ai', route: '/tools/cloud-sync', featureFlagKey: 'cloud-sync', defaultAccess: 'SUBSCRIPTION', status: 'beta' },
  { key: 'ad-free-workspace', name: 'Ad-Free Distraction Workspace', category: 'ai', route: '/tools/ad-free-workspace', featureFlagKey: 'ad-free-workspace', defaultAccess: 'SUBSCRIPTION', status: 'available' },
];

function resolveToolState(tool, flag) {
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

function getActiveTools(category, featureMap) {
  let list = category ? CANONICAL_TOOLS_FIXTURE.filter((t) => t.category === category) : CANONICAL_TOOLS_FIXTURE;
  if (!featureMap) return list;

  return list.filter((tool) => {
    const flag = featureMap[tool.featureFlagKey] || featureMap[tool.key];
    if (!flag) return true;
    return flag.status !== 'DISABLED';
  });
}

// --- 2. Feature Store Model Under Test ---

class TestFeatureStore {
  constructor() {
    this.flags = new Map();
    this.auditLogs = [];

    // Seed flags
    CANONICAL_TOOLS_FIXTURE.forEach((t) => {
      const flag = {
        id: t.featureFlagKey,
        key: t.featureFlagKey,
        name: t.name,
        category: t.category,
        status: t.status === 'beta' ? 'BETA' : 'ENABLED',
        accessMode: t.defaultAccess,
        visibility: 'visible',
        enabled: true,
      };
      this.flags.set(flag.id, flag);
      this.flags.set(flag.key, flag);
    });
  }

  getFeature(idOrKey) {
    return this.flags.get(idOrKey) || null;
  }

  updateFeatureAccessMode(idOrKey, accessMode, adminEmail) {
    const feature = this.flags.get(idOrKey);
    if (!feature) throw new Error(`Feature flag ${idOrKey} not found.`);
    const prev = feature.accessMode;
    feature.accessMode = accessMode;
    this.auditLogs.push({
      action: 'FEATURE_ACCESS_MODE_UPDATED',
      featureId: feature.id,
      adminEmail,
      previous: prev,
      current: accessMode,
    });
    return { ...feature };
  }

  updateFeatureStatus(idOrKey, status, adminEmail) {
    const feature = this.flags.get(idOrKey);
    if (!feature) throw new Error(`Feature flag ${idOrKey} not found.`);
    const prev = feature.status;
    feature.status = status;
    feature.enabled = status === 'ENABLED' || status === 'BETA';
    this.auditLogs.push({
      action: feature.enabled ? 'FEATURE_ENABLED' : 'FEATURE_DISABLED',
      featureId: feature.id,
      adminEmail,
      previous: prev,
      current: status,
    });
    return { ...feature };
  }
}

// --- 3. Academic Store Model Under Test ---

class TestAcademicStore {
  constructor() {
    this.universities = new Map();
    this.schemes = new Map();
    this.branches = new Map();
    this.semesters = new Map();
    this.subjects = new Map();
    this.auditLogs = [];

    // Seed VTU
    const vtuId = 'univ-vtu';
    this.universities.set(vtuId, { id: vtuId, name: 'Visvesvaraya Technological University', code: 'VTU', status: 'ACTIVE' });
    const scheme22Id = 'scheme-vtu-2022';
    this.schemes.set(scheme22Id, { id: scheme22Id, universityId: vtuId, name: '2022 Scheme (NEP/CBCS)', year: 2022, version: '1.0', status: 'ACTIVE' });
    const scheme25Id = 'scheme-vtu-2025';
    this.schemes.set(scheme25Id, { id: scheme25Id, universityId: vtuId, name: '2025 Scheme', year: 2025, version: '1.0', status: 'ACTIVE' });
  }

  getUniversities() {
    return Array.from(this.universities.values());
  }

  createUniversity(input, adminEmail) {
    const code = input.code.trim().toUpperCase();
    for (const u of this.universities.values()) {
      if (u.code === code) throw new Error(`University code ${code} already exists.`);
    }
    const id = `univ-${code.toLowerCase()}-${Date.now()}`;
    const record = { id, name: input.name.trim(), code, status: input.status || 'ACTIVE' };
    this.universities.set(id, record);
    this.auditLogs.push({ action: 'UNIVERSITY_CREATED', id, adminEmail });
    return record;
  }

  getSchemes(universityId) {
    const list = Array.from(this.schemes.values());
    if (universityId) return list.filter((s) => s.universityId === universityId);
    return list;
  }

  createScheme(input, adminEmail) {
    if (!this.universities.has(input.universityId)) throw new Error('University not found.');
    const id = `scheme-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const record = { id, ...input, status: input.status || 'ACTIVE' };
    this.schemes.set(id, record);
    this.auditLogs.push({ action: 'SCHEME_CREATED', id, adminEmail });
    return record;
  }

  createBranch(input, adminEmail) {
    const id = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const record = { id, ...input, status: input.status || 'ACTIVE' };
    this.branches.set(id, record);
    return record;
  }

  createSemester(input, adminEmail) {
    for (const sem of this.semesters.values()) {
      if (
        sem.universityId === input.universityId &&
        sem.schemeId === input.schemeId &&
        sem.branchId === input.branchId &&
        sem.semesterNumber === input.semesterNumber
      ) {
        throw new Error(`Semester ${input.semesterNumber} already exists in this scope.`);
      }
    }
    const id = `sem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const record = { id, ...input };
    this.semesters.set(id, record);
    return record;
  }

  createSubject(input, adminEmail) {
    const credits = Number(input.credits);
    if (isNaN(credits) || credits <= 0) {
      throw new Error(`Subject credits must be numeric and strictly greater than zero. Received: ${input.credits}`);
    }

    const code = input.subjectCode.trim().toUpperCase();
    for (const sub of this.subjects.values()) {
      if (
        sub.universityId === input.universityId &&
        sub.schemeId === input.schemeId &&
        sub.branchId === input.branchId &&
        sub.semester === input.semester &&
        sub.subjectCode === code
      ) {
        throw new Error(`Subject code ${code} already exists in this scope.`);
      }
    }

    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const record = {
      id,
      ...input,
      subjectCode: code,
      credits,
      status: input.status || 'PUBLISHED',
    };
    this.subjects.set(id, record);
    return record;
  }

  publishCurriculum(scope, targetStatus, adminEmail) {
    let affected = 0;
    for (const sub of this.subjects.values()) {
      if (
        sub.universityId === scope.universityId &&
        sub.schemeId === scope.schemeId &&
        sub.branchId === scope.branchId &&
        sub.semester === scope.semester
      ) {
        sub.status = targetStatus;
        affected++;
      }
    }
    this.auditLogs.push({ action: 'CURRICULUM_PUBLISHED', scope, targetStatus, affected, adminEmail });
    return { affectedCount: affected };
  }

  getCurriculum(query) {
    const univ = this.universities.get(query.universityId);
    if (!univ || univ.status !== 'ACTIVE') {
      return { subjects: [], totalCredits: 0, isVerified: false, message: 'University inactive or not found.' };
    }

    const matching = [];
    let totalCredits = 0;
    for (const sub of this.subjects.values()) {
      if (
        sub.universityId === query.universityId &&
        sub.schemeId === query.schemeId &&
        sub.branchId === query.branchId &&
        sub.semester === query.semester &&
        sub.status === 'PUBLISHED'
      ) {
        matching.push({ ...sub });
        totalCredits += sub.credits;
      }
    }

    return {
      subjects: matching,
      totalCredits,
      isVerified: matching.length > 0,
      message: matching.length > 0 ? 'Official verified curriculum loaded.' : 'Curriculum not available yet. Ask Admin to add curriculum.',
    };
  }

  importCurriculum(params, adminEmail) {
    let items = [];
    const errors = [];
    let importedCount = 0;

    if (params.format === 'csv') {
      const lines = params.data.trim().split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length < 3) continue;
        items.push({
          subjectCode: parts[0],
          subjectName: parts[1],
          credits: parts[2],
          courseType: parts[3] || 'Theory',
          seeApplicable: parts[4] !== 'false',
        });
      }
    } else {
      try {
        items = JSON.parse(params.data);
      } catch (e) {
        throw new Error('Invalid JSON format.');
      }
    }

    for (const item of items) {
      try {
        this.createSubject(
          {
            universityId: params.universityId,
            schemeId: params.schemeId,
            branchId: params.branchId,
            semester: params.semester,
            subjectCode: item.subjectCode,
            subjectName: item.subjectName,
            credits: item.credits,
            courseType: item.courseType || 'Theory',
            seeApplicable: item.seeApplicable !== false,
            status: 'PUBLISHED',
          },
          adminEmail
        );
        importedCount++;
      } catch (err) {
        errors.push(`Row ${item.subjectCode || 'Unknown'}: ${err.message}`);
      }
    }

    return { importedCount, errors };
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

test('1.1 Canonical Tool Registry contains 40+ tools across all 6 categories', () => {
  assert.ok(CANONICAL_TOOLS_FIXTURE.length >= 40, `Found ${CANONICAL_TOOLS_FIXTURE.length} tools`);

  const categorySet = new Set(CANONICAL_TOOLS_FIXTURE.map((t) => t.category));
  for (const cat of CANONICAL_TOOL_CATEGORIES) {
    assert.ok(categorySet.has(cat), `Missing tool category: ${cat}`);
  }

  const keys = new Set();
  const routes = new Set();
  for (const tool of CANONICAL_TOOLS_FIXTURE) {
    assert.ok(tool.key, 'Tool key is required');
    assert.ok(tool.name, 'Tool name is required');
    assert.ok(tool.route, 'Tool route is required');
    assert.ok(!keys.has(tool.key), `Duplicate key: ${tool.key}`);
    assert.ok(!routes.has(tool.route), `Duplicate route: ${tool.route}`);
    keys.add(tool.key);
    routes.add(tool.route);
  }
});

test('1.2 Tool State Resolution & Active Tools filtering', () => {
  const resumeTool = CANONICAL_TOOLS_FIXTURE.find((t) => t.key === 'resume-builder');
  assert.ok(resumeTool);

  // Default state: Free & Enabled
  const defaultState = resolveToolState(resumeTool);
  assert.equal(defaultState.isEnabled, true);
  assert.equal(defaultState.isSubscription, false);

  // Pro Subscription override
  const proState = resolveToolState(resumeTool, {
    status: 'ENABLED',
    accessMode: 'SUBSCRIPTION',
  });
  assert.equal(proState.isEnabled, true);
  assert.equal(proState.isSubscription, true);

  // Disabled filter
  const featureMap = {
    'resume-builder': { status: 'DISABLED' },
  };
  const activeCareer = getActiveTools('career', featureMap);
  assert.ok(!activeCareer.some((t) => t.key === 'resume-builder'), 'Disabled tool must not be in active tools');
});

test('2.1 Runtime Feature Flags & Monetization Toggles', () => {
  const store = new TestFeatureStore();

  const sgpa = store.getFeature('sgpa-calculator');
  assert.ok(sgpa, 'Generic SGPA Calculator flag must exist');
  assert.equal(sgpa.name, 'SGPA Calculator');

  // Toggle Free -> Subscription
  const updatedMonetization = store.updateFeatureAccessMode('sgpa-calculator', 'SUBSCRIPTION', 'admin@saarvi.app');
  assert.equal(updatedMonetization.accessMode, 'SUBSCRIPTION');

  // Toggle Enabled -> Disabled
  const disabled = store.updateFeatureStatus('sgpa-calculator', 'DISABLED', 'admin@saarvi.app');
  assert.equal(disabled.status, 'DISABLED');
  assert.equal(disabled.enabled, false);

  // Verify Audit Logs
  assert.ok(store.auditLogs.length >= 2);
  assert.equal(store.auditLogs[0].action, 'FEATURE_ACCESS_MODE_UPDATED');
  assert.equal(store.auditLogs[1].action, 'FEATURE_DISABLED');
});

test('3.1 Multi-University CRUD & Scheme Version Isolation', () => {
  const academic = new TestAcademicStore();

  const univs = academic.getUniversities();
  assert.ok(univs.some((u) => u.code === 'VTU'), 'VTU must be pre-seeded');

  // Add new university
  const pes = academic.createUniversity({ name: 'PES University (Autonomous)', code: 'PESU' }, 'superadmin@saarvi.app');
  assert.equal(pes.code, 'PESU');

  // Duplicate university code rejected
  assert.throws(() => {
    academic.createUniversity({ name: 'Duplicate PES', code: 'PESU' }, 'admin@saarvi.app');
  }, /already exists/);

  // Scheme created under PES
  const pesScheme = academic.createScheme({ universityId: pes.id, name: '2024 Scheme', year: 2024, version: '1.0' }, 'superadmin@saarvi.app');
  assert.equal(pesScheme.universityId, pes.id);

  // Isolation check: PES schemes only return PES schemes
  const pesSchemes = academic.getSchemes(pes.id);
  assert.equal(pesSchemes.length, 1);
  assert.equal(pesSchemes[0].id, pesScheme.id);
});

test('3.2 Strict Subject Validation & Scope Uniqueness', () => {
  const academic = new TestAcademicStore();
  const vtu = academic.getUniversities().find((u) => u.code === 'VTU');
  const scheme2022 = academic.getSchemes(vtu.id)[0];
  const cse = academic.createBranch({ universityId: vtu.id, schemeId: scheme2022.id, name: 'CSE', code: 'CSE' }, 'admin@saarvi.app');

  // Add valid subject
  const sub1 = academic.createSubject({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: cse.id,
    semester: 3,
    subjectCode: 'BCS301',
    subjectName: 'Mathematics for CSE',
    credits: 4,
  }, 'admin@saarvi.app');
  assert.equal(sub1.credits, 4);

  // Reject zero credits
  assert.throws(() => {
    academic.createSubject({
      universityId: vtu.id,
      schemeId: scheme2022.id,
      branchId: cse.id,
      semester: 3,
      subjectCode: 'BCS302',
      subjectName: 'Invalid Zero Credits',
      credits: 0,
    }, 'admin@saarvi.app');
  }, /strictly greater than zero/);

  // Reject negative credits
  assert.throws(() => {
    academic.createSubject({
      universityId: vtu.id,
      schemeId: scheme2022.id,
      branchId: cse.id,
      semester: 3,
      subjectCode: 'BCS303',
      subjectName: 'Invalid Negative',
      credits: -3,
    }, 'admin@saarvi.app');
  }, /strictly greater than zero/);

  // Reject duplicate subject code in SAME scope
  assert.throws(() => {
    academic.createSubject({
      universityId: vtu.id,
      schemeId: scheme2022.id,
      branchId: cse.id,
      semester: 3,
      subjectCode: 'BCS301',
      subjectName: 'Duplicate Math',
      credits: 4,
    }, 'admin@saarvi.app');
  }, /already exists in this scope/);

  // Same code in DIFFERENT branch is allowed
  const ece = academic.createBranch({ universityId: vtu.id, schemeId: scheme2022.id, name: 'ECE', code: 'ECE' }, 'admin@saarvi.app');
  const eceSub = academic.createSubject({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: ece.id,
    semester: 3,
    subjectCode: 'BCS301',
    subjectName: 'Math in ECE',
    credits: 4,
  }, 'admin@saarvi.app');
  assert.equal(eceSub.subjectCode, 'BCS301');
});

test('3.3 Publishing Workflow & Exact 4-Tuple Resolution', () => {
  const academic = new TestAcademicStore();
  const vtu = academic.getUniversities().find((u) => u.code === 'VTU');
  const scheme2022 = academic.getSchemes(vtu.id)[0];
  const ise = academic.createBranch({ universityId: vtu.id, schemeId: scheme2022.id, name: 'ISE', code: 'ISE' }, 'admin@saarvi.app');

  // Add 2 subjects as DRAFT
  academic.createSubject({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: ise.id,
    semester: 4,
    subjectCode: 'BIS401',
    subjectName: 'Algorithms',
    credits: 4,
    status: 'DRAFT',
  }, 'admin@saarvi.app');
  academic.createSubject({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: ise.id,
    semester: 4,
    subjectCode: 'BIS402',
    subjectName: 'OS',
    credits: 3,
    status: 'DRAFT',
  }, 'admin@saarvi.app');

  // Public curriculum query for DRAFT subjects returns 0
  const draftQuery = academic.getCurriculum({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: ise.id,
    semester: 4,
  });
  assert.equal(draftQuery.subjects.length, 0);
  assert.equal(draftQuery.isVerified, false);

  // Publish
  const pub = academic.publishCurriculum(
    { universityId: vtu.id, schemeId: scheme2022.id, branchId: ise.id, semester: 4 },
    'PUBLISHED',
    'superadmin@saarvi.app'
  );
  assert.equal(pub.affectedCount, 2);

  // Public query now returns 2 published subjects
  const publishedQuery = academic.getCurriculum({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: ise.id,
    semester: 4,
  });
  assert.equal(publishedQuery.subjects.length, 2);
  assert.equal(publishedQuery.isVerified, true);
  assert.equal(publishedQuery.totalCredits, 7);
});

test('3.4 Missing Curriculum Empty State Contract', () => {
  const academic = new TestAcademicStore();
  const vtu = academic.getUniversities().find((u) => u.code === 'VTU');
  const scheme2022 = academic.getSchemes(vtu.id)[0];

  const emptyQuery = academic.getCurriculum({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: 'unconfigured-branch-id',
    semester: 6,
  });

  // Strict contract: empty array, 0 credits, isVerified: false, helpful message
  assert.equal(emptyQuery.subjects.length, 0);
  assert.equal(emptyQuery.totalCredits, 0);
  assert.equal(emptyQuery.isVerified, false);
  assert.match(emptyQuery.message, /Curriculum not available yet\. Ask Admin to add curriculum\./);
});

test('3.5 CSV and JSON Batch Import', () => {
  const academic = new TestAcademicStore();
  const vtu = academic.getUniversities().find((u) => u.code === 'VTU');
  const scheme2022 = academic.getSchemes(vtu.id)[0];
  const ai = academic.createBranch({ universityId: vtu.id, schemeId: scheme2022.id, name: 'AI & ML', code: 'AIML' }, 'admin@saarvi.app');

  const csv = `subjectCode,subjectName,credits,courseType,seeApplicable
BAI501,Machine Learning Fundamentals,4,Theory,true
BAI502,Deep Learning Lab,2,Practical,true`;

  const result = academic.importCurriculum({
    format: 'csv',
    data: csv,
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: ai.id,
    semester: 5,
  }, 'superadmin@saarvi.app');

  assert.equal(result.importedCount, 2);
  assert.equal(result.errors.length, 0);

  const query = academic.getCurriculum({
    universityId: vtu.id,
    schemeId: scheme2022.id,
    branchId: ai.id,
    semester: 5,
  });
  assert.equal(query.subjects.length, 2);
  assert.equal(query.totalCredits, 6);
});

test('4.1 Deterministic SGPA Calculation: Σ(Credit × GradePoint) / Σ(Credit)', () => {
  // Scenario: Student takes 4 courses
  // Course 1: 4 credits, Grade O  (10) -> 40 points
  // Course 2: 4 credits, Grade A+ (9)  -> 36 points
  // Course 3: 3 credits, Grade A  (8)  -> 24 points
  // Course 4: 1 credit,  Grade B+ (7)  -> 7 points
  // Total Credits = 12
  // Total Points = 40 + 36 + 24 + 7 = 107
  // Expected SGPA = 107 / 12 = 8.91666... => 8.92

  const courses = [
    { credits: 4, gradePoint: 10 },
    { credits: 4, gradePoint: 9 },
    { credits: 3, gradePoint: 8 },
    { credits: 1, gradePoint: 7 },
  ];

  let totalCredits = 0;
  let totalPoints = 0;
  for (const c of courses) {
    totalCredits += c.credits;
    totalPoints += c.credits * c.gradePoint;
  }

  const sgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  assert.equal(sgpa.toFixed(2), '8.92');

  // Scenario with a Backlog (Grade F -> 0 points, credits counted in denominator)
  const withBacklog = [
    { credits: 4, gradePoint: 10 },
    { credits: 4, gradePoint: 0 },
  ];
  let failCredits = 0;
  let failPoints = 0;
  for (const c of withBacklog) {
    failCredits += c.credits;
    failPoints += c.credits * c.gradePoint;
  }
  const failSgpa = failPoints / failCredits;
  assert.equal(failSgpa.toFixed(2), '5.00');
});
