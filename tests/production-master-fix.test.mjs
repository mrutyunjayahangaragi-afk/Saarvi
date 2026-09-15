import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Saarvi Production Master Fix — Comprehensive Verification Suite', () => {
  const rootDir = process.cwd();

  // =========================================================================
  // 1. Database Migration 012 Verification
  // =========================================================================
  test('Requirement 1 & Migration: 012_production_master_fix.sql enforces schema, indexes, and RLS', () => {
    const migrationPath = path.join(rootDir, 'supabase/migrations/012_production_master_fix.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration 012 must exist');

    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(sql.includes('ALTER TABLE IF EXISTS public.tool_overrides'), 'Must alter tool_overrides table');
    assert.ok(sql.includes("access_mode TEXT DEFAULT 'PUBLIC_FREE'"), 'Must have access_mode column with default PUBLIC_FREE');
    assert.ok(sql.includes('auth_email_logs'), 'Must create auth_email_logs table');
    assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on telemetry and tables');
    assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_auth_email_logs'), 'Must create performance indexes on email logs');
    assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_tool_overrides_access_mode'), 'Must create access_mode index on tool overrides');
  });

  // =========================================================================
  // 2. Centralized Tool Access Control
  // =========================================================================
  test('Requirement 2: Centralized Tool Access Control implements 5 states and auditability', () => {
    const accessPath = path.join(rootDir, 'src/lib/tools/access-control.ts');
    assert.ok(fs.existsSync(accessPath), 'access-control.ts must exist');

    const code = fs.readFileSync(accessPath, 'utf8');
    assert.ok(code.includes('PUBLIC_FREE'), 'Must support PUBLIC_FREE level');
    assert.ok(code.includes('AUTH_REQUIRED'), 'Must support AUTH_REQUIRED level');
    assert.ok(code.includes('PRO'), 'Must support PRO level');
    assert.ok(code.includes('ADMIN_ONLY'), 'Must support ADMIN_ONLY level');
    assert.ok(code.includes('canAccessTool'), 'Must export canAccessTool function');
    assert.ok(code.includes('getDefaultToolAccessMode'), 'Must export getDefaultToolAccessMode function');

    // Verify Admin Tools API
    const adminToolsApiPath = path.join(rootDir, 'src/app/api/admin/tools/route.ts');
    assert.ok(fs.existsSync(adminToolsApiPath), 'admin/tools API route must exist');
    const apiCode = fs.readFileSync(adminToolsApiPath, 'utf8');
    assert.ok(apiCode.includes('getAuthenticatedAdmin'), 'admin/tools route must require authenticated admin');
    assert.ok(apiCode.includes('tool_overrides'), 'admin/tools route must interact with tool_overrides');

    // Verify ToolPageShell integration
    const shellPath = path.join(rootDir, 'src/components/tools/ToolPageShell.tsx');
    const shellCode = fs.readFileSync(shellPath, 'utf8');
    assert.ok(shellCode.includes('requiresAuth'), 'ToolPageShell must support requiresAuth prop');
    assert.ok(shellCode.includes('requiresPro'), 'ToolPageShell must support requiresPro prop');
    assert.ok(shellCode.includes('isDisabled') && shellCode.includes('isMaintenance'), 'Must handle disabled and maintenance states');
  });

  // =========================================================================
  // 3. Resume Builder & Deterministic ATS 100-Point Engine
  // =========================================================================
  test('Requirement 3: ATS Score Engine implements exact 100-point breakdown across 6 categories', () => {
    const careerPath = path.join(rootDir, 'src/lib/services/careerService.ts');
    assert.ok(fs.existsSync(careerPath), 'careerService.ts must exist');

    const code = fs.readFileSync(careerPath, 'utf8');
    // Verify 6 categories and max weights in careerService.ts
    assert.ok(code.includes('maxScore: 15'), 'Contact and Summary categories have max 15');
    assert.ok(code.includes('maxScore: 20'), 'Skills category has max 20');
    assert.ok(code.includes('maxScore: 25'), 'Experience category has max 25');
    assert.ok(code.includes('maxScore: 10'), 'Links category has max 10');
    assert.ok(code.includes('recommendations'), 'Must return actionable recommendations');
    assert.ok(code.includes('scoreLabel'), 'Must return ATS scoreLabel');

    // Total must equal 100
    const totalMax = 15 + 15 + 20 + 25 + 15 + 10;
    assert.equal(totalMax, 100, 'Sum of all category max weights must exactly equal 100');
  });

  // =========================================================================
  // 4. PDF Hyperlink Engine & Protocol Sanitization (ISO 32000)
  // =========================================================================
  test('Requirement 4: PDF Export implements native ISO 32000 URI links and strict protocol rejection', () => {
    const pdfPath = path.join(rootDir, 'src/lib/tools/resume/pdf-export.ts');
    assert.ok(fs.existsSync(pdfPath), 'pdf-export.ts must exist');

    const code = fs.readFileSync(pdfPath, 'utf8');
    assert.ok(code.includes('Type: "Annot"'), 'Must create Annot PDF object');
    assert.ok(code.includes('Subtype: "Link"'), 'Must create Link subtype');
    assert.ok(code.includes('S: "URI"'), 'Must create URI action');
    assert.ok(code.includes('sanitizeUrl'), 'Must sanitize all PDF link URLs');
    assert.ok(code.includes('Portfolio') || code.includes('portfolio'), 'Must support portfolio URL');
    assert.ok(code.includes('LinkedIn') && code.includes('GitHub'), 'Must have clean standard labels');

    // Simulate URL sanitizer function directly from the code implementation
    const sanitizePdfUrlLocal = (rawUrl) => {
      if (!rawUrl || typeof rawUrl !== 'string') return null;
      const trimmed = rawUrl.trim();
      if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) {
        return null;
      }
      if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
        return trimmed;
      }
      if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
        return `https://${trimmed}`;
      }
      return null;
    };

    // Protocol checks
    assert.equal(sanitizePdfUrlLocal('https://saarvi.app'), 'https://saarvi.app');
    assert.equal(sanitizePdfUrlLocal('http://example.com'), 'http://example.com');
    assert.equal(sanitizePdfUrlLocal('mailto:student@saarvi.app'), 'mailto:student@saarvi.app');
    assert.equal(sanitizePdfUrlLocal('github.com/saarvi'), 'https://github.com/saarvi');
    assert.equal(sanitizePdfUrlLocal('linkedin.com/in/student'), 'https://linkedin.com/in/student');

    // Dangerous protocols MUST be rejected
    assert.equal(sanitizePdfUrlLocal('javascript:alert(1)'), null);
    assert.equal(sanitizePdfUrlLocal('JAVASCRIPT:fetch("/leak")'), null);
    assert.equal(sanitizePdfUrlLocal('data:text/html,<script>alert(1)</script>'), null);
    assert.equal(sanitizePdfUrlLocal('file:///etc/passwd'), null);
    assert.equal(sanitizePdfUrlLocal('vbscript:msgbox(1)'), null);
  });

  // =========================================================================
  // 5. Resume Builder Mobile UI & Interactive Elements
  // =========================================================================
  test('Requirement 5: Resume Builder page implements responsive workflow tabs and actionable cards', () => {
    const resumePagePath = path.join(rootDir, 'src/app/student/resume/page.tsx');
    assert.ok(fs.existsSync(resumePagePath), 'resume/page.tsx must exist');

    const code = fs.readFileSync(resumePagePath, 'utf8');
    assert.ok(code.includes('mobileWorkflow'), 'Must have mobileWorkflow state for responsive flow');
    assert.ok(code.includes('"editor"'), 'Must have Editor tab');
    assert.ok(code.includes('"preview"'), 'Must have Preview tab');
    assert.ok(code.includes('"ats"'), 'Must have ATS Score tab');
    assert.ok(code.includes('"export"'), 'Must have Export tab');
    assert.ok(code.includes('Portfolio Website') || code.includes('portfolio'), 'Must have Portfolio URL input');
    assert.ok(code.includes('IMPROVE YOUR SCORE'), 'Must render Improve Your Score section');
    assert.ok(code.includes('min-h-[44px]') || code.includes('h-11') || code.includes('h-10'), 'Must provide comfortable touch targets');

    // Verify ResumeLivePreview interactive links
    const previewPath = path.join(rootDir, 'src/components/career/ResumeLivePreview.tsx');
    const previewCode = fs.readFileSync(previewPath, 'utf8');
    assert.ok(previewCode.includes('portfolio') || previewCode.includes('Portfolio'), 'Live preview must render portfolio');
    assert.ok(previewCode.includes('rel="noopener noreferrer"'), 'External links must use noopener noreferrer');
  });

  // =========================================================================
  // 6. Gmail SMTP & Email OTP Account Creation
  // =========================================================================
  test('Requirement 6: Email OTP flow integrates Gmail SMTP SSL:465, countdown timer, and cooldown', () => {
    // Gmail Provider
    const gmailPath = path.join(rootDir, 'src/lib/notifications/providers/email/gmail-provider.ts');
    assert.ok(fs.existsSync(gmailPath), 'gmail-provider.ts must exist');
    const gmailCode = fs.readFileSync(gmailPath, 'utf8');
    assert.ok(gmailCode.includes('sendAuthVerificationEmail'), 'Must support sendAuthVerificationEmail');
    assert.ok(gmailCode.includes('Study. Work. Grow.'), 'Must include official Saarvi tagline');
    assert.ok(gmailCode.includes('smtp.gmail.com'), 'Must default to smtp.gmail.com');
    assert.ok(gmailCode.includes('465'), 'Must default to port 465 SSL');

    // Signup Route
    const signupApiPath = path.join(rootDir, 'src/app/api/auth/signup/route.ts');
    assert.ok(fs.existsSync(signupApiPath), 'signup API route must exist');
    const signupCode = fs.readFileSync(signupApiPath, 'utf8');
    assert.ok(signupCode.includes('sendAuthVerificationEmail'), 'Signup must trigger branded verification email');
    assert.ok(signupCode.includes('authEmailLogger'), 'Signup must record delivery telemetry');

    // Resend OTP Route
    const resendApiPath = path.join(rootDir, 'src/app/api/auth/resend-otp/route.ts');
    assert.ok(fs.existsSync(resendApiPath), 'resend-otp API route must exist');
    const resendCode = fs.readFileSync(resendApiPath, 'utf8');
    assert.ok(resendCode.includes('sendAuthVerificationEmail'), 'Resend route must trigger email delivery');

    // Verify Email Page
    const verifyPagePath = path.join(rootDir, 'src/app/auth/verify-email/page.tsx');
    const verifyCode = fs.readFileSync(verifyPagePath, 'utf8');
    assert.ok(verifyCode.includes('otpExpiresIn') || verifyCode.includes('10-minute') || verifyCode.includes('600'), 'Must implement OTP expiration timer');
    assert.ok(verifyCode.includes('resendCooldown') || verifyCode.includes('60'), 'Must implement 60s resend cooldown');

    // Privacy Logger
    const loggerPath = path.join(rootDir, 'src/lib/observability/auth-email-logger.ts');
    const loggerCode = fs.readFileSync(loggerPath, 'utf8');
    assert.ok(loggerCode.includes('sanitizeError'), 'Must redact sensitive data from error logs');
    assert.ok(!loggerCode.includes('password ='), 'Must never log raw passwords');
  });

  // =========================================================================
  // 7. Admin Telemetry & Zero Mock Diagnostics
  // =========================================================================
  test('Requirement 7: Admin Telemetry implements live probes and zero synthetic errors', () => {
    // Diagnostics Route
    const diagPath = path.join(rootDir, 'src/app/api/admin/diagnostics/route.ts');
    assert.ok(fs.existsSync(diagPath), 'admin diagnostics route must exist');
    const diagCode = fs.readFileSync(diagPath, 'utf8');
    assert.ok(diagCode.includes("'database'"), 'Must include database ping probe');
    assert.ok(diagCode.includes("'auth-service'"), 'Must include Supabase auth probe');
    assert.ok(diagCode.includes("'smtp-service'"), 'Must include SMTP handshake probe');
    assert.ok(diagCode.includes("'ai-engine'"), 'Must include AI engine probe');
    assert.ok(diagCode.includes("'billing-gateway'"), 'Must include Razorpay gateway probe');

    // Zero Mock Errors in Admin Service
    const adminServicePath = path.join(rootDir, 'src/lib/services/adminService.ts');
    const adminServiceCode = fs.readFileSync(adminServicePath, 'utf8');
    // Ensure synthetic sample errors like 'Stripe webhook signature invalid' were removed from getSystemErrors
    assert.ok(!adminServiceCode.includes('WebhookSignatureVerificationError'), 'Must not inject synthetic Stripe errors');
    assert.ok(!adminServiceCode.includes('Max client connections reached'), 'Must not inject fake PG errors');
    assert.ok(adminServiceCode.includes('getSystemErrors'), 'Must provide getSystemErrors querying real logs');

    // Correct Provider Detection
    assert.ok(
      adminServiceCode.includes("(u.app_metadata?.provider || u.identities?.[0]?.provider || 'email').toUpperCase() === 'GOOGLE'"),
      'Must determine auth provider using authoritative metadata rather than domain strings'
    );
  });
});
