import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSafeJobUrl,
  sanitizeSearchQuery,
  sanitizePagination,
} from '../src/lib/jobs/security.ts';
import { normalizeSerpApiJob } from '../src/lib/jobs/normalize.ts';
import {
  stripTrackingParams,
  getJobCompositeKey,
  deduplicateJobs,
} from '../src/lib/jobs/dedupe.ts';
import { calculateJobRelevance, sortJobs } from '../src/lib/jobs/ranking.ts';
import { jobReportsStore } from '../src/lib/jobs/reports.ts';
import { jobAlertsStore } from '../src/lib/jobs/alerts.ts';

test('Jobs Engine Security: validates safe external URLs and blocks SSRF / loopback attempts', () => {
  // Safe HTTP/HTTPS URLs
  assert.equal(
    validateSafeJobUrl('https://careers.google.com/jobs/results/12345'),
    'https://careers.google.com/jobs/results/12345'
  );
  assert.equal(
    validateSafeJobUrl('http://apply.workday.com/jobs/99'),
    'http://apply.workday.com/jobs/99'
  );

  // Unsafe / malicious protocols blocked
  assert.equal(validateSafeJobUrl('javascript:alert(document.cookie)'), null);
  assert.equal(validateSafeJobUrl('data:text/html,<script>evil()</script>'), null);
  assert.equal(validateSafeJobUrl('vbscript:msgbox(1)'), null);
  assert.equal(validateSafeJobUrl('blob:https://example.com/uuid'), null);

  // SSRF / internal loopback blocked
  assert.equal(validateSafeJobUrl('http://localhost:3000/api/admin'), null);
  assert.equal(validateSafeJobUrl('http://127.0.0.1:8080/internal'), null);
  assert.equal(validateSafeJobUrl('http://169.254.169.254/latest/meta-data'), null);
  assert.equal(validateSafeJobUrl('http://10.0.0.1/secrets'), null);
  assert.equal(validateSafeJobUrl('http://192.168.1.1/router'), null);
  assert.equal(validateSafeJobUrl(''), null);
  assert.equal(validateSafeJobUrl(null), null);
});

test('Jobs Engine Security: query sanitization cleans input and bounds pagination', () => {
  assert.equal(sanitizeSearchQuery('   software   engineer   '), 'software engineer');
  assert.equal(sanitizeSearchQuery('<script>alert(1)</script>frontend'), 'script alert(1) /script frontend');
  assert.equal(sanitizeSearchQuery(''), '');
  assert.equal(sanitizeSearchQuery(null), '');

  const pagination = sanitizePagination(-5, 999, 50);
  assert.equal(pagination.page, 1);
  assert.equal(pagination.limit, 50);
});

test('Jobs Engine Normalization: honestly formats SerpApi job items with no fake data', () => {
  const rawSerpApiItem = {
    job_id: 'serp_101',
    title: 'Junior Frontend Developer (React)',
    company_name: 'Tech Innovations Inc',
    location: 'Bengaluru, Karnataka, India',
    via: 'via LinkedIn',
    description: 'Looking for a junior frontend engineer skilled in React, Next.js, and TypeScript. Remote friendly.',
    detected_extensions: {
      posted_at: '2 days ago',
      schedule_type: 'Full-time',
      work_from_home: true,
    },
    apply_options: [
      {
        title: 'Apply on Company Site',
        link: 'https://techinnovations.com/careers/101?utm_source=google_jobs&utm_medium=organic',
      },
    ],
  };

  const normalized = normalizeSerpApiJob(rawSerpApiItem, 0);

  assert.equal(normalized.id, 'job_serp_101');
  assert.equal(normalized.title, 'Junior Frontend Developer (React)');
  assert.equal(normalized.companyName, 'Tech Innovations Inc');
  assert.equal(normalized.location, 'Bengaluru, Karnataka, India');
  assert.equal(normalized.remoteType, 'remote');
  assert.equal(normalized.salary, 'Salary not disclosed');
  assert.equal(normalized.applicationDeadline, 'Deadline not provided');
  assert.equal(normalized.sourceName, 'LinkedIn');
  assert.ok(normalized.skills.includes('React'));
  assert.ok(normalized.skills.includes('TypeScript'));
  assert.ok(normalized.skills.includes('Next.js'));
  assert.equal(
    normalized.applyUrl,
    'https://techinnovations.com/careers/101'
  );
});

test('Jobs Engine Deduplication: strips tracking tokens and normalizes composite keys', () => {
  const dirtyUrl = 'https://jobs.lever.co/stripe/software-engineer?utm_source=google_jobs&utm_campaign=hiring&gh_src=123';
  const cleanUrl = stripTrackingParams(dirtyUrl);
  assert.equal(cleanUrl, 'https://jobs.lever.co/stripe/software-engineer?gh_src=123');

  const key1 = getJobCompositeKey({
    id: '1',
    companyName: 'Stripe Payments India Pvt Ltd',
    title: 'Software Engineer Backend',
    location: 'Bengaluru',
    remoteType: 'onsite',
    employmentType: 'full-time',
    experienceLevel: 'entry-level',
    salary: 'Salary not disclosed',
    description: 'desc',
    skills: [],
    datePosted: '2026-09-20',
    applicationDeadline: 'Deadline not provided',
    sourceName: 'Google',
    sourceUrl: 'https://stripe.com',
    applyUrl: 'https://stripe.com',
    sourceJobId: '1',
    fetchedAt: '2026-09-20',
    verifiedStatus: 'unverified',
    isInternship: false,
  });
  assert.ok(key1.includes('stripepaymentsindiapvtltd'));

  const job1 = {
    id: 'j1',
    title: 'Software Engineer',
    companyName: 'Stripe',
    location: 'Bengaluru',
    remoteType: 'onsite',
    employmentType: 'full-time',
    experienceLevel: 'entry-level',
    salary: 'Salary not disclosed',
    description: 'desc',
    skills: ['Node.js'],
    datePosted: '2026-09-20T10:00:00Z',
    applicationDeadline: 'Deadline not provided',
    sourceName: 'LinkedIn',
    sourceUrl: 'https://jobs.lever.co/stripe/1?utm_source=a',
    applyUrl: 'https://jobs.lever.co/stripe/1?utm_source=a',
    sourceJobId: 'j1',
    fetchedAt: '2026-09-20',
    verifiedStatus: 'unverified',
    isInternship: false,
  };
  const job2 = {
    id: 'j2',
    title: 'Software Engineer',
    companyName: 'Stripe',
    location: 'Bengaluru',
    remoteType: 'onsite',
    employmentType: 'full-time',
    experienceLevel: 'entry-level',
    salary: 'Salary not disclosed',
    description: 'desc',
    skills: ['TypeScript'],
    datePosted: '2026-09-21T10:00:00Z',
    applicationDeadline: 'Deadline not provided',
    sourceName: 'Google Jobs',
    sourceUrl: 'https://jobs.lever.co/stripe/1?utm_source=b',
    applyUrl: 'https://jobs.lever.co/stripe/1?utm_source=b',
    sourceJobId: 'j2',
    fetchedAt: '2026-09-21',
    verifiedStatus: 'unverified',
    isInternship: false,
  };

  const { uniqueJobs, duplicatesRemoved } = deduplicateJobs([job1, job2]);
  assert.equal(uniqueJobs.length, 1);
  assert.equal(duplicatesRemoved, 1);
});

test('Jobs Engine Ranking: deterministically sorts items by relevance, newest, and deadline', () => {
  const items = [
    {
      id: '1',
      title: 'Senior Java Architect',
      companyName: 'Enterprise Corp',
      location: 'Pune',
      remoteType: 'onsite',
      employmentType: 'full-time',
      experienceLevel: 'senior',
      salary: 'Salary not disclosed',
      description: 'Java enterprise solutions architect role in Pune.',
      skills: ['Java'],
      datePosted: '2026-09-10T00:00:00Z',
      applicationDeadline: '2026-10-01T00:00:00Z',
      sourceName: 'External',
      sourceUrl: 'https://example.com/1',
      applyUrl: 'https://example.com/1',
      sourceJobId: '1',
      fetchedAt: '2026-09-10T00:00:00Z',
      verifiedStatus: 'unverified',
      isInternship: false,
    },
    {
      id: '2',
      title: 'Junior React Frontend Developer',
      companyName: 'Acme Startup',
      location: 'Bengaluru',
      remoteType: 'remote',
      employmentType: 'full-time',
      experienceLevel: 'entry-level',
      salary: 'Salary not disclosed',
      description: 'Junior React and TypeScript developer role.',
      skills: ['React', 'TypeScript'],
      datePosted: '2026-09-22T00:00:00Z',
      applicationDeadline: '2026-09-25T00:00:00Z',
      sourceName: 'External',
      sourceUrl: 'https://example.com/2',
      applyUrl: 'https://example.com/2',
      sourceJobId: '2',
      fetchedAt: '2026-09-22T00:00:00Z',
      verifiedStatus: 'unverified',
      isInternship: false,
    },
  ];

  // Search for "react"
  const rankedByRelevance = sortJobs(items, 'relevant', { q: 'react' });
  assert.equal(rankedByRelevance[0].id, '2');

  // Sort by newest
  const rankedByNewest = sortJobs(items, 'newest');
  assert.equal(rankedByNewest[0].id, '2');

  // Sort by deadline_soon
  const rankedByDeadline = sortJobs(items, 'deadline_soon');
  assert.equal(rankedByDeadline[0].id, '2');
});

test('Jobs Engine Anti-Scam Reports & Alerts: stores and updates reports and user subscriptions', () => {
  // Test Reports Store
  const report = jobReportsStore.submitReport({
    jobId: 'job_test_999',
    jobTitle: 'Data Entry $10,000/week',
    companyName: 'Suspicious Corp',
    reason: 'SCAM',
    notes: 'Asked for upfront registration fee',
    reporterId: 'student@example.com',
  });

  assert.equal(report.jobId, 'job_test_999');
  assert.equal(report.status, 'PENDING');

  const resolved = jobReportsStore.updateReportStatus(report.id, 'RESOLVED', 'Listing confirmed fraudulent');
  assert.equal(resolved?.status, 'RESOLVED');
  assert.equal(resolved?.resolutionNotes, 'Listing confirmed fraudulent');

  // Test Alerts Store
  const alertSub = jobAlertsStore.createAlert({
    userId: 'user_test_1',
    title: 'Frontend Alerts',
    keywords: ['React', 'Next.js'],
    location: 'Bengaluru',
    frequency: 'daily',
  });

  assert.equal(alertSub.userId, 'user_test_1');
  assert.equal(alertSub.active, true);
  assert.deepEqual(alertSub.keywords, ['React', 'Next.js']);

  const userAlerts = jobAlertsStore.getAlertsByUser('user_test_1');
  assert.equal(userAlerts.length, 1);

  jobAlertsStore.toggleAlert(alertSub.id, 'user_test_1', false);
  const toggled = jobAlertsStore.getAlertsByUser('user_test_1')[0];
  assert.equal(toggled.active, false);

  const deleted = jobAlertsStore.deleteAlert(alertSub.id, 'user_test_1');
  assert.equal(deleted, true);
  assert.equal(jobAlertsStore.getAlertsByUser('user_test_1').length, 0);
});
