import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

// =============================================================================
// PHASE 40 PART A: NAVIGATION MANAGEMENT & PERSISTENCE
// =============================================================================

test('Phase 40 Part A — Migration 011 defines navigation_configs schema with indexes and RLS', () => {
  const migrationPath = path.join(ROOT_DIR, 'supabase/migrations/011_phase35_40_master.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration 011 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.navigation_configs'));
  assert.ok(sql.includes('tool_id TEXT NOT NULL'));
  assert.ok(sql.includes('category_id TEXT NOT NULL'));
  assert.ok(sql.includes('position INTEGER NOT NULL DEFAULT 0'));
  assert.ok(sql.includes('visible_in_navbar BOOLEAN'));
  assert.ok(sql.includes('visible_in_mega_menu BOOLEAN'));
  assert.ok(sql.includes('visible_in_search BOOLEAN'));
  assert.ok(sql.includes('visible_in_homepage BOOLEAN'));
  assert.ok(sql.includes('visible_in_ai BOOLEAN'));
  assert.ok(sql.includes('featured BOOLEAN'));
  assert.ok(sql.includes('badge TEXT'));
  assert.ok(sql.includes('status TEXT'));
  assert.ok(sql.includes('ALTER TABLE public.navigation_configs ENABLE ROW LEVEL SECURITY'));
});

test('Phase 40 Part A — Navigation Store and Admin Navigation Page exist and handle ordering & toggles', () => {
  const storePath = path.join(ROOT_DIR, 'src/lib/navigation/navigation-store.ts');
  const pagePath = path.join(ROOT_DIR, 'src/app/admin/navigation/page.tsx');
  const apiPath = path.join(ROOT_DIR, 'src/app/api/admin/navigation/route.ts');

  assert.ok(fs.existsSync(storePath), 'navigation-store.ts must exist');
  assert.ok(fs.existsSync(pagePath), 'src/app/admin/navigation/page.tsx must exist');
  assert.ok(fs.existsSync(apiPath), 'src/app/api/admin/navigation/route.ts must exist');

  const storeContent = fs.readFileSync(storePath, 'utf-8');
  assert.ok(storeContent.includes('getAllConfigs'));
  assert.ok(storeContent.includes('updateConfig'));
  assert.ok(storeContent.includes('reorderCategory'));
  assert.ok(storeContent.includes('resetToDefaults'));

  const pageContent = fs.readFileSync(pagePath, 'utf-8');
  assert.ok(pageContent.includes('visibleInNavbar'));
  assert.ok(pageContent.includes('visibleInMegaMenu'));
  assert.ok(pageContent.includes('visibleInSearch'));
  assert.ok(pageContent.includes('moveItem'));
});

// =============================================================================
// PHASE 40 PART B: USER DIRECTORY & SAFE PROFILES
// =============================================================================

test('Phase 40 Part B — Admin User Management supports Plan filter, Auth Provider, and safe profile modal', () => {
  const usersPagePath = path.join(ROOT_DIR, 'src/app/admin/users/page.tsx');
  assert.ok(fs.existsSync(usersPagePath), 'src/app/admin/users/page.tsx must exist');

  const content = fs.readFileSync(usersPagePath, 'utf-8');
  assert.ok(content.includes('planFilter'));
  assert.ok(content.includes('authProvider'));
  assert.ok(content.includes('detailUser'));
  assert.ok(content.includes('Zero Server Document Access Guarantee'));
  assert.ok(content.includes('User Account Management'));
});

// =============================================================================
// PHASE 40 PART C & D: PLATFORM ANALYTICS TELEMETRY & DASHBOARD
// =============================================================================

test('Phase 40 Part C & D — Migration 011 defines analytics_events table with high-throughput indexes', () => {
  const sql = fs.readFileSync(path.join(ROOT_DIR, 'supabase/migrations/011_phase35_40_master.sql'), 'utf-8');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.analytics_events'));
  assert.ok(sql.includes('user_id TEXT'));
  assert.ok(sql.includes('event_type TEXT NOT NULL'));
  assert.ok(sql.includes('tool_id TEXT'));
  assert.ok(sql.includes('tool_slug TEXT'));
  assert.ok(sql.includes('metadata JSONB'));
  assert.ok(sql.includes('idx_analytics_events_created_at'));
  assert.ok(sql.includes('idx_analytics_events_user_time'));
  assert.ok(sql.includes('idx_analytics_events_slug_time'));
});

test('Phase 40 Part C & D — Analytics Store, API endpoints, and Dashboard page exist with complete metrics', () => {
  const storePath = path.join(ROOT_DIR, 'src/lib/analytics/analytics-store.ts');
  const eventApiPath = path.join(ROOT_DIR, 'src/app/api/analytics/event/route.ts');
  const overviewApiPath = path.join(ROOT_DIR, 'src/app/api/admin/analytics/overview/route.ts');
  const analyticsPagePath = path.join(ROOT_DIR, 'src/app/admin/analytics/page.tsx');

  assert.ok(fs.existsSync(storePath), 'analytics-store.ts must exist');
  assert.ok(fs.existsSync(eventApiPath), 'api/analytics/event/route.ts must exist');
  assert.ok(fs.existsSync(overviewApiPath), 'api/admin/analytics/overview/route.ts must exist');
  assert.ok(fs.existsSync(analyticsPagePath), 'admin/analytics/page.tsx must exist');

  const storeContent = fs.readFileSync(storePath, 'utf-8');
  assert.ok(storeContent.includes('logEvent'));
  assert.ok(storeContent.includes('getOverview'));
  assert.ok(storeContent.includes('dau'));
  assert.ok(storeContent.includes('wau'));
  assert.ok(storeContent.includes('mau'));
  assert.ok(storeContent.includes('topTools'));
  assert.ok(storeContent.includes('unusedTools'));
  assert.ok(storeContent.includes('toolAdoptionRate'));
  assert.ok(storeContent.includes('discoveryChannels'));

  const pageContent = fs.readFileSync(analyticsPagePath, 'utf-8');
  assert.ok(pageContent.includes('DAU / WAU / MAU'));
  assert.ok(pageContent.includes('Tool Executions'));
  assert.ok(pageContent.includes('Tool Adoption Rate'));
  assert.ok(pageContent.includes('Top Tools by Volume'));
  assert.ok(pageContent.includes('Discovery Channels'));
  assert.ok(pageContent.includes('Under-Utilized Catalog Tools'));
  assert.ok(pageContent.includes('Privacy-Preserving Telemetry Guarantee'));
});
