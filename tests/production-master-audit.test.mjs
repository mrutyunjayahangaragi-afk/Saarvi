import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Phase 13 & 41: OpenRouter Security & Zero Client Secret Leakage', () => {
  // Check openrouter-provider.ts
  const openRouterProviderPath = path.join(ROOT_DIR, 'src/lib/ai/providers/openrouter-provider.ts');
  const openRouterProviderCode = fs.readFileSync(openRouterProviderPath, 'utf8');

  // Verify server-side key usage
  assert.ok(
    openRouterProviderCode.includes('process.env.OPENROUTER_API_KEY'),
    'OpenRouter provider must read server-side OPENROUTER_API_KEY'
  );
  assert.ok(
    !openRouterProviderCode.includes('NEXT_PUBLIC_OPENROUTER_API_KEY'),
    'Must NEVER use NEXT_PUBLIC_OPENROUTER_API_KEY'
  );

  // Verify HTTP-Referer is https://saarvi.app
  assert.ok(
    openRouterProviderCode.includes('"HTTP-Referer": "https://saarvi.app"'),
    'HTTP-Referer must be canonical https://saarvi.app'
  );

  // Verify OPENROUTER_MODEL support
  assert.ok(
    openRouterProviderCode.includes('process.env.OPENROUTER_MODEL'),
    'OpenRouter provider must support process.env.OPENROUTER_MODEL'
  );

  // Check .env.example
  const envExamplePath = path.join(ROOT_DIR, '.env.example');
  const envExampleCode = fs.readFileSync(envExamplePath, 'utf8');
  assert.ok(
    envExampleCode.includes('NEXT_PUBLIC_APP_URL=https://saarvi.app'),
    '.env.example must specify canonical https://saarvi.app'
  );
  assert.ok(
    envExampleCode.includes('OPENROUTER_API_KEY='),
    '.env.example must declare OPENROUTER_API_KEY'
  );
  assert.ok(
    envExampleCode.includes('OPENROUTER_MODEL='),
    '.env.example must declare OPENROUTER_MODEL'
  );
});

test('Phase 14 & 39: AI Tool Routing & Deterministic Intent Resolution', () => {
  const discoveryEnginePath = path.join(ROOT_DIR, 'src/lib/ai/tool-discovery-engine.ts');
  const discoveryCode = fs.readFileSync(discoveryEnginePath, 'utf8');

  // Verify high-frequency intent mappings exist in engine
  assert.ok(discoveryCode.includes("'pdf to jpg'"), 'Must include pdf to jpg intent');
  assert.ok(discoveryCode.includes("'convert my pdf to jpeg'"), 'Must include convert my pdf to jpeg intent');
  assert.ok(discoveryCode.includes("'reduce the size of my pdf'"), 'Must include reduce the size of my pdf intent');
  assert.ok(discoveryCode.includes("'make pdf from photos'"), 'Must include make pdf from photos intent');
  assert.ok(discoveryCode.includes("'calculate vtu sgpa'"), 'Must include calculate vtu sgpa intent');
  assert.ok(discoveryCode.includes("'build professional resume'"), 'Must include build professional resume intent');
  assert.ok(discoveryCode.includes("'ats checker'"), 'Must include ats checker intent');

  // Verify route validation in ai-assistant-router.ts
  const routerPath = path.join(ROOT_DIR, 'src/lib/ai/ai-assistant-router.ts');
  const routerCode = fs.readFileSync(routerPath, 'utf8');

  assert.ok(
    routerCode.includes('function isValidCanonicalRoute(route: string): boolean'),
    'Router must implement isValidCanonicalRoute'
  );
  assert.ok(
    routerCode.includes('CANONICAL_TOOL_REGISTRY.some'),
    'isValidCanonicalRoute must validate against CANONICAL_TOOL_REGISTRY'
  );
});

test('Phase 17 & 18: Floating AI Interface UX & Accessibility Standards', () => {
  const aiComponentPath = path.join(ROOT_DIR, 'src/components/ai/GlobalAIAssistant.tsx');
  const aiCode = fs.readFileSync(aiComponentPath, 'utf8');

  // Accessible trigger label
  assert.ok(
    aiCode.includes('aria-label="Open Saarvi AI"'),
    'Floating AI launcher must have accessible label "Open Saarvi AI"'
  );

  // Minimum 44px touch target (min-h-[48px] min-w-[48px])
  assert.ok(
    aiCode.includes('min-h-[48px] min-w-[48px]'),
    'Launcher must meet minimum 44px target requirement'
  );

  // Header branding: Saarvi AI 2.0 & Study. Work. Grow.
  assert.ok(aiCode.includes('Study. Work. Grow.'), 'Chat header must include brand tagline');

  // Suggested prompt chips
  assert.ok(aiCode.includes('Convert PDF to JPG'), 'Must include Convert PDF to JPG chip');
  assert.ok(aiCode.includes('Calculate SGPA'), 'Must include Calculate SGPA chip');
  assert.ok(aiCode.includes('Build a resume'), 'Must include Build a resume chip');
  assert.ok(aiCode.includes('Compress a PDF'), 'Must include Compress a PDF chip');

  // Placeholder
  assert.ok(aiCode.includes('placeholder="Ask Saarvi AI..."'), 'Must have placeholder "Ask Saarvi AI..."');

  // Copy support
  assert.ok(aiCode.includes('navigator.clipboard.writeText'), 'Must support copy response to clipboard');
});

test('Phase 19, 20 & 26: Privacy-Safe AI Telemetry & Zero Document Leakage', () => {
  const toolAssistantApiPath = path.join(ROOT_DIR, 'src/app/api/ai/tool-assistant/route.ts');
  const toolAssistantCode = fs.readFileSync(toolAssistantApiPath, 'utf8');

  // Must log safe ai_query event to analyticsStore
  assert.ok(
    toolAssistantCode.includes("eventType: 'ai_query'"),
    'Tool assistant API must log ai_query telemetry event'
  );
  assert.ok(
    toolAssistantCode.includes('durationMs'),
    'Telemetry must measure latency (durationMs)'
  );

  // Invariant: Must NEVER store user prompt or file content in telemetry event
  assert.ok(
    !toolAssistantCode.includes('prompt: message') && !toolAssistantCode.includes('message: message'),
    'Telemetry must NOT store raw message text by default'
  );
});

test('Phase 22 & 27: Server-Authoritative Admin Analytics Authorization', () => {
  const overviewRoutePath = path.join(ROOT_DIR, 'src/app/api/admin/analytics/overview/route.ts');
  const overviewCode = fs.readFileSync(overviewRoutePath, 'utf8');

  // Server-authoritative admin check
  assert.ok(
    overviewCode.includes("getAuthenticatedAdmin(request, 'VIEW')"),
    'Overview API must require server-verified admin with VIEW permission'
  );
  assert.ok(
    overviewCode.includes('authResult.success'),
    'Overview API must verify authResult.success'
  );
});

test('Phase 32: Database Migration & RLS Security on Telemetry', () => {
  const migrationPath = path.join(ROOT_DIR, 'supabase/migrations/011_phase35_40_master.sql');
  const migrationCode = fs.readFileSync(migrationPath, 'utf8');

  assert.ok(
    migrationCode.includes('CREATE TABLE IF NOT EXISTS public.analytics_events'),
    'Migration 011 must define analytics_events table'
  );
  assert.ok(
    migrationCode.includes('ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY'),
    'analytics_events table must enable RLS'
  );
  assert.ok(
    migrationCode.includes('CREATE POLICY "Service role analytics access" ON public.analytics_events'),
    'analytics_events read access must be restricted to service role'
  );
});
