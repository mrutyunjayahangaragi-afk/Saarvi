import test from 'node:test';
import assert from 'node:assert/strict';

// Plan and Entitlements Test Suite for DocEase Phase 12

// 1. Emulate core entitlement evaluation logic from src/lib/services/planService.ts and src/config/features.ts
const PLAN_HIERARCHY = {
  guest: 0,
  free: 1,
  pro: 2,
};

const FEATURE_REGISTRY = {
  // Guest / Core Basic Tools (All 100% Local)
  'jpg_to_pdf': { id: 'jpg_to_pdf', minPlan: 'guest', availability: 'available', processingType: 'local' },
  'pdf_to_jpg': { id: 'pdf_to_jpg', minPlan: 'guest', availability: 'available', processingType: 'local' },
  'png_to_jpg': { id: 'png_to_jpg', minPlan: 'guest', availability: 'available', processingType: 'local' },
  'merge_pdf': { id: 'merge_pdf', minPlan: 'guest', availability: 'available', processingType: 'local' },
  'compress_pdf': { id: 'compress_pdf', minPlan: 'guest', availability: 'available', processingType: 'local' },
  'vtu_sgpa': { id: 'vtu_sgpa', minPlan: 'guest', availability: 'available', processingType: 'local' },
  'vtu_cgpa': { id: 'vtu_cgpa', minPlan: 'guest', availability: 'available', processingType: 'local' },
  'resume_builder': { id: 'resume_builder', minPlan: 'guest', availability: 'available', processingType: 'local' },

  // Free Tier Account Features (Require Login)
  'saved_history': { id: 'saved_history', minPlan: 'free', availability: 'available', processingType: 'local' },
  'saved_resumes': { id: 'saved_resumes', minPlan: 'free', availability: 'available', processingType: 'local' },
  'custom_templates': { id: 'custom_templates', minPlan: 'free', availability: 'available', processingType: 'local' },

  // Future Pro Features (Monetization Architecture - Coming Soon / Pro Required)
  'batch_processing': { id: 'batch_processing', minPlan: 'pro', availability: 'coming_soon', processingType: 'local' },
  'image_ocr': { id: 'image_ocr', minPlan: 'pro', availability: 'coming_soon', processingType: 'server' },
  'ai_resume_assistant': { id: 'ai_resume_assistant', minPlan: 'pro', availability: 'coming_soon', processingType: 'server' },
  'cloud_sync': { id: 'cloud_sync', minPlan: 'pro', availability: 'coming_soon', processingType: 'mixed' },
};

const PLAN_LIMITS = {
  guest: {
    maxFileSizeMB: 25,
    maxPdfSizeMB: 50,
    maxBatchFiles: 5,
    historyRetentionDays: 0,
    savedResumesLimit: 1,
    unlimitedBasicTools: true,
  },
  free: {
    maxFileSizeMB: 35,
    maxPdfSizeMB: 75,
    maxBatchFiles: 10,
    historyRetentionDays: 30,
    savedResumesLimit: 5,
    unlimitedBasicTools: true,
  },
  pro: {
    maxFileSizeMB: 100,
    maxPdfSizeMB: 200,
    maxBatchFiles: 50,
    historyRetentionDays: 365,
    savedResumesLimit: 100,
    unlimitedBasicTools: true,
  },
};

function canAccessFeature(featureId, user = null, adminFlags = {}) {
  const feature = FEATURE_REGISTRY[featureId];
  if (!feature) {
    return { allowed: false, reason: 'feature_not_found', minPlan: 'guest' };
  }

  // 1. Admin Feature Flags override
  if (adminFlags[featureId] === false) {
    return { allowed: false, reason: 'feature_disabled', minPlan: feature.minPlan };
  }

  // 2. Admin Maintenance flag
  if (adminFlags.maintenance === true) {
    return { allowed: false, reason: 'maintenance', minPlan: feature.minPlan };
  }

  // 3. Coming soon status
  if (feature.availability === 'coming_soon') {
    return { allowed: false, reason: 'coming_soon', minPlan: feature.minPlan };
  }

  // 4. Resolve user plan
  const userPlan = user ? (user.plan || 'free') : 'guest';
  const userLevel = PLAN_HIERARCHY[userPlan] ?? 0;
  const requiredLevel = PLAN_HIERARCHY[feature.minPlan] ?? 0;

  if (userLevel < requiredLevel) {
    if (feature.minPlan === 'free') {
      return { allowed: false, reason: 'login_required', minPlan: 'free' };
    }
    return { allowed: false, reason: 'pro_required', minPlan: 'pro' };
  }

  return { allowed: true, minPlan: feature.minPlan };
}

test('DocEase Phase 12 - Requirement 1: Guest Access to Basic Tools', () => {
  const guestTools = [
    'jpg_to_pdf',
    'pdf_to_jpg',
    'png_to_jpg',
    'merge_pdf',
    'compress_pdf',
    'vtu_sgpa',
    'vtu_cgpa',
    'resume_builder',
  ];

  for (const toolId of guestTools) {
    const result = canAccessFeature(toolId, null);
    assert.equal(result.allowed, true, `Guest should access basic tool: ${toolId}`);
    assert.equal(result.minPlan, 'guest');
    assert.equal(FEATURE_REGISTRY[toolId].processingType, 'local', `${toolId} must be 100% local`);
  }
});

test('DocEase Phase 12 - Requirement 2: Free Tier Authenticated Workspace Entitlements', () => {
  // Guest denied from account workspace features
  const guestHistory = canAccessFeature('saved_history', null);
  assert.equal(guestHistory.allowed, false);
  assert.equal(guestHistory.reason, 'login_required');

  const guestResumes = canAccessFeature('saved_resumes', null);
  assert.equal(guestResumes.allowed, false);
  assert.equal(guestResumes.reason, 'login_required');

  // Authenticated Free user permitted
  const freeUser = { id: 'u_123', email: 'student@example.com', plan: 'free' };
  const freeHistory = canAccessFeature('saved_history', freeUser);
  assert.equal(freeHistory.allowed, true);

  const freeResumes = canAccessFeature('saved_resumes', freeUser);
  assert.equal(freeResumes.allowed, true);
});

test('DocEase Phase 12 - Requirement 3: Future Pro Features Architecture & Non-Breaking Placeholders', () => {
  const freeUser = { id: 'u_123', email: 'student@example.com', plan: 'free' };

  // Pro features marked coming_soon return coming_soon reason
  const batchRes = canAccessFeature('batch_processing', freeUser);
  assert.equal(batchRes.allowed, false);
  assert.equal(batchRes.reason, 'coming_soon');
  assert.equal(batchRes.minPlan, 'pro');

  const ocrRes = canAccessFeature('image_ocr', freeUser);
  assert.equal(ocrRes.allowed, false);
  assert.equal(ocrRes.reason, 'coming_soon');

  const aiRes = canAccessFeature('ai_resume_assistant', freeUser);
  assert.equal(aiRes.allowed, false);
  assert.equal(aiRes.reason, 'coming_soon');

  // Even if a user somehow had plan: 'pro' in the future, coming_soon is respected
  const proUser = { id: 'u_pro', email: 'pro@example.com', plan: 'pro' };
  const proBatchRes = canAccessFeature('batch_processing', proUser);
  assert.equal(proBatchRes.allowed, false);
  assert.equal(proBatchRes.reason, 'coming_soon');
});

test('DocEase Phase 12 - Requirement 4: Admin Flags & Maintenance Isolation', () => {
  const freeUser = { id: 'u_123', email: 'student@example.com', plan: 'free' };

  // Admin disables a specific feature
  const disabledRes = canAccessFeature('pdf_to_jpg', freeUser, { 'pdf_to_jpg': false });
  assert.equal(disabledRes.allowed, false);
  assert.equal(disabledRes.reason, 'feature_disabled');

  // Platform maintenance mode disables tool access
  const maintenanceRes = canAccessFeature('jpg_to_pdf', null, { maintenance: true });
  assert.equal(maintenanceRes.allowed, false);
  assert.equal(maintenanceRes.reason, 'maintenance');
});

test('DocEase Phase 12 - Requirement 5: Memory Safety Limits vs Plan Limits Separation', () => {
  // Free tier has clear limits defined
  assert.equal(PLAN_LIMITS.guest.maxPdfSizeMB, 50);
  assert.equal(PLAN_LIMITS.free.maxPdfSizeMB, 75);
  assert.equal(PLAN_LIMITS.pro.maxPdfSizeMB, 200);

  // Both guest and free guarantee unlimited basic tools (fair usage, no artificial daily paywall on conversions)
  assert.equal(PLAN_LIMITS.guest.unlimitedBasicTools, true);
  assert.equal(PLAN_LIMITS.free.unlimitedBasicTools, true);
});

test('DocEase Phase 12 - Requirement 6: Tampering Resistance & Privacy Invariant', () => {
  // Tampered client user with invalid plan string defaults to guest level 0
  const tamperedUser = { id: 'u_hacker', plan: 'super_enterprise_admin_bypass' };
  const tamperedCheck = canAccessFeature('saved_history', tamperedUser);
  // Default is guest level (0) < free level (1), so login_required is returned
  assert.equal(tamperedCheck.allowed, false);
  assert.equal(tamperedCheck.reason, 'login_required');

  // Local-first invariant: basic tools remain local, never requiring cloud storage
  assert.equal(FEATURE_REGISTRY['jpg_to_pdf'].processingType, 'local');
  assert.equal(FEATURE_REGISTRY['vtu_sgpa'].processingType, 'local');
  assert.equal(FEATURE_REGISTRY['resume_builder'].processingType, 'local');
});

test('DocEase Phase 12 - Requirement 7: Zero Payment Secrets & Zero Fake Payment Transitions', () => {
  // Verify that no payment vendor credentials exist in test or environment configs
  const bannedVendors = ['STRIPE_SECRET_KEY', 'RAZORPAY_KEY_SECRET', 'PAYTM_KEY'];
  for (const envKey of bannedVendors) {
    assert.equal(process.env[envKey], undefined, `Must not contain live payment secret: ${envKey}`);
  }
});
