import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSafeExternalUrl,
  normalizeCompanyName,
  normalizeJobTitle,
  extractOpportunitySkills,
  generateOpportunityContentHash,
} from '../src/lib/opportunities/normalizer.ts';
import {
  getCanonicalJobUrl,
  generateOpportunityCompositeKey,
  deduplicateOpportunities,
} from '../src/lib/opportunities/deduplicator.ts';
import { opportunityStore } from '../src/lib/opportunities/opportunity-store.ts';
import { OpportunityCircuitBreaker } from '../src/lib/opportunities/circuit-breaker.ts';

test('Opportunity Engine: URL validation enforces safe protocols and blocks SSRF / loopback attempts', () => {
  // Safe URLs
  assert.equal(validateSafeExternalUrl('https://careers.google.com/jobs/results/123'), 'https://careers.google.com/jobs/results/123');
  assert.equal(validateSafeExternalUrl('http://company.com/apply'), 'http://company.com/apply');

  // Unsafe / Insecure / SSRF attempts
  assert.equal(validateSafeExternalUrl('javascript:alert(1)'), null);
  assert.equal(validateSafeExternalUrl('data:text/html,<script>'), null);
  assert.equal(validateSafeExternalUrl('http://localhost:3000/api/keys'), null);
  assert.equal(validateSafeExternalUrl('http://127.0.0.1/admin'), null);
  assert.equal(validateSafeExternalUrl('http://192.168.1.1/internal'), null);
  assert.equal(validateSafeExternalUrl(''), null);
});

test('Opportunity Engine: Deduplicator strips tracking tokens and normalizes composite keys', () => {
  const dirtyUrl = 'https://jobs.lever.co/techcorp/frontend-engineer?utm_source=linkedin&utm_campaign=spring2026&ref=candidate_123';
  const cleanUrl = getCanonicalJobUrl(dirtyUrl);

  assert.equal(cleanUrl, 'https://jobs.lever.co/techcorp/frontend-engineer');

  const compKey1 = generateOpportunityCompositeKey('TechCorp Solutions Pvt Ltd', 'Software Engineer - Frontend', 'Bengaluru, Karnataka');
  const compKey2 = generateOpportunityCompositeKey('TechCorp', 'Software Engineer Frontend', 'Bengaluru');

  assert.equal(compKey1, compKey2, 'Both should normalize to techcorp:softwareengineerfrontend:bengaluru');
});

test('Opportunity Engine: Deduplication merges multi-source listings into unified record', () => {
  const oppA = {
    id: 'opp_source_1',
    source: 'serpapi_google_jobs',
    sourceId: 'src_1',
    sourceUrl: 'https://careers.example.com/job/101',
    applyUrl: 'https://careers.example.com/job/101?ref=google_jobs',
    originalSourceUrl: 'https://careers.example.com/job/101',
    title: 'Junior React Developer',
    companyName: 'Acme Technologies Inc',
    location: 'Bengaluru, India',
    remoteType: 'hybrid',
    employmentType: 'full-time',
    experienceLevel: 'entry-level',
    skills: ['React', 'TypeScript'],
    salary: null,
    postedAt: new Date().toISOString(),
    sourceLastUpdatedAt: new Date().toISOString(),
    discoveredAt: new Date().toISOString(),
    status: 'PENDING_REVIEW',
    category: 'job',
    isInternship: false,
    isJob: true,
    isScholarship: false,
    isHackathon: false,
    contentHash: 'hash_123',
    confidenceScore: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const oppB = {
    ...oppA,
    id: 'opp_source_2',
    source: 'serpapi_google_search',
    sourceId: 'src_2',
    applyUrl: 'https://careers.example.com/job/101?utm_source=search',
    skills: ['React', 'TailwindCSS', 'JavaScript'],
  };

  const { uniqueOpportunities, duplicatesMergedCount } = deduplicateOpportunities([oppA, oppB]);

  assert.equal(uniqueOpportunities.length, 1, 'Should merge duplicate records into one');
  assert.equal(duplicatesMergedCount, 1);

  const merged = uniqueOpportunities[0];
  assert.ok(merged.skills.includes('TypeScript'));
  assert.ok(merged.skills.includes('TailwindCSS'));
  assert.ok(merged.duplicateSources?.includes('serpapi_google_search'));
});

test('Opportunity Store: Mandatory admin approval pipeline ensures only APPROVED opportunities are visible to students', () => {
  const oppPending = {
    id: 'opp_test_pending_1',
    source: 'serpapi_google_jobs',
    sourceId: 'id_pend_1',
    sourceUrl: 'https://example.com/job/p1',
    applyUrl: 'https://example.com/job/p1',
    originalSourceUrl: 'https://example.com/job/p1',
    title: 'Graduate Trainee Engineer',
    companyName: 'Global Enterprises',
    location: 'Pune, India',
    remoteType: 'onsite',
    employmentType: 'full-time',
    experienceLevel: 'fresher',
    skills: ['Java', 'SQL'],
    salary: null,
    postedAt: new Date().toISOString(),
    sourceLastUpdatedAt: new Date().toISOString(),
    discoveredAt: new Date().toISOString(),
    status: 'PENDING_REVIEW',
    category: 'job',
    isInternship: false,
    isJob: true,
    isScholarship: false,
    isHackathon: false,
    contentHash: 'hash_pend_1',
    confidenceScore: 85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Ingest
  opportunityStore.ingestOpportunities([oppPending], 'admin_test');

  // Verify not visible to student feed
  const studentFeedBefore = opportunityStore.getApprovedOpportunities({ search: 'Graduate Trainee' });
  assert.equal(studentFeedBefore.items.some((i) => i.id === 'opp_test_pending_1'), false, 'Pending item must not appear in student feed');

  // Admin approves opportunity
  const approved = opportunityStore.approveOpportunity('opp_test_pending_1', 'superadmin_1', 'Verified official career listing');
  assert.ok(approved);
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.verifiedByAdmin, true);

  // Verify now visible to student feed
  const studentFeedAfter = opportunityStore.getApprovedOpportunities({ search: 'Graduate Trainee' });
  assert.equal(studentFeedAfter.items.some((i) => i.id === 'opp_test_pending_1'), true, 'Approved item must now appear in student feed');
});

test('Circuit Breaker: Enforces CLOSED -> OPEN -> HALF_OPEN state transitions', () => {
  const cb = new OpportunityCircuitBreaker({
    failureThreshold: 2,
    cooldownPeriodMs: 50, // 50ms cooldown for fast testing
  });

  assert.equal(cb.getState(), 'CLOSED');
  assert.equal(cb.canExecute(), true);

  // Failure 1
  cb.recordFailure();
  assert.equal(cb.getState(), 'CLOSED');

  // Failure 2 (triggers threshold)
  cb.recordFailure();
  assert.equal(cb.getState(), 'OPEN');
  assert.equal(cb.canExecute(), false);

  // Wait 60ms for cooldown
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(cb.getState(), 'HALF_OPEN');
      assert.equal(cb.canExecute(), true);

      // On successful probe, reverts to CLOSED
      cb.recordSuccess();
      assert.equal(cb.getState(), 'CLOSED');
      resolve();
    }, 60);
  });
});
