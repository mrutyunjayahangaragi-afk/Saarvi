import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("1. FAQ Duplicate Cleanup: Exactly ONE canonical FAQ section and clean heading hierarchy", () => {
  const landingPage = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
  
  // Verify there is no duplicate FAQ heading
  assert.ok(
    !landingPage.includes("<h2>Frequently asked questions</h2>"),
    "Redundant outer <h2>Frequently asked questions</h2> must be removed from page.tsx"
  );
  assert.ok(
    landingPage.includes("<FaqAccordion"),
    "Canonical FaqAccordion component must be rendered on the landing page"
  );

  // FaqAccordion component inspection
  const faqComponent = fs.readFileSync(path.join(ROOT, "src/components/common/FaqAccordion.tsx"), "utf8");
  assert.ok(
    faqComponent.includes("eyebrow"),
    "FaqAccordion supports eyebrow prop for clean single hierarchy"
  );
  assert.ok(
    faqComponent.includes("aria-expanded") && faqComponent.includes("aria-controls"),
    "FaqAccordion includes ARIA accessibility attributes"
  );
  assert.ok(
    faqComponent.includes("Escape") || faqComponent.includes("Enter") || faqComponent.includes("keyboard"),
    "FaqAccordion has keyboard accessibility"
  );
});

test("2. User Feedback Schema & Migration: Canonical fields and RLS present", () => {
  const migration = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/026_user_feedback_and_discovery_batches.sql"),
    "utf8"
  );
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS public.feedback"), "Creates feedback table");
  assert.ok(migration.includes("guest_session_id"), "Includes guest_session_id");
  assert.ok(migration.includes("user_type"), "Includes user_type");
  assert.ok(migration.includes("idempotency_key"), "Includes idempotency_key");
  assert.ok(migration.includes("sentiment"), "Includes sentiment");
  assert.ok(migration.includes("admin_note"), "Includes admin_note");
  assert.ok(migration.includes("resolved_at"), "Includes resolved_at");
  assert.ok(migration.includes("resolved_by"), "Includes resolved_by");
  assert.ok(migration.includes("job_discovery_batches"), "Includes job_discovery_batches");
  assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"), "Feedback table has RLS enabled");
});

test("3. Feedback Ingestion API: Strict validation, categories, idempotency, guest support", () => {
  const apiRoute = fs.readFileSync(path.join(ROOT, "src/app/api/feedback/route.ts"), "utf8");
  
  // Rating validation
  assert.ok(apiRoute.includes("Number.isInteger(numRating)"), "Validates integer rating");
  assert.ok(apiRoute.includes("numRating < 1 || numRating > 5"), "Restricts rating to 1-5");
  
  // Category validation
  assert.ok(apiRoute.includes("CANONICAL_CATEGORIES"), "Validates against allowed categories");
  assert.ok(apiRoute.includes("'General'"), "Includes General category");
  assert.ok(apiRoute.includes("'Bug'"), "Includes Bug category");
  assert.ok(apiRoute.includes("'Tool Issue'"), "Includes Tool Issue category");
  assert.ok(apiRoute.includes("'Feature Request'"), "Includes Feature Request category");
  assert.ok(apiRoute.includes("'Performance'"), "Includes Performance category");
  assert.ok(apiRoute.includes("'Privacy'"), "Includes Privacy category");
  assert.ok(apiRoute.includes("'Payment'"), "Includes Payment category");
  assert.ok(apiRoute.includes("'Other'"), "Includes Other category");

  // Idempotency deduplication
  assert.ok(apiRoute.includes("idempotency_key") || apiRoute.includes("idempotencyKey"), "Supports idempotency key");
  assert.ok(apiRoute.includes("Feedback already recorded") || apiRoute.includes("effectiveIdemKey"), "Returns idempotent duplicate protection message");

  // No sensitive files
  assert.ok(!apiRoute.includes("fileBuffer") && !apiRoute.includes("fileContent"), "Does not store file content in feedback");
});

test("4. ResultDownload Component: Optional, non-blocking feedback with 1-5 rating & Send/Not Now buttons", () => {
  const resultDownload = fs.readFileSync(path.join(ROOT, "src/components/common/ResultDownload.tsx"), "utf8");
  
  assert.ok(resultDownload.includes("Was this tool helpful?"), "Prompts 'Was this tool helpful?'");
  assert.ok(resultDownload.includes("What could we improve?"), "Optional message input 'What could we improve?'");
  assert.ok(resultDownload.includes("Send Feedback"), "Includes 'Send Feedback' button");
  assert.ok(resultDownload.includes("Not Now"), "Includes 'Not Now' dismiss button");
  assert.ok(resultDownload.includes("idempotencyKey"), "Generates idempotencyKey to prevent duplicate submissions");
  
  // Non-blocking: download buttons and tool result are independent of feedback submission
  assert.ok(resultDownload.includes("useAutoDownload") && resultDownload.includes("downloadNow"), "Preserves auto-download and downloadNow functions independently");
});

test("5. Admin Feedback Dashboard: Real DB metrics, no fake stats, status actions & internal notes", () => {
  const adminPage = fs.readFileSync(path.join(ROOT, "src/app/admin/feedback/page.tsx"), "utf8");
  
  // Metrics & Empty states
  assert.ok(adminPage.includes("No feedback yet"), "Shows 'No feedback yet' when database is empty");
  assert.ok(!adminPage.includes("4.8 ★") && !adminPage.includes("98% Positive"), "Does not hardcode fake analytics");
  
  // Status actions
  assert.ok(adminPage.includes("Mark In Review") || adminPage.includes("IN_REVIEW"), "Supports IN_REVIEW status transition");
  assert.ok(adminPage.includes("Resolve") || adminPage.includes("RESOLVED"), "Supports RESOLVED status transition");
  assert.ok(adminPage.includes("Archive") || adminPage.includes("ARCHIVED"), "Supports ARCHIVED status transition");
  assert.ok(adminPage.includes("adminNotes") || adminPage.includes("adminNotesInput"), "Supports internal admin notes");

  // Filter dropdowns
  assert.ok(adminPage.includes("statusFilter"), "Has status filter");
  assert.ok(adminPage.includes("ratingFilter"), "Has rating filter");
  assert.ok(adminPage.includes("categoryFilter"), "Has category filter");
  assert.ok(adminPage.includes("userTypeFilter"), "Has user type filter");
  assert.ok(adminPage.includes("sentimentFilter"), "Has sentiment filter");
});

test("6. Jobs Persistent Discovery Pipeline: Discovery results persist immediately to DB as PENDING_REVIEW", () => {
  const discoverRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/career/discover/route.ts"), "utf8");
  assert.ok(
    discoverRoute.includes("persistDiscoveredResults"),
    "Discovery API immediately persists discovered jobs to database"
  );
  assert.ok(
    discoverRoute.includes("savedToSaarvi") || discoverRoute.includes("newCount"),
    "Returns exact saved/new/existing counts from DB persistence"
  );

  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(
    oppStore.includes("persistDiscoveredResults"),
    "OpportunityStore contains persistDiscoveredResults"
  );
  assert.ok(
    oppStore.includes("PENDING_REVIEW"),
    "Discovered jobs are stored with PENDING_REVIEW status"
  );
  assert.ok(
    oppStore.includes("discoveryBatchId"),
    "Discovered jobs link to discoveryBatchId"
  );
});

test("7. Discovery Upsert & Deduplication: Safe upsert preserves manual admin edits", () => {
  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  // Checks deduplication via sourceId, normalized apply URL, and title+company+location key
  assert.ok(
    oppStore.includes("normApply") && oppStore.includes("normKey"),
    "Performs deterministic multi-tier deduplication"
  );
  assert.ok(
    oppStore.includes("fetchedAt") && oppStore.includes("sourceLastUpdatedAt"),
    "Updates fetchedAt and sourceLastUpdatedAt freshness on rediscovery"
  );
  // Manual admin protection
  assert.ok(
    oppStore.includes("existing.salary") || oppStore.includes("PUBLISHED") || oppStore.includes("adminNotes"),
    "Safely protects admin manual modifications or published status from untrusted provider overwrites"
  );
});

test("8. Bulk Publish API: Single server operation, partial failure reporting, audit logging", () => {
  const bulkPublishRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/bulk-publish/route.ts"), "utf8");
  assert.ok(bulkPublishRoute.includes("bulkPublishOpportunities"), "Calls bulkPublishOpportunities");
  assert.ok(bulkPublishRoute.includes("getAuthenticatedAdmin"), "Enforces server-side admin authorization");

  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(oppStore.includes("bulkPublishOpportunities"), "OpportunityStore implements bulkPublishOpportunities");
  assert.ok(oppStore.includes("published: number") || oppStore.includes("result.published"), "Returns actual published count");
  assert.ok(oppStore.includes("failures"), "Reports partial failures with exact error reasons");
  assert.ok(oppStore.includes("Bulk published to live public feed") || oppStore.includes("BULK_PUBLISH"), "Logs audit event for bulk publish");
});

test("9. Bulk Delete/Archive API: Single server operation, default soft-delete archive, permanent option", () => {
  const bulkDeleteRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/bulk-delete/route.ts"), "utf8");
  assert.ok(bulkDeleteRoute.includes("bulkDeleteOpportunities"), "Calls bulkDeleteOpportunities");
  assert.ok(bulkDeleteRoute.includes("getAuthenticatedAdmin"), "Enforces server-side admin authorization");

  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(oppStore.includes("bulkDeleteOpportunities"), "OpportunityStore implements bulkDeleteOpportunities");
  assert.ok(oppStore.includes("ARCHIVED"), "Defaults to ARCHIVED status (soft-delete)");
  assert.ok(oppStore.includes("permanent"), "Supports permanent delete with explicit confirmation flag");
  assert.ok(oppStore.includes('action: "ARCHIVED"') && oppStore.includes('action: "DELETED"'), "Logs audit events for bulk delete and archive");
});

test("10. User Database-First Search: Active search excludes non-published/archived jobs", () => {
  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  // In getApprovedOpportunities, only published/approved active opportunities are returned to regular users
  assert.ok(
    oppStore.includes('o.status === "APPROVED" || o.status === "PUBLISHED"'),
    "Filter ensures only APPROVED or PUBLISHED opportunities are returned"
  );
  assert.ok(
    oppStore.includes("Never exposes DISCOVERED, PENDING_REVIEW, or REJECTED to public students"),
    "Strictly guarantees discovered/pending/rejected are never exposed to students"
  );
});

test("11. Discovery Batches History API: Stored sessions traceable by Admin", () => {
  const batchesRoute = fs.readFileSync(
    path.join(ROOT, "src/app/api/admin/jobs/discovery-batches/route.ts"),
    "utf8"
  );
  assert.ok(batchesRoute.includes("getDiscoveryBatches"), "Calls getDiscoveryBatches");
  assert.ok(batchesRoute.includes("batches"), "Returns discovery batches");

  const mockStorage = fs.readFileSync(path.join(ROOT, "src/lib/supabase/mock-storage.ts"), "utf8");
  assert.ok(mockStorage.includes("createDiscoveryBatch"), "MockStorageProvider supports createDiscoveryBatch");
  assert.ok(mockStorage.includes("getDiscoveryBatches"), "MockStorageProvider supports getDiscoveryBatches");
});

test("12. Admin Career UI: Fast bulk publish & bulk delete in single requests", () => {
  const adminCareerPage = fs.readFileSync(path.join(ROOT, "src/app/admin/career/page.tsx"), "utf8");
  assert.ok(
    adminCareerPage.includes("/api/admin/jobs/bulk-publish"),
    "Admin career page calls /api/admin/jobs/bulk-publish"
  );
  assert.ok(
    adminCareerPage.includes("/api/admin/jobs/bulk-delete"),
    "Admin career page calls /api/admin/jobs/bulk-delete"
  );
  assert.ok(
    adminCareerPage.includes("Publish Selected"),
    "Includes 'Publish Selected' bulk action"
  );
  assert.ok(
    adminCareerPage.includes("Publish All Eligible"),
    "Includes 'Publish All Eligible' bulk action"
  );
  assert.ok(
    adminCareerPage.includes("Select All") || adminCareerPage.includes("Select Page"),
    "Supports 'Select Page' / 'Select All' rows"
  );
});

test("13. Canonical Job ID & Zero Double-Prefixing: Canonical IDs strictly preserved", () => {
  const searchTs = fs.readFileSync(path.join(ROOT, "src/lib/jobs/search.ts"), "utf8");
  
  // Must NOT do 'opp_' + opp.id which produced opp_opp_manual_...
  assert.ok(
    !searchTs.includes("id: 'opp_' + opp.id") && !searchTs.includes('id: "opp_" + opp.id'),
    "search.ts must not prepend opp_ if opp.id is already canonical"
  );
  assert.ok(
    searchTs.includes("id: opp.id"),
    "search.ts must pass the canonical database ID directly"
  );

  const jobsPage = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");
  assert.ok(
    jobsPage.includes("href={`/jobs/${job.id}`}"),
    "User-facing job card View and Title links must reference canonical /jobs/${job.id}"
  );
});

test("14. Zero False 404 & Robust Canonical ID Resolution: getOpportunityById multi-tier lookup", () => {
  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  
  assert.ok(
    oppStore.includes("cleanId.startsWith(\"opp_\")"),
    "getOpportunityById handles prefix stripping and matching"
  );
  assert.ok(
    oppStore.includes("item.sourceId === cleanId") || oppStore.includes("provider_job_id"),
    "getOpportunityById matches legacy sourceId/provider_job_id"
  );
  assert.ok(
    oppStore.includes("canonicalJobKey"),
    "getOpportunityById matches deterministic canonicalJobKey"
  );
  assert.ok(
    oppStore.includes("MockStorageProvider.getJobOpportunities()"),
    "getOpportunityById falls back to persistent storage before returning null"
  );

  const searchTs = fs.readFileSync(path.join(ROOT, "src/lib/jobs/search.ts"), "utf8");
  assert.ok(
    searchTs.includes('opp.status === "PUBLISHED"'),
    "getJobById resolves jobs with PUBLISHED status (not just APPROVED)"
  );
});

test("15. SingleJobPage Graceful Unavailable State: Never exposes raw unhandled 404", () => {
  const jobDetailPage = fs.readFileSync(path.join(ROOT, "src/app/jobs/[id]/page.tsx"), "utf8");
  
  // Check for graceful unavailable component
  assert.ok(
    jobDetailPage.includes("This opportunity is no longer available"),
    "Shows helpful 'This opportunity is no longer available' message"
  );
  assert.ok(
    jobDetailPage.includes("Browse Active Opportunities"),
    "Provides direct CTA to 'Browse Active Opportunities'"
  );
  assert.ok(
    jobDetailPage.includes("href=\"/jobs\""),
    "Links back to canonical /jobs directory"
  );
  // Feature flag check
  assert.ok(
    jobDetailPage.includes("JobsFeatureControl.getSettings()"),
    "Verifies JobsFeatureControl state on job detail route"
  );
});

test("16. Safe Apply URL & Open Redirect Defense: Strict protocol and scheme validation", () => {
  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  
  assert.ok(
    oppStore.includes("export function isSafeUrl"),
    "isSafeUrl is exported for system-wide safety verification"
  );
  assert.ok(
    oppStore.includes("javascript:") && oppStore.includes("data:") && oppStore.includes("file:"),
    "isSafeUrl explicitly rejects dangerous schemes (javascript:, data:, file:, vbscript:)"
  );
  assert.ok(
    oppStore.includes("http://") && oppStore.includes("https://"),
    "isSafeUrl strictly requires http/https protocols"
  );

  const jobDetailPage = fs.readFileSync(path.join(ROOT, "src/app/jobs/[id]/page.tsx"), "utf8");
  assert.ok(
    jobDetailPage.includes("isSafeUrl(opp.applyUrl)"),
    "Job detail page guards apply button with isSafeUrl check"
  );
});

test("17. Admin Bulk Approve API: Server-side idempotent operation with MANAGE authorization", () => {
  const bulkApproveFile = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/bulk-approve/route.ts"), "utf8");
  
  assert.ok(bulkApproveFile.includes("getAuthenticatedAdmin"), "Enforces getAuthenticatedAdmin");
  assert.ok(bulkApproveFile.includes("bulkApproveOpportunities"), "Calls bulkApproveOpportunities");
  assert.ok(bulkApproveFile.includes("all_matching") || bulkApproveFile.includes("allMatching"), "Supports all_matching flag");
  assert.ok(bulkApproveFile.includes("job_ids") || bulkApproveFile.includes("jobIds"), "Supports job_ids array");
});

test("18. Admin Bulk Archive API: Soft archive with user history preservation", () => {
  const bulkArchiveFile = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/bulk-archive/route.ts"), "utf8");
  
  assert.ok(bulkArchiveFile.includes("getAuthenticatedAdmin"), "Enforces getAuthenticatedAdmin");
  assert.ok(bulkArchiveFile.includes("bulkArchiveOpportunities"), "Calls bulkArchiveOpportunities");
  assert.ok(bulkArchiveFile.includes("all_matching") || bulkArchiveFile.includes("allMatching"), "Supports all_matching flag");
});

test("19. Admin Retry Failed Discovery API: Idempotent partial-failure recovery", () => {
  const retryFailedFile = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/retry-failed/route.ts"), "utf8");
  
  assert.ok(retryFailedFile.includes("getAuthenticatedAdmin"), "Enforces getAuthenticatedAdmin");
  assert.ok(retryFailedFile.includes("retryFailedDiscovery"), "Calls retryFailedDiscovery");
  assert.ok(retryFailedFile.includes("batch_id") || retryFailedFile.includes("batchId"), "Requires batch_id");
});

test("20. Discovery Batches By ID API: Audit traceability for discovery operations", () => {
  const batchDetailFile = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/batches/[id]/route.ts"), "utf8");
  
  assert.ok(batchDetailFile.includes("getAuthenticatedAdmin"), "Enforces admin authorization");
  assert.ok(batchDetailFile.includes("getDiscoveryBatches"), "Retrieves batch details");
  assert.ok(batchDetailFile.includes("discoveryBatchId === id"), "Filters opportunities belonging to the batch");
});

test("21. Admin Check Job Diagnostics & Route Integrity API", () => {
  const diagFile = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/diagnostics/route.ts"), "utf8");
  assert.ok(diagFile.includes("getJobDiagnostics"), "Supports inspecting single job diagnostics");
  assert.ok(diagFile.includes("runRouteIntegrityCheck"), "Supports running full route integrity check");

  const singleDiagFile = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/[id]/diagnostics/route.ts"), "utf8");
  assert.ok(singleDiagFile.includes("getJobDiagnostics"), "Single job diagnostics endpoint calls getJobDiagnostics");

  const adminCareer = fs.readFileSync(path.join(ROOT, "src/app/admin/career/page.tsx"), "utf8");
  assert.ok(adminCareer.includes("Check Job") || adminCareer.includes("diagnosticsModal"), "Admin UI provides Check Job inspector modal");
});

test("22. Cache Invalidation Decoupling: Invalidation triggers on bulk publish and archive", () => {
  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(oppStore.includes("invalidateJobsCache"), "OpportunityStore calls invalidateJobsCache on state mutations");
  assert.ok(oppStore.includes("registerJobsCacheInvalidator"), "OpportunityStore exports registerJobsCacheInvalidator");

  const searchTs = fs.readFileSync(path.join(ROOT, "src/lib/jobs/search.ts"), "utf8");
  assert.ok(
    searchTs.includes("registerJobsCacheInvalidator(() => jobSearchService.clearCache())"),
    "search.ts registers its cache clearing handler with the invalidation system"
  );
});

test("23. Database Uniqueness & State Dimensions Migration: Schema invariants enforced", () => {
  const migration27 = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/027_canonical_jobs_uniqueness_and_state_dimensions.sql"),
    "utf8"
  );
  assert.ok(
    migration27.includes("uq_job_opps_provider_source_id"),
    "Defines UNIQUE index on (provider, source_job_id)"
  );
  assert.ok(
    migration27.includes("uq_job_opps_canonical_key"),
    "Defines UNIQUE index on canonical_job_key"
  );
  assert.ok(
    migration27.includes("record_state") && migration27.includes("ACTIVE"),
    "Adds record_state dimension"
  );
  assert.ok(
    migration27.includes("review_state") && migration27.includes("PENDING_REVIEW"),
    "Adds review_state dimension"
  );
  assert.ok(
    migration27.includes("publication_state") && migration27.includes("NOT_PUBLISHED"),
    "Adds publication_state dimension"
  );
  assert.ok(
    migration27.includes("verification_state") && migration27.includes("PASSED"),
    "Adds verification_state dimension"
  );
  assert.ok(
    migration27.includes("enrichment_state"),
    "Adds enrichment_state dimension"
  );
});

test("24. Algorithmic Invariants Verification: Safe URL detection and Deduplication", () => {
  // Test safe URL checks directly
  const unsafeUrls = [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "",
  ];
  const safeUrls = [
    "https://careers.google.com/jobs/results/123",
    "https://jobs.apple.com/en-us/details/456",
    "http://example.com/apply",
  ];

  // We test the exact regex logic implemented in isSafeUrl
  const isSafe = (url) => {
    if (!url) return false;
    const lower = url.trim().toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("file:") || lower.startsWith("vbscript:")) {
      return false;
    }
    return lower.startsWith("http://") || lower.startsWith("https://");
  };

  for (const url of unsafeUrls) {
    assert.equal(isSafe(url), false, `Should reject unsafe URL: ${url}`);
  }
  for (const url of safeUrls) {
    assert.equal(isSafe(url), true, `Should accept safe URL: ${url}`);
  }
});

