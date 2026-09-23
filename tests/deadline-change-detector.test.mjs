import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOpportunityDeadline } from '../src/lib/opportunities/deadline-engine.ts';
import { detectOpportunityChanges } from '../src/lib/opportunities/change-detector.ts';

test('Deadline Engine: Accurately computes remaining time and urgency tiers', () => {
  const now = new Date('2026-09-24T10:00:00.000Z');

  // Closed deadline in the past
  const pastEvaluation = evaluateOpportunityDeadline('2026-09-23T23:59:59.000Z', now);
  assert.equal(pastEvaluation.state, 'CLOSED');
  assert.equal(pastEvaluation.isExpired, true);

  // Closing soon (2 days remaining)
  const soonEvaluation = evaluateOpportunityDeadline('2026-09-26T10:00:00.000Z', now);
  assert.equal(soonEvaluation.state, 'CLOSING_SOON');
  assert.equal(soonEvaluation.daysRemaining, 2);
  assert.equal(soonEvaluation.triggersNotice, true);
  assert.equal(soonEvaluation.triggerTier, '3_DAYS');

  // Open with 7 days remaining
  const weekEvaluation = evaluateOpportunityDeadline('2026-10-01T10:00:00.000Z', now);
  assert.equal(weekEvaluation.state, 'OPEN');
  assert.equal(weekEvaluation.daysRemaining, 7);
  assert.equal(weekEvaluation.triggersNotice, true);
  assert.equal(weekEvaluation.triggerTier, '7_DAYS');
});

test('Change Detector: Pinpoints exact changed fields without generic messages', () => {
  const previous = {
    id: 'opp_tech_1',
    source: 'serpapi_google_jobs',
    sourceId: 'tech_1',
    sourceUrl: 'https://example.com/job',
    applyUrl: 'https://example.com/job',
    originalSourceUrl: 'https://example.com/job',
    title: 'Backend Engineer',
    companyName: 'TechSolutions',
    location: 'Bengaluru',
    remoteType: 'hybrid',
    employmentType: 'full-time',
    experienceLevel: 'entry-level',
    skills: ['Java', 'SQL'],
    salary: null,
    postedAt: '2026-09-20T10:00:00.000Z',
    applicationDeadline: '2026-10-10',
    sourceLastUpdatedAt: '2026-09-20T10:00:00.000Z',
    discoveredAt: '2026-09-20T10:00:00.000Z',
    status: 'APPROVED',
    category: 'job',
    isInternship: false,
    isJob: true,
    isScholarship: false,
    isHackathon: false,
    contentHash: 'hash_v1',
    confidenceScore: 90,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  };

  const current = {
    ...previous,
    applicationDeadline: '2026-10-15', // Deadline extended by 5 days
    skills: ['Java', 'SQL', 'Docker', 'AWS'], // 2 new skills added
    contentHash: 'hash_v2',
  };

  const changeResult = detectOpportunityChanges(previous, current);

  assert.equal(changeResult.hasMeaningfulChange, true);
  assert.equal(changeResult.diffs.length, 2);

  const deadlineDiff = changeResult.diffs.find((d) => d.fieldName === 'deadline');
  assert.ok(deadlineDiff);
  assert.ok(deadlineDiff.description.includes('changed from 2026-10-10 to 2026-10-15'));

  const skillsDiff = changeResult.diffs.find((d) => d.fieldName === 'skills');
  assert.ok(skillsDiff);
  assert.ok(skillsDiff.description.includes('Docker, AWS'));
});
