import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTACT_EMAIL,
  SUPPORT_EMAIL,
  SITE_CONFIG,
} from '../src/config/site.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Contact Email Audit: central site configuration uses saarvinotifications@gmail.com', () => {
  assert.equal(CONTACT_EMAIL, 'saarvinotifications@gmail.com');
  assert.equal(SUPPORT_EMAIL, 'saarvinotifications@gmail.com');
  assert.equal(SITE_CONFIG.contactEmail, 'saarvinotifications@gmail.com');
  assert.equal(SITE_CONFIG.supportEmail, 'saarvinotifications@gmail.com');
});

test('Contact Email Audit: user-facing pages and components reference saarvinotifications@gmail.com', () => {
  const filesToCheck = [
    'src/config/site.ts',
    'src/app/contact/page.tsx',
    'src/app/about/page.tsx',
    'src/app/privacy/page.tsx',
    'src/app/terms/page.tsx',
    'src/components/layout/Footer.tsx',
    'src/context/PlatformContext.tsx',
    'src/app/api/platform/settings/route.ts',
    'src/lib/notifications/providers/email/gmail-provider.ts',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `File does not exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');

    assert.ok(
      content.includes('saarvinotifications@gmail.com'),
      `File ${relPath} should include saarvinotifications@gmail.com`
    );

    // Verify no legacy emails
    assert.ok(
      !content.includes('support@saarvi.in'),
      `File ${relPath} must NOT include legacy support@saarvi.in`
    );
    assert.ok(
      !content.includes('contact@saarvi.in'),
      `File ${relPath} must NOT include legacy contact@saarvi.in`
    );
  }
});
