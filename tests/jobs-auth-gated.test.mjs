import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  saveSearchIntent,
  getSearchIntent,
  clearSearchIntent,
  buildReturnUrlWithSearch,
} from '../src/lib/jobs/search-intent.ts';
import { sanitizeInternalRedirectUrl } from '../src/lib/security/url-security.ts';

const ROOT_DIR = process.cwd();

test('Search Intent: serializes and builds safe return URL with query filters', () => {
  const returnUrl = buildReturnUrlWithSearch({
    q: 'Software Engineer',
    location: 'Bengaluru',
    remote: 'remote',
    experience: 'entry-level',
    employmentType: 'full-time',
    sortBy: 'newest',
    skills: ['TypeScript', 'React'],
  });

  assert.ok(returnUrl.startsWith('/jobs?'));
  const url = new URL(returnUrl, 'https://saarvi.app');
  assert.equal(url.searchParams.get('q'), 'Software Engineer');
  assert.equal(url.searchParams.get('location'), 'Bengaluru');
  assert.equal(url.searchParams.get('remote'), 'remote');
  assert.equal(url.searchParams.get('experience'), 'entry-level');
  assert.equal(url.searchParams.get('employmentType'), 'full-time');
  assert.equal(url.searchParams.get('sortBy'), 'newest');
  assert.equal(url.searchParams.get('skills'), 'TypeScript,React');
  assert.equal(url.searchParams.get('autoSearch'), 'true');
});

test('Search Intent: omits default values and empty strings from return URL', () => {
  const returnUrl = buildReturnUrlWithSearch({
    q: '  ',
    location: '',
    remote: 'all',
    experience: 'all',
    employmentType: 'all',
    sortBy: 'relevant',
  });

  const url = new URL(returnUrl, 'https://saarvi.app');
  assert.equal(url.searchParams.has('q'), false);
  assert.equal(url.searchParams.has('location'), false);
  assert.equal(url.searchParams.has('remote'), false);
  assert.equal(url.searchParams.has('experience'), false);
  assert.equal(url.searchParams.has('employmentType'), false);
  assert.equal(url.searchParams.has('sortBy'), false);
  assert.equal(url.searchParams.get('autoSearch'), 'true');
});

test('Search Intent: handles sessionStorage persistence, retrieval, and expiration', () => {
  // Mock sessionStorage in Node
  const storageMap = new Map();
  global.window = {
    sessionStorage: {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
    },
  };

  // 1. Save intent
  saveSearchIntent({
    q: 'Frontend Developer',
    location: 'Remote',
    experience: 'fresher',
  });

  const retrieved = getSearchIntent();
  assert.ok(retrieved !== null);
  assert.equal(retrieved.q, 'Frontend Developer');
  assert.equal(retrieved.location, 'Remote');
  assert.equal(retrieved.experience, 'fresher');
  assert.equal(typeof retrieved.timestamp, 'number');

  // 2. Clear intent
  clearSearchIntent();
  assert.equal(getSearchIntent(), null);

  // 3. Expired intent handling
  const expiredPayload = {
    q: 'Expired Job Query',
    timestamp: Date.now() - (3 * 60 * 60 * 1000), // 3 hours ago (> 2 hours)
  };
  global.window.sessionStorage.setItem('saarvi_pending_job_search', JSON.stringify(expiredPayload));
  assert.equal(getSearchIntent(), null, 'Should return null and clear expired intent');
  assert.equal(global.window.sessionStorage.getItem('saarvi_pending_job_search'), null);

  // Cleanup
  delete global.window;
});

test('Jobs Server Auth: API Route files enforce server-authoritative authentication gate', () => {
  const routesToVerify = [
    {
      file: 'src/app/api/jobs/search/route.ts',
      name: 'GET /api/jobs/search',
      mustInclude: ['getAuthenticatedUser', 'status: 401', 'Authentication required'],
    },
    {
      file: 'src/app/api/jobs/[id]/route.ts',
      name: 'GET /api/jobs/[id]',
      mustInclude: ['getAuthenticatedUser', 'status: 401', 'Authentication required'],
    },
    {
      file: 'src/app/api/opportunities/route.ts',
      name: 'GET /api/opportunities',
      mustInclude: ['getAuthenticatedUser', 'status: 401', 'Authentication required'],
    },
    {
      file: 'src/app/api/opportunities/[id]/route.ts',
      name: 'GET /api/opportunities/[id]',
      mustInclude: ['getAuthenticatedUser', 'status: 401', 'Authentication required'],
    },
    {
      file: 'src/app/api/jobs/alerts/route.ts',
      name: 'GET & POST /api/jobs/alerts',
      mustInclude: ['getAuthenticatedUser', 'status: 401', 'authUser.id'],
    },
    {
      file: 'src/app/api/jobs/report/route.ts',
      name: 'POST /api/jobs/report',
      mustInclude: ['getAuthenticatedUser', 'status: 401', 'authUser.id'],
    },
  ];

  for (const route of routesToVerify) {
    const fullPath = path.join(ROOT_DIR, route.file);
    assert.ok(fs.existsSync(fullPath), `${route.file} must exist`);
    const code = fs.readFileSync(fullPath, 'utf8');

    for (const token of route.mustInclude) {
      assert.ok(
        code.includes(token),
        `${route.name} (${route.file}) must enforce ${token} for zero-trust security`
      );
    }
  }
});

test('Jobs Server Auth: Alerts route prevents IDOR by binding strictly to authenticated user ID', () => {
  const alertsRoutePath = path.join(ROOT_DIR, 'src/app/api/jobs/alerts/route.ts');
  const code = fs.readFileSync(alertsRoutePath, 'utf8');

  // Must not accept untrusted client userId from searchParams or body
  assert.ok(
    !code.includes('url.searchParams.get("userId")'),
    'Must NOT trust userId from query params'
  );
  assert.ok(
    !code.includes('body.userId'),
    'Must NOT trust userId from request body'
  );
  assert.ok(
    code.includes('jobAlertsStore.getAlertsByUser(authUser.id)'),
    'Must query alerts strictly using server-authenticated user ID'
  );
  assert.ok(
    code.includes('userId: authUser.id'),
    'Must create alert strictly tied to server-authenticated user ID'
  );
});

test('Jobs Server Auth: Report route prevents impersonation by binding strictly to authenticated reporter', () => {
  const reportRoutePath = path.join(ROOT_DIR, 'src/app/api/jobs/report/route.ts');
  const code = fs.readFileSync(reportRoutePath, 'utf8');

  assert.ok(
    code.includes('reporterId: authUser.id'),
    'Report submission must bind reporterId to authUser.id'
  );
  assert.ok(
    code.includes('status: 401'),
    'Report submission must reject unauthenticated requests with 401'
  );
});

test('Jobs UI Invariant: /jobs page implements authentication gate and intent restoration', () => {
  const jobsPagePath = path.join(ROOT_DIR, 'src/app/jobs/page.tsx');
  const code = fs.readFileSync(jobsPagePath, 'utf8');

  // 1. Must use useAuth to verify session
  assert.ok(code.includes('useAuth'), 'Jobs page must use useAuth hook');

  // 2. Must import search intent helpers
  assert.ok(code.includes('saveSearchIntent'), 'Must import saveSearchIntent');
  assert.ok(code.includes('getSearchIntent'), 'Must import getSearchIntent');
  assert.ok(code.includes('clearSearchIntent'), 'Must import clearSearchIntent');

  // 3. Must import JobsAuthGateModal
  assert.ok(code.includes('JobsAuthGateModal'), 'Must import and use JobsAuthGateModal');

  // 4. Must check authentication before searching
  assert.ok(
    code.includes('setAuthGateOpen(true)'),
    'Must trigger auth modal if user is not authenticated'
  );

  // 5. Must NOT search on mount if unauthenticated
  assert.ok(
    code.includes('if (!user)'),
    'Must verify user presence before initiating search'
  );

  // 6. Suspense boundary for useSearchParams
  assert.ok(
    code.includes('<Suspense'),
    'Jobs page must be wrapped in Suspense boundary for useSearchParams'
  );

  // 7. Verified status check
  assert.ok(
    code.includes("verifiedStatus === 'verified'"),
    'Must check verifiedStatus === "verified"'
  );
});

test('Jobs UI Invariant: /jobs/[id] server component prevents data leakage to unauthenticated visitors', () => {
  const jobDetailPath = path.join(ROOT_DIR, 'src/app/jobs/[id]/page.tsx');
  const code = fs.readFileSync(jobDetailPath, 'utf8');

  // 1. Checks Supabase session server-side
  assert.ok(
    code.includes('createClient()') || code.includes('supabase.auth.getUser()'),
    'Must inspect server-side authentication session'
  );

  // 2. Auth gate rendered when unauthenticated
  assert.ok(
    code.includes('if (!isAuthenticated)'),
    'Must conditionally render auth gate if not authenticated'
  );

  // 3. Renders JobDetailAuthCard
  assert.ok(
    code.includes('JobDetailAuthCard'),
    'Must render JobDetailAuthCard for unauthenticated guests'
  );

  // 4. JobDetailAuthCard component guarantees zero data leakage and interactive auth
  const cardPath = path.join(ROOT_DIR, 'src/components/career/JobDetailAuthCard.tsx');
  assert.ok(fs.existsSync(cardPath), 'JobDetailAuthCard component must exist');
  const cardCode = fs.readFileSync(cardPath, 'utf8');

  assert.ok(
    cardCode.includes('Create an account to view this opportunity'),
    'Must show account creation prompt for guests'
  );
  assert.ok(
    cardCode.includes('Sign up to view full job specifications'),
    'Must conceal full specs behind sign-up prompt for guests'
  );
  assert.ok(
    cardCode.includes('GoogleSignInButton'),
    'Must render GoogleSignInButton for frictionless guest conversion'
  );
  assert.ok(
    cardCode.includes('/signup?next='),
    'Must provide account creation CTA preserving return path'
  );
  assert.ok(
    cardCode.includes('/login?next='),
    'Must provide login CTA preserving return path'
  );
});

test('Jobs UI Invariant: /career/opportunities gates listing query behind authentication', () => {
  const oppsPath = path.join(ROOT_DIR, 'src/app/career/opportunities/page.tsx');
  const code = fs.readFileSync(oppsPath, 'utf8');

  assert.ok(code.includes('useAuth()'), 'Opportunities page must use useAuth hook');
  assert.ok(
    code.includes('if (!user)'),
    'Opportunities page must gate data fetching behind user check'
  );
  assert.ok(
    code.includes('Member-Exclusive Opportunities'),
    'Opportunities page must render member-exclusive gate for guests'
  );
});

test('Auth Redirect Security: Login and Signup preserve return path and sanitize redirects', () => {
  const signupPath = path.join(ROOT_DIR, 'src/app/signup/page.tsx');
  const signupCode = fs.readFileSync(signupPath, 'utf8');

  // Must accept next param and sanitize with sanitizeInternalRedirectUrl
  assert.ok(
    signupCode.includes('searchParams.get("next")'),
    'Signup page must read next parameter'
  );
  assert.ok(
    signupCode.includes('sanitizeInternalRedirectUrl'),
    'Signup page must sanitize redirect using central sanitizeInternalRedirectUrl'
  );

  const loginPath = path.join(ROOT_DIR, 'src/app/login/page.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');
  assert.ok(
    loginCode.includes('/signup?next=') && loginCode.includes('encodeURIComponent(next)'),
    'Login page must preserve next parameter when directing user to create account'
  );

  // Test the central sanitization directly against security attack vectors
  assert.equal(sanitizeInternalRedirectUrl('/jobs?q=engineer', '/dashboard'), '/jobs?q=engineer');
  assert.equal(sanitizeInternalRedirectUrl('//evil.com/hack', '/dashboard'), '/dashboard');
  assert.equal(sanitizeInternalRedirectUrl('https://evil.com/phish', '/dashboard'), '/dashboard');
  assert.equal(sanitizeInternalRedirectUrl('javascript:alert(1)', '/dashboard'), '/dashboard');
  assert.equal(sanitizeInternalRedirectUrl('/\\evil.com', '/dashboard'), '/dashboard');
  assert.equal(sanitizeInternalRedirectUrl('', '/dashboard'), '/dashboard');
  assert.equal(sanitizeInternalRedirectUrl(null, '/dashboard'), '/dashboard');
});

test('Jobs Auth Gate Modal: exports accessible modal with Google sign-in and email options', () => {
  const modalPath = path.join(ROOT_DIR, 'src/components/career/JobsAuthGateModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'JobsAuthGateModal component must exist');

  const modalCode = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalCode.includes('role="dialog"'), 'Must have role="dialog"');
  assert.ok(modalCode.includes('aria-modal="true"'), 'Must have aria-modal="true"');
  assert.ok(modalCode.includes('GoogleSignInButton'), 'Must render GoogleSignInButton');
  assert.ok(modalCode.includes('Create account'), 'Must have Create account button');
  assert.ok(modalCode.includes('Log in'), 'Must have Log in button');
});
