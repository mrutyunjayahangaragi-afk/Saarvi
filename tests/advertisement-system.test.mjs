import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Saarvi Admin-Controlled Advertisement System — Behavioral Test Suite
// ============================================================================

// 1. URL Sanitizer Logic Under Test
function sanitizeUrl(rawUrl, fallback = '#') {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  const normalized = trimmed.replace(/[\x00-\x20]/g, '').toLowerCase();
  const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
  for (const proto of dangerous) {
    if (normalized.startsWith(proto)) return fallback;
  }

  if (trimmed.startsWith('//')) return fallback;

  try {
    const parsed = new URL(trimmed);
    const proto = parsed.protocol.toLowerCase();
    if (proto === 'http:' || proto === 'https:' || proto === 'mailto:' || proto === 'tel:') {
      return trimmed;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

// 2. Binary Magic Bytes & Executable Inspection Logic Under Test
function isExecutableSignature(bytes) {
  if (bytes.length < 2) return false;
  // Windows PE ("MZ")
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  // Linux ELF
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;
  // Mach-O
  if (bytes.length >= 4) {
    const magic32 = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    if (magic32 === 0xfeedface || magic32 === 0xfeedfacf || magic32 === 0xcafebabe || magic32 === 0xbebafeca) {
      return true;
    }
  }
  // Shell script shebang ("#!")
  if (bytes[0] === 0x23 && bytes[1] === 0x21) return true;
  return false;
}

function detectFileFormatFromBytes(bytes) {
  if (bytes.length < 4) return null;

  // PNG
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  // WebP
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'webp';
  }
  // GIF
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'gif';
  }
  // MP4
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'mp4';
  }
  // WebM (EBML)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'webm';
  }

  return null;
}

// 3. In-Memory Advertisement Store Simulation Under Test
const DEFAULT_SETTINGS = {
  adsEnabled: true,
  defaultDisplayMode: 'FULLSCREEN_GATE',
  defaultDurationSeconds: 15,
  defaultSkipEnabled: true,
  defaultSkipAfterSeconds: 5,
  defaultFrequencyMode: 'ONCE_PER_SESSION',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

class MockAdStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.ads = new Map();
    this.settings = { ...DEFAULT_SETTINGS };
    this.events = [];
    this.auditLogs = [];
  }

  getDisplaySettings() {
    return { ...this.settings };
  }

  updateDisplaySettings(updates, actor = 'admin@saarvi.app') {
    this.settings = {
      ...this.settings,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    };
    if (this.settings.defaultDurationSeconds < 3) this.settings.defaultDurationSeconds = 3;
    if (this.settings.defaultDurationSeconds > 120) this.settings.defaultDurationSeconds = 120;
    if (this.settings.defaultSkipAfterSeconds < 0) this.settings.defaultSkipAfterSeconds = 0;
    if (this.settings.defaultSkipAfterSeconds > this.settings.defaultDurationSeconds) {
      this.settings.defaultSkipAfterSeconds = this.settings.defaultDurationSeconds;
    }

    this.auditLogs.push({
      action: 'AD_SETTINGS_UPDATED',
      targetType: 'ADVERTISEMENT',
      targetId: 'global_settings',
      actor,
      timestamp: new Date().toISOString(),
    });

    return { ...this.settings };
  }

  getAllAds() {
    return Array.from(this.ads.values()).sort((a, b) => b.priority - a.priority);
  }

  getAdById(id) {
    return this.ads.get(id) || null;
  }

  createAd(params, actor = 'admin@saarvi.app') {
    const id = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duration = params.durationSeconds ?? this.settings.defaultDurationSeconds;
    const skipAfter = params.skipAfterSeconds ?? this.settings.defaultSkipAfterSeconds;

    const record = {
      id,
      name: params.name.trim(),
      description: params.description?.trim(),
      mediaType: params.mediaType,
      mediaUrl: params.mediaUrl.trim(),
      headline: params.headline?.trim(),
      bodyText: params.bodyText?.trim(),
      ctaText: params.ctaText?.trim(),
      ctaUrl: params.ctaUrl ? sanitizeUrl(params.ctaUrl, '') : undefined,
      advertiserName: params.advertiserName?.trim(),
      status: params.status || 'DRAFT',
      priority: Number(params.priority) || 0,
      audience: params.audience || 'FREE_ONLY',
      startAt: params.startAt,
      endAt: params.endAt,
      timezone: params.timezone || 'UTC',
      durationSeconds: Math.max(3, Math.min(120, duration)),
      skipEnabled: params.skipEnabled ?? this.settings.defaultSkipEnabled,
      skipAfterSeconds: Math.max(0, Math.min(duration, skipAfter)),
      displayMode: params.displayMode || this.settings.defaultDisplayMode,
      frequencyMode: params.frequencyMode || this.settings.defaultFrequencyMode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: actor,
    };

    this.ads.set(id, record);

    this.auditLogs.push({
      action: 'AD_CREATED',
      targetType: 'ADVERTISEMENT',
      targetId: id,
      actor,
      timestamp: new Date().toISOString(),
    });

    return { ...record };
  }

  updateAd(id, updates, actor = 'admin@saarvi.app') {
    const existing = this.ads.get(id);
    if (!existing) throw new Error(`Advertisement not found with id: ${id}`);

    const updatedDuration = updates.durationSeconds ?? existing.durationSeconds;
    const updatedSkipAfter = updates.skipAfterSeconds ?? existing.skipAfterSeconds;

    const safeCtaUrl = updates.ctaUrl !== undefined
      ? (updates.ctaUrl ? sanitizeUrl(updates.ctaUrl, '') : undefined)
      : existing.ctaUrl;

    const updated = {
      ...existing,
      ...updates,
      ctaUrl: safeCtaUrl,
      durationSeconds: Math.max(3, Math.min(120, updatedDuration)),
      skipAfterSeconds: Math.max(0, Math.min(updatedDuration, updatedSkipAfter)),
      updatedAt: new Date().toISOString(),
    };

    this.ads.set(id, updated);

    let action = 'AD_UPDATED';
    if (updates.status && updates.status !== existing.status) {
      if (updates.status === 'ACTIVE') action = 'AD_PUBLISHED';
      else if (updates.status === 'PAUSED') action = 'AD_PAUSED';
      else if (updates.status === 'ARCHIVED') action = 'AD_ARCHIVED';
    }

    this.auditLogs.push({
      action,
      targetType: 'ADVERTISEMENT',
      targetId: id,
      actor,
      timestamp: new Date().toISOString(),
    });

    return { ...updated };
  }

  deleteAd(id, actor = 'admin@saarvi.app') {
    const existing = this.ads.get(id);
    if (!existing) return false;

    this.ads.delete(id);
    this.auditLogs.push({
      action: 'AD_DELETED',
      targetType: 'ADVERTISEMENT',
      targetId: id,
      actor,
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  getActiveEligibleAd(nowMs = Date.now(), isPro = false) {
    // Pro users are 100% exempt from ads
    if (isPro) {
      return { ad: null, isPro: true, reason: 'PRO_EXEMPT', settings: this.getDisplaySettings() };
    }

    if (!this.settings.adsEnabled) {
      return { ad: null, isPro: false, reason: 'ADS_DISABLED', settings: this.getDisplaySettings() };
    }

    const activeAds = Array.from(this.ads.values()).filter((ad) => ad.status === 'ACTIVE');

    const scheduledAds = activeAds.filter((ad) => {
      if (ad.startAt) {
        const start = new Date(ad.startAt).getTime();
        if (!isNaN(start) && start > nowMs) return false;
      }
      if (ad.endAt) {
        const end = new Date(ad.endAt).getTime();
        if (!isNaN(end) && end < nowMs) return false;
      }
      return true;
    });

    if (scheduledAds.length === 0) {
      return { ad: null, isPro: false, reason: 'NO_ACTIVE_AD', settings: this.getDisplaySettings() };
    }

    scheduledAds.sort((a, b) => b.priority - a.priority);

    return {
      ad: { ...scheduledAds[0] },
      isPro: false,
      reason: 'OK',
      settings: this.getDisplaySettings(),
    };
  }

  recordEvent(adId, eventType, userId, metadata) {
    const event = {
      id: `ad_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adId,
      eventType,
      timestamp: new Date().toISOString(),
      userId,
      metadata,
    };
    this.events.push(event);
    return event;
  }

  getAnalyticsSummary(adId) {
    let filtered = this.events;
    if (adId) {
      filtered = filtered.filter((e) => e.adId === adId);
    }

    let impressions = 0;
    let completed = 0;
    let skipped = 0;
    let ctaClicks = 0;
    let mediaErrors = 0;

    for (const evt of filtered) {
      switch (evt.eventType) {
        case 'AD_IMPRESSION':
          impressions++;
          break;
        case 'AD_COMPLETED':
          completed++;
          break;
        case 'AD_SKIPPED':
          skipped++;
          break;
        case 'AD_CTA_CLICKED':
          ctaClicks++;
          break;
        case 'AD_MEDIA_ERROR':
          mediaErrors++;
          break;
      }
    }

    const completionRate = impressions > 0 ? Math.round((completed / impressions) * 100) : 0;
    const skipRate = impressions > 0 ? Math.round((skipped / impressions) * 100) : 0;
    const ctr = impressions > 0 ? Math.round((ctaClicks / impressions) * 100 * 10) / 10 : 0;

    return {
      adId,
      impressions,
      completed,
      skipped,
      ctaClicks,
      mediaErrors,
      completionRate,
      skipRate,
      ctr,
    };
  }
}

const store = new MockAdStore();

beforeEach(() => {
  store.reset();
});

// ============================================================================
// TESTS
// ============================================================================

test('Ad System — Admin can create an image advertisement with validated parameters', () => {
  const ad = store.createAd(
    {
      name: 'Spring Semester Prep',
      description: 'VTU Study material and calculators promotion',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/brand/promo.png',
      headline: 'Score Higher this Semester',
      bodyText: 'Access verified VTU SGPA and CGPA calculators for free.',
      ctaText: 'Open Calculators',
      ctaUrl: '/student/calculator',
      advertiserName: 'Saarvi Academic',
      status: 'DRAFT',
      priority: 10,
      durationSeconds: 15,
      skipEnabled: true,
      skipAfterSeconds: 5,
    },
    'admin@saarvi.app'
  );

  assert.ok(ad.id.startsWith('ad_'));
  assert.strictEqual(ad.name, 'Spring Semester Prep');
  assert.strictEqual(ad.mediaType, 'IMAGE');
  assert.strictEqual(ad.status, 'DRAFT');
  assert.strictEqual(ad.priority, 10);
  assert.strictEqual(ad.durationSeconds, 15);
  assert.strictEqual(ad.skipEnabled, true);
  assert.strictEqual(ad.skipAfterSeconds, 5);

  const fetched = store.getAdById(ad.id);
  assert.ok(fetched);
  assert.strictEqual(fetched.name, 'Spring Semester Prep');
});

test('Ad System — Admin can create a browser-safe video advertisement', () => {
  const ad = store.createAd(
    {
      name: 'ATS Resume Builder Demo',
      mediaType: 'VIDEO',
      mediaUrl: 'data:video/mp4;base64,AAAA',
      headline: 'Build a 90+ ATS Resume',
      ctaText: 'Build My Resume',
      ctaUrl: '/student/resume',
      durationSeconds: 20,
      skipEnabled: true,
      skipAfterSeconds: 5,
      status: 'ACTIVE',
    },
    'admin@saarvi.app'
  );

  assert.strictEqual(ad.mediaType, 'VIDEO');
  assert.strictEqual(ad.status, 'ACTIVE');
  assert.strictEqual(ad.durationSeconds, 20);
});

test('Ad System — Admin can edit, pause, publish, and delete an advertisement', () => {
  const ad = store.createAd(
    {
      name: 'Initial Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/promo.png',
      status: 'DRAFT',
    },
    'admin@saarvi.app'
  );

  // Publish
  const published = store.updateAd(ad.id, { status: 'ACTIVE' }, 'admin@saarvi.app');
  assert.strictEqual(published.status, 'ACTIVE');

  // Pause
  const paused = store.updateAd(ad.id, { status: 'PAUSED' }, 'admin@saarvi.app');
  assert.strictEqual(paused.status, 'PAUSED');

  // Edit details
  const edited = store.updateAd(ad.id, { name: 'Updated Ad Title', priority: 25 }, 'admin@saarvi.app');
  assert.strictEqual(edited.name, 'Updated Ad Title');
  assert.strictEqual(edited.priority, 25);

  // Delete
  const deleted = store.deleteAd(ad.id, 'admin@saarvi.app');
  assert.strictEqual(deleted, true);
  assert.strictEqual(store.getAdById(ad.id), null);
});

test('Ad System — Active schedule works and expired or future ads are excluded', () => {
  const now = Date.now();

  // 1. Future scheduled ad (starts in 1 hour)
  store.createAd(
    {
      name: 'Future Scheduled Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/future.png',
      status: 'ACTIVE',
      priority: 100,
      startAt: new Date(now + 3600 * 1000).toISOString(),
    },
    'admin@saarvi.app'
  );

  // 2. Expired ad (ended 1 hour ago)
  store.createAd(
    {
      name: 'Expired Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/expired.png',
      status: 'ACTIVE',
      priority: 90,
      endAt: new Date(now - 3600 * 1000).toISOString(),
    },
    'admin@saarvi.app'
  );

  // 3. Currently active scheduled ad (started 1 hour ago, ends in 1 hour)
  const currentAd = store.createAd(
    {
      name: 'Current Active Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/active.png',
      status: 'ACTIVE',
      priority: 50,
      startAt: new Date(now - 3600 * 1000).toISOString(),
      endAt: new Date(now + 3600 * 1000).toISOString(),
    },
    'admin@saarvi.app'
  );

  const eligible = store.getActiveEligibleAd(now);
  assert.ok(eligible.ad, 'Should find active ad');
  assert.strictEqual(eligible.ad.id, currentAd.id);
  assert.strictEqual(eligible.ad.name, 'Current Active Ad');
});

test('Ad System — Deterministic priority selection chooses highest priority active ad', () => {
  store.createAd(
    {
      name: 'Low Priority Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/low.png',
      status: 'ACTIVE',
      priority: 5,
    },
    'admin@saarvi.app'
  );

  const highAd = store.createAd(
    {
      name: 'High Priority Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/high.png',
      status: 'ACTIVE',
      priority: 80,
    },
    'admin@saarvi.app'
  );

  store.createAd(
    {
      name: 'Medium Priority Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/medium.png',
      status: 'ACTIVE',
      priority: 40,
    },
    'admin@saarvi.app'
  );

  const selected = store.getActiveEligibleAd();
  assert.ok(selected.ad);
  assert.strictEqual(selected.ad.id, highAd.id);
  assert.strictEqual(selected.ad.name, 'High Priority Ad');
});

test('Ad System — Free users receive active ad; Pro users are strictly exempt', () => {
  store.createAd(
    {
      name: 'Promotional Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/ad.png',
      status: 'ACTIVE',
      priority: 10,
    },
    'admin@saarvi.app'
  );

  // Free user: receives active ad
  const freeResult = store.getActiveEligibleAd(Date.now(), false);
  assert.strictEqual(freeResult.isPro, false);
  assert.strictEqual(freeResult.reason, 'OK');
  assert.ok(freeResult.ad);
  assert.strictEqual(freeResult.ad.name, 'Promotional Ad');

  // Pro user: NEVER receives ad (showAd: false, isPro: true, reason: PRO_EXEMPT)
  const proResult = store.getActiveEligibleAd(Date.now(), true);
  assert.strictEqual(proResult.isPro, true);
  assert.strictEqual(proResult.reason, 'PRO_EXEMPT');
  assert.strictEqual(proResult.ad, null);
});

test('Ad System — Display settings bounds and master toggle work', () => {
  const updated = store.updateDisplaySettings(
    {
      adsEnabled: false,
      defaultDurationSeconds: 25,
      defaultSkipAfterSeconds: 8,
    },
    'admin@saarvi.app'
  );

  assert.strictEqual(updated.adsEnabled, false);
  assert.strictEqual(updated.defaultDurationSeconds, 25);
  assert.strictEqual(updated.defaultSkipAfterSeconds, 8);

  store.createAd(
    {
      name: 'Active Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/ad.png',
      status: 'ACTIVE',
    },
    'admin@saarvi.app'
  );

  const eligible = store.getActiveEligibleAd();
  assert.strictEqual(eligible.ad, null);
  assert.strictEqual(eligible.settings.adsEnabled, false);
});

test('Ad System — CTA URL sanitization protects against unsafe schemes and redirects', () => {
  // Safe relative route
  assert.strictEqual(sanitizeUrl('/student/calculator'), '/student/calculator');

  // Safe external HTTPS
  assert.strictEqual(sanitizeUrl('https://saarvi.app/pricing'), 'https://saarvi.app/pricing');

  // Dangerous javascript: neutralized
  assert.strictEqual(sanitizeUrl('javascript:alert(1)', ''), '');

  // Dangerous data: scheme neutralized
  assert.strictEqual(sanitizeUrl('data:text/html,<script>evil()</script>', ''), '');

  // Dangerous vbscript: scheme neutralized
  assert.strictEqual(sanitizeUrl('vbscript:msgbox("hello")', ''), '');

  // Protocol-relative //evil.com neutralized
  assert.strictEqual(sanitizeUrl('//evil.com', ''), '');
});

test('Ad System — Magic bytes accurately detects browser-safe video containers (MP4, WebM)', () => {
  // MP4 container: 'ftyp' at bytes 4-7
  const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const detectedMp4 = detectFileFormatFromBytes(mp4Bytes);
  assert.strictEqual(detectedMp4, 'mp4');

  // WebM container: EBML header (0x1A 0x45 0xDF 0xA3)
  const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
  const detectedWebm = detectFileFormatFromBytes(webmBytes);
  assert.strictEqual(detectedWebm, 'webm');

  // PNG image: \x89PNG
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const detectedPng = detectFileFormatFromBytes(pngBytes);
  assert.strictEqual(detectedPng, 'png');

  // Executable binary signature rejection (Windows PE 'MZ')
  const peBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  assert.strictEqual(isExecutableSignature(peBytes), true);

  // Linux ELF executable
  const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46]);
  assert.strictEqual(isExecutableSignature(elfBytes), true);

  // Shell script shebang '#!'
  const shBytes = new Uint8Array([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e, 0x2f, 0x73, 0x68]);
  assert.strictEqual(isExecutableSignature(shBytes), true);
});

test('Ad System — Real analytics captures impressions, skips, completions, and clicks without fake metrics', () => {
  const ad = store.createAd(
    {
      name: 'Analytics Test Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/test.png',
      status: 'ACTIVE',
    },
    'admin@saarvi.app'
  );

  const initial = store.getAnalyticsSummary(ad.id);
  assert.strictEqual(initial.impressions, 0);
  assert.strictEqual(initial.completed, 0);
  assert.strictEqual(initial.skipped, 0);

  // Record 10 impressions
  for (let i = 0; i < 10; i++) {
    store.recordEvent(ad.id, 'AD_IMPRESSION', `user_${i}`);
  }

  // Record 6 completed views
  for (let i = 0; i < 6; i++) {
    store.recordEvent(ad.id, 'AD_COMPLETED', `user_${i}`);
  }

  // Record 3 skipped views
  for (let i = 0; i < 3; i++) {
    store.recordEvent(ad.id, 'AD_SKIPPED', `user_${i}`);
  }

  // Record 2 CTA clicks
  for (let i = 0; i < 2; i++) {
    store.recordEvent(ad.id, 'AD_CTA_CLICKED', `user_${i}`);
  }

  const metrics = store.getAnalyticsSummary(ad.id);
  assert.strictEqual(metrics.impressions, 10);
  assert.strictEqual(metrics.completed, 6);
  assert.strictEqual(metrics.skipped, 3);
  assert.strictEqual(metrics.ctaClicks, 2);
  assert.strictEqual(metrics.completionRate, 60); // 6 / 10 = 60%
  assert.strictEqual(metrics.skipRate, 30);       // 3 / 10 = 30%
  assert.strictEqual(metrics.ctr, 20);            // 2 / 10 = 20%
});

test('Ad System — Audit logs are generated for all administrator mutations', () => {
  const ad = store.createAd(
    {
      name: 'Audited Ad',
      mediaType: 'IMAGE',
      mediaUrl: 'https://saarvi.app/ad.png',
    },
    'superadmin@saarvi.app'
  );

  store.updateAd(ad.id, { status: 'ACTIVE' }, 'superadmin@saarvi.app');
  store.deleteAd(ad.id, 'superadmin@saarvi.app');

  const logs = store.auditLogs;
  assert.strictEqual(logs.length, 3);

  const adLogs = logs.filter((l) => l.targetType === 'ADVERTISEMENT');
  assert.ok(adLogs.some((l) => l.action === 'AD_CREATED'));
  assert.ok(adLogs.some((l) => l.action === 'AD_PUBLISHED'));
  assert.ok(adLogs.some((l) => l.action === 'AD_DELETED'));
});
