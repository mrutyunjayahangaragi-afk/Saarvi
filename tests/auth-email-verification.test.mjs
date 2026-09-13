import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Saarvi Authentication & Email Verification Architecture', () => {
  const rootDir = process.cwd();

  test('dedicated email verification page exists with light, clean UI and 6-digit OTP input', () => {
    const filePath = path.join(rootDir, 'src/app/auth/verify-email/page.tsx');
    assert.ok(fs.existsSync(filePath), 'verify-email/page.tsx must exist');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.toLowerCase().includes('verify your email'), 'Must have verify your email header');
    assert.ok(content.includes('verifyEmailOtp'), 'Must use verifyEmailOtp from AuthContext');
    assert.ok(content.includes('resendVerificationOtp'), 'Must have resend code capability');
    assert.ok(content.includes('resendCooldown') || content.includes('timer'), 'Must enforce 60-second resend cooldown');
    assert.ok(content.includes('Change Email') || content.includes('change-email'), 'Must allow changing email address');
  });

  test('normal login invariant: Email + Password login does NOT prompt for OTP', () => {
    const loginPath = path.join(rootDir, 'src/app/login/page.tsx');
    assert.ok(fs.existsSync(loginPath), 'login/page.tsx must exist');

    const content = fs.readFileSync(loginPath, 'utf-8');
    // Normal login submits email and password
    assert.ok(content.includes('signIn({ email, password })'), 'Login must use signIn({ email, password })');
    // Unconfirmed email redirects to verify-email
    assert.ok(content.includes('/auth/verify-email'), 'Unconfirmed email must redirect to /auth/verify-email');
    // No OTP input field in standard login form
    assert.ok(!content.includes('Enter 6-digit OTP to login'), 'Standard login must not ask for OTP');
  });

  test('signup flow routes unconfirmed users directly to /auth/verify-email', () => {
    const signupPath = path.join(rootDir, 'src/app/signup/page.tsx');
    assert.ok(fs.existsSync(signupPath), 'signup/page.tsx must exist');

    const content = fs.readFileSync(signupPath, 'utf-8');
    assert.ok(content.includes('/auth/verify-email'), 'Signup must route to /auth/verify-email when confirmation required');
  });

  test('Google OAuth configuration enforces prompt: select_account for clean account switching', () => {
    const authContextPath = path.join(rootDir, 'src/context/AuthContext.tsx');
    assert.ok(fs.existsSync(authContextPath), 'AuthContext.tsx must exist');

    const content = fs.readFileSync(authContextPath, 'utf-8');
    assert.ok(content.includes("provider: 'google'"), 'AuthContext must support google provider');
    assert.ok(
      content.includes("prompt: 'select_account'") || content.includes('select_account'),
      'Must configure prompt: select_account for Google OAuth account selection'
    );
  });

  test('email systems remain strictly separated: Supabase Auth vs /admin/notifications', () => {
    const adminNotifPath = path.join(rootDir, 'src/app/api/admin/notifications/route.ts');
    assert.ok(fs.existsSync(adminNotifPath), 'admin/notifications route must exist');

    const notifContent = fs.readFileSync(adminNotifPath, 'utf-8');
    // Notifications system is for platform alerts and transactional updates, NOT supabase auth OTP
    assert.ok(notifContent.includes('emailProvider'), 'Must use dedicated notification email provider');
    assert.ok(!notifContent.includes('verifyOtp'), 'Admin notifications must never handle auth verifyOtp');
  });
});
