import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import canonical tool registry
import { CANONICAL_TOOL_REGISTRY, CANONICAL_TOOL_CATEGORIES } from '../src/lib/tools/tool-registry.ts';

test('Tool Route Integrity — All registered tools have valid filesystem routes', () => {
  assert.ok(CANONICAL_TOOL_REGISTRY.length >= 45, `Expected >= 45 tools in registry, got ${CANONICAL_TOOL_REGISTRY.length}`);

  const missingRoutes = [];
  const keys = new Set();
  const routes = new Set();

  for (const tool of CANONICAL_TOOL_REGISTRY) {
    // 1. Check duplicate keys
    assert.ok(!keys.has(tool.key), `Duplicate tool key found: ${tool.key}`);
    keys.add(tool.key);

    // 2. Check route format
    assert.ok(tool.route.startsWith('/'), `Route must start with /: ${tool.route}`);

    // 3. Verify route exists in Next.js app directory
    const cleanRoute = tool.route.split('#')[0].split('?')[0];
    const directPath = path.join(process.cwd(), 'src/app', cleanRoute, 'page.tsx');
    const directPathJs = path.join(process.cwd(), 'src/app', cleanRoute, 'page.jsx');
    
    let exists = fs.existsSync(directPath) || fs.existsSync(directPathJs);
    
    // Dynamic tools route
    if (!exists && cleanRoute.startsWith('/tools/')) {
      const dynamicToolsPage = path.join(process.cwd(), 'src/app/tools/[slug]/page.tsx');
      if (fs.existsSync(dynamicToolsPage)) {
        exists = true;
      }
    }

    if (!exists) {
      missingRoutes.push({ key: tool.key, name: tool.name, route: tool.route });
    }
  }

  assert.strictEqual(
    missingRoutes.length,
    0,
    `Found ${missingRoutes.length} registered tools with missing routes: ${JSON.stringify(missingRoutes, null, 2)}`
  );
});

test('Tool Route Integrity — Specific Student & Career routes are verified', () => {
  const criticalRoutes = [
    '/student/jobs',
    '/student/interviews',
    '/student/skills',
    '/student/ats',
    '/student/calculator',
    '/student/assignments',
    '/student/resume',
    '/student/cover-letter',
    '/student/sgpa-calculator',
    '/student/cgpa-calculator',
    '/student/attendance',
    '/student/timetable',
    '/student/study-planner',
    '/student/marks-calculator',
  ];

  for (const route of criticalRoutes) {
    const filePath = path.join(process.cwd(), 'src/app', route, 'page.tsx');
    assert.ok(
      fs.existsSync(filePath),
      `Critical route file must exist at ${filePath}`
    );
  }
});

test('Tool Route Integrity — All canonical categories are populated with real tools', () => {
  const categoryIds = CANONICAL_TOOL_CATEGORIES.map(c => c.id);
  
  for (const catId of categoryIds) {
    const toolsInCat = CANONICAL_TOOL_REGISTRY.filter(t => t.category === catId);
    assert.ok(
      toolsInCat.length > 0,
      `Category '${catId}' must have at least one tool registered, found ${toolsInCat.length}`
    );
  }
});

test('Tool Route Integrity — No broken internal links across the application source code', () => {
  function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFiles(fullPath));
      } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
        results.push(fullPath);
      }
    });
    return results;
  }

  const allFiles = getFiles(path.join(process.cwd(), 'src'));
  const linkRegex = /href=[\"'](\/[^\"'#\?]+)[\"']|router\.push\([\"'](\/[^\"'#\?]+)[\"']/g;
  const links = new Set();

  for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = linkRegex.exec(content)) !== null) {
      const target = m[1] || m[2];
      if (target && !target.startsWith('/api') && !target.startsWith('/_next')) {
        links.add(target);
      }
    }
  }

  const deadLinks = [];
  for (const link of links) {
    const clean = link.replace(/\/$/, '');
    if (!clean) continue;
    const p1 = path.join(process.cwd(), 'src/app', clean, 'page.tsx');
    const p2 = path.join(process.cwd(), 'src/app', clean, 'page.jsx');
    const p3 = path.join(process.cwd(), 'src/app', clean, 'route.ts');
    const p4 = path.join(process.cwd(), 'src/app', clean, 'route.js');
    let valid = fs.existsSync(p1) || fs.existsSync(p2) || fs.existsSync(p3) || fs.existsSync(p4);
    if (!valid && clean.startsWith('/tools/')) valid = fs.existsSync(path.join(process.cwd(), 'src/app/tools/[slug]/page.tsx'));
    if (!valid && clean.startsWith('/dashboard/conversations/')) valid = fs.existsSync(path.join(process.cwd(), 'src/app/dashboard/conversations/[id]/page.tsx'));
    if (!valid) deadLinks.push(link);
  }

  assert.strictEqual(
    deadLinks.length,
    0,
    `Found broken internal links in codebase: ${JSON.stringify(deadLinks)}`
  );
});
