import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { opportunityStore } from '../src/lib/opportunities/opportunity-store.ts';
import { jobSearchService } from '../src/lib/jobs/search.ts';
import { supportTicketStore } from '../src/lib/support/support-store.ts';

test('Jobs Engine: Admin Manual Creation with Validation & Audit Trail', () => {
  // 1. Validation rejection on invalid URL
  assert.throws(() => {
    opportunityStore.addManualOpportunity({
      title: 'Senior Frontend Engineer',
      companyName: 'Saarvi Tech',
      applyUrl: 'javascript:alert(1)',
      location: 'Bengaluru',
      category: 'job',
    }, 'admin_test_1');
  }, /safe application URL/);

  // 2. Validation rejection on too short title
  assert.throws(() => {
    opportunityStore.addManualOpportunity({
      title: 'A',
      companyName: 'Saarvi Tech',
      applyUrl: 'https://saarvi.app/careers',
      location: 'Bengaluru',
      category: 'job',
    }, 'admin_test_1');
  }, /at least 3 characters/);

  // 3. Successful manual creation (Directly Approved/Published)
  const opp = opportunityStore.addManualOpportunity({
    title: 'Lead Cloud Architect',
    companyName: 'Saarvi Systems',
    applyUrl: 'https://saarvi.app/careers/cloud-architect?utm_source=test',
    location: 'Bengaluru, India',
    remoteType: 'hybrid',
    employmentType: 'full-time',
    experienceLevel: 'senior',
    skills: ['AWS', 'Kubernetes', 'Go'],
    category: 'job',
    status: 'APPROVED',
  }, 'admin_test_1');

  assert.ok(opp.id.startsWith('opp_manual_'));
  assert.equal(opp.companyName, 'Saarvi Systems');
  assert.equal(opp.status, 'APPROVED');
  assert.equal(opp.verifiedByAdmin, true);
  assert.equal(opp.approvedBy, 'admin_test_1');
  assert.ok(!opp.applyUrl.includes('utm_source'), 'Should clean tracking tokens from applyUrl');

  // 4. Verify audit log entry
  const logs = opportunityStore.getRecentAuditLogs(5);
  const manualLog = logs.find((l) => l.opportunityId === opp.id);
  assert.ok(manualLog, 'Audit log must record manual creation');
  assert.equal(manualLog.action, 'CREATED_MANUAL');
  assert.equal(manualLog.actorId, 'admin_test_1');
});

test('Jobs Engine: Discovery Preview Validation & Duplicate Detection', () => {
  // Existing known job in store
  const existingJob = opportunityStore.addManualOpportunity({
    title: 'Full Stack Java Engineer',
    companyName: 'Infosys Ltd',
    applyUrl: 'https://careers.infosys.com/job/1001',
    location: 'Bengaluru',
    category: 'job',
    status: 'APPROVED',
  }, 'admin_test_1');

  // Simulated raw items from external discovery (SerpApi)
  const rawDiscovered = [
    // Valid new item
    {
      id: 'raw_01',
      source: 'serpapi_google_jobs',
      sourceId: 'src_01',
      sourceUrl: 'https://careers.wipro.com/job/2001',
      applyUrl: 'https://careers.wipro.com/job/2001?utm_campaign=jobs',
      originalSourceUrl: 'https://careers.wipro.com/job/2001',
      title: 'React Native Developer',
      companyName: 'Wipro Technologies',
      location: 'Hyderabad, India',
      remoteType: 'onsite',
      employmentType: 'full-time',
      experienceLevel: 'fresher',
      skills: ['React Native', 'Mobile'],
      postedAt: new Date().toISOString(),
      sourceLastUpdatedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      status: 'DISCOVERED',
      category: 'job',
      isInternship: false,
      isJob: true,
      isScholarship: false,
      isHackathon: false,
      contentHash: 'hash_01',
      confidenceScore: 88,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: 'Comprehensive mobile engineering role developing student cross-platform applications.',
    },
    // Exact duplicate of existing item
    {
      id: 'raw_02',
      source: 'serpapi_google_jobs',
      sourceId: 'src_02',
      sourceUrl: 'https://careers.infosys.com/job/1001',
      applyUrl: 'https://careers.infosys.com/job/1001?ref=search',
      originalSourceUrl: 'https://careers.infosys.com/job/1001',
      title: 'Full Stack Java Engineer',
      companyName: 'Infosys Ltd',
      location: 'Bengaluru',
      remoteType: 'hybrid',
      employmentType: 'full-time',
      experienceLevel: 'entry-level',
      skills: ['Java', 'Spring'],
      postedAt: new Date().toISOString(),
      sourceLastUpdatedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      status: 'DISCOVERED',
      category: 'job',
      isInternship: false,
      isJob: true,
      isScholarship: false,
      isHackathon: false,
      contentHash: 'hash_02',
      confidenceScore: 92,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: 'Enterprise Java software development role working on core cloud services.',
    },
    // Invalid item (unsafe URL)
    {
      id: 'raw_03',
      source: 'serpapi_google_search',
      sourceId: 'src_03',
      sourceUrl: 'http://localhost/test',
      applyUrl: 'javascript:void(0)',
      originalSourceUrl: 'http://localhost/test',
      title: 'Test Suspicious Job',
      companyName: 'Unknown LLC',
      location: 'Online',
      remoteType: 'remote',
      employmentType: 'contract',
      experienceLevel: 'senior',
      skills: [],
      postedAt: new Date().toISOString(),
      sourceLastUpdatedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      status: 'DISCOVERED',
      category: 'job',
      isInternship: false,
      isJob: true,
      isScholarship: false,
      isHackathon: false,
      contentHash: 'hash_03',
      confidenceScore: 40,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: 'Short',
    },
  ];

  const { results, summary } = opportunityStore.previewDiscoveryResults(rawDiscovered);

  assert.equal(summary.found, 3);
  assert.equal(summary.invalid, 1, 'raw_03 with javascript: must be flagged INVALID');
  assert.equal(summary.duplicates, 1, 'raw_02 must match existing Infosys job as EXACT_DUPLICATE');

  const item1 = results.find((r) => r.id === 'raw_01');
  assert.ok(item1);
  assert.equal(item1.duplicateStatus, 'NEW');

  const item2 = results.find((r) => r.id === 'raw_02');
  assert.ok(item2);
  assert.equal(item2.duplicateStatus, 'EXACT_DUPLICATE');
  assert.equal(item2.duplicateTargetId, existingJob.id);

  const item3 = results.find((r) => r.id === 'raw_03');
  assert.ok(item3);
  assert.equal(item3.validationStatus, 'INVALID');
});

test('Jobs Engine: Bulk Import moves items to PENDING_REVIEW (Never Auto-Publishes)', () => {
  const itemToImport = {
    id: `opp_import_${Date.now()}`,
    source: 'serpapi_google_jobs',
    sourceId: `src_imp_${Date.now()}`,
    sourceUrl: 'https://careers.accenture.com/job/8001',
    applyUrl: 'https://careers.accenture.com/job/8001',
    originalSourceUrl: 'https://careers.accenture.com/job/8001',
    title: 'Cloud DevOps Associate',
    companyName: 'Accenture India',
    location: 'Bengaluru, India',
    remoteType: 'hybrid',
    employmentType: 'full-time',
    experienceLevel: 'entry-level',
    skills: ['Docker', 'CI/CD', 'Linux'],
    postedAt: new Date().toISOString(),
    sourceLastUpdatedAt: new Date().toISOString(),
    discoveredAt: new Date().toISOString(),
    status: 'DISCOVERED',
    category: 'job',
    isInternship: false,
    isJob: true,
    isScholarship: false,
    isHackathon: false,
    contentHash: 'hash_accenture_1',
    confidenceScore: 95,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    description: 'Entry-level DevOps associate role maintaining CI/CD pipelines and infrastructure.',
  };

  const importSummary = opportunityStore.bulkImportToPendingReview([itemToImport], 'admin_test_2');

  assert.equal(importSummary.imported, 1);

  // Check stored record state: MUST BE PENDING_REVIEW
  const stored = opportunityStore.getOpportunityById(itemToImport.id);
  assert.ok(stored);
  assert.equal(stored.status, 'PENDING_REVIEW', 'Imported items must strictly enter PENDING_REVIEW');
  assert.equal(stored.verifiedByAdmin, false, 'Imported items must not be pre-verified');

  // Must NOT appear in public student feed
  const publicFeed = opportunityStore.getApprovedOpportunities({ search: 'Accenture' });
  assert.equal(publicFeed.items.length, 0, 'Unapproved imported items must never appear to students');

  // Admin approves it
  const approved = opportunityStore.approveOpportunity(itemToImport.id, 'admin_test_2', 'Verified legitimate listing');
  assert.ok(approved);
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.verifiedByAdmin, true);

  // Now it MUST appear in public student feed
  const publicFeedPostApproval = opportunityStore.getApprovedOpportunities({ search: 'Accenture' });
  assert.equal(publicFeedPostApproval.items.length, 1);
  assert.equal(publicFeedPostApproval.items[0].id, itemToImport.id);
});

test('Jobs Engine: Public Student Search strictly isolates from SerpApi queries', async () => {
  // Student searches for Java jobs
  const res = await jobSearchService.searchJobs({
    q: 'Java',
    location: 'Bengaluru',
  });

  assert.ok(Array.isArray(res.items));
  // Every returned item must be verified by Saarvi
  res.items.forEach((item) => {
    assert.equal(item.sourceName, 'Verified by Saarvi');
    assert.equal(item.verifiedStatus, 'verified');
  });
});

test('Support Center: Inbox management for saarvinotifications@gmail.com', () => {
  const tickets = supportTicketStore.getAll();
  assert.ok(tickets.length >= 3, 'Support inbox should contain initial tickets');

  // Select an open ticket and resolve it
  const openTicket = tickets.find((t) => t.status === 'OPEN');
  assert.ok(openTicket);

  const resolved = supportTicketStore.updateTicket(
    openTicket.id,
    { status: 'RESOLVED', internalNotes: 'Addressed question paper inquiry' },
    'Support Admin'
  );

  assert.ok(resolved);
  assert.equal(resolved.status, 'RESOLVED');
  assert.ok(resolved.resolvedAt);
});

test('Control Center 3.0: UI Architecture & Invariant Inspection', () => {
  // 1. Inspect AdminSidebar for the 6 visual groups
  const sidebarPath = path.join(process.cwd(), 'src/components/admin/AdminSidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  assert.ok(sidebarContent.includes("'OPERATIONS'"), 'Sidebar must contain OPERATIONS group');
  assert.ok(sidebarContent.includes("'CAREER'"), 'Sidebar must contain CAREER group');
  assert.ok(sidebarContent.includes("'ACADEMICS'"), 'Sidebar must contain ACADEMICS group');
  assert.ok(sidebarContent.includes("'GROWTH'"), 'Sidebar must contain GROWTH group');
  assert.ok(sidebarContent.includes("'MONETIZATION'"), 'Sidebar must contain MONETIZATION group');
  assert.ok(sidebarContent.includes("'SYSTEM'"), 'Sidebar must contain SYSTEM group');
  assert.ok(sidebarContent.includes('/admin/support'), 'Sidebar must link to Support Center');
  assert.ok(sidebarContent.includes('/admin/career'), 'Sidebar must link to Jobs & Internships');

  // 2. Inspect Admin Dashboard Overview for Quick Actions & Top 10 Summary Cards
  const dashboardPath = path.join(process.cwd(), 'src/app/admin/page.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

  assert.ok(dashboardContent.includes('+ Discover Jobs'), 'Dashboard must have + Discover Jobs quick action');
  assert.ok(dashboardContent.includes('+ Discover Internships'), 'Dashboard must have + Discover Internships quick action');
  assert.ok(dashboardContent.includes('+ Add Job'), 'Dashboard must have + Add Job quick action');
  assert.ok(dashboardContent.includes('+ Add Internship'), 'Dashboard must have + Add Internship quick action');
  assert.ok(dashboardContent.includes('Jobs Published'), 'Dashboard must render Jobs Published KPI card');
  assert.ok(dashboardContent.includes('Internships'), 'Dashboard must render Internships KPI card');
  assert.ok(dashboardContent.includes('Pending Reviews'), 'Dashboard must render Pending Reviews KPI card');
  assert.ok(dashboardContent.includes('Mock Interviews'), 'Dashboard must render Mock Interviews KPI card');
  assert.ok(dashboardContent.includes('Free Users'), 'Dashboard must render Free Users metric');

  // 3. Inspect Admin Career Page for Discovery, Manual Entry, and Moderation
  const careerPagePath = path.join(process.cwd(), 'src/app/admin/career/page.tsx');
  const careerPageContent = fs.readFileSync(careerPagePath, 'utf8');

  assert.ok(careerPageContent.includes('Discover Jobs'), 'Career page must include Discover Jobs');
  assert.ok(careerPageContent.includes('Discover Internships'), 'Career page must include Discover Internships');
  assert.ok(careerPageContent.includes('Add Job Directly'), 'Career page must include manual creation');
  assert.ok(careerPageContent.includes('Import Selected'), 'Career page must include bulk import');
  assert.ok(careerPageContent.includes('Publish this opportunity to Saarvi users?'), 'Career page must include confirmation modal');
});
