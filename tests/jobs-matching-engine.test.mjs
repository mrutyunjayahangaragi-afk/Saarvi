import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCandidateContext,
  calculateJobMatch,
} from '../src/lib/jobs/matching.ts';

test('Jobs Matching Engine: extracts candidate profile context from career profile and resume', () => {
  const profile = {
    id: 'candidate_1',
    professionalTitle: 'Frontend Engineer',
    skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'],
    location: 'Bengaluru',
    education: [
      {
        institution: 'Visvesvaraya Technological University',
        degree: 'Bachelor of Engineering',
        fieldOfStudy: 'Computer Science and Engineering',
        startDate: '2022-08-01',
        endDate: '2026-06-30',
      },
    ],
  };

  const context = extractCandidateContext(profile);

  assert.ok(context.skills.includes('React'));
  assert.ok(context.skills.includes('TypeScript'));
  assert.equal(context.targetRole, 'Frontend Engineer');
  assert.deepEqual(context.preferredLocations, ['Bengaluru']);
  assert.equal(context.graduationYear, 2026);
  assert.equal(context.branch, 'Computer Science and Engineering');
});

test('Jobs Matching Engine: computes deterministic 0-100 score with 6-factor breakdown', () => {
  const candidate = {
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind', 'Git'],
    targetRole: 'Frontend Engineer',
    preferredLocations: ['Bengaluru'],
    graduationYear: 2026,
    branch: 'Computer Science',
    degree: 'Bachelor of Engineering',
  };

  const jobA = {
    id: 'job_a',
    title: 'Junior Frontend Engineer (React / TypeScript)',
    companyName: 'Saarvi Partner Tech',
    location: 'Bengaluru, India',
    remoteType: 'remote',
    employmentType: 'full-time',
    experienceLevel: 'entry-level',
    salary: 'Salary not disclosed',
    description: 'Looking for a junior frontend engineer skilled in React and TypeScript.',
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind', 'GraphQL'],
    datePosted: new Date().toISOString(), // Posted right now (fresh)
    applicationDeadline: 'Deadline not provided',
    sourceName: 'Saarvi Verified',
    sourceUrl: 'https://saarvi.internal/job/1',
    applyUrl: 'https://saarvi.internal/job/1',
    sourceJobId: 'src_1',
    fetchedAt: new Date().toISOString(),
    verifiedStatus: 'verified',
    isInternship: false,
  };

  const matchA = calculateJobMatch(candidate, jobA);

  assert.ok(matchA.matchScore >= 70, `Expected high match score, got ${matchA.matchScore}`);
  assert.ok(matchA.breakdown.skillsScore >= 25, 'Skills score should be high');
  assert.ok(matchA.breakdown.roleScore >= 15, 'Role score should be high');
  assert.ok(matchA.breakdown.locationScore >= 10, 'Location score should be high');
  assert.equal(matchA.breakdown.freshnessScore, 5, 'Freshness bonus should be 5 for recent posting');
  assert.ok(matchA.missingSkills.includes('GraphQL'));
  assert.ok(matchA.matchingReasons.length > 0);

  // Mismatched Job
  const jobB = {
    id: 'job_b',
    title: 'Senior Civil Infrastructure Engineer',
    companyName: 'Civil Infra Corp',
    location: 'Dubai, UAE',
    remoteType: 'onsite',
    employmentType: 'full-time',
    experienceLevel: 'senior',
    salary: 'Salary not disclosed',
    description: 'Looking for an experienced civil engineer.',
    skills: ['AutoCAD', 'Structural Engineering', 'Concrete'],
    datePosted: '2025-01-01T00:00:00Z',
    applicationDeadline: 'Deadline not provided',
    sourceName: 'External',
    sourceUrl: 'https://example.com/job/2',
    applyUrl: 'https://example.com/job/2',
    sourceJobId: 'src_2',
    fetchedAt: new Date().toISOString(),
    verifiedStatus: 'source_checked',
    isInternship: false,
  };

  const matchB = calculateJobMatch(candidate, jobB);
  assert.ok(matchB.matchScore <= 35, `Expected low match score for mismatched job, got ${matchB.matchScore}`);
  assert.equal(matchB.breakdown.skillsScore, 0);
  assert.equal(matchB.breakdown.freshnessScore, 3); // baseline fallback when > 7 days old
  assert.ok(matchB.missingSkills.includes('AutoCAD'));
});
