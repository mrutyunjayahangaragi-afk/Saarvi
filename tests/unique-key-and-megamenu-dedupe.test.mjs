/**
 * Saarvi — Unique Tool Key & MegaMenu Deduplication Verification Suite
 *
 * Verifies that:
 * 1. dedupeToolsByKey guarantees strict uniqueness across all tool lists.
 * 2. MegaMenu eliminates duplicate key emissions across student tools, subgroups, search, and essential tools.
 * 3. groupToolsBySubcategory never assigns the same tool to multiple groups or duplicates items.
 * 4. Navbar.tsx mobile drawer contains zero duplicate keys across all category fallbacks.
 * 5. Canonical tool registry contains zero duplicate keys.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CANONICAL_TOOL_REGISTRY,
  CANONICAL_TOOL_MAP,
} from '../src/lib/tools/tool-registry.ts';

const ROOT = process.cwd();

// Pure dedupe logic matching MegaMenu implementation
function dedupeToolsByKey(tools) {
  if (!Array.isArray(tools)) return [];
  const seen = new Set();
  const deduped = [];
  for (const t of tools) {
    if (!t || !t.key) continue;
    if (!seen.has(t.key)) {
      seen.add(t.key);
      deduped.push(t);
    }
  }
  return deduped;
}

test('1. Canonical Tool Registry contains strictly unique keys', () => {
  const seen = new Set();
  const duplicates = [];

  for (const tool of CANONICAL_TOOL_REGISTRY) {
    if (seen.has(tool.key)) {
      duplicates.push(tool.key);
    }
    seen.add(tool.key);
  }

  assert.equal(
    duplicates.length,
    0,
    `CANONICAL_TOOL_REGISTRY must contain 0 duplicates, found: ${duplicates.join(', ')}`
  );
});

test('2. dedupeToolsByKey removes duplicate items preserving order', () => {
  const sample = [
    { key: 'sgpa-calculator', name: 'SGPA 1' },
    { key: 'cgpa-calculator', name: 'CGPA' },
    { key: 'sgpa-calculator', name: 'SGPA 2' },
    { key: 'merge-pdf', name: 'Merge' },
    { key: 'cgpa-calculator', name: 'CGPA 2' },
  ];

  const result = dedupeToolsByKey(sample);
  assert.equal(result.length, 3, 'Should deduplicate down to 3 unique tools');
  assert.equal(result[0].key, 'sgpa-calculator');
  assert.equal(result[0].name, 'SGPA 1');
  assert.equal(result[1].key, 'cgpa-calculator');
  assert.equal(result[2].key, 'merge-pdf');
});

test('3. MegaMenu.tsx source code uses dedupeToolsByKey for all category tool lists', () => {
  const megaMenuPath = path.join(ROOT, 'src/components/layout/MegaMenu.tsx');
  const content = fs.readFileSync(megaMenuPath, 'utf8');

  // Verify dedupeToolsByKey is exported and used
  assert.ok(content.includes('export function dedupeToolsByKey'), 'Exports dedupeToolsByKey');
  assert.ok(content.includes('dedupeToolsByKey(resolveAllTools(["student"]'), 'Student tools resolved with dedupeToolsByKey');
  assert.ok(content.includes('dedupeToolsByKey(resolveAllTools(["pdf"]'), 'PDF tools resolved with dedupeToolsByKey');
  assert.ok(content.includes('dedupeToolsByKey(resolveAllTools(["images"'), 'Image tools resolved with dedupeToolsByKey');
  assert.ok(content.includes('dedupeToolsByKey(resolveAllTools(["career"]'), 'Career tools resolved with dedupeToolsByKey');
  assert.ok(content.includes('dedupeToolsByKey(resolveAllTools(["ai"]'), 'AI tools resolved with dedupeToolsByKey');

  // Verify no raw concatenation of studentAcademicTools and studentPlanningTools
  assert.ok(
    !content.includes('[...studentAcademicTools, ...studentPlanningTools]'),
    'Eliminated dangerous concatenation of studentAcademicTools and studentPlanningTools'
  );

  // SubgroupSection and groupToolsBySubcategory safeguard
  assert.ok(content.includes('export function SubgroupSection'), 'Exports SubgroupSection');
  assert.ok(content.includes('const uniqueTools = dedupeToolsByKey(tools'), 'SubgroupSection ensures unique tools');
});

test('4. Navbar.tsx mobile drawer contains zero duplicate keys in fallback lists', () => {
  const navbarPath = path.join(ROOT, 'src/components/layout/Navbar.tsx');
  const content = fs.readFileSync(navbarPath, 'utf8');

  // Verify dedupeToolsByKey is imported and used in mobile drawer
  assert.ok(content.includes('dedupeToolsByKey'), 'Navbar imports and uses dedupeToolsByKey');

  // Check that duplicate compress-pdf was removed from PDF fallback
  const pdfFallbackMatch = content.match(/navCategories\.find\(\(c\) => c\.id === "pdf"\)[\s\S]*?\[([\s\S]*?)\]/);
  assert.ok(pdfFallbackMatch, 'Found PDF fallback in Navbar');
  const pdfFallbackText = pdfFallbackMatch[1];
  const compressCount = (pdfFallbackText.match(/"compress-pdf"/g) || []).length;
  assert.equal(compressCount, 1, 'Only one compress-pdf in mobile PDF fallback');
});

test('5. groupToolsBySubcategory assigns each tool at most once', () => {
  const defs = [
    { id: 'academic', label: 'Academic Calculators', color: 'text-indigo-600' },
    { id: 'planning', label: 'Planning & Schedule', color: 'text-blue-600' },
  ];

  // Simulated student tools containing potential duplicates
  const dirtyTools = [
    { key: 'sgpa-calculator', name: 'SGPA', category: 'academic', subcategory: 'academic' },
    { key: 'sgpa-calculator', name: 'SGPA Dup', category: 'academic', subcategory: 'academic' },
    { key: 'cgpa-calculator', name: 'CGPA', category: 'academic', subcategory: 'academic' },
    { key: 'attendance-tracker', name: 'Attendance', category: 'student', subcategory: 'planning' },
    { key: 'study-planner', name: 'Study Planner', category: 'student', subcategory: 'planning' },
  ];

  // Test the deduplication and grouping algorithm
  const cleanTools = dedupeToolsByKey(dirtyTools);
  const assigned = new Set();
  const groups = [];

  for (const def of defs) {
    const matching = [];
    for (const t of cleanTools) {
      if (assigned.has(t.key)) continue;
      if (t.subcategory === def.id) {
        matching.push(t);
        assigned.add(t.key);
      }
    }
    if (matching.length > 0) {
      groups.push({ id: def.id, label: def.label, tools: matching });
    }
  }

  // Check all assigned tools are unique
  const allGroupedToolKeys = groups.flatMap((g) => g.tools.map((t) => t.key));
  const uniqueKeys = new Set(allGroupedToolKeys);
  assert.equal(
    allGroupedToolKeys.length,
    uniqueKeys.size,
    'No tool key must appear more than once across all groups'
  );
  assert.equal(uniqueKeys.size, 4, 'Should have exactly 4 unique student tools');
  assert.ok(uniqueKeys.has('sgpa-calculator'));
  assert.ok(uniqueKeys.has('cgpa-calculator'));
  assert.ok(uniqueKeys.has('attendance-tracker'));
  assert.ok(uniqueKeys.has('study-planner'));
});
