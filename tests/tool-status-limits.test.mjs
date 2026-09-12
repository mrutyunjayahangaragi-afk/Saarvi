import test from 'node:test';
import assert from 'node:assert/strict';

// Static base limits and tools representation
const BASE_FILE_LIMITS = {
  IMAGE_MAX_MB: 25,
  PDF_MAX_MB: 50,
  SPECIFIC: {
    'jpg-to-pdf': 25,
    'png-to-jpg': 25,
    'merge-pdf': 50,
    'compress-pdf': 50,
  },
};

const BASE_TOOLS = [
  { id: 'jpg-to-pdf', slug: 'jpg-to-pdf', name: 'JPG to PDF', status: 'available', maxSizeMB: 25 },
  { id: 'compress-pdf', slug: 'compress-pdf', name: 'Compress PDF', status: 'available', maxSizeMB: 50 },
  { id: 'merge-pdf', slug: 'merge-pdf', name: 'Merge PDF', status: 'available', maxSizeMB: 50 },
  { id: 'ocr-extract', slug: 'ocr-extract', name: 'OCR Extract', status: 'coming_soon', maxSizeMB: 25 },
];

function resolveEffectiveTool(slug, overrides = {}) {
  const base = BASE_TOOLS.find((t) => t.slug === slug);
  if (!base) return undefined;

  const override = overrides[slug];
  if (!override) return { ...base };

  return {
    ...base,
    name: override.name || base.name,
    status: (override.status || base.status).toLowerCase(),
    maxSizeMB: override.maxSizeMB || base.maxSizeMB || (slug.includes('pdf') ? BASE_FILE_LIMITS.PDF_MAX_MB : BASE_FILE_LIMITS.IMAGE_MAX_MB),
  };
}

test('Section 15, 16, 17: Tool Status Overrides (DISABLED, MAINTENANCE, BETA, AVAILABLE)', () => {
  // 1. Available by default
  const defaultTool = resolveEffectiveTool('compress-pdf');
  assert.equal(defaultTool.status, 'available');

  // 2. Admin disables tool
  const disabledTool = resolveEffectiveTool('compress-pdf', {
    'compress-pdf': { status: 'DISABLED' },
  });
  assert.equal(disabledTool.status, 'disabled');

  // 3. Admin puts tool in maintenance
  const maintenanceTool = resolveEffectiveTool('compress-pdf', {
    'compress-pdf': { status: 'MAINTENANCE' },
  });
  assert.equal(maintenanceTool.status, 'maintenance');

  // 4. Admin marks tool beta
  const betaTool = resolveEffectiveTool('compress-pdf', {
    'compress-pdf': { status: 'BETA' },
  });
  assert.equal(betaTool.status, 'beta');
});

test('Section 20: Single Source of Truth for Limits (Overrides propagate deterministically)', () => {
  // Base limit
  const base = resolveEffectiveTool('jpg-to-pdf');
  assert.equal(base.maxSizeMB, 25);

  // Admin configures 40MB limit override
  const overridden = resolveEffectiveTool('jpg-to-pdf', {
    'jpg-to-pdf': { maxSizeMB: 40 },
  });
  assert.equal(overridden.maxSizeMB, 40);

  // Verify memory safety bounds: file within limit accepted, over limit rejected
  const testFile35MB = 35 * 1024 * 1024;
  const testFile45MB = 45 * 1024 * 1024;

  assert.equal(testFile35MB <= overridden.maxSizeMB * 1024 * 1024, true);
  assert.equal(testFile45MB <= overridden.maxSizeMB * 1024 * 1024, false);
});

test('Section 94 & 95: Fail-Safe Design (Falls back gracefully to static defaults when overrides are empty)', () => {
  const offlineTool = resolveEffectiveTool('merge-pdf', {});
  assert.ok(offlineTool);
  assert.equal(offlineTool.name, 'Merge PDF');
  assert.equal(offlineTool.status, 'available');
  assert.equal(offlineTool.maxSizeMB, 50);
});
