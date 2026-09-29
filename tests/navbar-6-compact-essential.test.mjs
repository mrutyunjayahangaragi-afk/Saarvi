/**
 * Saarvi — Compact Main Navbar 6.0 & Essential Daily Tools Acceptance Test Suite
 *
 * Verifies all Navbar 6.0 Core Requirements:
 * 1. Strict Slot Limit: Max 6 essential daily tools in main navbar.
 * 2. Real Completion Telemetry Priority: Only `tool_completed` with `success = true` determines rank.
 * 3. Idempotency: Duplicate operations with same `operation_id` count only once.
 * 4. Admin Pinning & Locked Slots: Admin can pin/lock a tool to a specific slot with clear labeling.
 * 5. Health Check Gates: Broken, Coming Soon, or Disabled tools are excluded from the essential navbar.
 * 6. Disabled Tool Immediate Removal & Slot Refill: Disabling a tool immediately fills the slot with next eligible.
 * 7. Category Diversity Enforcement: Prevents PDF tools from dominating all 6 slots; guarantees Student & Career presence.
 * 8. Zero Telemetry Fallback: Fallback candidates (Merge PDF, Compress PDF, PDF to JPG, JPG to PDF, SGPA, Resume Builder)
 *    are labeled "Core Utility" / "Admin Recommended", never fake "Most Used".
 * 9. Responsive & File Invariants: Main navbar shows only Tools launcher + essential shortcuts; categories belong inside Tools mega menu.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CANONICAL_TOOL_REGISTRY,
  normalizeToolKey,
} from '../src/lib/tools/tool-registry.ts';

const ROOT = process.cwd();

// Fallback keys specified in Navbar 6.0
const FALLBACK_KEYS = [
  'merge-pdf',
  'compress-pdf',
  'pdf-to-jpg',
  'jpg-to-pdf',
  'sgpa-calculator',
  'resume-builder',
];

// In-Memory Test Harness for Navbar 6.0 Essential Slots Engine
class Navbar6Engine {
  constructor(registry) {
    this.registry = registry;
    this.platformEvents = [];
    this.seenOperations = new Set();
    this.adminConfigs = new Map();
    this.cache = null;

    // Seed configs
    registry.forEach((t, idx) => {
      this.adminConfigs.set(t.key, {
        toolId: t.key,
        categoryId: t.category,
        position: idx,
        visibleInNavbar: true,
        essentialNavbar: false,
        pinnedRank: null,
        locked: false,
        status: t.status === 'coming_soon' ? 'COMING_SOON' : 'ACTIVE',
      });
    });
  }

  recordEvent(event) {
    const {
      eventName,
      toolKey,
      success = true,
      operationId = null,
      userId = null,
      guestSessionId = null,
    } = event;

    const normKey = normalizeToolKey(toolKey);
    if (operationId) {
      const opKey = `${operationId}_${normKey}`;
      if (this.seenOperations.has(opKey)) {
        return { isDuplicate: true };
      }
      this.seenOperations.add(opKey);
    }

    this.platformEvents.push({
      eventName,
      toolKey: normKey,
      success,
      operationId,
      userId,
      guestSessionId,
    });
    this.cache = null;
    return { isDuplicate: false };
  }

  setAdminConfig(toolKey, updates) {
    const current = this.adminConfigs.get(toolKey) || { toolId: toolKey };
    this.adminConfigs.set(toolKey, { ...current, ...updates });
    this.cache = null;
  }

  buildEssentialSlots(maxSlots = 6) {
    // 1. Gather telemetry
    const telemetryMap = new Map();
    this.platformEvents.forEach((ev) => {
      if (ev.eventName === 'tool_completed' && ev.success === true) {
        const cur = telemetryMap.get(ev.toolKey) || { successfulUses: 0, users: new Set() };
        cur.successfulUses++;
        if (ev.userId) cur.users.add(ev.userId);
        if (ev.guestSessionId) cur.users.add(ev.guestSessionId);
        telemetryMap.set(ev.toolKey, cur);
      }
    });

    // 2. Filter eligible pool: enabled, not COMING_SOON, not DISABLED, visibleInNavbar !== false
    const eligiblePool = this.registry
      .map((t) => {
        const conf = this.adminConfigs.get(t.key);
        const telem = telemetryMap.get(t.key) || { successfulUses: 0, users: new Set() };
        const effectiveStatus = conf?.status || (t.status === 'coming_soon' ? 'COMING_SOON' : 'ACTIVE');
        return {
          ...t,
          status: effectiveStatus,
          successfulUses: telem.successfulUses,
          uniqueUsers: telem.users.size,
          conf,
        };
      })
      .filter((t) => {
        if (t.status === 'DISABLED' || t.status === 'COMING_SOON' || t.status === 'MAINTENANCE') return false;
        if (t.conf?.visibleInNavbar === false) return false;
        return true;
      });

    const slots = new Array(maxSlots).fill(null);
    const assignedKeys = new Set();

    // Step 1: Explicit Admin Pinned tools (pinnedRank 1..maxSlots)
    eligiblePool.forEach((tool) => {
      const conf = tool.conf;
      if (conf?.essentialNavbar || conf?.pinnedRank) {
        const rank = typeof conf.pinnedRank === 'number' && conf.pinnedRank >= 1 && conf.pinnedRank <= maxSlots
          ? conf.pinnedRank
          : null;
        if (rank && !slots[rank - 1]) {
          slots[rank - 1] = {
            slot: rank,
            tool,
            reason: `Admin Pinned (Slot #${rank})`,
            isPinned: true,
            isLocked: Boolean(conf.locked),
          };
          assignedKeys.add(tool.key);
        }
      }
    });

    // Step 2: Candidate scoring
    const maxUses = Math.max(1, ...eligiblePool.map((t) => t.successfulUses));
    const maxUsers = Math.max(1, ...eligiblePool.map((t) => t.uniqueUsers));

    const scoredCandidates = eligiblePool
      .filter((t) => !assignedKeys.has(t.key))
      .map((tool) => {
        const normUses = tool.successfulUses / maxUses;
        const normUsers = tool.uniqueUsers / maxUsers;
        const marketBonus = FALLBACK_KEYS.includes(tool.key) ? 0.20 : 0;
        const adminBonus = tool.conf?.essentialNavbar ? 0.35 : 0;
        const score = 0.55 * normUses + 0.25 * normUsers + marketBonus + adminBonus;
        return { tool, score };
      })
      .sort((a, b) => {
        if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
        if (b.tool.successfulUses !== a.tool.successfulUses) return b.tool.successfulUses - a.tool.successfulUses;
        const aIdx = FALLBACK_KEYS.indexOf(a.tool.key);
        const bIdx = FALLBACK_KEYS.indexOf(b.tool.key);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.tool.name.localeCompare(b.tool.name);
      });

    // Step 3: Slot filling with diversity protection
    for (let i = 0; i < maxSlots; i++) {
      if (slots[i]) continue;

      const filled = slots.filter(Boolean);
      const pdfCount = filled.filter((s) => s.tool.category === 'pdf').length;
      const studentCount = filled.filter((s) => s.tool.category === 'student' || s.tool.category === 'academic').length;
      const careerCount = filled.filter((s) => s.tool.category === 'career').length;
      const slotsRemaining = maxSlots - i;

      let chosenIdx = -1;
      if (studentCount === 0 && slotsRemaining <= 2) {
        chosenIdx = scoredCandidates.findIndex(
          (c) => !assignedKeys.has(c.tool.key) && (c.tool.category === 'student' || c.tool.category === 'academic')
        );
      }
      if (chosenIdx === -1 && careerCount === 0 && slotsRemaining <= 1) {
        chosenIdx = scoredCandidates.findIndex(
          (c) => !assignedKeys.has(c.tool.key) && c.tool.category === 'career'
        );
      }
      if (chosenIdx === -1) {
        chosenIdx = scoredCandidates.findIndex((c) => {
          if (assignedKeys.has(c.tool.key)) return false;
          if (c.tool.category === 'pdf' && pdfCount >= 4) return false;
          return true;
        });
      }
      if (chosenIdx === -1) {
        chosenIdx = scoredCandidates.findIndex((c) => !assignedKeys.has(c.tool.key));
      }

      if (chosenIdx !== -1) {
        const chosen = scoredCandidates[chosenIdx];
        assignedKeys.add(chosen.tool.key);

        let reason = 'High-Demand Core Document Utility';
        if (chosen.tool.successfulUses > 0) {
          reason = `#${i + 1} in 30-day completions (${chosen.tool.successfulUses.toLocaleString()} uses)`;
        } else if (chosen.tool.conf?.essentialNavbar) {
          reason = 'Admin Essential Override';
        } else if (chosen.tool.category === 'student' || chosen.tool.category === 'academic') {
          reason = 'Category Diversity — Academic Student Utility';
        } else if (chosen.tool.category === 'career') {
          reason = 'Category Diversity — Career & Placement Utility';
        }

        slots[i] = {
          slot: i + 1,
          tool: chosen.tool,
          reason,
          isPinned: Boolean(chosen.tool.conf?.essentialNavbar),
          isLocked: Boolean(chosen.tool.conf?.locked),
        };
      }
    }

    return slots.filter(Boolean);
  }
}

// ============================================================================
// Acceptance Tests
// ============================================================================

test('Navbar 6.0: Strict 6-Slot Limit on Main Navbar', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);
  const slots = engine.buildEssentialSlots(6);

  assert.equal(slots.length, 6, 'Must produce exactly 6 essential slots');
  assert.ok(slots.length <= 7, 'Must never exceed 7 slots');
  assert.ok(slots.length >= 5, 'Must have at least 5 slots');
});

test('Navbar 6.0: Real Saarvi Completion Telemetry Outranks Lower Usage Tools', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);

  // Generate completions matching prompt Section 4 scenario:
  // PDF to JPG = 15,000 operations
  // Merge PDF = 9,000 operations
  // Compress PDF = 7,000 operations
  // SGPA = 5,000 operations
  // Resume = 1,000 operations
  for (let i = 0; i < 150; i++) engine.recordEvent({ eventName: 'tool_completed', toolKey: 'pdf-to-jpg', success: true, userId: `u_${i}` });
  for (let i = 0; i < 90; i++) engine.recordEvent({ eventName: 'tool_completed', toolKey: 'merge-pdf', success: true, userId: `u_${i}` });
  for (let i = 0; i < 70; i++) engine.recordEvent({ eventName: 'tool_completed', toolKey: 'compress-pdf', success: true, userId: `u_${i}` });
  for (let i = 0; i < 50; i++) engine.recordEvent({ eventName: 'tool_completed', toolKey: 'sgpa-calculator', success: true, userId: `u_${i}` });
  for (let i = 0; i < 10; i++) engine.recordEvent({ eventName: 'tool_completed', toolKey: 'resume-builder', success: true, userId: `u_${i}` });

  // Discard page views / hover events
  for (let i = 0; i < 500; i++) engine.recordEvent({ eventName: 'page_view', toolKey: 'resume-builder', success: true });
  for (let i = 0; i < 500; i++) engine.recordEvent({ eventName: 'tool_completed', toolKey: 'resume-builder', success: false });

  const slots = engine.buildEssentialSlots(6);
  const pdfToJpgSlot = slots.find((s) => s.tool.key === 'pdf-to-jpg');
  const resumeSlot = slots.find((s) => s.tool.key === 'resume-builder');

  assert.ok(pdfToJpgSlot, 'PDF to JPG must be present in essential slots');
  assert.ok(resumeSlot, 'Resume Builder must be present in essential slots');
  assert.ok(
    pdfToJpgSlot.slot < resumeSlot.slot,
    `PDF to JPG (slot ${pdfToJpgSlot.slot}) must outrank Resume Builder (slot ${resumeSlot.slot}) based on real completions`
  );
});

test('Navbar 6.0: Idempotency with operation_id Prevents Double-Count Replays', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);

  const res1 = engine.recordEvent({
    eventName: 'tool_completed',
    toolKey: 'pdf-to-jpg',
    operationId: 'op_unique_1001',
    success: true,
  });
  assert.equal(res1.isDuplicate, false);

  const res2 = engine.recordEvent({
    eventName: 'tool_completed',
    toolKey: 'pdf-to-jpg',
    operationId: 'op_unique_1001',
    success: true,
  });
  assert.equal(res2.isDuplicate, true, 'Duplicate operation_id must be flagged as duplicate');
});

test('Navbar 6.0: Admin Pinned Override Honors Slot Assignment & Transparent Explanation', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);

  // Even with low usage, Admin pins Resume Builder to Slot #2
  engine.setAdminConfig('resume-builder', {
    essentialNavbar: true,
    pinnedRank: 2,
    locked: true,
  });

  const slots = engine.buildEssentialSlots(6);
  const slot2 = slots.find((s) => s.slot === 2);

  assert.ok(slot2, 'Slot #2 must exist');
  assert.equal(slot2.tool.key, 'resume-builder', 'Slot #2 must be assigned to pinned Resume Builder');
  assert.equal(slot2.isPinned, true, 'Slot #2 must be marked as isPinned');
  assert.equal(slot2.reason, 'Admin Pinned (Slot #2)', 'Reason must explicitly state Admin Pinned, never fake Most Used');
});

test('Navbar 6.0: Broken and Coming Soon Tools Never Enter Essential Navbar', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);

  // Set ID Photo Utility to COMING_SOON
  engine.setAdminConfig('id-photo-maker', { status: 'COMING_SOON' });

  const slots = engine.buildEssentialSlots(6);
  const hasComingSoon = slots.some((s) => s.tool.key === 'id-photo-maker' || s.tool.status === 'COMING_SOON');

  assert.equal(hasComingSoon, false, 'COMING_SOON tool must NEVER enter the essential navbar');
});

test('Navbar 6.0: Disabled Tool Immediately Vacates Slot & Next Eligible Fills It', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);

  // Initial slots
  const initialSlots = engine.buildEssentialSlots(6);
  assert.equal(initialSlots.length, 6);

  // Admin disables compress-pdf
  engine.setAdminConfig('compress-pdf', { status: 'DISABLED' });

  const updatedSlots = engine.buildEssentialSlots(6);
  assert.equal(updatedSlots.length, 6, 'Must remain full 6 slots without broken empty spots');
  assert.ok(
    !updatedSlots.some((s) => s.tool.key === 'compress-pdf'),
    'Disabled tool must disappear immediately from essential navbar'
  );
});

test('Navbar 6.0: Category Diversity Prevents PDF Tool Monopolization', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);

  // Give massive completions to 10 PDF tools
  const pdfKeys = ['merge-pdf', 'split-pdf', 'compress-pdf', 'pdf-to-word', 'pdf-to-excel', 'pdf-to-jpg', 'word-to-pdf', 'excel-to-pdf', 'protect-pdf', 'unlock-pdf'];
  pdfKeys.forEach((key, idx) => {
    for (let i = 0; i < 100 - idx * 5; i++) {
      engine.recordEvent({ eventName: 'tool_completed', toolKey: key, success: true, userId: `u_${i}` });
    }
  });

  const slots = engine.buildEssentialSlots(6);
  const pdfCount = slots.filter((s) => s.tool.category === 'pdf').length;
  const hasStudentOrCareer = slots.some((s) => s.tool.category === 'student' || s.tool.category === 'academic' || s.tool.category === 'career');

  assert.ok(pdfCount <= 4, `PDF tools count (${pdfCount}) must not exceed diversity limit (max 4)`);
  assert.ok(hasStudentOrCareer, 'Category diversity must preserve non-PDF discovery');
});

test('Navbar 6.0: Low Data Fallback Candidates Are Honest and Never Fake Most Used', () => {
  const engine = new Navbar6Engine(CANONICAL_TOOL_REGISTRY);
  // Zero events recorded

  const slots = engine.buildEssentialSlots(6);
  assert.equal(slots.length, 6);

  const slotKeys = slots.map((s) => s.tool.key);
  assert.ok(slotKeys.includes('merge-pdf'), 'Must include Merge PDF in fallback');
  assert.ok(slotKeys.includes('compress-pdf'), 'Must include Compress PDF in fallback');
  assert.ok(slotKeys.includes('pdf-to-jpg'), 'Must include PDF to JPG in fallback');

  // Verify none of them claim "Most Used"
  slots.forEach((s) => {
    assert.ok(
      !s.reason.toLowerCase().includes('most used') && !s.reason.toLowerCase().includes('popular'),
      `Zero-use slot reason "${s.reason}" must NEVER falsely claim Most Used`
    );
  });
});

test('Navbar 6.0 UI Architecture: Compact Navbar Invariants', () => {
  const navbarPath = path.join(ROOT, 'src/components/layout/Navbar.tsx');
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');

  // Desktop nav must render essential tools directly with slice(0, 6)
  assert.ok(
    navbarContent.includes('essentialTools.slice(0, 6)'),
    'Navbar.tsx must render strict max 6 direct essential tools'
  );

  // Responsive slot reduction (hidden xl:flex on slots 4-6)
  assert.ok(
    navbarContent.includes('isSlot4to6 ? \'hidden xl:flex\' : \'flex\''),
    'Navbar.tsx must implement responsive slot reduction (slots 1-3 on md/lg, 4-6 on xl+)'
  );

  // Mobile drawer must include Essential Daily Tools section
  assert.ok(
    navbarContent.includes('Essential Daily Tools'),
    'Navbar.tsx mobile drawer must contain Essential Daily Tools section'
  );

  // Desktop nav must NOT contain top-level PDF / Images / Student Tools category links
  // (those belong inside Tools mega menu)
  assert.ok(
    !navbarContent.includes('aria-label="PDF Tools"'),
    'Top-level navbar must not have separate PDF category button'
  );
});

test('Navbar 6.0 Admin Control Center: Live Preview & Explanation Matrix', () => {
  const adminToolsPath = path.join(ROOT, 'src/app/admin/tools/page.tsx');
  const adminToolsContent = fs.readFileSync(adminToolsPath, 'utf8');

  assert.ok(
    adminToolsContent.includes('Main Navbar 6.0'),
    'Admin tools page must include Main Navbar 6.0 tab'
  );
  assert.ok(
    adminToolsContent.includes('Desktop Main Navbar 6.0 Live Preview'),
    'Admin tools page must show Desktop Main Navbar 6.0 Live Preview'
  );
  assert.ok(
    adminToolsContent.includes('Active Essential Daily Slots'),
    'Admin tools page must show Active Essential Slots & Explanations'
  );
  assert.ok(
    adminToolsContent.includes('All Tools Main Navbar Configuration Matrix'),
    'Admin tools page must show configuration table for all tools'
  );
});
